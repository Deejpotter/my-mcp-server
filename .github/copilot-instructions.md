# my-mcp-server Instructions

## Project Overview
- This repo is a TypeScript MCP server for VS Code/Copilot exposing tools, one resource, and workflow prompts over stdio.
- `src/server.ts` is the composition root: it loads `.env`, creates `McpServer`, registers modules, then connects `StdioServerTransport`.
- Architecture is intentionally modular: tool/resource/prompt registrars keep feature changes isolated and reduce transport-layer churn.

## Tech Stack
- Node 18+, TypeScript NodeNext ESM, Zod, Vitest, `@modelcontextprotocol/sdk`.
- Keep `.js` extensions in TypeScript imports because the project is ESM (`"type": "module"`).
- Active integrations on main: DuckDuckGo search, Context7 docs lookup, Hugging Face image generation, OpenAI PDF extraction, and local `maker-image-converter` CLI wrapping.
- Research workflow: use Context7 first for library docs, then `duckduckgo_search` for external verification when uncertain.

## Coding Guidelines
- Read docs first: `README.md` and `tests/README.md` before changing code paths.
- Never use `console.log` in runtime modules; stdio must stay clean. Use `console.error` for diagnostics.
- Follow existing MCP handler shape from `src/tools/fileTools.ts` and `src/tools/makerImageConverterTools.ts`:
	- Define Zod `inputSchema` and `outputSchema`.
	- Return readable `content` text.
	- Include `structuredContent` for machine-consumable results when useful.
- Reuse shared guardrails from `src/utils/security.ts`, `src/utils/cache.ts`, and `src/utils/errors.ts`.
- Preserve public tool names and schema field names unless a task explicitly changes the MCP contract.
- Prefer updating existing files over new files, and keep existing comments unless they are incorrect.
- Keep docs/prompts/agent files aligned with what `src/server.ts` currently registers.
- `google_search` is archived on main; do not add active references to it.
- If task tracking is requested, use `.github/TODOs.md` with status buckets.

## Project Structure
- `src/tools/*.ts`: MCP tool registrars and handlers (file, git, search, image, maker converter, pdf, discovery).
- `src/resources/gitResources.ts`: read-only `git://status` resource.
- `src/prompts/prompts.ts`: workflow prompts that should reference current tool names.
- `src/utils/*.ts`: shared security, cache/rate limit, error, and performance helpers.
- `tests/*.test.ts`: Vitest tests using fake server handler capture and mocked network/process behavior.
- `.github/instructions/*.instructions.md`: path-specific Copilot rules layered over this file.

## Resources
- Core commands from `package.json`: `npm run build`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run lint`.
- Practical validation loop for code changes: `npm run build` -> `npm test` -> `npm run typecheck`.
- Keep `registerDiscoveryTools(server)` last in `src/server.ts`; it depends on built `dist/tools` output.
- Keep `README.md`, `.env.example`, `.github/mcp.json`, and tool registrations synchronized when tools/env keys change.
