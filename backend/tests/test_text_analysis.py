import os
import json
from text_analysis import analyze_document, TextAnalyzer, PROMPT_TEMPLATES
from config import WORKING_DIRECTORY


def test_analyze_document():
    """Test the analyze_document tool with a sample text file."""
    # Create a test file
    test_dir = os.path.join(WORKING_DIRECTORY, "test")
    os.makedirs(test_dir, exist_ok=True)

    test_file_path = os.path.join(test_dir, "sample_document.txt")
    test_content = """
    # Quarterly Financial Report
    
    Date: 2023-04-15
    
    ## Executive Summary
    
    This report provides an overview of the financial performance for Q1 2023. 
    The company has exceeded revenue targets by 12% and reduced operational costs by 8%.
    
    ## Key Metrics
    
    - Revenue: $2.4M
    - Expenses: $1.8M
    - Profit: $600K
    
    ## Recommendations
    
    Based on the strong Q1 performance, we recommend increasing the marketing budget by 10%
    for Q2 to capitalize on market momentum.
    """

    with open(test_file_path, "w") as f:
        f.write(test_content)

    # Test with all analysis options
    print("\n=== TESTING COMBINED ANALYSIS ===")
    result = analyze_document.invoke(
        {
            "working_directory": WORKING_DIRECTORY,
            "file_path": os.path.relpath(test_file_path, WORKING_DIRECTORY),
            "categorize": True,
            "get_title": True,
            "get_date": True,
            "get_summary": True,
            "question": "What was the revenue in Q1?",
        }
    )

    # Parse the result
    result_dict = json.loads(result)

    # Print the results
    print(json.dumps(result_dict, indent=2))

    # Test individual analysis options
    print("\n=== TESTING TITLE EXTRACTION ONLY ===")
    title_result = analyze_document.invoke(
        {
            "working_directory": WORKING_DIRECTORY,
            "file_path": os.path.relpath(test_file_path, WORKING_DIRECTORY),
            "get_title": True,
        }
    )

    print(title_result)

    # Test with a specific question
    print("\n=== TESTING QUESTION ANSWERING ONLY ===")
    question_result = analyze_document.invoke(
        {
            "working_directory": WORKING_DIRECTORY,
            "file_path": os.path.relpath(test_file_path, WORKING_DIRECTORY),
            "question": "What is the recommended action for Q2?",
        }
    )

    print(question_result)

    # Test the dynamic prompt builder directly
    print("\n=== TESTING DYNAMIC PROMPT BUILDER ===")
    analyzer = TextAnalyzer()
    dynamic_prompt = analyzer.build_dynamic_prompt(
        content=test_content,
        filename="sample_document.txt",
        categorize=True,
        get_title=True,
        question="What is the profit amount?",
    )
    print(dynamic_prompt)

    # Test the response parser with a mock response
    print("\n=== TESTING RESPONSE PARSER ===")
    mock_response = """
    <title>Quarterly Financial Report</title>
    
    <date>2023-04-15</date>
    
    <categorize>
    {
      "document_type": "financial_report",
      "time_period": "quarterly",
      "department": "finance"
    }
    </categorize>
    
    <question>
    The revenue in Q1 was $2.4M as stated in the Key Metrics section of the document.
    </question>
    """

    parsed_results = analyzer.parse_response(
        mock_response,
        categorize=True,
        get_title=True,
        get_date=True,
        question="What was the revenue in Q1?",
    )

    print(json.dumps(parsed_results, indent=2))

    # Clean up
    os.remove(test_file_path)
    if not os.listdir(test_dir):
        os.rmdir(test_dir)


if __name__ == "__main__":
    test_analyze_document()
