import os

# AWS Bedrock Configuration
AWS_DEFAULT_REGION = "us-east-1"
BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0"
# BEDROCK_MODEL_ID = "amazon.nova-micro-v1:0"

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

# Agent Configuration
AGENT_VERBOSE = True

SYSTEM_MESSAGE = """
You are a helpful assistant that can help with tasks in a file system.
You have no knowledge of the outside world.
When returning a list of files or folders, return them in a tree structure.

"""
