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
@click.option("--transport", default="stdio", help="Transport type: stdio or http")
@click.option("--host", default="127.0.0.1", help="Host to bind to (for HTTP transport)")
@click.option("--port", default=8000, help="Port to bind to (for HTTP transport)")
def main(log_level: str, transport: str, host: str, port: int):
    """Run the MCP server."""
    # Set up logging
    import logging
    logging.basicConfig(level=getattr(logging, log_level.upper()))
    
    if transport == "stdio":
        # Run stdio server (for local VS Code)
        async def run_stdio_server():
            async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
                await server.run(
                    read_stream,
                    write_stream,
                    server.create_initialization_options()
                )
        
        try:
            asyncio.run(run_stdio_server())
        except KeyboardInterrupt:
            print("\nServer stopped by user")
        except Exception as e:
            print(f"Server error: {e}", file=sys.stderr)
            sys.exit(1)
    
    elif transport == "http":
        # Run HTTP server (for Cloudflare Tunnel)
        import uvicorn
        from fastapi import FastAPI, HTTPException
        from fastapi.responses import JSONResponse
        
        app = FastAPI(
            title="My MCP Server", 
            version="0.1.0",
            description="MCP Server accessible via HTTP"
        )
        
        @app.get("/")
        async def root():
            return {"message": "My MCP Server", "version": "0.1.0", "transport": "http"}
        
        @app.get("/health")
        async def health():
            return {"status": "healthy", "server": "my-mcp-server"}
        
        @app.post("/mcp")
        async def mcp_endpoint(request: dict):
            """Handle MCP requests over HTTP"""
            try:
                # This would need proper MCP-over-HTTP implementation
                # For now, return a simple response
                return {"jsonrpc": "2.0", "id": request.get("id"), "result": {"status": "HTTP MCP not fully implemented yet"}}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        print(f"🚀 Starting HTTP MCP server on {host}:{port}")
        print(f"📡 Ready for Cloudflare Tunnel at mcp.deejpotter.com")
        print(f"🔗 Access at: http://{host}:{port}")
        
        try:
            uvicorn.run(app, host=host, port=port, log_level=log_level.lower())
        except KeyboardInterrupt:
            print("\nServer stopped by user")
        except Exception as e:
            print(f"Server error: {e}", file=sys.stderr)
            sys.exit(1)
    
    else:
        print(f"Unknown transport: {transport}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
