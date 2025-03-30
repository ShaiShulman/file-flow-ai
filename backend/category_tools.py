from typing import List, Dict
import os
import json

from categories import categories_manager


def add_category(name: str, values: List[str]) -> Dict[str, str]:
    """Add a new category with its possible values.

    This function creates a new category in the system with a list of possible values.
    Each category represents a type of document or file classification.

    Args:
        name (str): The name of the category to add (e.g., "Board documents", "Contracts")
        values (List[str]): List of possible values/keywords for this category
                           (e.g., ["board resolution", "minutes of the board"])

    Returns:
        Dict[str, str]: A dictionary containing:
            - status: "success" or "error"
            - message: Description of the operation result

    Example:
        >>> add_category("Contracts", ["service agreement", "employment contract"])
        {'status': 'success', 'message': "Category 'Contracts' added successfully"}
    """
    return categories_manager.add_category(name, values)


def remove_category(name: str) -> Dict[str, str]:
    """Remove an existing category.

    This function removes a category and all its associated values from the system.

    Args:
        name (str): The name of the category to remove

    Returns:
        Dict[str, str]: A dictionary containing:
            - status: "success" or "error"
            - message: Description of the operation result

    Example:
        >>> remove_category("Contracts")
        {'status': 'success', 'message': "Category 'Contracts' removed successfully"}
    """
    return categories_manager.remove_category(name)


def update_category(name: str, values: List[str]) -> Dict[str, str]:
    """Update values for an existing category.

    This function updates the list of possible values for an existing category.
    The previous values will be completely replaced by the new ones.

    Args:
        name (str): The name of the category to update
        values (List[str]): New list of values/keywords for this category

    Returns:
        Dict[str, str]: A dictionary containing:
            - status: "success" or "error"
            - message: Description of the operation result

    Example:
        >>> update_category("Board documents", ["board meeting minutes", "board resolution"])
        {'status': 'success', 'message': "Category 'Board documents' updated successfully"}
    """
    return categories_manager.update_category(name, values)


def clear_categories() -> Dict[str, str]:
    """Clear all categories from the system.

    This function removes all categories and their values from the system,
    effectively resetting the category configuration to empty.

    Returns:
        Dict[str, str]: A dictionary containing:
            - status: "success" or "error"
            - message: Description of the operation result

    Example:
        >>> clear_categories()
        {'status': 'success', 'message': 'All categories cleared successfully'}
    """
    return categories_manager.clear_categories()


def list_categories() -> Dict[str, List[str]]:
    """Get all categories and their values.

    This function returns all categories and their associated values currently
    configured in the system.

    Returns:
        Dict[str, List[str]]: A dictionary where:
            - keys are category names
            - values are lists of possible values for each category

    Example:
        >>> list_categories()
        {
            'Board documents': ['board resolution', 'minutes of the board'],
            'Contracts': ['service agreement', 'employment contract']
        }
    """
    categories = categories_manager.get_categories()
    print(f"Current categories in system: {json.dumps(categories, indent=2)}")
    return categories


def get_category(name: str) -> Dict[str, object]:
    """Get values for a specific category.

    This function retrieves all possible values associated with a specific category.

    Args:
        name (str): The name of the category to retrieve

    Returns:
        Dict[str, object]: A dictionary containing:
            - status: "success" or "error"
            - values: List of category values (if successful)
            - message: Error message (if unsuccessful)

    Example:
        >>> get_category("Board documents")
        {
            'status': 'success',
            'values': ['board resolution', 'minutes of the board']
        }
    """
    values = categories_manager.get_category(name)
    if values is None:
        return {"status": "error", "message": f"Category '{name}' does not exist"}
    return {"status": "success", "values": values}
