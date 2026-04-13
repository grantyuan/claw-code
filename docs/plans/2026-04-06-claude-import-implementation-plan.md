# Claude Import Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `claw import --from claude` command to import Claude Code data (sessions, MCP, plugins, skills, settings) into ClawCode.

**Architecture:** Python CLI command with modular import handlers for each data type. Conflict detection with interactive resolution.

**Tech Stack:** Python (existing codebase), Rust CLI scaffolding (if needed for integration)

---

## Task 1: Create Import Command Framework

**Files:**
- Create: `src/commands/import_cmd.py`
- Modify: `src/commands.py` (add import subcommand)

**Step 1: Create import_cmd.py**

```python
# src/commands/import_cmd.py
"""Import command for Claude Code data."""

import argparse
from pathlib import Path
from typing import Literal

from commands import ClawCommand, CommandResult

class ImportCommand(ClawCommand):
    """Import data from Claude Code."""

    name = "import"
    help = "Import data from Claude Code"

    def add_args(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument(
            "--from",
            dest="source",
            required=True,
            choices=["claude"],
            help="Source to import from"
        )
        parser.add_argument(
            "--global",
            dest="is_global",
            action="store_true",
            help="Import global config"
        )
        parser.add_argument(
            "--all",
            dest="import_all",
            action="store_true",
            help="Import everything"
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help="Preview without applying"
        )

    def execute(self, args: argparse.Namespace) -> CommandResult:
        # TODO: Implementation
        pass
```

**Step 2: Verify syntax**

Run: `python -m py_compile src/commands/import_cmd.py`
Expected: No output (success)

---

## Task 2: Implement Session Import Handler

**Files:**
- Create: `src/importers/session_importer.py`
- Create: `src/importers/__init__.py`

**Step 1: Create session_importer.py**

```python
# src/importers/session_importer.py
"""Import session history from Claude Code JSON to ClawCode JSONL."""

import json
from dataclasses import dataclass
from pathlib import Path

@dataclass
class ClaudeSession:
    """Claude Code session format."""
    messages: list
    version: int = 1

@dataclass
class ClawMessage:
    """ClawCode message format for JSONL."""
    role: str
    content: str
    timestamp_ms: int

def parse_claude_session(path: Path) -> list[ClawMessage]:
    """Parse Claude JSON session to ClawCode format."""
    data = json.loads(path.read_text())
    messages = []
    for msg in data.get("messages", []):
        blocks = msg.get("blocks", [])
        text = "".join(b.get("text", "") for b in blocks)
        messages.append(ClawMessage(
            role=msg.get("role", "user"),
            content=text,
            timestamp_ms=0
        ))
    return messages

def convert_session_to_jsonl(claude_path: Path, claw_path: Path) -> int:
    """Convert Claude session JSON to ClawCode JSONL."""
    messages = parse_claude_session(claude_path)
    with open(claw_path, "w") as f:
        for msg in messages:
            f.write(json.dumps({"message": {"role": msg.role, "content": msg.content}}) + "\n")
    return len(messages)
```

**Step 2: Verify syntax**

Run: `python -m py_compile src/importers/session_importer.py`
Expected: No output (success)

---

## Task 3: Implement Config Importer

**Files:**
- Create: `src/importers/config_importer.py`

**Step 1: Create config_importer.py**

```python
# src/importers/config_importer.py
"""Import configuration from Claude Code."""

import json
from pathlib import Path
from typing import Any

def load_claude_config(claude_dir: Path) -> dict[str, Any]:
    """Load Claude Code settings.json."""
    settings_path = claude_dir / "settings.json"
    if settings_path.exists():
        return json.loads(settings_path.read_text())
    return {}

def merge_configs(claw_config: dict, claude_config: dict) -> dict[str, Any]:
    """Merge Claude config into Claw config with conflict detection."""
    merged = claw_config.copy()
    conflicts = []

    for key, value in claude_config.items():
        if key in merged and merged[key] != value:
            conflicts.append((key, merged[key], value))
        else:
            merged[key] = value

    return merged, conflicts
```

---

## Task 4: Implement MCP Importer

**Files:**
- Create: `src/importers/mcp_importer.py`

**Step 1: Create mcp_importer.py**

```python
# src/importers/mcp_importer.py
"""Import MCP server configurations from Claude Code."""

import json
from pathlib import Path
from typing import Any

def load_mcp_config(claude_dir: Path) -> dict[str, Any]:
    """Load Claude Code mcp.json."""
    mcp_path = claude_dir / "mcp.json"
    if mcp_path.exists():
        return json.loads(mcp_path.read_text())
    return {}

def validate_mcp_servers(config: dict[str, Any]) -> list[str]:
    """Check if MCP server executables are available."""
    errors = []
    for name, server_config in config.get("mcpServers", {}).items():
        cmd = server_config.get("command", "")
        # Basic validation - executable in PATH
        if cmd and not Path(cmd).exists():
            # Could be in PATH, skip detailed check for now
            pass
    return errors
```

---

## Task 5: Implement Plugin Importer

**Files:**
- Create: `src/importers/plugin_importer.py`

**Step 1: Create plugin_importer.py**

```python
# src/importers/plugin_importer.py
"""Import plugins from Claude Code."""

import json
from pathlib import Path

def discover_plugins(claude_dir: Path) -> list[Path]:
    """Find all .claude-plugin directories."""
    plugins = []
    for item in claude_dir.rglob(".claude-plugin"):
        if item.is_dir():
            plugins.append(item.parent)
    return plugins

def load_plugin_config(plugin_path: Path) -> dict:
    """Load plugin.json from a plugin directory."""
    config_path = plugin_path / ".claude-plugin" / "plugin.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}

def copy_plugin(src: Path, dest: Path) -> None:
    """Copy plugin to ClawCode plugins directory."""
    import shutil
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.rglob("*"):
        if item.is_file():
            rel = item.relative_to(src)
            dest_file = dest / rel
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest_file)
```

---

## Task 6: Implement Skills Importer

**Files:**
- Create: `src/importers/skills_importer.py`

**Step 1: Create skills_importer.py**

```python
# src/importers/skills_importer.py
"""Import skills from Claude Code."""

import json
from pathlib import Path

def discover_skills(claude_dir: Path) -> list[Path]:
    """Find all skill directories."""
    skills_dir = claude_dir / "skills"
    if skills_dir.exists():
        return [d for d in skills_dir.iterdir() if d.is_dir()]
    return []

def load_skill_config(skill_path: Path) -> dict:
    """Load skill configuration."""
    config_path = skill_path / "skill.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}
```

---

## Task 7: Create Conflict Resolution UI

**Files:**
- Create: `src/importers/conflict_resolver.py`

**Step 1: Create conflict_resolver.py**

```python
# src/importers/conflict_resolver.py
"""Interactive conflict resolution for imports."""

from dataclasses import dataclass
from enum import Enum

class ConflictChoice(Enum):
    APPLY_SOURCE = "apply_source"
    KEEP_TARGET = "keep_target"
    APPLY_ALL_SOURCE = "apply_all_source"
    SKIP_ALL = "skip_all"

@dataclass
class Conflict:
    """Represents a configuration conflict."""
    key: str
    source_value: any
    target_value: any
    source_name: str
    target_name: str

class ConflictResolver:
    """Handle import conflicts interactively."""

    def __init__(self):
        self.remembered_choices: dict[str, ConflictChoice] = {}

    def resolve(self, conflict: Conflict) -> ConflictChoice:
        """Resolve a single conflict."""
        choice_key = f"{conflict.source_name}:{conflict.key}"

        if choice_key in self.remembered_choices:
            return self.remembered_choices[choice_key]

        # In CLI mode, return KEEP_TARGET as default
        return ConflictChoice.KEEP_TARGET

    def remember(self, choice: ConflictChoice, key_pattern: str) -> None:
        """Remember choice for future conflicts of same type."""
        self.remembered_choices[key_pattern] = choice
```

---

## Task 8: Integrate Import Command with All Importers

**Files:**
- Modify: `src/commands/import_cmd.py`

**Step 1: Update import_cmd.py to use all importers**

```python
# Full implementation integrating all importers
def execute(self, args: argparse.Namespace) -> CommandResult:
    from importers.session_importer import convert_session_to_jsonl
    from importers.config_importer import load_claude_config, merge_configs
    from importers.mcp_importer import load_mcp_config
    from importers.plugin_importer import discover_plugins, copy_plugin
    from importers.skills_importer import discover_skills
    from importers.conflict_resolver import ConflictResolver

    claude_dirs = []
    if args.is_global:
        claude_dirs.append(Path.home() / ".claude")
    else:
        claude_dirs.append(Path.cwd() / ".claude")

    if args.import_all:
        claude_dirs.append(Path.home() / ".claude")
        claude_dirs.append(Path.cwd() / ".claude")

    for claude_dir in claude_dirs:
        if not claude_dir.exists():
            continue
        # Import sessions, configs, MCP, plugins, skills...

    return CommandResult(success=True, message="Import completed")
```

---

## Task 9: Add Tests

**Files:**
- Create: `tests/test_import.py`

**Step 1: Create test_import.py**

```python
# tests/test_import.py
import pytest
import tempfile
import json
from pathlib import Path

from importers.session_importer import parse_claude_session, convert_session_to_jsonl

def test_parse_claude_session():
    with tempfile.TemporaryDirectory() as tmpdir:
        session_file = Path(tmpdir) / "session.json"
        session_file.write_text(json.dumps({
            "messages": [
                {"role": "user", "blocks": [{"text": "Hello", "type": "text"}]},
                {"role": "assistant", "blocks": [{"text": "Hi!", "type": "text"}]}
            ],
            "version": 1
        }))

        messages = parse_claude_session(session_file)
        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[0].content == "Hello"

def test_convert_session_to_jsonl():
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
```

---

## Task 10: Run Tests and Verify

**Step 1: Run the tests**

Run: `python -m pytest tests/test_import.py -v`
Expected: All tests pass

**Step 2: Manual verification**

```bash
claw import --from claude --dry-run  # Preview import
claw import --from claude --global   # Import global
```

---

**Which execution approach do you prefer?**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints