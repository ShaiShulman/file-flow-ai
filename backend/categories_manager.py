import json
from typing import Dict, List, Optional
import os


class CategoriesManager:
    def __init__(self, categories_file: str = "categories.json"):
        self.categories_file = categories_file
        self.categories: Dict[str, List[str]] = {}
        print(f"Initializing CategoriesManager with file: {self.categories_file}")
        self._load_categories()

    def _load_categories(self) -> None:
        """Load categories from JSON file if it exists."""
        print(f"Attempting to load categories from: {self.categories_file}")
        print(f"File exists: {os.path.exists(self.categories_file)}")

        if os.path.exists(self.categories_file):
            try:
                print(f"Current working directory: {os.getcwd()}")
                with open(self.categories_file, "r") as f:
                    self.categories = json.load(f)
                print(f"Successfully loaded {len(self.categories)} categories")
            except json.JSONDecodeError as e:
                print(f"Error loading categories from {self.categories_file}: {str(e)}")
                self.categories = {}
            except Exception as e:
                print(f"Unexpected error loading categories: {str(e)}")
                self.categories = {}
        else:
            print(f"Categories file not found at: {self.categories_file}")
            self.categories = {}

    def _save_categories(self) -> None:
        """Save categories to JSON file."""
        with open(self.categories_file, "w") as f:
            json.dump(self.categories, f, indent=2)

    def add_category(self, name: str, values: List[str]) -> Dict[str, str]:
        """Add a new category with its possible values."""
        if name in self.categories:
            return {"status": "error", "message": f"Category '{name}' already exists"}

        self.categories[name] = values
        self._save_categories()
        return {"status": "success", "message": f"Category '{name}' added successfully"}

    def remove_category(self, name: str) -> Dict[str, str]:
        """Remove a category."""
        if name not in self.categories:
            return {"status": "error", "message": f"Category '{name}' does not exist"}

        del self.categories[name]
        self._save_categories()
        return {
            "status": "success",
            "message": f"Category '{name}' removed successfully",
        }

    def update_category(self, name: str, values: List[str]) -> Dict[str, str]:
        """Update values for an existing category."""
        if name not in self.categories:
            return {"status": "error", "message": f"Category '{name}' does not exist"}

        self.categories[name] = values
        self._save_categories()
        return {
            "status": "success",
            "message": f"Category '{name}' updated successfully",
        }

    def clear_categories(self) -> Dict[str, str]:
        """Clear all categories."""
        self.categories = {}
        self._save_categories()
        return {"status": "success", "message": "All categories cleared successfully"}

    def get_categories(self) -> Dict[str, List[str]]:
        """Get all categories."""
        return self.categories

    def get_category(self, name: str) -> Optional[List[str]]:
        """Get values for a specific category."""
        return self.categories.get(name)
