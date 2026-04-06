from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ConflictChoice(Enum):
    APPLY_SOURCE = "apply_source"
    KEEP_TARGET = "keep_target"
    APPLY_ALL_SOURCE = "apply_all_source"
    SKIP_ALL = "skip_all"


@dataclass
class Conflict:
    key: str
    source_value: Any
    target_value: Any
    source_name: str = "claude"
    target_name: str = "claw"


class ConflictResolver:
    def __init__(self):
        self.remembered_choices: dict[str, ConflictChoice] = {}

    def resolve(self, conflict: Conflict) -> ConflictChoice:
        choice_key = f"{conflict.source_name}:{conflict.key}"

        if choice_key in self.remembered_choices:
            return self.remembered_choices[choice_key]

        return ConflictChoice.KEEP_TARGET

    def remember(self, choice: ConflictChoice, key_pattern: str) -> None:
        self.remembered_choices[key_pattern] = choice

    def apply_conflict_resolution(self, conflicts: list[Conflict], dry_run: bool = False) -> dict[str, Any]:
        resolutions = []
        for conflict in conflicts:
            choice = self.resolve(conflict)
            resolutions.append({
                "key": conflict.key,
                "choice": choice.value,
                "applied_value": conflict.source_value if choice in (ConflictChoice.APPLY_SOURCE, ConflictChoice.APPLY_ALL_SOURCE) else conflict.target_value
            })
        return {"resolutions": resolutions, "dry_run": dry_run}
