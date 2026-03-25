"""Tests for the file registry system — stable file IDs across moves/renames.

Tests cover:
- Database CRUD for file_registry table
- FileRegistry high-level operations (scan, move, rename, copy, create, delete)
- Annotated tree building
- Action processing
- Edge cases (duplicates, folder moves with children, reconciliation)
"""

import os
import sys
import tempfile
import shutil
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Database
from file_registry import FileRegistry


@pytest.fixture
def db():
    """Create a temporary database for each test."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    database = Database(db_path)
    yield database
    database.conn.close()
    os.unlink(db_path)


@pytest.fixture
def registry(db):
    """Create a FileRegistry backed by a temp database."""
    return FileRegistry(db)


@pytest.fixture
def workspace():
    """Create a temporary workspace directory with sample files."""
    tmpdir = tempfile.mkdtemp()
    # Create structure:
    # workspace/
    #   file1.txt
    #   file2.pdf
    #   subfolder/
    #     file3.txt
    #     deep/
    #       file4.doc
    with open(os.path.join(tmpdir, "file1.txt"), "w") as f:
        f.write("content1")
    with open(os.path.join(tmpdir, "file2.pdf"), "w") as f:
        f.write("content2")
    sub = os.path.join(tmpdir, "subfolder")
    os.makedirs(sub)
    with open(os.path.join(sub, "file3.txt"), "w") as f:
        f.write("content3")
    deep = os.path.join(sub, "deep")
    os.makedirs(deep)
    with open(os.path.join(deep, "file4.doc"), "w") as f:
        f.write("content4")
    yield tmpdir
    shutil.rmtree(tmpdir)


SESSION_ID = "test-session-1"


# ─── Database-level tests ───


class TestDatabaseFileRegistry:
    def test_register_file_returns_uuid(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        file_id = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        assert file_id is not None
        assert len(file_id) == 36  # UUID format

    def test_register_same_file_returns_same_id(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        id1 = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        id2 = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        assert id1 == id2

    def test_register_different_files_returns_different_ids(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        id1 = db.register_file(SESSION_ID, "/tmp/work/a.txt", "file")
        id2 = db.register_file(SESSION_ID, "/tmp/work/b.txt", "file")
        assert id1 != id2

    def test_get_id_by_path(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        expected = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        actual = db.get_id_by_path(SESSION_ID, "/tmp/work/file.txt")
        assert actual == expected

    def test_get_id_by_path_not_found(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        assert db.get_id_by_path(SESSION_ID, "/tmp/work/nope.txt") is None

    def test_get_path_by_id(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        file_id = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        path = db.get_path_by_id(SESSION_ID, file_id)
        assert path == "/tmp/work/file.txt"

    def test_update_file_path(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        file_id = db.register_file(SESSION_ID, "/tmp/work/old.txt", "file")
        db.update_file_path(SESSION_ID, file_id, "/tmp/work/new.txt")
        assert db.get_path_by_id(SESSION_ID, file_id) == "/tmp/work/new.txt"
        assert db.get_id_by_path(SESSION_ID, "/tmp/work/old.txt") is None
        assert db.get_id_by_path(SESSION_ID, "/tmp/work/new.txt") == file_id

    def test_update_file_paths_by_prefix(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        id1 = db.register_file(SESSION_ID, "/tmp/work/folder/a.txt", "file")
        id2 = db.register_file(SESSION_ID, "/tmp/work/folder/b.txt", "file")
        id3 = db.register_file(SESSION_ID, "/tmp/work/other/c.txt", "file")

        count = db.update_file_paths_by_prefix(
            SESSION_ID, "/tmp/work/folder/", "/tmp/work/renamed/"
        )
        assert count == 2
        assert db.get_path_by_id(SESSION_ID, id1) == "/tmp/work/renamed/a.txt"
        assert db.get_path_by_id(SESSION_ID, id2) == "/tmp/work/renamed/b.txt"
        assert db.get_path_by_id(SESSION_ID, id3) == "/tmp/work/other/c.txt"

    def test_mark_file_deleted(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        file_id = db.register_file(SESSION_ID, "/tmp/work/file.txt", "file")
        assert db.mark_file_deleted(SESSION_ID, "/tmp/work/file.txt")
        # Should no longer be found
        assert db.get_id_by_path(SESSION_ID, "/tmp/work/file.txt") is None
        assert db.get_path_by_id(SESSION_ID, file_id) is None

    def test_mark_deleted_nonexistent(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        assert not db.mark_file_deleted(SESSION_ID, "/tmp/work/nope.txt")

    def test_bulk_register(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        items = [
            ("/tmp/work/a.txt", "file"),
            ("/tmp/work/b.txt", "file"),
            ("/tmp/work/sub", "folder"),
        ]
        result = db.bulk_register(SESSION_ID, items)
        assert len(result) == 3
        assert all(len(v) == 36 for v in result.values())

    def test_bulk_register_preserves_existing_ids(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        existing_id = db.register_file(SESSION_ID, "/tmp/work/a.txt", "file")
        items = [
            ("/tmp/work/a.txt", "file"),
            ("/tmp/work/b.txt", "file"),
        ]
        result = db.bulk_register(SESSION_ID, items)
        assert result["/tmp/work/a.txt"] == existing_id
        assert result["/tmp/work/b.txt"] != existing_id

    def test_get_file_registry(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        db.register_file(SESSION_ID, "/tmp/work/a.txt", "file")
        db.register_file(SESSION_ID, "/tmp/work/b.txt", "file")
        entries = db.get_file_registry(SESSION_ID)
        assert len(entries) == 2
        assert all("id" in e and "file_path" in e and "item_type" in e for e in entries)

    def test_get_file_id_map(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        id1 = db.register_file(SESSION_ID, "/tmp/work/a.txt", "file")
        id2 = db.register_file(SESSION_ID, "/tmp/work/b.txt", "file")
        id_map = db.get_file_id_map(SESSION_ID)
        assert id_map == {"/tmp/work/a.txt": id1, "/tmp/work/b.txt": id2}

    def test_reconcile_registry(self, db):
        db.create_session(SESSION_ID, "/tmp/work")
        id1 = db.register_file(SESSION_ID, "/tmp/work/keep.txt", "file")
        db.register_file(SESSION_ID, "/tmp/work/remove.txt", "file")
        live_paths = {"/tmp/work/keep.txt"}
        result = db.reconcile_registry(SESSION_ID, live_paths)
        assert "/tmp/work/keep.txt" in result
        assert "/tmp/work/remove.txt" not in result
        # Removed file should be soft-deleted
        assert db.get_id_by_path(SESSION_ID, "/tmp/work/remove.txt") is None

    def test_session_isolation(self, db):
        """Files registered under different sessions don't interfere."""
        db.create_session("sess-a", "/tmp/a")
        db.create_session("sess-b", "/tmp/b")
        id_a = db.register_file("sess-a", "/tmp/shared/file.txt", "file")
        id_b = db.register_file("sess-b", "/tmp/shared/file.txt", "file")
        assert id_a != id_b
        assert db.get_id_by_path("sess-a", "/tmp/shared/file.txt") == id_a
        assert db.get_id_by_path("sess-b", "/tmp/shared/file.txt") == id_b


# ─── FileRegistry high-level tests ───


class TestFileRegistryScanAndRegister:
    def test_scan_registers_all_files(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        result = registry.scan_and_register(SESSION_ID, workspace)
        # workspace itself + subfolder + deep + 4 files = 7
        assert len(result) >= 7
        # Check specific files
        assert os.path.join(workspace, "file1.txt") in result
        assert os.path.join(workspace, "subfolder", "file3.txt") in result
        assert os.path.join(workspace, "subfolder", "deep", "file4.doc") in result

    def test_scan_is_idempotent(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        result1 = registry.scan_and_register(SESSION_ID, workspace)
        result2 = registry.scan_and_register(SESSION_ID, workspace)
        assert result1 == result2

    def test_scan_detects_deleted_files(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)
        file_path = os.path.join(workspace, "file1.txt")
        file_id = db.get_id_by_path(SESSION_ID, file_path)
        assert file_id is not None

        # Delete file from disk
        os.unlink(file_path)
        registry.scan_and_register(SESSION_ID, workspace)

        # Should be soft-deleted
        assert db.get_id_by_path(SESSION_ID, file_path) is None

    def test_scan_registers_new_files(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        # Add a new file
        new_file = os.path.join(workspace, "new_file.txt")
        with open(new_file, "w") as f:
            f.write("new")

        result = registry.scan_and_register(SESSION_ID, workspace)
        assert new_file in result


class TestFileRegistryMove:
    def test_move_file_preserves_id(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(workspace, "subfolder", "file1.txt")
        original_id = db.get_id_by_path(SESSION_ID, old_path)

        # Actually move the file
        shutil.move(old_path, new_path)
        returned_id = registry.handle_move(SESSION_ID, old_path, new_path)

        assert returned_id == original_id
        assert db.get_id_by_path(SESSION_ID, new_path) == original_id
        assert db.get_id_by_path(SESSION_ID, old_path) is None

    def test_move_folder_updates_children(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        old_folder = os.path.join(workspace, "subfolder")
        new_folder = os.path.join(workspace, "renamed_folder")
        child_old = os.path.join(workspace, "subfolder", "file3.txt")
        deep_old = os.path.join(workspace, "subfolder", "deep", "file4.doc")
        child_id = db.get_id_by_path(SESSION_ID, child_old)
        deep_id = db.get_id_by_path(SESSION_ID, deep_old)

        # Actually move the folder
        shutil.move(old_folder, new_folder)
        registry.handle_move(SESSION_ID, old_folder, new_folder)

        # Children should have updated paths but same IDs
        child_new = os.path.join(workspace, "renamed_folder", "file3.txt")
        deep_new = os.path.join(workspace, "renamed_folder", "deep", "file4.doc")
        assert db.get_id_by_path(SESSION_ID, child_new) == child_id
        assert db.get_id_by_path(SESSION_ID, deep_new) == deep_id

    def test_move_unregistered_file(self, db, registry, workspace):
        """Moving a file not in the registry should register it at the new path."""
        db.create_session(SESSION_ID, workspace)
        new_path = os.path.join(workspace, "file1.txt")
        file_id = registry.handle_move(SESSION_ID, "/tmp/nonexistent", new_path)
        assert file_id is not None
        assert db.get_id_by_path(SESSION_ID, new_path) == file_id


class TestFileRegistryRename:
    def test_rename_preserves_id(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(workspace, "renamed.txt")
        original_id = db.get_id_by_path(SESSION_ID, old_path)

        os.rename(old_path, new_path)
        returned_id = registry.handle_rename(SESSION_ID, old_path, new_path)

        assert returned_id == original_id
        assert db.get_id_by_path(SESSION_ID, new_path) == original_id


class TestFileRegistryCopy:
    def test_copy_gets_new_id(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        source = os.path.join(workspace, "file1.txt")
        dest = os.path.join(workspace, "file1_copy.txt")
        source_id = db.get_id_by_path(SESSION_ID, source)

        shutil.copy2(source, dest)
        copy_id = registry.handle_copy(SESSION_ID, source, dest)

        assert copy_id != source_id
        assert db.get_id_by_path(SESSION_ID, source) == source_id
        assert db.get_id_by_path(SESSION_ID, dest) == copy_id


class TestFileRegistryCreateDelete:
    def test_create_registers_new_file(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        new_path = os.path.join(workspace, "brand_new.txt")
        with open(new_path, "w") as f:
            f.write("new")

        file_id = registry.handle_create(SESSION_ID, new_path, "file")
        assert file_id is not None
        assert db.get_id_by_path(SESSION_ID, new_path) == file_id

    def test_delete_soft_deletes(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        file_path = os.path.join(workspace, "file1.txt")
        assert db.get_id_by_path(SESSION_ID, file_path) is not None

        registry.handle_delete(SESSION_ID, file_path)
        assert db.get_id_by_path(SESSION_ID, file_path) is None


# ─── Annotated tree tests ───


class TestBuildAnnotatedTree:
    def test_tree_has_stable_ids(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        tree = registry.build_annotated_tree(SESSION_ID, workspace)

        assert tree["type"] == "folder"
        assert tree["id"] is not None
        assert len(tree["id"]) == 36

        # Check children have IDs
        for child in tree["children"]:
            assert "id" in child
            assert len(child["id"]) == 36

    def test_tree_ids_are_stable_across_calls(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        tree1 = registry.build_annotated_tree(SESSION_ID, workspace)
        tree2 = registry.build_annotated_tree(SESSION_ID, workspace)

        def get_ids(node):
            ids = {node["name"]: node["id"]}
            for child in node.get("children", []):
                ids.update(get_ids(child))
            return ids

        ids1 = get_ids(tree1)
        ids2 = get_ids(tree2)
        assert ids1 == ids2

    def test_tree_structure_matches_filesystem(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        tree = registry.build_annotated_tree(SESSION_ID, workspace)

        child_names = {c["name"] for c in tree["children"]}
        assert "file1.txt" in child_names
        assert "file2.pdf" in child_names
        assert "subfolder" in child_names

        # Find subfolder
        subfolder = next(c for c in tree["children"] if c["name"] == "subfolder")
        sub_child_names = {c["name"] for c in subfolder["children"]}
        assert "file3.txt" in sub_child_names
        assert "deep" in sub_child_names

    def test_tree_files_have_extensions(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        tree = registry.build_annotated_tree(SESSION_ID, workspace)

        file1 = next(c for c in tree["children"] if c["name"] == "file1.txt")
        assert file1["extension"] == "txt"
        file2 = next(c for c in tree["children"] if c["name"] == "file2.pdf")
        assert file2["extension"] == "pdf"

    def test_tree_files_have_metadata(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        tree = registry.build_annotated_tree(SESSION_ID, workspace)

        file1 = next(c for c in tree["children"] if c["name"] == "file1.txt")
        assert "metadata" in file1
        assert "size" in file1["metadata"]
        assert "lastModified" in file1["metadata"]

    def test_tree_after_move_has_same_id(self, db, registry, workspace):
        """After moving a file, the tree should show the file at its new location with the same ID."""
        db.create_session(SESSION_ID, workspace)
        tree_before = registry.build_annotated_tree(SESSION_ID, workspace)

        file1 = next(c for c in tree_before["children"] if c["name"] == "file1.txt")
        original_id = file1["id"]

        # Move file
        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(workspace, "subfolder", "file1.txt")
        shutil.move(old_path, new_path)
        registry.handle_move(SESSION_ID, old_path, new_path)

        tree_after = registry.build_annotated_tree(SESSION_ID, workspace)
        # file1.txt should no longer be at root
        root_names = {c["name"] for c in tree_after["children"]}
        assert "file1.txt" not in root_names

        # Should be in subfolder with same ID
        subfolder = next(c for c in tree_after["children"] if c["name"] == "subfolder")
        moved_file = next(c for c in subfolder["children"] if c["name"] == "file1.txt")
        assert moved_file["id"] == original_id


# ─── Action processing tests ───


class TestProcessActions:
    def test_process_move_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(workspace, "subfolder", "file1.txt")
        original_id = db.get_id_by_path(SESSION_ID, old_path)

        shutil.move(old_path, new_path)
        actions = [{
            "action_type": "move_file",
            "item_name": "file1.txt",
            "source_path": old_path,
            "target_path": new_path,
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        assert db.get_id_by_path(SESSION_ID, new_path) == original_id

    def test_process_rename_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(workspace, "renamed.txt")
        original_id = db.get_id_by_path(SESSION_ID, old_path)

        os.rename(old_path, new_path)
        actions = [{
            "action_type": "rename_file",
            "item_name": "file1.txt",
            "source_path": old_path,
            "target_path": None,
            "new_name": "renamed.txt",
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        assert db.get_id_by_path(SESSION_ID, new_path) == original_id

    def test_process_copy_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        source = os.path.join(workspace, "file1.txt")
        dest = os.path.join(workspace, "file1_copy.txt")
        source_id = db.get_id_by_path(SESSION_ID, source)

        shutil.copy2(source, dest)
        actions = [{
            "action_type": "copy_file",
            "item_name": "file1.txt",
            "source_path": source,
            "target_path": dest,
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        copy_id = db.get_id_by_path(SESSION_ID, dest)
        assert copy_id is not None
        assert copy_id != source_id

    def test_process_create_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)

        new_file = os.path.join(workspace, "created.txt")
        with open(new_file, "w") as f:
            f.write("created")

        actions = [{
            "action_type": "create_file",
            "item_name": "created.txt",
            "source_path": None,
            "target_path": workspace,
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        file_id = db.get_id_by_path(SESSION_ID, new_file)
        assert file_id is not None

    def test_process_delete_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        file_path = os.path.join(workspace, "file1.txt")
        assert db.get_id_by_path(SESSION_ID, file_path) is not None

        os.unlink(file_path)
        actions = [{
            "action_type": "delete_file",
            "item_name": "file1.txt",
            "source_path": file_path,
            "target_path": None,
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        assert db.get_id_by_path(SESSION_ID, file_path) is None

    def test_process_create_folder_action(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)

        new_folder = os.path.join(workspace, "new_folder")
        os.makedirs(new_folder)

        actions = [{
            "action_type": "create_folder",
            "item_name": "new_folder",
            "source_path": None,
            "target_path": workspace,
        }]
        registry.process_actions(SESSION_ID, actions, workspace)

        folder_id = db.get_id_by_path(SESSION_ID, new_folder)
        assert folder_id is not None

    def test_process_multiple_actions(self, db, registry, workspace):
        """Process a batch of mixed actions."""
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        # Create a new folder, then move a file into it
        new_folder = os.path.join(workspace, "organized")
        os.makedirs(new_folder)

        old_path = os.path.join(workspace, "file1.txt")
        new_path = os.path.join(new_folder, "file1.txt")
        original_id = db.get_id_by_path(SESSION_ID, old_path)
        shutil.move(old_path, new_path)

        actions = [
            {
                "action_type": "create_folder",
                "item_name": "organized",
                "source_path": None,
                "target_path": workspace,
            },
            {
                "action_type": "move_file",
                "item_name": "file1.txt",
                "source_path": old_path,
                "target_path": new_path,
            },
        ]
        registry.process_actions(SESSION_ID, actions, workspace)

        assert db.get_id_by_path(SESSION_ID, new_folder) is not None
        assert db.get_id_by_path(SESSION_ID, new_path) == original_id


# ─── Integration: metadata keyed by file ID ───


class TestMetadataWithFileId:
    def test_metadata_survives_move_via_file_id(self, db, registry, workspace):
        """Metadata stored by file ID should be retrievable after a file move."""
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        file_path = os.path.join(workspace, "file1.txt")
        file_id = db.get_id_by_path(SESSION_ID, file_path)

        # Store metadata by file ID
        db.save_file_metadata(SESSION_ID, file_id, {"category": "Legal", "title": "Contract"})

        # Move the file
        new_path = os.path.join(workspace, "subfolder", "file1.txt")
        shutil.move(file_path, new_path)
        registry.handle_move(SESSION_ID, file_path, new_path)

        # File ID should be the same
        assert db.get_id_by_path(SESSION_ID, new_path) == file_id

        # Metadata should still be retrievable by the same file ID
        meta = db.get_file_metadata(SESSION_ID, file_id)
        assert meta == {"category": "Legal", "title": "Contract"}

    def test_metadata_survives_rename_via_file_id(self, db, registry, workspace):
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        file_path = os.path.join(workspace, "file1.txt")
        file_id = db.get_id_by_path(SESSION_ID, file_path)

        db.save_file_metadata(SESSION_ID, file_id, {"category": "Financial"})

        new_path = os.path.join(workspace, "renamed.txt")
        os.rename(file_path, new_path)
        registry.handle_rename(SESSION_ID, file_path, new_path)

        meta = db.get_file_metadata(SESSION_ID, file_id)
        assert meta == {"category": "Financial"}


# ─── Edge cases ───


class TestEdgeCases:
    def test_empty_directory(self, db, registry):
        db.create_session(SESSION_ID, "/tmp/empty_test")
        tmpdir = tempfile.mkdtemp()
        try:
            result = registry.scan_and_register(SESSION_ID, tmpdir)
            # Only the root directory itself
            assert tmpdir in result
            assert len(result) == 1
        finally:
            shutil.rmtree(tmpdir)

    def test_deeply_nested_files(self, db, registry):
        db.create_session(SESSION_ID, "/tmp/deep_test")
        tmpdir = tempfile.mkdtemp()
        try:
            # Create 5 levels deep
            deep_path = tmpdir
            for i in range(5):
                deep_path = os.path.join(deep_path, f"level{i}")
                os.makedirs(deep_path, exist_ok=True)
            with open(os.path.join(deep_path, "deep_file.txt"), "w") as f:
                f.write("deep")

            result = registry.scan_and_register(SESSION_ID, tmpdir)
            deep_file = os.path.join(deep_path, "deep_file.txt")
            assert deep_file in result
        finally:
            shutil.rmtree(tmpdir)

    def test_same_filename_different_folders(self, db, registry, workspace):
        """Files with same name in different folders get different IDs."""
        db.create_session(SESSION_ID, workspace)
        # Create same-named file in subfolder
        dup_path = os.path.join(workspace, "subfolder", "file1.txt")
        with open(dup_path, "w") as f:
            f.write("duplicate name")

        registry.scan_and_register(SESSION_ID, workspace)

        id_root = db.get_id_by_path(SESSION_ID, os.path.join(workspace, "file1.txt"))
        id_sub = db.get_id_by_path(SESSION_ID, dup_path)
        assert id_root != id_sub

    def test_re_register_after_soft_delete(self, db, registry, workspace):
        """A file that was deleted and recreated gets a new ID."""
        db.create_session(SESSION_ID, workspace)
        registry.scan_and_register(SESSION_ID, workspace)

        file_path = os.path.join(workspace, "file1.txt")
        original_id = db.get_id_by_path(SESSION_ID, file_path)

        # Delete and soft-delete in registry
        os.unlink(file_path)
        registry.handle_delete(SESSION_ID, file_path)

        # Recreate the file
        with open(file_path, "w") as f:
            f.write("new content")

        new_id = registry.handle_create(SESSION_ID, file_path, "file")
        assert new_id != original_id
