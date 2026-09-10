---
name: status-aware
description: Use when reading or writing docs/specs in this workspace. Treats a document's `status:` frontmatter as its authority level, so the agent knows what is settled (fixed) vs still a draft. Trigger keywords: status, draft, review, fixed, canonical, source of truth.
---

# status-aware

Documents in this workspace carry a `status` in frontmatter:

```markdown
---
status: draft        # draft | review | fixed
owner: <role>
updated: 2026-09-10
---
```

## Rules

- **`fixed`** — the source of truth. Do **not** rewrite. Read it as a required
  read; cite changes back to it.
- **`review`** — propose changes and wait for approval before editing.
- **`draft`** — free to edit/rewrite. It is a scratchpad, not authority.

## Why

Not every document needs to be maintained. Marking drafts as drafts keeps the
"fixed" set small, so the agent knows what must stay true and what is negotiable.
