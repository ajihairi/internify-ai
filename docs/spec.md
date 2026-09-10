# Specs

One feature = one spec folder. It **must** contain three files:

```
<knowledge>/plans/<SpecName>/
├── SPECmd.md     ← WHAT : requirements, behavior, references to existing code
├── Plan.md       ← HOW  : step-by-step implementation plan
└── Task.md       ← WHO  : task list per role, with snippets
```

The folder name is the spec name (e.g. `FeatureX`). A ready-to-copy template
lives at `plans/_template/SpecName/` (installed by `internify init`).

Scaffold one instead of copying by hand:

```bash
internify spec new FeatureX            # -> plans/FeatureX/{SPECmd,Plan,Task}.md
internify spec new Module/FeatureX     # nested
```

In chat, use `/internify.spec <Name>`: it scaffolds the folder, interviews you,
and drafts the three files. Both fill in `<SpecName>`, `<role>`, and
`<YYYY-MM-DD>`.

## What the harness does with a spec

- `internify index <spec-folder>` scans `SPECmd.md` / `Plan.md` / `Task.md`,
  resolves the referenced code files, hashes them, and builds `INDEX.md`.
- Headings become **slices**; resolved files become **anchors**.
- Steps are derived from the spec, each with an anchor.

## Optional larger hierarchy

```
<knowledge>/plans/
├── _template/SpecName/{SPECmd,Plan,Task}.md
├── <Module>/
│   ├── brief.md
│   ├── <SpecName>/{SPECmd,Plan,Task}.md
│   └── <SpecName2>/{SPECmd,Plan,Task}.md
```

## Templates

=== "SPECmd.md"

    ```markdown
    # SPEC — <SpecName>

    Status: Draft
    Owner: <role>

    ## Goal
    ## Requirements
    ## Behavior
    ## Existing code references
    ## Out of scope
    ## Acceptance criteria
    ```

=== "Plan.md"

    ```markdown
    # Plan — <SpecName>

    ## Files
    ## Steps
    ## Verification
    ```

=== "Task.md"

    ```markdown
    # Task — <SpecName>

    | # | Role | Task | Files | Done |
    ```
