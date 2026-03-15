---
applyTo: src/server.ts,package.json,README.md,.github/mcp.json,.env.example
---

# Runtime and deployment
- Runtime is stdio MCP: production uses `node dist/server.js`; development uses `tsx watch src/server.ts`.
- Keep the env bootstrap logic in `src/server.ts` intact: `.env` is loaded from project root relative to the built file location.
- Keep these files synchronized whenever scripts, env keys, or active tools change:
	- `package.json`
	- `README.md`
	- `.github/mcp.json`
	- `.env.example`
- Build before using discovery or production startup because `registerDiscoveryTools` depends on compiled `dist/tools` files.
- If a tool is archived/removed from `src/server.ts`, remove active references from docs/prompts in the same change.