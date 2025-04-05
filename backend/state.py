from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import AnyMessage, add_messages
from reducers import AccumulatorList, FlexibleMap


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    working_directory: str
    affected_files: AccumulatorList[str]
    file_metadata: FlexibleMap
