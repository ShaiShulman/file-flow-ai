from typing import Annotated, Literal
from langgraph.graph.message import AnyMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langchain_core.runnables import Runnable, RunnableLambda
from langgraph.checkpoint.memory import MemorySaver
from prompts import primary_assistant_prompt
from llm import llm
from config import WORKING_DIRECTORY
from tools import (
    create_tool_node_with_fallback,
    safe_tools,
    sensitive_tools,
    sensitive_tool_names,
    process_tools_output,
)
from state import State


class Assistant:
    def __init__(self, runnable: Runnable):
        self.runnable = runnable

    def __call__(self, state: State):
        current_wd = state.get("working_directory", WORKING_DIRECTORY)
        current_runnable = (
            primary_assistant_prompt.partial(working_directory=current_wd)
            | self.runnable
        )

        result = current_runnable.invoke(state)

        # If we get an empty response, ask for clarification
        if not result.tool_calls and (
            not result.content
            or isinstance(result.content, list)
            and not result.content[0].get("text")
        ):
            messages = state["messages"] + [("user", "Respond with a real output.")]
            state = {
                **state,
                "messages": messages,
                "working_directory": current_wd,
            }
            result = current_runnable.invoke(state)

        return {"messages": result}


def get_initial_state():
    return {"working_directory": WORKING_DIRECTORY}


def route_tools(state: State):
    """Route messages to appropriate tool nodes based on tool calls."""
    next_node = tools_condition(state)
    if next_node == END:
        return END

    ai_message = state["messages"][-1]
    if not hasattr(ai_message, "tool_calls") or not ai_message.tool_calls:
        return END

    has_sensitive_tools = any(
        tool_call.get("name", "") in sensitive_tool_names
        for tool_call in ai_message.tool_calls
    )

    return "sensitive_tools" if has_sensitive_tools else "safe_tools"


builder = StateGraph(State)

# Initialize assistant with all tools
assistant_runnable = llm.bind_tools(safe_tools + sensitive_tools)
builder.add_node("assistant", Assistant(assistant_runnable))
builder.add_node("safe_tools", create_tool_node_with_fallback(safe_tools))
builder.add_node("sensitive_tools", create_tool_node_with_fallback(sensitive_tools))
builder.add_node("process_output", RunnableLambda(process_tools_output))

builder.add_edge(START, "assistant")
builder.add_conditional_edges(
    "assistant", route_tools, ["safe_tools", "sensitive_tools", END]
)
builder.add_edge("safe_tools", "process_output")
builder.add_edge("sensitive_tools", "process_output")
builder.add_edge("process_output", "assistant")

memory = MemorySaver()

graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["sensitive_tools"],
)
