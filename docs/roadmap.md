# Roadmap

## Shipped

- Disk-backed loop: `CONTEXT` / `INDEX` / `LEDGER` / `EVIDENCE`.
- Layered gates: read → scope/step → anchor → bash → evidence.
- Anchor verification; INDEX as human-readable tables + JSON block.
- Mode A / Mode B (target ≠ knowledge); `plansDir` for non-standard layouts.
- opencode adapter (plugin + skill + `/work`) and a Claude Code `PreToolUse` hook.
- Tool-agnostic CLI; `internify init` (scaffold + provider wiring).
- **Skill packs**: bundled + external resolution, `init --skills`, `skills list`.
- Docs site (Material for MkDocs) on GitHub Pages.
- Published: [`internify-ai`](https://www.npmjs.com/package/internify-ai) on npm.
- Tests: core units + adapter smoke; CI workflow.

## Next

- **Status-aware gates**: read `status: draft|review|fixed` in specs → only
  `fixed` docs become required reads; `draft` is free to edit.
  See [Structure profiles](structure.md).
- **Advanced profile**: `internify init --profile advanced` scaffolds PARA
  (`00-inbox…06-daily`) and writes `plansDir`.
- **More providers**: Gemini CLI, Cursor; a richer Claude adapter
  (`PostToolUse` to auto-mark reads).
- **`internify update`** — refresh template/prompts like uteuk.
- **Command generator** — per-agent slash commands.

## Maintenance principles

- internify enforces; it does not own your notes. Start simple.
- Not everything needs to be canonical — drafts are cheap.
- One way to update: improve the tool upstream, projects pick it up.
