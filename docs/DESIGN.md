# internify-ai — Design

Status: v0 · Architecture and rationale. See [`../CONTRACT.md`](../CONTRACT.md)
for the stable interface.

## 1. Purpose

Agents hallucinate when they carry too much state in **memory**. internify moves
context onto **disk**, re-reads it every turn, and blocks edits that are not
grounded. The result: no drift across sessions or compactions, and gates that
fail closed.

## 2. Architecture

```
session
  │  tool calls (read/edit/write/…)
  ▼
tool adapter  ──────────────►  <root>/.intern/state/
  • inject state each turn        ├── active.json
  • gate edits                    ├── CONTEXT.md
  • register tools                └── tasks/<taskId>/
  • re-inject CONTEXT.md              ├── INDEX.md
                                      ├── LEDGER.md
core/lib (pure)                       └── EVIDENCE.md
  • index-builder, gates,
    state, io, boot, context
```

Two layers:

- **core/lib** — pure, tool-agnostic logic. Unit-tested with `bun test`.
- **adapters/** — thin wiring per tool (e.g. opencode plugin, skill, command).

The knowledge dir is `.intern` (constant `KNOWLEDGE_DIR` in `state.ts`).

## 3. Artifacts

| File | Role |
|------|------|
| `CONTEXT.md` | Session pack: rules pointer, latest daily, active task, specs |
| `INDEX.md` | Generated map: required reads + hashes + anchors + slices |
| `LEDGER.md` | Working memory: phase, scope, steps, decisions |
| `EVIDENCE.md` | Append-only proof per step |

Machine-readable data lives as JSON inside markdown, delimited by
`<!-- intern:<tag>:begin/end -->`.

Anti-drift rules:

- INDEX is **generated** from real files with hashes — never authored.
- State lives on disk and is re-read every turn.
- Writes are confined to `.intern/state/` and `.intern/daily/`.

## 4. State machine

Runtime transitions (as implemented):

```
idle ── index ──► orient ── read all ──► (grounded*) ── step ──► planned
                                                                  │
                                                          first edit
                                                                  ▼
              done ◄── close ◄── verifying ◄── evidence ◄── acting
```

`grounded` and `recorded` are named in the design for clarity but are not
separately assigned by the current implementation; the read requirement is
enforced by the gate rather than by a distinct phase.

| Phase | Edits allowed | Notes |
|-------|---------------|-------|
| `orient` | no | reading / indexing |
| `planned` | yes (in scope) | a step has been declared |
| `acting` | yes (in scope) | set on the first gated edit |
| `verifying` | no | evidence recorded for the step |
| `done` | no | task closed |

## 5. Gates

| Gate | Blocks | Example message |
|------|--------|-----------------|
| **Read** | Edit before required reads are done | `BLOCKED: ground first. Read: src/A.swift` |
| **Scope / Step** | Edit outside scope or before a step | `BLOCKED: file outside task scope: src/B.swift` |
| **Evidence** | Closing with a step missing passing evidence | `BLOCKED: no passing evidence for step(s): S2` |

Gates are pure decision functions in `core/lib/gates.ts`. The adapter turns a
negative decision into a thrown error (blocking the tool call).

Anti-deadlock:

- `override` sets a one-shot `forceAllow` flag (recorded in decisions/evidence).
- `index` falls back to `scope = [specRoot]` when a spec references no code
  files, so scope never starts empty.

## 6. Tools (opencode adapter)

| Tool | Action |
|------|--------|
| `intern_boot` | Collect session context → `CONTEXT.md` |
| `intern_index` | Scan spec → `INDEX.md`, start/resume task |
| `intern_context` | Return a minimal slice |
| `intern_step` | Declare active step + anchor |
| `intern_evidence` | Append a proof record |
| `intern_close` | Validate evidence, append daily, finish |
| `intern_status` | Show phase + ledger |
| `intern_override` | One-shot recorded bypass |

Hooks: inject HARNESS STATE + CONTEXT.md (`experimental.chat.system.transform`),
gate edits (`tool.execute.before`), track reads (`tool.execute.after`), and
inject the ledger on compaction (`experimental.session.compacting`).

## 7. CLI (tool-agnostic)

`core/cli.ts` exposes the same loop for any tool (or a human) via the terminal:

```
internify boot
internify index <spec-folder>
internify read <path>            # print + mark a required read done
internify context <path> <selector> [--kind section|function]
internify step <id> <anchor>
internify evidence <step> --claim <c> --proof <p> --result pass|fail
internify close
internify status
internify override <reason>
internify gate edit <file>       # exit 1 if blocked
```

Enforcement for other tools can wrap `internify gate edit` in a git hook or a
tool-specific hook.

## 8. Lifecycle

```
1. boot        → CONTEXT.md + brief
2. index <spec>→ INDEX.md, ledger, active.json
3. read …      → required reads marked done
4. step S1 A1  → phase planned
5. edit        → phase acting        (Gates 1 + 2)
6. evidence …  → phase verifying
7. close       → append daily, phase done
```

## 9. Error handling

| Condition | Behavior |
|-----------|----------|
| Missing/corrupt ledger | Fail closed: edits blocked; re-run `index` |
| Spec folder missing/invalid | `index` errors out with a clear message |
| Ref escapes the repo or is not a file | Recorded as unresolved, not read |
| Anchor stale | Deferred (v0); fallback anchor keeps the flow unblocked |
| Gate loop | `override` (one-shot, recorded) |

## 10. Verification

- `bun test core/lib` — unit tests (markdown, state, index, gates, context, boot).
- `bun run smoke` — end-to-end simulation over a temp fixture.
- `tsc` on the adapter + CLI.

## 11. Modes (target vs knowledge)

`core/lib/config.ts` loads `<root>/internify.json`:

```json
{ "target": "../projectA", "knowledge": ".intern", "plansDir": "plans" }
```

- **Mode A (default):** no config → `target == root`, `knowledge == <root>/.intern`,
  `plansDir == <knowledge>/plans`.
- **Mode B:** config sets `target` (and optionally `knowledge` / `plansDir`) so
  the tool and the project can live side by side (`internify/` + `projectA/`).
- `plansDir` is resolved relative to `knowledge`; use it when specs live in a
  non-standard folder (e.g. `superpowers/plans`).

Paths are workspace-relative; `gate edit` receives workspace-relative paths.

## 12. Status

Implemented:

- Disk-backed ledger/index/evidence + context pack, re-injected every turn.
- Layered gates: read → scope/step → evidence, plus **bash write gating**.
- **Anchor verification**: `intern_step` requires an anchor declared by a plan
  step and, when the index knows it, a status of `ok`.
- INDEX written as human-readable tables + a JSON block.
- Mode A / Mode B (target ≠ knowledge).
- opencode adapter + a Claude Code `PreToolUse` hook + a tool-agnostic CLI.
- `internify init` scaffolds `.intern/` + `AGENTS.md` and wires the provider.
- Tests: `core/lib` units + `adapters/opencode` smoke + `core/smoke.ts`.

Remaining (smaller) gaps:

- `grounded` / `recorded` phases are not separately assigned.
- The opencode adapter gates `edit` / `write` / `bash`; other mutators (if any)
  are not covered.
- Anchor tokens use a language-agnostic regex; exotic syntaxes may miss.
