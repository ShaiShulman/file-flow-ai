import json
from typing import List, Any
from langgraph.graph.message import AnyMessage
from config import FILTER_PROMPT_MESSAGES, MESSAGE_WINDOW_SIZE

# Fields to remove from message content
IGNORED_FIELDS = {"affected_files", "actions"}


def filter_message_content(content: Any) -> Any:
    """Filter out specified fields from message content."""
    if not FILTER_PROMPT_MESSAGES:
        return content

    if isinstance(content, str):
        try:
            content_dict = json.loads(content)
            if isinstance(content_dict, dict):
                return json.dumps(
                    {k: v for k, v in content_dict.items() if k not in IGNORED_FIELDS}
                )
        except json.JSONDecodeError:
            pass
    elif isinstance(content, dict):
        return {k: v for k, v in content.items() if k not in IGNORED_FIELDS}

    return content


def apply_sliding_window(messages: List[AnyMessage]) -> List[AnyMessage]:
    """Keep only the last MESSAGE_WINDOW_SIZE messages, preserving system messages."""
    if len(messages) <= MESSAGE_WINDOW_SIZE:
        return messages

    system_messages = [m for m in messages if hasattr(m, "type") and m.type == "system"]
    non_system = [m for m in messages if not (hasattr(m, "type") and m.type == "system")]

    windowed = non_system[-MESSAGE_WINDOW_SIZE:]
    return system_messages + windowed


def filter_messages(messages: List[AnyMessage]) -> List[AnyMessage]:
    """Filter out specified fields from all messages and apply sliding window."""
    if FILTER_PROMPT_MESSAGES:
        messages = [
            (
                msg.__class__(
                    content=filter_message_content(msg.content),
                    **{k: v for k, v in msg.__dict__.items() if k != "content"}
                )
                if hasattr(msg, "content")
                else msg
            )
            for msg in messages
        ]

    return apply_sliding_window(messages)
