---
name: intern-context
description: Use at the START of every new session in this repo, before discussing or editing anything, to collect and externalize context. Trigger keywords: new session, start work, resume, bugfix, continue task, "what am I working on".
---

# intern-context — Session Boot

Goal: collect context onto disk so the agent never relies on memory and never
gets lost in a new session.

## Steps

1. Call the `intern_boot` tool (no arguments). It reads:
   - a pointer to `rules.md` (the rules themselves are loaded via `AGENTS.md`)
   - the latest daily log in `.intern/daily/`
   - `.intern/state/active.json` + LEDGER (if any)
   - the available specs under `.intern/plans/`
   and writes `.intern/state/CONTEXT.md`.

2. Show a 5-line brief to the user: last focus, active task + phase, pending
   reads, available specs, next actions.

3. Wait for direction. Do not edit anything until the user picks a path
   (discuss / bugfix / `/work <spec>`).

## Fallback (plugin off or `intern_boot` fails)

Do the same manually, producing identical output:
1. Read `rules.md`.
2. Find and read the latest daily file in `.intern/daily/` (`DD-MM-YYYY.md`).
3. Read `.intern/state/active.json` and its LEDGER if present.
4. List the folders under `.intern/plans/`.
5. Write `.intern/state/CONTEXT.md` with the write tool (same schema).
