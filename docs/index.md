# internify

**A disk-backed engineer loop for AI agents.** Context lives on disk, not in the
model's head — so agents stop hallucinating and stop losing grounding across
sessions and compactions.

[![npm](https://img.shields.io/npm/v/internify-ai.svg)](https://www.npmjs.com/package/internify-ai)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ajihairi/internify-ai/blob/main/LICENSE)

---

## What it is

internify is **not an AI**. It is a small add-on that plugs into the AI coding
tool you already use (opencode, Claude Code, …) and:

- keeps the agent's **context on disk** (new sessions never lose it), and
- **blocks** edits that are not grounded (no scope, no step, no evidence).

## The loop

```
Boot → Index → Read → Step → Edit → Evidence → Close → Daily
```

<div class="grid cards" markdown>

- **Boot** — collect context (rules, latest daily, active task, specs) → `CONTEXT.md`.
- **Index** — scan a spec, resolve + hash referenced files → `INDEX.md`.
- **Gates** — read → scope/step → anchor → bash → evidence.
- **Close** — validate evidence, append the daily log.

</div>

## Install

```bash
npm i -g internify-ai
```

## 60 seconds

```bash
mkdir my-workspace && cd my-workspace
git clone git@github.com:you/my-project.git

internify init --tool opencode     # or: --tool claude | none
# restart your AI tool, then:  /work .intern/plans/<SpecName>
```

## Where to go next

- [Install](getting-started/install.md)
- [Quick start](getting-started/quickstart.md)
- [CLI reference](cli.md)
- [Providers](providers.md)
- [Workspace & config](workspace.md)
- [Contract](contract.md)
