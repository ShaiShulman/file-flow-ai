import os

# Run Configuration
DEBUG_LLM = False
DEBUG_GRAPH = True

# AWS Bedrock Configuration
AWS_DEFAULT_REGION = "us-east-1"
BEDROCK_INSTRUCTIONS_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
BEDROCK_TEXT_MODEL_ID = "amazon.nova-micro-v1:0"  # "amazon.titan-text-lite-v1"1


# Model Configuration
MODEL_KWARGS = {
    "temperature": 0.5,
    "top_k": 250,
    "top_p": 1,
    "stop_sequences": ["\n\nHuman"],
}

# Folder Configuration
WORKING_DIRECTORY = os.path.join(
    os.path.expanduser("~"), "folder_bot_workspace"
).replace("/", "\\")

# Allow changing to directories anywhere on the system
ALLOW_EXTERNAL_DIRECTORIES = True

# Recursion limit for the graph
RECURSION_LIMIT = 500

# Agent Configuration
AGENT_VERBOSE = True
# Whether to filter out affected_files and actions from prompt messages
FILTER_PROMPT_MESSAGES = True

# Sliding window: keep last N messages in LLM context
MESSAGE_WINDOW_SIZE = 40

# Exact match mode: when enabled, the LLM can use name_pattern on move/copy tools
# to match files by filename substring without AI reviewing each file individually
ENABLE_EXACT_MATCH = True

# Pricing per 1000 tokens (USD)
MODEL_PRICING = {
    "anthropic.claude-3-5-sonnet-20240620-v1:0": {
        "input": 0.003,
        "output": 0.015,
    },
    "us.anthropic.claude-3-5-haiku-20241022-v1:0": {
        "input": 0.001,
        "output": 0.005,
    },
}


def calculate_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate USD cost for a given model and token counts."""
    pricing = MODEL_PRICING.get(model_id, {"input": 0.003, "output": 0.015})
    return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1000


# OCR Configuration
OCR_MIN_CONTENT_CHARS = 100  # Trigger OCR if extracted text < this many chars
OCR_FIRST_PAGES = 3  # Number of first pages to extract from PDFs
OCR_LAST_PAGES = 2  # Number of last pages to extract from PDFs
OCR_MIN_CHARS_THRESHOLD = 1500  # If total OCR text < this, return all of it
OCR_FIRST_CHARS = 1000  # First N chars to keep when truncating OCR output
OCR_LAST_CHARS = 500  # Last N chars to keep when truncating OCR output
OCR_DPI = 300  # DPI for rendering PDF pages to images for OCR


SYSTEM_MESSAGE = """
You are a helpful assistant that can help with tasks in a file system.
You have no knowledge of the outside world.
When returning a list of files or folders, return them in a tree structure.

"""
