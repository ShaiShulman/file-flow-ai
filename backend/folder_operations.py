import os
import shutil
from typing import List, Optional, Union, Literal
from markitdown import MarkItDown

from utils import truncate_text


class FolderOperations:
    def __init__(self, working_directory: str):
        """Initialize with base working directory."""
        self.working_directory = working_directory
        if not os.path.exists(working_directory):
            os.makedirs(working_directory)

    def _get_full_path(self, folder_path: Optional[str] = None) -> str:
        """Convert relative path to full path within working directory."""
        return (
            os.path.join(self.working_directory, folder_path)
            if folder_path
            else self.working_directory
        )

    def create_item(
        self,
        name: str,
        item_type: Literal["file", "folder"],
        parent_path: Optional[str] = None,
        content: Optional[str] = None,
    ) -> str:
        """Create a new file or folder."""
        parent_full_path = (
            self._get_full_path(parent_path) if parent_path else self.working_directory
        )
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

    def copy_item(
        self,
        source_path: str,
        dest_path: str,
    ) -> str:
        """Copy a file or folder to destination path."""
        source_full_path = self._get_full_path(source_path)
        dest_full_path = self._get_full_path(dest_path)

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

    def move_item(
        self,
        source_path: str,
        dest_path: str,
    ) -> str:
        """Move a file or folder to destination path."""
        source_full_path = self._get_full_path(source_path)

        dest_full_path = self._get_full_path(dest_path)

        if not os.path.exists(source_full_path):
            return f"Source path '{source_path}' does not exist"

        is_file = os.path.isfile(source_full_path)

        if os.path.exists(dest_full_path):
            return f"Destination path '{dest_path}' already exists"

        os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
        shutil.move(source_full_path, dest_full_path)
        item_str = "file" if is_file else "folder"
        return f"Moved {item_str} from '{source_path}' to '{dest_path}'"

    def delete_item(
        self, path: str, item_type: Optional[Literal["file", "folder"]] = None
    ) -> str:
        """Delete a file or folder."""
        full_path = self._get_full_path(path)

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

    def rename_item(self, old_path: str, new_name: str) -> str:
        """Rename a file or folder."""
        full_old_path = self._get_full_path(old_path)
        new_path = os.path.join(os.path.dirname(full_old_path), new_name)

        if not os.path.exists(full_old_path):
            return f"Path '{old_path}' does not exist"

        if os.path.exists(new_path):
            return f"Cannot rename: destination '{new_name}' already exists"

        os.rename(full_old_path, new_path)
        item_type = "file" if os.path.isfile(full_old_path) else "folder"
        return f"Renamed {item_type} '{old_path}' to '{new_name}'"

    def list_items(
        self,
        path: Optional[str] = None,
        item_type: Optional[Literal["files", "folders", "all"]] = "all",
        recursive: bool = False,
    ) -> str:
        """List items in the specified path or working directory."""
        search_path = self._get_full_path(path)

        if not os.path.exists(search_path):
            return f"Path '{path if path else 'working directory'}' does not exist"

        items = []
        if recursive:
            for root, dirs, files in os.walk(search_path):
                rel_root = os.path.relpath(root, self.working_directory)
                if item_type in ["folders", "all"] and rel_root != ".":
                    items.append(f"📁 {rel_root}")
                if item_type in ["files", "all"]:
                    items.extend(f"📄 {os.path.join(rel_root, f)}" for f in files)
        else:
            with os.scandir(search_path) as entries:
                for entry in entries:
                    rel_path = os.path.relpath(entry.path, self.working_directory)
                    if entry.is_file() and item_type in ["files", "all"]:
                        items.append(f"📄 {rel_path}")
                    elif entry.is_dir() and item_type in ["folders", "all"]:
                        items.append(f"📁 {rel_path}")

        if not items:
            return f"No {item_type} found"

        return "\n".join(sorted(items))

    def get_content(self, path: str) -> str:
        """Get the content of a file."""
        supported_extensions = (".pptx", ".docx", ".pdf", ".jpg", ".jpeg", ".png")
        full_path = self._get_full_path(path)

        if not os.path.exists(full_path):
            return f"Path '{path}' does not exist"

        is_file = os.path.isfile(full_path)
        if not is_file:
            return f"Path '{path}' is not a file"

        file_ext = os.path.splitext(full_path)[1].lower()
        if file_ext not in supported_extensions:
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception as e:
                return f"Error reading file '{path}': {str(e)}"
        else:
            md = MarkItDown()
            result = md.convert(full_path)
            return truncate_text(result.text_content)
