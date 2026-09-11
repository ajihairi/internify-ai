# User Guide

> **What is internify?** A small add-on that plugs into your AI coding tool
> (opencode, Claude Code, …). It does two things: keeps the agent's context
> **on disk** (so a new session never loses it), and **blocks** edits that are
> not grounded (no scope, no step, no evidence). You still talk to your normal
> AI tool — internify just makes it behave.

---

## Table of contents

- [What you need](#what-you-need)
- [Setup](#setup)
- [Core concepts](#core-concepts)
- [Daily workflow](#daily-workflow)
- [Multi-task (parallel)](#multi-task-parallel)
- [Bugfix + feature at the same time](#bugfix--feature-at-the-same-time)
- [Priority and focus switching](#priority-and-focus-switching)
- [Commands reference](#commands-reference)
- [The knowledge dir](#the-knowledge-dir)
- [Edge cases](#edge-cases)
- [Troubleshooting](#troubleshooting)

---

## What you need

- [Bun](https://bun.sh) runtime
- An AI coding tool (opencode, Claude Code, etc.)
- A project folder (your app, library, etc.)

## Setup

```bash
# From your project root:
bunx internify-ai init

# Follow the prompts:
# 1. Pick your AI tool (opencode, claude, etc.)
# 2. Pick knowledge profile (simple is fine to start)
```

This creates:
- `.intern/` — the knowledge dir (rules, specs, state, daily logs)
- `AGENTS.md` — entry point for AI agents
- `internify.json` — config (target project, knowledge dir)

## Core concepts

### The knowledge dir (`.intern/`)

Everything lives here:

```
.intern/
├── AGENTS.md           ← entry point for AI agents
├── rules.md            ← rules the agent must follow
├── roles/              ← role-specific instructions
├── plans/              ← specs (one folder per feature)
│   └── MyFeature/
│       ├── SPECmd.md   ← WHAT (requirements, behavior)
│       ├── Plan.md     ← HOW (step-by-step plan)
│       └── Task.md     ← WHO (task list per role)
├── daily/              ← daily logs
│   └── 11-09-2026.md
└── state/              ← runtime state
    ├── active.json     ← active task list (multi-task)
    ├── CONTEXT.md      ← session context (auto-generated)
    ├── tasks/          ← per-task progress boxes
    │   └── <task-id>/
    │       ├── LEDGER.md   ← progress (phase, steps, reads)
    │       ├── INDEX.md    ← file refs, anchors
    │       └── EVIDENCE.md ← proof of work
    ├── learn-index.json   ← code knowledge (from internify learn)
    └── LEARN.md           ← code digest (module trees, symbols)
```

### The task box

Each spec/task gets its own **box** under `state/tasks/<task-id>/`:
- **LEDGER.md** — phase (orient → planned → acting → verifying → done), required reads, steps, decisions
- **INDEX.md** — file references, anchors, slices
- **EVIDENCE.md** — proof that each step was completed

This is the agent's memory. It never forgets because everything is on disk.

### Gates

The harness enforces a workflow:
1. **Read gate** — you must read required files before editing
2. **Step gate** — you must declare which step you're on
3. **Scope gate** — you can only edit files in scope
4. **Evidence gate** — you must prove each step before closing

This prevents hallucinated edits and ensures the agent stays grounded.

## Daily workflow

### Starting a session

```
/internify.boot
```

This loads the session context from disk. The agent sees:
- Rules, active task, pending reads
- All active tasks (if multi-task)
- Focus task (which one is being edited)
- Project AI files (if you ran `internify learn`)
- Code knowledge (module trees, symbols)

### Working on a feature

```
/internify.work MyFeature
```

This:
1. Indexes the spec folder (builds index, starts/resumes task)
2. Requires reading all files before editing
3. Enforces gates (step → edit → evidence → close)

### Writing a new spec

```
/internify.spec MyNewFeature
```

Scaffolds a spec folder and guides you through writing SPECmd/Plan/Task. After scaffolding, the previous task is cleared from the gate — so authoring is never blocked.

### Logging work

```
/internify.daily
```

Summarizes today's work and appends to the daily log.

## Multi-task (parallel)

You can work on **multiple specs at once**. Each gets its own progress box. The agent remembers all of them.

### How it works

```
# Start working on feature A
/internify.work FeatureA

# Later, start feature B (FeatureA stays listed)
/internify.work FeatureB

# Check all active tasks
/internify.status --all
```

Output:
```
- FeatureA | phase=acting | step=S3 | pending reads=none
- FeatureB (focus) | phase=orient | step=S1 | pending reads=5 files
```

- **Focus** = the task currently being edited (gates apply to this one)
- **Listed** = the task is remembered but not being edited right now

### Switching focus

Just re-run work on the other spec:

```
/internify.work FeatureA    # FeatureA becomes focus, FeatureB stays listed
```

No context is lost — each task's LEDGER loads right back.

## Bugfix + feature at the same time

Real scenario: you're implementing FeatureA, and a bug report comes in.

```
# 1. FeatureA is in progress
/internify.work FeatureA

# 2. Bug comes in — start a bugfix spec
/internify.spec BugFixToggle

# 3. Work on the bugfix
/internify.work BugFixToggle

# 4. Check status — both are listed
/internify.status --all
# - FeatureA | phase=acting | step=S3 | pending reads=none
# - BugFixToggle (focus) | phase=planned | step=S1 | pending reads=2 files

# 5. Fix the bug, close it
/internify.close

# 6. Back to FeatureA
/internify.work FeatureA
# FeatureA is focus again, BugFixToggle is done
```

**Key:** the bugfix doesn't lose FeatureA's progress. FeatureA's LEDGER is still there — when you switch back, it picks up exactly where you left off.

## Priority and focus switching

The **focus** task is the one driving the gates. To change priority:

```
/internify.work <other-spec>    # makes <other-spec> the focus
```

The previous focus stays on the active list (not lost). A done/idle task never gatekeeps the active one.

There is no explicit "priority" setting — the focus IS the priority. The agent always edits the focus task. To work on something else, switch focus.

## Commands reference

| Command | What it does |
|---------|--------------|
| `/internify.boot` | Load session context from disk |
| `/internify.work <spec>` | Start/resume work on a spec (sets focus) |
| `/internify.spec <name>` | Scaffold a new spec folder + author content |
| `/internify.status` | Show current focus task + progress |
| `/internify.status --all` | List ALL active tasks + progress |
| `/internify.review` | Review done/pending/risks (no edits) |
| `/internify.daily` | Summarize today's work to daily log |
| `/internify.monthly` | Build monthly timesheet |
| `/internify.close` | Validate evidence + finish task |

CLI equivalents:

```bash
internify boot
internify index <spec-folder>
internify read <path>
internify step <id> <anchor>
internify evidence <step> --claim "..." --proof "..." --result pass
internify close
internify status [--all]
internify override <reason>    # escape hatch (use sparingly)
```

## The knowledge dir

| Path | What |
|------|------|
| `.intern/rules.md` | Rules the agent follows (no build, no commit, etc.) |
| `.intern/roles/` | Role-specific instructions (UI engineer, API integrator) |
| `.intern/plans/<Spec>/` | Feature specs (SPECmd + Plan + Task) |
| `.intern/daily/` | Daily work logs |
| `.intern/state/active.json` | Active task list (multi-task) |
| `.intern/state/CONTEXT.md` | Session context (auto-generated at boot) |
| `.intern/state/tasks/<id>/` | Per-task progress (LEDGER + INDEX + EVIDENCE) |
| `.intern/state/learn-index.json` | Code knowledge index (from `internify learn`) |
| `.intern/state/LEARN.md` | Code digest (module trees, symbols) |

## Edge cases

### "The agent is editing the wrong file"

The scope gate should prevent this. If it happens:
1. Check `internify.status` — which task is focus?
2. If wrong task is focus, switch: `internify.work <correct-spec>`
3. If scope is wrong, check the spec's references

### "The agent forgot what we were doing"

Boot loads context from disk. If the agent seems lost:
1. Run `internify.boot` — reloads everything
2. Check `internify.status --all` — see all active tasks
3. The agent should remember via CONTEXT.md

### "I need to edit a file outside the spec"

If the file is in scope (listed in the spec's references), you're fine. If not:
- Add the file reference to SPECmd.md, then re-index
- Or use `internify.override <reason>` as an escape hatch

### "Two tasks are conflicting"

Tasks are independent. Each has its own scope, steps, evidence. The only shared thing is the focus — which one you're editing right now. Switching focus doesn't affect other tasks.

### "I started a task but want to abandon it"

Just switch to another task: `internify.work <other-spec>`. The abandoned task stays listed but idle. It won't block anything. You can delete it later by removing `state/tasks/<id>/`.

### "The daily log is full of old stuff"

Daily logs are just markdown notes. They don't affect gates. You can edit them freely — the daily gate exemption means daily files bypass scope.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "BLOCKED: finish the required reads first" | Run `internify.work <spec>` first, then read the listed files |
| "BLOCKED: no active step" | Call `internify.work` or declare a step |
| "BLOCKED: file outside task scope" | Add file to spec references, or use `internify.override` |
| Agent forgets context between sessions | Run `internify.boot` — loads context from disk |
| Two tasks seem to conflict | They shouldn't — check focus with `internify.status --all` |
| Want to see all progress | `internify.status --all` or `intern_status all=true` |
| Daily log not updating | `internify.daily` — summarises and appends |
| New session, no context | Run `internify.boot` — reads rules, active tasks, daily |

---

*For more, see the [docs site](https://ajihairi.github.io/internify-ai/) or the [articles](./articles/).*
