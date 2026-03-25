"""Live server integration tests for the file registry system.

Requires the backend server running on localhost:8000 with at least one
session that has a working directory on disk.

Usage:
    py -3 -m pytest tests/test_file_registry_live.py -v
    SERVER_URL=http://localhost:9000 py -3 -m pytest tests/test_file_registry_live.py -v
"""

import os
import sys
import json
import uuid
import pytest
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DEFAULT_SERVER_URL = "http://localhost:8000"


@pytest.fixture(scope="session")
def server_url():
    return os.environ.get("SERVER_URL", DEFAULT_SERVER_URL)


@pytest.fixture(scope="session")
def api(server_url):
    """Helper to make API calls."""

    class Api:
        def __init__(self, base):
            self.base = base

        def get(self, path):
            r = requests.get(f"{self.base}{path}")
            return r

        def post(self, path, json_data=None):
            r = requests.post(f"{self.base}{path}", json=json_data or {})
            return r

    return Api(server_url)


@pytest.fixture(scope="session")
def server_healthy(api):
    """Skip all tests if server is not reachable."""
    try:
        r = api.get("/")
        assert r.status_code == 200
    except (requests.ConnectionError, AssertionError):
        pytest.skip(f"Backend server not reachable at {api.base}")


@pytest.fixture(scope="session")
def session_id(api, server_healthy):
    """Find the most recent session with a valid working directory."""
    from database import Database

    db = Database.get_instance()
    rows = db.conn.execute(
        "SELECT id, working_directory FROM sessions WHERE status = 'active' ORDER BY created_at DESC"
    ).fetchall()

    for row in rows:
        if os.path.isdir(row["working_directory"]):
            # Ensure session is alive on the server
            r = api.post(f"/sessions/{row['id']}")
            if r.status_code == 200:
                return row["id"]

    pytest.skip("No active session with a valid working directory found")


@pytest.fixture(scope="session")
def working_directory(session_id):
    from database import Database

    db = Database.get_instance()
    session = db.get_session(session_id)
    return session["working_directory"]


# ─── Health & Session Tests ───


class TestServerHealth:
    def test_server_is_running(self, api, server_healthy):
        r = api.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_session_exists(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/detail")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == session_id
        assert data["status"] == "active"


# ─── Folder Structure Endpoint ───


class TestFolderStructure:
    def test_returns_tree(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/folder-structure")
        assert r.status_code == 200
        tree = r.json()
        assert tree["type"] == "folder"
        assert "id" in tree
        assert "children" in tree
        assert len(tree["children"]) > 0

    def test_nodes_have_stable_ids(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()
        # All nodes should have UUID-format IDs
        for child in tree["children"]:
            assert len(child["id"]) == 36, f"ID not UUID format: {child['id']}"

    def test_files_have_extension_and_metadata(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()
        files = [c for c in tree["children"] if c["type"] == "file"]
        assert len(files) > 0, "No files found in tree"
        for f in files:
            assert "extension" in f, f"File {f['name']} missing extension"
            assert "metadata" in f, f"File {f['name']} missing metadata"
            assert "size" in f["metadata"]
            assert "lastModified" in f["metadata"]

    def test_folders_have_children(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()
        folders = [c for c in tree["children"] if c["type"] == "folder"]
        for folder in folders:
            assert "children" in folder, f"Folder {folder['name']} missing children"

    def test_ids_are_stable_across_calls(self, api, session_id):
        r1 = api.get(f"/sessions/{session_id}/folder-structure")
        r2 = api.get(f"/sessions/{session_id}/folder-structure")
        tree1 = r1.json()
        tree2 = r2.json()

        def collect_ids(node):
            ids = {node["name"]: node["id"]}
            for child in node.get("children", []):
                ids.update(collect_ids(child))
            return ids

        ids1 = collect_ids(tree1)
        ids2 = collect_ids(tree2)
        assert ids1 == ids2, "IDs changed between calls"

    def test_nonexistent_session_returns_404(self, api, server_healthy):
        r = api.get("/sessions/nonexistent-session-id/folder-structure")
        assert r.status_code == 404


# ─── File Registry Database ───


class TestRegistryDatabase:
    def test_registry_has_entries(self, session_id):
        from database import Database

        db = Database.get_instance()
        entries = db.get_file_registry(session_id)
        assert len(entries) > 0, "No registry entries found"

    def test_registry_entries_have_required_fields(self, session_id):
        from database import Database

        db = Database.get_instance()
        entries = db.get_file_registry(session_id)
        for entry in entries:
            assert "id" in entry
            assert "file_path" in entry
            assert "item_type" in entry
            assert entry["item_type"] in ("file", "folder")

    def test_file_id_map_matches_registry(self, session_id):
        from database import Database

        db = Database.get_instance()
        id_map = db.get_file_id_map(session_id)
        entries = db.get_file_registry(session_id)
        assert len(id_map) == len(entries)
        for entry in entries:
            assert entry["file_path"] in id_map
            assert id_map[entry["file_path"]] == entry["id"]

    def test_tree_ids_match_registry(self, api, session_id):
        """Verify that IDs in the tree response match the database registry."""
        from database import Database

        db = Database.get_instance()
        id_map = db.get_file_id_map(session_id)

        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()

        def check_ids(node):
            path = node["path"]
            assert path in id_map, f"Path {path} not in registry"
            assert node["id"] == id_map[path], f"ID mismatch for {path}"
            for child in node.get("children", []):
                check_ids(child)

        check_ids(tree)


# ─── New File Discovery ───


class TestNewFileDiscovery:
    @pytest.fixture
    def temp_file(self, working_directory):
        """Create a temporary file in the working directory, clean up after."""
        filename = f"_test_registry_{uuid.uuid4().hex[:8]}.txt"
        filepath = os.path.join(working_directory, filename)
        with open(filepath, "w") as f:
            f.write("test content for registry validation")
        yield filename, filepath
        # Cleanup
        if os.path.exists(filepath):
            os.unlink(filepath)

    def test_new_file_appears_in_tree(self, api, session_id, temp_file):
        filename, filepath = temp_file
        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()
        names = [c["name"] for c in tree["children"]]
        assert filename in names, f"New file {filename} not found in tree"

    def test_new_file_gets_stable_id(self, api, session_id, temp_file):
        filename, filepath = temp_file
        r1 = api.get(f"/sessions/{session_id}/folder-structure")
        r2 = api.get(f"/sessions/{session_id}/folder-structure")

        def find_file(tree, name):
            for c in tree["children"]:
                if c["name"] == name:
                    return c
            return None

        f1 = find_file(r1.json(), filename)
        f2 = find_file(r2.json(), filename)
        assert f1 is not None, "File not found in first call"
        assert f2 is not None, "File not found in second call"
        assert f1["id"] == f2["id"], "ID changed between calls"
        assert len(f1["id"]) == 36, "ID not UUID format"

    def test_new_file_has_correct_properties(self, api, session_id, temp_file):
        filename, filepath = temp_file
        r = api.get(f"/sessions/{session_id}/folder-structure")
        tree = r.json()
        file_node = next(c for c in tree["children"] if c["name"] == filename)
        assert file_node["type"] == "file"
        assert file_node["extension"] == "txt"
        assert "metadata" in file_node
        assert file_node["metadata"]["size"] > 0

    def test_deleted_file_removed_from_tree(self, api, session_id, working_directory):
        """Create a file, verify it appears, delete it, verify it's gone."""
        filename = f"_test_delete_{uuid.uuid4().hex[:8]}.txt"
        filepath = os.path.join(working_directory, filename)

        # Create
        with open(filepath, "w") as f:
            f.write("will be deleted")

        r = api.get(f"/sessions/{session_id}/folder-structure")
        names = [c["name"] for c in r.json()["children"]]
        assert filename in names, "File should appear after creation"

        # Delete
        os.unlink(filepath)

        r = api.get(f"/sessions/{session_id}/folder-structure")
        names = [c["name"] for c in r.json()["children"]]
        assert filename not in names, "File should disappear after deletion"


# ─── Session Isolation ───


class TestSessionIsolation:
    def test_different_sessions_different_registries(self, session_id):
        """Registries for different sessions don't leak."""
        from database import Database

        db = Database.get_instance()
        fake_session = f"fake-{uuid.uuid4()}"
        entries = db.get_file_registry(fake_session)
        assert len(entries) == 0

        real_entries = db.get_file_registry(session_id)
        assert len(real_entries) > 0


# ─── Existing Features Not Broken ───


class TestExistingFeatures:
    def test_actions_endpoint_works(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/actions")
        assert r.status_code == 200
        assert "actions" in r.json()

    def test_metadata_endpoint_works(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/manifest")
        assert r.status_code == 200

    def test_stats_endpoint_works(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/stats")
        assert r.status_code == 200

    def test_session_status_endpoint_works(self, api, session_id):
        r = api.get(f"/sessions/{session_id}/status")
        assert r.status_code == 200
