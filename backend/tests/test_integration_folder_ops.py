"""
Integration test: simulates realistic agent workflows against a temp workspace.

Creates a directory with legal-document-style files, then runs through scenarios
that mirror what the LLM would do (single moves, batch moves, name_pattern moves,
find_files, copy, delete, folder dest resolution, etc.).
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from folder_operations import move_item, copy_item, delete_item, find_files, create_item, list_items
from tools import extract_tool_result
from langchain_core.messages import ToolMessage
import json


@pytest.fixture
def legal_workspace(tmp_path):
    """Realistic legal document workspace."""
    wd = str(tmp_path / "extracted_abc123")
    os.makedirs(wd)

    files = [
        "14.06.2023 - Amobee Ltd - BoD Resolution re Bank Signatories - signed.pdf",
        "2025-12-30 Financial Statements FY2024.pdf",
        "2025-12-30 LS-6795 Amobee Ltd - BoD Resolution re FS 2024 - signed.pdf",
        "2026-01-09 BoD Resolution re change of directors.pdf",
        "2026-03-12 Amobee Ltd - ROC Annual Report - filing confirmation.pdf",
        "2026-03-12 Amobee Ltd - ROC Annual Report.pdf",
        "Amobee Israel - Change of Control Letter - 02042024.docx",
        "Amobee Israel - FS 03 2022 V3 - signed.pdf",
        "Amobee Ltd - ROC Annual Report 9-Jan-2025.pdf",
        "Amobee Ltd - ROC annual report 2022 - 17032024.pdf",
        "Amobee Ltd - Shareholder Resolution - Executed.pdf",
        "Amobee No Claims Letter 2024 - Naschitz - December 26 2024.pdf",
        "NX - Litigation Letter (Amobee) - December 30 2025.pdf",
        "Notice of changes in officer authorized to report - 11-Nov-2024.pdf",
        "ROC Extract 14-Dec-2025.pdf",
        "Rejection of application number 39231536 regarding Voluntary merger.pdf",
    ]
    for name in files:
        with open(os.path.join(wd, name), "w") as f:
            f.write(f"content of {name}")

    return wd


class TestScenario1_MoveByNamePattern:
    """
    Scenario: "move litigation files to litigation folder"
    With exact match ON, the LLM should call move_item with name_pattern="litigation".
    This is a single tool call that finds + creates folder + moves all matching files.
    """

    def test_move_litigation_by_pattern(self, legal_workspace):
        wd = legal_workspace

        # Step 1: LLM calls move_item with name_pattern
        # Note: name_pattern matches filename substring only.
        # "Amobee No Claims Letter" does NOT contain "litigation" — only
        # "NX - Litigation Letter" does. This is the correct behavior for exact match.
        result = move_item.invoke({
            "working_directory": wd,
            "name_pattern": "litigation",
            "dest_path": "Litigation",
        })

        # Verify result structure
        assert "Completed" in result["message"]
        assert "actions" in result  # batch returns "actions" list

        # Verify file moved
        lit_dir = os.path.join(wd, "Litigation")
        assert os.path.isdir(lit_dir)
        assert os.path.exists(os.path.join(lit_dir, "NX - Litigation Letter (Amobee) - December 30 2025.pdf"))

        # Verify original removed
        assert not os.path.exists(os.path.join(wd, "NX - Litigation Letter (Amobee) - December 30 2025.pdf"))

        # "No Claims Letter" should NOT be moved (no "litigation" in filename)
        assert os.path.exists(os.path.join(wd, "Amobee No Claims Letter 2024 - Naschitz - December 26 2024.pdf"))

        # Verify other files untouched
        assert os.path.exists(os.path.join(wd, "2025-12-30 Financial Statements FY2024.pdf"))

        # Verify actions are valid for persistence
        for action in result["actions"]:
            assert action["action_type"] in ("move_file", "create_folder")
            assert action["revertable"] is True


class TestScenario2_MoveByExplicitListToExistingFolder:
    """
    Scenario: "move these 3 ROC files to a ROC folder"
    LLM creates the folder first, then calls move_item with a list of paths.
    Tests folder-dest resolution (move into existing folder).
    """

    def test_create_folder_then_batch_move(self, legal_workspace):
        wd = legal_workspace

        # Step 1: LLM creates folder
        create_result = create_item.invoke({
            "working_directory": wd,
            "name": "ROC",
            "item_type": "folder",
        })
        assert "Created folder" in create_result["message"]

        # Step 2: LLM calls move_item with list of paths and existing folder as dest
        roc_files = [
            "2026-03-12 Amobee Ltd - ROC Annual Report - filing confirmation.pdf",
            "2026-03-12 Amobee Ltd - ROC Annual Report.pdf",
            "Amobee Ltd - ROC Annual Report 9-Jan-2025.pdf",
            "Amobee Ltd - ROC annual report 2022 - 17032024.pdf",
            "ROC Extract 14-Dec-2025.pdf",
        ]
        result = move_item.invoke({
            "working_directory": wd,
            "source_path": roc_files,
            "dest_path": "ROC",  # existing folder — should move INTO it
        })

        assert "Completed 5 operation(s)" in result["message"]
        assert len(result["actions"]) == 5

        # Verify all files in ROC folder
        roc_dir = os.path.join(wd, "ROC")
        for f in roc_files:
            assert os.path.exists(os.path.join(roc_dir, f)), f"Missing: {f}"
            assert not os.path.exists(os.path.join(wd, f)), f"Original not removed: {f}"


class TestScenario3_SingleMoveToExistingFolder:
    """
    Scenario: LLM calls move_item("file.pdf", "ExistingFolder")
    Previously this returned "already exists" error. Now it should move the file INTO the folder.
    This is the exact bug from the original console output.
    """

    def test_single_move_to_existing_folder(self, legal_workspace):
        wd = legal_workspace

        # Create dest folder
        os.makedirs(os.path.join(wd, "Litigation"))

        # Move single file with folder as dest — this used to fail!
        result = move_item.invoke({
            "working_directory": wd,
            "source_path": "NX - Litigation Letter (Amobee) - December 30 2025.pdf",
            "dest_path": "Litigation",
        })

        assert "Moved" in result["message"]
        assert result["action"] is not None
        assert os.path.exists(os.path.join(wd, "Litigation", "NX - Litigation Letter (Amobee) - December 30 2025.pdf"))


class TestScenario4_FindThenBatchMove:
    """
    Scenario: Exact match OFF. LLM first calls find_files, then batch move_item.
    Two tool calls instead of scanning the full listing manually.
    """

    def test_find_then_move(self, legal_workspace):
        wd = legal_workspace

        # Step 1: LLM calls find_files
        found = find_files.invoke({
            "working_directory": wd,
            "name_pattern": "BoD Resolution",
        })
        assert "BoD Resolution" in found

        # Parse filenames from result (simulating what LLM would do)
        file_paths = []
        for line in found.strip().split("\n"):
            # Each line is like "📄 filename.pdf"
            name = line.replace("📄 ", "").strip()
            if name:
                file_paths.append(name)

        assert len(file_paths) == 3  # 3 BoD Resolution files

        # Step 2: LLM calls batch move
        result = move_item.invoke({
            "working_directory": wd,
            "source_path": file_paths,
            "dest_path": "Board Resolutions",
        })

        assert "Completed 3 operation(s)" in result["message"]
        br_dir = os.path.join(wd, "Board Resolutions")
        assert os.path.isdir(br_dir)
        assert len(os.listdir(br_dir)) == 3


class TestScenario5_CopyByPattern:
    """
    Scenario: "copy all financial files to a backup folder"
    """

    def test_copy_by_name_pattern(self, legal_workspace):
        wd = legal_workspace

        result = copy_item.invoke({
            "working_directory": wd,
            "name_pattern": "financial",
            "dest_path": "Financial Backup",
        })

        # Should find "2025-12-30 Financial Statements FY2024.pdf"
        assert result["affected_files"]
        backup_dir = os.path.join(wd, "Financial Backup")
        assert os.path.isdir(backup_dir)
        assert os.path.exists(os.path.join(backup_dir, "2025-12-30 Financial Statements FY2024.pdf"))
        # Original still exists
        assert os.path.exists(os.path.join(wd, "2025-12-30 Financial Statements FY2024.pdf"))


class TestScenario6_BatchDelete:
    """
    Scenario: "delete these 3 files"
    """

    def test_batch_delete(self, legal_workspace):
        wd = legal_workspace

        to_delete = [
            "Amobee Israel - Change of Control Letter - 02042024.docx",
            "Notice of changes in officer authorized to report - 11-Nov-2024.pdf",
        ]
        result = delete_item.invoke({
            "working_directory": wd,
            "path": to_delete,
        })

        assert "Deleted 2 item(s)" in result["message"]
        for f in to_delete:
            assert not os.path.exists(os.path.join(wd, f))

        # Other files untouched
        assert os.path.exists(os.path.join(wd, "2025-12-30 Financial Statements FY2024.pdf"))


class TestScenario7_ExtractToolResultIntegration:
    """
    Tests that extract_tool_result correctly processes batch tool responses
    as they would appear in the LangGraph message stream.
    """

    def test_batch_move_result_extraction(self, legal_workspace):
        wd = legal_workspace

        # Simulate: LLM calls move_item with name_pattern, tool returns batch result
        tool_result = move_item.invoke({
            "working_directory": wd,
            "name_pattern": "litigation",
            "dest_path": "Litigation",
        })

        # Wrap in ToolMessage like LangGraph would
        tool_msg = ToolMessage(
            content=json.dumps(tool_result),
            tool_call_id="test-call-1",
            name="move_item",
        )

        state = {
            "messages": [tool_msg],
            "analysis_tokens": 0,
            "file_metadata": {},
        }
        extracted = extract_tool_result(state)

        # Should have extracted actions and affected_files
        assert "actions" in extracted
        assert len(extracted["actions"]) >= 2  # at least 2 moves + 1 folder create
        assert "affected_files" in extracted
        assert len(extracted["affected_files"]) >= 2

        # Actions should be ActionInfo objects
        for action in extracted["actions"]:
            assert hasattr(action, "action_type")
            assert hasattr(action, "item_name")


class TestScenario8_FullOrganizationWorkflow:
    """
    End-to-end: organize files into multiple folders using different methods.
    Simulates what a user session would look like with several chat messages.
    """

    def test_full_workflow(self, legal_workspace):
        wd = legal_workspace
        initial_count = len(os.listdir(wd))

        # Message 1: "move litigation files to Litigation folder" (exact match)
        r1 = move_item.invoke({
            "working_directory": wd,
            "name_pattern": "litigation",
            "dest_path": "Litigation",
        })
        assert "Completed" in r1["message"]

        # Message 2: "move all ROC files to ROC folder" (exact match)
        r2 = move_item.invoke({
            "working_directory": wd,
            "name_pattern": "ROC",
            "dest_path": "ROC",
        })
        assert "Completed" in r2["message"]

        # Message 3: "move BoD Resolution files to Board Resolutions" (batch list)
        bod_found = find_files.invoke({
            "working_directory": wd,
            "name_pattern": "BoD Resolution",
        })
        bod_paths = [line.replace("📄 ", "").strip() for line in bod_found.strip().split("\n") if line.strip()]
        r3 = move_item.invoke({
            "working_directory": wd,
            "source_path": bod_paths,
            "dest_path": "Board Resolutions",
        })
        assert "Completed" in r3["message"]

        # Message 4: "copy financial statements to backup" (pattern copy)
        r4 = copy_item.invoke({
            "working_directory": wd,
            "name_pattern": "financial",
            "dest_path": "Backup",
        })
        assert r4["affected_files"]

        # Message 5: "delete the rejection letter"
        r5 = delete_item.invoke({
            "working_directory": wd,
            "path": "Rejection of application number 39231536 regarding Voluntary merger.pdf",
        })
        assert "Deleted" in r5["message"]

        # Verify final state
        remaining_root_files = [f for f in os.listdir(wd) if os.path.isfile(os.path.join(wd, f))]
        created_folders = [f for f in os.listdir(wd) if os.path.isdir(os.path.join(wd, f))]

        # Should have created organized folders
        assert "Litigation" in created_folders
        assert "ROC" in created_folders
        assert "Board Resolutions" in created_folders
        assert "Backup" in created_folders

        # Litigation folder should have 1 file (only "NX - Litigation Letter" matches "litigation")
        assert len(os.listdir(os.path.join(wd, "Litigation"))) == 1

        # ROC folder should have files with ROC in the name
        roc_files = os.listdir(os.path.join(wd, "ROC"))
        assert all("roc" in f.lower() for f in roc_files)

        # Rejection file should be gone
        assert not os.path.exists(os.path.join(wd, "Rejection of application number 39231536 regarding Voluntary merger.pdf"))

        # Financial statement original should still exist (was copied, not moved)
        assert os.path.exists(os.path.join(wd, "2025-12-30 Financial Statements FY2024.pdf"))

        print(f"\nFinal workspace state:")
        print(f"  Root files remaining: {len(remaining_root_files)}")
        print(f"  Folders created: {created_folders}")
        for folder in created_folders:
            folder_path = os.path.join(wd, folder)
            contents = os.listdir(folder_path)
            print(f"  {folder}/ ({len(contents)} items): {contents}")
