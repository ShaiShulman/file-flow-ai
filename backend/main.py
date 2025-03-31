import os
import uuid
import warnings
from tools import get_directory_tree
import config
from langchain_core.messages.ai import AIMessage
from langchain_core.messages import ToolMessage

from graph import graph

# Suppress the specific deprecation warning from botocore
warnings.filterwarnings("ignore", category=DeprecationWarning, module="botocore.auth")


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
        event_counter = 1
        for event in events:
            # Format the event as a string with proper line breaks
            event_str = f"\nEvent {event_counter}:"

            # Handle different types of events
            if isinstance(event, dict):
                for key, value in event.items():
                    if key == "messages":
                        event_str += "\n  Messages:"
                        for msg_idx, msg in enumerate(value, 1):
                            msg_type = (
                                msg.__class__.__name__
                                if hasattr(msg, "__class__")
                                else type(msg).__name__
                            )
                            msg_str = f"\n    - [{msg_idx}] [{msg_type}] {msg}"
                            # Color individual messages red if they contain the word error, blue otherwise
                            if "error" in str(msg).lower():
                                msg_str = (
                                    "\033[91m" + msg_str + "\033[0m"
                                )  # Red for error messages
                            else:
                                msg_str = (
                                    "\033[94m" + msg_str + "\033[0m"
                                )  # Blue for normal messages
                            event_str += msg_str
                    elif key == "working_directory":
                        event_str += f"\n  Working Directory: {value}"
                    else:
                        event_str += f"\n  {key}: {value}"
            else:
                event_str += f"\n  {event}"

            # Print all events in blue
            print("\033[94m" + event_str + "\033[0m")  # Blue for all events

            event_counter += 1
            last_event = event

        # Handle interrupts for sensitive tools
        snapshot = agent.get_state(memory_config)
        while snapshot and snapshot.next:
            print(
                "\nSensitive operation detected! This operation will modify the file system."
            )
            user_approval = (
                input(
                    "Do you approve this action? (y/n) or provide alternative instructions: "
                )
                .strip()
                .lower()
            )

            if user_approval == "y":
                result = agent.invoke(None, memory_config)
            else:
                if user_approval == "n":
                    message = "Operation cancelled by user."
                else:
                    message = f"Operation modified: {user_approval}"

                result = agent.invoke(
                    {
                        "messages": [
                            ToolMessage(
                                tool_call_id=event["messages"][-1].tool_calls[0]["id"],
                                content=f"API call modified. Reason: {message}",
                            )
                        ]
                    },
                    memory_config,
                )
            snapshot = agent.get_state(memory_config)

        if last_event:
            # Update working directory if it changed during execution
            if (
                "working_directory" in last_event
                and last_event["working_directory"] != working_directory
            ):
                working_directory = last_event["working_directory"]
                print(f"Working directory changed to: {working_directory}")

            # Display folder content
            print("\033[93m" + get_directory_tree(working_directory) + "\033[0m" + "\n")

            # # Show last DisplayMessage
            # if (
            #     "messages" in last_event
            #     and last_event["messages"]
            #     and len(last_event["messages"]) > 1
            #     and isinstance(last_event["messages"][-2], AIMessage)
            # ):
            #     print(
            #         "\033[93m" + last_event["messages"][-2].content + "\033[0m" + "\n"
            #     )
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
