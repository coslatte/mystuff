# Project Guidelines

## Language — English Only for Code & Commits
- **All commits MUST be written in English** — title and body. This is required for homogeneity across the codebase and team.
- Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `build:`, `ci:`
- Example: `feat: add admin song upload endpoint` — NOT `feat: agregar endpoint de subida`
- All code, comments, PR descriptions, branch names, and documentation must also be in English.
- Agent responses to the user may be in Spanish when the user writes in Spanish, but any artifact that touches git (commit messages, PR titles) must be in English.

## Skills for Agents
- Agents MUST load and follow project skills under `.opencode/skills/*/SKILL.md` when relevant.
- Before coding, check available skills via `skills` scope in opencode and load the matching one.
- Key skill: `english-commits` — enforces English conventional commits (see `.opencode/skills/english-commits/SKILL.md`).

## General
- Prefer editing existing files over creating new ones.
- Verify changes by running relevant tests/builds when applicable.
- Keep commits atomic and messages concise (max 72 chars for subject line).

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
