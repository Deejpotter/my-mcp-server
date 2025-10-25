# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server implementation that provides tools and resources for AI assistants and other MCP clients. The server uses stdio (standard input/output) for communication, which is the standard transport mechanism for MCP servers.

## Development Setup

**Python version**: 3.12 or higher required

**Install dependencies**:
```bash
pip install -e .
```

**Run the server**:
```bash
# Option 1: Using installed script
my-mcp-server

# Option 2: Direct Python execution
python main.py

# Option 3: With custom log level
my-mcp-server --log-level DEBUG
```

**Testing**: No test framework is currently configured.

## Architecture

### MCP Server Pattern

The codebase follows the standard MCP server pattern using the `mcp` Python library:

1. **Server Instance**: Created using `Server("my-mcp-server")` in main.py:30
2. **Handler Registration**: Uses decorators to register handlers:
   - `@server.list_resources()` - Lists available resources (main.py:33)
   - `@server.read_resource()` - Reads specific resources (main.py:52)
   - `@server.list_tools()` - Lists available tools (main.py:74)
   - `@server.call_tool()` - Handles tool execution (main.py:123)
3. **Server Execution**: Runs via `mcp.server.stdio.stdio_server()` context manager with async streams

### Adding New Capabilities

**To add a new tool**:
1. Add tool definition in `handle_list_tools()` with name, description, and inputSchema
2. Add implementation case in `handle_call_tool()` matching the tool name
3. Return list of TextContent, ImageContent, or EmbeddedResource objects

**To add a new resource**:
1. Add resource definition in `handle_list_resources()` with URI, name, description, and mimeType
2. Add implementation case in `handle_read_resource()` matching the URI
3. Return string content (JSON, plain text, etc.)

### Current Capabilities

**Tools**: `echo`, `calculate` (with safety validation), `current_time`
**Resources**: `system://info`, `datetime://current`

## Configuration for Claude Desktop

Users connect this server to Claude Desktop via MCP configuration with:
```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "python",
      "args": ["/absolute/path/to/main.py"],
      "env": {}
    }
  }
}
```
