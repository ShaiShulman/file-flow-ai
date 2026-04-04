import os
import sys
import tempfile
import shutil
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from revert_validators import (
    validate_move,
    validate_copy,
    validate_rename,
    validate_create,
    validate_delete,
    validate_modify,
    validate_revert,
)
from revert import check_revert_action, revert_action


@pytest.fixture
def workspace():
    """Create a temporary workspace directory for each test."""
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)


# ── Move validation ──


class TestValidateMove:
    def test_happy_path(self, workspace):
        """Move can be reverted when target exists and source location is free."""
        target = os.path.join(workspace, "dest", "report.pdf")
        source = os.path.join(workspace, "origin", "report.pdf")
        os.makedirs(os.path.join(workspace, "dest"))
        os.makedirs(os.path.join(workspace, "origin"))
        with open(target, "w") as f:
            f.write("content")

        action = {"action_type": "move_file", "item_name": "report.pdf",
                  "source_path": source, "target_path": target}
        result = validate_move(action)
        assert result["can_revert"] is True
        assert result["warnings"] == []

    def test_missing_paths(self):
        result = validate_move({"action_type": "move_file", "item_name": "x"})
        assert result["can_revert"] is False
        assert "Missing" in result["message"]

    def test_target_deleted(self, workspace):
        """Cannot revert if the moved item no longer exists at target."""
        source = os.path.join(workspace, "origin", "file.txt")
        target = os.path.join(workspace, "dest", "file.txt")
        os.makedirs(os.path.join(workspace, "origin"))
        # target does NOT exist

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = validate_move(action)
        assert result["can_revert"] is False
        assert "no longer exists" in result["message"]

    def test_source_parent_deleted(self, workspace):
        """Cannot revert if original parent directory was deleted."""
        target = os.path.join(workspace, "dest", "file.txt")
        source = os.path.join(workspace, "deleted_parent", "file.txt")
        os.makedirs(os.path.join(workspace, "dest"))
        with open(target, "w") as f:
            f.write("content")
        # source parent does NOT exist

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = validate_move(action)
        assert result["can_revert"] is False
        assert "parent directory" in result["message"]

    def test_collision_at_source(self, workspace):
        """Cannot revert if something already exists at the original source path."""
        target = os.path.join(workspace, "dest", "file.txt")
        source = os.path.join(workspace, "origin", "file.txt")
        os.makedirs(os.path.join(workspace, "dest"))
        os.makedirs(os.path.join(workspace, "origin"))
        with open(target, "w") as f:
            f.write("moved")
        with open(source, "w") as f:
            f.write("collision")

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = validate_move(action)
        assert result["can_revert"] is False
        assert "already exists" in result["message"]

    def test_folder_move(self, workspace):
        target = os.path.join(workspace, "dest", "myfolder")
        source = os.path.join(workspace, "origin", "myfolder")
        os.makedirs(target)
        os.makedirs(os.path.join(workspace, "origin"))

        action = {"action_type": "move_folder", "item_name": "myfolder",
                  "source_path": source, "target_path": target}
        result = validate_move(action)
        assert result["can_revert"] is True
        assert "folder" not in result.get("message", "").lower() or "Ready" in result["message"]


# ── Copy validation ──


class TestValidateCopy:
    def test_happy_path_file(self, workspace):
        target = os.path.join(workspace, "copy.txt")
        with open(target, "w") as f:
            f.write("copied")

        action = {"action_type": "copy_file", "item_name": "copy.txt", "target_path": target}
        result = validate_copy(action)
        assert result["can_revert"] is True
        assert result["warnings"] == []

    def test_missing_target_path(self):
        result = validate_copy({"action_type": "copy_file", "item_name": "x"})
        assert result["can_revert"] is False
        assert "Missing" in result["message"]

    def test_target_deleted(self, workspace):
        target = os.path.join(workspace, "gone.txt")
        action = {"action_type": "copy_file", "item_name": "gone.txt", "target_path": target}
        result = validate_copy(action)
        assert result["can_revert"] is False
        assert "no longer exists" in result["message"]

    def test_folder_with_contents_warning(self, workspace):
        target = os.path.join(workspace, "copied_folder")
        os.makedirs(target)
        with open(os.path.join(target, "a.txt"), "w") as f:
            f.write("a")
        with open(os.path.join(target, "b.txt"), "w") as f:
            f.write("b")

        action = {"action_type": "copy_folder", "item_name": "copied_folder", "target_path": target}
        result = validate_copy(action)
        assert result["can_revert"] is True
        assert len(result["warnings"]) == 1
        assert "2 items" in result["warnings"][0]

    def test_empty_folder_no_warning(self, workspace):
        target = os.path.join(workspace, "empty_folder")
        os.makedirs(target)

        action = {"action_type": "copy_folder", "item_name": "empty_folder", "target_path": target}
        result = validate_copy(action)
        assert result["can_revert"] is True
        assert result["warnings"] == []


# ── Rename validation ──


class TestValidateRename:
    def test_happy_path(self, workspace):
        current = os.path.join(workspace, "new_name.txt")
        source = os.path.join(workspace, "old_name.txt")
        with open(current, "w") as f:
            f.write("content")

        action = {"action_type": "rename_file", "item_name": "old_name.txt",
                  "source_path": source, "new_name": "new_name.txt"}
        result = validate_rename(action)
        assert result["can_revert"] is True

    def test_missing_fields(self):
        result = validate_rename({"action_type": "rename_file", "item_name": "x"})
        assert result["can_revert"] is False
        assert "Missing" in result["message"]

    def test_parent_dir_deleted(self, workspace):
        source = os.path.join(workspace, "gone_dir", "old.txt")
        action = {"action_type": "rename_file", "item_name": "old.txt",
                  "source_path": source, "new_name": "new.txt"}
        result = validate_rename(action)
        assert result["can_revert"] is False
        assert "Parent directory" in result["message"]

    def test_renamed_item_moved_away(self, workspace):
        """Current path doesn't exist — item was moved or renamed again."""
        source = os.path.join(workspace, "old.txt")
        # new_name.txt does NOT exist in workspace
        action = {"action_type": "rename_file", "item_name": "old.txt",
                  "source_path": source, "new_name": "new.txt"}
        result = validate_rename(action)
        assert result["can_revert"] is False
        assert "no longer exists" in result["message"]

    def test_collision_at_original_name(self, workspace):
        """Cannot revert if something already has the original name."""
        current = os.path.join(workspace, "new.txt")
        source = os.path.join(workspace, "old.txt")
        with open(current, "w") as f:
            f.write("renamed")
        with open(source, "w") as f:
            f.write("collision")

        action = {"action_type": "rename_file", "item_name": "old.txt",
                  "source_path": source, "new_name": "new.txt"}
        result = validate_rename(action)
        assert result["can_revert"] is False
        assert "already exists" in result["message"]


# ── Create validation ──


class TestValidateCreate:
    def test_happy_path_file(self, workspace):
        path = os.path.join(workspace, "created.txt")
        with open(path, "w") as f:
            f.write("new file")

        action = {"action_type": "create_file", "item_name": "created.txt", "target_path": workspace}
        result = validate_create(action)
        assert result["can_revert"] is True
        assert result["warnings"] == []

    def test_item_already_deleted(self, workspace):
        action = {"action_type": "create_file", "item_name": "gone.txt", "target_path": workspace}
        result = validate_create(action)
        assert result["can_revert"] is False
        assert "no longer exists" in result["message"]

    def test_folder_with_contents_warning(self, workspace):
        folder = os.path.join(workspace, "new_folder")
        os.makedirs(folder)
        with open(os.path.join(folder, "child.txt"), "w") as f:
            f.write("child")

        action = {"action_type": "create_folder", "item_name": "new_folder", "target_path": workspace}
        result = validate_create(action)
        assert result["can_revert"] is True
        assert len(result["warnings"]) == 1
        assert "1 item" in result["warnings"][0]
        assert "permanently delete" in result["warnings"][0]

    def test_empty_folder_no_warning(self, workspace):
        folder = os.path.join(workspace, "empty")
        os.makedirs(folder)

        action = {"action_type": "create_folder", "item_name": "empty", "target_path": workspace}
        result = validate_create(action)
        assert result["can_revert"] is True
        assert result["warnings"] == []


# ── Delete / Modify (always non-revertable) ──


class TestNonRevertable:
    def test_delete_file(self):
        result = validate_delete({"action_type": "delete_file", "item_name": "x"})
        assert result["can_revert"] is False
        assert "not backed up" in result["message"]

    def test_delete_folder(self):
        result = validate_delete({"action_type": "delete_folder", "item_name": "x"})
        assert result["can_revert"] is False

    def test_modify_file(self):
        result = validate_modify({"action_type": "modify_file", "item_name": "x"})
        assert result["can_revert"] is False
        assert "modification" in result["message"]


# ── Dispatcher ──


class TestValidateRevert:
    def test_dispatches_to_move(self, workspace):
        target = os.path.join(workspace, "file.txt")
        source = os.path.join(workspace, "orig.txt")
        with open(target, "w") as f:
            f.write("x")

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = validate_revert(action)
        assert result["can_revert"] is True

    def test_unknown_action_type(self):
        result = validate_revert({"action_type": "teleport_file"})
        assert result["can_revert"] is False
        assert "Unknown" in result["message"]


# ── Revert execution with try/except ──


class TestRevertAction:
    def test_revert_move_success(self, workspace):
        origin = os.path.join(workspace, "origin")
        dest = os.path.join(workspace, "dest")
        os.makedirs(origin)
        os.makedirs(dest)
        target = os.path.join(dest, "file.txt")
        source = os.path.join(origin, "file.txt")
        with open(target, "w") as f:
            f.write("content")

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = revert_action(action)
        assert result["success"] is True
        assert os.path.exists(source)
        assert not os.path.exists(target)

    def test_revert_copy_deletes_file(self, workspace):
        target = os.path.join(workspace, "copy.txt")
        with open(target, "w") as f:
            f.write("copied")

        action = {"action_type": "copy_file", "item_name": "copy.txt",
                  "source_path": workspace, "target_path": target}
        result = revert_action(action)
        assert result["success"] is True
        assert not os.path.exists(target)

    def test_revert_rename_success(self, workspace):
        new_path = os.path.join(workspace, "new.txt")
        old_path = os.path.join(workspace, "old.txt")
        with open(new_path, "w") as f:
            f.write("content")

        action = {"action_type": "rename_file", "item_name": "old.txt",
                  "source_path": old_path, "new_name": "new.txt"}
        result = revert_action(action)
        assert result["success"] is True
        assert os.path.exists(old_path)
        assert not os.path.exists(new_path)

    def test_revert_create_deletes_file(self, workspace):
        path = os.path.join(workspace, "created.txt")
        with open(path, "w") as f:
            f.write("new")

        action = {"action_type": "create_file", "item_name": "created.txt",
                  "target_path": workspace}
        result = revert_action(action)
        assert result["success"] is True
        assert not os.path.exists(path)

    def test_revert_create_deletes_folder(self, workspace):
        folder = os.path.join(workspace, "new_folder")
        os.makedirs(folder)
        with open(os.path.join(folder, "child.txt"), "w") as f:
            f.write("child")

        action = {"action_type": "create_folder", "item_name": "new_folder",
                  "target_path": workspace}
        result = revert_action(action)
        assert result["success"] is True
        assert not os.path.exists(folder)

    def test_revert_blocked_by_collision(self, workspace):
        """Revert should fail gracefully when source already exists."""
        origin = os.path.join(workspace, "origin")
        dest = os.path.join(workspace, "dest")
        os.makedirs(origin)
        os.makedirs(dest)
        target = os.path.join(dest, "file.txt")
        source = os.path.join(origin, "file.txt")
        with open(target, "w") as f:
            f.write("moved")
        with open(source, "w") as f:
            f.write("collision")

        action = {"action_type": "move_file", "item_name": "file.txt",
                  "source_path": source, "target_path": target}
        result = revert_action(action)
        assert result["success"] is False
        assert "already exists" in result["message"]

    def test_revert_delete_always_fails(self):
        result = revert_action({"action_type": "delete_file", "item_name": "x"})
        assert result["success"] is False

    def test_check_revert_action_delegates(self, workspace):
        """check_revert_action should return the same result as validate_revert."""
        target = os.path.join(workspace, "file.txt")
        with open(target, "w") as f:
            f.write("x")

        action = {"action_type": "copy_file", "item_name": "file.txt",
                  "target_path": target}
        result = check_revert_action(action)
        assert result["can_revert"] is True
        assert "warnings" in result
