# 02 — Making This AI Workflow Portable (Other Projects, Other Tools)

This article explains how to reuse the harness in another project (say, project
ABC) and with AI tools other than opencode. It is written to stand on its own.

---

## 1. The problem

A good AI workflow is usually **locked** to one project and one tool:

- Every new project → set everything up again.
- Switching AI tools (opencode → Claude Code → Codex) → all setup lost.

Yet 90% of the value is not the tool — it is the **way of working** and the
**knowledge structure**. Only the enforcement layer is tool-specific.

So the answer is: **separate what is portable from what is not.**

---

## 2. Two layers: Content vs Enforcement

| Layer | Contents | Nature |
|-------|----------|--------|
| **Content / Spec** | `AGENTS.md`, `rules`, `roles`, `plans/` (SPEC/Plan/Task), `daily/` | **Portable.** All markdown. Any AI tool can read it |
| **Enforcement / Harness** | plugins, hooks, custom tools that block actions | **Tool-specific.** opencode API ≠ Claude ≠ Codex |

Consequences:

- Content can move between projects and tools unchanged.
- Enforcement needs one **adapter** per tool.
- The two are joined by a single **contract** (see §4).

---

## 3. Anatomy of a reusable harness

```
<project>/
├── AGENTS.md                  ← entry point: boot instructions + pointers
├── .intern/                   ← any name (intern/, .ai/, harness/)
│   ├── rules.md               ← global rules
│   ├── roles/                 ← per-role instructions (UI, API, …)
│   ├── plans/                 ← one folder per feature:
│   │   └── <SpecName>/        ←   SPECmd.md + Plan.md + Task.md
│   ├── daily/                 ← daily log (decisions, progress)
│   └── state/                 ← RUNTIME: context, index, ledger, evidence
└── <adapter>/                 ← the plug into an AI tool
    ├── .opencode/             ← opencode
    ├── .claude/               ← Claude Code
    ├── .codex/                ← Codex
    └── bin/internify          ← OR a universal CLI
```

The principles that make this work:

1. **Context on disk, not in memory.** State is written to files and re-read
   every turn. New session or compaction → no loss of grounding.
2. **The index is generated, not authored.** Real files are scanned and hashed;
   the agent cannot invent paths.
3. **Layered gates.** An edit must pass: read → scope/step → evidence.

---

## 4. The contract (what to standardize)

As long as these four stay fixed, **switching tools = swapping the adapter.**

### 4.1 File schemas (runtime state)

| File | Contents |
|------|----------|
| `CONTEXT.md` | Session pack: rules pointer, latest daily, active task, specs |
| `INDEX.md` | Source-of-truth map: required reads + hashes + anchors + slices |
| `LEDGER.md` | Working memory: phase, scope, steps, decisions |
| `EVIDENCE.md` | Per-step proof (append-only) |

Everything is markdown with tagged JSON blocks
(`<!-- intern:<tag>:begin/end -->`) — human-readable **and** machine-parseable.

### 4.2 Actions

```
boot      → collect session context
index     → scan a spec folder, build INDEX, start/resume a task
context   → return a minimal slice (one section / one function)
step      → declare the active step + anchor
evidence  → record proof for a step
close     → validate evidence, write the daily log, finish
status    → show phase + ledger
override  → one-shot recorded gate bypass
```

### 4.3 Gates

| Gate | Blocks |
|------|--------|
| **Read** | Editing before the required reads are done |
| **Scope/Step** | Editing outside scope or before a step is declared |
| **Evidence** | Closing a task without passing evidence per step |

(Reference implementations also add anchor verification and bash gating.)

### 4.4 Layout

`AGENTS.md` at the root + `.intern/{rules,roles,plans,daily,state}`.

---

## 5. Three portability options

| Option | Enforcement | Portability | Effort |
|--------|-------------|-------------|--------|
| **A. Markdown-only** | Weak (convention) | ★★★ | Low |
| **B. Adapter per tool** | Strong | ★★ | High (many implementations) |
| **C. CLI + git hooks** | Strong | ★★★ | Medium |

### Option A — Markdown-only

Write the loop protocol in `AGENTS.md`; the agent follows it by convention.

- ✅ Works in any tool that reads `AGENTS.md`.
- ❌ Nothing actually blocks a violation.

### Option B — Adapter per tool

Keep the contract; give each tool a thin implementation.

- ✅ Strong enforcement.
- ❌ Repeated work: opencode plugin, Claude Code hooks, etc.

### Option C — CLI + git hooks (recommended)

Lift the harness logic into a CLI:

```bash
internify boot
internify index <spec-folder>
internify gate edit <file>     # exit != 0 → block
internify evidence <step> --claim "..." --proof "..." --result pass
internify close
```

Any AI tool can call the CLI from the terminal/bash. Add hard enforcement with a
**git pre-commit hook** (e.g. reject a commit when a step has no evidence).

- ✅ Fully tool-agnostic (opencode, Claude Code, Codex, Gemini CLI, Cursor…).
- ✅ One logic, many tools.
- ✅ Usable by humans too, not just agents.

---

## 6. Recommended architecture: core + adapters + template

Split into a standalone repo (e.g. `internify`):

```
internify/
├── core/                 ← pure logic + CLI (tool-agnostic)
│   ├── lib/              ← state, index, gates, context, boot
│   ├── cli.ts            ← boot/index/gate/evidence/close
│   └── smoke.ts
├── adapters/
│   ├── opencode/         ← thin plugin calling core
│   ├── claude/           ← thin hooks
│   └── codex/
├── template/             ← skeleton .intern + AGENTS.md
│   └── .intern/plans/_template/SpecName/{SPECmd,Plan,Task}.md
└── CONTRACT.md           ← §4, the official version
```

A new project only needs:

```bash
# 1. Take the skeleton
cp -r internify/template/. <project>/

# 2. Pick an adapter (one)
cp -r internify/adapters/opencode/. <project>/.opencode/
#   or install the CLI globally for any tool
npm i -g internify

# 3. Done. Open the tool and start a session.
```

---

## 7. Bootstrap in project ABC (concrete steps)

1. **Copy the content layer:**
   `AGENTS.md` + `.intern/{rules.md, roles/, plans/, daily/, state/}`.

2. **Write ABC's `rules.md`** — global project rules (language, architecture,
   no-build/no-commit, …).

3. **Write `roles/`** — agent roles (e.g. `BackendEngineer`, `DataEngineer`).

4. **Prepare `plans/_template/SpecName/`** — one folder per spec containing
   `SPECmd.md` (WHAT), `Plan.md` (HOW), `Task.md` (WHO). Folder name = spec name.

5. **Choose enforcement:**
   - fast: Option A (protocol in `AGENTS.md`), or
   - strong & portable: Option C (CLI) + git hook.

6. **Fill `AGENTS.md`** = boot order + pointers:
   `rules → role → active plan → latest daily`.

---

## 8. Tool matrix

| Tool | Extension mechanism | How to use core |
|------|---------------------|-----------------|
| opencode | plugin (`tool.execute.before/after`), skill, command | Plugin adapter calls `core` |
| Claude Code | hooks + slash commands | Hook calls the CLI |
| Codex | hooks / wrapper script | Wrapper calls the CLI |
| Gemini CLI | skill/activation | Skill calls the CLI |
| Cursor / others | rules + terminal | Call the CLI |

Shared across all: **the CLI**, **the file schemas**, and **AGENTS.md**. Only the
way a tool invokes the CLI differs.

---

## 9. From today to portable

Current state: the lib is **pure and tested**, but the plug is still opencode.

Steps to full tool-agnosticism:

1. **Lift `lib/` into a CLI.** Wrap it with `boot/index/gate/...` subcommands.
   Shortest path — the logic no longer depends on opencode.
2. **Move the contract into `CONTRACT.md`.** So other adapters have one source.
3. **Build a second adapter** (e.g. Claude Code hooks) to prove tool-agnosticism
   is real, not a claim.
4. **Extract into an `internify` repo** + `template/` so new projects just copy.

---

## 10. Closing

One principle: **portable content, enforcement via a contract + adapters.**

If the contract (§4) stays stable, the cost of switching projects or AI tools
drops drastically — what changes is a few dozen adapter lines, not the whole
workflow.
