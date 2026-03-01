import os
from database import db
from categories_manager import CategoriesManager

# Import categories from JSON on first startup (one-time migration)
current_dir = os.path.dirname(os.path.abspath(__file__))
categories_json_path = os.path.join(current_dir, "categories.json")
imported = db.import_categories_from_json(categories_json_path)
if imported > 0:
    print(f"Migrated {imported} categories from categories.json to SQLite")

# Initialize categories manager with the database
categories_manager = CategoriesManager(db)
