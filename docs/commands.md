# Commands

There are three kinds of "command" in internify — don't mix them up:

1. **Slash commands** you type inside the AI chat: `/work`, `/boot`, `/status`.
2. **Tools** the agent calls for you (opencode): `intern_*`. You do **not** type
   these.
3. **Terminal commands** (any tool): `internify …`.

---

## In your AI chat

### Slash commands (you type them)

| Command | What it does |
|---------|--------------|
| `/work <spec-folder>` | Start/resume a task — runs the whole loop |
| `/boot` | Collect/refresh the session context from disk |
| `/status` | Show the current phase, active step, and pending reads |

They are generated per provider by `internify init`, or
`internify commands generate`:

| Provider | Location | Format |
|----------|----------|--------|
| opencode | `.opencode/command/{work,boot,status}.md` | Markdown |
| Claude Code | `.claude/commands/{work,boot,status}.md` | Markdown |
| Gemini CLI | `.gemini/commands/{work,boot,status}.toml` | TOML |
| Qwen | `.qwen/commands/{work,boot,status}.md` | Markdown |
| Cursor | `.cursor/rules/{work,boot,status}.mdc` | MDC |

In **opencode**, type `/` in the TUI to see the available commands.

### Tools (the agent calls them — you don't type them)

`intern_boot` is a **tool**, not a slash command. You don't type `/intern_boot`;
you type `/boot`, and that tells the agent to call the `intern_boot` tool.

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

Providers without tool hooks (Gemini, Qwen, Cursor) use the CLI instead.

---

## In your terminal

| Command | What it does |
|---------|--------------|
| `internify init [dir] [--tool …] [--profile …] [--skills …]` | Scaffold + wire a provider |
| `internify boot` | Collect session context → `state/CONTEXT.md` |
| `internify index <spec-folder>` | Build `INDEX.md`, start/resume a task |
| `internify read <path>` | Print a file and mark a required read done |
| `internify context <path> <selector>` | Return a minimal slice |
| `internify step <id> <anchor>` | Declare the active step |
| `internify evidence <step> --claim … --proof … --result pass` | Record proof |
| `internify close` | Validate evidence, append daily, finish |
| `internify status` | Show phase + ledger |
| `internify override <reason>` | One-shot recorded gate bypass |
| `internify gate edit <file>` | Exit 1 if the file is blocked |
| `internify gate bash "<cmd>"` | Exit 1 if a shell write is blocked |
| `internify skills list` | List available skill packs |
| `internify commands generate [dir] [--providers …]` | Generate the slash commands |
| `internify update [--force]` | Refresh spec templates |

See the [CLI reference](cli.md) for flags and examples.

---

## The loop

Both the chat command and the CLI drive the same loop:

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```
