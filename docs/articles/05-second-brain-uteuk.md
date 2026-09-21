# 05 — internify × uteuk: The Grounded Loop Meets the Second Brain

> **inter**nal note, first **i**nbox, then **fy**re — no. This one is about a
> handshake between two tools that do fundamentally different jobs, and why
> the composition works better than either alone.

---

## 1. Two tools, two failure modes

Every AI-assisted workflow eventually hits one of two walls:

- **The agent drifts.** It forgets what step it is on, invents files, edits
  things outside scope. internify exists for this: context on disk, layered
  gates, evidence per step. The agent is *grounded*.
- **The knowledge rots.** Ideas arrive faster than they are processed. Notes
  pile up in chat history, Slack threads, and stale buffers. uteuk exists for
  this: a PARA vault (Projects, Areas, Resources, Archive) with an AI pipeline —
  capture → process → organize → express. The knowledge is *organized*.

Notice the failure modes are orthogonal. A perfectly grounded agent working on
an unorganized pile of intentions still builds the wrong thing. A beautifully
organized vault full of ideas nobody executes is a very tidy graveyard.

So the obvious question: can one agent run both loops at once?

## 2. The handshake point

The two systems meet at exactly one place: **the moment an idea becomes a
spec.**

Before that moment, a note is a *why* — context, motivation, half-formed
constraints. After it, a spec is a *how* — steps, gates, evidence. Everything
upstream of the boundary belongs to uteuk; everything downstream belongs to
internify.

```text
uteuk (organized)                      internify (grounded)
┌──────────────────────┐   promote    ┌──────────────────────┐
│ 00-Inbox  (raw)      │ ───────────► │ plans/<SpecName>/    │
│ 01-projects (notes)  │   to spec    │  SPECmd + Plan + Task│
│ 03-resources (refs)  │              │  steps + gates + proof│
└──────────────────────┘              └──────────────────────┘
        capture → process → organize        boot → work → close
```

This is why the integration is almost free. internify's advanced structure
profile already speaks PARA (`plansDir: 01-projects`, `dailyDir: 06-daily`),
and uteuk speaks PARA natively. We did not build a bridge — we noticed both
tools were already standing on the same island.

## 3. What we deliberately did NOT do

The tempting move was deeper integration: make internify read the vault's
frontmatter, auto-promote notes into specs, let gates validate note status.
We said no, for one reason: **versioning.**

internify does not vendor external skill packs — it copies them and records a
content hash in a manifest. When uteuk ships an update, `internify skills
update` re-syncs just the changed files. That only works if the coupling stays
at the *file boundary*. The moment internify parses uteuk's internals, every
upstream refactor becomes a breaking change in internify.

The rule we settled on:

> Compose at the **format** level (markdown, folders, frontmatter), never at
> the **implementation** level (each other's code).

The one exception we accept: a scaffolder refactor in uteuk (say, renaming
`00-Inbox` → `00-inbox`) does not migrate existing vaults — that is uteuk's
own migration to run, and it is documented as such. Copy ≠ sync ≠ migrate.
Three different verbs; only the first two are ours.

## 4. What each tool refuses to own

Composition also means honest boundaries:

| Concern | internify says | uteuk says |
|---------|---------------|------------|
| "Where does this idea live?" | not my job | `00-Inbox/` |
| "Is this idea worth building?" | not my job | process/organize pipeline |
| "Is this spec executable?" | gates check it | not my job |
| "Did the agent actually do the work?" | evidence ledger | not my job |
| "Where did the week go?" | daily log | weekly review |

A tool that answers every question owns nothing well. Both tools stay small
because they refuse half of each other's job description.

## 5. The session, end to end

What it looks like in practice, one afternoon:

1. `/uteuk.capture` — an idea about a caching layer lands in the inbox.
2. `/uteuk.process` — expanded, linked, moved to `01-projects/`.
3. The note is ready. `internify spec` scaffolds a spec beside it. The uteuk
   note stays as the spec's *why*.
4. `/internify.work` — the grounded loop: steps declared, anchors checked,
   evidence appended, gates enforced.
5. `/internify.close` — done, ledger closed.
6. `/uteuk.weekly-review` — the vault reflects what actually shipped.

Six commands, two tools, one agent, zero shared code.

## 6. Closing

The full-second-brain combo — internify (grounded) + superpowers (disciplined)
+ uteuk (organized) — is not a framework. There is no orchestrator, no shared
runtime, no plugin API between them. It is three independent tools that agree
on folders and markdown, and refuse to agree on anything else.

That refusal is the feature.

---

**See also**

- [Full second brain (docs)](../second-brain.md) — the practical setup and
  update flow
- [uteuk](https://rezkyahairy.github.io/uteuk/) — the other half of this
  handshake; vault structure, workflows, and its own philosophy
- [02 — Portability](02-portability.md) — why markdown + folders is the
  contract that makes this composition possible
