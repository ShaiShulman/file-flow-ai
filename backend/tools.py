import os
from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableLambda
from langgraph.prebuilt import ToolNode
from langchain_core.messages.ai import AIMessage
import json

from folder_operations import (
    create_item,
    delete_item,
    list_items,
    copy_item,
    move_item,
    change_directory,
)

from category_tools import (
    add_category,
    remove_category,
    update_category,
    clear_categories,
    list_categories,
    get_category,
)

from text_analysis import (
    analyze_document,
)

from action_types import ActionInfo, ActionType

# Safe tools are read-only operations that don't modify the file system
safe_tools = [
    list_items,
    change_directory,
    add_category,
    remove_category,
    update_category,
    clear_categories,
    list_categories,
    get_category,
    analyze_document,
]

# Sensitive tools are operations that modify the file system
sensitive_tools = [
    delete_item,
    move_item,
    copy_item,
    create_item,
]

# Create a set of sensitive tool names for quick lookup
sensitive_tool_names = {t.name for t in sensitive_tools}


class DisplayMessage(AIMessage):
    pass


def get_directory_tree(working_directory: str, affected_files: list[str]) -> str:
    """Display the directory structure in a tree-like format with icons.

    Args:
        working_directory (str): The directory to display
        affected_files (list[str]): List of full file paths that should be marked with an asterisk

    Returns:
        str: Tree-like structure of the directory with icons
    """
    try:
        tree_output = []

        # Get all items in directory using scandir
        with os.scandir(working_directory) as entries:
            entries = list(entries)

            for idx, entry in enumerate(entries):
                is_last = idx == len(entries) - 1
                prefix = "└── " if is_last else "├── "

                icon = "📁 " if entry.is_dir() else "📄 "

                # Check if the full path of the entry is in affected_files
                full_path = os.path.join(working_directory, entry.name)
                affected_marker = " *" if full_path in affected_files else ""

                tree_output.append(f"{prefix}{icon}{entry.name}{affected_marker}")

        return "\n".join(tree_output)
    except Exception as e:
        return f"Error displaying directory tree: {str(e)}"


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


def extract_tool_result(state) -> dict:
    """
    Process the result from tool execution and update state accordingly.

    Args:
        state (dict): The current state of the AI agent, which includes messages and tool call details.

    Returns:
        dict: The updated state with any changes from tool execution.
    """
    messages = state["messages"]
    result = {}

    # Process messages in reverse order until we hit a non-AI message
    for msg in reversed(messages):
        # Check if this is an AI message with tool calls
        if not hasattr(msg, "__class__") or not type(msg).__name__ == "ToolMessage":
            break

        if not msg.content:
            continue

        # Handle both string content (needs JSON parsing) and dict content
        content_dict = {}
        if isinstance(msg.content, str):
            try:
                # First parse the outer message
                outer_dict = json.loads(msg.content)
                # If the message field contains a string that looks like JSON, parse it too
                if "message" in outer_dict and isinstance(outer_dict["message"], str):
                    try:
                        inner_dict = json.loads(outer_dict["message"].replace("'", '"'))
                        content_dict = inner_dict
                    except json.JSONDecodeError:
                        content_dict = outer_dict
            except json.JSONDecodeError:
                # If not valid JSON, use the content as is
                content_dict = {"message": msg.content}
        else:
            # Content is already a dictionary
            content_dict = msg.content

        # Handle file metadata updates from analyze_document
        if "file_metadata" in content_dict:
            result["file_metadata"] = content_dict["file_metadata"]

        if "total_tokens" in content_dict:
            result["analysis_tokens"] = (
                state["analysis_tokens"] + content_dict["total_tokens"]
            )

        # Handle affected files updates
        if "affected_files" in content_dict:
            if "affected_files" not in result:
                result["affected_files"] = []
            result["affected_files"].extend(content_dict["affected_files"])

        # Handle actions from sensitive tools
        if "action" in content_dict and content_dict["action"] is not None:
            if "actions" not in result:
                result["actions"] = []
            result["actions"].append(ActionInfo.from_dict(content_dict["action"]))

    return result


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
    working_dir_update = update_working_directory(state)
    tool_result = extract_tool_result(state)

    # # If we have new actions, add them to the state's actions
    # if "actions" in tool_result:
    #     if "actions" not in state:
    #         state["actions"] = []
    #     # Let the AccumulatorList handle the accumulation
    #     state["actions"].extend(tool_result["actions"])

    return {**working_dir_update, **tool_result}
