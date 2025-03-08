from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableLambda
from langgraph.prebuilt import ToolNode
import json

from folder_operations import (
    create_item,
    get_content,
    delete_item,
    list_items,
    move_item,
    change_directory,
)

# Safe tools are read-only operations that don't modify the file system
safe_tools = [
    get_content,
    list_items,
    change_directory,
]

# Sensitive tools are operations that modify the file system
sensitive_tools = [
    create_item,
    delete_item,
    move_item,
]

# Create a set of sensitive tool names for quick lookup
sensitive_tool_names = {t.name for t in sensitive_tools}


def handle_tool_error(state) -> dict:
    """
    Function to handle errors that occur during tool execution.

    Args:
        state (dict): The current state of the AI agent, which includes messages and tool call details.

    Returns:
        dict: A dictionary containing error messages for each tool that encountered an issue.
    """
    error = state.get("error")
    tool_calls = state["messages"][-1].tool_calls
    return {
        "messages": [
            ToolMessage(
                content=f"Error: {repr(error)}\n Please fix your mistakes.",
                tool_call_id=tc["id"],
            )
            for tc in tool_calls
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
    last_message = state["messages"][-1]

    # Check for errors in tool execution
    if hasattr(last_message, "status") and last_message.status == "error":
        return {}

    # Check if it's a tool message from change_directory
    if hasattr(last_message, "name") and last_message.name == "change_directory":
        try:
            content = last_message.content
            if isinstance(content, str):
                content_dict = json.loads(content)
                if "working_directory" in content_dict:
                    return {"working_directory": content_dict["working_directory"]}
        except Exception:
            pass

    return {}


def create_tool_node_with_fallback(tools: list) -> dict:
    """
    Function to create a tool node with fallback error handling.

    Args:
        tools (list): A list of tools to be included in the node.

    Returns:
        dict: A tool node that uses fallback behavior in case of errors.
    """
    return ToolNode(tools).with_fallbacks(
        [RunnableLambda(handle_tool_error)],
        exception_key="error",
    )


def process_tools_output(state):
    """Handle the output from tools execution and update state accordingly."""
    return update_working_directory(state)
