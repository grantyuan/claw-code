from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from src.importers.session_importer import (
    parse_claude_session,
    convert_session_to_jsonl,
    import_claude_sessions,
)
from src.importers.config_importer import (
    load_claude_settings,
    load_claude_mcp,
    merge_settings,
)
from src.importers.conflict_resolver import Conflict, ConflictChoice, ConflictResolver


class TestSessionImporter:
    def test_parse_claude_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_file = Path(tmpdir) / "session.json"
            session_file.write_text(json.dumps({
                "messages": [
                    {"role": "user", "blocks": [{"text": "Hello", "type": "text"}]},
                    {"role": "assistant", "blocks": [{"text": "Hi there!", "type": "text"}]}
                ],
                "version": 1
            }))

            messages = parse_claude_session(session_file)
            assert len(messages) == 2
            assert messages[0].role == "user"
            assert messages[0].content == "Hello"
            assert messages[1].role == "assistant"
            assert messages[1].content == "Hi there!"

    def test_convert_session_to_jsonl(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_file = Path(tmpdir) / "session.json"
            session_file.write_text(json.dumps({
                "messages": [
                    {"role": "user", "blocks": [{"text": "Test", "type": "text"}]}
                ],
                "version": 1
            }))

            output_file = Path(tmpdir) / "output.jsonl"
            count = convert_session_to_jsonl(session_file, output_file)

            assert count == 1
            lines = output_file.read_text().strip().split("\n")
            assert len(lines) == 1
            data = json.loads(lines[0])
            assert data["message"]["role"] == "user"
            assert data["message"]["content"] == "Test"

    def test_import_claude_sessions_skips_existing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            claude_dir = Path(tmpdir) / ".claude"
            claw_dir = Path(tmpdir) / ".claw"
            sessions_dir = claude_dir / "sessions"
            sessions_dir.mkdir(parents=True)

            session_file = sessions_dir / "session-123.json"
            session_file.write_text(json.dumps({
                "messages": [
                    {"role": "user", "blocks": [{"text": "Test", "type": "text"}]}
                ],
                "version": 1
            }))

            (claw_dir / "sessions").mkdir(parents=True)
            (claw_dir / "sessions" / "session-123.jsonl").write_text("existing")

            result = import_claude_sessions(claude_dir, claw_dir)
            assert result["imported"] == 0
            assert result["skipped"] == 1


class TestConfigImporter:
    def test_load_claude_settings(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            claude_dir = Path(tmpdir)
            settings_path = claude_dir / "settings.json"
            settings_path.write_text(json.dumps({"theme": "dark", "version": 1}))

            settings = load_claude_settings(claude_dir)
            assert settings["theme"] == "dark"
            assert settings["version"] == 1

    def test_load_claude_settings_not_exists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            claude_dir = Path(tmpdir)
            settings = load_claude_settings(claude_dir)
            assert settings == {}

    def test_merge_settings_no_conflict(self):
        claw = {"a": 1, "b": 2}
        claude = {"c": 3}
        merged, conflicts = merge_settings(claw, claude)

        assert merged == {"a": 1, "b": 2, "c": 3}
        assert conflicts == []

    def test_merge_settings_with_conflict(self):
        claw = {"key": "claw_value"}
        claude = {"key": "claude_value"}
        merged, conflicts = merge_settings(claw, claude)

        assert conflicts == [{
            "key": "key",
            "source": "claude",
            "source_value": "claude_value",
            "target_value": "claw_value"
        }]


class TestConflictResolver:
    def test_resolve_returns_keep_target_by_default(self):
        resolver = ConflictResolver()
        conflict = Conflict(
            key="test_key",
            source_value="claude",
            target_value="claw"
        )

        choice = resolver.resolve(conflict)
        assert choice == ConflictChoice.KEEP_TARGET

    def test_remember_and_resolve(self):
        resolver = ConflictResolver()
        resolver.remember(ConflictChoice.APPLY_SOURCE, "claude:test_key")

        conflict = Conflict(
            key="test_key",
            source_value="claude",
            target_value="claw",
            source_name="claude"
        )

        choice = resolver.resolve(conflict)
        assert choice == ConflictChoice.APPLY_SOURCE
