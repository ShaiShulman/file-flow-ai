import os
import sys
import tempfile
import shutil
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from folder_operations import (
    _resolve_dest_path,
    _move_single_item,
    _copy_single_item,
    _delete_single_item,
    _find_matching_files,
    _run_batch_operation,
    move_item,
    copy_item,
    delete_item,
    find_files,
)


@pytest.fixture
def workspace(tmp_path):
    """Create a temp workspace with sample files."""
    wd = str(tmp_path / "workspace")
    os.makedirs(wd)

    # Create sample files
    for name in [
        "Litigation Letter.pdf",
        "NX - Litigation Report.pdf",
        "Financial Statement 2024.pdf",
        "Board Resolution.pdf",
        "Annual Report.pdf",
    ]:
        with open(os.path.join(wd, name), "w") as f:
            f.write(f"content of {name}")

    # Create a subfolder with files
    sub = os.path.join(wd, "Subfolder")
    os.makedirs(sub)
    with open(os.path.join(sub, "Nested Litigation.pdf"), "w") as f:
        f.write("nested content")

    return wd


# ── _resolve_dest_path ──


class TestResolvDestPath:
    def test_dest_is_existing_directory(self, workspace):
        dest_dir = os.path.join(workspace, "Subfolder")
        source = os.path.join(workspace, "Litigation Letter.pdf")
        new_full, new_rel = _resolve_dest_path(dest_dir, "Subfolder", source)
        assert new_full == os.path.join(dest_dir, "Litigation Letter.pdf")
        assert new_rel == os.path.join("Subfolder", "Litigation Letter.pdf")

    def test_dest_is_nonexistent(self, workspace):
        dest = os.path.join(workspace, "NewFolder", "file.pdf")
        source = os.path.join(workspace, "Litigation Letter.pdf")
        new_full, new_rel = _resolve_dest_path(dest, "NewFolder/file.pdf", source)
        # Should not change since dest doesn't exist
        assert new_full == dest
        assert new_rel == "NewFolder/file.pdf"

    def test_dest_is_existing_file(self, workspace):
        dest = os.path.join(workspace, "Board Resolution.pdf")
        source = os.path.join(workspace, "Litigation Letter.pdf")
        new_full, new_rel = _resolve_dest_path(dest, "Board Resolution.pdf", source)
        # Should not change since dest is a file, not dir
        assert new_full == dest
        assert new_rel == "Board Resolution.pdf"


# ── _move_single_item ──


class TestMoveSingleItem:
    def test_move_to_existing_folder(self, workspace):
        result = _move_single_item(workspace, "Litigation Letter.pdf", "Subfolder")
        assert "Moved" in result["message"]
        assert len(result["affected_files"]) == 2
        assert result["action"] is not None
        assert os.path.exists(os.path.join(workspace, "Subfolder", "Litigation Letter.pdf"))
        assert not os.path.exists(os.path.join(workspace, "Litigation Letter.pdf"))

    def test_move_with_full_dest_path(self, workspace):
        result = _move_single_item(workspace, "Litigation Letter.pdf", "Subfolder/Litigation Letter.pdf")
        assert "Moved" in result["message"]
        assert os.path.exists(os.path.join(workspace, "Subfolder", "Litigation Letter.pdf"))

    def test_move_nonexistent_source(self, workspace):
        result = _move_single_item(workspace, "nonexistent.pdf", "Subfolder")
        assert "does not exist" in result["message"]
        assert result["action"] is None

    def test_move_already_exists_in_folder(self, workspace):
        # First move it
        _move_single_item(workspace, "Litigation Letter.pdf", "Subfolder")
        # Create another file with the same name
        with open(os.path.join(workspace, "Litigation Letter.pdf"), "w") as f:
            f.write("new copy")
        # Try moving again — should fail
        result = _move_single_item(workspace, "Litigation Letter.pdf", "Subfolder")
        assert "already exists" in result["message"]


# ── _copy_single_item ──


class TestCopySingleItem:
    def test_copy_to_existing_folder(self, workspace):
        result = _copy_single_item(workspace, "Litigation Letter.pdf", "Subfolder")
        assert "Copied" in result["message"]
        assert len(result["affected_files"]) == 2
        # Original still exists
        assert os.path.exists(os.path.join(workspace, "Litigation Letter.pdf"))
        # Copy exists in subfolder
        assert os.path.exists(os.path.join(workspace, "Subfolder", "Litigation Letter.pdf"))

    def test_copy_nonexistent_source(self, workspace):
        result = _copy_single_item(workspace, "nonexistent.pdf", "Subfolder")
        assert "does not exist" in result["message"]
        assert result["action"] is None


# ── _delete_single_item ──


class TestDeleteSingleItem:
    def test_delete_file(self, workspace):
        result = _delete_single_item(workspace, "Litigation Letter.pdf")
        assert "Deleted" in result["message"]
        assert not os.path.exists(os.path.join(workspace, "Litigation Letter.pdf"))

    def test_delete_folder(self, workspace):
        result = _delete_single_item(workspace, "Subfolder")
        assert "Deleted" in result["message"]
        assert not os.path.exists(os.path.join(workspace, "Subfolder"))

    def test_delete_nonexistent(self, workspace):
        result = _delete_single_item(workspace, "nonexistent.pdf")
        assert "does not exist" in result["message"]
        assert result["action"] is None

    def test_delete_wrong_type(self, workspace):
        result = _delete_single_item(workspace, "Litigation Letter.pdf", "folder")
        assert "is not a folder" in result["message"]


# ── _find_matching_files ──


class TestFindMatchingFiles:
    def test_find_by_substring(self, workspace):
        matches = _find_matching_files(workspace, "litigation")
        assert len(matches) == 3  # 2 in root + 1 in Subfolder (recursive=True by default)
        assert all("litigation" in m.lower() for m in matches)

    def test_find_recursive(self, workspace):
        matches = _find_matching_files(workspace, "litigation", recursive=True)
        assert len(matches) == 3  # 2 in root + 1 in Subfolder

    def test_find_non_recursive(self, workspace):
        matches = _find_matching_files(workspace, "litigation", recursive=False)
        assert len(matches) == 2  # Only root level

    def test_find_no_matches(self, workspace):
        matches = _find_matching_files(workspace, "zzz_nonexistent")
        assert len(matches) == 0

    def test_find_case_insensitive(self, workspace):
        matches = _find_matching_files(workspace, "LITIGATION")
        assert len(matches) >= 2

    def test_find_in_subfolder(self, workspace):
        matches = _find_matching_files(workspace, "litigation", path="Subfolder")
        assert len(matches) == 1
        assert "Nested Litigation.pdf" in matches[0]

    def test_find_nonexistent_path(self, workspace):
        matches = _find_matching_files(workspace, "anything", path="NonexistentFolder")
        assert len(matches) == 0


# ── Batch operations via _run_batch_operation ──


class TestBatchOperations:
    def test_batch_move(self, workspace):
        paths = ["Litigation Letter.pdf", "NX - Litigation Report.pdf"]
        result = _run_batch_operation(workspace, paths, "NewFolder", _move_single_item)
        assert "Completed 2 operation(s)" in result["message"]
        assert len(result["actions"]) >= 2  # 2 moves + possibly 1 folder creation
        assert os.path.exists(os.path.join(workspace, "NewFolder", "Litigation Letter.pdf"))
        assert os.path.exists(os.path.join(workspace, "NewFolder", "NX - Litigation Report.pdf"))

    def test_batch_move_auto_creates_folder(self, workspace):
        result = _run_batch_operation(workspace, ["Litigation Letter.pdf"], "AutoCreated", _move_single_item)
        assert os.path.exists(os.path.join(workspace, "AutoCreated"))
        assert os.path.exists(os.path.join(workspace, "AutoCreated", "Litigation Letter.pdf"))

    def test_batch_with_errors(self, workspace):
        paths = ["Litigation Letter.pdf", "nonexistent.pdf"]
        result = _run_batch_operation(workspace, paths, "Subfolder", _move_single_item)
        assert "1 error(s)" in result["message"]
        assert "Completed 1 operation(s)" in result["message"]

    def test_batch_copy(self, workspace):
        paths = ["Litigation Letter.pdf", "Board Resolution.pdf"]
        result = _run_batch_operation(workspace, paths, "CopyDest", _copy_single_item)
        assert "Completed 2 operation(s)" in result["message"]
        # Originals still exist
        assert os.path.exists(os.path.join(workspace, "Litigation Letter.pdf"))
        assert os.path.exists(os.path.join(workspace, "Board Resolution.pdf"))
        # Copies exist
        assert os.path.exists(os.path.join(workspace, "CopyDest", "Litigation Letter.pdf"))
        assert os.path.exists(os.path.join(workspace, "CopyDest", "Board Resolution.pdf"))


# ── @tool wrappers: move_item ──


class TestMoveItemTool:
    def test_single_source_path(self, workspace):
        result = move_item.invoke({"working_directory": workspace, "source_path": "Annual Report.pdf", "dest_path": "Subfolder"})
        assert "Moved" in result["message"]
        assert result["action"] is not None

    def test_list_source_paths(self, workspace):
        result = move_item.invoke({
            "working_directory": workspace,
            "source_path": ["Litigation Letter.pdf", "NX - Litigation Report.pdf"],
            "dest_path": "LitigationFolder",
        })
        assert "Completed 2 operation(s)" in result["message"]
        assert "actions" in result
        assert len(result["actions"]) >= 2

    def test_name_pattern(self, workspace):
        result = move_item.invoke({
            "working_directory": workspace,
            "name_pattern": "litigation",
            "dest_path": "LitFolder",
        })
        # Should find and move litigation files (recursive by default)
        assert "Completed" in result["message"]
        assert os.path.exists(os.path.join(workspace, "LitFolder"))

    def test_name_pattern_no_matches(self, workspace):
        result = move_item.invoke({
            "working_directory": workspace,
            "name_pattern": "zzz_nothing",
            "dest_path": "Somewhere",
        })
        assert "No files matching" in result["message"]

    def test_no_source_path_or_pattern(self, workspace):
        result = move_item.invoke({
            "working_directory": workspace,
            "dest_path": "Somewhere",
        })
        assert "must be provided" in result["message"]


# ── @tool wrappers: copy_item ──


class TestCopyItemTool:
    def test_single_source_path(self, workspace):
        result = copy_item.invoke({"working_directory": workspace, "source_path": "Annual Report.pdf", "dest_path": "Subfolder"})
        assert "Copied" in result["message"]

    def test_list_source_paths(self, workspace):
        result = copy_item.invoke({
            "working_directory": workspace,
            "source_path": ["Litigation Letter.pdf", "Board Resolution.pdf"],
            "dest_path": "CopyTarget",
        })
        assert "Completed 2 operation(s)" in result["message"]

    def test_name_pattern(self, workspace):
        result = copy_item.invoke({
            "working_directory": workspace,
            "name_pattern": "financial",
            "dest_path": "FinFolder",
        })
        assert "Completed" in result["message"] or "Copied" in result["message"]
        assert os.path.exists(os.path.join(workspace, "FinFolder", "Financial Statement 2024.pdf"))


# ── @tool wrappers: delete_item ──


class TestDeleteItemTool:
    def test_single_path(self, workspace):
        result = delete_item.invoke({"working_directory": workspace, "path": "Annual Report.pdf"})
        assert "Deleted" in result["message"]
        assert not os.path.exists(os.path.join(workspace, "Annual Report.pdf"))

    def test_list_paths(self, workspace):
        result = delete_item.invoke({
            "working_directory": workspace,
            "path": ["Litigation Letter.pdf", "Board Resolution.pdf"],
        })
        assert "Deleted 2 item(s)" in result["message"]
        assert not os.path.exists(os.path.join(workspace, "Litigation Letter.pdf"))
        assert not os.path.exists(os.path.join(workspace, "Board Resolution.pdf"))

    def test_no_path(self, workspace):
        result = delete_item.invoke({"working_directory": workspace})
        assert "must be provided" in result["message"]


# ── @tool wrapper: find_files ──


class TestFindFilesTool:
    def test_find_files(self, workspace):
        result = find_files.invoke({"working_directory": workspace, "name_pattern": "litigation"})
        assert "Litigation Letter.pdf" in result
        assert "Litigation Report.pdf" in result

    def test_find_files_recursive(self, workspace):
        result = find_files.invoke({"working_directory": workspace, "name_pattern": "litigation", "recursive": True})
        assert "Nested Litigation.pdf" in result

    def test_find_files_no_match(self, workspace):
        result = find_files.invoke({"working_directory": workspace, "name_pattern": "zzz_nothing"})
        assert "No files matching" in result


# ── extract_tool_result with multi-action ──


class TestExtractToolResultMultiAction:
    def test_handles_actions_list(self):
        """Verify extract_tool_result can process 'actions' (plural) from batch ops."""
        from tools import extract_tool_result
        from langchain_core.messages import ToolMessage
        import json

        tool_msg = ToolMessage(
            content=json.dumps({
                "message": "Completed 2 operations",
                "affected_files": ["/a/file1.pdf", "/a/file2.pdf"],
                "actions": [
                    {
                        "action_type": "move_file",
                        "item_name": "file1.pdf",
                        "source_path": "/a/file1.pdf",
                        "target_path": "/a/dest/file1.pdf",
                        "new_name": None,
                        "description": "Moved file1.pdf",
                        "id": None,
                        "reverted": False,
                        "revertable": True,
                        "created_at": None,
                    },
                    {
                        "action_type": "move_file",
                        "item_name": "file2.pdf",
                        "source_path": "/a/file2.pdf",
                        "target_path": "/a/dest/file2.pdf",
                        "new_name": None,
                        "description": "Moved file2.pdf",
                        "id": None,
                        "reverted": False,
                        "revertable": True,
                        "created_at": None,
                    },
                ],
            }),
            tool_call_id="test-id",
            name="move_item",
        )

        state = {
            "messages": [tool_msg],
            "analysis_tokens": 0,
            "file_metadata": {},
        }
        result = extract_tool_result(state)

        assert "actions" in result
        assert len(result["actions"]) == 2
        assert result["actions"][0].item_name == "file1.pdf"
        assert result["actions"][1].item_name == "file2.pdf"
        assert len(result["affected_files"]) == 2
