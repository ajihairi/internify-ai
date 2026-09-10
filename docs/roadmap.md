# Roadmap

## Shipped

- Disk-backed loop: `CONTEXT` / `INDEX` / `LEDGER` / `EVIDENCE`.
- Layered gates: read → scope/step → anchor → bash → evidence.
- Anchor verification; INDEX as human-readable tables + JSON block.
- Mode A / Mode B (target ≠ knowledge); `plansDir` for non-standard layouts.
- opencode adapter (plugin + skill + `/work`) and a Claude Code `PreToolUse` hook.
- Tool-agnostic CLI; `internify init` (scaffold + provider wiring).
- Published: [`internify-ai`](https://www.npmjs.com/package/internify-ai) on npm.
- Tests: core units + adapter smoke.

## Next

- **Docs site** — Material for MkDocs on GitHub Pages (this site).
- **Structure profiles** — simple vs Advanced (PARA / second brain), with
  `status: draft|review|fixed` so the agent tells drafts from canonical docs.
  See [Structure profiles](structure.md).
- **Skill packs** — `internify init --skills superpowers,caveman,…` to install
  optional packs. See [Skills](skills.md).
- **More providers** — Gemini CLI, Cursor; a richer Claude adapter
  (`PostToolUse` to auto-mark reads).
- **Skill packs** — first-class metadata so packs are discoverable.

## Maintenance principles

- internify enforces; it does not own your notes. Start simple.
- Not everything needs to be canonical — drafts are cheap.
- One way to update: improve the tool upstream, projects pick it up.
