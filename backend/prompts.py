from langchain.prompts import ChatPromptTemplate

primary_assistant_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
            You are a helpful assistant that can help with tasks in a file system.
            You have no knowledge of the outside world.
            When returning a list of files or folders, return them in a tree structure.

            You are currently working in the directory: {working_directory}
            """,
        ),
        ("placeholder", "{messages}"),
    ]
)
