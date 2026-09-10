# AGENTS.md — internify repo

Guidance for AI agents working **on internify itself** (not a workspace using it).

## Layout

| Path | What |
|------|------|
| `core/lib/` | Pure, tool-agnostic logic (+ `*.test.ts`) |
| `core/cli.ts` | The CLI (`internify ...`) |
| `adapters/opencode/` | opencode plugin + skill + command |
| `adapters/claude/` | Claude Code `PreToolUse` hook |
| `template/` | Knowledge scaffolded by `internify init` |
| `packs/` | Optional skill packs (bundled) |
| `docs/` | Docs site source (MkDocs) + articles |
| `CONTRACT.md` | The stable interface |

## Commands

```bash
(cd adapters/opencode && bun install)          # dev deps (types + @opencode-ai/plugin)
bun test core/lib adapters/opencode            # unit + adapter tests
bun core/smoke.ts                              # end-to-end simulation
(cd adapters/opencode && bunx tsc --noEmit --skipLibCheck \
  --target es2022 --module esnext --moduleResolution bundler --types node \
  plugins/intern-harness.ts ../../core/cli.ts ../../adapters/claude/hook.ts)
pip install -r requirements-docs.txt && mkdocs build --strict   # docs
```

## Conventions

- Keep `core/lib` **pure** (no tool imports). Adapters stay thin.
- Add tests for new pure logic.
- Never commit `node_modules/` or `site/`.
- The **human** authors commits.

## See also

- [`CONTRACT.md`](./CONTRACT.md) — schemas, actions, gates.
- [`docs/DESIGN.md`](./docs/DESIGN.md) — architecture.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md).
