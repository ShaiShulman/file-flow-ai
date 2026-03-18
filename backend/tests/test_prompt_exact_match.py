"""
Tests that validate prompt content based on the exact match toggle.
Ensures the LLM receives the right instructions for each mode.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from prompts import primary_assistant_prompt, EXACT_MATCH_INSTRUCTIONS
import config


def render_system_prompt(exact_match_enabled: bool) -> str:
    """Render the system prompt with given exact match state."""
    exact_match_text = EXACT_MATCH_INSTRUCTIONS if exact_match_enabled else ""
    prompt = primary_assistant_prompt.partial(
        working_directory="/tmp/test",
        exact_match_instructions=exact_match_text,
    )
    # Extract the system message content from the prompt template
    messages = prompt.format_messages(messages=[])
    system_msg = messages[0].content
    return system_msg


class TestExactMatchOn:
    """When exact match is enabled, the prompt should guide the LLM to use name_pattern directly."""

    def test_contains_exact_match_header(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        assert "EXACT MATCH MODE" in prompt

    def test_contains_negative_find_files_instruction(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        assert "Do NOT call find_files first" in prompt

    def test_contains_name_pattern_guidance(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        assert "name_pattern" in prompt

    def test_contains_concrete_example(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        assert 'move_item(name_pattern="litigation"' in prompt

    def test_clarifies_when_find_files_is_ok(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        assert "search or list files without moving" in prompt


class TestExactMatchOff:
    """When exact match is disabled, the prompt should NOT contain exact match instructions."""

    def test_no_exact_match_header(self):
        prompt = render_system_prompt(exact_match_enabled=False)
        assert "EXACT MATCH MODE" not in prompt

    def test_no_negative_find_files_instruction(self):
        prompt = render_system_prompt(exact_match_enabled=False)
        assert "Do NOT call find_files first" not in prompt

    def test_no_name_pattern_example(self):
        prompt = render_system_prompt(exact_match_enabled=False)
        assert 'move_item(name_pattern=' not in prompt


class TestMultiFileOpsNoConflict:
    """MULTI-FILE OPERATIONS section must NOT promote find_files for pattern matching.
    This was the root cause of the LLM using find_files instead of name_pattern."""

    def test_multi_file_ops_does_not_mention_find_files(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        # Extract the MULTI-FILE OPERATIONS section
        start = prompt.find("MULTI-FILE OPERATIONS:")
        end = prompt.find("ERROR HANDLING:")
        assert start != -1 and end != -1, "Could not find MULTI-FILE OPERATIONS section"
        multi_file_section = prompt[start:end]
        assert "find_files" not in multi_file_section

    def test_multi_file_ops_still_mentions_batch(self):
        prompt = render_system_prompt(exact_match_enabled=True)
        start = prompt.find("MULTI-FILE OPERATIONS:")
        end = prompt.find("ERROR HANDLING:")
        multi_file_section = prompt[start:end]
        assert "list of strings" in multi_file_section
        assert "single call" in multi_file_section


class TestConfigToggle:
    """Verify the config toggle works correctly with graph.py's logic."""

    def test_config_default_is_enabled(self):
        # The default should be True
        assert config.ENABLE_EXACT_MATCH is True

    def test_toggle_changes_prompt(self):
        # Simulate what graph.py does
        config.ENABLE_EXACT_MATCH = True
        on_text = EXACT_MATCH_INSTRUCTIONS if config.ENABLE_EXACT_MATCH else ""
        assert "EXACT MATCH MODE" in on_text

        config.ENABLE_EXACT_MATCH = False
        off_text = EXACT_MATCH_INSTRUCTIONS if config.ENABLE_EXACT_MATCH else ""
        assert off_text == ""

        # Reset
        config.ENABLE_EXACT_MATCH = True
