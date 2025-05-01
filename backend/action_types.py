from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ActionType(Enum):
    """Types of sensitive actions that can be performed."""

    MOVE_FILE = "move_file"
    MOVE_FOLDER = "move_folder"
    RENAME_FILE = "rename_file"
    RENAME_FOLDER = "rename_folder"
    CREATE_FILE = "create_file"
    CREATE_FOLDER = "create_folder"
    DELETE_FILE = "delete_file"
    DELETE_FOLDER = "delete_folder"
    MODIFY_FILE = "modify_file"


@dataclass
class ActionInfo:
    """Information about a sensitive action that was performed."""

    action_type: ActionType
    item_name: str
    source_path: Optional[str] = None
    target_path: Optional[str] = None
    new_name: Optional[str] = None
    description: str = ""

    def __post_init__(self):
        """Generate a description if none was provided."""
        if not self.description:
            if self.action_type == ActionType.MOVE_FILE:
                self.description = f"Moved file '{self.item_name}' from '{self.source_path}' to '{self.target_path}'"
            elif self.action_type == ActionType.MOVE_FOLDER:
                self.description = f"Moved folder '{self.item_name}' from '{self.source_path}' to '{self.target_path}'"
            elif self.action_type == ActionType.RENAME_FILE:
                self.description = (
                    f"Renamed file from '{self.item_name}' to '{self.new_name}'"
                )
            elif self.action_type == ActionType.RENAME_FOLDER:
                self.description = (
                    f"Renamed folder from '{self.item_name}' to '{self.new_name}'"
                )
            elif self.action_type == ActionType.CREATE_FILE:
                self.description = (
                    f"Created file '{self.item_name}' in '{self.target_path}'"
                )
            elif self.action_type == ActionType.CREATE_FOLDER:
                self.description = (
                    f"Created folder '{self.item_name}' in '{self.target_path}'"
                )
            elif self.action_type == ActionType.DELETE_FILE:
                self.description = (
                    f"Deleted file '{self.item_name}' from '{self.source_path}'"
                )
            elif self.action_type == ActionType.DELETE_FOLDER:
                self.description = (
                    f"Deleted folder '{self.item_name}' from '{self.source_path}'"
                )
            elif self.action_type == ActionType.MODIFY_FILE:
                self.description = (
                    f"Modified file '{self.item_name}' in '{self.source_path}'"
                )

    def to_dict(self) -> dict:
        """Convert the ActionInfo to a dictionary for JSON serialization."""
        return {
            "action_type": self.action_type.value,
            "item_name": self.item_name,
            "source_path": self.source_path,
            "target_path": self.target_path,
            "new_name": self.new_name,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ActionInfo":
        """Create an ActionInfo instance from a dictionary.

        Args:
            data: Dictionary containing the action info fields

        Returns:
            ActionInfo: A new ActionInfo instance
        """
        return cls(
            action_type=ActionType(data["action_type"]),
            item_name=data["item_name"],
            source_path=data.get("source_path"),
            target_path=data.get("target_path"),
            new_name=data.get("new_name"),
            description=data.get("description", ""),
        )
