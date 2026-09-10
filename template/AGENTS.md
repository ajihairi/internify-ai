# AGENTS.md — <ProjectName>

Entry point for AI agents working in this project.

## 0. Session boot (mandatory, first)

Every new session MUST invoke the `intern-context` skill before anything else.
It collects context from disk (rules, latest daily, active task, specs), writes
`.intern/state/CONTEXT.md`, and shows a brief. Only after that: discuss / bugfix /
execute.

## How to start

1. Read `.intern/rules.md`.
2. Read the role file that matches the task: `.intern/roles/<Role>.md`.
3. Read the active spec: `.intern/plans/<SpecName>/{SPECmd,Plan,Task}.md`.
4. Check the latest daily log in `.intern/daily/`.

## Starting work

```text
/internify.work .intern/plans/<SpecName>
```

The harness enforces the loop: Boot → Index → Read → Step → Edit → Evidence →
Close. See `.intern/` artifacts under `.intern/state/` for progress.

## Rules

- The agent does **not** build, run, or commit — the human does.
- Stay within the spec's scope.
- Record evidence for every step before closing.
