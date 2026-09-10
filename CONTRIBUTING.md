# Contributing to internify

Thanks for helping. This project is small on purpose — keep it that way.

## Setup

```bash
git clone git@github.com:ajihairi/internify-ai.git
cd internify-ai
(cd adapters/opencode && bun install)   # dev deps
bun test core/lib adapters/opencode
bun core/smoke.ts
```

## What to work on

- `core/lib` — pure logic. Add tests for anything new.
- adapters — thin wiring only; business logic belongs in `core/lib`.
- docs — `docs/` (MkDocs). Build with `mkdocs build --strict`.

## Pull requests

1. Keep changes focused; one concern per PR.
2. Tests must pass (`bun test core/lib adapters/opencode`) and `tsc` clean.
3. Update `docs/` and `CHANGELOG.md` when behavior changes.
4. Match the existing style (small files, pure functions, no dead code).

## Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`).

## Releasing

Bump `version` in `package.json`, update `CHANGELOG.md`, then push a tag:

```bash
git tag v0.7.0 && git push origin v0.7.0
```

`.github/workflows/publish.yml` runs the tests and publishes to npm. It needs a
repo secret `NPM_TOKEN` (a granular npm token with "bypass 2FA").

## Authorship

The **human** authors commits. Agents may write code and open PRs, but do not add
themselves as authors.
