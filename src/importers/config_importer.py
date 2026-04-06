from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_claude_settings(claude_dir: Path) -> dict[str, Any]:
    settings_path = claude_dir / "settings.json"
    if settings_path.exists():
        return json.loads(settings_path.read_text())
    return {}


def load_claude_mcp(claude_dir: Path) -> dict[str, Any]:
    mcp_path = claude_dir / "mcp.json"
    if mcp_path.exists():
        return json.loads(mcp_path.read_text())
    return {}


def merge_settings(claw_settings: dict[str, Any], claude_settings: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    merged = dict(claw_settings)
    conflicts = []

    for key, value in claude_settings.items():
        if key in merged:
            if merged[key] != value:
                conflicts.append({
                    "key": key,
                    "source": "claude",
                    "source_value": value,
                    "target_value": merged[key]
                })
            else:
                pass
        else:
            merged[key] = value

    return merged, conflicts


def save_claude_settings(settings: dict[str, Any], claw_dir: Path) -> Path:
    settings_path = claw_dir / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings_path.write_text(json.dumps(settings, indent=2))
    return settings_path


def save_claude_mcp(mcp_config: dict[str, Any], claw_dir: Path) -> Path:
    mcp_path = claw_dir / "mcp.json"
    mcp_path.parent.mkdir(parents=True, exist_ok=True)
    mcp_path.write_text(json.dumps(mcp_config, indent=2))
    return mcp_path


def import_claude_config(claude_dir: Path, claw_dir: Path, dry_run: bool = False) -> dict[str, Any]:
    claude_settings = load_claude_settings(claude_dir)
    claude_mcp = load_claude_mcp(claude_dir)

    results = {
        "settings": {"imported": False, "conflicts": []},
        "mcp": {"imported": False, "errors": []}
    }

    if claude_settings:
        settings_path = save_claude_settings(claude_settings, claw_dir)
        results["settings"]["imported"] = True
        results["settings"]["path"] = str(settings_path)

    if claude_mcp:
        mcp_path = save_claude_mcp(claude_mcp, claw_dir)
        results["mcp"]["imported"] = True
        results["mcp"]["path"] = str(mcp_path)

    return results
