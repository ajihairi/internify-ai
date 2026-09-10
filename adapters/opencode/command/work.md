---
description: Start/resume a harnessed work task from a spec folder.
agent: build
---

Work on the spec folder: $ARGUMENTS

Steps:
1. Call `intern_index` with `specRoot="$ARGUMENTS"`.
2. For every required read listed by the harness, use the `read` tool. Required reads MUST be read with `read` — `intern_context` does NOT satisfy Gate 1. Use `intern_context` only for extra, non-required slices.
3. For each plan step in `intern/state/tasks/<id>/LEDGER.md`, in order:
   a. Call `intern_step` with the step id and its anchor (the anchor is recorded in LEDGER.md).
   b. Edit only files in Scope.
   c. Call `intern_evidence` with claim + proof + result.
4. When all steps pass, call `intern_close`.
