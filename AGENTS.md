# Project Guidelines

## Language: English only for code and commits
- Every commit must be in English, title and body. The codebase and the team are
  mixed, so this is not optional.
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `build:`, `ci:`, `revert:`
- Example: `feat: add admin song upload endpoint`, never `feat: agregar endpoint de subida`
- Code, comments, PR descriptions, branch names and docs follow the same rule.
- Replies to the user may be in Spanish when the user writes in Spanish. Anything
  that reaches git stays in English.

## Skills for agents
- Load the matching skill from `.opencode/skills/*/SKILL.md` before coding.
  Check the `skills` scope in opencode first.
- Use `translation-sync`
  (`.opencode/skills/translation-sync/SKILL.md`) whenever adding, changing or
  removing user-facing page text or localization entries. Update the matching
  content across every supported language before finishing.
- Use `english-commits`
  (`.opencode/skills/english-commits/SKILL.md`) for anything reaching git.

## General
- Edit existing files instead of creating new ones.
- Run the relevant tests or build to verify a change.
- Keep commits atomic, with a subject line of at most 72 characters.

## Frontend
- Read `docs/frontend/architecture.md` **before changing anything under
  `src/frontend/src/`**. It is the decision record: the rules a change must obey, the
  dependency direction between layers, the file index that says where a change
  belongs, and the reasoning behind decisions that look arbitrary.
- That document is living. Update it in the same commit as the code whenever you
  move/rename/add/delete a file, change or deliberately break a rule, or learn
  why something is the way it is. A stale architecture document is worse than
  none, because it gets trusted.
- Rule 6 in that document governs comments: explain *why*, never *what*. The
  test is whether the comment would still be true after renaming the function to
  something accurate.
- Run `bun run check` from `src/frontend/` before committing. `astro build`
  transpiles without type checking, so a build alone proves nothing about types.
- After changing a Java DTO or a controller signature, run `bun run gen:api`
  from `src/frontend/` with the API up. See `src/frontend/src/types/api/README.md`.

<!-- codebase-memory-mcp:start -->
# Codebase Memory

## Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

### Priority Order
1. `search_graph` — find functions, classes, routes, variables by pattern
2. `trace_path` — trace who calls a function or what it calls
3. `get_code_snippet` — read specific function/class source code
4. `check_index_coverage` — validate candidate paths and missed ranges before claims
5. `query_graph` — run Cypher queries for complex patterns
6. `get_architecture` — high-level project summary
<!-- codebase-memory-mcp:end -->
