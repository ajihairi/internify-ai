# Code knowledge (learn)

`internify scan` collects the AI-context docs that already exist in your
project (`AGENTS.md`, `docs/`, skills). It never reads **source code**. On a
project with no AI files but a lot of code (like an iOS app), agents re-read
the tree every task and burn tokens.

`internify learn` closes that gap: it walks the project's Swift source, distils
a light **symbol index** (keyword → file:line) plus a **markdown digest**
(module layout, imports, "where is X"), caches them, and injects a compact
summary into the session context at boot.

Tier-light: line/regex based, no parser. Swift-only for now. Full AST graph and
multi-language are tracked as backlog B11/B12.

## What it produces

| File | Contents |
|------|----------|
| `state/learn-files.json` | Manifest `{ path, hash, size, mtimeMs }` |
| `state/learn-index.json` | Symbol index `{ path, line, symbol, kind }[]` |
| `state/LEARN.md` | Markdown digest: per-module trees, imports, "Where is X" |

All live under the knowledge dir's `state/`, fully separate from scan's
`project-files.json` / `PROJECT_CONTEXT.md`.

## Manual-only

Unlike scan, `learn` never runs at boot. Refreshing a big repo would cost too
much. You refresh it explicitly; boot just reads the cached digest when present
(cheap, no tree walk).

| Command | What it does |
|---------|--------------|
| `internify learn` | Walk Swift files, diff the manifest, rewrite index + digest |
| `intern_learn` (tool) | Same, from inside the agent; `force=true` re-indexes |

## How the agent uses it

The digest is injected into `CONTEXT.md` under **Code knowledge** at boot. To
read just the function you need instead of the whole file:

```text
keyword → learn-index → intern_context <file> <symbol> --kind function
```

`sliceFunction` / `sliceSection` already exist — `learn` feeds them the map.

## Lazy + independent cache

- Reuses the scan skip-list (`.git`, `Pods`, `build`, vendored) + depth cap.
- Diffed by size/mtime; unchanged files are never re-read.
- Cache written only when something changed — cheap second runs.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "0 swift file(s) indexed" | Wrong `target` in `internify.json`, or project isn't Swift. |
| Huge repo feels slow on first run | Expected on a big tree; later runs are stat-only. |
| Symbols missing | Regex is line-based (types/funcs/top-level var/let only). Nested or inline declarations aren't captured. |
| Want it to skip a dir | Add it to `scanIgnore` — `learn` reuses the scan skip-list. |
