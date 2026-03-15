---
name: Source Module Conventions
description: Conventions for MCP source modules in src/, including server composition, tool registration, and shared utility usage.
applyTo: src/**/*.ts
---

# Source module conventions
- This repo has no frontend component layer; “components” here means MCP source modules under `src/`.
- Keep NodeNext ESM imports with explicit `.js` extensions.
- Follow existing module boundaries: tools export `registerXxxTools(server)`, resources export `registerXxxResources(server)`, and prompts are registered from `src/prompts/prompts.ts`.
- When adding MCP handlers, define Zod schemas and return readable `content`; include `structuredContent` when downstream agents benefit from structured data.
- Reuse helpers from `src/utils/` for security, caching, and error shaping instead of open-coding duplicates.
- Never add `console.log` to runtime modules; use `console.error` only.
- If you touch `src/server.ts`, preserve the registration order and keep discovery registration last.