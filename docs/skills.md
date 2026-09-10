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

Copy the pack's skill/command folders into your provider's directory, or keep
them in a central skills path your tool already scans. `internify init` (future)
can install a chosen set:

```bash
internify init --tool opencode --skills superpowers,caveman
```

!!! note "Roadmap"
    Skill-pack installation is planned, not implemented yet. Today you install
    packs the same way you always have for your tool.
