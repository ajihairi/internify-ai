# 01 — Why internify Exists (TypeScript, node_modules, and all)

A short note on what internify is, why the repo contains TypeScript and
`node_modules`, and how the pieces fit.

---

## 1. The problem

AI agents hallucinate when they carry too much state in memory. Too much context
overload → drift → invented files, APIs, and behavior. It gets worse across long
sessions and compactions: the "context" lives in the model's head, and when the
head resets, grounding is lost.

internify flips it: **context lives on disk, not in memory.** The harness reads
state from files every turn and blocks actions that are not grounded.

## 2. What internify does

1. **Boot** — a session collects context (rules, latest daily, active task,
   available specs) and writes it to `.intern/state/CONTEXT.md`.
2. **Loop** — work happens per spec folder with three layered gates:
   read → scope/step → evidence.
3. **Enforce** — a tool adapter (e.g. the opencode plugin) applies the gates and
   re-injects state each turn.

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```

## 3. Why TypeScript and `node_modules`?

The enforcement layer is a **plugin for opencode**, and opencode plugins are
written in TypeScript/JavaScript, executed by **Bun**.

To write and check the plugin, three dependencies are needed:

| Dependency | Why |
|------------|-----|
| `@opencode-ai/plugin` | The opencode API: hook definitions (`tool.execute.before/after`, …) and the `tool()` helper for custom tools |
| `typescript` | Typechecking (`bunx tsc`) so errors are caught before runtime |
| `@types/node` | Types for Node modules used (`fs`, `path`, `crypto`) |

`bun install` pulls these into `adapters/opencode/node_modules/`. That is why a
`node_modules/` folder and a lockfile appear. They are **git-ignored** and can be
deleted and reinstalled at any time.

> These dependencies belong purely to the agent's engine. They do not touch any
> application code.

## 4. What sits where

| Path | Role |
|------|------|
| `core/lib/` | The engine: pure, tool-agnostic logic + tests |
| `core/smoke.ts` | End-to-end simulation over a temp fixture |
| `adapters/opencode/` | The thin wiring: plugin, skill, command |
| `template/` | Scaffolded into a target project (`.intern/` + `AGENTS.md`) |
| `CONTRACT.md` | The stable interface (schemas, actions, gates) |

Inside `core/lib/`:

| Module | Responsibility |
|--------|----------------|
| `markdown.ts` | Read/write JSON blocks inside markdown |
| `types.ts` | Shared types (`Phase`, `Ledger`, `IndexFile`, …) |
| `state.ts` | Paths, slug, ledger serialize/parse |
| `index-builder.ts` | Scan a spec folder → resolve files → hash → build INDEX |
| `gates.ts` | Pure decisions: `canEdit`, `canStep`, `canClose` |
| `context.ts` | Return a minimal slice (one section / one function) |
| `io.ts` | Read/write runtime state to disk |
| `boot.ts` | Session-boot helpers (latest daily, summary, context pack) |

**Why the logic is here and not in the adapter:** so it can be unit-tested with
`bun test` and reused across tools. The adapter (`.opencode/plugins/…`) is thin —
it only registers hooks/tools and calls into `core/lib/`.

## 5. Why so many packages under `node_modules`?

They are **transitive dependencies.** You ask for three packages, but
`@opencode-ai/plugin` itself depends on many others (`zod`, `yaml`, `uuid`,
`effect`, `fast-check`, …). Bun pulls the whole tree, so dozens of packages show
up. This is normal:

- Local to `node_modules/`, git-ignored.
- Deletable and reinstallable.
- Does not affect any application code.

## 6. Mental model

- `core/` = the engine (portable).
- `adapters/` = the plugs (per tool).
- `template/` = the knowledge skeleton (rules, roles, specs, daily).
- `.intern/state/` = the scratchpad at runtime — on disk, not in memory.
- Project code = whatever you point internify at.
