import os
import warnings
from agent_runner import AgentRunner
import config

# Suppress the specific deprecation warning from botocore
warnings.filterwarnings("ignore", category=DeprecationWarning, module="botocore.auth")


def setup_aws_credentials():
    """Set up AWS credentials and region."""
    os.environ["AWS_DEFAULT_REGION"] = config.AWS_DEFAULT_REGION


def main():
    setup_aws_credentials()

    working_directory = config.WORKING_DIRECTORY
    agent_runner = AgentRunner(working_directory, debug=True)

    print(f"Folder Bot initialized! Working directory: {working_directory}")
    print("Type 'exit' to quit")

    while True:
        user_input = input(
            f"\nWhat would you like to do? [Current dir: {working_directory}] "
        ).strip()

        if user_input.lower() == "exit":
            break

        result = agent_runner.run(user_input)
        print(f"\nAI Response: {result.result_message}")
        print(f"Analysis tokens used: {result.analysis_tokens}")
        print(f"Instruction tokens used: {result.instruction_tokens}")
        print(
            f"Total tokens used: {result.analysis_tokens + result.instruction_tokens}"
        )

        # Update working directory from result state
        working_directory = result.state["working_directory"]


if __name__ == "__main__":
    main()
