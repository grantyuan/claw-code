from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .importers.session_importer import import_claude_sessions
from .importers.config_importer import import_claude_config
from .importers.mcp_importer import import_mcp_config
from .importers.plugin_importer import import_plugins
from .importers.skills_importer import import_skills
from .importers.conflict_resolver import ConflictResolver, Conflict, ConflictChoice


DEFAULT_CLAUDE_DIR = Path.home() / ".claude"
DEFAULT_CLAW_DIR = Path(".claw")


def find_claude_dirs(include_global: bool = True, include_local: bool = True) -> list[Path]:
    dirs = []
    if include_global:
        global_dir = DEFAULT_CLAUDE_DIR
        if global_dir.exists():
            dirs.append(global_dir)
    if include_local:
        local_dir = Path(".claude")
        if local_dir.exists():
            dirs.append(local_dir)
    return dirs


def run_import(
    claude_dirs: list[Path],
    claw_dir: Path,
    import_all: bool = True,
    dry_run: bool = False,
    verbose: bool = False
) -> dict[str, Any]:
    results = {
        "claw_dir": str(claw_dir),
        "sources": [],
        "summary": {"sessions": 0, "settings": 0, "mcp": 0, "plugins": 0, "skills": 0}
    }

    for claude_dir in claude_dirs:
        source_result = {
            "path": str(claude_dir),
            "imported": []
        }

        sessions_result = import_claude_sessions(claude_dir, claw_dir)
        if sessions_result.get("imported", 0) > 0 or sessions_result.get("skipped", 0) > 0:
            source_result["imported"].append(f"sessions: {sessions_result['imported']} messages, {sessions_result['skipped']} skipped")
            results["summary"]["sessions"] += sessions_result.get("imported", 0)

        if import_all:
            config_result = import_claude_config(claude_dir, claw_dir, dry_run=dry_run)
            if config_result.get("settings", {}).get("imported"):
                source_result["imported"].append("settings")
                results["summary"]["settings"] += 1

            mcp_result = import_mcp_config(claude_dir, claw_dir)
            if mcp_result.get("imported"):
                source_result["imported"].append(f"mcp: {len(mcp_result.get('servers', []))} servers")
                results["summary"]["mcp"] += len(mcp_result.get("servers", []))

            plugins_result = import_plugins(claude_dir, claw_dir / "plugins")
            if plugins_result.get("imported", 0) > 0:
                source_result["imported"].append(f"plugins: {plugins_result['imported']}")
                results["summary"]["plugins"] += plugins_result["imported"]

            skills_result = import_skills(claude_dir, claw_dir / "skills")
            if skills_result.get("imported", 0) > 0:
                source_result["imported"].append(f"skills: {skills_result['imported']}")
                results["summary"]["skills"] += skills_result["imported"]

        results["sources"].append(source_result)

    return results


def print_import_summary(results: dict[str, Any]) -> None:
    print("=" * 50)
    print("Claude Import Summary")
    print("=" * 50)
    print(f"Target: {results['claw_dir']}")
    print()

    for source in results["sources"]:
        print(f"Source: {source['path']}")
        for item in source.get("imported", []):
            print(f"  - {item}")
        print()

    print("Totals:")
    for key, value in results["summary"].items():
        print(f"  {key}: {value}")


class ImportCommand:
    name = "import"
    help = "Import data from Claude Code"

    @staticmethod
    def add_args(parser: argparse.ArgumentParser) -> None:
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
            help="Import global config (~/.claude)"
        )
        parser.add_argument(
            "--local",
            dest="is_local",
            action="store_true",
            help="Import local config (.claude in cwd)"
        )
        parser.add_argument(
            "--all",
            dest="import_all",
            action="store_true",
            default=True,
            help="Import everything (sessions, config, MCP, plugins, skills)"
        )
        parser.add_argument(
            "--sessions-only",
            dest="sessions_only",
            action="store_true",
            help="Import only session history"
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help="Preview without applying"
        )
        parser.add_argument(
            "--verbose",
            "-v",
            action="store_true",
            help="Verbose output"
        )
        parser.add_argument(
            "--claw-dir",
            dest="claw_dir",
            type=str,
            default=".claw",
            help="Target ClawCode directory (default: .claw)"
        )

    @staticmethod
    def execute(args: argparse.Namespace) -> int:
        if args.source != "claude":
            print(f"Unsupported source: {args.source}", file=sys.stderr)
            return 1

        include_global = args.is_global
        include_local = args.is_local or not args.is_global

        claude_dirs = find_claude_dirs(include_global=include_global, include_local=include_local)
        if not claude_dirs:
            print("No Claude Code directories found.", file=sys.stderr)
            return 1

        claw_dir = Path(args.claw_dir)

        if args.verbose:
            print(f"Importing from: {[str(d) for d in claude_dirs]}")
            print(f"Target: {claw_dir}")

        results = run_import(
            claude_dirs=claude_dirs,
            claw_dir=claw_dir,
            import_all=not args.sessions_only,
            dry_run=args.dry_run,
            verbose=args.verbose
        )

        if args.verbose or not args.dry_run:
            print_import_summary(results)

        if args.dry_run:
            print("\n(Dry run - no changes made)")

        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import data from Claude Code")
    ImportCommand.add_args(parser)
    args = parser.parse_args(argv)
    return ImportCommand.execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
