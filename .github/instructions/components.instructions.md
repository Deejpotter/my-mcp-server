---
applyTo: src/**/*.ts
---

# Source module conventions
- This repo has no frontend layer; "components" here means MCP modules under `src/`.
- Keep NodeNext ESM imports with explicit `.js` suffixes.
- Respect module boundaries:
	- tools export `registerXxxTools(server)`
	- resources export `registerXxxResources(server)`
	- prompts are registered through `src/prompts/prompts.ts`
- When adding a tool module, wire all four surfaces in one change:
	- register in `src/server.ts`
	- add/update tests (including `tests/tools_register.test.ts`)
	- update `README.md` tool docs
	- update `.env.example` when env keys are introduced
- Reuse `src/utils/*` helpers for security/cache/errors rather than duplicating logic.
- Runtime logging must stay stderr-only (`console.error`); do not use `console.log`.
- Keep `registerDiscoveryTools(server)` last in `src/server.ts`.