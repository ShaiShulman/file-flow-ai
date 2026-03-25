"""File Registry — stable ID tracking for files and folders across moves/renames.

Each file/folder in a session gets a persistent UUID that survives path changes.
The registry is stored in the SQLite database and provides:
- Stable identity for frontend state (metadata, change indicators, selections)
- Annotated folder tree with stable IDs for the frontend file explorer
- Reconciliation with the actual filesystem
"""

import os
from typing import Dict, List, Optional, Any

from database import Database


class FileRegistry:
    """Manages stable file IDs for a session, backed by the database."""

    def __init__(self, db: Database):
        self.db = db

    def scan_and_register(self, session_id: str, working_directory: str) -> Dict[str, str]:
        """Walk the filesystem and register all files/folders. Returns {path: id} map.

        - New files get a fresh UUID
        - Existing files keep their ID
        - Files no longer on disk are soft-deleted
        """
        live_items: List[tuple] = []
        live_paths: set = set()

        for root, dirs, files in os.walk(working_directory):
            for d in dirs:
                full_path = os.path.join(root, d)
                live_items.append((full_path, "folder"))
                live_paths.add(full_path)
            for f in files:
                full_path = os.path.join(root, f)
                live_items.append((full_path, "file"))
                live_paths.add(full_path)

        # Also register the working directory itself
        live_items.append((working_directory, "folder"))
        live_paths.add(working_directory)

        # Reconcile: mark deleted entries that no longer exist on disk
        self.db.reconcile_registry(session_id, live_paths)

        # Bulk register all live items (existing ones keep their IDs)
        return self.db.bulk_register(session_id, live_items)

    def handle_move(self, session_id: str, old_path: str, new_path: str) -> Optional[str]:
        """Update registry when a file/folder is moved. Returns the file ID."""
        file_id = self.db.get_id_by_path(session_id, old_path)
        if file_id:
            self.db.update_file_path(session_id, file_id, new_path)
            # For folders, also update all children
            if os.path.isdir(new_path):
                old_prefix = old_path + os.sep
                new_prefix = new_path + os.sep
                self.db.update_file_paths_by_prefix(session_id, old_prefix, new_prefix)
            return file_id
        # File wasn't in registry — register at new path
        item_type = "folder" if os.path.isdir(new_path) else "file"
        return self.db.register_file(session_id, new_path, item_type)

    def handle_rename(self, session_id: str, old_path: str, new_path: str) -> Optional[str]:
        """Update registry when a file/folder is renamed. Same as move — path changes, ID stays."""
        return self.handle_move(session_id, old_path, new_path)

    def handle_copy(self, session_id: str, source_path: str, dest_path: str) -> str:
        """Register a copy with a new ID (copy = new identity)."""
        item_type = "folder" if os.path.isdir(dest_path) else "file"
        return self.db.register_file(session_id, dest_path, item_type)

    def handle_create(self, session_id: str, path: str, item_type: str) -> str:
        """Register a newly created file/folder."""
        return self.db.register_file(session_id, path, item_type)

    def handle_delete(self, session_id: str, path: str) -> bool:
        """Soft-delete a file/folder from the registry."""
        return self.db.mark_file_deleted(session_id, path)

    def get_id_map(self, session_id: str) -> Dict[str, str]:
        """Get {path: id} map for all active files."""
        return self.db.get_file_id_map(session_id)

    def get_id_for_path(self, session_id: str, path: str) -> Optional[str]:
        """Get the stable ID for a path."""
        return self.db.get_id_by_path(session_id, path)

    def build_annotated_tree(self, session_id: str, working_directory: str) -> Dict[str, Any]:
        """Build a folder tree with stable IDs from the registry.

        Walks the disk, auto-registers unknown files, and returns a tree
        matching the frontend's FolderType shape.
        """
        # First ensure all files are registered
        path_to_id = self.scan_and_register(session_id, working_directory)

        def build_node(dir_path: str) -> Dict[str, Any]:
            dir_id = path_to_id.get(dir_path, self.db.register_file(session_id, dir_path, "folder"))
            node: Dict[str, Any] = {
                "id": dir_id,
                "name": os.path.basename(dir_path),
                "type": "folder",
                "path": dir_path,
                "children": [],
            }

            try:
                entries = sorted(os.listdir(dir_path))
            except OSError:
                return node

            for entry_name in entries:
                entry_path = os.path.join(dir_path, entry_name)
                if os.path.isdir(entry_path):
                    child = build_node(entry_path)
                    node["children"].append(child)
                elif os.path.isfile(entry_path):
                    file_id = path_to_id.get(entry_path, self.db.register_file(session_id, entry_path, "file"))
                    ext = os.path.splitext(entry_name)[1].lstrip(".").lower()
                    file_node: Dict[str, Any] = {
                        "id": file_id,
                        "name": entry_name,
                        "type": "file",
                        "path": entry_path,
                        "extension": ext,
                    }
                    try:
                        stat = os.stat(entry_path)
                        file_node["metadata"] = {
                            "lastModified": stat.st_mtime,
                            "size": stat.st_size,
                        }
                    except OSError:
                        pass
                    node["children"].append(file_node)

            return node

        return build_node(working_directory)

    def process_actions(self, session_id: str, actions: List[Dict[str, Any]], working_directory: str) -> None:
        """Process a list of action dicts and update the registry accordingly."""
        for action in actions:
            atype = action.get("action_type", "")
            source = action.get("source_path")
            target = action.get("target_path")
            item_name = action.get("item_name", "")
            new_name = action.get("new_name")

            if atype in ("move_file", "move_folder"):
                if source and target:
                    self.handle_move(session_id, source, target)

            elif atype in ("rename_file", "rename_folder"):
                if source and new_name:
                    new_path = os.path.join(os.path.dirname(source), new_name)
                    self.handle_rename(session_id, source, new_path)

            elif atype in ("copy_file", "copy_folder"):
                if target:
                    dest = target
                    if source and os.path.isdir(target):
                        dest = os.path.join(target, os.path.basename(source))
                    self.handle_copy(session_id, source or "", dest)

            elif atype in ("create_file", "create_folder"):
                if target and item_name:
                    path = os.path.join(target, item_name)
                    item_type = "file" if "file" in atype else "folder"
                    self.handle_create(session_id, path, item_type)

            elif atype in ("delete_file", "delete_folder"):
                if source:
                    self.handle_delete(session_id, source)
