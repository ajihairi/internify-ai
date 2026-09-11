# Project context (scan)

internify's `boot` collects session context from the **knowledge dir** (rules,
daily, active task). Everything the agent knows comes from there plus each spec.

That leaves a gap: the AI-relevant files that live **inside your project code**
(`AGENTS.md`, `docs/`, skill folders, editor rules) were never seen. The `scan`
feature closes it by discovering those files, caching them, and injecting them
into the session context.

## What it does

1. **Discovers** AI-context files in the project dir (`target`).
2. **Caches** them in the knowledge `state/` as a manifest + a ready markdown
   bundle.
3. **Lists** them in `CONTEXT.md` under **Project AI files** every boot.

The flow is:

```text
boot (or: internify scan) → walk project (whitelist only) → diff cache → write bundle → CONTEXT.md lists files
```

## What is picked up (whitelist)

| Kind | Examples |
|------|----------|
| Root docs | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `OPENCODE.md` |
| AI dirs | `docs/`, `.cursor/rules/`, `.claude/`, `.opencode/`, `.github/`, `skills/` |
| Naming | `*.skills.md`, `*.ai.md` |

Everything else is left alone. This is a **whitelist**, not a full-tree scan:
`README.md`, source files, and arbitrary notes are not collected.

## What is skipped

| Kind | Examples |
|------|----------|
| VCS / deps | `.git`, `node_modules`, `Pods/`, `vendor/` |
| Build output | `build/`, `DerivedData/`, `.build/` |
| Your knowledge dir | the `knowledge` folder (when it is inside `target`) |
| Config | paths in `scanIgnore` |

Walking is depth-capped (default 4) so a huge monorepo is never fully traversed.

## Config

Add `scan` (extra includes) or `scanIgnore` (extra skips) to `internify.json`.
Paths are relative to `target`.

```json
{
  "knowledge": "intern",
  "target": "my-code-repo",
  "scan": ["team-notes", "onboarding.md"],
  "scanIgnore": ["SecretDocs"]
}
```

Includes can be a file or a directory; a directory include pulls matching
markdown under it.

## Commands

| Command | What it does |
|---------|--------------|
| `internify scan` | Walk the project and refresh the cached project context |
| `intern_scan` (tool) | Same, from inside the agent; `force=true` re-scans |
| `internify boot` | Auto-scans once if the cache is missing / stale, then loads it |

## When does it actually run?

**Lazy auto + cache.** `boot` walks the project once if no cache exists. After
that, it compares file size + mtime against the manifest and only re-reads
content when something changed. Unchanged files are never re-read; the bundle is
never rewritten when nothing changed.

- First `boot` in a fresh workspace: scans once.
- Later boots: cheap stat-only check, loads the cache.
- Explicit refresh any time: `internify scan` or `intern_scan`.

Throw the off switch with an environment variable:

```bash
INTERN_SCAN=off opencode     # no auto-scan at boot
```

Explicit `internify scan` still works with `INTERN_SCAN=off`; only the automatic
boot walk is skipped.

## Cache files

| File | Contents |
|------|----------|
| `state/project-files.json` | Manifest: `{ path, hash, size, mtimeMs, updated }` |
| `state/PROJECT_CONTEXT.md` | Markdown bundle of all discovered files (one `##` section each) |

Both live under the knowledge dir (`<knowledge>/state/`). They are meant to be
committed so the cache survives across machines and sessions. The bundle is
**read-only input** for the agent: discovered docs are never rewritten.

## Example

```text
$ internify scan
scan: 4 project AI file(s) cached (changed)
  ~ Docs/rxswift_to_combine_cheatsheet.md
  ~ Docs/mpinv2.md
  ~ Docs/components.md
  ~ Docs/bca_flazz.md
```

`CONTEXT.md` then shows:

```markdown
## Project AI files
- Docs/rxswift_to_combine_cheatsheet.md
- Docs/mpinv2.md
- Docs/components.md
- Docs/bca_flazz.md

> Full contents: state/PROJECT_CONTEXT.md
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No files collected | Confirm the content matches the whitelist (`docs/`, `AGENTS.md`, `*.skills.md`, ...), not just any `.md` |
| Huge repo feels slow | Raise nothing; the walk is depth-capped and skips `Pods`/`node_modules`/`.git`. Check `scanIgnore` if vendored docs sneak in |
| A file isn't picked up | Add it via `scan` in `internify.json` or move it under `docs/` |
| Want the agent to ignore it | Add to `scanIgnore` |
| Accidentally scanned your knowledge dir | It is auto-ignored when inside `target`; or add it to `scanIgnore` |
| No auto-scan at boot | Check `INTERN_SCAN` is not set to `off`; check `bun`/node can read `target` |