import os
import boto3
from folder_operations import FolderOperations
from agent_setup import setup_agent
import config


def setup_aws_credentials():
    """Set up AWS credentials and region."""
    os.environ["AWS_DEFAULT_REGION"] = config.AWS_DEFAULT_REGION
    # Uncomment and set these if running outside AWS environment
    # os.environ['AWS_PROFILE'] = '<YOUR_PROFILE>'
    # os.environ['BEDROCK_ASSUME_ROLE'] = '<YOUR_ROLE>'


def main():
    setup_aws_credentials()

    folder_ops = FolderOperations(config.WORKING_DIRECTORY)

    agent = setup_agent(folder_ops)

    print(f"Folder Bot initialized! Working directory: {config.WORKING_DIRECTORY}")
    print("Type 'exit' to quit")

    while True:
        user_input = input("\nWhat would you like to do? ").strip()

        if user_input.lower() == "exit":
            break

        try:
            response = agent.run(user_input)
            print("\nResponse:", response)
        except Exception as e:
            print(f"\nError: {str(e)}")


if __name__ == "__main__":
    main()
