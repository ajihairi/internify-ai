# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-09-10

### Added

- `internify skills update [dir] [--tool X] [--packs all|a,b] [--force]` —
  re-sync installed skill packs from their local sources.
- Pack manifest (`.internify-packs.json`) with source + content hash; unchanged
  packs are skipped, `--force` also installs missing ones.

## [0.7.0] - 2026-09-10

### Added

- `internify doctor` — environment + task health checks (Bun, paths, active
  ledger/INDEX).
- Pipeline commands: `/internify.review`, `/internify.daily`,
  `/internify.monthly`, `/internify.help` (all providers).
- `init` interactive wizard: pick the AI tool and knowledge profile.
- CLI tests (`core/cli.test.ts`) + `publish.yml` (npm publish on `v*` tags via
  `NPM_TOKEN`).

## [0.6.0] - 2026-09-10

### Changed

- **Breaking:** chat commands are now branded and namespaced —
  `/internify.work`, `/internify.boot`, `/internify.status`
  (Claude Code: `/internify:work`, …). Files are named `internify.<cmd>.<ext>`
  (Claude: `internify/<cmd>.md`).

## [0.5.0] - 2026-09-10

### Added

- Provider registry (`core/lib/providers.ts`): opencode, Claude, Gemini, Qwen,
  Cursor, with command format (md/toml/mdc), args token, and hook support.
- Multi-provider command generator: `internify commands generate [dir]
  [--providers …]`; `init --tool <provider>` generates the `/work` command for
  any registered provider (opencode uses the `intern_*` tools; others use the
  CLI). Gemini/Qwen/Cursor are command-only (no gating hooks).

## [0.4.0] - 2026-09-10

### Added

- `internify init --profile advanced` — scaffolds PARA (`00-inbox…06-daily`) and
  writes `plansDir: 01-projects`, `dailyDir: 06-daily`.
- `dailyDir` config (with `Paths.daily`); `appendDaily`/`listDaily` take a daily
  root.
- `internify update [--force]` — refresh spec templates.
- `internify commands install [dir] [--tool opencode|claude]` — install the
  `/work` command; `init` now installs it too.
- Claude `PostToolUse` hook (`adapters/claude/read.ts`) marks reads;
  `io.markRead`.
- `listSpecs` skips `_template`.

## [0.3.0] - 2026-09-10

### Added

- **Status-aware gates**: a document's `status: draft|review|fixed` frontmatter
  now drives behavior — `draft`/`review` are optional reads, `fixed` documents
  are required reads and read-only. New pure module `core/lib/status.ts`.
- Scope now includes spec documents (so drafts are editable) while `fixed` ones
  are blocked.
- Spec templates carry `status` frontmatter.

## [0.2.0] - 2026-09-10

### Added

- Skill packs: bundled `packs/status` + resolution of external packs
  (`~/.config/opencode/skills`, `~/.claude/skills`, `~/.agents/skills`).
- `internify init --skills all|none|a,b` and interactive confirmation;
  `--yes` to skip prompts.
- `internify skills list`.
- Repo hygiene: `AGENTS.md`, per-agent shims, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, logo assets.
- Docs site (Material for MkDocs) with `structure` and `skills` pages.

### Changed

- `docs.yml` deploys on every push; added `ci.yml` (tests + typecheck + smoke).

## [0.1.0] - 2026-09-10

### Added

- Disk-backed loop: `CONTEXT` / `INDEX` / `LEDGER` / `EVIDENCE`.
- Layered gates: read → scope/step → anchor → bash → evidence.
- opencode adapter (plugin + skill + `/work`) and a Claude Code `PreToolUse` hook.
- Tool-agnostic CLI: `boot/index/read/context/step/evidence/close/status/override/gate`.
- `internify init` (scaffold + provider wiring), Mode A/B, `INTERN_HARNESS=off`.
- Published to npm.
