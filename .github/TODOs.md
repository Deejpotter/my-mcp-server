# Project TODOs (.github/TODOs.md)

Purpose: Track workflow for updates and additions with clear status buckets.

## Codebase workflow

1. Read `README.md` first.
2. Use Context7 for exact library docs before edits.
3. Use `duckduckgo_search` when not 100% sure about external facts.
4. Prefer updating existing files over creating new ones.
5. Keep edits minimal and safe; add/update tests when behavior changes.
6. Summarize outcomes and update this TODOs file.

## Statuses

- Todo: Upcoming tasks
- In Progress: Active work
- Completed: Done items (keep last 10)

## Todo

- Normalize stale references to archived `google_search` in `.github/prompts/updateDocsWorkflow.prompt.md` and `.github/agents/qas.agent.md`.

## In Progress

- (none)

## Completed (last 10)

- 2026-03-15: Repaired malformed `.github/TODOs.md` path/header and removed accidental numbered code-fence dump.
- 2026-01-26: Push & sync pending changes (dev agent, copilot-instructions, prompts, TODOs) - reviewed, checks passed, branch prepared for PR.
- 2026-01-18: Update `dev.agent.md` with `#codebase` workflow and TODOs policy.
- 2026-01-18: Update README with receipt tools and environment keys.
- 2026-01-18: Align Copilot instructions with `.github` structure and `#codebase` policy.
- 2026-01-18: Add README-first guidance to support prompts (`cnc-triage`, `customer-reply`).
- 2026-01-18: Create and standardize `.github/TODOs.md` with status buckets and retention policy.

## Notes

- Do not introduce new dependencies without explicit need.
- Keep MCP runtime logging on stderr (`console.error`), never `console.log`.
- Review git diffs before and after edits to verify scope.
