from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import AnyMessage, add_messages
from langgraph.graph import StateGraph, START
from langgraph.prebuilt import tools_condition
from langchain_core.runnables import Runnable, RunnableLambda
from langgraph.checkpoint.memory import MemorySaver
from prompts import primary_assistant_prompt
from llm import llm
from config import WORKING_DIRECTORY
from tools import create_tool_node_with_fallback, part_1_tools, process_tools_output


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    working_directory: str


class Assistant:
    def __init__(self, runnable: Runnable):
        # Initialize with the runnable that defines the process for interacting with the tools
        self.runnable = runnable

    def __call__(self, state: State):
        while True:
            # Get the working directory from state
            current_wd = state.get("working_directory", WORKING_DIRECTORY)

            # Create a new runnable with the current working directory from state
            current_runnable = primary_assistant_prompt.partial(
                working_directory=current_wd
            ) | llm.bind_tools(part_1_tools)

            # Invoke the runnable with the current state
            result = current_runnable.invoke(state)

            # If the tool fails to return valid output, re-prompt the user to clarify or retry
            if not result.tool_calls and (
                not result.content
                or isinstance(result.content, list)
                and not result.content[0].get("text")
            ):
                # Add a message to request a valid response
                messages = state["messages"] + [("user", "Respond with a real output.")]
                state = {
                    **state,
                    "messages": messages,
                    "working_directory": current_wd,
                }
            else:
                # Break the loop when valid output is obtained
                break

        # Return the final state after processing the runnable
        return {"messages": result}


# Initialize with a default working directory from config
def get_initial_state():
    return {"working_directory": WORKING_DIRECTORY}


# Remove the static binding since we'll do it dynamically
part_1_assistant_runnable = llm.bind_tools(part_1_tools)

builder = StateGraph(State)

builder.add_node("assistant", Assistant(part_1_assistant_runnable))
builder.add_node("tools", create_tool_node_with_fallback(part_1_tools))
builder.add_node("process_output", RunnableLambda(process_tools_output))

builder.add_edge(START, "assistant")  # Start with the assistant
builder.add_conditional_edges("assistant", tools_condition)  # Move to tools after input
builder.add_edge(
    "tools", "process_output"
)  # Process the tool output to update state if needed
builder.add_edge("process_output", "assistant")  # Return to assistant after processing

memory = MemorySaver()

graph = builder.compile(checkpointer=memory)
