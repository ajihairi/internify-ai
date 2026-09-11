# Commands

There are three kinds of "command" in internify — don't mix them up:

1. **Slash commands** you type inside the AI chat: `/internify.work`,
   `/internify.boot`, `/internify.status`.
   (On Claude Code they are namespaced: `/internify:work`, etc.)
2. **Tools** the agent calls for you (opencode): `intern_*`. You do **not** type
   these.
3. **Terminal commands** (any tool): `internify …`.

---

## In your AI chat

### Slash commands (you type them)

| Command | What it does |
|---------|--------------|
| `/internify.work <spec-folder>` | Start/resume a task — scaffolds the spec if missing, then runs the loop |
| `/internify.spec <Name>` | Scaffold a new spec, then author its SPECmd/Plan/Task |
| `/internify.boot` | Collect/refresh the session context from disk |
| `/internify.status` | Show the current phase, active step, pending reads, and last daily's unfinished items |
| `/internify.review` | Review the active task: done / pending / risks |
| `/internify.daily` | Summarize today's work into the daily log |
| `/internify.monthly` | Build a monthly timesheet from the daily logs |
| `/internify.help` | List the internify commands |

They are generated per provider by `internify init`, or
`internify commands generate`:

| Provider | Location | Command |
|----------|----------|---------|
| opencode | `.opencode/command/internify.work.md` | `/internify.work` |
| Claude Code | `.claude/commands/internify/work.md` | `/internify:work` |
| Gemini CLI | `.gemini/commands/internify.work.toml` | `/internify.work` |
| Qwen | `.qwen/commands/internify.work.md` | `/internify.work` |
| Cursor | `.cursor/rules/internify-work.mdc` | rule |

In **opencode**, type `/` in the TUI to see the available commands.

### Tools (the agent calls them — you don't type them)

`intern_boot` is a **tool**, not a slash command. You don't type `/intern_boot`;
you type `/internify.boot`, and that tells the agent to call the `intern_boot`
tool.

| Tool | What it does |
|------|--------------|
| `intern_boot` | Collect session context → `CONTEXT.md` |
| `intern_spec` | Scaffold a new spec folder from the template |
| `intern_scan` | Collect project AI files into the state cache |
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
| `internify spec new <Name> [--role <role>] [--if-missing]` | Scaffold a spec folder from the template |
| `internify spec list` | List spec folders under the plans directory |
| `internify scan` | Cache project AI files into `state/` ([scan](scan.md)) |
| `internify boot` | Collect session context → `state/CONTEXT.md` |
| `internify index <spec-folder>` | Build `INDEX.md`, start/resume a task |
| `internify read <path>` | Print a file and mark a required read done |
| `internify context <path> <selector>` | Return a minimal slice |
| `internify step <id> <anchor>` | Declare the active step |
| `internify evidence <step> --claim … --proof … --result pass` | Record proof |
| `internify close` | Validate evidence, append daily, finish |
| `internify status` | Show phase + ledger + last daily's unfinished items |
| `internify override <reason>` | One-shot recorded gate bypass |
| `internify gate edit <file>` | Exit 1 if the file is blocked |
| `internify gate bash "<cmd>"` | Exit 1 if a shell write is blocked |
| `internify skills list` | List available skill packs |
| `internify skills update [--packs …] [--force]` | Re-sync installed skill packs |
| `internify doctor` | Check environment + task health |
| `internify commands generate [dir] [--providers …]` | Generate the slash commands |
| `internify update [--force]` | Refresh spec templates |

See the [CLI reference](cli.md) for flags and examples.

---

## The loop

Both the chat command and the CLI drive the same loop:

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```
