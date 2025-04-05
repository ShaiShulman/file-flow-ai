from typing import TypeVar, List, Union, Literal, Dict, Any
from dataclasses import dataclass
from typing_extensions import TypedDict, Annotated

T = TypeVar("T")


@dataclass
class ClearList:
    """Action to clear a list."""

    action: Literal["clear"] = "clear"


def accumulate_list(current: List[T], new: Union[List[T], ClearList]) -> List[T]:
    """Generic reducer function that accumulates items in a list with clear capability.

    Args:
        current: The current list
        new: Either a list to accumulate or a ClearList action to clear the list

    Returns:
        The modified list
    """
    if isinstance(new, ClearList):
        return []
    return current + new


# Type alias for convenience
AccumulatorList = Annotated[List[T], accumulate_list]


# For the file metadata map
@dataclass
class ClearMap:
    """Action to clear the entire map."""

    action: Literal["clear"] = "clear"


@dataclass
class UpdateItem:
    """Action to update specific fields of an item in the map."""

    path: str  # The file path to update
    updates: Dict[str, Any]  # The fields to update and their new values


FileMapOperation = Union[Dict[str, Dict[str, Any]], UpdateItem, ClearMap]


def flexible_map(
    current: Dict[str, Dict[str, Any]], new: FileMapOperation
) -> Dict[str, Dict[str, Any]]:
    """Reducer for a map that supports full updates, partial updates, and clearing.

    Args:
        current: The current map of file paths to their metadata
        new: Either:
            - A dict to merge with current state
            - An UpdateItem to update specific fields of a specific file
            - A ClearMap to clear everything

    Returns:
        The modified map
    """
    if isinstance(new, ClearMap):
        return {}

    if isinstance(new, UpdateItem):
        result = current.copy()
        if new.path not in result:
            result[new.path] = {}
        result[new.path] = {**result[new.path], **new.updates}
        return result

    # If it's a dict, merge it with current state
    return {**current, **new}


# Type alias for convenience
FlexibleMap = Annotated[Dict[str, Dict[str, Any]], flexible_map]
