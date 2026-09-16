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

## Rework in multi-task

Reworking a done task doesn't break parallel tasks. Each task has its own
revision counter and evidence chain. When you `internify rework <spec>`:

- Only that task's phase resets to orient
- Other tasks remain untouched
- The reworked task gets `revision: N+1`
- Old evidence is preserved under `## Revision N`

```
/internify.work FeatureA              # FeatureA = focus
# ... finish FeatureA ...
/internify.work FeatureB              # switch to FeatureB
/internify.rework FeatureA            # rework FeatureA (revision++)
/internify.status --all               # both tasks still listed
```

## Primary-aware gates

Gates resolve against the **primary** ledger only. This decouples "what I'm
aware of" (the whole list) from "what I'm editing" (the focus). That's what
lets an agent spec one feature while bugfixing another and implementing a
third — all without hallucinating any thread.
