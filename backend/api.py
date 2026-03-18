from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import uuid
import os
from typing import Dict, Any, List, Optional

from api_server import AgentAPI, UserInput, AgentResponse
from categories import categories_manager
from path_utils import get_session_working_directory
from database import db

# Initialize FastAPI app
app = FastAPI(
    title="Agent API",
    description="API for interacting with the File Flow AI agent",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the agent API with the current working directory
agent_api = AgentAPI(default_working_directory=os.getcwd(), debug=True)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Agent API is running"}


@app.get("/stats/tokens/{session_id}")
async def get_tokens(session_id: str):
    """Get token usage statistics for a specific session.

    Args:
        session_id (str): The session identifier

    Returns:
        Dict[str, int]: Dictionary containing total analysis and instruction tokens
    """
    if session_id not in agent_api.sessions:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    agent = agent_api.sessions[session_id]
    return {
        "analysis_tokens": agent.analysis_tokens,
        "instruction_tokens": agent.instruction_tokens,
        "total_tokens": agent.analysis_tokens + agent.instruction_tokens,
    }


@app.post("/sessions", response_model=Dict[str, str])
async def create_session(
    working_directory: Optional[str] = None, session_id: Optional[str] = None
):
    """Create a new agent session.

    Args:
        working_directory (str, optional): Custom working directory for the agent (ignored - session-specific directory is used)
        session_id (str, optional): Specific session ID to use instead of generating a new one

    Returns:
        Dict[str, str]: Dictionary containing the session ID
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
    elif session_id in agent_api.sessions:
        # Session already exists, return it (idempotent)
        return {"session_id": session_id}

    # Use the session-specific working directory
    session_working_directory = get_session_working_directory(session_id)
    agent_api.get_or_create_agent(session_id, session_working_directory)

    return {"session_id": session_id}


@app.post("/sessions/{session_id}", response_model=Dict[str, str])
async def create_session_with_id(
    session_id: str, working_directory: Optional[str] = None
):
    """Create a new agent session with a specific ID.

    Args:
        session_id (str): The specific session ID to create
        working_directory (str, optional): Custom working directory for the agent (ignored - session-specific directory is used)

    Returns:
        Dict[str, str]: Dictionary containing the session ID
    """
    # If session already exists, return it (idempotent create)
    if session_id in agent_api.sessions:
        return {"session_id": session_id}

    # Use the session-specific working directory
    session_working_directory = get_session_working_directory(session_id)
    agent_api.get_or_create_agent(session_id, session_working_directory)

    return {"session_id": session_id}


@app.post("/sessions/{session_id}/run", response_model=AgentResponse)
async def run_agent(session_id: str, user_input: UserInput):
    """Run the agent with the given user input.

    Args:
        session_id (str): The session identifier
        user_input (UserInput): The user's input to process

    Returns:
        AgentResponse: The structured response from the agent
    """
    try:
        # Get the working directory based on the session ID
        working_directory = get_session_working_directory(session_id)

        # Run in thread so status polling endpoint remains responsive
        result = await asyncio.to_thread(
            agent_api.run_agent, session_id, user_input.message, working_directory
        )

        # Update the agent's token counts in the response
        agent = agent_api.sessions[session_id]
        result.analysis_tokens = agent.analysis_tokens
        result.instruction_tokens = agent.instruction_tokens

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/sessions/{session_id}", response_model=Dict[str, bool])
async def delete_session(session_id: str):
    """Delete an agent session.

    Args:
        session_id (str): The session identifier

    Returns:
        Dict[str, bool]: Dictionary indicating success
    """
    success = agent_api.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {"success": True}


@app.get("/sessions", response_model=List[str])
async def list_sessions():
    """List all active session IDs.

    Returns:
        List[str]: List of active session IDs
    """
    return list(agent_api.sessions.keys())


@app.get("/categories", response_model=Dict[str, List[str]])
async def get_categories():
    """Get all categories and their values.

    Returns:
        Dict[str, List[str]]: A dictionary of category names and their values
    """
    return categories_manager.get_categories()


@app.get("/categories/{name}", response_model=Dict[str, Any])
async def get_category(name: str):
    """Get a specific category by name.

    Args:
        name (str): The name of the category

    Returns:
        Dict[str, Any]: A dictionary containing the category status and values
    """
    values = categories_manager.get_category(name)
    if values is None:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")
    return {"status": "success", "values": values}


@app.post("/categories/{name}", response_model=Dict[str, str])
async def add_or_update_category(name: str, values: List[str]):
    """Add a new category or update an existing one.

    Args:
        name (str): The name of the category
        values (List[str]): The values for the category

    Returns:
        Dict[str, str]: A dictionary containing the operation status and message
    """
    if categories_manager.get_category(name) is not None:
        return categories_manager.update_category(name, values)
    else:
        return categories_manager.add_category(name, values)


@app.delete("/categories/{name}", response_model=Dict[str, str])
async def delete_category(name: str):
    """Delete a category.

    Args:
        name (str): The name of the category to delete

    Returns:
        Dict[str, str]: A dictionary containing the operation status and message
    """
    result = categories_manager.remove_category(name)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@app.delete("/categories", response_model=Dict[str, str])
async def clear_all_categories():
    """Clear all categories.

    Returns:
        Dict[str, str]: A dictionary containing the operation status and message
    """
    return categories_manager.clear_categories()


@app.put("/categories/reset", response_model=Dict[str, str])
async def reset_categories(categories: Dict[str, List[str]]):
    """Reset all categories with a new set of categories.

    Args:
        categories (Dict[str, List[str]]): Dictionary of category names and their values

    Returns:
        Dict[str, str]: A dictionary containing the operation status and message
    """
    try:
        # First clear all existing categories
        categories_manager.clear_categories()

        # Then add all new categories
        for name, values in categories.items():
            categories_manager.add_category(name, values)

        return {
            "status": "success",
            "message": f"Categories reset successfully with {len(categories)} categories",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to reset categories: {str(e)}"
        )


# ── Agent Status endpoint ──


@app.get("/sessions/{session_id}/status")
async def get_session_status(session_id: str):
    """Get current agent processing status for live polling."""
    if session_id not in agent_api.sessions:
        return {"status": "idle", "current_action": ""}

    agent = agent_api.sessions[session_id]
    if agent.is_processing:
        return {"status": "processing", "current_action": agent.current_status}
    return {"status": "idle", "current_action": ""}


# ── Action History endpoints ──


@app.get("/sessions/{session_id}/actions")
async def get_actions(session_id: str):
    """Get action history for a session."""
    actions = db.get_actions(session_id)
    return {"actions": actions}


@app.post("/sessions/{session_id}/actions/{action_id}/revert")
async def revert_action_endpoint(session_id: str, action_id: int):
    """Revert a specific action."""
    from revert import revert_action

    action = db.get_action(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action["session_id"] != session_id:
        raise HTTPException(status_code=400, detail="Action does not belong to this session")
    if action["reverted"]:
        raise HTTPException(status_code=400, detail="Action already reverted")
    if not action["revertable"]:
        raise HTTPException(status_code=400, detail="Action cannot be reverted")

    result = revert_action(action)
    if result["success"]:
        db.mark_action_reverted(action_id)
    return result


# ── File Metadata endpoints ──


class MetadataFieldInput(BaseModel):
    name: str
    type: str = "text"


@app.get("/sessions/{session_id}/metadata/{file_path:path}")
async def get_file_metadata(session_id: str, file_path: str):
    """Get metadata for a specific file."""
    metadata = db.get_file_metadata(session_id, file_path)
    return {"file_path": file_path, "metadata": metadata or {}}


@app.put("/sessions/{session_id}/metadata/{file_path:path}")
async def update_file_metadata(session_id: str, file_path: str, metadata: Dict[str, Any]):
    """Update metadata for a specific file."""
    db.save_file_metadata(session_id, file_path, metadata)
    return {"status": "success", "file_path": file_path}


@app.get("/sessions/{session_id}/metadata-fields")
async def get_metadata_fields(session_id: str):
    """Get metadata field definitions for a session."""
    fields = db.get_metadata_fields(session_id)
    return {"fields": fields}


@app.post("/sessions/{session_id}/metadata-fields")
async def add_metadata_field(session_id: str, field: MetadataFieldInput):
    """Add a new metadata field definition."""
    db.add_metadata_field(session_id, field.name, field.type)
    return {"status": "success"}


@app.delete("/sessions/{session_id}/metadata-fields/{field_name}")
async def delete_metadata_field(session_id: str, field_name: str):
    """Delete a metadata field definition."""
    db.delete_metadata_field(session_id, field_name)
    return {"status": "success"}


# ── Analytics endpoints ──


@app.get("/sessions/{session_id}/stats")
async def get_session_stats(session_id: str):
    """Get aggregated session statistics."""
    return db.get_session_stats(session_id)


# ── Session detail endpoint ──


@app.get("/sessions/{session_id}/detail")
async def get_session_detail(session_id: str):
    """Get session details from database."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return session


# ── Messages endpoint ──


@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Get message history for a session."""
    messages = db.get_messages(session_id)
    return {"messages": messages}


# ── Script Export endpoints ──


class ExportScriptRequest(BaseModel):
    base_path: str
    format: str = "powershell"


@app.post("/sessions/{session_id}/export-script")
async def export_script(session_id: str, request: ExportScriptRequest):
    """Generate a batch or PowerShell script from action history."""
    from script_export import ScriptExporter

    actions = db.get_actions(session_id)
    session = db.get_session(session_id)
    working_dir = session["working_directory"] if session else ""

    exporter = ScriptExporter(actions, request.base_path, working_dir)
    if request.format == "batch":
        script = exporter.generate_batch()
        filename = "organize.bat"
    else:
        script = exporter.generate_powershell()
        filename = "organize.ps1"
    return {"script": script, "filename": filename}


@app.get("/sessions/{session_id}/manifest")
async def get_manifest(session_id: str):
    """Generate a JSON manifest of all actions and metadata."""
    from script_export import ScriptExporter

    actions = db.get_actions(session_id)
    metadata = db.get_all_file_metadata(session_id)
    categories = db.get_categories()
    session = db.get_session(session_id)
    working_dir = session["working_directory"] if session else ""

    exporter = ScriptExporter(actions, "", working_dir)
    return exporter.generate_manifest(metadata, categories)


# ── Settings endpoints ──


class ExactMatchSetting(BaseModel):
    enabled: bool


@app.get("/settings/exact-match")
async def get_exact_match():
    """Get current exact match mode setting."""
    import config
    return {"enabled": config.ENABLE_EXACT_MATCH}


@app.put("/settings/exact-match")
async def set_exact_match(setting: ExactMatchSetting):
    """Toggle exact match mode at runtime."""
    import config
    config.ENABLE_EXACT_MATCH = setting.enabled
    return {"enabled": config.ENABLE_EXACT_MATCH}
