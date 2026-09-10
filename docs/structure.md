# Structure profiles

internify itself stays small: it owns **context, indexing, and gates**. The
*knowledge layout* around it can range from minimal to a full second-brain.

Pick a profile per workspace. Both work with the same core.

## Simple (default)

```
<knowledge>/
├── rules.md
├── roles/
├── plans/<SpecName>/{SPECmd,Plan,Task}.md
└── daily/
```

- One folder per spec, flat.
- Best for a single app / small team.

## Advanced — second brain + PARA

Inspired by PARA (Projects, Areas, Resources, Archive) and an "AI-assisted second
brain". Useful when you want durable notes alongside specs, and want the agent to
tell **drafts** from **canonical** docs.

```
<knowledge>/
├── 00-inbox/        ← raw captures (drafts)
├── 01-projects/     ← active work (specs live here)
├── 02-areas/        ← ongoing responsibilities
├── 03-resources/    ← reference material
├── 04-archive/      ← done/inactive
├── 05-templates/    ← note + spec templates
├── 06-daily/        ← daily notes
└── state/           ← internify runtime
```

Point internify at it with `plansDir`:

```json
{
  "knowledge": "brain",
  "plansDir": "01-projects"
}
```

## Draft vs canonical

Each note carries a status in frontmatter, so the agent knows what is settled:

```markdown
---
status: draft        # draft | review | fixed
owner: <role>
updated: 2026-09-10
---
```

| Status | The agent may |
|--------|----------------|
| `draft` | rewrite freely |
| `review` | propose changes, needs approval |
| `fixed` | treat as source of truth; do not rewrite |

A future `internify` release can infer scope/gates from this status (only
`fixed` docs are "required reads"; drafts are free to edit). This keeps
maintenance bounded: you don't have to keep everything canonical.

!!! note "Why not everything in internify?"
    internify enforces the loop; it does not try to be a full note-taking system.
    Adopt only the conventions that pay off — start Simple, graduate to Advanced
    when you actually need durable notes.
