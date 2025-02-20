from typing import List
from langchain_aws import ChatBedrock as Bedrock
from langchain.tools.base import StructuredTool
from langchain.agents import initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory
from folder_operations import FolderOperations
import config
import time
from functools import wraps


class TimedBedrock(Bedrock):
    def invoke(self, *args, **kwargs):
        start_time = time.time()
        result = super().invoke(*args, **kwargs)
        end_time = time.time()
        print(f"LLM call time: {end_time - start_time:.2f} seconds")
        return result


def get_bedrock_llm() -> Bedrock:
    """Initialize and return the Bedrock LLM."""
    return TimedBedrock(
        model_id=config.BEDROCK_MODEL_ID, model_kwargs=config.MODEL_KWARGS
    )


def create_folder_tools(folder_ops: FolderOperations) -> List[StructuredTool]:
    """Create and return a list of tools for folder operations."""
    return [
        StructuredTool.from_function(
            func=folder_ops.create_item,
            name="CreateItem",
            description="Create a new file or folder. For files, you can optionally provide content.",
        ),
        StructuredTool.from_function(
            func=folder_ops.delete_item,
            name="DeleteItem",
            description="Delete a file or folder. Optionally specify item_type ('file' or 'folder') for type checking.",
        ),
        StructuredTool.from_function(
            func=folder_ops.rename_item,
            name="RenameItem",
            description="Rename a file or folder. Provide the old path and new name.",
        ),
        StructuredTool.from_function(
            func=folder_ops.list_items,
            name="ListItems",
            description="List items in a directory. Can filter by type ('files', 'folders', 'all') and list recursively.",
        ),
        StructuredTool.from_function(
            func=folder_ops.get_content,
            name="GetContent",
            description="Get the content of a file. Provide the path to the file.",
        ),
        StructuredTool.from_function(
            func=folder_ops.move_item,
            name="MoveItem",
            description="Move a file or folder. Provide the source path and destination path.",
        ),
        StructuredTool.from_function(
            func=folder_ops.copy_item,
            name="CopyItem",
            description="Copy a file or folder. Provide the source path and destination path.",
        ),
    ]


def setup_agent(folder_ops: FolderOperations):
    """Set up and return the LangChain agent with folder operation tools."""
    llm = get_bedrock_llm()
    tools = create_folder_tools(folder_ops)

    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    return initialize_agent(
        tools,
        llm,
        agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
        verbose=config.AGENT_VERBOSE,
        memory=memory,
        system_message=config.SYSTEM_MESSAGE,
    )
