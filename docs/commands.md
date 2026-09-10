# Slash commands

internify ships one slash command — `/work` — and, on opencode, a set of
`intern_*` tools. Together they drive the loop.

## `/work`

Start (or resume) a task from a spec folder.

```text
/work <spec-folder>
```

Example:

```text
/work .intern/plans/FeatureX
```

It walks the agent through the loop: **index → read → step → edit → evidence →
close**. If it tries to edit before reading, go out of scope, or close without
proof, a gate blocks it.

The command is **generated per provider** by `internify init` (or
`internify commands generate`). Where it lands:

| Provider | Path | Format |
|----------|------|--------|
| opencode | `.opencode/command/work.md` | Markdown |
| Claude Code | `.claude/commands/work.md` | Markdown |
| Gemini CLI | `.gemini/commands/work.toml` | TOML |
| Qwen | `.qwen/commands/work.md` | Markdown |
| Cursor | `.cursor/rules/work.mdc` | MDC |

The opencode variant drives the `intern_*` tools; the others call the
`internify` CLI (they have no tool hooks).

### The opencode command body

```markdown
Work on the spec folder: $ARGUMENTS

1. Call `intern_index` with `specRoot="$ARGUMENTS"`.
2. Read every required read with the `read` tool (required reads MUST use `read`).
3. For each plan step in the LEDGER, in order:
   a. `intern_step` with the step id + anchor
   b. edit only files in Scope
   c. `intern_evidence` with claim + proof + result
4. When all steps pass, call `intern_close`.
```

## Tools (opencode)

| Tool | What it does |
|------|--------------|
| `intern_boot` | Collect session context → `CONTEXT.md` |
| `intern_index` | Scan a spec → `INDEX.md`, start/resume a task |
| `intern_context` | Return a minimal slice (one section / one function) |
| `intern_step` | Declare the active step + anchor |
| `intern_evidence` | Append a proof record for a step |
| `intern_close` | Validate evidence, append the daily log, finish |
| `intern_status` | Show phase + ledger |
| `intern_override` | One-shot, recorded gate bypass |

## CLI equivalents

Providers without tool hooks use the CLI:

```bash
internify index <spec-folder>
internify read <path>
internify step <id> <anchor>
internify gate edit <file>        # exit 1 if blocked
internify evidence <step> --claim "…" --proof "…" --result pass
internify close
```

## Seeing available commands

| Tool | How |
|------|-----|
| opencode | type `/` in the TUI (or `/help`) — lists `.opencode/command/*.md` |
| Claude Code | commands in `.claude/commands/` |
| Gemini CLI | `.gemini/commands/*.toml` |
| Cursor | rules in `.cursor/rules/` |

## Generating commands

```bash
internify commands generate [dir] [--providers opencode,claude,gemini,qwen,cursor]
```

`init` also generates the command for the chosen `--tool`.
