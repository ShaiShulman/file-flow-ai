import os
import re
import olefile
from markitdown import MarkItDown
from utils import truncate_text


def extract_text_from_doc(file_path: str) -> str:
    """Extract text content from .doc and .dot files.

    Args:
        file_path (str): Path to the document file

    Returns:
        str: Extracted text content
    """
    if not olefile.isOleFile(file_path):
        return ""

    ole = olefile.OleFileIO(file_path)
    streams = ole.listdir()

    if ["WordDocument"] not in streams:
        return ""

    # Read the WordDocument stream
    word_stream = ole.openstream("WordDocument")
    data = word_stream.read()

    text = re.findall(b"[\x20-\x7e\r\n]{4,}", data)

    # Decode and join the extracted text
    decoded_text = [t.decode("ascii", errors="ignore") for t in text]
    result = "\n".join(
        line
        for i, line in enumerate(decoded_text)
        if i == 0 or line.strip() != decoded_text[i - 1].strip()
    )

    result = re.sub(r"\s{2,}", " ", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    ole.close()
    return result.strip()


def extract_text_from_markdown(file_path: str, path: str) -> str:
    """Extract text content from markdown supported files.

    Args:
        file_path (str): Full path to the file
        path (str): Original path relative to working directory

    Returns:
        str: Extracted text content
    """
    md = MarkItDown()
    result = md.convert(file_path)
    return f"Content of '{path}':\n{truncate_text(result.text_content)}"


def extract_text_from_plaintext(file_path: str, path: str) -> str:
    """Extract text content from plain text files.

    Args:
        file_path (str): Full path to the file
        path (str): Original path relative to working directory

    Returns:
        str: Extracted text content or error message
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            return f"Content of '{path}':\n{content}"
    except Exception as e:
        return f"Error reading file '{path}': {str(e)}"


def get_content(working_directory: str, path: str) -> str:
    """Read and return the content of a file.

    Args:
        working_directory (str): Base directory where operations are performed
        path (str): Path to the file, relative to working_directory

    Returns:
        str: File content or error message
    """
    markitdown_supported_extensions = (
        ".pptx",
        ".docx",
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
    )
    word_supported_extensions = (".doc", ".dot")

    full_path = os.path.join(working_directory, path)

    if not os.path.exists(full_path):
        return f"Path '{path}' does not exist"

    if not os.path.isfile(full_path):
        return f"Path '{path}' is not a file"

    file_ext = os.path.splitext(full_path)[1].lower()
    if file_ext in word_supported_extensions:
        return extract_text_from_doc(full_path)
    if file_ext in markitdown_supported_extensions:
        return extract_text_from_markdown(full_path, path)
    else:
        return extract_text_from_plaintext(full_path, path)
