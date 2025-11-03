# TODO & Planned Changes

## Current Session Progress (November 3, 2025)

### ✅ Completed This Session

**Phase 11: Create Maker Store Documentation in BookStack** ✅

- Created "Maker Store" shelf (ID: 3) to organize Maker Store business documentation
- Created "Custom CNC Projects" book (ID: 5) with comprehensive custom project guidelines
- Created 2 chapters:
  - "Custom Project Guidelines" (ID: 3) - General guidance for custom builds
  - "Customer Examples" (ID: 4) - Real-world case studies
- Created 3 comprehensive pages:
  - "Custom Modification Overview" - What's easy vs. tricky to modify, pricing structure
  - "FORTIS Router Scalability Guide" - Technical limitations, component constraints, scaling strategies
  - "FORTIS Router 3200x3200mm Custom Build" - Detailed customer example with full pricing breakdown
- Successfully organized content with relevant tags for easy searching
- Documentation enables consistent responses to custom project inquiries

**Phase 11.5: Update Maker Store Documentation with Technical Details** ✅

- Updated "FORTIS Router Scalability Guide" with:
  - Product link: [FORTIS Router 1530 Kit](https://www.makerstore.com.au/product/kit-fortis-router-s-1530-rc/)
  - HGR15 Linear Rail specifications (chamfered ends, cannot be butt-joined)
  - Gear rack details (500mm sections, can be butt-joined, hard to cut)
  - Optimal sizing recommendation (3500mm for component alignment)
  - MakerBee vs FORTIS comparison (rigidity for large builds)
  - Extrusion joining details (can be butt-joined, rail covers join bump)
  - Design risk explanation (FEA may reveal need for modifications/redesign)
  - In-store assembly requirements ($110/hr labor)
  
- Updated "FORTIS Router 3200x3200mm Custom Build" with:
  - Corrected optimal sizing (3500mm recommended vs 3200mm requested)
  - Product link integration throughout
  - Complete technical reasoning (gear racks, extrusions, HGR15 rails)
  - MakerBee rigidity comparison
  - Design risk and FEA requirements
  - In-store assembly explanation
  - Revised customer response with all technical details

- Documentation now includes:
  - Complete component specifications (HGR15, 500mm gear racks, 3050mm extrusions)
  - Clear sourcing guidance (what customer must source vs what we provide)
  - Technical reasoning for recommendations (why 3500mm, why FORTIS, etc.)
  - Risk transparency (design may need modifications after FEA)

**Phase 12: Restructure Book & Add Standard Product Documentation** ✅

- **Renamed book**: "Custom CNC Projects" → **"FORTIS Router Projects & Guidance"**
  - Updated description to reflect both standard products and custom projects
  - Book now covers complete FORTIS Router guidance spectrum

- **Flattened structure**: Removed chapter organization, all pages now direct in book
  - Simpler navigation
  - Easier to find content
  - More flexible organization

- **Created 3 new pages**:
  
  1. **Quick Reference: Product Links & Resources** (Page 11)
     - All FORTIS product links (1010, 1015, 1515, 1530) with prices
     - Laser mounting plate link
     - Email templates for standard and custom inquiries
     - Copy-paste snippets (product lists, pricing, benefits)
     - Quick reference for composing customer emails
     - Common applications guide
     - Technical specs quick reference
  
  2. **Product Selection & Applications** (Page 12)
     - Why choose FORTIS Router (rigidity, metal work, laser compatibility)
     - Size comparison table with links
     - Application-specific guidance (metal, laser, hardwood, large format)
     - Decision tree for product selection
     - Email reply structure guidelines
     - Common Q&A section
  
  3. **Customer Example: Metal Engraving & Laser Setup** (Page 13)
     - Trent's inquiry documentation
     - Standard product selection example
     - Email reply structure analysis (full sentences, full URLs)
     - Communication best practices
     - Reply template for similar inquiries
     - Links reference section

- **Renamed existing page**: 
  - "FORTIS Router 3200x3200mm Custom Build" → "Customer Example: Large Custom Build"

- **Final book structure** (6 pages, no chapters):
  1. Quick Reference: Product Links & Resources
  2. Product Selection & Applications
  3. Custom Modification Overview
  4. FORTIS Router Scalability Guide
  5. Customer Example: Large Custom Build (Jay - 3200x3200mm)
  6. Customer Example: Metal Engraving & Laser Setup (Trent)

**Key Improvements**:
- ✅ One-stop quick reference for email composition
- ✅ Complete product catalog with links
- ✅ Email templates and reply structures documented
- ✅ Both standard and custom project guidance in one book
- ✅ Real customer examples for both scenarios
- ✅ Simplified navigation (no chapters)
- ✅ Easy to search and cross-reference

**Phase 13: Add BookStack Delete Tools** ✅

- Added four new delete tools to complete BookStack CRUD operations:
  - `bookstack_delete_chapter` - Delete chapters (WARNING: Deletes all pages within)
  - `bookstack_delete_page` - Delete individual pages
  - `bookstack_delete_book` - Delete books (WARNING: Deletes all chapters and pages within)
  - `bookstack_delete_shelf` - Delete shelves (books are preserved)
- All delete tools include:
  - Rate limiting protection
  - Clear warning messages about permanent deletion
  - Comprehensive error handling
  - Troubleshooting guidance
- Updated README.md with new tool documentation
- Successfully built (npm run build)
- Fixed API endpoint paths (removed duplicate `/api/` prefix)
- **Status**: Ready to use after server restart

**Next Action**: Restart VS Code, then delete empty chapters (ID 3 and 4)

## Previous Session Progress (November 2, 2025)

### ✅ Completed Previous Session

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

**Phase 8: Add BookStack Creation & Update Tools** ✅

- Added `bookstack_create_book` - Create new books with name, description, tags
- Added `bookstack_create_chapter` - Create chapters within books
- Added `bookstack_create_page` - Create pages with HTML/Markdown content
- Added `bookstack_update_book` - Update book details
- Added `bookstack_update_page` - Update page content and move between books/chapters
- All tools support tags, proper error handling, and rate limiting
- Updated README.md with comprehensive tool documentation
- Successfully built (npm run build)

**Phase 9: Add BookStack Shelf Tool & Fix Environment Variables** ✅

- Added `bookstack_create_shelf` - Create shelves to organize books
- Added ShelfContent interface for shelf API responses
- **Fixed dotenv configuration** - Server now loads .env from project root correctly
- Updated server.ts to use explicit path for .env file (critical for MCP stdio transport)
- Fixed output schemas - Made `url` field optional in all BookStack create tools
- Created comprehensive BookStack documentation guide (bookstack-content-creation.md)
- Successfully built and tested (npm run build)

**Phase 10: Create Complete BookStack Documentation** ✅

- **Created MCP Server Book** (ID: 3, slug: mcp-server-XGf)
- **Created 2 Chapters**:
  - Overview (ID: 1) - Project introduction and capabilities
  - Getting Started (ID: 2) - Installation and setup
- **Created 6 Comprehensive Pages**:
  - Introduction - Project overview and purpose
  - Features & Capabilities - Complete feature list with icons
  - Architecture - Technology stack and design principles
  - Installation - Step-by-step setup guide
  - Configuration - Environment variables and security
  - First Steps - VS Code integration and testing
- Archived session summaries to `archived-sessions/` directory
- Cleaned up temporary documentation files

### 🔄 Next Steps

**Phase 11: Extend Documentation** (Future Work)

- Add "Available Tools" chapter with detailed tool documentation
- Add "Development Guide" for extending the server
- Include screenshots and diagrams
- Add troubleshooting guides for common issues
- Create quick reference cards for tools

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
6. **BookStack**: bookstack_search, bookstack_get_page, bookstack_get_book, bookstack_create_shelf, bookstack_create_book, bookstack_create_chapter, bookstack_create_page, bookstack_update_book, bookstack_update_page
7. **ClickUp**: clickup_get_task, clickup_create_task, clickup_update_task

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
