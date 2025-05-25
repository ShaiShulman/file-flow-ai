from dotenv import load_dotenv
import os

load_dotenv()


def get_session_working_directory(session_id: str) -> str:
    """
    Build the working directory path for a given session.

    Args:
        session_id (str): The session identifier

    Returns:
        str: The full path to the session's working directory (frontend/uploads/extracted_{session_id})
    """

    # Get uploads folder from .env file, default to "uploads" if not set
    uploads_folder = os.getenv("UPLOADS_FOLDER", "uploads")

    working_directory = os.path.join(uploads_folder, f"extracted_{session_id}")

    # Debug: Print the generated path (can be removed in production)
    print(
        f"DEBUG: Generated working directory for session {session_id}: {working_directory}"
    )

    return working_directory
