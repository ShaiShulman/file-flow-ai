import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from folder_operations import get_content
from text_analysis import analyze_document, TextAnalyzer, PROMPT_TEMPLATES


def test_get_content_text_file(tmp_path):
    # Create a temporary text file
    test_file = tmp_path / "test.txt"
    test_content = "This is a test file content"
    test_file.write_text(test_content)

    # Test reading the file
    result = get_content(str(tmp_path), "test.txt")
    expected = f"Content of 'test.txt':\n{test_content}"
    assert result == expected


def test_get_content_nonexistent_file(tmp_path):
    # Test with a non-existent file
    result = get_content(str(tmp_path), "nonexistent.txt")
    assert result == "Path 'nonexistent.txt' does not exist"


def test_get_content_directory(tmp_path):
    # Create a temporary directory
    test_dir = tmp_path / "test_dir"
    test_dir.mkdir()

    # Test with a directory path
    result = get_content(str(tmp_path), "test_dir")
    assert result == "Path 'test_dir' is not a file"


def test_get_content_unsupported_extension(tmp_path):
    # Create a file with unsupported extension
    test_file = tmp_path / "test.xyz"
    test_content = "This is a test file content"
    test_file.write_text(test_content)

    # Test reading the file
    result = get_content(str(tmp_path), "test.xyz")
    expected = f"Content of 'test.xyz':\n{test_content}"
    assert result == expected


def test_get_content_relative_path(tmp_path):
    # Create a nested directory structure
    nested_dir = tmp_path / "nested"
    nested_dir.mkdir()
    test_file = nested_dir / "test.txt"
    test_content = "This is a test file content"
    test_file.write_text(test_content)

    # Test reading the file with relative path
    result = get_content(str(tmp_path), "nested/test.txt")
    expected = f"Content of 'nested/test.txt':\n{test_content}"
    assert result == expected


def test_get_content_encoding_error(tmp_path):
    # Create a file with binary content to force encoding error
    test_file = tmp_path / "test.bin"
    test_file.write_bytes(b"\x80invalid")

    # Test reading the file
    result = get_content(str(tmp_path), "test.bin")
    assert "Error reading file 'test.bin'" in result


def test_specific_file():
    """Test reading a specific file."""
    # Specify the working directory and file path
    working_directory = ""  # working directory
    file_path = ""  # The specific file you want to test
    # file_path = "shai2/India res.doc"

    # Test reading the file
    result = get_content(working_directory, file_path)

    # Print the result for inspection
    print("\nTest result for specific file:")
    print(result)

    # Basic assertions
    assert not result.startswith("Path"), "File should exist"
    assert not result.startswith("Error"), "No errors should occur"


if __name__ == "__main__":
    test_specific_file()
