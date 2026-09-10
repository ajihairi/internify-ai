# Quick start

## Set up a workspace

```bash
mkdir my-workspace && cd my-workspace

# 1. clone your project
git clone git@github.com:you/my-project.git

# 2. install + wire internify (scaffolds .intern/ + AGENTS.md)
internify init --tool opencode      # or: --tool claude | --tool none
```

`init` never overwrites existing files. It creates `.intern/` + `AGENTS.md` and
wires the provider:

| `--tool` | What it does |
|----------|--------------|
| `opencode` (default) | adds the adapter plugin to `opencode.json` |
| `claude` | adds a `PreToolUse` hook to `.claude/settings.json` |
| `none` | CLI only (no provider wiring) |

Options: `internify init [dir] [--knowledge <name>] [--target <dir>] [--plansDir <dir>]`.

## Restart and work

Restart the AI tool (config is not hot-reloaded), then start a spec:

```text
/internify.work .intern/plans/<SpecName>
```

## "My workspace only has a code repo"

That is fine.

Before:

```
my-workspace/
└── my-project/        ← just your code
```

After `internify init`:

```
my-workspace/
├── .intern/           ← knowledge (rules, roles, plans, daily, state)
├── AGENTS.md
├── opencode.json      ← opencode wiring   (or .claude/ for Claude)
└── my-project/        ← your code, untouched
```

Want the AI files **outside** the repo (keep it 100% clean)? See
[Workspace & config](../workspace.md) (Mode B).

## Turning it off / on

internify watches `INTERN_HARNESS` (only the exact value `off` disables it):

```bash
INTERN_HARNESS=off opencode      # OFF, just this run
export INTERN_HARNESS=off        # OFF for the shell
unset INTERN_HARNESS             # ON again
```
