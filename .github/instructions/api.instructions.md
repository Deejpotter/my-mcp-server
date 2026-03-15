---
name: MCP API And Tool Design
description: Guidance for MCP tool/resource handlers, external API integrations, and schema stability in this server.
applyTo: src/tools/**/*.ts,src/resources/**/*.ts
---

# MCP API and tool design
- Tool files are MCP adapters around validation, rate limiting, filesystem/network calls, and response shaping; keep handlers direct and easy to audit.
- Preserve registered tool names and schema field names unless the task explicitly changes the public MCP contract.
- Follow examples in `src/tools/fileTools.ts`, `src/tools/duckduckgoSearchTools.ts`, and `src/tools/pdfTools.ts` for Zod schemas plus `content`/`structuredContent` responses.
- Check environment requirements early and return explicit user-facing errors instead of leaking raw stack traces.
- Reuse `src/utils/security.ts`, `src/utils/cache.ts`, and `src/utils/errors.ts` before adding new validation or rate-limiting logic.
- When editing prompts or agent docs that reference tools, keep their tool names aligned with what `src/server.ts` actually registers.
- If an external API detail or recommendation is uncertain, verify it with Context7 or `duckduckgo_search` before encoding it into code comments or docs.