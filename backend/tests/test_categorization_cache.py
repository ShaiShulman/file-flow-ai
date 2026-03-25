"""Tests for the analyze_document caching logic.

Verifies that "N/A" values are re-analyzed instead of being treated as cached results.
"""

import os
import sys
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from text_analysis import TextAnalyzer


class TestCategorizationCache:
    """Test that the caching logic in analyze_document handles N/A correctly."""

    def _make_state(self, file_path, metadata):
        """Helper to create a mock state dict with file_metadata."""
        return {"file_metadata": {file_path: metadata}}

    def _call_analyze(self, tmp_path, file_path, state=None, **kwargs):
        """Call analyze_document's core logic with mocked Bedrock."""
        from text_analysis import analyze_document

        working_directory = str(tmp_path)
        full_path = os.path.join(working_directory, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, "w") as f:
                f.write("Sample legal document content about tax authorization.")

        # Call the underlying function directly via invoke
        # We need to use the tool's func attribute to bypass LangGraph injection
        tool_input = {
            "working_directory": working_directory,
            "file_path": file_path,
            **kwargs,
        }

        # Access the raw function and call it with state
        result = analyze_document.func(
            working_directory=working_directory,
            file_path=file_path,
            state=state,
            **kwargs,
        )
        return result

    def test_na_category_is_reanalyzed(self, tmp_path):
        """When category is 'N/A' in state, it should be re-analyzed, not cached."""
        file_path = "doc.txt"
        state = self._make_state(
            file_path, {"category": "N/A", "last_analyzed": "2026-01-01T00:00:00"}
        )

        mock_response = "<category>Authorization and signatory powers</category>"

        with patch.object(
            TextAnalyzer, "invoke_model", return_value=(mock_response, 150)
        ):
            result = self._call_analyze(
                tmp_path, file_path, state=state, categorize=True
            )

        metadata = result["file_metadata"][file_path]
        assert metadata["category"] == "Authorization and signatory powers"
        assert result["total_tokens"] == 150  # Model was actually invoked

    def test_valid_category_is_cached(self, tmp_path):
        """When category has a real value in state, it should NOT be re-analyzed."""
        file_path = "doc.txt"
        state = self._make_state(
            file_path,
            {
                "category": "Board documents",
                "last_analyzed": "2026-01-01T00:00:00",
            },
        )

        with patch.object(TextAnalyzer, "invoke_model") as mock_invoke:
            result = self._call_analyze(
                tmp_path, file_path, state=state, categorize=True
            )

        metadata = result["file_metadata"][file_path]
        assert metadata["category"] == "Board documents"
        assert result["total_tokens"] == 0  # Model was NOT invoked
        mock_invoke.assert_not_called()

    def test_na_title_is_reanalyzed(self, tmp_path):
        """N/A caching fix applies to all fields, not just category."""
        file_path = "doc.txt"
        state = self._make_state(
            file_path, {"title": "N/A", "last_analyzed": "2026-01-01T00:00:00"}
        )

        mock_response = "<title>Tax Authority Authorization Letter</title>"

        with patch.object(
            TextAnalyzer, "invoke_model", return_value=(mock_response, 100)
        ):
            result = self._call_analyze(
                tmp_path, file_path, state=state, title=True
            )

        metadata = result["file_metadata"][file_path]
        assert metadata["title"] == "Tax Authority Authorization Letter"
        assert result["total_tokens"] == 100

    def test_mixed_cached_and_na_fields(self, tmp_path):
        """Only N/A fields should be re-analyzed; valid cached fields should be kept."""
        file_path = "doc.txt"
        state = self._make_state(
            file_path,
            {
                "category": "N/A",
                "title": "Some Real Title",
                "date": "N/A",
                "last_analyzed": "2026-01-01T00:00:00",
            },
        )

        mock_response = (
            "<category>Board documents</category>\n"
            "<date>2024-04-16</date>"
        )

        with patch.object(
            TextAnalyzer, "invoke_model", return_value=(mock_response, 200)
        ) as mock_invoke:
            result = self._call_analyze(
                tmp_path,
                file_path,
                state=state,
                categorize=True,
                title=True,
                date=True,
            )

        metadata = result["file_metadata"][file_path]
        # N/A fields should be updated
        assert metadata["category"] == "Board documents"
        assert metadata["date"] == "2024-04-16"
        # Valid cached field should be preserved
        assert metadata["title"] == "Some Real Title"
        # Model was invoked (for category and date)
        assert result["total_tokens"] == 200
        mock_invoke.assert_called_once()

    def test_no_state_analyzes_normally(self, tmp_path):
        """With no prior state, all requested fields should be analyzed."""
        file_path = "doc.txt"

        mock_response = (
            "<category>Incorporation documents</category>\n"
            "<title>Certificate of Incorporation</title>"
        )

        with patch.object(
            TextAnalyzer, "invoke_model", return_value=(mock_response, 300)
        ):
            result = self._call_analyze(
                tmp_path,
                file_path,
                state=None,
                categorize=True,
                title=True,
            )

        metadata = result["file_metadata"][file_path]
        assert metadata["category"] == "Incorporation documents"
        assert metadata["title"] == "Certificate of Incorporation"
        assert result["total_tokens"] == 300

    def test_all_fields_cached_skips_model(self, tmp_path):
        """When all requested fields have real values, model should not be called."""
        file_path = "doc.txt"
        state = self._make_state(
            file_path,
            {
                "category": "Board documents",
                "title": "Board Minutes",
                "date": "2024-01-15",
                "last_analyzed": "2026-01-01T00:00:00",
            },
        )

        with patch.object(TextAnalyzer, "invoke_model") as mock_invoke:
            result = self._call_analyze(
                tmp_path,
                file_path,
                state=state,
                categorize=True,
                title=True,
                date=True,
            )

        metadata = result["file_metadata"][file_path]
        assert metadata["category"] == "Board documents"
        assert metadata["title"] == "Board Minutes"
        assert metadata["date"] == "2024-01-15"
        assert result["total_tokens"] == 0
        mock_invoke.assert_not_called()
