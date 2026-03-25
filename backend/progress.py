"""Centralized progress tracking for batch and parallel tool operations.

Progress is keyed by session_id. Two types of progress are tracked:
1. Parallel tool calls (e.g., 24 analyze_document calls) — total set by
   agent_runner when it sees the AIMessage, incremented by each tool on
   completion via increment_progress().
2. Sequential batch operations (e.g., move_item with 20 files) — total set
   by agent_runner, updated within the batch loop via update_progress().

Thread-safe: uses threading.Lock for increment_progress (called from
ToolNode's thread pool workers). Simple dict reads (get_progress) are
safe under CPython's GIL for the status polling endpoint.

Session ID is propagated to tool threads via a contextvars.ContextVar,
which LangGraph's runnables infrastructure copies into worker thread contexts.
"""

import threading
import contextvars
from typing import Any, Dict, Optional

_progress: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()

# ContextVar propagated by LangGraph to tool worker threads
_current_session_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "_current_session_id", default=None
)


def set_session_context(session_id: str):
    """Set the session_id in the current context (called by agent_runner before graph execution)."""
    _current_session_id.set(session_id)


def get_session_context() -> Optional[str]:
    """Get the session_id from the current context (available in tool worker threads)."""
    return _current_session_id.get()


def start_progress(session_id: str, total: int, label: str = ""):
    """Start tracking progress for a session."""
    _progress[session_id] = {
        "current": 1,
        "total": total,
        "current_file": label,
    }


def update_progress(session_id: str, current: int, current_file: str = ""):
    """Update progress for a session (for sequential batch ops)."""
    if session_id in _progress:
        _progress[session_id] = {
            "current": current,
            "total": _progress[session_id]["total"],
            "current_file": current_file,
        }


def increment_progress(current_file: str = ""):
    """Atomically increment progress by 1 using session_id from context.

    Called by individual tool functions when they complete.
    Session ID is obtained from the contextvars propagated by LangGraph.
    """
    session_id = _current_session_id.get()
    if not session_id:
        return
    with _lock:
        if session_id in _progress:
            _progress[session_id] = {
                "current": _progress[session_id]["current"] + 1,
                "total": _progress[session_id]["total"],
                "current_file": current_file,
            }


def clear_progress(session_id: str):
    """Clear progress tracking for a session."""
    _progress.pop(session_id, None)


def get_progress(session_id: str) -> Optional[Dict[str, Any]]:
    """Get current progress for a session, if any."""
    return _progress.get(session_id)
