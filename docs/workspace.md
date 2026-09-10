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
| `dailyDir` | daily log folder, relative to `knowledge` (default `daily`) |
| `scan` | extra project files/dirs to include in the scan (relative to `target`) |
| `scanIgnore` | extra paths to skip during the scan (relative to `target`) |

You can also create it via init:

```bash
internify init --knowledge intern --plansDir superpowers/plans --target my-project
internify init --profile advanced      # PARA: writes plansDir=01-projects, dailyDir=06-daily
```

### Advanced profile (PARA / second brain)

```bash
internify init --profile advanced
```

Scaffolds:

```
<knowledge>/
├── 00-inbox/  01-projects/  02-areas/  03-resources/
├── 04-archive/  05-templates/  06-daily/
├── rules.md
└── roles/
```

and writes `internify.json` with `plansDir: "01-projects"`, `dailyDir: "06-daily"`.
See [Structure profiles](structure.md).

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
    ├── project-files.json       ← scan manifest (path + hash)
    ├── PROJECT_CONTEXT.md       ← scanned project AI files (bundle)
    └── tasks/<taskId>/{INDEX.md,LEDGER.md,EVIDENCE.md}
```

`state/active.json` is machine-local (git-ignore it). Task artifacts are meant to
be committed.

## Project AI context (`internify scan`)

internify can discover AI-relevant files **inside the project code** (`target`)
and inject them into the session context: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
`OPENCODE.md`, `docs/`, `.cursor/rules/`, `.claude/`, `.opencode/`, `.github/`,
`skills/`, and `*.skills.md` / `*.ai.md`.

- **Whitelist, not a full-tree scan.** `Pods/`, `node_modules`, `.git`, build
  and vendor dirs are skipped; depth is capped.
- **Lazy + cached.** `boot` walks the project once if no cache exists, then
  only re-reads files whose size or mtime changed. Full content is written to
  `state/PROJECT_CONTEXT.md` only when something changed.
- **Explicit refresh** whenever you want:

  ```bash
  internify scan
  ```

- **Tune it** in `internify.json`: `scan` (extra includes) and `scanIgnore`
  (extra skips).
- **Off switch**: `INTERN_SCAN=off` disables the auto-scan at boot (explicit
  `internify scan` still works).
- The discovered file list appears in `CONTEXT.md` under **Project AI files**;
  the full contents live in `state/PROJECT_CONTEXT.md`. Discovered docs are
  read-only inputs, never rewritten.
