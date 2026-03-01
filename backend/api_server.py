from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn
import os

from agent_runner import AgentRunner, RunResult
from action_types import ActionInfo
from database import db


class UserInput(BaseModel):
    """Model for user input to the agent."""

    message: str
    working_directory: Optional[str] = None


class MessageStats(BaseModel):
    """Token and cost stats for a single agent response."""

    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    duration_ms: int = 0


class AgentResponse(BaseModel):
    """Model for agent responses."""

    message: Optional[str]
    working_directory: str
    affected_files: List[str]
    analysis_tokens: int
    instruction_tokens: int
    actions: List[Dict[str, Any]]
    file_metadata: Dict[str, Any]
    categories: Dict[str, Any]
    message_stats: Optional[MessageStats] = None


class AgentAPI:
    """API wrapper for the AgentRunner."""

    def __init__(
        self, default_working_directory: str = os.getcwd(), debug: bool = False
    ):
        """Initialize the AgentAPI with a default working directory.

        Args:
            default_working_directory (str): The default working directory for new sessions
            debug (bool): Whether to print debug information
        """
        self.default_working_directory = default_working_directory
        self.debug = debug
        self.sessions = {}  # Dictionary to store agent instances by session_id

    def get_or_create_agent(
        self, session_id: str, working_directory: Optional[str] = None
    ) -> AgentRunner:
        """Get an existing agent for a session or create a new one.

        Args:
            session_id (str): The session identifier
            working_directory (str, optional): Custom working directory for new agents

        Returns:
            AgentRunner: The agent instance for this session
        """
        if session_id not in self.sessions:
            # Create a new agent with either the provided or default working directory
            wd = (
                working_directory
                if working_directory
                else self.default_working_directory
            )
            self.sessions[session_id] = AgentRunner(
                working_directory=wd, debug=self.debug
            )
            # Persist session to database
            db.create_session(session_id, wd)
        elif working_directory:
            # Always update working directory if provided (to ensure session-specific directory is used)
            self.sessions[session_id].working_directory = working_directory

        return self.sessions[session_id]

    def run_agent(
        self, session_id: str, user_input: str, working_directory: Optional[str] = None
    ) -> AgentResponse:
        """Run the agent with the given user input.

        Args:
            session_id (str): The session identifier
            user_input (str): The user's input to process
            working_directory (str, optional): Custom working directory for this run

        Returns:
            AgentResponse: The structured response from the agent
        """
        agent = self.get_or_create_agent(session_id, working_directory)

        # Store the intended working directory before running
        intended_working_directory = working_directory or agent.working_directory

        # Persist user message
        db.save_message(session_id, "user", user_input)

        result = agent.run(user_input)

        # Ensure the working directory is always set to the session-specific directory
        # This prevents the agent from permanently changing away from the session directory
        if working_directory:
            agent.working_directory = working_directory

        # Collect LLM call stats
        from llm import TimedBedrock
        from config import calculate_cost
        llm_stats = TimedBedrock.drain_stats()

        total_input = sum(s.get("input_tokens", 0) for s in llm_stats)
        total_output = sum(s.get("output_tokens", 0) for s in llm_stats)
        total_duration = sum(s.get("duration_ms", 0) for s in llm_stats)
        total_cost = sum(
            calculate_cost(s.get("model_id", ""), s.get("input_tokens", 0), s.get("output_tokens", 0))
            for s in llm_stats
        )

        message_stats = MessageStats(
            input_tokens=total_input,
            output_tokens=total_output,
            cost_usd=total_cost,
            duration_ms=total_duration,
        )

        # Persist assistant message with stats
        db.save_message(
            session_id, "assistant", result.result_message or "",
            input_tokens=total_input,
            output_tokens=total_output,
            cost_usd=total_cost,
            duration_ms=total_duration,
        )

        # Persist actions
        for action in result.actions:
            action_dict = action.to_dict()
            db.save_action(
                session_id,
                action_dict["action_type"],
                action_dict["item_name"],
                source_path=action_dict.get("source_path"),
                target_path=action_dict.get("target_path"),
                new_name=action_dict.get("new_name"),
                description=action_dict.get("description", ""),
            )

            # When a file is renamed, re-key its metadata in the database
            if action_dict["action_type"] in ("rename_file", "rename_folder") and action_dict.get("new_name"):
                old_meta = db.get_file_metadata(session_id, action_dict["item_name"])
                if old_meta:
                    db.save_file_metadata(session_id, action_dict["new_name"], old_meta)
                    db.delete_file_metadata(session_id, action_dict["item_name"])

        # Persist file metadata updates
        if agent.file_metadata:
            for file_path, metadata in agent.file_metadata.items():
                if isinstance(metadata, dict):
                    db.save_file_metadata(session_id, file_path, metadata)

        return AgentResponse(
            message=result.result_message,
            working_directory=agent.working_directory,
            affected_files=agent.affected_files,
            analysis_tokens=result.analysis_tokens,
            instruction_tokens=result.instruction_tokens,
            actions=[action.to_dict() for action in result.actions],
            file_metadata=agent.file_metadata,
            categories=result.state.get("categories", {}),
            message_stats=message_stats,
        )

    def delete_session(self, session_id: str) -> bool:
        """Delete a session.

        Args:
            session_id (str): The session identifier

        Returns:
            bool: True if session was deleted, False if it didn't exist
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            db.delete_session(session_id)
            return True
        return False
