# CLAUDE.md Import Sync Design

## Overview

Add support for importing all Claude Code data into ClawCode via `claw import --from claude` command.

## User Requirements

- **Import scope**: All Claude Code data including sessions, MCP, plugins, skills, settings, LLM config, security config
- **Import mode**: Manual CLI command with periodic sync support
- **Scope**: Both global (~/.claude/) and project-local (.claude/) configs
- **Conflict handling**: Show diff, user confirms "apply all" with remember choice for same-type conflicts

## Data Mapping

| Claude Code (.claude/) | ClawCode (.claw/) | Notes |
|------------------------|-------------------|-------|
| `sessions/*.json` | `sessions/*.jsonl` | JSON → JSONL format conversion |
| `settings.json` | `config/settings.json` | Remapped path |
| `mcp.json` | `config/mcp.json` | Direct copy |
| `plugins/` | `plugins/` | Similar structure |
| `skills/` | `skills/` | Direct copy |
| `CLAUDE.md` | `.claude.md` | Root config |

## Implementation Phases

### Phase 1: CLI Framework + Session Import

1. Create `claw import` subcommand
2. Implement session history import with JSON → JSONL conversion
3. Basic diff display for conflicts

### Phase 2: Config/MCP/Plugins/Skills Import

1. MCP configuration import
2. Plugin configuration import
3. Skills import
4. Settings import (LLM, security)

### Phase 3: Conflict Resolution UI

1. Interactive diff viewer
2. "Apply all" with type-based remember
3. Per-item skip/apply choices

## Command Interface

```bash
claw import --from claude        # Import current project
claw import --from claude --global  # Import global config
claw import --from claude --all   # Import everything
claw import --from claude --dry-run  # Preview without applying
```

## Conflict Handling Flow

```
1. Detect conflict
2. Show diff (side-by-side or unified)
3. User choices:
   - [Apply All] → Remember choice for same type, continue
   - [Skip] → Keep ClawCode version
   - [View Details] → Per-item confirmation
```

## Technical Notes

- Session format conversion: JSON `{messages: [...]}` → JSONL one message per line
- MCP servers: Direct mapping, verify executable availability
- Plugins: Copy plugin directory, validate hooks
- Settings: Deep merge with conflict detection at field level