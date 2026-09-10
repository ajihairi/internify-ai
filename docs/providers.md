# Providers

internify plugs the same loop into different AI tools.

| Provider | Integration | Enforces |
|----------|-------------|----------|
| opencode | plugin (`tool.execute.before/after`) + skill + `/work` | edit / write / bash |
| Claude Code | `PreToolUse` hook (`adapters/claude/hook.ts`) | Edit / Write / MultiEdit / Bash |
| any (CLI) | `internify gate edit` / `internify gate bash` | via git hooks or wrappers |

`internify init --tool <name>` wires it for you.

## opencode

`init` adds the adapter plugin to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["<path>/internify-ai/adapters/opencode/plugins/intern-harness.ts"]
}
```

Registered tools: `intern_boot`, `intern_index`, `intern_context`, `intern_step`,
`intern_evidence`, `intern_close`, `intern_status`, `intern_override`.

Hooks re-inject state every turn (`experimental.chat.system.transform`), gate
edits (`tool.execute.before`), track reads (`tool.execute.after`), and inject the
ledger on compaction.

## Claude Code

`init` adds a `PreToolUse` hook to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "bun \"<path>/adapters/claude/hook.ts\"" }]
      }
    ]
  }
}
```

The hook reads the tool payload on stdin, evaluates the same gates, and exits `2`
(block) with a reason on stderr when the action is not allowed.

## Any tool (CLI)

Call the CLI from a git hook or wrapper:

```bash
internify gate edit "$FILE"      # exit 1 if blocked
internify gate bash "$COMMAND"
```

## Disable

Set `INTERN_HARNESS=off` to disable the opencode plugin and the Claude hook. The
CLI still works.
