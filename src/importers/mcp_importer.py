from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_mcp_config(claude_dir: Path) -> dict[str, Any]:
    mcp_path = claude_dir / "mcp.json"
    if mcp_path.exists():
        return json.loads(mcp_path.read_text())
    return {}


def validate_mcp_servers(config: dict[str, Any]) -> list[str]:
    errors = []
    for name, server_config in config.get("mcpServers", {}).items():
        cmd = server_config.get("command", "")
        args = server_config.get("args", [])
        if cmd:
            pass
    return errors


def import_mcp_config(claude_dir: Path, claw_dir: Path) -> dict[str, Any]:
    config = load_mcp_config(claude_dir)
    if not config:
        return {"imported": False, "reason": "no mcp.json found"}

    validation_errors = validate_mcp_servers(config)

    target_path = claw_dir / "mcp.json"
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(config, indent=2))

    return {
        "imported": True,
        "path": str(target_path),
        "servers": list(config.get("mcpServers", {}).keys()),
        "validation_errors": validation_errors
    }
