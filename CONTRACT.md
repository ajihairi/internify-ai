# internify-ai — Contract

The stable interface between the **core** and any **tool adapter**. Keep this
stable and you can change tools without rewriting the workflow.

Four things must stay fixed: **file schemas**, **actions**, **gates**, and
**layout**.

---

## 1. Layout

```
<workspace>/
├── AGENTS.md                  ← entry: boot instruction + pointers
└── .intern/
    ├── rules.md
    ├── roles/
    ├── plans/<SpecName>/{SPECmd,Plan,Task}.md
    ├── daily/DD-MM-YYYY.md
    └── state/                 ← runtime (git-ignore active.json)
        ├── active.json
        ├── CONTEXT.md
        └── tasks/<taskId>/{INDEX.md,LEDGER.md,EVIDENCE.md}
```

A spec folder `.intern/plans/<SpecName>/` is the **unit of work**.

`<root>/internify.json` (optional) sets
`{ "target": "…", "knowledge": "…", "plansDir": "…" }` to separate the project
root from the knowledge dir, and to point at a non-standard plans folder
(Mode B). Defaults: `target == root`, `knowledge == <root>/.intern`,
`plansDir == <knowledge>/plans`.

## 2. File schemas

Machine-readable data is stored as JSON inside markdown, delimited by:

```
<!-- intern:<tag>:begin -->
{ ...json... }
<!-- intern:<tag>:end -->
```

Tags: `ledger`, `index`. `CONTEXT.md` and `EVIDENCE.md` are plain markdown.

### CONTEXT.md (session pack)

```
# CONTEXT — session pack
generated: <iso8601>
## Rules
## Last daily
## Active task
## Available specs
## Next actions
```

### INDEX.md

```
{ "specRoot": "...", "generated": "...",
  "requiredReads": [{ "key", "path", "kind": "spec|code", "hash", "read" }],
  "anchors": [{ "id", "file", "line", "token", "status" }],
  "slices": [{ "key", "from", "selector" }] }
```

### LEDGER.md

```
{ "taskId", "specRoot", "role",
  "phase": "idle|orient|grounded|planned|acting|verifying|recorded|done",
  "scope": [...], "requiredReads": [...], "steps": [...],
  "decisions": [...], "openQuestions": [...], "activeStep": "...|null",
  "updated": "...", "forceAllow": false }
```

### EVIDENCE.md (append-only)

```
## <stepId> <iso8601> result=pass|fail
claim: <what was claimed>
proof: <how it was verified>
```

## 3. Actions

| Action | Meaning |
|--------|---------|
| `boot` | Collect session context → write `CONTEXT.md` |
| `index <spec-folder>` | Scan spec, build `INDEX.md`, start/resume task |
| `context <path> <selector>` | Return a minimal slice |
| `step <id> <anchor>` | Declare active step + anchor |
| `evidence <step> --claim --proof --result` | Append a proof record |
| `close` | Validate evidence, append daily log, finish |
| `status` | Show phase + ledger |
| `override <reason>` | One-shot recorded gate bypass |

## 4. Gates

| Gate | Blocks | On fail |
|------|--------|---------|
| **Read** | Edit before required reads are done | `BLOCKED: ground first. Read: …` |
| **Scope / Step** | Edit outside scope, or before a step is declared | `BLOCKED: file outside task scope…` |
| **Anchor** | Step anchor not declared by a plan step, or index status ≠ `ok` | `BLOCKED: anchor "…" is not a declared plan anchor.` |
| **Evidence** | Closing a task with a step that has no passing evidence | `BLOCKED: no passing evidence for step(s)…` |
| **Bash** | A shell write before a step, or one that doesn't touch a scoped file | `BLOCKED: bash write … Prefer the edit/write tools.` |

A gate is a **decision function**, not an error: allowed tools may proceed;
blocked tools raise and must not mutate.

## 5. Rules of the loop

- Context is written to disk and re-read every turn — never held only in memory.
- The index is **generated** from real files with hashes, never authored.
- State is fail-closed: missing/corrupt ledger blocks edits.
- Writes are confined to `.intern/state/` and `.intern/daily/`; reads/scans are
  confined to the workspace root.
- `override` is the recorded escape hatch; `INTERN_HARNESS=off` disables the
  whole thing.
