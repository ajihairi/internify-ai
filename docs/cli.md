# CLI reference

Workspace root = current directory, or `INTERNIFY_ROOT`. Knowledge dir defaults
to `<root>/.intern`; override via `<root>/internify.json`.

## Commands

| Command | Description |
|---------|-------------|
| `internify init [dir] [--tool opencode\|claude\|none] [--knowledge <name>] [--profile simple\|advanced] [--target <dir>] [--plansDir <dir>] [--dailyDir <dir>] [--skills all\|none\|a,b] [--yes]` | Scaffold knowledge + wire the provider (+ optional skill packs) |
| `internify skills list` | List available skill packs |
| `internify doctor` | Check environment + task health |
| `internify commands generate [dir] [--providers opencode,claude,gemini,qwen,cursor]` | Generate the `internify.*` commands per provider |
| `internify update [--force]` | Refresh spec templates (`--force` also refreshes `rules.md` + `roles/`) |
| `internify spec new <Name> [--role <role>] [--if-missing]` | Scaffold a spec folder from the template (`<SpecName>`, `<role>`, `<YYYY-MM-DD>` filled; `--if-missing` fills only absent files and never overwrites) |
| `internify spec list` | List spec folders under the plans directory |
| `internify scan` | Cache project AI files (`AGENTS.md`, `docs/`, skills, ...) into `state/` |
| `internify boot` | Collect session context → `state/CONTEXT.md` |
| `internify index <spec-folder>` | Build `INDEX.md`, start/resume a task |
| `internify read <path>` | Print a file and mark a required read as done |
| `internify context <path> <selector> [--kind section\|function]` | Return a minimal slice |
| `internify step <id> <anchor>` | Declare the active step |
| `internify evidence <step> --claim <c> --proof <p> --result pass\|fail` | Record proof for a step |
| `internify close` | Validate evidence, append the daily log, finish |
| `internify status` | Show phase + ledger |
| `internify override <reason>` | One-shot recorded gate bypass |
| `internify gate edit <file>` | Exit 1 if the file is blocked |
| `internify gate bash "<command>"` | Exit 1 if a shell write is blocked |

## Env

| Variable | Effect |
|----------|--------|
| `INTERNIFY_ROOT` | Workspace root (default: cwd) |
| `INTERN_HARNESS=off` | Disable gating (CLI still works) |

## Examples

```bash
internify boot
internify spec new FeatureX                     # scaffold plans/FeatureX
internify index .intern/plans/FeatureX
internify read src/Feature.swift
internify step S1 A1
internify gate edit src/Feature.swift            # exit 1 if blocked
internify evidence S1 --claim "wired title" --proof "read src/Feature.swift" --result pass
internify close
```

## Using it from any tool

`gate edit` / `gate bash` make it easy to enforce from a git hook or a
tool-specific wrapper:

```bash
internify gate edit "$FILE" || exit 1
```
