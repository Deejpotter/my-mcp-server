#!/usr/bin/env python3
"""
My Personal MCP Server

This server provides example tools and resources that can be used by MCP clients.
It demonstrates basic MCP server functionality including tools and resources.
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Any, Sequence

import click
import httpx
from mcp.server import Server
from mcp.types import (
    Resource,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel,
)
import mcp.server.stdio
import mcp.types as types


# Create the MCP server instance
server = Server("my-mcp-server")


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available resources."""
    return [
        Resource(
            uri="system://info",
            name="System Information",
            description="Current system information and status",
            mimeType="application/json",
        ),
        Resource(
            uri="datetime://current",
            name="Current Date/Time",
            description="Current date and time information",
            mimeType="text/plain",
        ),
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read a specific resource."""
    if uri == "system://info":
        import platform

        info = {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "server_name": "my-mcp-server",
            "server_version": "0.1.0",
            "timestamp": datetime.now().isoformat(),
        }
        return json.dumps(info, indent=2)

    elif uri == "datetime://current":
        return f"Current date and time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    else:
        raise ValueError(f"Unknown resource: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="echo",
            description="Echo back the provided message",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The message to echo back",
                    }
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="calculate",
            description="Perform basic arithmetic calculations",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')",
                    }
                },
                "required": ["expression"],
            },
        ),
        Tool(
            name="current_time",
            description="Get the current date and time",
            inputSchema={
                "type": "object",
                "properties": {
                    "format": {
                        "type": "string",
                        "description": "Optional datetime format string (default: '%Y-%m-%d %H:%M:%S')",
                    }
                },
                "required": [],
            },
        ),
        Tool(
            name="search_docs",
            description="Search documentation using Context7",
            inputSchema={
                "type": "object",
                "properties": {
                    "library": {
                        "type": "string",
                        "description": "Library name to search (e.g., 'react', 'typescript')",
                    },
                    "query": {
                        "type": "string",
                        "description": "Search query for documentation",
                    },
                },
                "required": ["library", "query"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Handle tool calls."""
    if name == "echo":
        message = arguments.get("message", "")
        return [types.TextContent(type="text", text=f"Echo: {message}")]

    elif name == "calculate":
        expression = arguments.get("expression", "")
        try:
            # Basic safety check - only allow simple mathematical expressions
            allowed_chars = set("0123456789+-*/.()")
            if not all(c in allowed_chars or c.isspace() for c in expression):
                raise ValueError("Expression contains invalid characters")

            result = eval(expression)
            return [
                types.TextContent(type="text", text=f"Result: {expression} = {result}")
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error calculating '{expression}': {str(e)}"
                )
            ]

    elif name == "current_time":
        format_str = arguments.get("format", "%Y-%m-%d %H:%M:%S")
        try:
            current_time = datetime.now().strftime(format_str)
            return [
                types.TextContent(type="text", text=f"Current time: {current_time}")
            ]
        except Exception as e:
            return [
                types.TextContent(type="text", text=f"Error formatting time: {str(e)}")
            ]

    elif name == "search_docs":
        library = arguments.get("library", "")
        query = arguments.get("query", "")
        try:
            result = f"Documentation search for '{query}' in {library} library"
            return [types.TextContent(type="text", text=f"Search Results: {result}")]
        except Exception as e:
            return [
                types.TextContent(type="text", text=f"Error searching docs: {str(e)}")
            ]

    else:
        raise ValueError(f"Unknown tool: {name}")


@click.command()
@click.option("--log-level", default="INFO", help="Set the logging level")
def main(log_level: str):
    """Run the MCP server."""
    # Set up logging
    import logging

    logging.basicConfig(level=getattr(logging, log_level.upper()))

    # Run the server
    async def run_server():
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream, write_stream, server.create_initialization_options()
            )

    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
