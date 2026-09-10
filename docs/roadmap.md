# Roadmap

## Shipped

- Disk-backed loop: `CONTEXT` / `INDEX` / `LEDGER` / `EVIDENCE`.
- Layered gates: read → scope/step → anchor → bash → evidence.
- Anchor verification; INDEX as human-readable tables + JSON block.
- Mode A / Mode B (target ≠ knowledge); `plansDir` for non-standard layouts.
- opencode adapter (plugin + skill + `/work`) and a Claude Code `PreToolUse` hook.
- Tool-agnostic CLI; `internify init` (scaffold + provider wiring).
- **Skill packs**: bundled + external resolution, `init --skills`, `skills list`.
- **Status-aware gates**: `status: draft|review|fixed` in frontmatter → optional
  reads for drafts, `fixed` docs are read-only.
- **Advanced profile**: `internify init --profile advanced` scaffolds PARA
  (`00-inbox…06-daily`) with `plansDir`/`dailyDir`.
- **`internify update`** — refresh spec templates (`--force` for rules/roles).
- **Command install** — `/work` for opencode (`.opencode/command`) and Claude
  (`.claude/commands`); Claude `PostToolUse` marks reads.
- Docs site (Material for MkDocs) on GitHub Pages.
- Published: [`internify-ai`](https://www.npmjs.com/package/internify-ai) on npm.
- Tests: core units + adapter smoke; CI workflow.

## Next

- **More providers**: Gemini CLI, Cursor (Gemini uses TOML commands).
- **Full command generator** — generate all pipeline commands per agent from one
  source.
- **Provider-agnostic hooks** — a single adapter contract beyond opencode/Claude.

## Maintenance principles

- internify enforces; it does not own your notes. Start simple.
- Not everything needs to be canonical — drafts are cheap.
- One way to update: improve the tool upstream, projects pick it up.
