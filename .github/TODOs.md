# Project TODOs (.github/TODOs.md)

Purpose: Track workflow for updates and additions. Use status buckets and keep only the last 10 completed tasks.

Codebase workflow (#codebase)

1. Read README.md to understand the correct workflow.
2. Use Context7 to find exact documentation before making changes.
3. Use my-mcp-server's google_search (SerpAPI) and duckduckgo_search to find official references or fill gaps.
4. Prefer updating existing files over creating new ones; keep existing code/comments and add purpose-driven notes.
5. Implement minimal, safe edits; add/update tests when applicable.
6. Summarize results and update this TODOs file.

Statuses

- Todo — upcoming tasks
- In Progress — currently being worked on
- Completed — done items (keep only the last 10)

Todo

- (none)

In Progress

- 2026-01-18: Push & sync pending changes (dev agent, copilot-instructions, prompts, TODOs)

Completed (last 10)

- 2026-01-18: Update dev.agent.md with #codebase workflow and TODOs policy
- 2026-01-18: Update README with Receipt tools and env keys (COLES_API_KEY, OPENAI_API_KEY)
- 2026-01-18: Align Copilot instructions with .github structure and #codebase policy
- 2026-01-18: Add README-first guidance to support prompts (cnc-triage, customer-reply)
- 2026-01-18: Create and standardize .github/TODOs.md with status buckets and retention policy

Notes

- Do not introduce new dependencies without explicit need.
- Use stderr-only logging for MCP server processes (no console.log in MCP transports).
- Use git diffs before/after to verify scope of changes.
