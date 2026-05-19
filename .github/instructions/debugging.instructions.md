---
applyTo: src/**/*.ts,tests/**/*.ts,README.md,.github/**/*.md
---

# Debugging workflow

## Code debugging
- Start with docs first: `README.md` and `tests/README.md`, then trace the implementation.
- Preferred validation loop: `npm run build` -> `npm test` -> `npm run typecheck`.
- Use `npm run dev` only for stdio/runtime behavior checks; most tool regressions are faster to debug via handler-level tests.
- Keep runtime logs on stderr only (`console.error`); `console.log` corrupts MCP stdio transport.

## Env loading
- Pattern: `import "dotenv/config"` must be the **first import** in every entry point to load `.env` during ESM module resolution, before any tool modules read `process.env.*`.
- Source of truth: `krasus\.env` (loaded via `DOTENV_CONFIG_PATH` in gateway config).
- If a tool reports env var not set but it exists in `.env`, check import order — the `dotenv/config` side-effect import must come before any tool import.

## Gateway & MCP servers
- **NSSM service:** `OpenClawGateway`. Commands: `nssm status|restart|stop|start OpenClawGateway`.
- **Gateway takes ~30-60s** to initialize after start (plugin load).
- **Never** use `openclaw gateway restart` or `openclaw gateway install`.
- **Gateway logs:** `C:\WINDOWS\system32\config\systemprofile\.openclaw\logs\` (SYSTEM account path).
- **MCP tool not appearing:** Check process count: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "<server-name>" }`.
- **ClickUp MCP entry point:** `dist/index.js` (not `server.js`). Path: `C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm\node_modules\@nazruden\clickup-server\dist\index.js`.

## Registration & tools
- If a tool is "missing", verify registration in `src/server.ts` and corresponding expectations in tests.
- If behavior and docs diverge, update `src/server.ts`, and `.github` docs together (no separate README for tools).
- Security failures usually come from `src/utils/security.ts` checks or path assumptions in tool handlers.
- For external API uncertainty, verify with Context7 first, then `search` tool, before editing docs.

## Common issues
| Symptom | Check |
|---------|-------|
| All MCP tools gone | Gateway process died — check `nssm status` |
| Env var "not set" but in .env | Import order: `dotenv/config` must be first import |
| ClickUp MCP not spawning | Entry point is `index.js`, not `server.js`; token passed via gateway env block |
| Coolify API 401 | Token expired — generate new in Coolify UI under API tokens |
| Vaultwarden auth failure | Check OAuth client_secret (lowercase L vs digit 1 typo) |
