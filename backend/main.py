import os
import uuid
import config
from langchain_core.messages.ai import AIMessage
from graph import graph


def setup_aws_credentials():
    """Set up AWS credentials and region."""
    os.environ["AWS_DEFAULT_REGION"] = config.AWS_DEFAULT_REGION


def main():
    setup_aws_credentials()

    agent = graph
    thread_id = str(uuid.uuid4())

    # Initialize working directory from config
    working_directory = config.WORKING_DIRECTORY

    memory_config = {
        "configurable": {
            "thread_id": thread_id,
        }
    }

    print(f"Folder Bot initialized! Working directory: {working_directory}")
    print("Type 'exit' to quit")

    while True:
        # Include current working directory in the prompt
        user_input = input(
            f"\nWhat would you like to do? [Current dir: {working_directory}] "
        ).strip()

        if user_input.lower() == "exit":
            break

        # Include both messages and working_directory in the initial state
        events = agent.stream(
            {
                "messages": [("user", user_input)],
                "working_directory": working_directory,
            },
            memory_config,
            stream_mode="values",
        )

        last_event = None
        for event in events:
            print("\033[94m" + str(event) + "\033[0m" + "\n")
            last_event = event

        if last_event:
            # Update working directory if it changed during execution
            if (
                "working_directory" in last_event
                and last_event["working_directory"] != working_directory
            ):
                working_directory = last_event["working_directory"]
                print(f"Working directory changed to: {working_directory}")

            # Display AI response
            if (
                "messages" in last_event
                and last_event["messages"]
                and isinstance(last_event["messages"][-1], AIMessage)
            ):
                print(
                    "\033[92m" + last_event["messages"][-1].content + "\033[0m" + "\n"
                )


if __name__ == "__main__":
    main()
