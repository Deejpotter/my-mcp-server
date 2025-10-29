# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server providing development tools, API integrations, and documentation search capabilities for AI assistants. The project uses a **consolidated architecture** with all tools in `src/tools.py` for simplicity.

**Project Scale:** Personal project with 1-2 contributors. Focus on practical utility over enterprise features. Avoid over-engineering.

## Development Commands

### Setup and Installation

```bash
# Install dependencies
pip install -r requirements-test.txt

# Run server
python main.py

# Run with debug logging
python main.py --log-level DEBUG
```

### Testing

```bash
# Test server startup
python main.py --help

# Test MCP protocol - list tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python main.py

# Test MCP protocol - call specific tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"README.md"}}}' | python main.py

# Test resource listing
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}' | python main.py
```

## Architecture

### Core Components

**Entry Point: main.py**

- MCP server initialization and protocol handlers
- Imports tools from consolidated `src/tools.py`
- Uses stdio transport for local MCP clients (VS Code, Claude Desktop, etc.)

**Consolidated Structure:**

```
src/
├── tools.py                  # ALL MCP tools (consolidated)
├── resources.py              # MCP resource definitions and handlers
├── integrations.py           # External API integrations
└── utils/                    # Shared utilities
    ├── security.py          # Security & path validation
    ├── cache_rate_limit.py  # Caching & rate limiting
    └── performance.py       # Performance tracking
```

### Key Design Patterns

1. **Consolidated Tools**: All tools in `src/tools.py` with routing via `handle_tool_call()`
2. **Resource URIs**: Resources use URI scheme routing (system://, workspace://, git://)
3. **Security Layer**: All file ops and commands go through security utilities with size limits and timeouts
4. **Category-based handlers**: Tools organized by category with `_handle_file_operations()`, `_handle_system_commands()`, etc.

### MCP Protocol Implementation

Three core MCP handlers in main.py:

- `@server.list_tools()` → Returns all tool definitions from `src.tools.get_all_tools()`
- `@server.call_tool()` → Routes tool execution via `src.tools.handle_tool_call()`
- `@server.list_resources()` → Returns available data sources
- `@server.read_resource()` → Fetches resource content via URI routing

## Development Workflow

### Before Starting Work

1. **Check core project files**: README.md, AI-PROMPT.md, TODO.md
2. **Review main.py and src/tools.py**: Understand current implementation
3. **Create detailed plan**: Consider best actions, make comprehensive plan
4. **Reference plan regularly**: Stay on track with planned approach

### File Management Philosophy

- **Improve existing files over creating new ones**: Update and enhance current files
- **All tools in src/tools.py**: Don't split tools into separate files
- **Preserve existing code and comments**: Keep current code wherever possible
- **Add detailed comments from author perspective**: Explain purpose and reasoning
- **Update core files**: Always update README.md, AI-PROMPT.md, TODO.md when needed

### TODO.md Management

- **Mark current work**: Use "(in progress)" for active tasks
- **Mark completion**: Use "(completed)" for finished tasks with date
- **Check before/after**: Review TODO.md before starting and update after changes
- **Track state accurately**: Reflect real status of project development

## Code Standards

### File Header Standards

Every new Python file must start with:

```python
"""
Updated: dd/mm/yy
By: Daniel Potter

Description of the purpose and important working knowledge.

References:
Reference name: https://reference.com/relevant-section
Another reference: https://docs.example.com/path
"""
```

**Requirements:**

- Date format: dd/mm/yy (e.g., 26/10/25)
- Author: Daniel Potter
- Description: Concise purpose and critical knowledge
- References: Link technical decisions to official docs

### Code Documentation Philosophy

- **Preserve existing code**: Keep current code and comments wherever possible
- **Why over what**: Comments explain reasoning, not just describe code
- **Reference-backed decisions**: Link technical choices to official documentation
- **Concise but descriptive**: Each action needs explanation of purpose and logic
- **Consistent patterns**: Follow existing tool/resource implementation patterns
- **No visual decorations**: Avoid emoji in code, focus on clarity

### Comment Examples

```python
# Use asyncio.create_task() for concurrent API calls - improves response time
# Reference: https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
task = asyncio.create_task(fetch_data())

# HTTPx chosen over requests for async support in MCP servers
# Reference: https://www.python-httpx.org/async/
async with httpx.AsyncClient(timeout=30) as client:
    response = await client.get(url)
```

## Adding New Features

### Adding a New Tool

1. **Add to src/tools.py** in the appropriate category section
2. **Add tool definition** to `get_all_tools()` function
3. **Implement handler** in the corresponding `_handle_*()` function (e.g., `_handle_file_operations()`)
4. **Add references** to file header if introducing new technical concepts

Tool definitions use JSON Schema for input validation. Always return `List[types.TextContent]` from handlers.

### Adding a New Resource

1. **Add Resource definition** to `resources.py::get_all_resources()`
2. **Implement handler** in `resources.py::handle_resource_read()`
3. **Use URI scheme** for namespacing (e.g., `db://tables`, `config://settings`)

### Adding External API Integration

1. **Add environment variables** to `.env.example`
2. **Add to src/integrations.py** with tool definitions
3. **Implement async HTTP calls** using `httpx.AsyncClient` with timeouts
4. **Update documentation** in README.md and AI-PROMPT.md

## Research and Documentation

### When Making Technical Decisions

1. **Use Context7 tools first**: Always use Context7 for code generation, setup/config steps, or library/API documentation
2. **Search online for gaps**: Find information not available in official docs
3. **Add comment explaining choice**: Brief rationale for the approach
4. **Reference official documentation**: Link to specific docs section in code comments
5. **Update file References section**: Add new documentation URLs to file header
6. **Explain alternatives considered**: Why this choice over others

### Context7 Usage

**Always use Context7 automatically** when you need:

- Code generation examples
- Setup or configuration steps
- Library or API documentation
- Best practices for specific libraries

Use the Context7 MCP tools to resolve library IDs and get documentation without explicit prompting.

## Security Considerations

### File Operations

- Use `safe_read_file()` with 1MB default size limit
- Use `safe_write_file()` for controlled file creation
- All paths resolved with `Path.resolve()` to prevent traversal attacks

### Command Execution

- Use `run_command()` with 30-second default timeout
- All commands run via subprocess with capture_output=True
- Returns structured Dict with success/error information

### API Keys

- Never log or return API keys in responses
- Filter environment variables ending in _KEY,_TOKEN, _SECRET,_PASSWORD
- Check for API key presence before making external calls

## Error Handling

**Critical: Never raise exceptions from tool handlers**

- Always return `[types.TextContent(type="text", text=f"Error: {str(e)}")]`
- Provide helpful error messages with context
- Include operation details for debugging
- MCP protocol requirement - tools must return TextContent, never throw

Reference: <https://modelcontextprotocol.io/docs/concepts/tools>

## Environment Variables

Optional API integrations configured via `.env`:

- `GITHUB_TOKEN` - GitHub API access
- `CLICKUP_API_TOKEN` - ClickUp integration
- `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET` - BookStack integration
- `CONTEXT7_API_KEY` - Context7 documentation search

## Current Priorities (from TODO.md)

### Near Term

- System monitoring tools (`system_stats`)
- Performance improvements (caching, rate limiting for external APIs)
- Developer experience enhancements (hot reloading, testing framework)

### Known Issues

- Large file operations can timeout (>1MB)
- Windows path handling inconsistent in some tools
- Error messages could be more user-friendly

## Documentation

Core documentation files:

- **AI-PROMPT.md** - Development style guide and philosophy
- **CLAUDE.md** - This file - Quick reference for Claude Code
- **TODO.md** - Current priorities and planned features
- **docs/ADVANCED.md** - Remote deployment, API integrations, troubleshooting

## After Making Changes

1. **Update core files**: README.md, AI-PROMPT.md, TODO.md as needed
2. **Mark TODO.md progress**: (in progress) for active, (completed dd/mm/yy) for finished
3. **Test changes**: Use JSON-RPC test commands before finishing
4. **Update file headers**: Add new references if introducing technical concepts

## Communication Style

- **Professional but approachable**: Technical accuracy with beginner-friendly explanations
- **Concise and actionable**: Get to the point, provide next steps
- **Problem-solving focused**: Address the "why" behind decisions
- **Organized presentation**: Use clear headers, lists, code blocks effectively

## Related Projects

- **Remote version**: <https://github.com/Deejpotter/my-mcp-server-remote> (for cloud deployment)
- **MCP Protocol**: <https://modelcontextprotocol.io/>
- **Context7**: <https://github.com/upstash/context7> (documentation search integration)
