# My MCP Server

A Model Context Protocol (MCP) server providing development tools and API integrations for AI assistants in VS Code.

**📚 [Complete Documentation on BookStack](https://bookstack.deejpotter.com/books/mcp-server)**

For comprehensive documentation including:

- AI Development Guidelines
- Project Roadmap & Tracking
- Complete Tool Reference
- Architecture Details
- Development Guides

Visit the **[MCP Server Book](https://bookstack.deejpotter.com/books/mcp-server)** on BookStack.

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Development mode with auto-reload
- `npm start` - Run the compiled server
- `npm run typecheck` - Check TypeScript types
- `npm run lint` - Run ESLint checks
- `npm test` - Run test suite

## VS Code Integration

Add to your VS Code MCP settings file (`~/.config/Code/User/mcp.json` on Linux/macOS or `%APPDATA%\Code\User\mcp.json` on Windows):

### Production Mode (Recommended)

```json
{
  "servers": {
    "my-mcp-server": {
      "command": "npm",
      "args": [
        "--prefix",
        "~/Repos/my-mcp-server",
        "start"
      ],
      "env": {}
    }
  }
}
```

**Note:** Run `npm run build` after any code changes.

### Development Mode

```json
{
  "servers": {
    "my-mcp-server": {
      "command": "npm",
      "args": [
        "--prefix",
        "~/Repos/my-mcp-server",
        "run",
        "dev"
      ],
      "env": {}
    }
  }
}
```

**Note:** Auto-reloads on file changes, no build step needed.

## Configuration

Create a `.env` file in the project root for API integrations:

```env
# Google Search (via SerpAPI) - Free tier: 100 searches/month
SERPAPI_API_KEY=your_serpapi_key_here

# Context7 - Optional for enhanced documentation
CONTEXT7_API_KEY=your_context7_key_here

# BookStack - Required for BookStack tools
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id_here
BOOKSTACK_TOKEN_SECRET=your_token_secret_here

# ClickUp - Required for ClickUp tools
CLICKUP_API_TOKEN=your_clickup_token_here

# Grocy - Required for Grocy tools
GROCY_BASE_URL=https://your-grocy-instance.com
GROCY_API_KEY=your_grocy_api_key_here

# Hugging Face - Required for AI image generation
HUGGING_FACE_API_KEY=your_hugging_face_key_here
```

**Note:** DuckDuckGo search works without any API keys.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## **Available Tools**

All tools include comprehensive security validation and error handling.

### **File Operations**

- **read_file** - Read file contents with size limits and path validation
  - Security: Blocks path traversal, validates paths within working directory
  - Default max size: 1MB (configurable)
  
- **write_file** - Write content to files with automatic directory creation
  - Security: Path validation, prevents writing to forbidden directories
  - Creates parent directories automatically
  
- **list_files** - List files with glob pattern support
  - Supports recursive directory traversal
  - Filters out forbidden paths (.git, node_modules, .env)

### **Web Search**

- **google_search** - Search Google using SerpAPI
  - Returns structured results: title, URL, snippet, position
  - Requires `SERPAPI_API_KEY` environment variable (free tier: 100 searches/month)
  - Supports location-specific results

- **duckduckgo_search** - Search DuckDuckGo for web results
  - No API key required - free and unlimited
  - Returns real web search results with titles, URLs, and snippets
  - Privacy-focused search option without tracking

### **Documentation Lookup**

- **resolve_library_id** - Find the correct Context7 library ID for a package
  - Search for libraries, frameworks, and documentation
  - Returns best matches with metadata (code snippets, trust score, versions)

- **get_documentation** - Fetch comprehensive documentation from Context7
  - Get up-to-date, version-specific documentation
  - Optional topic filtering for focused documentation
  - Configurable token limits for documentation length

- **search_documentation** - Search across multiple libraries in Context7
  - Full-text search across documentation
  - Filter by category/technology
  - Get relevance-ranked results with snippets

### **BookStack Integration**

- **bookstack_search** - Search across BookStack documentation
  - Search books, pages, chapters, and shelves
  - Supports advanced search syntax (filters, exact matches, tags)
  - Returns previews and metadata
  - Requires `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET`

- **bookstack_get_shelf** - Get shelf details and books
  - Retrieve shelf information including all books
  - View book list in display order
  - Includes metadata and hierarchy

- **bookstack_get_page** - Retrieve full page content
  - Get page content in HTML and Markdown formats
  - Includes all metadata and hierarchy information

- **bookstack_get_book** - Get book structure
  - Retrieve book details and table of contents
  - View all chapters and pages in structured format

- **bookstack_create_shelf** - Create new shelves
  - Create top-level shelves to organize multiple books
  - Optionally add books during shelf creation
  - Supports descriptions and tags

- **bookstack_create_book** - Create new books
  - Create top-level books with name, description, and tags
  - Returns book ID and URL for adding chapters/pages
  - Supports tagging for organization

- **bookstack_create_chapter** - Create chapters within books
  - Organize pages into logical chapters
  - Requires parent book_id
  - Supports descriptions and tags

- **bookstack_create_page** - Create pages with content
  - Create pages within books or chapters
  - Supports both HTML and Markdown content
  - Automatic base64 image extraction to gallery
  - Requires either book_id or chapter_id

- **bookstack_update_shelf** - Update shelf details and books
  - Modify shelf name, description, and book assignments
  - Reorder books by providing new books array
  - Partial updates supported

- **bookstack_update_book** - Update book details
  - Modify book name, description, and tags
  - Partial updates supported (only provide fields to change)

- **bookstack_update_page** - Update page content and metadata
  - Update page name, HTML/Markdown content, and tags
  - Move pages between books or chapters
  - Partial updates supported

- **bookstack_delete_shelf** - Delete a shelf
  - WARNING: Permanently deletes the shelf (cannot be undone)
  - Books within the shelf are preserved
  - Requires shelf_id

- **bookstack_delete_book** - Delete a book
  - WARNING: Permanently deletes the book and all its chapters and pages (cannot be undone)
  - Requires book_id

- **bookstack_delete_chapter** - Delete a chapter
  - WARNING: Permanently deletes the chapter and all its pages (cannot be undone)
  - Requires chapter_id

- **bookstack_delete_page** - Delete a page
  - WARNING: Permanently deletes the page (cannot be undone)
  - Requires page_id

### **ClickUp Integration**

- **clickup_get_task** - Retrieve task details
  - Get complete task information including status, priority, assignees
  - View tags, dates, descriptions, and custom fields
  - Requires `CLICKUP_API_TOKEN`

- **clickup_create_task** - Create new tasks
  - Create tasks in any list with name, description, status
  - Set priority, due dates, assignees, and tags
  - Returns task ID and URL

- **clickup_update_task** - Update existing tasks
  - Modify task properties (name, description, status, priority)
  - Add or remove assignees
  - Update due dates and other fields

### **Grocy Integration**

Kitchen and household inventory management with smart stock tracking, shopping lists, and recipes.

**Stock Management:**

- **grocy_stock_get_current** - Get complete stock overview with amounts and best before dates
- **grocy_stock_get_product** - Get detailed product information, pricing, and history
- **grocy_stock_add_product** - Add products to stock (purchase tracking with dates and prices)
- **grocy_stock_consume_product** - Remove products from stock (consumption tracking with FIFO)
- **grocy_stock_get_volatile** - Get products expiring soon, overdue, expired, or below minimum stock
- **grocy_stock_get_product_by_barcode** - Look up products by barcode

**Shopping List:**

- **grocy_shoppinglist_add_product** - Add products to shopping list
- **grocy_shoppinglist_remove_product** - Remove products from shopping list
- **grocy_shoppinglist_add_missing** - Auto-add all products below minimum stock
- **grocy_shoppinglist_clear** - Clear shopping list (all items or completed only)

**Product Management:**

- **grocy_product_create** - Create new products in Grocy (required before adding to recipes)
- **grocy_location_list** - List all storage locations (for product creation)
- **grocy_quantity_unit_list** - List all quantity units (piece, gram, kg, liter, ml, etc.)

**Recipes & Meal Planning:**

- **grocy_recipe_create** - Create new recipe with name, description, and serving information
- **grocy_recipe_add_ingredient** - Add ingredient to recipe with quantity and product ID
- **grocy_recipe_get_fulfillment** - Check if ingredients are in stock for a recipe
- **grocy_recipe_consume** - Consume all recipe ingredients from stock
- **grocy_recipe_add_missing_to_shoppinglist** - Add missing recipe ingredients to shopping list
- **grocy_meal_plan_add** - Add recipe to meal plan calendar for a specific date
- **grocy_meal_plan_get** - Retrieve meal plans for a date range (weekly planning overview)

**Tasks:**

- **grocy_tasks_get_pending** - Get all incomplete tasks
- **grocy_task_complete** - Mark task as completed

**System:**

- **grocy_system_info** - Get Grocy version and system information

Requires `GROCY_BASE_URL` and `GROCY_API_KEY` environment variables.

### **Australian Grocery Price Comparison**

Search and compare prices across Woolworths and Coles supermarkets in Australia.

- **woolworths_search_product** - Search Woolworths products and get current prices
  - Public API (no authentication required)
  - Returns product names, prices, units (kg, g, L, ml, each, pack)
  - Includes package sizes and unit price information
  - Limit results with optional parameter

- **coles_search_product** - Search Coles products and get current prices
  - Returns product names, prices, units, and package sizes
  - Supports store-specific searches (default: store 0584)
  - Requires `COLES_API_KEY` environment variable
  - Limit results with optional parameter

- **grocery_compare_prices** - Compare prices across both stores
  - Search product at Woolworths and Coles simultaneously
  - Shows best match from each store with prices
  - Calculates which store is cheapest
  - Displays savings amount
  - Perfect for making informed shopping decisions

**Example Usage:**

```text
"Search for ground beef at Woolworths"
"Check Coles prices for spaghetti"
"Compare tomato sauce prices at both stores"
"Find the cheapest option for olive oil"
```

**Benefits:**

- Real-time pricing from both major Australian supermarkets
- Unit price comparison ($/kg, $/100g, etc.)
- Save money by shopping at the cheapest store
- Integration ready for Grocy shopping lists (coming soon)

Requires `COLES_API_KEY` environment variable. Woolworths API is public and needs no key.

### **Command Execution**

- **run_command** - Execute shell commands with security validation
  - Allowlist-only execution (git, ls, pwd, echo, cat, grep, find, npm, node, etc.)
  - Timeout protection (default 30 seconds)
  - Working directory validation
  
- **security_status** - View security configuration
  - Shows allowed commands
  - Lists forbidden paths and directories
  - Displays current security settings

### **Git Integration**

- **git_command** - Execute git commands safely
  - Validated git operations only
  - Repository directory validation
  - Timeout protection (default 60 seconds)

### **Image Generation & Manipulation**

- **image_generate** - Generate images from text prompts using AI
  - Powered by Hugging Face FLUX.1 models (schnell and dev)
  - Multiple size options (512x512 to 1024x1024)
  - Supports negative prompts and guidance scale
  - Requires `HUGGING_FACE_API_KEY` (free tier: ~50 images/day)
  - [Detailed documentation](http://bookstack.deejpotter.com/books/mcp-server-XGf/page/image-generation-manipulation-tools)

- **image_convert** - Convert images between formats
  - Supports WEBP, PNG, JPEG, AVIF, GIF, TIFF
  - Batch processing with directory support
  - Quality control and folder structure preservation
  - Perfect for optimizing images for web/BookStack

- **image_resize** - Resize images with smart strategies
  - 7 convenient presets (thumbnail to 4K)
  - 5 fit strategies (cover, contain, fill, inside, outside)
  - Maintains aspect ratio automatically
  - Batch processing support

- **image_optimize** - Optimize images to reduce file size
  - Format-specific compression (mozjpeg, palette reduction)
  - Typically 40-70% space savings
  - Metadata preservation option
  - Detailed statistics reporting

## **Available Resources**

Resources provide read-only context information to AI assistants.

## **Available Prompts**

These are high-quality, workflow-focused prompts exposed by the MCP server. Each prompt is designed to guide a real developer workflow (quality over quantity).

- **code_review_guide** — Step-by-step code review workflow covering readability, security, performance, testing, and actionable recommendations.
- **commit_message_composer** — Compose meaningful commit messages following Conventional Commits; integrates with git tools to analyze diffs.
- **library_research_workflow** — Systematic library/framework research workflow using Context7 and web search to evaluate fit and alternatives.
- **bug_investigation_guide** — Structured debugging methodology: reproduce, gather data, form hypotheses, test, fix, and document.
- **feature_implementation_plan** — Break a feature into requirements, architecture, file changes, tests, rollout, and success metrics.
- **search_strategy_guide** — Transforms user's rough search intent into optimized queries; analyzes intent, recommends best tool, and provides ready-to-execute search strategies.

## **Security Features**

This MCP server implements enterprise-grade security measures:

### **Command Injection Protection**

- Allowlist-based command validation
- Only pre-approved commands can execute
- Dangerous command patterns blocked (rm -rf, format, etc.)

### **Path Traversal Prevention**

- All file paths validated against working directory
- Canonical path resolution prevents directory escape
- Forbidden directories automatically blocked (.git, node_modules, .env)

### **Resource Limits**

- File size limits prevent memory exhaustion (default 1MB)
- Command timeout protection (30-60 seconds)
- Buffer size limits on command output

### **Information Disclosure Protection**

- No hostname exposure in resources
- Full filesystem paths replaced with relative paths
- Environment variables filtered for sensitive data

## **VS Code Integration**

### **Setup for GitHub Copilot**

Add to your VS Code MCP settings file:

**Windows:** `%APPDATA%\Code\User\mcp.json`

**macOS/Linux:** `~/.config/Code/User/mcp.json`

### **Production Mode (Recommended)**

Best for normal daily use. Runs the compiled JavaScript for better performance and stability.

**Requirements:** Run `npm run build` after any code changes.

```json
{
  "servers": {
    "my-mcp-server": {
      "command": "npm",
      "args": [
        "--prefix",
        "~/Repos/my-mcp-server",
        "start"
      ],
      "env": {}
    }
  }
}
```

**Benefits:**

- Faster startup and lower memory usage
- More stable for long-running background process
- Standard production Node.js setup

### **Development Mode**

Best for active development. Runs TypeScript directly with hot reload.

**Requirements:** Only needs `npm install` (no build step).

```json
{
  "servers": {
    "my-mcp-server": {
      "command": "npm",
      "args": [
        "--prefix",
        "~/Repos/my-mcp-server",
        "run",
        "dev"
      ],
      "env": {}
    }
  }
}
```

**Benefits:**

- No build step required
- Auto-restarts on file changes
- Faster iteration during development

**Note:** Adjust paths to match your installation directory. The `~/Repos/my-mcp-server` path works on both Windows and Linux.

## **Setup for Jan AI**

Jan uses a different configuration format. Add to Jan's MCP settings:

**Production Mode (Recommended):**

```json
{
  "type": "stdio",
  "command": "node",
  "args": [
    "C:/Users/YourUserName/Repos/my-mcp-server/dist/server.js"
  ],
  "active": true
}
```

**Requirements:** Run `npm run build` after any code changes.

**Note:** Use absolute paths with forward slashes for Windows compatibility.

## **Configuration**

### **Environment Variables (Optional)**

Create a `.env` file for API integrations:

```env
# Google Search (via SerpAPI) - Required for google_search tool
# Get your key from: https://serpapi.com/manage-api-key
# Free tier: 100 searches/month
SERPAPI_API_KEY=your_serpapi_key_here

# Context7 - Optional for enhanced documentation lookup
# Get your key from: https://context7.com
CONTEXT7_API_KEY=your_context7_key_here

# BookStack - Required for BookStack tools
# Create tokens in your BookStack instance: Settings > API Tokens
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id_here
BOOKSTACK_TOKEN_SECRET=your_token_secret_here

# ClickUp - Required for ClickUp tools
# Get your token from: https://app.clickup.com/settings/apps
CLICKUP_API_TOKEN=your_clickup_token_here

# GitHub - Optional for enhanced code search
# Create at: https://github.com/settings/tokens
GITHUB_TOKEN=your_github_token_here
```

**Note:** DuckDuckGo search works without any API keys - it's completely free and unlimited!

## **Project Structure**

```text
my-mcp-server/
├── src/
│   ├── server.ts              # Main MCP server entry point
│   ├── tools/                 # MCP tool implementations
│   │   ├── fileTools.ts       # File read/write/list operations
│   │   ├── systemTools.ts     # System monitoring and stats
│   │   ├── commandTools.ts    # Command execution and security
│   │   └── gitTools.ts        # Git command operations
│   ├── resources/             # MCP resources (read-only data)
│   │   ├── systemResources.ts # System and workspace information
│   │   └── gitResources.ts    # Git repository status
│   └── utils/                 # Shared utility functions
│       ├── security.ts        # Security validation and checks
│       ├── cache.ts           # Caching and rate limiting
│       └── performance.ts     # Performance tracking
├── dist/                      # Compiled JavaScript (generated by build)
├── package.json               # Node.js dependencies and scripts
├── tsconfig.json              # TypeScript compiler configuration
├── .eslintrc.json             # ESLint code quality rules
└── README.md                  # This file
```

## **Development**

### **Adding New Tools**

Tools are organized by category. To add a new tool:

1. Choose the appropriate file in `src/tools/` or create a new category
2. Use the `server.registerTool()` pattern with Zod schemas
3. Implement security validation using utilities from `src/utils/security.ts`
4. Register in `src/server.ts` if creating a new file

Example tool structure:

```typescript
server.registerTool(
  "tool_name",
  {
    title: "Tool Title",
    description: "What the tool does",
    inputSchema: {
      param: z.string().describe("Parameter description"),
    },
    outputSchema: {
      result: z.string(),
    },
  },
  async ({ param }) => {
    try {
      // Tool implementation
      return {
        content: [{ type: "text", text: "Success message" }],
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
```

### **Code Standards**

- **TypeScript strict mode** - All code must pass type checking
- **Zod validation** - All tool inputs validated with Zod schemas
- **Security first** - Use `validatePath()` and `validateCommand()` from utils
- **Error handling** - Always return content with `isError` flag, never throw
- **Comments** - Add JSDoc comments explaining purpose and security considerations
- **No console.log** - Use `console.error()` for debugging (stdout is for MCP protocol)

## **Troubleshooting**

### **Server Won't Start**

1. Check Node.js version: `node --version` (must be 18+)
2. Rebuild: `npm run build`
3. Check for errors: `npm run typecheck`

### **Tools Not Appearing in VS Code**

1. Verify MCP settings file location and syntax
2. Restart VS Code completely
3. Check server is built: `npm run build`
4. Check dist/server.js exists

### **Security Validation Errors**

1. Run `security_status` tool to see allowed commands
2. Ensure file paths are within working directory
3. Check command is in allowlist (git, ls, pwd, etc.)

## **Contributing**

This is a personal project, but suggestions and improvements are welcome. When contributing:

1. Follow existing code patterns and structure
2. Add comprehensive error handling
3. Include security validation for all user inputs
4. Update documentation for any new features
5. Test thoroughly before submitting

## **License**

MIT License - see [LICENSE](LICENSE) file for details.
