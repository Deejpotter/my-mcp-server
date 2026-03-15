---
name: Runtime And Deployment
description: Build, startup, env-loading, and VS Code MCP configuration guidance for this stdio MCP server.
applyTo: src/server.ts,package.json,README.md,.github/mcp.json,.env.example
---

# Runtime and deployment
- This is a stdio MCP server: production runs `node dist/server.js`, and development runs `tsx watch src/server.ts`.
- `src/server.ts` loads `.env` from the project root by resolving one level above the built file; preserve that path logic unless the output layout changes.
- Keep `package.json`, `README.md`, `.github/mcp.json`, and `.env.example` in sync whenever scripts, env keys, or startup commands change.
- Build before relying on discovery or production startup because `mcp_tools_discovery` scans `dist/tools`.
- README examples should match the actual scripts and current tool set; remove archived or deleted tools from docs in the same change that removes them from code.