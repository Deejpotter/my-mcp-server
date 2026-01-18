# Copilot & AI Agent Instructions for my-mcp-server

## Project Overview

- This is a modular Model Context Protocol (MCP) server for VS Code/Copilot, written in TypeScript.
- It exposes tools, resources, and workflow prompts for AI assistants via stdio transport.
- Major features: secure file/command/git operations, web/documentation search, project management, image/PDF/grocery tools, and workflow prompts.

## Architecture & Structure

- **src/server.ts** is the entry point. It registers all tools, resources, and prompts.
- **src/tools/** contains all tool modules. Each file exports a `registerTool` function for one or more tools.
- **src/resources/** contains resource providers (e.g., git status).
- **src/prompts/prompts.ts** registers workflow prompts (code review, bug investigation, etc.).
- **tests/** contains Vitest-based unit tests for all core logic.
- **.github/** contains agent instructions, prompt templates, and agent-specific docs:
  - `.github/agents/` — Agent behaviors and constraints
  - `.github/prompts/` — GitHub agent prompt templates (e.g., cnc-triage, customer-reply)
  - `.github/instructions/` — General/specific writing guidelines

## Key Patterns & Conventions

- **Tool Registration:** All tools are registered via `server.registerTool(name, schema, handler)` in their respective modules.
- **Input/Output Validation:** All tool inputs/outputs use Zod schemas for type safety and validation.
- **Security:** Path and command validation is enforced for all file/command tools (see `src/utils/security.ts`).
- **No console.log:** Use `console.error` for debug output to avoid corrupting stdio transport.
- **Testing:** Use Vitest. Tests are colocated in `tests/` and named `*.test.ts`.
- **TypeScript:** Uses strict mode, ES2022, and NodeNext module resolution.

## Developer Workflows

- **Build:** `npm run build` (TypeScript → dist/)
- **Dev:** `npm run dev` (auto-reloads on changes)
- **Test:** `npm test` or `npm run test:watch` (unit tests)
- **Coverage:** `npm run test:coverage` (requires compatible vitest/c8 setup)
- **Lint:** `npm run lint`
- **Start:** `npm start` (runs compiled server)

## Integration Points

- **VS Code/Copilot:** Integrate by adding to `mcp.json` in VS Code settings (see README for example config).
- **External APIs:** Google (SerpAPI), Context7, ClickUp, Hugging Face, Woolworths/Coles (grocery), PDF parsing.
- **.env:** API keys and secrets are loaded from `.env` at project root.

## Project-Specific Advice

- **Add new tools** by creating a new file in `src/tools/` and exporting a `registerTool` function.
- **Always validate** file paths and commands using helpers in `src/utils/security.ts`.
- **Prompts** should be registered in `src/prompts/prompts.ts` using the `server.prompt` method.
- **Do not use console.log**; use `console.error` for all logging.
- **Test edge cases** for security, especially for file/command tools.
- **Read the README first** to understand the correct workflow before making changes.
- **Use Context7** to find exact documentation prior to code changes; supplement with my-mcp-server's `google_search` (SerpAPI) and `duckduckgo_search` for official references.
- **Prefer updating existing files** over creating new ones; add detailed comments from the user's point of view when you change behavior.
- **Maintain `.github/TODOs.md`** with status buckets (Todo, In Progress, Completed). Keep the last 10 Completed tasks and delete older ones.
- **Refer to** `README.md` for tooling and workflows; tests document patterns within `tests/`.

## Examples

- See `src/tools/fileTools.ts` for secure file operations.
- See `src/tools/commandTools.ts` for command execution with allowlisting.
- See `src/utils/security.ts` for validation logic.
- See `tests/security.test.ts` for security test patterns.

## Top tools for this repo

- Core: `run_command`, `git_command`, `read_file`, `write_file`, `list_files`
- Search: `duckduckgo_search`, `google_search`
- Docs: `resolve_library_id`, `get_documentation`
- Discovery: `mcp_tools_discovery`

## Add a new tool in 3 steps

1. Create `src/tools/myTool.ts` exporting a `registerMyTool(server)` and define zod input/output schemas.
2. Register via `server.registerTool('my_tool', { title, description, inputSchema, outputSchema }, handler)`.
3. Import and call `registerMyTool(server)` in `src/server.ts`.

## Env keys quicklist

- `SERPAPI_API_KEY` (Google via SerpAPI)
- `CONTEXT7_API_KEY` (Context7 docs)
- `HUGGING_FACE_API_KEY` (image generation)
- `CLICKUP_API_TOKEN` (ClickUp tools)
- `COLES_API_KEY` (Coles grocery API)
- `OPENAI_API_KEY` (PDF receipt extraction)

Tools degrade gracefully when optional keys are missing (DuckDuckGo works without keys).

## Security posture

- Never use `console.log` (stdio transport). Use `console.error` for diagnostics.
- Validate all paths and commands via `src/utils/security.ts`.
- Enforce timeouts and buffer limits for command execution.
