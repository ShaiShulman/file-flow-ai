import os
from categories_manager import CategoriesManager

# Get the absolute path to the categories.json file
current_dir = os.path.dirname(os.path.abspath(__file__))
categories_file = os.path.join(current_dir, "categories.json")

# Initialize categories manager with the absolute path
categories_manager = CategoriesManager(categories_file)
