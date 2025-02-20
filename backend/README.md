# Folder Management Chatbot

A chatbot powered by AWS Bedrock and LangChain that helps you manage folders through natural language commands.

## Features

- Create new folders
- Delete existing folders
- Rename folders
- List folders and subfolders
- Natural language interface
- Safe folder operations within a designated workspace

## Prerequisites

- Python 3.8+
- AWS account with Bedrock access
- AWS credentials configured

## Installation

1. Clone the repository
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure AWS credentials:
   - If running outside AWS environment, uncomment and set AWS_PROFILE and BEDROCK_ASSUME_ROLE in main.py
   - Ensure you have appropriate permissions for AWS Bedrock

## Usage

1. Run the application:

```bash
python main.py
```

2. The chatbot will initialize and create a workspace directory if it doesn't exist.

3. Example commands:

   - "Create a new folder called 'documents' in the workspace"
   - "List all folders"
   - "Delete the folder 'old_stuff'"
   - "Rename folder 'docs' to 'documents'"

4. Type 'exit' to quit the application.

## Configuration

You can modify the following settings in `config.py`:

- Working directory location
- AWS region
- Model parameters
- Agent verbosity

## Security Note

The chatbot only operates within its designated workspace directory for safety.
All folder operations are restricted to this workspace.
