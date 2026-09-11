# Multi-active tasks

The harness can juggle **several specs at once** — the "parallel AI intern"
model. Each spec is its own on-disk task box; an agent can drive one feature
while remembering two others, switching without losing context and without one
task gatekeeping another.

## One list, one focus

Replace the old single `active.json` pointer with an **active-task list**.

```json
[
  { "taskId": "speca", "specRoot": "plans/SpecA", "primary": true },
  { "taskId": "specb", "specRoot": "plans/SpecB", "primary": false }
]
```

- **Active list** = the agent's working set (all specs in play).
- **Primary** = the current focus; only it drives the gates (edit/step/scope).
- Progress always lives in each task's box under `state/tasks/<id>/`
  (`LEDGER` / `INDEX` / `EVIDENCE`), so any task is recallable by `intern_index`.

## Commands

| Command | What it does |
|---------|--------------|
| `internify index <spec>` | Add spec to the active list, set as primary |
| `internify index <spec2>` | Add spec2, make it primary; spec1 stays listed |
| `internify allstatus` | List every active task + compact progress |
| `intern_status` (tool) `all=true` | Same inside the agent |
| `internify boot` | `CONTEXT.md`: `## Active tasks` (all) + `## Focus` (primary) |

Switching focus never loses context: re-indexing an idle task restores its own
LEDGER state, and a `done`/idle task on the list never blocks the active one.

## Primary-aware gates

Gates resolve against the **primary** ledger only. This decouples "what I'm
aware of" (the whole list) from "what I'm editing" (the focus). That's what
lets an agent spec one feature while bugfixing another and implementing a
third — all without hallucinating any thread.
