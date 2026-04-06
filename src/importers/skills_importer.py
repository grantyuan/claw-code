from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def discover_skills(claude_dir: Path) -> list[Path]:
    skills_dir = claude_dir / "skills"
    if skills_dir.exists() and skills_dir.is_dir():
        return [d for d in skills_dir.iterdir() if d.is_dir()]
    return []


def load_skill_config(skill_path: Path) -> dict[str, Any]:
    config_path = skill_path / "skill.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}


def copy_skill(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.rglob("*"):
        if item.is_file():
            rel = item.relative_to(src)
            dest_file = dest / rel
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest_file)


def import_skills(claude_dir: Path, claw_skills_dir: Path) -> dict[str, Any]:
    skills = discover_skills(claude_dir)
    if not skills:
        return {"imported": 0, "skills": []}

    imported = []
    claw_skills_dir.mkdir(parents=True, exist_ok=True)

    for skill_path in skills:
        skill_name = skill_path.name
        skill_config = load_skill_config(skill_path)
        if not skill_config:
            continue

        dest = claw_skills_dir / skill_name
        copy_skill(skill_path, dest)
        imported.append({
            "name": skill_config.get("name", skill_name),
            "description": skill_config.get("description", ""),
            "path": str(dest)
        })

    return {"imported": len(imported), "skills": imported}
