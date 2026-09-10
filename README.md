# internify-ai

[![npm version](https://img.shields.io/npm/v/internify-ai.svg)](https://www.npmjs.com/package/internify-ai)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A disk-backed engineer loop for AI agents.** Context lives on disk, not in the
model's head — so agents stop hallucinating and stop losing grounding across
sessions and compactions.

The repository is **internify-ai**; the tool/CLI is **internify**. internify is
the generalized, portable form of a harness that already runs in production as
the `/work` command: it boots a session, indexes a spec, enforces layered gates,
and records evidence.

> Status: v1. Works today with **opencode** (adapter) and any tool via the
> **CLI**. Unit + smoke tests included.

---

## Table of contents

- [Start here (new to this?)](#start-here-new-to-this)
- [Why](#why)
- [How it works](#how-it-works)
- [Walkthrough: from zero](#walkthrough-from-zero)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [CLI (any tool)](#cli-any-tool)
- [Spec structure](#spec-structure)
- [Tools](#tools)
- [Contract](#contract)
- [Articles](#articles)
- [License](#license)

---

## Start here (new to this?)

internify is **not an AI**. It is a small add-on that plugs into the AI coding
tool you already use (opencode, Claude Code, …). It does two things:

- keeps the agent's context **on disk** (so a new session never loses it), and
- **blocks** edits that are not grounded (no scope, no step, no evidence).

You still talk to your normal AI tool. internify just makes it behave.

### What you need

- An AI coding tool: [opencode](https://opencode.ai) or Claude Code.
- [Bun](https://bun.sh) — install with `curl -fsSL https://bun.sh/install | bash`.

### The 60-second version

```bash
# 1. install the CLI (once)
npm i -g internify-ai
# or from GitHub:
bun add -g git+ssh://git@github.com/ajihairi/internify-ai.git

# 2. go to your workspace (it can be just your code repo)
cd my-workspace

# 3. set it up for your tool
internify init --tool opencode     # or: --tool claude   (or --tool none = CLI only)

# 4. restart your AI tool, then work as usual
```

That's it. `init` adds `.intern/` and `AGENTS.md` next to your code and wires the
provider. It never overwrites files that already exist.

### "My workspace only has a code repo — is that ok?"

Yes. Before:

```
my-workspace/
└── my-project/        ← just your code
```

After `internify init`:

```
my-workspace/
├── .intern/           ← internify knowledge (rules, roles, plans, daily, state)
├── AGENTS.md          ← instructions the AI reads
├── opencode.json      ← opencode wiring (plugin)
├── .claude/           ← claude wiring (PreToolUse hook)
└── my-project/        ← your code, untouched
```

Want the AI files **outside** the repo (keep the repo 100% clean)? Use Mode B —
see [Quick start → Optional: project beside the tool](#quick-start).

### What using it feels like

Open your AI tool and start a spec:

```text
/work .intern/plans/FeatureX
```

The agent can only edit files in scope, must declare a step, and must record
evidence before closing. You don't do anything special — the tool enforces it.

### Turning it off / on

internify watches one environment variable: `INTERN_HARNESS`. Only the exact
value `off` disables it; anything else (or unset) means **on**.

**One run only:**

```bash
INTERN_HARNESS=off opencode      # OFF, just this run
INTERN_HARNESS=on  opencode      # ON  (or simply: opencode)

INTERN_HARNESS=off claude        # OFF for Claude Code
INTERN_HARNESS=on  claude        # ON
```

**Current shell session:**

```bash
export INTERN_HARNESS=off        # OFF
opencode                         # (or: claude)
unset INTERN_HARNESS             # ON again

export INTERN_HARNESS=on        # ON (explicit)
```

**Permanently (zsh / bash):**

```bash
echo 'export INTERN_HARNESS=off' >> ~/.zshrc   # keep it OFF
# or
echo 'export INTERN_HARNESS=on'  >> ~/.zshrc   # keep it ON
source ~/.zshrc
```

> The tool inherits the variable from the shell that launches it. If you launch
> from a GUI (not a terminal), set it in your shell profile first.

When it is `off`:

- the **opencode** plugin registers no hooks (no gating),
- the **Claude** hook exits immediately (no gating),
- the **CLI** still works normally.

Use it when the gates get in the way, or to compare behavior with/without the
harness. Unset the variable to turn it back on.

---

## Why

Agents hallucinate when they carry too much state in memory: too much context
overload → drift → invented files, APIs, and behavior. internify moves the
context **out of memory and onto disk**, then re-injects it every turn. It also
blocks unsafe actions until the agent is properly grounded.

## How it works

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```

- **Boot** — collect session context (rules, latest daily, active task, specs)
  and write it to `state/CONTEXT.md`.
- **Index** — scan a spec folder, resolve referenced files, hash them, and build
  an `INDEX.md`. The agent cannot invent paths.
- **Gates** — layered checks block edits:
  1. **Read** — must read the required files first.
  2. **Scope / step** — must declare a step and stay within allowed files.
  3. **Anchor** — the step anchor must be declared by a plan step (status `ok`).
  4. **Bash** — shell writes must be scoped (or use `edit` / `write`).
  5. **Evidence** — cannot close a task without passing evidence per step.
- **Close** — validate evidence and append the daily log.

All working state lives under `.intern/state/` and is re-injected from disk each
turn. New session or compaction → no loss of grounding.

## Walkthrough: from zero

Set up internify in an empty workspace, with your project cloned next to it.

![Setting up internify in an empty workspace](https://raw.githubusercontent.com/ajihairi/internify-ai/main/docs/assets/from-zero.gif)

Then every work session runs the same enforced loop:

![The enforced loop: read → step → edit → evidence → close](https://raw.githubusercontent.com/ajihairi/internify-ai/main/docs/assets/session.gif)

Inside opencode, the agent drives the same loop through `/work`:

![opencode session running /work](https://raw.githubusercontent.com/ajihairi/internify-ai/main/docs/assets/opencode-session.png)

(The clips are illustrative transcripts; the underlying output is real.)

## Repository layout

```
internify-ai/
├── README.md
├── CONTRACT.md              ← the stable contract (schemas, actions, gates)
├── LICENSE
├── core/                    ← tool-agnostic logic (pure, tested)
│   ├── lib/                 ← markdown, types, state, config, index-builder,
│   │                          gates, context, io, boot (+ *.test.ts)
│   ├── cli.ts               ← the tool-agnostic CLI
│   └── smoke.ts             ← end-to-end simulation
├── adapters/
│   └── opencode/            ← plugin + skill + command for opencode
│       ├── plugins/intern-harness.ts
│       ├── skills/intern-context/SKILL.md
│       ├── command/work.md
│       └── package.json
├── template/                ← scaffolded into a target project
│   ├── AGENTS.md
│   └── .intern/
│       ├── rules.md
│       ├── roles/
│       ├── plans/_template/SpecName/{SPECmd,Plan,Task}.md
│       └── daily/
└── article/                 ← design + portability + publishing notes
```

## Quick start

### Install the CLI

```bash
# from npm (recommended)
npm i -g internify-ai        # or: bun add -g internify-ai

internify --help

# or from GitHub (SSH)
bun add -g git+ssh://git@github.com/ajihairi/internify-ai.git
```

> No global install wanted? Run it from the checkout: `bun /path/to/internify-ai/core/cli.ts <cmd>`.

### Set up a workspace

```bash
mkdir my-workspace && cd my-workspace

# 1. clone your project
git clone git@github.com:you/my-project.git

# 2. install + wire internify (scaffolds .intern/ + AGENTS.md)
internify init --tool opencode      # or: --tool claude | --tool none
```

`init` never overwrites existing files. It creates `.intern/` + `AGENTS.md` and
wires the provider:

| `--tool` | What it does |
|----------|--------------|
| `opencode` (default) | adds the adapter plugin to `opencode.json` |
| `claude` | adds a `PreToolUse` hook to `.claude/settings.json` |
| `none` | CLI only (no provider wiring) |

Options: `internify init [dir] [--knowledge <name>] [--tool <name>]`.

Then restart the AI tool and start a session:

```text
/work .intern/plans/<SpecName>      # opencode
internify boot                      # any tool, via the CLI
```

### Providers

| Provider | Integration | Enforces |
|----------|-------------|----------|
| opencode | plugin (`tool.execute.before/after`) + skill + `/work` | edit / write / bash |
| Claude Code | `PreToolUse` hook → `adapters/claude/hook.ts` | Edit / Write / MultiEdit / Bash |
| any (CLI) | `internify gate edit <file>` / `internify gate bash "<cmd>"` | via git hooks or wrappers |

### Optional: project beside the tool (Mode B)

If your project lives in a subfolder — or you want a non-standard knowledge dir —
add `internify.json` at the workspace root:

```json
{
  "knowledge": "intern",
  "plansDir": "superpowers/plans",
  "target": "my-project"
}
```

- `target` — where the project code lives (edits are scoped here).
- `knowledge` — where rules/roles/plans/daily/state live.
- `plansDir` — plans folder, relative to `knowledge` (default `plans`).

### Inspecting the core

```bash
cd internify-ai
(cd adapters/opencode && bun install)   # dev deps for adapter tests
bun test core/lib adapters/opencode
bun core/smoke.ts
```

## CLI (any tool)

The same loop is available as a CLI, so tools other than opencode (or a human)
can use it:

```bash
bun core/cli.ts boot
bun core/cli.ts index .intern/plans/FeatureX
bun core/cli.ts read src/Feature.swift     # print + mark a required read
bun core/cli.ts step S1 slice-1
bun core/cli.ts gate edit src/Feature.swift # exit 1 if blocked
bun core/cli.ts gate bash "echo x > src/Feature.swift" # exit 1 if blocked
bun core/cli.ts evidence S1 --claim wired --proof "read:1" --result pass
bun core/cli.ts close
```

`INTERNIFY_ROOT` overrides the workspace root (default: cwd). `<root>/internify.json`
(`{ "target": "…", "knowledge": "…" }`) separates the project from the knowledge
dir (Mode B). See [`docs/DESIGN.md`](./docs/DESIGN.md) for the design.

## Spec structure

One feature = one folder, always containing three files:

```
.intern/plans/<SpecName>/
├── SPECmd.md     ← WHAT
├── Plan.md       ← HOW
└── Task.md       ← WHO
```

A spec folder is the unit of work. Start it with `/work <spec-folder>`.

## Tools

Registered by the opencode adapter:

| Tool | What it does |
|------|--------------|
| `intern_boot` | Collect session context → write `CONTEXT.md` |
| `intern_index` | Scan a spec folder → build `INDEX.md`, start/resume a task |
| `intern_context` | Return a minimal slice (one section / one function) |
| `intern_step` | Declare the active step + anchor |
| `intern_evidence` | Append a proof record for a step |
| `intern_close` | Validate evidence, append daily log, finish |
| `intern_status` | Show current phase + ledger |
| `intern_override` | One-shot, recorded gate bypass (escape hatch) |

Disable the harness with `INTERN_HARNESS=off`.

## Contract

See [`CONTRACT.md`](./CONTRACT.md). It defines the file schemas, the 8 actions,
the 3 gates, and the folder layout. Keep it stable and you can swap tools without
rewriting the workflow.

## Articles

- [Design](./docs/DESIGN.md)
- [01 — What we built](./article/01-what-we-built.md)
- [02 — Portability](./article/02-portability.md)
- [03 — Publishing](./article/03-publishing.md)
- [04 — internify workspace model](./article/04-internify-workspace.md)

## Author

Maintained by **Hamzhya Salsatinnov Hairy**.

## License

MIT — see [`LICENSE`](./LICENSE).
