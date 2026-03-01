from typing import Dict, List, Optional


class CategoriesManager:
    def __init__(self, db=None):
        """Initialize CategoriesManager with a Database instance.

        Args:
            db: Database instance. If None, imports the global singleton.
        """
        if db is None:
            from database import db as default_db
            db = default_db
        self.db = db

    def add_category(self, name: str, values: List[str]) -> Dict[str, str]:
        """Add a new category with its possible values."""
        if self.db.get_category(name) is not None:
            return {"status": "error", "message": f"Category '{name}' already exists"}

        self.db.save_category(name, values)
        return {"status": "success", "message": f"Category '{name}' added successfully"}

    def remove_category(self, name: str) -> Dict[str, str]:
        """Remove a category."""
        if not self.db.delete_category(name):
            return {"status": "error", "message": f"Category '{name}' does not exist"}

        return {
            "status": "success",
            "message": f"Category '{name}' removed successfully",
        }

    def update_category(self, name: str, values: List[str]) -> Dict[str, str]:
        """Update values for an existing category."""
        if self.db.get_category(name) is None:
            return {"status": "error", "message": f"Category '{name}' does not exist"}

        self.db.save_category(name, values)
        return {
            "status": "success",
            "message": f"Category '{name}' updated successfully",
        }

    def clear_categories(self) -> Dict[str, str]:
        """Clear all categories."""
        self.db.clear_categories()
        return {"status": "success", "message": "All categories cleared successfully"}

    def get_categories(self) -> Dict[str, List[str]]:
        """Get all categories."""
        return self.db.get_categories()

    def get_category(self, name: str) -> Optional[List[str]]:
        """Get values for a specific category."""
        return self.db.get_category(name)
