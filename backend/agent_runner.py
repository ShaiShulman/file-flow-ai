import uuid
import json
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from langchain_core.messages.ai import AIMessage
from tools import get_directory_tree
import config
from graph import graph
from action_types import ActionInfo
from reducers import ClearList


@dataclass
class ClarificationRequest:
    """A clarification question from the agent to the user."""

    question: str
    options: List[str] = field(default_factory=list)
    allow_multiple: bool = False


@dataclass
class RunResult:
    """Result of a model run containing the last AI message and state information."""

    result_message: Optional[str]
    state: Dict[str, Any]
    analysis_tokens: int
    instruction_tokens: int
    actions: List[ActionInfo]
    last_affected_files: List[str]
    clarification: Optional[ClarificationRequest] = None


class AgentRunner:
    def __init__(self, working_directory: str, debug: bool = False, session_id: str = ""):
        """Initialize the AgentRunner with a working directory and debug flag.

        Args:
            working_directory (str): The initial working directory
            debug (bool): Whether to print debug information
            session_id (str): The session ID for progress tracking
        """
        self.working_directory = working_directory
        self.debug = debug
        self.session_id = session_id
        self.affected_files = []
        self.last_affected_files = []
        self.file_metadata = {}
        self.analysis_tokens = 0
        self.instruction_tokens = 0
        self.actions = []
        self.thread_id = str(uuid.uuid4())
        self.agent = graph
        self.current_status = ""
        self.is_processing = False

        self.memory_config = {
            "configurable": {
                "thread_id": self.thread_id,
            },
            "recursion_limit": config.RECURSION_LIMIT,
        }

    def _print_debug(self, message: str, color: str = "\033[94m"):
        """Print debug message if debug is enabled.

        Args:
            message (str): The message to print
            color (str): The color code to use
        """
        if self.debug:
            print(color + message + "\033[0m")

    def run(self, user_input: str) -> RunResult:
        """Run the model with the given user input.

        Args:
            user_input (str): The user's input to process

        Returns:
            RunResult: A structured result containing the last AI message, state, and token counts
        """
        self.is_processing = True
        self.current_status = "Thinking..."

        # Set session context for progress tracking in tool worker threads
        if self.session_id:
            from progress import set_session_context
            set_session_context(self.session_id)

        events = self.agent.stream(
            {
                "messages": [("user", user_input)],
                "working_directory": self.working_directory,
                "affected_files": self.affected_files,
                "file_metadata": self.file_metadata,
                "analysis_tokens": self.analysis_tokens,
                "actions": ClearList(),
                "last_affected_files": ClearList(),
            },
            self.memory_config,
            stream_mode="values",
        )

        last_event = None
        event_counter = 1
        instruction_tokens = 0

        for event in events:
            event_str = f"\nEvent {event_counter}:"

            # Handle different types of events
            if isinstance(event, dict):
                # Extract status from latest message for live polling
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]
                    msg_type = last_msg.__class__.__name__ if hasattr(last_msg, "__class__") else type(last_msg).__name__
                    if msg_type == "AIMessage" and hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                        # Start progress tracking for multi-file batch operations
                        num_tool_calls = len(last_msg.tool_calls)
                        if num_tool_calls > 1 and self.session_id:
                            from progress import start_progress
                            first_call = last_msg.tool_calls[0]
                            first_args = first_call.get("args", {})
                            label = first_args.get("file_path", first_call.get("name", ""))
                            start_progress(self.session_id, num_tool_calls, label.split("/")[-1] if label else "")

                        tool_call = last_msg.tool_calls[-1]
                        tool_name = tool_call.get("name", "")
                        tool_args = tool_call.get("args", {})
                        # Build a human-readable status
                        if tool_name in ("analyze_document", "analyze_text"):
                            target = tool_args.get("file_path", tool_args.get("file_name", ""))
                            target_name = target.split("/")[-1] if target else ""
                            self.current_status = f"Analyzing {target_name}" if target_name else "Analyzing document..."
                        elif tool_name == "list_items":
                            self.current_status = "Scanning directory..."
                        elif tool_name in ("move_item", "copy_item"):
                            item = tool_args.get("item_name", "")
                            self.current_status = f"Moving {item.split('/')[-1]}" if item else "Moving files..."
                        elif tool_name == "rename_item":
                            item = tool_args.get("item_name", "")
                            self.current_status = f"Renaming {item.split('/')[-1]}" if item else "Renaming..."
                        elif tool_name == "create_item":
                            item = tool_args.get("item_name", "")
                            self.current_status = f"Creating {item.split('/')[-1]}" if item else "Creating item..."
                        elif tool_name == "delete_item":
                            item = tool_args.get("item_name", "")
                            self.current_status = f"Deleting {item.split('/')[-1]}" if item else "Deleting..."
                        elif tool_name == "change_directory":
                            self.current_status = "Navigating directories..."
                        else:
                            self.current_status = f"Running {tool_name}..."
                    elif msg_type == "ToolMessage":
                        self.current_status = "Processing results..."
                    elif msg_type == "AIMessage" and (not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls):
                        self.current_status = "Composing response..."

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
                            if msg_type == "AIMessage":
                                # Try usage_metadata first (Converse API), fall back to additional_kwargs
                                if hasattr(msg, "usage_metadata") and msg.usage_metadata:
                                    instruction_tokens += msg.usage_metadata.get("total_tokens", 0)
                                else:
                                    instruction_tokens += msg.additional_kwargs.get(
                                        "usage", {}
                                    ).get("total_tokens", 0)
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
                    elif key == "actions":
                        self.actions = value
                    else:
                        event_str += f"\n  {key}: {value}"
            else:
                event_str += f"\n  {event}"

            self._print_debug(event_str)
            event_counter += 1
            last_event = event

        self.is_processing = False
        self.current_status = ""

        # Clear progress tracking
        if self.session_id:
            from progress import clear_progress
            clear_progress(self.session_id)

        if last_event:
            # Update working directory if it changed during execution
            if (
                "working_directory" in last_event
                and last_event["working_directory"] != self.working_directory
            ):
                self.working_directory = last_event["working_directory"]

            self.affected_files = last_event["affected_files"]
            self.last_affected_files = last_event.get("last_affected_files", [])
            self.file_metadata = last_event.get("file_metadata", self.file_metadata)
            self.analysis_tokens = last_event["analysis_tokens"]
            self.instruction_tokens = instruction_tokens

            # Display folder content
            self._print_debug(
                get_directory_tree(self.working_directory, self.affected_files),
                "\033[93m",
            )

            self._print_debug(f"Instruction tokens used: {self.instruction_tokens}")
            self._print_debug(f"Analysis tokens used: {self.analysis_tokens}")

            # Get the last AI message (or the most recent one if graph ended on a ToolMessage)
            result_message = None
            if "messages" in last_event and last_event["messages"]:
                for msg in reversed(last_event["messages"]):
                    if isinstance(msg, AIMessage):
                        content = msg.content
                        # AIMessage content may be a list of blocks (text + tool_use)
                        if isinstance(content, list):
                            text_parts = [
                                block.get("text", "") if isinstance(block, dict) else str(block)
                                for block in content
                                if not (isinstance(block, dict) and block.get("type") == "tool_use")
                            ]
                            content = " ".join(t for t in text_parts if t).strip()
                        result_message = content if content else None
                        break
                if result_message:
                    self._print_debug(result_message, "\033[92m")

            # Create state dictionary without messages
            state = {
                "working_directory": self.working_directory,
                "affected_files": self.affected_files,
                "last_affected_files": self.last_affected_files,
                "file_metadata": self.file_metadata,
                "analysis_tokens": self.analysis_tokens,
                "instruction_tokens": self.instruction_tokens,
                "actions": self.actions,
            }

            # Include categories if present in the last event
            if "categories" in last_event:
                state["categories"] = last_event["categories"]

            # Check if the agent asked a clarification question
            clarification = self._extract_clarification(last_event.get("messages", []))

            # If clarification was requested but no text message, use the question as the message
            if clarification and not result_message:
                result_message = clarification.question

            return RunResult(
                result_message=result_message,
                state=state,
                analysis_tokens=self.analysis_tokens,
                instruction_tokens=self.instruction_tokens,
                actions=self.actions,
                last_affected_files=self.last_affected_files,
                clarification=clarification,
            )

        return RunResult(
            result_message=None,
            state={},
            analysis_tokens=0,
            instruction_tokens=0,
            actions=[],
            last_affected_files=[],
        )

    def _extract_clarification(self, messages: list) -> Optional[ClarificationRequest]:
        """Check if the graph ended on an ask_user tool call and extract clarification data."""
        if not messages:
            return None
        # The graph stops immediately after ask_user (via route_after_tools),
        # so it will be the last message only when clarification was just requested.
        last_msg = messages[-1]
        if hasattr(last_msg, "name") and last_msg.name == "ask_user" and last_msg.content:
            try:
                data = json.loads(last_msg.content) if isinstance(last_msg.content, str) else last_msg.content
                if data.get("type") == "clarification":
                    return ClarificationRequest(
                        question=data["question"],
                        options=data.get("options", []),
                        allow_multiple=data.get("allow_multiple", False),
                    )
            except (json.JSONDecodeError, KeyError):
                pass
        return None
