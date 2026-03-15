# my-mcp-server Instructions

## Project Overview
- This repository is a TypeScript MCP server for VS Code/Copilot that exposes tools, one resource, and workflow prompts over stdio.
- `src/server.ts` is the composition root: it loads `.env`, creates the `McpServer`, registers all modules, and connects `StdioServerTransport`.
- Most feature work happens in modular registrars under `src/tools`, `src/resources`, and `src/prompts`; keep their exported `registerXxx...` functions small and composable.

## Tech Stack
- Node 18+, TypeScript, NodeNext ESM, Vitest, Zod, and `@modelcontextprotocol/sdk`.
- Keep `.js` import extensions in TypeScript source because the project runs as ESM (`"type": "module"`).
- External integrations currently include DuckDuckGo HTML search, Context7 docs, Hugging Face image generation, and OpenAI-based PDF receipt extraction.
- Use Context7 for authoritative library docs, and use `duckduckgo_search` whenever you are not 100% sure about an external fact, API behavior, or recommendation.

## Coding Guidelines
- Read the Markdown docs first: `README.md`, `tests/README.md`, and existing `.github` customizations.
- Never use `console.log` in runtime code; stdio transport must stay clean. Use `console.error` for diagnostics.
- Follow the established MCP handler pattern: define Zod `inputSchema`/`outputSchema`, return readable `content`, and add `structuredContent` for machine-friendly data.
- Reuse shared helpers from `src/utils/security.ts`, `src/utils/cache.ts`, and `src/utils/errors.ts` instead of re-implementing validation, rate limiting, or error shaping.
- Prefer updating existing files and preserving public tool names, schema fields, and comments unless the task explicitly changes behavior.
- Plan before editing, avoid breaking existing functionality, and keep prompt/agent docs aligned with the actual registered tools.

## Project Structure
- `src/tools/*.ts`: MCP tools such as `src/tools/fileTools.ts`, `src/tools/duckduckgoSearchTools.ts`, `src/tools/context7Tools.ts`, and `src/tools/pdfTools.ts`.
- `src/resources/gitResources.ts`: the read-only `git://status` MCP resource.
- `src/prompts/prompts.ts`: workflow prompts; update prompt tool references when the tool set changes.
- `src/utils/*.ts`: shared security, caching, performance, and error utilities; security rules in `src/utils/security.ts` are central to file and command behavior.
- `tests/*.test.ts`: Vitest tests using mocked `fetch` and fake MCP servers that capture registered handlers (see `tests/duckduckgo.mock.test.ts` and `tests/tools_register.test.ts`).
- `.github/agents` and `.github/prompts`: extra AI metadata that should stay consistent with the active tools and workflows.

## Resources
- Build/test/dev commands live in `package.json`: `npm run build`, `npm run dev`, `npm test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`.
- The runtime discovery tool depends on built output, so keep `registerDiscoveryTools(server)` last in `src/server.ts` and build before relying on discovery results.
- VS Code MCP launch examples live in `README.md` and `.github/mcp.json`.
- If a task explicitly asks for tracked status, use the existing `.github/TODOs.md` file rather than creating a new tracker.
