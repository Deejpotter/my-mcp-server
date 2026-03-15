---
name: Debugging Workflow
description: Practical debugging steps for stdio runtime issues, security failures, prompt mismatches, and failing MCP tool tests.
applyTo: src/**/*.ts,tests/**/*.ts,README.md,.github/**/*.md
---

# Debugging workflow
- Start with the docs (`README.md`, `tests/README.md`, and `.github` customization files), then verify code paths.
- For code changes, prefer this loop: `npm run build` → `npm test` → inspect `get_errors` output.
- Use `npm run dev` only when you need live stdio behavior; for most regressions, handler-level tests are faster and less noisy.
- Runtime logging must stay on `console.error`; do not add `console.log` while debugging MCP transport issues.
- Security-related failures usually trace back to `src/utils/security.ts` or `tests/security.test.ts`.
- If behavior and docs disagree, check `src/server.ts`, `src/prompts/prompts.ts`, `.github/agents`, and `.github/prompts` together before changing guidance.
- When you are not fully sure about an external error, recommendation, or compatibility claim, verify it with `duckduckgo_search` before updating code or docs.