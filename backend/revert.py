import os
import shutil
from typing import Dict


def revert_action(action: dict) -> Dict[str, any]:
    """Revert a single file system action.

    Returns:
        dict with "success" (bool) and "message" (str)
    """
    action_type = action.get("action_type", "")

    if action_type in ("move_file", "move_folder"):
        target = action.get("target_path")
        source = action.get("source_path")
        if not target or not source:
            return {"success": False, "message": "Missing source or target path"}
        if not os.path.exists(target):
            return {"success": False, "message": f"Target no longer exists: {target}"}
        parent = os.path.dirname(source)
        if parent and not os.path.exists(parent):
            return {"success": False, "message": f"Original parent directory no longer exists: {parent}"}
        shutil.move(target, source)
        return {"success": True, "message": f"Reverted: moved back to {source}"}

    elif action_type in ("copy_file", "copy_folder"):
        target = action.get("target_path")
        if not target:
            return {"success": False, "message": "Missing target path"}
        if not os.path.exists(target):
            return {"success": False, "message": f"Copied item no longer exists: {target}"}
        if os.path.isfile(target):
            os.remove(target)
        else:
            shutil.rmtree(target)
        return {"success": True, "message": f"Reverted: deleted copy at {target}"}

    elif action_type in ("rename_file", "rename_folder"):
        source = action.get("source_path")
        new_name = action.get("new_name")
        if not source or not new_name:
            return {"success": False, "message": "Missing source path or new name"}
        parent_dir = os.path.dirname(source)
        current_path = os.path.join(parent_dir, new_name)
        if not os.path.exists(current_path):
            return {"success": False, "message": f"Current path not found: {current_path}"}
        os.rename(current_path, source)
        return {"success": True, "message": f"Reverted: renamed back to {action.get('item_name', '')}"}

    elif action_type in ("create_file", "create_folder"):
        target = action.get("target_path", "")
        item_name = action.get("item_name", "")
        full_path = os.path.join(target, item_name) if target else item_name
        if not os.path.exists(full_path):
            return {"success": False, "message": f"Created item no longer exists: {full_path}"}
        if os.path.isfile(full_path):
            os.remove(full_path)
        else:
            shutil.rmtree(full_path)
        return {"success": True, "message": f"Reverted: deleted {item_name}"}

    elif action_type in ("delete_file", "delete_folder"):
        return {"success": False, "message": "Cannot revert delete operations - file content is lost"}

    elif action_type == "modify_file":
        return {"success": False, "message": "Cannot revert file modifications - original content is lost"}

    return {"success": False, "message": f"Unknown action type: {action_type}"}
