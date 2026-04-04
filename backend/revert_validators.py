"""Validation logic for revert operations.

Each action type has a dedicated validator that checks filesystem state
and returns whether the action can be safely reverted, with specific
error messages when it cannot.
"""

import os
from typing import Dict, List, Any


def _item_type_label(action_type: str) -> str:
    """Return 'file' or 'folder' based on the action type string."""
    if "_folder" in action_type:
        return "folder"
    return "file"


def _result(can_revert: bool, message: str, description: str = "", warnings: List[str] = None) -> Dict[str, Any]:
    return {
        "can_revert": can_revert,
        "message": message,
        "description": description,
        "warnings": warnings or [],
    }


def validate_move(action: dict) -> Dict[str, Any]:
    """Validate revert for move_file / move_folder actions."""
    target = action.get("target_path")
    source = action.get("source_path")
    item_name = action.get("item_name", "")
    label = _item_type_label(action.get("action_type", ""))

    if not target or not source:
        return _result(False, "Missing source or target path")

    if not os.path.exists(target):
        return _result(False, f"Moved {label} no longer exists at '{target}'")

    parent = os.path.dirname(source)
    if parent and not os.path.exists(parent):
        return _result(False, f"Original parent directory no longer exists: '{parent}'")

    if os.path.exists(source):
        basename = os.path.basename(source)
        return _result(
            False,
            f"Cannot revert: a {label} named '{basename}' already exists at the original location '{source}'",
        )

    description = f"Move '{os.path.basename(target)}' back to {os.path.dirname(source)}"
    return _result(True, "Ready to revert", description)


def validate_copy(action: dict) -> Dict[str, Any]:
    """Validate revert for copy_file / copy_folder actions."""
    target = action.get("target_path")

    if not target:
        return _result(False, "Missing target path")

    if not os.path.exists(target):
        return _result(False, f"Copied item no longer exists at '{target}'")

    warnings = []
    if os.path.isdir(target):
        try:
            contents = os.listdir(target)
            n = len(contents)
            if n > 0:
                warnings.append(
                    f"The copied folder contains {n} item{'s' if n != 1 else ''} that will be permanently deleted"
                )
        except OSError:
            pass

    description = f"Delete copy of '{os.path.basename(target)}' at {target}"
    return _result(True, "Ready to revert", description, warnings)


def validate_rename(action: dict) -> Dict[str, Any]:
    """Validate revert for rename_file / rename_folder actions."""
    source = action.get("source_path")
    new_name = action.get("new_name")
    item_name = action.get("item_name", "")
    label = _item_type_label(action.get("action_type", ""))

    if not source or not new_name:
        return _result(False, "Missing source path or new name")

    parent_dir = os.path.dirname(source)
    if not os.path.exists(parent_dir):
        return _result(False, f"Parent directory no longer exists: '{parent_dir}'")

    current_path = os.path.join(parent_dir, new_name)
    if not os.path.exists(current_path):
        return _result(
            False,
            f"'{new_name}' no longer exists at '{current_path}'. It may have been renamed or moved again",
        )

    if os.path.exists(source):
        return _result(
            False,
            f"Cannot revert: a {label} named '{item_name}' already exists at the original path '{source}'",
        )

    description = f"Rename '{new_name}' back to '{item_name}'"
    return _result(True, "Ready to revert", description)


def validate_create(action: dict) -> Dict[str, Any]:
    """Validate revert for create_file / create_folder actions."""
    target = action.get("target_path", "")
    item_name = action.get("item_name", "")
    full_path = os.path.join(target, item_name) if target else item_name

    if not os.path.exists(full_path):
        return _result(False, f"Created item no longer exists: '{full_path}'")

    warnings = []
    if os.path.isdir(full_path):
        try:
            contents = os.listdir(full_path)
            n = len(contents)
            if n > 0:
                warnings.append(
                    f"The folder '{item_name}' now contains {n} item{'s' if n != 1 else ''}. "
                    f"Reverting will permanently delete all contents"
                )
        except OSError:
            pass

    description = f"Delete created item '{item_name}'"
    return _result(True, "Ready to revert", description, warnings)


def validate_delete(action: dict) -> Dict[str, Any]:
    """Delete actions are never revertable — content is not backed up."""
    return _result(
        False,
        "Cannot revert delete: file content was not backed up and cannot be restored",
    )


def validate_modify(action: dict) -> Dict[str, Any]:
    """Modify actions are never revertable — original content is not backed up."""
    return _result(
        False,
        "Cannot revert modification: original file content was not backed up and cannot be restored",
    )


_VALIDATORS = {
    "move_file": validate_move,
    "move_folder": validate_move,
    "copy_file": validate_copy,
    "copy_folder": validate_copy,
    "rename_file": validate_rename,
    "rename_folder": validate_rename,
    "create_file": validate_create,
    "create_folder": validate_create,
    "delete_file": validate_delete,
    "delete_folder": validate_delete,
    "modify_file": validate_modify,
}


def validate_revert(action: dict) -> Dict[str, Any]:
    """Dispatch to the appropriate validator based on action_type."""
    action_type = action.get("action_type", "")
    validator = _VALIDATORS.get(action_type)
    if validator is None:
        return _result(False, f"Unknown action type: {action_type}")
    return validator(action)
