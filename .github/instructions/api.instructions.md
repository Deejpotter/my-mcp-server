---
applyTo: src/tools/**/*.ts,src/resources/**/*.ts
---

# MCP API and tool design
- Keep tool/resource handlers as thin adapters: validate input, call integration/utilities, then shape `content` and optional `structuredContent`.
- Preserve public MCP contracts unless explicitly asked to change them:
	- Tool name passed to `server.registerTool(...)`
	- Input/output schema field names
	- Existing response keys consumed by tests/agents
- Follow schema/response patterns from `src/tools/fileTools.ts`, `src/tools/context7Tools.ts`, and `src/tools/makerImageConverterTools.ts`.
- For external integrations, fail fast with readable user errors (missing env, invalid IDs/paths, rate limits) instead of raw stack traces.
- Reuse `src/utils/security.ts`, `src/utils/cache.ts`, and `src/utils/errors.ts` before introducing new guardrail code.
- For process execution wrappers, use argument arrays (no shell interpolation) and keep path validation mandatory.
- When tools change, update related docs/prompts so names match `src/server.ts` registrations in the same change.
- Verify uncertain API behavior using Context7, then `duckduckgo_search` before hard-coding recommendations or docs claims.