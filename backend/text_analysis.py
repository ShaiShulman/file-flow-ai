import os
import json
import re
from typing import Dict, Optional, Any, Annotated
import boto3
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState

from utils import truncate_text
from config import AWS_DEFAULT_REGION, BEDROCK_TEXT_MODEL_ID, DEBUG_LLM
from categories import categories_manager
from folder_operations import _get_full_path
from content_extractor import get_content, ContentResult


# Define prompt templates for each analysis type
PROMPT_TEMPLATES = {
    "categorize": """
    {number}. CATEGORY: Select the SINGLE most relevant category for this document based on its content and file name, which corresponds to the subject matter or type of the document. If no category represents the subject matter or type of document, return "N/A", otherwise return the parent category from the list of available categories.
    Result should be surrounded by <category> tag

    Available Categories:
    {categories}
    """,
    "title": """
    {number}. TITLE: Extract the SINGLE most likely title of the document, as literally appearing in the filename or content of the document. If you cannot find a clear title, return "N/A". Surround the result with <title> tag.
    """,
    "date": """
    {number}. DATE: Return the effective date or signing date of the document in YYYY-MM-DD format (e.g. 2024-08-21). If only a month and year are available, use the first day of the month (e.g. 2024-09-01). If only a year is available, use January 1st (e.g. 2024-01-01). If no clear date can be found, return "N/A". Surround the result with <date> tag.
    """,
    "subject": """
    {number}. SUBJECT MATTER: Return a short (3-8 words) explanation of the subject matter of the document, which can be used as log line. If there are multiple subject matters, select the most prominent one. Should not include the type of the document or any information that already appear in the returned TITLE. Surround the result with <subject> tag.
    """,
    "summary": """
    {number}. SUMMARY: Provide a SINGLE brief summary (3-5 sentences) that captures the main points of this document.
    Focus on the key information and main purpose of the document.
    Surround the result with <summary> tag.
    """,
    "question": """
    {number}. QUESTION: Question: {question}
    Provide a SINGLE clear and concise answer to this question based solely on the document content.
    If the answer cannot be determined from the document, state that clearly.
    Surround the result with <question> tag.
    """,
}


class TextAnalyzer:
    def __init__(self, model_id: str = BEDROCK_TEXT_MODEL_ID):
        """Initialize the TextAnalyzer with the specified Bedrock model.

        Args:
            model_id (str): The Bedrock model ID to use for analysis
        """
        self.model_id = model_id
        self.client = boto3.client("bedrock-runtime", region_name=AWS_DEFAULT_REGION)
        self.categories_manager = categories_manager

    def invoke_model(self, prompt: str) -> tuple[str, int]:
        """Invoke the Bedrock model with the given prompt using the Converse API.

        Uses the model-agnostic Converse API so any Bedrock model (Anthropic,
        Amazon Nova, Titan, etc.) works without format-specific request bodies.

        Args:
            prompt (str): The prompt to send to the model

        Returns:
            tuple[str, int]: A tuple containing the model's response text and total tokens used
        """
        if DEBUG_LLM:
            print("\033[38;5;208m=== PROMPT ===\n" + prompt + "\n=============\033[0m")

        try:
            response = self.client.converse(
                modelId=self.model_id,
                messages=[
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    }
                ],
                inferenceConfig={"maxTokens": 4096},
            )

            # Extract response text from Converse API format
            output = response.get("output", {})
            message = output.get("message", {})
            content_blocks = message.get("content", [])
            response_text = content_blocks[0].get("text", "") if content_blocks else ""

            usage = response.get("usage", {})
            total_tokens = usage.get("inputTokens", 0) + usage.get("outputTokens", 0)

            if DEBUG_LLM:
                print(
                    "\033[38;5;208m=== RESPONSE ===\n"
                    + response_text
                    + "\n==============\033[0m"
                )
                print(
                    f"\033[38;5;208m=== TOTAL TOKENS USED ===\n{total_tokens}\n==============\033[0m"
                )

            return response_text, total_tokens
        except Exception as e:
            error_msg = f"Error invoking Bedrock model: {str(e)}"
            if DEBUG_LLM:
                print(
                    "\033[38;5;208m=== ERROR ===\n" + error_msg + "\n===========\033[0m"
                )
            return error_msg, 0

    def build_instruction_section(
        self,
        categorize: bool = False,
        get_title: bool = False,
        get_date: bool = False,
        get_subject: bool = False,
        get_summary: bool = False,
        question: Optional[str] = None,
    ) -> str:
        """Build the instruction section of the prompt.

        Args:
            categorize (bool): Whether to categorize the document
            get_title (bool): Whether to extract the title
            get_date (bool): Whether to extract the date
            get_subject (bool): Whether to extract the subject matter
            get_summary (bool): Whether to create a summary
            question (Optional[str]): A specific question to answer

        Returns:
            str: The instruction section of the prompt
        """
        instruction_parts = [
            """
            You are analyzing legal documents. Your task is to analyze and categorize the provided document 
            according to the following instructions. For each analysis task, provide EXACTLY ONE response 
            within the specified XML tags. Do not include any text outside the XML tags.
            """
        ]

        # Track which analysis types are requested and their order
        analysis_types = []
        if categorize:
            analysis_types.append(("categorize", None))
        if get_title:
            analysis_types.append(("title", None))
        if get_date:
            analysis_types.append(("date", None))
        if get_subject:
            analysis_types.append(("subject", None))
        if get_summary:
            analysis_types.append(("summary", None))
        if question:
            analysis_types.append(("question", question))

        # Add each analysis type with its dynamic number
        for idx, (analysis_type, question_text) in enumerate(analysis_types, 1):
            if analysis_type == "categorize":
                categories = self.categories_manager.get_categories()
                categories_str = json.dumps(categories, indent=2)
                instruction_parts.append(
                    PROMPT_TEMPLATES[analysis_type].format(
                        number=idx, categories=categories_str
                    )
                )
            elif analysis_type == "question":
                instruction_parts.append(
                    PROMPT_TEMPLATES[analysis_type].format(
                        number=idx, question=question_text
                    )
                )
            else:
                instruction_parts.append(
                    PROMPT_TEMPLATES[analysis_type].format(number=idx)
                )

        return "\n".join(instruction_parts)

    def build_dynamic_prompt(
        self,
        content: str,
        filename: str,
        categorize: bool = False,
        get_title: bool = False,
        get_date: bool = False,
        get_subject: bool = False,
        get_summary: bool = False,
        question: Optional[str] = None,
    ) -> str:
        """Build a dynamic prompt based on the requested analysis types.

        Args:
            content (str): The document content
            filename (str): The name of the file
            categorize (bool): Whether to categorize the document
            get_title (bool): Whether to extract the title
            get_date (bool): Whether to extract the date
            get_subject (bool): Whether to extract the subject matter
            get_summary (bool): Whether to create a summary
            question (Optional[str]): A specific question to answer

        Returns:
            str: The complete prompt with instruction and content sections
        """
        # Build the instruction section first
        instruction_section = self.build_instruction_section(
            categorize=categorize,
            get_title=get_title,
            get_date=get_date,
            get_subject=get_subject,
            get_summary=get_summary,
            question=question,
        )

        # Create the document section
        document_section = f"""
        Document to analyze:

        <content>
        {content}
        </content>
        <file_name>{filename}</file_name>
        """

        # Combine sections
        prompt = f"""
        {instruction_section}

        {document_section}
        """

        return prompt

    def parse_response(
        self,
        response: str,
        categorize: bool = False,
        get_title: bool = False,
        get_date: bool = False,
        get_subject: bool = False,
        get_summary: bool = False,
        question: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Parse the model's response to extract information from XML tags.

        Args:
            response (str): The model's response
            categorize (bool): Whether categorization was requested
            get_title (bool): Whether title extraction was requested
            get_date (bool): Whether date extraction was requested
            get_subject (bool): Whether subject matter extraction was requested
            get_summary (bool): Whether summarization was requested
            question (Optional[str]): Whether a specific question was asked

        Returns:
            Dict[str, Any]: Dictionary containing the extracted information
        """
        results = {}

        if categorize:
            category_match = re.search(
                r"<category>(.*?)</category>", response, re.DOTALL
            )
            if category_match:
                results["category"] = category_match.group(1).strip()
            else:
                results["category"] = "N/A"

        if get_title:
            title_match = re.search(r"<title>(.*?)</title>", response, re.DOTALL)
            if title_match:
                results["title"] = title_match.group(1).strip()
            else:
                results["title"] = "N/A"

        if get_date:
            date_match = re.search(r"<date>(.*?)</date>", response, re.DOTALL)
            if date_match:
                results["date"] = date_match.group(1).strip()
            else:
                results["date"] = "N/A"

        if get_subject:
            subject_match = re.search(r"<subject>(.*?)</subject>", response, re.DOTALL)
            if subject_match:
                results["subject"] = subject_match.group(1).strip()
            else:
                results["subject"] = "N/A"

        if get_summary:
            summary_match = re.search(r"<summary>(.*?)</summary>", response, re.DOTALL)
            if summary_match:
                results["summary"] = summary_match.group(1).strip()

        if question:
            question_match = re.search(
                r"<question>(.*?)</question>", response, re.DOTALL
            )
            if question_match:
                results["question_answer"] = {
                    "question": question,
                    "answer": question_match.group(1).strip(),
                }

        return results


@tool
def get_metadata(
    file_path: str,
    state: Annotated[Dict[str, Any], InjectedState] = None,
) -> Dict[str, Any]:
    """Retrieve the current metadata for a file. Use this to check what metadata has been set.

    Args:
        file_path (str): The filename to get metadata for (just the filename, not full path)
        state (Annotated[Dict[str, Any], InjectedState]): The current state, injected by LangGraph

    Returns:
        Dict[str, Any]: Dictionary containing the file's metadata, or empty if none set
    """
    metadata = {}
    if state and "file_metadata" in state:
        metadata = state["file_metadata"].get(file_path, {})
    if metadata:
        return {"message": f"Metadata for '{file_path}': {metadata}", "metadata": metadata}
    return {"message": f"No metadata found for '{file_path}'.", "metadata": {}}


@tool
def update_metadata(
    file_path: str,
    metadata_updates: Dict[str, Any],
    state: Annotated[Dict[str, Any], InjectedState] = None,
) -> Dict[str, Any]:
    """Update metadata fields for a file. Use this to set or modify metadata like date, category, or custom fields.

    Args:
        file_path (str): The filename to update metadata for (just the filename, not full path)
        metadata_updates (Dict[str, Any]): Dictionary of field names and their new values. For example: {"date": "2024-01-15", "category": "Legal Agreements", "confirmed": "true"}
        state (Annotated[Dict[str, Any], InjectedState]): The current state, injected by LangGraph

    Returns:
        Dict[str, Any]: Dictionary containing the updated metadata
    """
    # Get existing metadata from state
    existing_metadata = {}
    if state and "file_metadata" in state and file_path in state["file_metadata"]:
        existing_metadata = state["file_metadata"][file_path].copy()

    # Merge updates
    existing_metadata.update(metadata_updates)

    # Update timestamp
    from datetime import datetime
    existing_metadata["last_analyzed"] = datetime.now().isoformat()

    metadata_update = {file_path: existing_metadata}

    return {
        "message": f"Metadata updated for '{file_path}': {metadata_updates}",
        "file_metadata": metadata_update,
        "total_tokens": 0,
    }


@tool
def analyze_document(
    working_directory: str,
    file_path: str,
    categorize: bool = False,
    title: bool = False,
    date: bool = False,
    subject: bool = False,
    summary: bool = False,
    question: Optional[str] = None,
    metadata_updates: Optional[Dict[str, Any]] = None,
    state: Annotated[Dict[str, Any], InjectedState] = None,
) -> Dict[str, Any]:
    """Analyze a document using Amazon Bedrock's Titan model. Can also update metadata fields directly.

    Args:
        working_directory (str): Base directory where operations are performed
        file_path (str): Path to the file to analyze, relative to working_directory
        categorize (bool): Whether to categorize the document based on available categories
        title (bool): Whether to extract the title from the document
        date (bool): Whether to extract the date from the document
        subject (bool): Whether to extract the subject matter from the document
        summary (bool): Whether to create a summary of the document
        question (Optional[str]): A specific question to answer about the document
        metadata_updates (Optional[Dict[str, Any]]): Dictionary of metadata fields to set directly, e.g. {"date": "2024-01-15", "confirmed": "true"}. These are applied after any analysis results.
        state (Annotated[Dict[str, Any], InjectedState]): The current state of the model, injected by LangGraph

    Returns:
        Dict[str, Any]: Dictionary containing analysis results and metadata updates
    """
    from datetime import datetime
    total_tokens = 0

    # Initialize metadata update with existing data if available
    existing_metadata = {}
    if state and "file_metadata" in state and file_path in state["file_metadata"]:
        existing_metadata = state["file_metadata"][file_path].copy()
        if DEBUG_LLM:
            print(f"\nRetrieved from state for {file_path}:")
            for field, value in existing_metadata.items():
                if field != "last_analyzed":
                    print(f"  - {field}: {value}")

    # Determine which fields need to be analyzed
    fields_to_analyze = {
        "category": categorize,
        "title": title,
        "date": date,
        "subject": subject,
        "summary": summary,
    }

    # Filter out fields that already have meaningful values in metadata
    # "N/A" values are treated as unresolved and should be re-analyzed
    fields_to_analyze = {
        field: requested
        for field, requested in fields_to_analyze.items()
        if requested and (field not in existing_metadata or existing_metadata.get(field) == "N/A")
    }

    # Check if we need to analyze anything
    need_analysis = any(fields_to_analyze.values()) or (question is not None)

    # Initialize results with existing metadata
    results = existing_metadata.copy()

    if need_analysis:
        # Get the file content only when analysis is needed
        content_result = get_content(working_directory, file_path)
        if content_result.text.startswith("Path") or content_result.text.startswith("Error"):
            return {"message": content_result.text, "file_metadata": {}}
        content = content_result.text.replace(f"Content of '{file_path}':\n", "", 1)

        # Track OCR status in metadata
        if content_result.was_ocr:
            results["_ocr_scanned"] = True
            results["_ocr_text"] = content_result.ocr_text

        if DEBUG_LLM:
            print(f"\nAnalyzing with model for {file_path}:")
            if fields_to_analyze:
                print("  Fields to analyze:")
                for field, requested in fields_to_analyze.items():
                    if requested:
                        print(f"    - {field}")
            if question:
                print(f"  Question to answer: {question}")

        # Truncate content to a reasonable length for the model
        truncated_content = truncate_text(content, max_words=2000, max_chars=8000)

        # Get the filename from the path
        filename = os.path.basename(file_path)

        # Initialize the analyzer
        analyzer = TextAnalyzer()

        # Build a dynamic prompt based on requested analyses
        prompt = analyzer.build_dynamic_prompt(
            truncated_content,
            filename,
            categorize=fields_to_analyze.get("category", False),
            get_title=fields_to_analyze.get("title", False),
            get_date=fields_to_analyze.get("date", False),
            get_subject=fields_to_analyze.get("subject", False),
            get_summary=fields_to_analyze.get("summary", False),
            question=question,
        )

        # Invoke the model with the combined prompt
        response, total_tokens = analyzer.invoke_model(prompt)

        # If the model call failed (0 tokens and error message), return the error
        if total_tokens == 0 and response.startswith("Error"):
            return {"message": response, "file_metadata": {}, "total_tokens": 0}

        # Parse the response to extract information from XML tags
        new_results = analyzer.parse_response(
            response,
            categorize=fields_to_analyze.get("category", False),
            get_title=fields_to_analyze.get("title", False),
            get_date=fields_to_analyze.get("date", False),
            get_subject=fields_to_analyze.get("subject", False),
            get_summary=fields_to_analyze.get("summary", False),
            question=question,
        )
        if DEBUG_LLM:
            print("\n  Model results:")
            for field, value in new_results.items():
                if field != "last_analyzed":  # Skip timestamp
                    print(f"    - {field}: {value}")
            print(f"  Total tokens used: {total_tokens}")

        # Update results with new findings
        results.update(new_results)

    elif DEBUG_LLM:
        print(
            f"\nNo analysis needed for {file_path} - all requested fields exist in state"
        )

    # Apply direct metadata updates if provided
    if metadata_updates:
        results.update(metadata_updates)

    # Always update the last_analyzed timestamp
    results["last_analyzed"] = datetime.now().isoformat()

    # Create the metadata update
    metadata_update = {file_path: results}

    # Mark the file as affected so it gets highlighted in the file explorer
    full_path = os.path.join(working_directory, file_path)

    # Increment progress for multi-file batch operations
    from progress import increment_progress
    increment_progress(os.path.basename(file_path))

    # Build a summary of the metadata for the LLM to see
    visible_metadata = {k: v for k, v in results.items() if not k.startswith("_") and k != "last_analyzed"}
    metadata_summary = ", ".join(f"{k}: {v}" for k, v in visible_metadata.items()) if visible_metadata else "no fields extracted"

    return {
        "message": f"Document analyzed. Metadata for '{file_path}': {metadata_summary}",
        "file_metadata": metadata_update,
        "total_tokens": total_tokens,
        "affected_files": [full_path],
    }
