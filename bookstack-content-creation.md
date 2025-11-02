# BookStack Project Documentation Creation Script

This script documents the content to be created in BookStack for the MCP Server project.

**IMPORTANT**: Before running these commands, restart VS Code or run "MCP: Restart Connection" to load the new `bookstack_create_shelf` tool.

## Step 1: Create the "Personal Projects" Shelf

```typescript
bookstack_create_shelf({
  name: "Personal Projects",
  description: "Collection of personal development projects, tools, and experiments. Includes both solo projects and collaborative work.",
  tags: [
    { name: "category", value: "projects" },
    { name: "owner", value: "Daniel Potter" }
  ]
})
```

**Expected result**: Shelf ID and URL will be returned. Note the shelf_id for later use.

## Step 2: Create the "MCP Server" Book

```typescript
bookstack_create_book({
  name: "MCP Server",
  description: "Model Context Protocol server built with TypeScript, providing development tools and API integrations for AI assistants in VS Code. Features file operations, Git integration, web search, documentation lookup, and more.",
  tags: [
    { name: "language", value: "TypeScript" },
    { name: "category", value: "development-tools" },
    { name: "framework", value: "MCP" },
    { name: "status", value: "active" },
    { name: "version", value: "1.0.0" }
  ]
})
```

**Expected result**: Book ID and URL will be returned. Note the book_id for all subsequent chapters and pages.

## Step 3: Add Book to Shelf

After creating both the shelf and book, update the shelf to include the book:

```typescript
bookstack_update_shelf({
  shelf_id: <shelf_id_from_step_1>,
  books: [<book_id_from_step_2>]
})
```

**Note**: You'll need to implement `bookstack_update_shelf` tool if it doesn't exist, or manually add the book through the BookStack web interface.

---

## Chapter 1: Overview

### Create Chapter

```typescript
bookstack_create_chapter({
  name: "Overview",
  book_id: <book_id_from_step_2>,
  description: "Introduction to the MCP Server project - what it is, why it exists, and key capabilities.",
  tags: [{ name: "section", value: "introduction" }]
})
```

### Page 1.1: Introduction

```typescript
bookstack_create_page({
  name: "Introduction",
  chapter_id: <chapter_id_from_above>,
  markdown: `# MCP Server - Introduction

## What is MCP Server?

MCP Server is a comprehensive Model Context Protocol (MCP) server built with **TypeScript** that provides essential development tools and utilities for AI assistants in VS Code. It serves as a bridge between AI assistants (like GitHub Copilot or Claude) and various development resources.

## Purpose

This project was created to:

- **Streamline AI-assisted development** - Provide AI assistants with direct access to files, git operations, web search, and documentation
- **Enhance security** - Implement enterprise-grade security with command allowlisting and path validation
- **Enable integrations** - Connect AI assistants to tools like BookStack, ClickUp, Google Search, and more
- **Support workflows** - Offer high-quality prompts for common development workflows

## Project Status

- **Version**: 1.0.0
- **Status**: Active development
- **Author**: Daniel Potter
- **License**: MIT
- **Repository**: https://github.com/Deejpotter/my-mcp-server

## Key Principle

This is a **personal project** focused on practical utility over enterprise features. The codebase emphasizes:
- Clean, maintainable TypeScript
- Modular architecture
- Comprehensive documentation
- Security-first design
`,
  tags: [{ name: "type", value: "overview" }]
})
```

### Page 1.2: Features & Capabilities

```typescript
bookstack_create_page({
  name: "Features & Capabilities",
  chapter_id: <chapter_id_from_overview>,
  markdown: `# Features & Capabilities

## Core Features

### 🔒 Security First
- **Command Allowlisting** - Only pre-approved commands can execute
- **Path Validation** - Prevents directory traversal attacks
- **No Sensitive Data Exposure** - Credentials stored in environment variables
- **Forbidden Directory Blocking** - Automatic protection of .git, node_modules, .env

### 📁 File Operations
- **Read Files** - With size limits and path validation
- **Write Files** - Automatic directory creation, path security
- **List Files** - Glob pattern support, recursive traversal

### 🔍 Web Search & Documentation
- **Google Search** - Via SerpAPI with structured results
- **DuckDuckGo Search** - Free, unlimited web search
- **Context7 Integration** - Library documentation lookup
- **Resolve Library IDs** - Find correct documentation sources

### 🔧 Git Integration
- **Git Commands** - Safe execution of git operations
- **Repository Status** - Real-time repo information as MCP resource
- **Validated Operations** - Only safe git commands allowed

### 📚 BookStack Integration
- **Search** - Full-text search across documentation
- **Read Content** - Get books, chapters, and pages
- **Create Content** - Books, chapters, pages with HTML/Markdown
- **Update Content** - Modify existing documentation
- **Shelf Management** - Organize books into shelves

### ✅ ClickUp Integration
- **Task Management** - Get, create, and update tasks
- **Full Metadata** - Status, priority, assignees, tags, dates
- **List Integration** - Create tasks in any list

### 🚀 Command Execution
- **Allowlist-Based** - Only approved commands (git, npm, node, ls, etc.)
- **Timeout Protection** - Default 30s, configurable
- **Working Directory Validation** - Security checks on paths

### 📋 MCP Prompts
- **Code Review Guide** - Systematic code review workflow
- **Commit Message Composer** - Conventional Commits support
- **Library Research** - Evaluate libraries and frameworks
- **Bug Investigation** - Structured debugging methodology
- **Feature Implementation** - Break down features into tasks
- **Search Strategy** - Optimize search queries

## Type Safety

- **Full TypeScript** - Complete type coverage
- **Zod Validation** - Schema validation for all inputs/outputs
- **Type-safe Tools** - Catch errors at compile time

## Integration Support

Works seamlessly with:
- GitHub Copilot (VS Code)
- Claude Desktop
- Any MCP-compatible AI assistant
`,
  tags: [{ name: "type", value: "features" }]
})
```

### Page 1.3: Architecture

```typescript
bookstack_create_page({
  name: "Architecture",
  chapter_id: <chapter_id_from_overview>,
  markdown: `# Architecture

## Technology Stack

- **Language**: TypeScript 5.6
- **Runtime**: Node.js 18+
- **Protocol**: Model Context Protocol (MCP) 1.0.4
- **Validation**: Zod 3.23
- **Build**: TypeScript Compiler (tsc)
- **Dev Tools**: tsx for watch mode, ESLint for code quality

## Project Structure

\`\`\`
my-mcp-server/
├── src/
│   ├── server.ts                  # MCP server entry point
│   ├── tools/                     # MCP tools (modular)
│   │   ├── fileTools.ts           # File operations
│   │   ├── commandTools.ts        # Command execution
│   │   ├── gitTools.ts            # Git operations
│   │   ├── googleSearchTools.ts   # Google Search
│   │   ├── duckduckgoSearchTools.ts # DuckDuckGo Search
│   │   ├── context7Tools.ts       # Documentation lookup
│   │   ├── bookstackTools.ts      # BookStack integration
│   │   └── clickupTools.ts        # ClickUp integration
│   ├── resources/                 # MCP resources
│   │   └── gitResources.ts        # Git repository status
│   ├── prompts/                   # MCP prompts
│   │   └── prompts.ts             # Workflow prompts
│   └── utils/                     # Shared utilities
│       ├── security.ts            # Security & validation
│       ├── cache.ts               # Caching & rate limiting
│       └── performance.ts         # Performance tracking
├── dist/                          # Compiled JavaScript
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── .env.example                   # Environment template
├── AI-PROMPT.md                   # AI assistant guide
└── TODO.md                        # Development roadmap
\`\`\`

## Design Principles

### Modular Architecture
- Each tool category in separate file
- Clear separation of concerns
- Easy to add new tools

### Security First
- Input validation on all inputs
- Path traversal prevention
- Command allowlisting
- No credential exposure

### Type Safety
- TypeScript for compile-time checks
- Zod schemas for runtime validation
- Explicit interfaces for all data structures

### Developer Experience
- Clear error messages
- Comprehensive logging to stderr
- Watch mode for development
- Detailed documentation

## Communication Flow

\`\`\`
AI Assistant (VS Code)
        ↓
   MCP Protocol (stdio)
        ↓
   MCP Server (server.ts)
        ↓
   Tool Router (registered tools)
        ↓
   Tool Implementation (tools/*.ts)
        ↓
   External APIs / File System / Git
\`\`\`

## Tool Registration Pattern

All tools follow this pattern:

\`\`\`typescript
server.registerTool(
  "tool_name",
  {
    title: "Human-readable title",
    description: "What the tool does",
    inputSchema: {
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional()
    },
    outputSchema: {
      result: z.string()
    }
  },
  async (params) => {
    // Tool implementation
    return {
      content: [{ type: "text", text: "Result" }],
      structuredContent: { result: "data" }
    };
  }
);
\`\`\`

## Resource Pattern

Resources provide read-only context:

\`\`\`typescript
server.registerResource(
  "resource://identifier",
  {
    name: "Resource Name",
    description: "What the resource provides"
  },
  async () => {
    // Fetch and return data
    return { content: [...] };
  }
);
\`\`\`

## Prompt Pattern

Prompts guide AI workflows:

\`\`\`typescript
server.registerPrompt(
  "prompt_name",
  {
    title: "Prompt Title",
    description: "What the prompt helps with"
  },
  {
    system: "Expert context for AI",
    user: "Step-by-step template"
  }
);
\`\`\`

## Extension Points

Easy to add:
- New tools (add to tools/ directory)
- New resources (add to resources/ directory)
- New prompts (add to prompts/ directory)
- New API integrations (follow existing patterns)
`,
  tags: [{ name: "type", value: "architecture" }]
})
```

---

## Chapter 2: Getting Started

### Create Chapter

```typescript
bookstack_create_chapter({
  name: "Getting Started",
  book_id: <book_id_from_step_2>,
  description: "Installation, configuration, and setup guide for the MCP Server.",
  tags: [{ name: "section", value: "setup" }]
})
```

### Page 2.1: Installation

```typescript
bookstack_create_page({
  name: "Installation",
  chapter_id: <chapter_id_from_getting_started>,
  markdown: `# Installation

## Prerequisites

Before installing MCP Server, ensure you have:

- **Node.js 18 or higher** (LTS recommended)
- **npm** (comes with Node.js)
- **Git** (for git-related tools)
- **VS Code** (recommended IDE for MCP integration)

### Verify Prerequisites

\`\`\`bash
# Check Node.js version
node --version
# Should show v18.0.0 or higher

# Check npm version
npm --version

# Check git version
git --version
\`\`\`

## Installation Steps

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

This will install:
- @modelcontextprotocol/sdk - MCP protocol implementation
- zod - Schema validation
- glob - File pattern matching
- TypeScript and development tools

### 3. Build the Server

\`\`\`bash
npm run build
\`\`\`

This compiles TypeScript to JavaScript in the \`dist/\` directory.

### 4. Configure Environment Variables

Copy the example environment file:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` and add your API keys (see Configuration page for details).

## Verify Installation

Test that the server starts successfully:

\`\`\`bash
npm start
\`\`\`

You should see:
\`\`\`
MCP Server started successfully
\`\`\`

(Note: This message appears in stderr, not stdout, as MCP uses stdio for communication)

## Available Scripts

- \`npm run build\` - Compile TypeScript to JavaScript
- \`npm run dev\` - Run in development mode with auto-reload
- \`npm start\` - Run the compiled server
- \`npm run typecheck\` - Check TypeScript types without building
- \`npm run lint\` - Run ESLint code quality checks

## Next Steps

1. Configure environment variables (see Configuration page)
2. Set up VS Code integration (see First Steps page)
3. Test the available tools
`,
  tags: [{ name: "topic", value: "installation" }]
})
```

### Page 2.2: Configuration

```typescript
bookstack_create_page({
  name: "Configuration",
  chapter_id: <chapter_id_from_getting_started>,
  markdown: `# Configuration

## Environment Variables

MCP Server uses environment variables for API keys and configuration. All variables are optional unless you want to use specific integrations.

### Creating the .env File

\`\`\`bash
cp .env.example .env
\`\`\`

Edit the \`.env\` file to add your credentials.

## Available Environment Variables

### Google Search (Optional)

\`\`\`bash
SERPAPI_API_KEY=your_serpapi_key_here
\`\`\`

- **Required for**: \`google_search\` tool
- **Get API key**: https://serpapi.com/manage-api-key
- **Free tier**: 100 searches/month
- **Alternative**: Use \`duckduckgo_search\` tool (no API key required)

### Context7 Documentation (Optional)

\`\`\`bash
CONTEXT7_API_KEY=your_context7_key_here
\`\`\`

- **Required for**: Enhanced Context7 documentation features
- **Note**: Context7 works without API key, but may have rate limits
- **Get API key**: Contact Context7

### BookStack Integration (Optional)

\`\`\`bash
BOOKSTACK_URL=https://bookstack.example.com
BOOKSTACK_TOKEN_ID=your_token_id_here
BOOKSTACK_TOKEN_SECRET=your_token_secret_here
\`\`\`

- **Required for**: All BookStack tools
- **Setup**:
  1. Open your BookStack user profile
  2. Go to "API Tokens" section
  3. Click "Create Token"
  4. Copy Token ID and Token Secret
  5. Ensure your user has "Access System API" permission

### ClickUp Integration (Optional)

\`\`\`bash
CLICKUP_API_TOKEN=your_clickup_token_here
\`\`\`

- **Required for**: All ClickUp tools
- **Get API token**:
  1. Go to ClickUp Settings
  2. Navigate to "Apps"
  3. Generate API Token
  4. Copy the token

## Security Best Practices

### 1. Never Commit .env File

The \`.env\` file is in \`.gitignore\` by default. **Never remove it from there.**

### 2. Use Strong API Tokens

- Generate new tokens specifically for this application
- Set appropriate expiry dates
- Rotate tokens regularly

### 3. Limit Permissions

For BookStack and other services:
- Create a dedicated API user with minimal required permissions
- Don't use admin accounts for API access

### 4. Environment-Specific Configuration

For different environments (development, staging, production):

\`\`\`bash
# Development
.env

# Staging
.env.staging

# Production
.env.production
\`\`\`

Use environment-specific files and load them appropriately.

## Validation

After configuration, verify your setup:

\`\`\`bash
# Test the server starts
npm start

# In VS Code, test a tool
# Try: duckduckgo_search (no API key required)
\`\`\`

If configured correctly:
- Tools will execute without authentication errors
- API rate limits will be respected
- Structured data will be returned

## Troubleshooting

### "No API key found" Errors

1. Check \`.env\` file exists in project root
2. Verify environment variable names match exactly
3. Restart VS Code after changing .env
4. Check for extra spaces or quotes

### "Permission denied" Errors

1. Verify API token has correct permissions
2. Check token hasn't expired
3. Ensure user account is active
4. Test token in browser/Postman first

### "Rate limit exceeded" Errors

- Wait for rate limit to reset (usually 1 minute)
- Reduce request frequency
- Consider upgrading API plan
- Use alternative tools (e.g., DuckDuckGo instead of Google)

## Next Steps

- Proceed to First Steps to integrate with VS Code
- Test tools with \`test-bookstack.md\` guide
- Review Available Tools documentation
`,
  tags: [{ name: "topic", value: "configuration" }]
})
```

### Page 2.3: First Steps

```typescript
bookstack_create_page({
  name: "First Steps",
  chapter_id: <chapter_id_from_getting_started>,
  markdown: `# First Steps

## VS Code Integration

### 1. Install Required VS Code Extension

MCP Server works with GitHub Copilot or other MCP-compatible extensions. For GitHub Copilot:

1. Open VS Code
2. Install "GitHub Copilot" extension
3. Sign in with your GitHub account

### 2. Configure MCP Connection

Create or edit \`~/.config/Code/User/mcp.json\`:

\`\`\`json
{
  "servers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/path/to/my-mcp-server/dist/server.js"],
      "env": {}
    }
  }
}
\`\`\`

Replace \`/path/to/my-mcp-server\` with your actual installation path.

### 3. Restart VS Code

After configuring:
- Close VS Code completely
- Reopen VS Code
- Or run command: "Developer: Reload Window"

### 4. Verify Connection

Check that MCP Server is connected:
- Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- Run: "MCP: Show Connections"
- You should see "my-mcp-server" listed

## Testing the Setup

### Test 1: File Operations

Ask Copilot to:
\`\`\`
List all TypeScript files in this project
\`\`\`

Expected: Should use \`list_files\` tool and show .ts files.

### Test 2: Git Integration

Ask Copilot to:
\`\`\`
Show me the current git status
\`\`\`

Expected: Should use \`git_command\` tool and display repo status.

### Test 3: Search

Ask Copilot to:
\`\`\`
Search DuckDuckGo for "TypeScript MCP server examples"
\`\`\`

Expected: Should use \`duckduckgo_search\` and return results.

### Test 4: Documentation

Ask Copilot to:
\`\`\`
Find documentation for the Zod library
\`\`\`

Expected: Should use Context7 tools to locate Zod docs.

## Common First-Time Issues

### Issue: Tools Not Available

**Solution**: Restart MCP connection
\`\`\`
Command Palette → "MCP: Restart Connection"
\`\`\`

### Issue: "Command not found" Error

**Solution**: Check path in mcp.json is correct
\`\`\`bash
# Verify the file exists
ls -la /path/to/my-mcp-server/dist/server.js
\`\`\`

### Issue: Permission Errors

**Solution**: Ensure server.js is executable
\`\`\`bash
chmod +x dist/server.js
\`\`\`

### Issue: API Tools Failing

**Solution**: Check .env configuration
- Verify API keys are set
- Restart VS Code after changing .env
- Check API key validity

## Understanding Tool Responses

### Successful Response

\`\`\`
Tool: duckduckgo_search
Status: ✅ Success
Results: [list of search results]
\`\`\`

### Error Response

\`\`\`
Tool: google_search
Status: ❌ Error
Message: SERPAPI_API_KEY not set
\`\`\`

### Rate Limit Response

\`\`\`
Tool: bookstack_search
Status: ⏱️ Rate Limited
Message: Please wait 45 seconds
\`\`\`

## Exploring Available Tools

List all available tools:

1. **File Operations**: read_file, write_file, list_files
2. **Git**: git_command
3. **Search**: google_search, duckduckgo_search
4. **Documentation**: resolve_library_id, get_documentation, search_documentation
5. **BookStack**: bookstack_search, bookstack_get_page, bookstack_create_book, etc.
6. **ClickUp**: clickup_get_task, clickup_create_task, clickup_update_task
7. **Commands**: run_command, security_status

See "Available Tools" chapter for detailed documentation on each tool.

## Using Prompts

MCP Server includes workflow prompts:

\`\`\`
Ask Copilot: "Use the code review guide prompt"
Ask Copilot: "Help me write a commit message"
Ask Copilot: "Research the React library for me"
\`\`\`

Prompts provide structured workflows for common tasks.

## Next Steps

1. Explore the Available Tools chapter
2. Try the test cases in \`test-bookstack.md\`
3. Read the Development Guide to extend the server
4. Check \`AI-PROMPT.md\` for AI assistant guidelines
`,
  tags: [{ name: "topic", value: "quickstart" }]
})
```

---

*Continue with Chapters 3 (Available Tools) and 4 (Development Guide) in the next file...*

## Notes

This script provides a comprehensive structure for documenting the MCP Server project. Each page includes:

- ✅ Clear, structured content
- ✅ Code examples with syntax highlighting
- ✅ Troubleshooting sections
- ✅ Next steps guidance
- ✅ Proper tagging for organization

After creating this structure, you can:
1. Add more detailed tool documentation
2. Include screenshots (via image uploads)
3. Cross-reference pages
4. Add more chapters as needed
5. Keep documentation in sync with code changes
