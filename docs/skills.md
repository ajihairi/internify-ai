# Skills (optional enhancements)

internify owns the **loop**: context on disk, indexing, and gates. It deliberately
does **not** try to do everything. Extra behaviors come from **skill packs** that
plug into your AI tool's skill/command mechanism.

Think of it as: `internify` = the engine; skills = optional modules.

## What a skill pack is

A folder of markdown skills (`SKILL.md`) + optional slash commands, installed
into whatever your tool reads:

| Tool | Where skills/commands live |
|------|----------------------------|
| opencode | `.opencode/skills/<name>/SKILL.md`, `.opencode/command/*.md` |
| Claude Code | `.claude/skills/`, `.claude/commands/` |
| others | whatever the tool documents |

Because skills are just markdown, the same pack works across tools.

## Packs worth mixing in

| Pack | What it adds | Kind |
|------|--------------|------|
| **superpowers** | Process discipline: brainstorming, writing plans, TDD, systematic debugging, code review | workflow |
| **uteuk** | Second-brain / PARA note pipeline (capture → process → organize), templates, vault health | knowledge |
| **ponytail** | (your pack) — project-specific conventions | custom |
| **caveman** | Ultra-compressed communication to save tokens | output style |

They are complementary:

- internify keeps the agent **grounded** (what files, what step, what proof).
- superpowers keeps the agent **disciplined** (how to plan, test, review).
- uteuk keeps the agent **organized** (where knowledge lives; see
  [Structure profiles](structure.md)).
- caveman keeps the agent **cheap** (fewer output tokens).
- ponytail keeps the agent **on-convention** for a given project.

## Recommended combo

- Minimal: `internify` only.
- Balanced: `internify` + `superpowers` + `caveman`.
- Full second brain: `internify` + `superpowers` + `uteuk` (Advanced structure).

## Installing a pack

`internify init` offers packs and installs the ones you confirm:

```bash
internify init --tool opencode              # interactive: all / select / none
internify init --tool opencode --skills all
internify init --tool opencode --skills none
internify init --tool opencode --skills superpowers,caveman
internify init --tool opencode --yes        # skip prompts (installs none)
```

List what is available:

```bash
internify skills list
```

### Resolution

A pack named `<name>` is found, in order, from:

1. **bundled** — `packs/<name>/` inside the internify package
2. **external** — `~/.config/opencode/skills/<name>`, `~/.claude/skills/<name>`,
   `~/.agents/skills/<name>`

internify only **copies** external packs — it does not vendor third-party
content. Existing packs in the target are never overwritten.

Install target:

| Provider | Target |
|----------|--------|
| opencode | `<workspace>/.opencode/skills/<name>/` |
| claude | `<workspace>/.claude/skills/<name>/` |
| none | `<knowledge>/skills/<name>/` |
