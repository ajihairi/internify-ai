# Skill packs

Optional **skills** that enhance internify. `internify init` offers to install
them (with confirmation); non-interactively use `--skills`:

```bash
internify init --skills all
internify init --skills none
internify init --skills superpowers,caveman
```

## Resolution

A pack named `<name>` is resolved from, in order:

1. **bundled** — `packs/<name>/` inside this package
2. **external** — a known skills root on your machine:
   - `~/.config/opencode/skills/<name>`
   - `~/.claude/skills/<name>`
   - `~/.agents/skills/<name>`

Bundled packs ship with internify. External packs are whatever you already have
(e.g. `superpowers`, `caveman`, `uteuk`) — internify only copies them, it does
not vendor third-party content.

## Install target

| Provider | Target dir |
|----------|------------|
| opencode | `<workspace>/.opencode/skills/<name>/` |
| claude | `<workspace>/.claude/skills/<name>/` |
| none | `<knowledge>/skills/<name>/` |

Existing packs are never overwritten.

## Bundled

- `status` — use `status: draft|review|fixed` frontmatter to guide the agent
  (see [Structure profiles](../docs/structure.md)).
