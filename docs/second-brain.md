# Full second brain: internify + uteuk

internify keeps the agent **grounded** (what step, what file, what proof).
[uteuk](https://rezkyahairy.github.io/uteuk/) keeps your knowledge **organized**
(a PARA second brain for Obsidian). Together they form the recommended
**full second brain** combo:

```text
internify  →  the engine: context on disk, indexing, gates, evidence
uteuk      →  the vault: capture → process → organize → express
```

One runs your specs; the other runs your notes. They share the same disk, so
they can share the same structure.

---

## Why uteuk fits

[uteuk](https://rezkyahairy.github.io/uteuk/) is an AI-assisted second-brain CLI
for Obsidian (Basa Sunda: *otak*). It installs note templates, AI pipeline
prompts, and slash commands (`/uteuk.capture`, `/uteuk.process`,
`/uteuk.organize`, ...) into your AI agent — the same agent that runs internify.

internify's **Advanced structure profile** was inspired by PARA, and uteuk
speaks PARA natively. So instead of two competing layouts, you get one:

| Concept | uteuk | internify |
|---------|-------|-----------|
| Active work | `01-projects/` | specs live here (`plansDir`) |
| Raw ideas | `00-Inbox/` | — (capture first, spec later) |
| Reference | `03-resources/` | injected via [scan](scan.md) |
| Done work | `04-archive/` | rework/revision history |
| Daily notes | `06-daily/` | daily log (`dailyDir`) |
| Runtime | vault health checks | `state/` (active.json, CONTEXT.md, ledger) |

## Setup

### 1. Install uteuk

```bash
npm install -g uteuk
```

Requires Node.js >= 24. See the
[uteuk docs](https://rezkyahairy.github.io/uteuk/) for details.

### 2. Scaffold the workspace with the advanced profile

```bash
internify init --tool opencode --profile advanced
```

This creates a PARA-shaped knowledge dir and writes `internify.json`:

```json
{
  "knowledge": "brain",
  "plansDir": "01-projects",
  "dailyDir": "06-daily"
}
```

Your specs now live beside uteuk's project notes — same folder family, same
PARA flow.

### 3. Initialize the uteuk vault

Point uteuk at the same knowledge dir (or a dedicated Obsidian vault — both
work; the important thing is the PARA folders line up with `plansDir`):

```bash
uteuk init --from-scratch ~/my-workspace/brain
```

### 4. Register uteuk as a skill pack

internify resolves skill packs from your machine's global skills roots:

```bash
# clone uteuk into a global skills root (any of these works)
git clone https://github.com/rezkyahairy/uteuk.git \
  ~/.config/opencode/skills/uteuk

# install its skills/commands into the workspace
internify init --tool opencode --skills uteuk
```

From now on, `/uteuk.*` slash commands and internify commands coexist in the
same agent session.

---

## Keeping uteuk up to date

internify does **not** vendor external packs — it **copies** them and records
the source + content hash in `.internify-packs.json`. When uteuk releases an
update, re-sync in two commands:

```bash
cd ~/.config/opencode/skills/uteuk && git pull
internify skills update --packs uteuk
```

Only changed files are rewritten (hash-diffed), and the manifest is refreshed.
To re-sync every installed pack: `internify skills update`.

### What updates — and what doesn't

| Artefact | Follows uteuk updates? | How |
|----------|------------------------|-----|
| Pack files (SKILL.md, slash commands, prompts) | Yes | `internify skills update --packs uteuk` |
| Vault folders already scaffolded | **No** | Run uteuk's own scaffold/migrate flow, or move folders manually |

!!! warning "Scaffolder refactors"
    If uteuk renames or restructures its template folders (e.g. `00-Inbox` →
    `00-inbox`), `skills update` refreshes the *commands*, not your *vault*.
    After pulling an upstream restructure, check uteuk's release notes and
    migrate existing folders yourself — internify never touches your notes.

!!! tip "Don't edit the copy"
    If you modify the pack files inside the workspace, the next
    `skills update` silently overwrites them. Edit the source clone in
    `~/.config/opencode/skills/uteuk` instead.

---

## How the two loops interlock

A typical session:

1. **Capture** — an idea lands via `/uteuk.capture` → `00-Inbox/`.
2. **Process** — `/uteuk.process` and `/uteuk.organize` shape it into a
   project note under `01-projects/`.
3. **Promote to spec** — when a note is ready to execute, scaffold an
   internify spec next to it (`internify spec` / `/internify.spec`).
   The uteuk note becomes the *why*; the internify spec becomes the *how*.
4. **Execute** — `/internify.work` runs the grounded loop: steps, gates,
   evidence.
5. **Close & reflect** — `/internify.close` finishes the task;
   `/uteuk.daily` and `/uteuk.weekly-review` audit the vault.

### Surface notes into sessions

internify's [scan](scan.md) collects AI-relevant files from the project.
To make uteuk's vault visible to every session, whitelist the folders you
want injected into `internify.json`:

```json
{
  "knowledge": "brain",
  "plansDir": "01-projects",
  "dailyDir": "06-daily",
  "scan": ["02-areas", "03-resources"]
}
```

Keep the list small — scanned files are injected into every session context.

---

## Division of labor

| Concern | Owner |
|---------|-------|
| Context on disk, gates, evidence, task ledger | internify |
| Idea capture, note processing, PARA organization | uteuk |
| Process discipline (TDD, debugging, review) | superpowers (optional) |
| Token-efficient output | caveman (optional) |

## See also

- [uteuk documentation](https://rezkyahairy.github.io/uteuk/) — vault
  structure, workflows, slash commands, troubleshooting
- [Structure profiles](structure.md) — simple vs advanced (PARA)
- [Skills](skills.md) — how packs resolve, install, and update
- [Project context (scan)](scan.md) — injecting files into session context
