# Rules — Template

> Applies to every agent/engineer working in this project.
> This is a **template**. Replace the placeholders with your project's rules.

## 1. Agent does not build or commit

| Activity | Status |
|----------|--------|
| build (`xcodebuild`, `cargo build`, `npm run build`, …) | ❌ the human runs it |
| `git add` / `git commit` / `git push` | ❌ the human runs it |
| install dependencies | ❌ the human runs it |
| run the app / simulator | ❌ the human runs it |

**You only write code and specs.** Building, committing, pushing, installing are
done by the human.

## 2. Identity / signing

Do not inject "AI", "bot", "assistant", or tool names into author fields,
signing identities, or commit metadata. Leave project identity untouched.

## 3. Spec writing rules

- `SPECmd.md` = **WHAT** — requirements, behavior, references to existing code.
- `Plan.md` = **HOW** — step-by-step implementation plan.
- `Task.md` = **WHO** — task list per role, with snippets.

One feature = one folder: `plans/<SpecName>/{SPECmd,Plan,Task}.md`.

## 4. DRY — search before you create

Before adding a new file/component, search existing ones first:
1. shared components
2. design system / UI kit
3. sibling modules with similar features
4. shared models / types

Prefer reusing over re-implementing.

## 5. API / integration pattern

> Fill in per project. Example: all network calls go through one service layer,
> injected into the view model; never call the transport directly.

## 6. License header & author credit

> Fill in per project. If your project requires a header on every new file, put
> the exact template here.

## 7. Code contribution

- Code must pass the project's linter/formatter.
- No force unwrap (or language equivalent). No dead code. No comments in
  implementation code unless the project says otherwise.

## 8. Type change propagation

When changing a type:
1. Search ALL construction sites (`grep` every place the type is created).
2. Update every mapped value — don't assume one location.
3. One missed site = a build-error cascade across files.
