from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableLambda
from langgraph.prebuilt import ToolNode

from folder_operations import (
    create_item,
    get_content,
    delete_item,
    list_items,
    move_item,
    change_directory,
)


def handle_tool_error(state) -> dict:
    """
    Function to handle errors that occur during tool execution.

    Args:
        state (dict): The current state of the AI agent, which includes messages and tool call details.

    Returns:
        dict: A dictionary containing error messages for each tool that encountered an issue.
    """
    # Retrieve the error from the current state
    error = state.get("error")

    # Access the tool calls from the last message in the state's message history
    tool_calls = state["messages"][-1].tool_calls

    # Return a list of ToolMessages with error details, linked to each tool call ID
    return {
        "messages": [
            ToolMessage(
                content=f"Error: {repr(error)}\n please fix your mistakes.",  # Format the error message for the user
                tool_call_id=tc[
                    "id"
                ],  # Associate the error message with the corresponding tool call ID
            )
            for tc in tool_calls  # Iterate over each tool call to produce individual error messages
        ]
    }


def update_working_directory(state) -> dict:
    """
    Process the output from the change_directory tool to update the working directory.

    Args:
        state (dict): The current state including the tool responses.

    Returns:
        dict: The updated state with any changes from tool execution.
    """
    # Get the last message which should be a tool message
    last_message = state["messages"][-1]

    print(f"DEBUG - Processing message: {type(last_message)}")

    # Check for errors in tool execution
    if hasattr(last_message, "status") and last_message.status == "error":
        print(f"DEBUG - Tool error detected: {last_message.content}")
        return {}

    # Check if it's a tool message from change_directory
    if hasattr(last_message, "name") and last_message.name == "change_directory":
        print(f"DEBUG - Found change_directory tool message")

        # Get the content from the tool message
        content = last_message.content
        print(f"DEBUG - Content type: {type(content)}")
        print(f"DEBUG - Content: {content}")

        # Check if content is a dictionary (which is what change_directory returns)
        if isinstance(content, dict) and "working_directory" in content:
            print(
                f"DEBUG - Found working_directory in dict: {content['working_directory']}"
            )
            # Update the working directory in the state
            return {"working_directory": content["working_directory"]}

        # Check if the content is a JSON string that needs to be parsed
        try:
            import json

            if isinstance(content, str):
                print(f"DEBUG - Trying to parse content as JSON")
                content_dict = json.loads(content)
                if "working_directory" in content_dict:
                    print(
                        f"DEBUG - Found working_directory in JSON: {content_dict['working_directory']}"
                    )
                    return {"working_directory": content_dict["working_directory"]}
        except Exception as e:
            print(f"DEBUG - JSON parsing error: {str(e)}")

    print(f"DEBUG - No working directory update found")
    return {}


def create_tool_node_with_fallback(tools: list) -> dict:
    """
    Function to create a tool node with fallback error handling.

    Args:
        tools (list): A list of tools to be included in the node.

    Returns:
        dict: A tool node that uses fallback behavior in case of errors.
    """
    # Create a ToolNode with the provided tools and attach a fallback mechanism
    # If an error occurs, it will invoke the handle_tool_error function to manage the error
    return ToolNode(tools).with_fallbacks(
        [
            RunnableLambda(handle_tool_error)
        ],  # Use a lambda function to wrap the error handler
        exception_key="error",  # Specify that this fallback is for handling errors
    )


# Define a function to process tool responses and update state when needed
def process_tools_output(state):
    """Handle the output from tools execution and update state accordingly."""
    # Check for change_directory tool response
    result = update_working_directory(state)

    # Add debugging message if there are changes
    if result:
        last_message = state["messages"][-1]
        print(
            f"DEBUG - Tool output from {last_message.name if hasattr(last_message, 'name') else 'unknown'}: {last_message.content}"
        )
        print(f"DEBUG - State update: {result}")

    # Return any updates (or empty dict if no updates)
    return result


part_1_tools = [
    create_item,
    get_content,
    delete_item,
    list_items,
    move_item,
    change_directory,
]
