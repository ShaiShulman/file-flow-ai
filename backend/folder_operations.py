import os
import re
import shutil
import json
from typing import List, Optional, Union, Literal
from markitdown import MarkItDown
from langchain_core.tools import tool
import olefile

from utils import truncate_text
from config import WORKING_DIRECTORY, ALLOW_EXTERNAL_DIRECTORIES
from content_extractor import get_content
from action_types import ActionInfo, ActionType


def _get_full_path(working_directory: str, folder_path: Optional[str] = None) -> str:
    """Convert relative path to full path within working directory.

    Args:
        working_directory (str): Base directory where operations are performed
        folder_path (Optional[str]): Relative path to convert. If None, returns working_directory

    Returns:
        str: Full path

    Raises:
        ValueError: If the resolved path escapes the working directory (when external dirs disabled)
    """
    if not folder_path:
        return working_directory

    full_path = os.path.normpath(os.path.join(working_directory, folder_path))

    # Prevent path traversal outside the working directory
    if not ALLOW_EXTERNAL_DIRECTORIES:
        real_working = os.path.realpath(working_directory)
        real_full = os.path.realpath(full_path)
        if not real_full.startswith(real_working + os.sep) and real_full != real_working:
            raise ValueError(f"Path '{folder_path}' escapes the working directory")

    return full_path


@tool
def create_item(
    working_directory: str,
    name: str,
    item_type: Literal["file", "folder"],
    parent_path: Optional[str] = None,
    content: Optional[str] = None,
) -> dict:
    """Create a new file or folder in the specified directory.

    Args:
        working_directory (str): Base directory where operations are performed
        name (str): Name of the file or folder to create
        item_type (Literal["file", "folder"]): Type of item to create ("file" or "folder")
        parent_path (Optional[str]): Path where the item should be created, relative to working_directory
        content (Optional[str]): Content to write if creating a file

    Returns:
        dict: Dictionary containing success/failure message and affected files
    """
    parent_full_path = _get_full_path(working_directory, parent_path)
    new_path = os.path.join(parent_full_path, name)
    affected_files = []

    if not os.path.exists(parent_full_path):
        os.makedirs(parent_full_path)

    if os.path.exists(new_path):
        return {
            "message": f"{item_type.title()} '{name}' already exists",
            "affected_files": [],
            "action": None,
        }

    if item_type == "folder":
        os.makedirs(new_path)
        affected_files.append(new_path)
        action = ActionInfo(
            action_type=ActionType.CREATE_FOLDER,
            item_name=name,
            target_path=parent_full_path,
        )
        return {
            "message": f"Created folder '{name}' in '{parent_path if parent_path else 'working directory'}'",
            "affected_files": affected_files,
            "action": action.to_dict(),
        }
    else:
        with open(new_path, "w") as f:
            if content:
                f.write(content)
        affected_files.append(new_path)
        action = ActionInfo(
            action_type=ActionType.CREATE_FILE,
            item_name=name,
            target_path=parent_full_path,
        )
        return {
            "message": f"Created file '{name}'{' with content' if content else ''} in '{parent_path if parent_path else 'working directory'}'",
            "affected_files": affected_files,
            "action": action.to_dict(),
        }


def _resolve_dest_path(dest_full_path: str, dest_path: str, source_full_path: str):
    """If dest is an existing directory, append the source filename to move/copy into it."""
    if os.path.exists(dest_full_path) and os.path.isdir(dest_full_path):
        filename = os.path.basename(source_full_path)
        dest_full_path = os.path.join(dest_full_path, filename)
        dest_path = os.path.join(dest_path, filename)
    return dest_full_path, dest_path


def _copy_single_item(working_directory: str, source_path: str, dest_path: str) -> dict:
    """Copy a single file or folder. Internal helper."""
    source_full_path = _get_full_path(working_directory, source_path)
    dest_full_path = _get_full_path(working_directory, dest_path)

    if not os.path.exists(source_full_path):
        return {
            "message": f"Source path '{source_path}' does not exist",
            "affected_files": [],
            "action": None,
        }

    is_file = os.path.isfile(source_full_path)
    dest_full_path, dest_path = _resolve_dest_path(dest_full_path, dest_path, source_full_path)

    if os.path.exists(dest_full_path):
        return {
            "message": f"Destination path '{dest_path}' already exists",
            "affected_files": [],
            "action": None,
        }

    if is_file:
        os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
        shutil.copy2(source_full_path, dest_full_path)
    else:
        shutil.copytree(source_full_path, dest_full_path)

    action = ActionInfo(
        action_type=ActionType.COPY_FILE if is_file else ActionType.COPY_FOLDER,
        item_name=os.path.basename(source_path),
        source_path=source_full_path,
        target_path=dest_full_path,
    )
    return {
        "message": f"Copied {'file' if is_file else 'folder'} from '{source_path}' to '{dest_path}'",
        "affected_files": [source_full_path, dest_full_path],
        "action": action.to_dict(),
    }


def _move_single_item(working_directory: str, source_path: str, dest_path: str) -> dict:
    """Move a single file or folder. Internal helper."""
    source_full_path = _get_full_path(working_directory, source_path)
    dest_full_path = _get_full_path(working_directory, dest_path)

    if not os.path.exists(source_full_path):
        return {
            "message": f"Source path '{source_path}' does not exist",
            "affected_files": [],
            "action": None,
        }

    is_file = os.path.isfile(source_full_path)
    dest_full_path, dest_path = _resolve_dest_path(dest_full_path, dest_path, source_full_path)

    if os.path.exists(dest_full_path):
        return {
            "message": f"Destination path '{dest_path}' already exists",
            "affected_files": [],
            "action": None,
        }

    os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
    shutil.move(source_full_path, dest_full_path)

    action = ActionInfo(
        action_type=ActionType.MOVE_FILE if is_file else ActionType.MOVE_FOLDER,
        item_name=os.path.basename(source_path),
        source_path=source_full_path,
        target_path=dest_full_path,
    )
    return {
        "message": f"Moved {'file' if is_file else 'folder'} from '{source_path}' to '{dest_path}'",
        "affected_files": [source_full_path, dest_full_path],
        "action": action.to_dict(),
    }


def _delete_single_item(working_directory: str, path: str, item_type: Optional[Literal["file", "folder"]] = None) -> dict:
    """Delete a single file or folder. Internal helper."""
    full_path = _get_full_path(working_directory, path)

    if not os.path.exists(full_path):
        return {
            "message": f"Path '{path}' does not exist",
            "affected_files": [],
            "action": None,
        }

    is_file = os.path.isfile(full_path)
    if item_type and (
        (item_type == "file" and not is_file) or (item_type == "folder" and is_file)
    ):
        return {
            "message": f"Path '{path}' is not a {item_type}",
            "affected_files": [],
            "action": None,
        }

    action = ActionInfo(
        action_type=ActionType.DELETE_FILE if is_file else ActionType.DELETE_FOLDER,
        item_name=os.path.basename(path),
        source_path=full_path,
    )

    if is_file:
        os.remove(full_path)
    else:
        shutil.rmtree(full_path)

    return {
        "message": f"Deleted {'file' if is_file else 'folder'} '{path}'",
        "affected_files": [full_path],
        "action": action.to_dict(),
    }


def _find_matching_files(working_directory: str, name_pattern: str, path: Optional[str] = None, recursive: bool = True) -> List[str]:
    """Find files whose names contain the pattern (case-insensitive). Returns relative paths."""
    search_path = _get_full_path(working_directory, path)
    if not os.path.exists(search_path):
        return []
    pattern_lower = name_pattern.lower()
    matches = []
    if recursive:
        for root, dirs, files in os.walk(search_path):
            for f in files:
                if pattern_lower in f.lower():
                    full = os.path.join(root, f)
                    matches.append(os.path.relpath(full, working_directory))
    else:
        with os.scandir(search_path) as entries:
            for entry in entries:
                if entry.is_file() and pattern_lower in entry.name.lower():
                    matches.append(os.path.relpath(entry.path, working_directory))
    return sorted(matches)


def _run_batch_operation(working_directory: str, source_paths: List[str], dest_path: str, operation_fn, create_dest_folder: bool = True) -> dict:
    """Run a move/copy operation on multiple source paths. Returns aggregated result."""
    all_affected = []
    all_actions = []
    messages = []
    errors = []

    # Auto-create dest folder if needed
    if create_dest_folder and dest_path:
        dest_full = _get_full_path(working_directory, dest_path)
        if not os.path.exists(dest_full):
            os.makedirs(dest_full)
            all_affected.append(dest_full)
            all_actions.append(ActionInfo(
                action_type=ActionType.CREATE_FOLDER,
                item_name=os.path.basename(dest_path),
                target_path=os.path.dirname(dest_full) or dest_full,
            ).to_dict())

    for sp in source_paths:
        result = operation_fn(working_directory, sp, dest_path)
        all_affected.extend(result.get("affected_files", []))
        if result.get("action"):
            all_actions.append(result["action"])
            messages.append(result["message"])
        else:
            errors.append(result["message"])

    summary_parts = []
    if messages:
        summary_parts.append(f"Completed {len(messages)} operation(s)")
    if errors:
        summary_parts.append(f"{len(errors)} error(s): " + "; ".join(errors))

    return {
        "message": ". ".join(summary_parts) if summary_parts else "No operations performed",
        "affected_files": all_affected,
        "actions": [a for a in all_actions if a is not None],
    }


@tool
def copy_item(
    working_directory: str,
    source_path: Union[str, List[str], None] = None,
    dest_path: str = "",
    name_pattern: Optional[str] = None,
    create_dest_folder: bool = True,
) -> dict:
    """Copy one or more files/folders to a new location.

    Args:
        working_directory (str): Base directory where operations are performed
        source_path: Single path (str) or list of paths to copy, relative to working_directory. Use this OR name_pattern.
        dest_path (str): Destination path/folder, relative to working_directory
        name_pattern (str, optional): Case-insensitive substring to match in filenames. Finds and copies all matching files. Only use when exact match mode is enabled and the user asks to operate on files by filename pattern.
        create_dest_folder (bool): Auto-create destination folder if it doesn't exist (default True)

    Returns:
        dict: Dictionary containing success/failure message, affected files, and action(s)
    """
    # Resolve source paths from name_pattern or source_path
    if name_pattern:
        paths = _find_matching_files(working_directory, name_pattern)
        if not paths:
            return {"message": f"No files matching '{name_pattern}' found", "affected_files": [], "action": None}
    elif source_path is None:
        return {"message": "Either source_path or name_pattern must be provided", "affected_files": [], "action": None}
    elif isinstance(source_path, str):
        paths = [source_path]
    else:
        paths = source_path

    # Single item: return standard format with "action" (singular)
    if len(paths) == 1 and not name_pattern:
        if create_dest_folder and dest_path:
            dest_full = _get_full_path(working_directory, dest_path)
            if not os.path.exists(dest_full):
                os.makedirs(dest_full)
        return _copy_single_item(working_directory, paths[0], dest_path)

    # Batch: return format with "actions" (list)
    return _run_batch_operation(working_directory, paths, dest_path, _copy_single_item, create_dest_folder)


@tool
def move_item(
    working_directory: str,
    source_path: Union[str, List[str], None] = None,
    dest_path: str = "",
    name_pattern: Optional[str] = None,
    create_dest_folder: bool = True,
) -> dict:
    """Move one or more files/folders to a new location.

    Args:
        working_directory (str): Base directory where operations are performed
        source_path: Single path (str) or list of paths to move, relative to working_directory. Use this OR name_pattern.
        dest_path (str): Destination path/folder, relative to working_directory
        name_pattern (str, optional): Case-insensitive substring to match in filenames. Finds and moves all matching files. Only use when exact match mode is enabled and the user asks to operate on files by filename pattern.
        create_dest_folder (bool): Auto-create destination folder if it doesn't exist (default True)

    Returns:
        dict: Dictionary containing success/failure message, affected files, and action(s)
    """
    # Resolve source paths from name_pattern or source_path
    if name_pattern:
        paths = _find_matching_files(working_directory, name_pattern)
        if not paths:
            return {"message": f"No files matching '{name_pattern}' found", "affected_files": [], "action": None}
    elif source_path is None:
        return {"message": "Either source_path or name_pattern must be provided", "affected_files": [], "action": None}
    elif isinstance(source_path, str):
        paths = [source_path]
    else:
        paths = source_path

    # Single item: return standard format with "action" (singular)
    if len(paths) == 1 and not name_pattern:
        if create_dest_folder and dest_path:
            dest_full = _get_full_path(working_directory, dest_path)
            if not os.path.exists(dest_full):
                os.makedirs(dest_full)
        return _move_single_item(working_directory, paths[0], dest_path)

    # Batch: return format with "actions" (list)
    return _run_batch_operation(working_directory, paths, dest_path, _move_single_item, create_dest_folder)


@tool
def delete_item(
    working_directory: str,
    path: Union[str, List[str], None] = None,
    item_type: Optional[Literal["file", "folder"]] = None,
) -> dict:
    """Delete one or more files/folders from the filesystem.

    Args:
        working_directory (str): Base directory where operations are performed
        path: Single path (str) or list of paths to delete, relative to working_directory
        item_type (Optional[Literal["file", "folder"]]): Specify if deleting a file or folder. If None, will detect automatically

    Returns:
        dict: Dictionary containing success/failure message and affected files
    """
    if path is None:
        return {"message": "Path must be provided", "affected_files": [], "action": None}

    # Normalize to list
    paths = [path] if isinstance(path, str) else path

    # Single item: use standard format
    if len(paths) == 1:
        return _delete_single_item(working_directory, paths[0], item_type)

    # Batch delete
    all_affected = []
    all_actions = []
    messages = []
    errors = []

    for p in paths:
        result = _delete_single_item(working_directory, p, item_type)
        all_affected.extend(result.get("affected_files", []))
        if result.get("action"):
            all_actions.append(result["action"])
            messages.append(result["message"])
        else:
            errors.append(result["message"])

    summary_parts = []
    if messages:
        summary_parts.append(f"Deleted {len(messages)} item(s)")
    if errors:
        summary_parts.append(f"{len(errors)} error(s): " + "; ".join(errors))

    return {
        "message": ". ".join(summary_parts) if summary_parts else "No operations performed",
        "affected_files": all_affected,
        "actions": [a for a in all_actions if a is not None],
    }


@tool
def rename_item(working_directory: str, old_path: str, new_name: str) -> dict:
    """Rename a file or folder."""
    full_old_path = _get_full_path(working_directory, old_path)
    new_path = os.path.join(os.path.dirname(full_old_path), new_name)
    affected_files = []

    if not os.path.exists(full_old_path):
        return {
            "message": f"Path '{old_path}' does not exist",
            "affected_files": [],
            "action": None,
        }

    if os.path.exists(new_path):
        return {
            "message": f"Cannot rename: destination '{new_name}' already exists",
            "affected_files": [],
            "action": None,
        }

    os.rename(full_old_path, new_path)
    affected_files.extend([full_old_path, new_path])
    is_file = os.path.isfile(new_path)

    action = ActionInfo(
        action_type=ActionType.RENAME_FILE if is_file else ActionType.RENAME_FOLDER,
        item_name=os.path.basename(old_path),
        source_path=full_old_path,
        new_name=new_name,
    )

    return {
        "message": f"Renamed {'file' if is_file else 'folder'} '{old_path}' to '{new_name}'",
        "affected_files": affected_files,
        "action": action.to_dict(),
    }


@tool
def list_items(
    working_directory: str,
    path: Optional[str] = None,
    item_type: Optional[Literal["files", "folders", "all"]] = "all",
    recursive: bool = False,
) -> str:
    """List files and folders in a directory.

    Args:
        working_directory (str): Base directory where operations are performed
        path (Optional[str]): Path to list items from, relative to working_directory. If None, uses working_directory
        item_type (Optional[Literal["files", "folders", "all"]]): Filter results by type
        recursive (bool): If True, lists items in subdirectories as well

    Returns:
        str: Formatted string listing all items found, with icons for files (📄) and folders (📁)
    """
    search_path = _get_full_path(working_directory, path)

    if not os.path.exists(search_path):
        return f"Path '{path if path else 'working directory'}' does not exist"

    items = []
    if recursive:
        for root, dirs, files in os.walk(search_path):
            rel_root = os.path.relpath(root, working_directory)
            if item_type in ["folders", "all"] and rel_root != ".":
                items.append(f"📁 {rel_root}")
            if item_type in ["files", "all"]:
                items.extend(f"📄 {os.path.join(rel_root, f)}" for f in files)
    else:
        with os.scandir(search_path) as entries:
            for entry in entries:
                rel_path = os.path.relpath(entry.path, working_directory)
                if entry.is_file() and item_type in ["files", "all"]:
                    items.append(f"📄 {rel_path}")
                elif entry.is_dir() and item_type in ["folders", "all"]:
                    items.append(f"📁 {rel_path}")

    if not items:
        return f"No {item_type} found in {path if path else 'working directory'}"

    return "\n".join(sorted(items))


@tool
def find_files(
    working_directory: str,
    name_pattern: str,
    path: Optional[str] = None,
    recursive: bool = True,
) -> str:
    """Find files whose names contain the given pattern (case-insensitive substring match).

    Args:
        working_directory (str): Base directory where operations are performed
        name_pattern (str): Case-insensitive substring to search for in filenames
        path (Optional[str]): Subdirectory to search in, relative to working_directory
        recursive (bool): Whether to search subdirectories (default True)

    Returns:
        str: Formatted list of matching file paths relative to working_directory
    """
    matches = _find_matching_files(working_directory, name_pattern, path, recursive)
    if not matches:
        return f"No files matching '{name_pattern}' found"
    return "\n".join(f"📄 {m}" for m in matches)


@tool
def change_directory(working_directory: str, new_path: Optional[str] = None) -> dict:
    """Change the current working directory to a new path.

    Args:
        working_directory (str): Current working directory
        new_path (Optional[str]): New path to change to. Can be absolute or relative to current working directory

    Returns:
        dict: Dictionary containing the new working directory and status message
    """
    if new_path is None:
        return {
            "working_directory": working_directory,
            "message": f"Current directory: {working_directory}",
        }

    # Handle absolute paths correctly
    if os.path.isabs(new_path):
        if not ALLOW_EXTERNAL_DIRECTORIES:
            if not os.path.commonpath([new_path]).startswith(
                os.path.commonpath([WORKING_DIRECTORY])
            ):
                return {
                    "working_directory": working_directory,
                    "message": f"Cannot change to directory outside of workspace: {new_path}",
                }
        new_full_path = new_path
    else:
        new_full_path = _get_full_path(working_directory, new_path)

    new_full_path = os.path.normpath(new_full_path)

    try:
        if not os.path.exists(new_full_path):
            return {
                "working_directory": working_directory,
                "message": f"Path '{new_path}' does not exist",
            }

        if not os.path.isdir(new_full_path):
            return {
                "working_directory": working_directory,
                "message": f"Path '{new_path}' is not a directory",
            }

        os.listdir(new_full_path)
        return {
            "working_directory": new_full_path,
            "message": f"Changed directory to: {new_full_path}",
        }
    except PermissionError:
        return {
            "working_directory": working_directory,
            "message": f"Permission denied: cannot access '{new_path}'",
        }
    except Exception as e:
        return {
            "working_directory": working_directory,
            "message": f"Error changing to '{new_path}': {str(e)}",
        }
