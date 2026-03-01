import os
import sys
import tempfile
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Database


@pytest.fixture
def db():
    """Create a temporary database for each test."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    database = Database(db_path)
    yield database
    database.conn.close()
    os.unlink(db_path)


class TestSessions:
    def test_create_session(self, db):
        result = db.create_session("sess-1", "/tmp/work")
        assert result["id"] == "sess-1"
        assert result["working_directory"] == "/tmp/work"

    def test_get_session(self, db):
        db.create_session("sess-1", "/tmp/work")
        session = db.get_session("sess-1")
        assert session is not None
        assert session["id"] == "sess-1"
        assert session["status"] == "active"

    def test_get_nonexistent_session(self, db):
        assert db.get_session("nope") is None

    def test_list_sessions(self, db):
        db.create_session("sess-1", "/tmp/a")
        db.create_session("sess-2", "/tmp/b")
        sessions = db.list_sessions()
        assert len(sessions) == 2

    def test_delete_session(self, db):
        db.create_session("sess-1", "/tmp/work")
        assert db.delete_session("sess-1")
        sessions = db.list_sessions()
        assert len(sessions) == 0

    def test_delete_nonexistent_session(self, db):
        assert not db.delete_session("nope")


class TestMessages:
    def test_save_and_get_messages(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_message("sess-1", "user", "Hello")
        db.save_message("sess-1", "assistant", "Hi there", input_tokens=100, output_tokens=50, cost_usd=0.001, duration_ms=500)
        messages = db.get_messages("sess-1")
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Hello"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["input_tokens"] == 100
        assert messages[1]["output_tokens"] == 50
        assert messages[1]["cost_usd"] == 0.001
        assert messages[1]["duration_ms"] == 500


class TestActions:
    def test_save_and_get_actions(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_action("sess-1", "move_file", "test.pdf", source_path="/a/test.pdf", target_path="/b/test.pdf")
        actions = db.get_actions("sess-1")
        assert len(actions) == 1
        assert actions[0]["action_type"] == "move_file"
        assert actions[0]["reverted"] is False
        assert actions[0]["revertable"] is True

    def test_revertable_types(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_action("sess-1", "move_file", "a.pdf")
        db.save_action("sess-1", "delete_file", "b.pdf")
        db.save_action("sess-1", "create_folder", "newdir")
        actions = db.get_actions("sess-1")
        assert actions[0]["revertable"] is True   # move
        assert actions[1]["revertable"] is False   # delete
        assert actions[2]["revertable"] is True   # create

    def test_mark_action_reverted(self, db):
        db.create_session("sess-1", "/tmp/work")
        action_id = db.save_action("sess-1", "move_file", "test.pdf")
        db.mark_action_reverted(action_id)
        action = db.get_action(action_id)
        assert action["reverted"] is True
        assert action["revertable"] is False

    def test_get_action(self, db):
        db.create_session("sess-1", "/tmp/work")
        action_id = db.save_action("sess-1", "rename_file", "old.pdf", new_name="new.pdf")
        action = db.get_action(action_id)
        assert action is not None
        assert action["item_name"] == "old.pdf"
        assert action["new_name"] == "new.pdf"


class TestFileMetadata:
    def test_save_and_get(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_file_metadata("sess-1", "doc.pdf", {"category": "Legal", "date": "2024-01-01"})
        meta = db.get_file_metadata("sess-1", "doc.pdf")
        assert meta["category"] == "Legal"
        assert meta["date"] == "2024-01-01"

    def test_upsert(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_file_metadata("sess-1", "doc.pdf", {"category": "Legal"})
        db.save_file_metadata("sess-1", "doc.pdf", {"category": "Financial", "priority": "high"})
        meta = db.get_file_metadata("sess-1", "doc.pdf")
        assert meta["category"] == "Financial"
        assert meta["priority"] == "high"

    def test_get_all(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_file_metadata("sess-1", "a.pdf", {"category": "A"})
        db.save_file_metadata("sess-1", "b.pdf", {"category": "B"})
        all_meta = db.get_all_file_metadata("sess-1")
        assert len(all_meta) == 2
        assert all_meta["a.pdf"]["category"] == "A"

    def test_get_nonexistent(self, db):
        db.create_session("sess-1", "/tmp/work")
        assert db.get_file_metadata("sess-1", "nope.pdf") is None


class TestMetadataFields:
    def test_add_and_get(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.add_metadata_field("sess-1", "priority", "text")
        db.add_metadata_field("sess-1", "due_date", "date")
        fields = db.get_metadata_fields("sess-1")
        assert len(fields) == 2
        assert fields[0]["field_name"] == "priority"
        assert fields[1]["field_type"] == "date"

    def test_delete_field(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.add_metadata_field("sess-1", "priority", "text")
        assert db.delete_metadata_field("sess-1", "priority")
        assert len(db.get_metadata_fields("sess-1")) == 0

    def test_delete_nonexistent(self, db):
        db.create_session("sess-1", "/tmp/work")
        assert not db.delete_metadata_field("sess-1", "nope")


class TestCategories:
    def test_save_and_get(self, db):
        db.save_category("Legal", ["contract", "NDA"])
        cats = db.get_categories()
        assert "Legal" in cats
        assert cats["Legal"] == ["contract", "NDA"]

    def test_get_single(self, db):
        db.save_category("Legal", ["contract"])
        assert db.get_category("Legal") == ["contract"]
        assert db.get_category("Nope") is None

    def test_upsert(self, db):
        db.save_category("Legal", ["contract"])
        db.save_category("Legal", ["contract", "NDA"])
        assert db.get_category("Legal") == ["contract", "NDA"]

    def test_delete(self, db):
        db.save_category("Legal", ["contract"])
        assert db.delete_category("Legal")
        assert db.get_category("Legal") is None

    def test_clear(self, db):
        db.save_category("Legal", ["contract"])
        db.save_category("Financial", ["invoice"])
        db.clear_categories()
        assert db.get_categories() == {}

    def test_import_from_json(self, db, tmp_path):
        import json
        json_file = tmp_path / "cats.json"
        json_file.write_text(json.dumps({"Legal": ["contract"], "Financial": ["invoice"]}))
        count = db.import_categories_from_json(str(json_file))
        assert count == 2
        assert db.get_category("Legal") == ["contract"]

    def test_import_skips_if_db_has_data(self, db, tmp_path):
        import json
        db.save_category("Existing", ["test"])
        json_file = tmp_path / "cats.json"
        json_file.write_text(json.dumps({"Legal": ["contract"]}))
        count = db.import_categories_from_json(str(json_file))
        assert count == 0


class TestSessionStats:
    def test_stats(self, db):
        db.create_session("sess-1", "/tmp/work")
        db.save_message("sess-1", "user", "Hello")
        db.save_message("sess-1", "assistant", "Hi", input_tokens=100, output_tokens=50, cost_usd=0.001, duration_ms=500)
        db.save_action("sess-1", "move_file", "test.pdf")
        stats = db.get_session_stats("sess-1")
        assert stats["total_input_tokens"] == 100
        assert stats["total_output_tokens"] == 50
        assert stats["total_cost_usd"] == 0.001
        assert stats["total_duration_ms"] == 500
        assert stats["message_count"] == 2
        assert stats["action_count"] == 1
        assert len(stats["per_message_stats"]) == 2
