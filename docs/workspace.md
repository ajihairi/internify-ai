# Workspace & config

internify separates three locations:

| Concept | Meaning | Default |
|---------|---------|---------|
| **root** | the workspace you open | cwd (or `INTERNIFY_ROOT`) |
| **knowledge** | rules, roles, plans, daily, state | `<root>/.intern` |
| **target** | the project code (edits are scoped here) | `root` |

## Mode A — everything together (default)

```
my-workspace/
├── .intern/
├── AGENTS.md
├── opencode.json
└── my-project/
```

No config file needed.

## Mode B — project beside the tool

Keep the project clean, or point at a non-standard knowledge dir, with
`internify.json` at the workspace root:

```json
{
  "knowledge": "intern",
  "plansDir": "superpowers/plans",
  "target": "my-project"
}
```

| Key | Meaning |
|-----|---------|
| `target` | where the project code lives (relative to root, or absolute) |
| `knowledge` | where the knowledge dir lives (relative to root, or absolute) |
| `plansDir` | plans folder, relative to `knowledge` (default `plans`) |

You can also create it via init:

```bash
internify init --knowledge intern --plansDir superpowers/plans --target my-project
```

!!! tip "Open the tool at the workspace root"
    Scope paths are workspace-relative. Opening the AI tool at the workspace root
    keeps them free of `..`.

## The knowledge dir

```
<knowledge>/
├── rules.md
├── roles/
├── plans/<SpecName>/{SPECmd,Plan,Task}.md
├── daily/DD-MM-YYYY.md
└── state/                       ← runtime
    ├── active.json
    ├── CONTEXT.md
    └── tasks/<taskId>/{INDEX.md,LEDGER.md,EVIDENCE.md}
```

`state/active.json` is machine-local (git-ignore it). Task artifacts are meant to
be committed.
