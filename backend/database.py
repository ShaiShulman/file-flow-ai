import sqlite3
import json
import os
import threading
from typing import Dict, List, Optional, Any
from datetime import datetime


class Database:
    """SQLite persistence layer for File Flow AI."""

    _instance = None
    _lock = threading.Lock()

    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fileflow.db")
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    @classmethod
    def get_instance(cls, db_path: str = None) -> "Database":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(db_path)
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset the singleton (for testing)."""
        with cls._lock:
            if cls._instance is not None:
                cls._instance.conn.close()
                cls._instance = None

    def _create_tables(self):
        cursor = self.conn.cursor()
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                working_directory TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                duration_ms INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                item_name TEXT NOT NULL,
                source_path TEXT,
                target_path TEXT,
                new_name TEXT,
                description TEXT DEFAULT '',
                reverted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS file_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                UNIQUE(session_id, file_path)
            );

            CREATE TABLE IF NOT EXISTS metadata_fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                field_type TEXT NOT NULL DEFAULT 'text',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                UNIQUE(session_id, field_name)
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                keywords_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_actions_session ON actions(session_id);
            CREATE INDEX IF NOT EXISTS idx_file_metadata_session ON file_metadata(session_id);
            CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(session_id, file_path);
            CREATE INDEX IF NOT EXISTS idx_metadata_fields_session ON metadata_fields(session_id);
        """)
        self.conn.commit()

    # ── Session methods ──

    def create_session(self, session_id: str, working_directory: str) -> dict:
        with self._lock:
            self.conn.execute(
                "INSERT OR IGNORE INTO sessions (id, working_directory) VALUES (?, ?)",
                (session_id, working_directory),
            )
            self.conn.commit()
        return {"id": session_id, "working_directory": working_directory}

    def get_session(self, session_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_sessions(self) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM sessions WHERE status = 'active' ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def delete_session(self, session_id: str) -> bool:
        with self._lock:
            cursor = self.conn.execute(
                "UPDATE sessions SET status = 'deleted' WHERE id = ?", (session_id,)
            )
            self.conn.commit()
        return cursor.rowcount > 0

    # ── Message methods ──

    def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float = 0.0,
        duration_ms: int = 0,
    ) -> int:
        with self._lock:
            cursor = self.conn.execute(
                """INSERT INTO messages (session_id, role, content, input_tokens, output_tokens, cost_usd, duration_ms)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session_id, role, content, input_tokens, output_tokens, cost_usd, duration_ms),
            )
            self.conn.commit()
        return cursor.lastrowid

    def get_messages(self, session_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Action methods ──

    def save_action(
        self,
        session_id: str,
        action_type: str,
        item_name: str,
        source_path: Optional[str] = None,
        target_path: Optional[str] = None,
        new_name: Optional[str] = None,
        description: str = "",
    ) -> int:
        with self._lock:
            cursor = self.conn.execute(
                """INSERT INTO actions (session_id, action_type, item_name, source_path, target_path, new_name, description)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session_id, action_type, item_name, source_path, target_path, new_name, description),
            )
            self.conn.commit()
        return cursor.lastrowid

    def get_actions(self, session_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM actions WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
        result = []
        for r in rows:
            action = dict(r)
            action["reverted"] = bool(action["reverted"])
            action["revertable"] = self._is_revertable(action)
            result.append(action)
        return result

    def get_action(self, action_id: int) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM actions WHERE id = ?", (action_id,)
        ).fetchone()
        if row:
            action = dict(row)
            action["reverted"] = bool(action["reverted"])
            action["revertable"] = self._is_revertable(action)
            return action
        return None

    def mark_action_reverted(self, action_id: int) -> bool:
        with self._lock:
            cursor = self.conn.execute(
                "UPDATE actions SET reverted = 1 WHERE id = ?", (action_id,)
            )
            self.conn.commit()
        return cursor.rowcount > 0

    def _is_revertable(self, action: dict) -> bool:
        if action.get("reverted"):
            return False
        revertable_types = {
            "move_file", "move_folder",
            "rename_file", "rename_folder",
            "create_file", "create_folder",
        }
        return action.get("action_type") in revertable_types

    # ── File metadata methods ──

    def save_file_metadata(self, session_id: str, file_path: str, metadata: dict) -> None:
        metadata_json = json.dumps(metadata)
        with self._lock:
            self.conn.execute(
                """INSERT INTO file_metadata (session_id, file_path, metadata_json, updated_at)
                   VALUES (?, ?, ?, datetime('now'))
                   ON CONFLICT(session_id, file_path)
                   DO UPDATE SET metadata_json = ?, updated_at = datetime('now')""",
                (session_id, file_path, metadata_json, metadata_json),
            )
            self.conn.commit()

    def get_file_metadata(self, session_id: str, file_path: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT metadata_json FROM file_metadata WHERE session_id = ? AND file_path = ?",
            (session_id, file_path),
        ).fetchone()
        if row:
            return json.loads(row["metadata_json"])
        return None

    def delete_file_metadata(self, session_id: str, file_path: str) -> None:
        with self._lock:
            self.conn.execute(
                "DELETE FROM file_metadata WHERE session_id = ? AND file_path = ?",
                (session_id, file_path),
            )
            self.conn.commit()

    def get_all_file_metadata(self, session_id: str) -> Dict[str, dict]:
        rows = self.conn.execute(
            "SELECT file_path, metadata_json FROM file_metadata WHERE session_id = ?",
            (session_id,),
        ).fetchall()
        return {r["file_path"]: json.loads(r["metadata_json"]) for r in rows}

    # ── Metadata field definitions ──

    def add_metadata_field(self, session_id: str, field_name: str, field_type: str = "text") -> None:
        with self._lock:
            self.conn.execute(
                "INSERT OR IGNORE INTO metadata_fields (session_id, field_name, field_type) VALUES (?, ?, ?)",
                (session_id, field_name, field_type),
            )
            self.conn.commit()

    def get_metadata_fields(self, session_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT field_name, field_type FROM metadata_fields WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def delete_metadata_field(self, session_id: str, field_name: str) -> bool:
        with self._lock:
            cursor = self.conn.execute(
                "DELETE FROM metadata_fields WHERE session_id = ? AND field_name = ?",
                (session_id, field_name),
            )
            self.conn.commit()
        return cursor.rowcount > 0

    # ── Category methods ──

    def save_category(self, name: str, keywords: List[str]) -> None:
        keywords_json = json.dumps(keywords)
        with self._lock:
            self.conn.execute(
                """INSERT INTO categories (name, keywords_json)
                   VALUES (?, ?)
                   ON CONFLICT(name)
                   DO UPDATE SET keywords_json = ?""",
                (name, keywords_json, keywords_json),
            )
            self.conn.commit()

    def get_categories(self) -> Dict[str, List[str]]:
        rows = self.conn.execute(
            "SELECT name, keywords_json FROM categories ORDER BY name ASC"
        ).fetchall()
        return {r["name"]: json.loads(r["keywords_json"]) for r in rows}

    def get_category(self, name: str) -> Optional[List[str]]:
        row = self.conn.execute(
            "SELECT keywords_json FROM categories WHERE name = ?", (name,)
        ).fetchone()
        if row:
            return json.loads(row["keywords_json"])
        return None

    def delete_category(self, name: str) -> bool:
        with self._lock:
            cursor = self.conn.execute(
                "DELETE FROM categories WHERE name = ?", (name,)
            )
            self.conn.commit()
        return cursor.rowcount > 0

    def clear_categories(self) -> None:
        with self._lock:
            self.conn.execute("DELETE FROM categories")
            self.conn.commit()

    # ── Stats/analytics ──

    def get_session_stats(self, session_id: str) -> dict:
        msg_stats = self.conn.execute(
            """SELECT
                COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                COALESCE(SUM(cost_usd), 0.0) as total_cost_usd,
                COALESCE(SUM(duration_ms), 0) as total_duration_ms,
                COUNT(*) as message_count
               FROM messages WHERE session_id = ?""",
            (session_id,),
        ).fetchone()

        action_count = self.conn.execute(
            "SELECT COUNT(*) as cnt FROM actions WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        per_message = self.conn.execute(
            """SELECT id, role, input_tokens, output_tokens, cost_usd, duration_ms, created_at
               FROM messages WHERE session_id = ? ORDER BY created_at ASC""",
            (session_id,),
        ).fetchall()

        return {
            "total_input_tokens": msg_stats["total_input_tokens"],
            "total_output_tokens": msg_stats["total_output_tokens"],
            "total_cost_usd": msg_stats["total_cost_usd"],
            "total_duration_ms": msg_stats["total_duration_ms"],
            "message_count": msg_stats["message_count"],
            "action_count": action_count["cnt"],
            "per_message_stats": [dict(r) for r in per_message],
        }

    def import_categories_from_json(self, json_path: str) -> int:
        """Import categories from a JSON file (one-time migration)."""
        if not os.path.exists(json_path):
            return 0
        existing = self.get_categories()
        if existing:
            return 0  # DB already has categories, skip
        try:
            with open(json_path, "r") as f:
                categories = json.load(f)
            for name, keywords in categories.items():
                self.save_category(name, keywords)
            return len(categories)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error importing categories from JSON: {e}")
            return 0


# Global singleton
db = Database.get_instance()
