import os
import shutil
import jsonברק
from typing import List, Optional, Union, Literal
from markitdown import MarkItDown
from langchain_core.tools import tool

from utils import truncate_text
from config import WORKING_DIRECTORY, ALLOW_EXTERNAL_DIRECTORIES


def _get_full_path(working_directory: str, folder_path: Optional[str] = None) -> str:
    """Convert relative path to full path within working directory.

    Args:
        working_directory (str): Base directory where operations are performed
        folder_path (Optional[str]): Relative path to convert. If None, returns working_directory

    Returns:
        str: Full path
    """
    return (
        os.path.join(working_directory, folder_path)
        if folder_path
        else working_directory
    )


@tool
def create_item(
    working_directory: str,
    name: str,
    item_type: Literal["file", "folder"],
    parent_path: Optional[str] = None,
    content: Optional[str] = None,
) -> str:
    """Create a new file or folder in the specified directory.

    Args:
        working_directory (str): Base directory where operations are performed
        name (str): Name of the file or folder to create
        item_type (Literal["file", "folder"]): Type of item to create ("file" or "folder")
        parent_path (Optional[str]): Path where the item should be created, relative to working_directory
        content (Optional[str]): Content to write if creating a file

    Returns:
        str: Success/failure message describing the operation result
    """
    parent_full_path = _get_full_path(working_directory, parent_path)
    new_path = os.path.join(parent_full_path, name)

    if not os.path.exists(parent_full_path):
        os.makedirs(parent_full_path)

    if os.path.exists(new_path):
        return f"{item_type.title()} '{name}' already exists"

    if item_type == "folder":
        os.makedirs(new_path)
        return f"Created folder '{name}' in '{parent_path if parent_path else 'working directory'}'"
    else:
        with open(new_path, "w") as f:
            if content:
                f.write(content)
        return f"Created file '{name}'{' with content' if content else ''} in '{parent_path if parent_path else 'working directory'}'"


@tool
def copy_item(
    working_directory: str,
    source_path: str,
    dest_path: str,
) -> str:
    """Copy a file or folder to a new location.

    Args:
        working_directory (str): Base directory where operations are performed
        source_path (str): Path of the item to copy, relative to working_directory
        dest_path (str): Destination path where item should be copied, relative to working_directory

    Returns:
        str: Success/failure message describing the operation result
    """
    source_full_path = _get_full_path(working_directory, source_path)
    dest_full_path = _get_full_path(working_directory, dest_path)

    if not os.path.exists(source_full_path):
        return f"Source path '{source_path}' does not exist"

    is_file = os.path.isfile(source_full_path)

    if os.path.exists(dest_full_path):
        return f"Destination path '{dest_path}' already exists"

    if is_file:
        os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
        shutil.copy2(source_full_path, dest_full_path)
        return f"Copied file from '{source_path}' to '{dest_path}'"
    else:
        shutil.copytree(source_full_path, dest_full_path)
        return f"Copied folder from '{source_path}' to '{dest_path}'"


@tool
def move_item(
    working_directory: str,
    source_path: str,
    dest_path: str,
) -> str:
    """Move a file or folder to a new location.

    Args:
        working_directory (str): Base directory where operations are performed
        source_path (str): Path of the item to move, relative to working_directory
        dest_path (str): Destination path where item should be moved, relative to working_directory

    Returns:
        str: Success/failure message describing the operation result
    """
    source_full_path = _get_full_path(working_directory, source_path)
    dest_full_path = _get_full_path(working_directory, dest_path)

    if not os.path.exists(source_full_path):
        return f"Source path '{source_path}' does not exist"

    is_file = os.path.isfile(source_full_path)

    if os.path.exists(dest_full_path):
        return f"Destination path '{dest_path}' already exists"

    os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
    shutil.move(source_full_path, dest_full_path)
    item_str = "file" if is_file else "folder"
    return f"Moved {item_str} from '{source_path}' to '{dest_path}'"


@tool
def delete_item(
    working_directory: str,
    path: str,
    item_type: Optional[Literal["file", "folder"]] = None,
) -> str:
    """Delete a file or folder from the filesystem.

    Args:
        working_directory (str): Base directory where operations are performed
        path (str): Path of the item to delete, relative to working_directory
        item_type (Optional[Literal["file", "folder"]]): Specify if deleting a file or folder. If None, will detect automatically

    Returns:
        str: Success/failure message describing the operation result
    """
    full_path = _get_full_path(working_directory, path)

    if not os.path.exists(full_path):
        return f"Path '{path}' does not exist"

    is_file = os.path.isfile(full_path)
    if item_type and (
        (item_type == "file" and not is_file) or (item_type == "folder" and is_file)
    ):
        return f"Path '{path}' is not a {item_type}"

    if is_file:
        os.remove(full_path)
        return f"Deleted file '{path}'"
    else:
        shutil.rmtree(full_path)
        return f"Deleted folder '{path}' and its contents"


@tool
def rename_item(working_directory: str, old_path: str, new_name: str) -> str:
    """Rename a file or folder.

    Args:
        working_directory (str): Base directory where operations are performed
        old_path (str): Current path of the item, relative to working_directory
        new_name (str): New name for the item (not full path, just the name)

    Returns:
        str: Success/failure message describing the operation result
    """
    full_old_path = _get_full_path(working_directory, old_path)
    new_path = os.path.join(os.path.dirname(full_old_path), new_name)

    if not os.path.exists(full_old_path):
        return f"Path '{old_path}' does not exist"

    if os.path.exists(new_path):
        return f"Cannot rename: destination '{new_name}' already exists"

    os.rename(full_old_path, new_path)
    item_type = "file" if os.path.isfile(full_old_path) else "folder"
    return f"Renamed {item_type} '{old_path}' to '{new_name}'"


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
def get_content(working_directory: str, path: str) -> str:
    """Read and return the content of a file.

    Args:
        working_directory (str): Base directory where operations are performed
        path (str): Path to the file, relative to working_directory

    Returns:
        str: File content or error message
    """
    supported_extensions = (".pptx", ".docx", ".pdf", ".jpg", ".jpeg", ".png")
    full_path = _get_full_path(working_directory, path)

    if not os.path.exists(full_path):
        return f"Path '{path}' does not exist"

    if not os.path.isfile(full_path):
        return f"Path '{path}' is not a file"

    file_ext = os.path.splitext(full_path)[1].lower()
    if file_ext not in supported_extensions:
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
                return f"Content of '{path}':\n{content}"
        except Exception as e:
            return f"Error reading file '{path}': {str(e)}"
    else:
        md = MarkItDown()
        result = md.convert(full_path)
        return f"Content of '{path}':\n{truncate_text(result.text_content)}"


@tool
def change_directory(working_directory: str, new_path: Optional[str] = None) -> str:
    """Change the current working directory to a new path.

    Args:
        working_directory (str): Current working directory
        new_path (Optional[str]): New path to change to. Can be absolute or relative to current working directory

    Returns:
        str: JSON string containing the new working directory and status message
    """
    if new_path is None:
        return json.dumps(
            {
                "working_directory": working_directory,
                "message": f"Current directory: {working_directory}",
            }
        )

    # Handle absolute paths correctly
    if os.path.isabs(new_path):
        if not ALLOW_EXTERNAL_DIRECTORIES:
            if not os.path.commonpath([new_path]).startswith(
                os.path.commonpath([WORKING_DIRECTORY])
            ):
                return json.dumps(
                    {
                        "working_directory": working_directory,
                        "message": f"Cannot change to directory outside of workspace: {new_path}",
                    }
                )
        new_full_path = new_path
    else:
        new_full_path = _get_full_path(working_directory, new_path)

    new_full_path = os.path.normpath(new_full_path)

    try:
        if not os.path.exists(new_full_path):
            return json.dumps(
                {
                    "working_directory": working_directory,
                    "message": f"Path '{new_path}' does not exist",
                }
            )

        if not os.path.isdir(new_full_path):
            return json.dumps(
                {
                    "working_directory": working_directory,
                    "message": f"Path '{new_path}' is not a directory",
                }
            )

        os.listdir(new_full_path)
        return json.dumps(
            {
                "working_directory": new_full_path,
                "message": f"Changed directory to: {new_full_path}",
            }
        )
    except PermissionError:
        return json.dumps(
            {
                "working_directory": working_directory,
                "message": f"Permission denied: cannot access '{new_path}'",
            }
        )
    except Exception as e:
        return json.dumps(
            {
                "working_directory": working_directory,
                "message": f"Error changing to '{new_path}': {str(e)}",
            }
        )
