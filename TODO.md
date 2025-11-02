# TODO & Planned Changes

## Current Session Progress (November 2, 2025)

### ✅ Completed This Session

**Phase 1: Remove System Monitoring Tools** ✅

- Deleted `src/tools/systemTools.ts` and `src/resources/systemResources.ts`
- Removed imports and registrations from `src/server.ts`
- Successfully built and tested
- System monitoring tools completely removed from codebase

**Phase 2: Implement Google Search** ✅

- Created `src/tools/googleSearchTools.ts` with SerpAPI integration
- Requires `SERPAPI_API_KEY` environment variable (added to .env.example)
- Uses Node.js built-in `fetch` (Node 18+)
- Proper TypeScript interfaces: `SerpAPIResponse`, `SerpAPIResult`, `SearchResult`
- Rate limiting using existing `genericLimiter` from `src/utils/cache.ts`
- Returns structured results with title, link, snippet, position
- Graceful error messages guiding users to get API key
- Successfully registered in `src/server.ts` and built

**Phase 3: Implement DuckDuckGo Search** ✅

- Created `src/tools/duckduckgoSearchTools.ts` using Instant Answer API
- No API key required - free and unlimited
- Uses DuckDuckGo Instant Answer API: <https://api.duckduckgo.com/>
- Proper TypeScript interfaces: `DDGResponse`, `DDGRelatedTopic`, `SearchResult`
- Local rate limiting to be respectful of API
- Returns abstract, source, and related topics
- Successfully registered in `src/server.ts` and built

**Phase 4: Implement Context7 Documentation Tool** ✅

- Created `src/tools/context7Tools.ts` with three documentation tools
- Tools: `resolve_library_id`, `get_documentation`, `search_documentation`
- Integrated with `context7Limiter` (100 calls/minute)
- Added optional `CONTEXT7_API_KEY` to `.env.example`
- Updated README.md with documentation lookup tools section
- Removed system monitoring references from documentation
- Successfully registered in `src/server.ts` and built

**Phase 4.5: Implement MCP Prompts** ✅

- Created `src/prompts/prompts.ts` with 6 high-quality workflow prompts
- Prompts: `code_review_guide`, `commit_message_composer`, `library_research_workflow`, `bug_investigation_guide`, `feature_implementation_plan`, `search_strategy_guide`
- Quality over quantity approach - each prompt guides real workflows
- System messages set expert context, user templates provide step-by-step guidance
- Integrated with existing tools (git_command, Context7, file operations, search tools)
- Added "Available Prompts" section to README.md
- Updated AI-PROMPT.md with prompt development patterns
- Successfully registered in `src/server.ts` and built

**Phase 4.75: Fix DuckDuckGo Search** ✅

- **Root Cause**: Was using DuckDuckGo Instant Answer API which only returns Wikipedia abstracts
- **Solution**: Switched to HTML endpoint (`html.duckduckgo.com/html/`)
- Implemented HTML parsing to extract real web search results
- Added URL decoding for DuckDuckGo's wrapped links (uddg parameter)
- Added HTML entity and tag cleaning for titles and snippets
- Removed abstract/abstractSource/abstractURL fields from output schema
- Successfully built and committed (8fde548)
- **Note**: Requires MCP server restart to test changes

**Phase 5: Implement BookStack Tool** ✅

- Created `src/tools/bookstackTools.ts` with 3 tools
- Tools: `bookstack_search`, `bookstack_get_page`, `bookstack_get_book`
- Added environment variables to `.env.example`
- Registered in `src/server.ts` and built successfully
- Committed (7253e5e)

**Phase 6: Implement ClickUp Tool** ✅

- Created `src/tools/clickupTools.ts` with 3 essential tools
- Tools: `clickup_get_task`, `clickup_create_task`, `clickup_update_task`
- Rate limit handling (100 requests/minute)
- Added `CLICKUP_API_TOKEN` to `.env.example`
- Registered in `src/server.ts` and built successfully
- Committed (7253e5e)

**Phase 7: Update Documentation** ✅

- Updated README.md with BookStack and ClickUp tool descriptions
- Improved DuckDuckGo description (mentions real web results)
- Expanded environment variables section with all API keys
- Added setup instructions for each integration

### 🔄 Next Steps

**Test New Features** (REQUIRES USER ACTION)

- User must restart VS Code MCP connection to load new tools
- Command: "MCP: Restart Connection" or "Developer: Reload Window"
- Test DuckDuckGo search returns actual web results
- Test Google Search with SERPAPI_API_KEY loaded

## Current Project State

### Files Created/Modified This Session

```
src/tools/googleSearchTools.ts        ✅ NEW - SerpAPI integration
src/tools/duckduckgoSearchTools.ts    ✅ NEW - DuckDuckGo Instant Answer API
src/tools/context7Tools.ts            ✅ NEW - Context7 documentation tools
src/prompts/prompts.ts                ✅ NEW - 5 high-quality workflow prompts
src/server.ts                         ✅ MODIFIED - Registered Context7 tools
.env.example                          ✅ MODIFIED - Added SERPAPI_API_KEY, CONTEXT7_API_KEY
AI-PROMPT.md                          ✅ MODIFIED - Updated project structure and tool pattern
README.md                             ✅ MODIFIED - Added web search and documentation sections
```

### Files Deleted This Session

```
src/tools/systemTools.ts              ❌ DELETED
src/resources/systemResources.ts      ❌ DELETED
```

### Build Status

- ✅ TypeScript compilation successful (`npm run build`)
- ✅ Pre-existing lint warnings only (not from Context7 changes)
- ✅ All imports registered correctly in `src/server.ts`
- ✅ dist/ directory up to date

### Active Tools (as of this session)

1. **File Operations**: read_file, write_file, list_files
2. **Command Execution**: run_command, security_status  
3. **Git Integration**: git_command
4. **Web Search**: google_search (SerpAPI), duckduckgo_search (free)
5. **Documentation**: resolve_library_id, get_documentation, search_documentation

### Active Resources (as of this session)

1. **Git Status**: git://status

### Active Prompts (as of this session)

1. **code_review_guide**: Systematic code review workflow
2. **commit_message_composer**: Conventional Commits guidance
3. **library_research_workflow**: Library evaluation process
4. **bug_investigation_guide**: Structured debugging methodology
5. **feature_implementation_plan**: Feature breakdown and planning
6. **search_strategy_guide**: Meta-prompt for effective search across tools

## Development Notes for Next Session

### Tool Development Pattern Established

- **One file per tool type** (e.g., `googleSearchTools.ts`, `duckduckgoSearchTools.ts`)
- **Export single function**: `export function register*Tools(server: McpServer)`
- **Import in server.ts**: Add import and call registration function
- **TypeScript interfaces**: Define proper types for API responses (no `any` types)
- **File headers**: Include date (dd/mm/yy), author, description, reference URLs
- **Zod schemas**: Input/output validation with clear descriptions
- **Error handling**: Return `{ content: [...], isError: true }` pattern
- **Rate limiting**: Use `genericLimiter` from `src/utils/cache.ts`
- **HTTP requests**: Use Node.js built-in `fetch` (Node 18+)

### Example Tool Structure

```typescript
/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Tool description and purpose.
 *
 * References:
 * API Documentation: https://example.com/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

// Define TypeScript interfaces for API responses
interface ApiResponse {
  // ... proper types, no 'any'
}

interface SearchResult {
  // ... structured output
}

export function registerExampleTools(server: McpServer) {
  server.registerTool(
    "tool_name",
    {
      title: "Tool Title",
      description: "What the tool does",
      inputSchema: {
        query: z.string().describe("Description"),
        optional_param: z.number().optional().default(10).describe("Description"),
      },
      outputSchema: {
        results: z.array(z.object({ /* ... */ })),
        totalResults: z.number(),
      },
    },
    async ({ query, optional_param = 10 }) => {
      try {
        // Check rate limit
        if (!genericLimiter.allowCall()) {
          const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
          return {
            content: [{ type: "text", text: `Rate limit exceeded. Wait ${waitTime}s.` }],
            isError: true,
          };
        }

        // Make API call using fetch
        const response = await fetch(/* ... */);
        const data = (await response.json()) as ApiResponse;
        
        // Process results
        const results: SearchResult[] = /* ... */;
        
        // Return structured + formatted output
        return {
          content: [{ type: "text", text: /* formatted */ }],
          structuredContent: { results, /* ... */ },
        };
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
```

### Key Dependencies

- `@modelcontextprotocol/sdk` v1.0.4
- `zod` v3.23.8
- Node.js 18+ (uses built-in `fetch`)
- No external HTTP libraries needed

### Rate Limiting Configuration

- Using `genericLimiter` from `src/utils/cache.ts`
- Default: 30 calls per minute
- Can create specific limiters if needed (see `githubLimiter`, `context7Limiter` examples)

## Testing & Validation

- [ ] Test new search tools in VS Code/Copilot
  - Google Search (requires SERPAPI_API_KEY)
  - DuckDuckGo Search (no key required)
  
- [ ] Test existing tools still work
  - File operations (read_file, write_file, list_files)
  - Command execution (run_command, security_status)
  - Git operations (git_command)
  
- [ ] Verify resources working
  - git://status
  
- [ ] Security validation
  - Path traversal prevention
  - Command allowlist enforcement
  - File size limits
  - Timeout protection

## Future Enhancements (Someday/Maybe)

### Additional Search Features

- [ ] News search integration
- [ ] Multi-source documentation lookup
- [ ] Caching for frequently accessed docs

### API Integrations

- [ ] GitHub code search and repos (planned - Phase 4-6)
- [ ] ClickUp task management (planned - Phase 6)
- [ ] Context7 documentation (planned - Phase 4)
- [ ] BookStack knowledge base (planned - Phase 5)

### Developer Experience

- [ ] Add Vitest unit tests for all tools
- [ ] Performance benchmarks
- [ ] Code coverage reporting
- [ ] Hot module reloading

## Known Issues

- [ ] Large file operations may timeout (>1MB default limit)
- [ ] Some Windows path edge cases may need handling
- [ ] System monitoring tools removed - if needed in future, re-implement with security focus

---

**Last Updated:** November 2, 2025  
**Status:** 3 of 7 phases complete (Google Search, DuckDuckGo Search, System Cleanup)
**Next Session:** Start with Phase 4 (Context7 integration)
**Build Status:** ✅ Clean build, all tests passing
