---
name: english-commits
description: Enforce English conventional commits for homogeneity. Use when creating commits, PR titles, branch names, code comments or any git artifact. Triggers on: commit, conventional commits, mensaje de commit, commits en ingles.
---

# English Commits

All git artifacts in this project MUST be in English.

## Rules
1. **Language**: Every commit title, body, PR title/description, and branch name must be in English. Never use Spanish even if the user writes in Spanish.
2. **Format**: Follow Conventional Commits: `type(scope): description`
   - Allowed types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`, `revert`
   - Example: `feat(admin): add song upload endpoint` — NOT `feat(admin): agregar endpoint de subida`
   - Subject line max 72 chars, lowercase, imperative mood, no period at end.
3. **Body** (when needed): English, bullet points explaining what/why, not how. Wrap at 72 chars.
4. **Code & comments**: Also English-only. Variables, functions, and inline comments must be in English.
5. **Agent responses**: May respond in Spanish if user speaks Spanish, but NEVER translate that to commits.

## Workflow for Agents
- Before `git commit`, verify message is English + conventional.
- If user provides a commit message in Spanish, translate it to English preserving intent, then commit.
- Use `bash` with `git status && git diff --staged` to verify staged content matches message.

## Examples
- Good: `fix(auth): handle expired JWT on refresh`
- Good: `chore(deps): bump Spring Boot to 3.2.5`
- Bad: `fix: arregla token expirado` -> should be `fix(auth): fix expired token handling`
