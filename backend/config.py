import os

# Run Configuration
DEBUG_LLM = True

# AWS Bedrock Configuration
AWS_DEFAULT_REGION = "us-east-1"
BEDROCK_INSTRUCTIONS_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0"
BEDROCK_TEXT_MODEL_ID = (
    "us.anthropic.claude-3-5-haiku-20241022-v1:0"  # "amazon.titan-text-lite-v1"
)


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
RECURSION_LIMIT = 50

# Agent Configuration
AGENT_VERBOSE = True

SYSTEM_MESSAGE = """
You are a helpful assistant that can help with tasks in a file system.
You have no knowledge of the outside world.
When returning a list of files or folders, return them in a tree structure.

"""
