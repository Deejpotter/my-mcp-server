# my-mcp-server Instructions

## Project Overview
- Mono-repo MCP server collection for OpenClaw gateway, organized by domain.
- **Architecture (planned):** Four packages under npm workspaces:
  - `packages/shared` — env loader, auth helpers, error patterns
  - `packages/core` (stdio) — Files, Commands, Git, Search, Context7, Discovery
  - `packages/local` (stdio) — Excel, PDF, Mail, Images, DXF, Maker Converter, LocalMedia, LocalKnowledge
  - `packages/services` (HTTP via Coolify) — Coolify, Vaultwarden, Grocy, BookStack, OpenRouter, OpenProject, Firefly, Gelato
- **Current state:** Single monolithic server in `src/server.ts`, pending refactor (tracked in ClickUp: Deej Potter Designs > MCP Server Refactor).
- **Dead tools:** KitchenOwl removed (discontinued project, replaced by Grocy).

## Tech Stack
- Node 18+, TypeScript NodeNext ESM, Zod, Vitest, `@modelcontextprotocol/sdk`
- Keep `.js` extensions in TypeScript imports (ESM project, `"type": "module"`)

## Secrets & Environment
- **`krasus\.env`** is the canonical source of truth for ALL API keys and secrets.
- The MCP server reads from `krasus\.env` via `DOTENV_CONFIG_PATH` set in the gateway config (`openclaw.json`).
- **ESM env loading pattern:** Use `import "dotenv/config"` as the **first import** in every entry point. This ensures `.env` loads during module resolution, before any tool modules read `process.env.*`. The explicit `dotenv.config()` call should follow for clarity but the side-effect import is what guarantees correct ordering.
- Never duplicate secrets across `.env` files. Vaultwarden is the backup store.

## Gateway Management
- The OpenClaw gateway runs as a Windows service managed by **NSSM** (service name: `OpenClawGateway`).
- **Never use `openclaw gateway restart` or `openclaw gateway install`.**
- Restart: `nssm restart OpenClawGateway`
- Status: `nssm status OpenClawGateway`
- The service takes ~30-60s to initialize after start (plugin load time).
- For MCP server .env changes: gateway restart is required because stdio child processes don't auto-reload.
- Config edits: Python only, backup `.last-good` first.
- **Gateway logs (SYSTEM account path):** `C:\WINDOWS\system32\config\systemprofile\.openclaw\logs\`

## ClickUp MCP
- Uses `@nazruden/clickup-server` (not the official `mcp.clickup.com` URL).
- Entry point: `dist/index.js` (not `server.js`).
- Installed globally under SYSTEM profile: `C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm\node_modules\@nazruden\clickup-server\`
- Env var: `CLICKUP_PERSONAL_TOKEN`
- Gateway config block:
  ```json
  "clickup": {
    "command": "node",
    "args": ["C:\\WINDOWS\\system32\\config\\systemprofile\\AppData\\Roaming\\npm\\node_modules\\@nazruden\\clickup-server\\dist\\index.js"],
    "env": { "CLICKUP_PERSONAL_TOKEN": "pk_..." }
  }
  ```

## Tool Design & API
- Keep tool/resource handlers as thin adapters: validate input, call integration/utilities, then shape `content`.
- Preserve public MCP contracts unless explicitly asked to change them: tool names, input/output schema field names, existing response keys.
- For external integrations, fail fast with readable user errors (missing env, invalid IDs/paths, rate limits) instead of raw stack traces.
- Reuse shared guardrails from `src/utils/security.ts`, `src/utils/cache.ts`, and `src/utils/errors.ts`.
- When tools change, wire all surfaces in one change: register in `src/server.ts`, add/update tests, update docs, update `.env.example` when new env keys are introduced.
- Keep `registerDiscoveryTools(server)` last in `src/server.ts`; it depends on built `dist/tools` output.

## Coding Guidelines
- **No `console.log`** in runtime modules; stdio must stay clean. Use `console.error` for diagnostics.
- Follow existing MCP handler shape: define Zod `inputSchema`, return readable `content` text.
- **MCP tool bloat awareness:** Each tool definition consumes 500-1000 prompt tokens. Keep tool count minimal per server. Split tools across domain servers rather than accumulating in one.
- **Stdio vs HTTP:** Filesystem-dependent tools (file ops, Excel, PDF, images) must be stdio. Pure API-call tools (Coolify, Vaultwarden, Grocy) should be HTTP deployed via Coolify.
- If task tracking is requested, create tasks in ClickUp using the ClickUp MCP tools.
- Prefer updating existing files over new files, and keep existing comments unless they are incorrect.

## Testing
- Tests run with Vitest in `tests/`. Follow ESM patterns with `.js` extension imports.
- Pattern: capture handlers via fake `registerTool` server, invoke handler directly, assert on content text.
- Mock globals and restore them every test file (`vi.restoreAllMocks()` / cleanup hooks).
- For filesystem/process tools, use temp directories with explicit cleanup in `afterEach`.
- Use `npm test` for full suite and `npx vitest run tests/<file>.test.ts` for targeted debugging.

## Validation Loop
- `npm run build` -> `npm test` -> `npm run typecheck`
- Build before using discovery or production startup.

## Common Issues
| Symptom | Fix |
|---------|-----|
| All MCP tools gone | Gateway process died — `nssm status OpenClawGateway` |
| Env var "not set" but in .env | Import order: `dotenv/config` must be first import |
| ClickUp MCP not spawning | Entry point is `index.js`, not `server.js` |
| Coolify API 401 | Token expired — generate new in Coolify UI |
| Vaultwarden auth failure | Check OAuth client_secret (lowercase L vs digit 1) |
| Tool count too high | Split into domain servers per the architecture plan |
