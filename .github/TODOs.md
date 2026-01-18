# Project TODOs

Purpose: Track workflow for updates and additions. Follow this order of operations for any change.

General workflow

1. Read README.md to confirm the correct workflow and conventions.
2. Plan: write down the steps you will take and why; keep this list updated.
3. Research:
   - Use Context7 to fetch exact documentation first (resolve_library_id → get_documentation).
   - Use DuckDuckGo/Google to find official references where docs are missing.
4. Prefer updating existing files over creating new ones.
5. Keep existing code and comments; add detailed comments from my point of view to explain purpose and constraints.
6. Implement minimal, safe edits; add/update tests where applicable.
7. Validate with `npm test` and, if available, coverage.
8. Summarize results and update this TODO.

Active tasks (2026-01-18)

- [ ] Documentation: ensure agents and prompts reference Context7 + web search workflow and README-first guidance.
- [ ] README: add Receipt Management tools and environment variables for COLES_API_KEY and OPENAI_API_KEY.
- [ ] Copilot instructions: point to .github/agents, .github/prompts, .github/instructions.
- [ ] Agents: dev, support, qas — include README-first, Context7-first, and TODO maintenance notes.
- [ ] Prompts: confirm .github/prompts list is reflected in README.

Notes

- Do not introduce new dependencies without explicit need.
- Keep stderr-only logging for MCP server processes.
- Use `git` diffs before/after to verify scope of changes.
