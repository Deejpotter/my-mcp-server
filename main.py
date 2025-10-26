#!/usr/bin/env python3
"""
MCP (Model Context Protocol) Server - Modular Architecture
Updated: December 2024
By: Daniel Potter

This server provides practical development tools and resources for MCP clients.
It follows MCP best practices with a modular architecture for maintainability.

MCP ARCHITECTURE OVERVIEW:
- MCP enables AI assistants (like GitHub Copilot) to call server functions securely
- This server exposes "tools" (functions) and "resources" (data sources) to AI clients
- Communication happens via JSON-RPC over stdio (local) or HTTP (remote)
- Each tool has a schema that describes its inputs - this helps the AI understand how to call it

MODULAR DESIGN:
- tools/ - Individual tool modules (file_operations, system_commands, search_tools)
- integrations/ - External API integrations (ClickUp, GitHub, Context7, etc.)
- utils/ - Shared utilities and security functions
- resources.py - MCP resource definitions and handlers
- tool_registry.py - Central tool registration and routing

References:
MCP Protocol: https://modelcontextprotocol.io/docs/concepts/tools
Context7 MCP: https://github.com/upstash/context7
HTTPx Async: https://www.python-httpx.org/async/
"""

import asyncio
import logging
import sys
from typing import Any, Sequence

import click
from dotenv import load_dotenv

# MCP Protocol imports
from mcp.server import Server
from mcp.types import Resource, Tool, TextContent
import mcp.server.stdio
import mcp.types as types

# Load environment variables
load_dotenv()

# Import the modular components
from src.tool_registry import get_all_tools, handle_tool_call
from src.resources import get_all_resources, handle_resource_read

# Configure logging to stderr (CRITICAL: Never log to stdout in MCP servers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,  # IMPORTANT: MCP servers must never write to stdout
)
logger = logging.getLogger(__name__)

# MCP Server Instance
server = Server("my-mcp-server")

"""
MCP servers use decorator-based syntax similar to Flask/FastAPI. 
The @server.list_tools() decorator registers available functions, while @server.call_tool() handles execution.
All handlers must be async functions and return appropriate content types (TextContent, etc.).

DEVELOPMENT TIPS:
- Tool names are simple strings (e.g., "read_file"), not URL paths like REST APIs
- Always return TextContent/ImageContent - never raise exceptions to the AI client
- Use descriptive tool descriptions - AI reads these to decide which tool to call
- Check VS Code Developer Tools console to debug MCP communication issues
- CRITICAL: Never use print() - it corrupts JSON-RPC. Use logger (goes to stderr)
"""


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """
    Define all available tools (functions) that AI can call.

    Tools are organized in modules:
    - File Operations: read_file, write_file, list_files
    - System Commands: run_command, git_command
    - Search Tools: search_files, fetch_url
    - External APIs: clickup_*, github_search_code, context7_search
    """
    return get_all_tools()


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any] | None
) -> Sequence[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """
    Route tool calls to appropriate handlers.

    This function routes calls to the appropriate module handlers
    based on the tool name. All tool implementations are now
    organized in separate modules for better maintainability.
    """
    if arguments is None:
        arguments = {}

    try:
        return await handle_tool_call(name, arguments)
    except ValueError as e:
        return [types.TextContent(type="text", text=str(e))]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {str(e)}")]


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """
    Define available data sources that AI can read.

    Resources provide read-only access to data:
    - system://info - Current system and Python environment details
    - workspace://info - File counts and project structure
    - git://status - Version control status
    """
    return get_all_resources()


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """
    Fetch content from a specific resource URI.

    URI routing system - each resource has a unique identifier:
    - system:// = system information and diagnostics
    - workspace:// = project files and structure analysis
    - git:// = version control operations and status
    """
    try:
        return await handle_resource_read(uri)
    except ValueError as e:
        return f"Error: {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"


# Server Entry Point and Transport Layer
@click.command()
@click.option("--log-level", default="INFO", help="Logging level")
def main(log_level: str):
    """
    MCP Server Entry Point - Local Development

    This server uses stdio transport for direct integration with VS Code/GitHub Copilot.
    The modular architecture makes it easy to maintain and extend.
    """
    # Set up logging
    import logging

    logging.basicConfig(level=getattr(logging, log_level.upper()))

    # STDIO Transport - Direct communication with VS Code/GitHub Copilot
    async def run_stdio_server():
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream, write_stream, server.create_initialization_options()
            )

    try:
        asyncio.run(run_stdio_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
