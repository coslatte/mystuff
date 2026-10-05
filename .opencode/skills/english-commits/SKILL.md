---
name: english-commits
description: Enforce English conventional commits. Use when creating commits, PR titles, branch names, code comments or any git artifact. Triggers on: commit, conventional commits, commit message.
---

# English commits

Everything that reaches git is in English.

## Rules

Commit titles, bodies, PR titles and descriptions, branch names, code and code
comments are all English. Translate a Spanish message rather than committing it.

Follow Conventional Commits, `type(scope): description`. Types: `feat`, `fix`,
`chore`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`, `revert`. Subject
line at most 72 characters, lowercase, imperative, no trailing period.

Write a body only when the commit needs one: what changed and why, in bullets,
not how. Wrap at 72 characters.

Reply to the user in Spanish when they write in Spanish. Never carry that into a
commit.

## Workflow for agents

Check the message is English and conventional before `git commit`. Run
`git status && git diff --staged` to confirm the staged content matches it.

## Examples

`fix(auth): handle expired JWT on refresh`

`chore(deps): bump Spring Boot to 3.2.5`

`fix: arregla token expirado` becomes `fix(auth): handle expired token`