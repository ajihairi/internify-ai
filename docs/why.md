# Why internify?

> Most AI coding tools trust the model. internify doesn't.

## The problem

AI coding assistants are fast but ungrounded. They:
- Edit files they haven't read
- Hallucinate APIs that don't exist
- Lose context between sessions
- Forget what you told them yesterday

You get code fast — but you don't know if it's correct, and neither does the agent.

## The solution

internify is a **process harness** that sits between you and your AI tool. It enforces a workflow:

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```

Every step has a gate. The agent can't skip ahead. It must read before editing, plan before coding, and prove before closing.

## Comparison

| | **Rules/static instructions** | **Tool hooks (intercept)** | **Repo-map / context** | **internify** |
|---|---|---|---|---|
| **Category** | Prompt engineering | Access control | Context management | Process engine |
| **What it does** | Add instructions to every prompt | Block or modify tool calls | Map file structure for context | Enforce a full engineering workflow |
| **Context lives in** | Prompt (every time) | Hook code | Repo-map file | Disk (per-task LEDGER/INDEX/EVIDENCE) |
| **Anti-hallucination** | Trust the model | Can block bad edits | No mechanism | Gates block ungrounded edits |
| **Evidence / proof** | None | None | None | Append-only log per step |
| **Multi-task** | No | No | No | Active list + primary focus |
| **Cross-session memory** | Reload prompt | Stateless | Stateless | Reload from disk (zero amnesia) |
| **Workflow enforcement** | Open-ended | Intercepts only | Open-ended | Gated loop (read→plan→edit→prove) |
| **Who it's for** | Everyone using AI | Developers who write hooks | Teams needing context | Teams needing process + accountability |

## What makes internify different

### 1. Context on disk, not in the model

When a session ends, the model forgets everything. internify stores context on disk:
- **LEDGER.md** — phase, steps, pending reads (per task)
- **INDEX.md** — file references, anchors
- **EVIDENCE.md** — proof that each step was completed

Next session: boot reloads everything. Zero hallucination, zero amnesia.

### 2. Gates, not trust

Most tools trust the model to do the right thing. internify doesn't:
- **Read gate** — must read required files before editing
- **Step gate** — must declare which step is active
- **Scope gate** — can only edit files in the spec's scope
- **Evidence gate** — must prove each step before closing

If the agent can't ground its edit, it's blocked. No exceptions.

### 3. Evidence-based close

When a task is done, there's an append-only log of every step, every claim, and every proof. This isn't just documentation — it's accountability. You can audit what the agent actually did, not just what it claims.

### 4. Multi-task without losing context

With multi-active tasks, you can run several specs in parallel. Each gets its own progress box on disk. The agent remembers all of them. Switching is instant — no lost context, no hallucination.

## The analogy

Without internify: give a contractor a whiteboard and say "go build something."

With internify: give them a clipboard with a checklist:
- [ ] Read the blueprints
- [ ] Confirm the plan
- [ ] Do the work
- [ ] Show me proof
- [ ] Sign off

Same contractor. Same skills. But now there's a process.

## Terminology

| Term | Meaning |
|------|---------|
| **Process harness** | A system that enforces workflow steps on an AI agent |
| **Engineer loop** | The boot→index→read→step→edit→evidence→close cycle |
| **Grounded editing** | Edits that are backed by read references + step declarations |
| **Evidence** | Append-only proof records per step |
| **Task box** | Per-task on-disk progress (LEDGER + INDEX + EVIDENCE) |
| **Focus** | The primary task driving the gates in a multi-task setup |

## The name

"internify" = intern + -ify. The AI agent is your intern. internify makes it behave like one: follows process, documents work, asks before acting, proves results.

Not a genius. Not autonomous. Just a good intern with a clipboard.
