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

    memory_config = {
        "configurable": {
            "thread_id": thread_id,
        }
    }

    print(f"Folder Bot initialized! Working directory: {config.WORKING_DIRECTORY}")
    print("Type 'exit' to quit")

    while True:
        user_input = input("\nWhat would you like to do? ").strip()

        if user_input.lower() == "exit":
            break

        events = agent.stream(
            {"messages": [("user", user_input)]}, memory_config, stream_mode="values"
        )

        for event in events:
            print("\033[94m" + str(event) + "\033[0m" + "\n")
            last_event = event

        if isinstance(last_event["messages"][-1], AIMessage):
            print("\033[92m" + last_event["messages"][-1].content + "\033[0m" + "\n")


if __name__ == "__main__":
    main()
