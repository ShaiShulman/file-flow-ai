"""Revert operations for file system actions.

Validation logic lives in revert_validators.py. This module orchestrates
the check and execution of reverts, with try/except around all filesystem ops.
"""

import os
import shutil
from typing import Dict

from revert_validators import validate_revert


def check_revert_action(action: dict) -> Dict[str, any]:
    """Check if an action can be reverted without performing it.

    Returns:
        dict with "can_revert" (bool), "message" (str), "description" (str),
        and optionally "warnings" (list[str]).
    """
    return validate_revert(action)


def revert_action(action: dict) -> Dict[str, any]:
    """Revert a single file system action.

    Returns:
        dict with "success" (bool) and "message" (str).
    """
    check = check_revert_action(action)
    if not check["can_revert"]:
        return {"success": False, "message": check["message"]}

    action_type = action.get("action_type", "")

    try:
        if action_type in ("move_file", "move_folder"):
            return _revert_move(action)
        elif action_type in ("copy_file", "copy_folder"):
            return _revert_copy(action)
        elif action_type in ("rename_file", "rename_folder"):
            return _revert_rename(action)
        elif action_type in ("create_file", "create_folder"):
            return _revert_create(action)
    except (OSError, PermissionError, FileNotFoundError, shutil.Error) as e:
        return {"success": False, "message": f"Failed to revert: {e}"}

    return {"success": False, "message": f"Unknown action type: {action_type}"}


def _revert_move(action: dict) -> Dict[str, any]:
    """Move item back to its original location."""
    source = action["source_path"]
    target = action["target_path"]
    basename = os.path.basename(target)
    shutil.move(target, source)
    return {"success": True, "message": f"Reverted: moved '{basename}' back to {source}"}


def _revert_copy(action: dict) -> Dict[str, any]:
    """Delete the copied item."""
    target = action["target_path"]
    if os.path.isfile(target):
        os.remove(target)
    else:
        shutil.rmtree(target)
    return {"success": True, "message": f"Reverted: deleted copy at {target}"}


def _revert_rename(action: dict) -> Dict[str, any]:
    """Rename item back to its original name."""
    source = action["source_path"]
    parent_dir = os.path.dirname(source)
    current_path = os.path.join(parent_dir, action["new_name"])
    item_name = action.get("item_name", "")
    os.rename(current_path, source)
    return {"success": True, "message": f"Reverted: renamed back to '{item_name}'"}


def _revert_create(action: dict) -> Dict[str, any]:
    """Delete the created item."""
    target = action.get("target_path", "")
    item_name = action.get("item_name", "")
    full_path = os.path.join(target, item_name) if target else item_name
    if os.path.isfile(full_path):
        os.remove(full_path)
    else:
        shutil.rmtree(full_path)
    return {"success": True, "message": f"Reverted: deleted '{item_name}'"}
