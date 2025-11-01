#!/usr/bin/env python3
"""
Updated: 01/11/25
By: Daniel Potter

Entry point for the local MCP (Model Context Protocol) server used in this
project. This file wires the protocol-level Server to the consolidated tool
registry in `src/tools.py` and to the resource handlers in `src/resources.py`.

Purpose and structure (beginner-friendly):
- Why this file exists: MCP requires a running process that exposes _tools_,
    _resources_, and _prompts_ over a transport (stdio or HTTP). `main.py` creates
    that server, registers discovery handlers (list_tools/list_resources/list_prompts),
    and routes incoming tool calls to the centralized dispatcher.
- How things connect:
    - `src/tools.py` defines the tool schemas and implements the business logic.
    - `src/resources.py` exposes read-only resources like workspace and system info.
    - `src/prompts.py` contains prompt templates and a renderer used by the
        prompt handlers below.
    - The Server instance here exposes the MCP API (list_tools, call_tool,
        list_resources, read_resource, list_prompts, get_prompt).

Quick edits you might want to make as a beginner:
- To add a new tool: implement the tool in `src/tools.py` and add its schema
    to `get_all_tools()` (no decorator needed here). The server will list it.
- To add a resource: add a resource entry to `src/resources.py` and implement
    its read handler there.
- To change prompts: edit `src/prompts.py` or add prompt files (future work).

Notes & safety:
- Never use `print()` in this process — MCP communicates over stdio and
    printing will corrupt the JSON-RPC stream. Use `logger` which writes to stderr.
- Keep side-effects in tools guarded (timeouts, path validation).

References:
- MCP Protocol: https://modelcontextprotocol.io/docs/concepts/tools
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

# Import the consolidated components
# All tools are now in a single src/tools.py file for easier maintenance
# All integrations are in src/integrations.py
# Resources remain in src/resources.py
from src.tools import get_all_tools, handle_tool_call
from src.resources import get_all_resources, handle_resource_read
from src import prompts as prompt_module

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
MCP servers use decorator-based syntax similar to Flask. 
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

    Registers all MCP tools provided by the server
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


# ---------------------------------------------------------------------------
# Prompt handlers (MCP prompt API using server decorators)
# ---------------------------------------------------------------------------


@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    """Return available prompts as MCP Prompt objects."""
    try:
        prompts = []
        for p in prompt_module.get_all_prompts():
            # Construct a minimal Prompt object. If prompt metadata includes
            # argument definitions, extend this to populate PromptArgument items.
            prompts.append(
                types.Prompt(
                    name=p.get("id") or p.get("name"),
                    description=p.get("description", ""),
                    arguments=[],
                )
            )

        return prompts
    except Exception as e:
        # Return empty list on failure to avoid raising to MCP client
        return []


@server.get_prompt()
async def handle_get_prompt(
    name: str, arguments: dict[str, str] | None
) -> types.GetPromptResult:
    """Render and return a prompt by id as a GetPromptResult.

    The implementation uses `src.prompts.render_prompt` to produce the
    rendered prompt text and wraps it into a PromptMessage/TextContent.
    """
    try:
        params = arguments or {}
        rendered = prompt_module.render_prompt(name, **params)

        return types.GetPromptResult(
            description=f"Rendered prompt: {name}",
            messages=[
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(type="text", text=rendered),
                )
            ],
        )
    except KeyError:
        raise ValueError(f"Unknown prompt: {name}")
    except Exception as e:
        raise ValueError(f"Error rendering prompt: {e}")


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
