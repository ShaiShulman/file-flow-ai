import json
from typing import List, Optional
from langchain_core.tools import tool


@tool
def ask_user(
    question: str,
    options: Optional[List[str]] = None,
    allow_multiple: bool = False,
) -> str:
    """Ask the user a clarifying question before proceeding with an action.

    Use this tool ONLY when the user's request is missing critical information
    that you cannot reasonably infer. For example, the user asks to move files
    to a new folder but doesn't specify the folder name.

    Args:
        question: The clarifying question to present to the user
        options: Optional list of choices for the user to pick from.
                 When provided, the frontend renders radio buttons or checkboxes.
        allow_multiple: If True and options are provided, the user can select
                        multiple options. Defaults to False (single selection).

    Returns:
        str: JSON string with the clarification request details.
             The actual user answer arrives as the next user message.
    """
    return json.dumps({
        "type": "clarification",
        "question": question,
        "options": options or [],
        "allow_multiple": allow_multiple,
    })
