from __future__ import annotations

import json
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any


@dataclass
class ClawMessage:
    role: str
    content: str
    timestamp_ms: int = 0


def parse_claude_session(path: Path) -> list[ClawMessage]:
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
    messages = parse_claude_session(claude_path)
    claw_path.parent.mkdir(parents=True, exist_ok=True)
    with open(claw_path, "w") as f:
        for msg in messages:
            line = json.dumps({"message": {"role": msg.role, "content": msg.content}})
            f.write(line + "\n")
    return len(messages)


def import_claude_sessions(claude_dir: Path, claw_dir: Path) -> dict[str, Any]:
    sessions_dir = claude_dir / "sessions"
    if not sessions_dir.exists():
        return {"imported": 0, "skipped": 0, "errors": []}

    claw_sessions_dir = claw_dir / "sessions"
    claw_sessions_dir.mkdir(parents=True, exist_ok=True)

    imported = 0
    skipped = 0
    errors = []

    for session_file in sessions_dir.glob("session-*.json"):
        try:
            target_file = claw_sessions_dir / f"{session_file.stem}.jsonl"
            if target_file.exists():
                skipped += 1
                continue
            count = convert_session_to_jsonl(session_file, target_file)
            imported += count
        except Exception as e:
            errors.append(f"{session_file.name}: {e}")

    return {"imported": imported, "skipped": skipped, "errors": errors}
