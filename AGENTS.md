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
- Use `english-commits`
  (`.opencode/skills/english-commits/SKILL.md`) for anything reaching git.

## General
- Edit existing files instead of creating new ones.
- Run the relevant tests or build to verify a change.
- Keep commits atomic, with a subject line of at most 72 characters.

## Frontend
- Read `docs/frontend-architecture.md` before adding a component or changing how
  data is fetched. It records the rules that decide `.astro` vs `.tsx`, what may
  render on the server, and where shared helpers live.
- Run `bun run check` from `frontend/` before committing. `astro build`
  transpiles without type checking, so a build alone proves nothing about types.
- After changing a Java DTO or a controller signature, run `bun run gen:api`
  from `frontend/` with the API up. See `frontend/src/lib/api/README.md`.

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
