import uuid
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from langchain_core.messages.ai import AIMessage
from tools import get_directory_tree
import config
from graph import graph
from action_types import ActionInfo


@dataclass
class RunResult:
    """Result of a model run containing the last AI message and state information."""

    result_message: Optional[str]
    state: Dict[str, Any]
    analysis_tokens: int
    instruction_tokens: int
    actions: List[ActionInfo]


class AgentRunner:
    def __init__(self, working_directory: str, debug: bool = False):
        """Initialize the AgentRunner with a working directory and debug flag.

        Args:
            working_directory (str): The initial working directory
            debug (bool): Whether to print debug information
        """
        self.working_directory = working_directory
        self.debug = debug
        self.affected_files = []
        self.file_metadata = {}
        self.analysis_tokens = 0
        self.actions = []
        self.thread_id = str(uuid.uuid4())
        self.agent = graph

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
        # Clear actions at the start of each run
        self.actions = []

        events = self.agent.stream(
            {
                "messages": [("user", user_input)],
                "working_directory": self.working_directory,
                "affected_files": self.affected_files,
                "file_metadata": self.file_metadata,
                "analysis_tokens": self.analysis_tokens,
            },
            self.memory_config,
            stream_mode="values",
        )

        last_event = None
        event_counter = 1
        self.actions = []

        for event in events:
            event_str = f"\nEvent {event_counter}:"

            # Handle different types of events
            if isinstance(event, dict):
                for key, value in event.items():
                    if key == "messages":
                        event_str += "\n  Messages:"
                        instruction_tokens = 0
                        for msg_idx, msg in enumerate(value, 1):
                            msg_type = (
                                msg.__class__.__name__
                                if hasattr(msg, "__class__")
                                else type(msg).__name__
                            )
                            msg_str = f"\n    - [{msg_idx}] [{msg_type}] {msg}"
                            if msg_type == "AIMessage":
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
                        # Add new actions to the list
                        self.actions = value
                    else:
                        event_str += f"\n  {key}: {value}"
            else:
                event_str += f"\n  {event}"

            self._print_debug(event_str)
            event_counter += 1
            last_event = event

        if last_event:
            # Update working directory if it changed during execution
            if (
                "working_directory" in last_event
                and last_event["working_directory"] != self.working_directory
            ):
                self.working_directory = last_event["working_directory"]

            self.affected_files = last_event["affected_files"]
            self.analysis_tokens = last_event["analysis_tokens"]

            # Display folder content
            self._print_debug(
                get_directory_tree(self.working_directory, self.affected_files),
                "\033[93m",
            )

            self._print_debug(f"Instruction tokens used: {instruction_tokens}")
            self._print_debug(f"Analysis tokens used: {self.analysis_tokens}")

            # Get the last AI message
            result_message = None
            if (
                "messages" in last_event
                and last_event["messages"]
                and isinstance(last_event["messages"][-1], AIMessage)
            ):
                result_message = last_event["messages"][-1].content
                self._print_debug(result_message, "\033[92m")

            # Create state dictionary without messages
            state = {
                "working_directory": self.working_directory,
                "affected_files": self.affected_files,
                "file_metadata": self.file_metadata,
                "analysis_tokens": self.analysis_tokens,
                "actions": self.actions,
            }

            return RunResult(
                result_message=result_message,
                state=state,
                analysis_tokens=self.analysis_tokens,
                instruction_tokens=instruction_tokens,
                actions=self.actions,
            )

        return RunResult(
            result_message=None,
            state={},
            analysis_tokens=0,
            instruction_tokens=0,
            actions=[],
        )
