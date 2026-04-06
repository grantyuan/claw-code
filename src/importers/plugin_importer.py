from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def discover_plugins(claude_dir: Path) -> list[Path]:
    plugins = []
    for item in claude_dir.rglob(".claude-plugin"):
        if item.is_dir():
            plugins.append(item.parent)
    return plugins


def load_plugin_config(plugin_path: Path) -> dict[str, Any]:
    config_path = plugin_path / ".claude-plugin" / "plugin.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}


def copy_plugin(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.rglob("*"):
        if item.is_file():
            rel = item.relative_to(src)
            dest_file = dest / rel
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest_file)


def import_plugins(claude_dir: Path, claw_plugins_dir: Path) -> dict[str, Any]:
    plugins = discover_plugins(claude_dir)
    if not plugins:
        return {"imported": 0, "plugins": []}

    imported = []
    claw_plugins_dir.mkdir(parents=True, exist_ok=True)

    for plugin_path in plugins:
        plugin_name = plugin_path.name
        plugin_config = load_plugin_config(plugin_path)
        if not plugin_config:
            continue

        dest = claw_plugins_dir / plugin_name
        copy_plugin(plugin_path, dest)
        imported.append({
            "name": plugin_config.get("name", plugin_name),
            "version": plugin_config.get("version", "unknown"),
            "path": str(dest)
        })

    return {"imported": len(imported), "plugins": imported}
