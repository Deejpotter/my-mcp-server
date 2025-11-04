# AI Prompt for MCP Server Development

## **Overview**

This document provides comprehensive guidance for AI assistants working on **my-mcp-server**, a Model Context Protocol (MCP) server. This is a **personal project** focused on practical development tools and API integrations for AI assistants in VS Code. Remember to keep it simple and practical, avoiding unnecessary complexity. And, always search for official docs for the libraries/APIs being used before changing anything.

**Quick Reference**: Before making ANY changes, you MUST:

1. Read this AI-PROMPT.md file completely
2. Check TODO.md for current priorities
3. Review relevant documentation in docs/ folder
4. Create a detailed checklist before implementing
5. Use my-mcp-server tools to search official documentation
6. Update core files (README.md, TODO.md, docs/) after changes

## **Table of Contents**

1. [Project Context](#project-context) - Project overview, structure, and architecture philosophy
2. [Development Workflow & File Management](#development-workflow--file-management) - Pre-work analysis, file management, planning, and TODO tracking
3. [BookStack Organization & Knowledge Management](#bookstack-organization--knowledge-management) - Documentation structure, shelf organization, and content placement guidelines
4. [Code Standards & Documentation](#code-standards--documentation) - File headers, documentation philosophy, research requirements, and comment examples
5. [Technical Implementation](#technical-implementation) - Tool development patterns, implementation standards, error handling, and API integration
6. [Communication & Documentation Style](#communication--documentation-style) - Tone, voice, and documentation standards
7. [Expected AI Assistance Style](#expected-ai-assistance-style) - Before starting work, when helping with code, discussing architecture, and after making changes
8. [Current Project Priorities](#current-project-priorities) - Immediate focus, quality standards, and avoiding over-engineering

**Key Principle**: This is a **TypeScript modular architecture** with tools organized by category. Preserve existing code, add detailed comments from the author's perspective, and always reference official documentation.

---

## **Project Context**

You are working on **my-mcp-server**, a Model Context Protocol (MCP) server that provides development tools and API integrations for AI assistants. This is a **personal project** with 1-2 contributors, focused on practical utility over enterprise features.

### **Project Structure**

```text
my-mcp-server/
├── src/
│   ├── server.ts                  # MCP server entry point (TypeScript)
│   ├── tools/                     # MCP tools (modular TypeScript)
│   │   ├── fileTools.ts           # File operations (read, write, list)
│   │   ├── commandTools.ts        # Command execution with security
│   │   ├── gitTools.ts            # Git command operations
│   │   ├── googleSearchTools.ts   # Google Search via SerpAPI
│   │   └── duckduckgoSearchTools.ts # DuckDuckGo Search (no API key)
│   ├── resources/                 # MCP resources
│   │   └── gitResources.ts        # Git repository status
│   └── utils/                     # Shared utilities
│       ├── security.ts            # Security & path validation
│       ├── cache.ts               # Caching & rate limiting
│       └── performance.ts         # Performance tracking
├── dist/                          # Compiled JavaScript (generated)
├── package.json                   # Node.js dependencies
├── tsconfig.json                  # TypeScript configuration
├── .env.example                   # Environment variable template
└── TODO.md                        # Track planned features and improvements
```

**Note:** System monitoring tools (systemTools.ts, systemResources.ts) were removed as they were not needed.

### **Architecture Philosophy**

- **Type-safe modular architecture**: TypeScript with Zod validation for all tools
- **Security-first**: Input validation, command allowlisting, path traversal prevention
- **Official MCP SDK**: Using @modelcontextprotocol/sdk for TypeScript
- **Clear patterns**: Consistent tool registration with McpServer.registerTool()
- **Local development focus**: stdio transport for VS Code integration

## **Development Workflow & File Management**

### **Pre-Work Analysis Requirements**

Before making any changes, always:

1. **Check core project files**: README.md, AI-PROMPT.md, TODO.md
2. **Review src/server.ts and src/tools/**: Understand current TypeScript implementation
3. **Analyze existing code patterns**: Follow TypeScript/Zod patterns in existing tools
4. **Use Context7**: Always use Context7 for library documentation (MCP SDK, Zod, Node.js APIs)
5. **Search online**: For information not available in official documentation

### **File Management Philosophy**

- **Modular TypeScript structure**: Tools organized by category in src/tools/ directory
- **One tool type per file**: fileTools.ts, systemTools.ts, commandTools.ts, gitTools.ts
- **Preserve current code and comments**: Keep my existing code wherever possible
- **Add detailed comments from my perspective**: Explain code purpose from the original author's viewpoint
- **Follow existing patterns**: Use McpServer.registerTool() with Zod schemas like existing tools
- **Update core files**: Always update README.md, AI-PROMPT.md, TODO.md when finding new information

### **Planning and Execution**

- **Create detailed plans**: Consider how to find best actions, then make a comprehensive plan
- **Remember and reference plans**: Refer back to the plan regularly to ensure staying on track
- **Follow the plan**: Make changes systematically according to the planned approach

### **TODO.md Management**

The TODO.md file serves to track current state of changes and progress:

- **Mark current work**: Use "(in progress)" for active tasks
- **Mark completion**: Use "(completed)" for finished tasks  
- **Check before/after**: Review TODO.md before starting and update after changes
- **Track state accurately**: Reflect the real status of project development

### **Documentation Requirements After Changes**

**CRITICAL**: After implementing any new tools, features, or modifications:

1. **Update BookStack**: Create or update pages in the MCP Server book (Book ID: 6) documenting the new functionality
   - New tools → Create page in "Available Tools" chapter
   - Modified behavior → Update existing tool documentation
   - New features → Add to relevant existing pages or create new pages

2. **Update README.md**: Add new tools to the Available Tools section with brief descriptions

3. **Update TODO.md**: Mark completed tasks, update progress status

4. **Use Context7**: Always lookup official documentation before documenting new tools/features

5. **Keep it practical**: Document what users need to know, avoid redundant information

**Tool Documentation Template** (for BookStack pages):

- Tool name and purpose (clear, concise)
- Input parameters (what it accepts)
- Output format (what it returns)
- Usage examples (practical scenarios)
- Common use cases
- Error handling notes
- Dependencies/requirements (API keys, etc.)

## **BookStack Organization & Knowledge Management**

BookStack is my primary knowledge base for documentation, project tracking, and development resources. Understanding the organizational structure is critical for AI assistants to maintain consistency and help with documentation.

### **Organizational Structure**

BookStack uses a hierarchy: **Shelves** → **Books** → **Pages**

My BookStack instance (<https://bookstack.deejpotter.com>) has 5 shelves organized by purpose:

1. **Projects** (Shelf ID: 4) - Personal software, web, and engineering projects
   - MCP Server (Book ID: 6) - This TypeScript MCP server project
   - deejpotter.com (Book ID: 7) - Personal portfolio website (Next.js 13 App Router)
   - Future: 3D printing projects, hardware/engineering hobby projects

2. **Servers & Infrastructure** (Shelf ID: 1) - Server administration and self-hosted services
   - My Pi Server (Book ID: 1) - Orange Pi Zero 3 setup, Coolify, Docker, networking
   - Future: Security hardening, backup strategies, service configurations

3. **Development** (Shelf ID: 2) - Personal development preferences and workflows
   - Prompts & AI Guides (Book ID: 4) - AI assistant workflows, prompt engineering
   - Future: Coding standards, lessons learned, development processes, tool configurations

4. **Maker Store** (Shelf ID: 3) - Work-related CNC documentation
   - CNC Projects & Product Guidance (Book ID: 5) - FORTIS Router machines, customer projects
   - Future: Machine specifications, troubleshooting guides, customer solutions

5. **Clients** (Shelf ID: 5) - Future professional services and contract work
   - Currently empty, reserved for client project documentation
   - Future: Client-specific projects, proposals, technical documentation

### **Content Placement Guidelines**

When helping with documentation or suggesting new content:

- **Projects Shelf**: Place documentation for personal projects (software development, web apps, hardware/engineering hobbies)
  - Example: New 3D printer project → Create book in Projects shelf
  - Example: Home automation system → Projects shelf
  
- **Servers & Infrastructure Shelf**: Server administration, security, self-hosted services, networking
  - Example: Vaultwarden configuration → Page in "My Pi Server" book
  - Example: Backup strategy → New page or chapter in "My Pi Server"
  
- **Development Shelf**: Personal coding preferences, workflows, AI prompts, development standards
  - Example: New VS Code configuration → Page in Development shelf
  - Example: Git workflow preferences → New page in Development shelf
  
- **Maker Store Shelf**: Work-related CNC content only
  - Example: FORTIS Router troubleshooting → Page in CNC Projects book
  - Do NOT mix personal projects here
  
- **Clients Shelf**: Professional services, contract work, client projects
  - Example: Web development client → Create book in Clients shelf
  - Keep client work separate from personal projects

### **Key Organizational Principles**

1. **Contextual Storage**: Knowledge should be stored where it's most relevant, not in a separate "reference" shelf
2. **Optimization Without Clutter**: Keep structure clean, don't create unnecessary subdivisions
3. **No Duplication**: Books should only exist in ONE shelf (BookStack allows multi-shelf books, but avoid this)
4. **Clear Purposes**: Each shelf has a distinct purpose - respect these boundaries
5. **Book vs Page Decision**:
   - Create a **Book** for substantial topics that need multiple pages/chapters
   - Create a **Page** for single-topic documentation within existing books
6. **Future Planning**: Shelves are designed to accommodate future content (noted in "Future:" bullets above)

### **BookStack Tool Usage**

When using BookStack MCP tools:

- **bookstack_search**: First step to find existing content before creating duplicates
- **bookstack_get_shelf**: Check shelf contents before adding books
- **bookstack_get_book**: Review book structure before adding pages
- **bookstack_create_book**: Use appropriate shelf_id, provide clear descriptions
- **bookstack_create_page**: Specify book_id or chapter_id, use markdown or HTML
- **bookstack_update_***: Verify no duplicate linking when moving/updating content

### **Common Documentation Tasks**

- **New project documentation**: Create book in Projects shelf with clear description
- **Server configuration**: Add pages to "My Pi Server" book in Servers & Infrastructure
- **Development preferences**: Add pages to Development shelf (create new book if topic is substantial)
- **Work CNC content**: Add to Maker Store shelf only
- **AI prompts and workflows**: Add to "Prompts & AI Guides" book in Development shelf

### **What NOT to Do**

- Don't create books in multiple shelves (avoid duplication)
- Don't mix personal projects with work content (Maker Store)
- Don't create a separate "Reference" or "Resources" shelf
- Don't create excessive subdivisions (chapters) unless truly needed
- Don't suggest reorganizing shelves without clear justification
- Don't assume content location - always search first

### **BookStack References**

- Instance URL: <https://bookstack.deejpotter.com>
- Self-hosted on Orange Pi Zero 3 via Coolify
- API access via MCP server tools (bookstack_*)
- Documentation: Use Context7 to lookup BookStack API docs when needed

## **Code Standards & Documentation**

### **File Header Standards**

Every TypeScript file must start with this exact header structure:

```typescript
/**
 * Updated: current date structured as dd/mm/yy
 * By: Current Author Name
 *
 * Description of the purpose of the file and anything that's really important to know to work with the file.
 *
 * References:
 * Important reference: https://importantreference.com/important-part
 * Another reference: https://docs.example.com/relevant-section
 */
```

**Key Requirements:**

- **Date format**: Always dd/mm/yy format for consistency
- **Author**: Current Author Name (could use git username or real name)
- **Description**: Concise purpose and critical working knowledge
- **References**: Link technical decisions to official documentation

### **Code Documentation & Organization Philosophy**

- **Preserve existing code**: Keep current code and comments wherever possible
- **Add detailed comments from author perspective**: Explain purpose and reasoning from original developer viewpoint
- **Concise but descriptive comments**: Each action needs explanation of purpose and logic behind choices
- **Reference-backed decisions**: All technical choices must link to official documentation
- **Why over what**: Comments explain reasoning, not just describe the code
- **Consistent patterns**: Follow existing tool/resource implementation patterns
- **Practical over perfect**: Favor working solutions over theoretical elegance
- **No visual decorations**: Avoid emoji in code, focus on clarity

### **Research and Documentation Requirements**

When researching or making technical decisions:

1. **Use my-mcp-server tools first**: Search for official documentation using built-in search tools
2. **Search online for gaps**: Find information not available in official docs
3. **Add comment explaining the choice**: Brief rationale for the approach
4. **Reference official documentation**: Link to specific docs section
5. **Update file References section**: Add new documentation URLs to file header
6. **Explain alternatives considered**: Why this choice over others

### **Comment Examples**

```typescript
// Use async/await for all MCP tool handlers - required by SDK
// Reference: https://github.com/modelcontextprotocol/typescript-sdk
server.registerTool("tool_name", schema, async (args) => {
  // Handler implementation
});

// Zod schemas provide runtime validation and type safety
// Reference: https://zod.dev/
const schema = z.object({
  file_path: z.string().describe("Path to the file"),
  max_size: z.number().optional().default(1024 * 1024)
});
```

## **Technical Implementation**

### **Tool Development Pattern**

1. **File Organization**: One file per tool type (e.g., googleSearchTools.ts, duckduckgoSearchTools.ts)
2. **Export Pattern**: Export single `register*Tools(server: McpServer)` function that registers all related tools
3. **Registration in server.ts**: Import and call the register function in src/server.ts
4. **Schema Definition**: Use Zod schemas with clear descriptions, required vs optional parameters
5. **TypeScript Interfaces**: Define proper interfaces for API responses (no `any` types)
6. **Error Handling**: Return content with isError flag, never throw unhandled exceptions
7. **Input Validation**: Zod handles schema validation automatically
8. **Security**: Use validatePath() from utils/security.ts, enforce timeouts and size limits
9. **Rate Limiting**: Use existing rate limiters from utils/cache.ts (genericLimiter, etc.)
10. **HTTP Requests**: Use Node.js built-in `fetch` (available in Node 18+)
11. **File Headers**: Include date (dd/mm/yy), author, description, and reference URLs

### **Prompt Development**

- Prompts should be high-quality, workflow-oriented, and limited in number (quality over quantity).
- Register prompts in a single, maintainable file (recommended: `src/prompts/prompts.ts`) using `server.prompt()` / `server.registerPrompt()` as supported by the MCP SDK.
- Each prompt must include:
  - A concise system message that sets an expert persona and execution constraints.
  - A structured user message template with step-by-step workflow guidance and example invocations.
  - Optional typed arguments (use Zod) for customization.
  - References to related tools/resources (Context7, git tools, file tools) when orchestration is intended.
- Document prompt names, descriptions, and arguments in `README.md` under an "Available Prompts" section so clients can discover them easily.

### **Tool Implementation Standards**

- **Descriptive names**: `github_search_code` not `gh_search`
- **Comprehensive schemas**: Document all parameters with examples
- **Graceful degradation**: Handle missing dependencies, provide alternatives
- **Performance awareness**: Consider timeouts, caching, size limits

### **Error Handling Philosophy**

```typescript
// Always return content with isError flag for failures - MCP requirement
// Reference: https://modelcontextprotocol.io/docs/concepts/tools
server.registerTool("tool_name", schema, async (args) => {
  try {
    const result = await doSomething();
    return {
      content: [{ type: "text", text: `Success: ${result}` }],
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});
```

### **TypeScript Best Practices**

**Avoid `any` types - Use proper typing:**

```typescript
// ❌ Wrong - causes "Unexpected any" errors
const options: any = { fit: "cover" };
catch (error: any) {
  return error.message;
}

// ✅ Correct - Use proper interfaces or unknown
interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}
const options: ResizeOptions = { fit: "cover" };

catch (error: unknown) {
  const err = error as Error;
  return err.message;
}
```

**Handle external library imports safely:**

```typescript
// ❌ Wrong - causes "error typed value" issues  
import { InferenceClient } from '@huggingface/inference';
const client = new InferenceClient(token); // TypeScript sees this as error type

// ✅ Correct - Add type assertions when needed
import { InferenceClient } from '@huggingface/inference';
const client = new InferenceClient(token) as InferenceClient;

// Or use try-catch for library instantiation
try {
  const client = new InferenceClient(token);
  // Use client safely here
} catch (error: unknown) {
  // Handle initialization errors
}
```

**Consistent indentation - No mixed tabs/spaces:**

```typescript
// ❌ Wrong - causes "Mixed spaces and tabs" errors
function example() {
  const data = {
    value: "mixed indentation"  // Tab then spaces
  };
}

// ✅ Correct - Use consistent spaces or tabs (prefer spaces)
function example() {
  const data = {
    value: "consistent indentation"  // All spaces
  };
}
```

**Remove unused variables:**

```typescript
// ❌ Wrong - causes "assigned but never used" errors
const preview = buffer.toString("base64"); // Assigned but never used

// ✅ Correct - Only declare when used, or use underscore prefix
const _preview = buffer.toString("base64"); // Underscore indicates intentionally unused
// Or simply remove if truly unused
```

### **API Integration Pattern**

- **Environment variables**: Store tokens in `.env`, never hardcode
- **Async HTTP**: Use `httpx.AsyncClient` with timeout
- **Helpful errors**: Guide users to fix configuration issues
- **Optional features**: Gracefully handle missing API keys

## **Communication & Documentation Style**

### **Tone & Voice**

- **Professional but approachable**: Technical accuracy with beginner friendly explanations
- **Concise and actionable**: Get to the point, provide next steps
- **Problem-solving focused**: Address the "why" behind decisions
- **Organized presentation**: Use headers, lists, code blocks effectively
- **No emoji or visual decorations**: Keep documentation clean and professional with plain text only

### **Documentation Standards**

- **Plain text navigation**: Use clear headings without visual decorations
- **Clear hierarchies**: ## for main sections, ### for subsections
- **No emoji**: Documentation should be clean and professional with no emoji or decorative symbols
- **Code examples**: Always include working examples, not placeholders
- **Practical focus**: Real-world usage over theoretical concepts
- **Reference linking**: Connect technical decisions to official documentation
- **Topic-focused files**: API-INTEGRATIONS.md, TROUBLESHOOTING.md, etc.
- **Comprehensive examples**: Real code snippets, not pseudocode
- **Cross-references**: Link between related documentation sections
- **User-friendly**: Step-by-step instructions, troubleshooting sections

## **Expected AI Assistance Style**

### **Before Starting Work**

1. **Check core project files**: README.md, AI-PROMPT.md, TODO.md
2. **Review relevant documentation**: docs/ folder files as needed
3. **Create detailed plan**: Consider best actions, make comprehensive plan
4. **Reference plan regularly**: Stay on track with planned approach

### **When Helping with Code**

1. **Preserve existing code**: Keep current code and comments where possible
2. **Add detailed comments**: From original author's perspective explaining purpose
3. **Follow modular TypeScript architecture**: Tools organized by category (file, system, command, git)
4. **Include complete examples**: With error handling and explanatory comments
5. **Add file headers**: Use required TypeScript comment format for any new files
6. **Update References section**: When introducing new technical concepts
7. **Use Zod for validation**: All tool schemas must use Zod (z.object, z.string, etc.)
8. **Import with .js extensions**: TypeScript requires .js for ES module imports (NodeNext resolution)
9. **Always use Context7**: Use Context7 for MCP SDK, Zod, Node.js API documentation automatically
10. **Never use console.log()**: It breaks stdio transport - use console.error() for debugging only

### **When Discussing Architecture**

- **Respect MCP protocol constraints**: Tools/resources model limitations
- **Consider local vs remote usage**: Patterns and requirements
- **Focus on VS Code integration**: Primary use case
- **Balance features vs simplicity**: Personal project scale

### **After Making Changes**

1. **Update core files**: README.md, AI-PROMPT.md, TODO.md as needed
2. **Update docs/ folder**: Relevant documentation files
3. **Mark TODO.md progress**: (in progress) for active work, (completed) for finished tasks
4. **Test changes**: Use JSON-RPC test commands before finishing

## **Current Project Priorities**

### **Quality Standards**

- **Test before committing**: Use JSON-RPC test commands
- **Update documentation**: Keep docs/ files current with changes
- **Security review**: Validate all user inputs, use safe defaults
- **Performance check**: Consider impact of new tools on startup time

### **Avoid Over-Engineering**

- No excess documents or scripts (personal project scale)
- Keep documentation focused and practical
- Prefer markdown checklists over complex project management
