---
applyTo: src/**/*.ts,tests/**/*.ts,README.md,.github/**/*.md
---

# Debugging workflow
- Start with docs first: `README.md` and `tests/README.md`, then trace the implementation.
- Preferred validation loop for changes: `npm run build` -> `npm test` -> `npm run typecheck`.
- Use `npm run dev` only for stdio/runtime behavior checks; most tool regressions are faster to debug via handler-level tests.
- Keep runtime logs on stderr only (`console.error`); `console.log` can corrupt MCP stdio transport.
- If a tool is "missing", verify registration in `src/server.ts` and corresponding expectations in `tests/tools_register.test.ts`.
- If behavior and docs diverge, update `src/server.ts`, `README.md`, and `.github` prompt/agent docs together.
- Security failures usually come from `src/utils/security.ts` checks or path assumptions in tool handlers.
- For external compatibility or API uncertainty, verify with Context7 first and then `duckduckgo_search` before editing docs/comments.