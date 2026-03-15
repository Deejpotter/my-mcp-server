---
name: Testing Workflow
description: Vitest patterns for MCP tool tests, mocks, and handler-level assertions in this repository.
applyTo: tests/**/*.ts,vitest.config.ts
---

# Testing workflow
- Tests live in `tests/` and use Vitest on the Node environment configured in `vitest.config.ts`.
- Keep ESM import style with `.js` extensions when importing from `../src/...`.
- Match the existing MCP test style: use a fake server that captures `registerTool` handlers, then call the handler directly as in `tests/duckduckgo.mock.test.ts` and `tests/tools_register.test.ts`.
- Mock network calls with `vi.stubGlobal("fetch", ...)` or `globalThis.fetch = vi.fn(...)`, and restore globals in `afterEach`.
- Prefer focused unit tests over live network calls; cover happy paths plus explicit error/security cases when tool behavior changes.
- If you add or rename a tool, update both the dedicated test file and `tests/tools_register.test.ts`.