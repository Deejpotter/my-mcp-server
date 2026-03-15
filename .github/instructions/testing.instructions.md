---
applyTo: tests/**/*.ts,vitest.config.ts
---

# Testing workflow
- Tests run with Vitest in `tests/`; keep imports ESM-compatible (`../src/... .js`).
- Follow existing MCP test pattern:
	- capture handlers via fake `registerTool` server
	- invoke handler directly with test inputs
	- assert on both `content` text and `structuredContent` when present
- Prefer deterministic unit tests over live network/API calls.
- For filesystem/process tools, use temp directories and explicit cleanup in `afterEach` (see `tests/fileTools.test.ts`, `tests/makerImageConverterTools.test.ts`).
- Mock globals and restore them every test file (`vi.restoreAllMocks()` / cleanup hooks).
- When adding or renaming tools, update dedicated tests and `tests/tools_register.test.ts` in the same change.
- Use `npm test` for full suite and `npx vitest run tests/<file>.test.ts` for targeted debugging.