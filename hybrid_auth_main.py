#!/usr/bin/env python3
"""
Hybrid Authentication MCP Server

Supports both:
1. Cloudflare Access + Google OAuth (for browser/web)
2. API Key authentication (for CLI/Copilot)
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Any, Optional

import click
import httpx
from mcp.server import Server
from mcp.types import Resource, Tool, TextContent
import mcp.server.stdio
import mcp.types as types

# Authentication configuration
AUTH_CONFIG = {
    # API keys for CLI/Copilot access
    "api_keys": {
        "copilot": os.getenv("MCP_COPILOT_KEY", ""),
        "cli": os.getenv("MCP_CLI_KEY", ""),
        "personal": os.getenv("MCP_PERSONAL_KEY", ""),
    },
    # Cloudflare Access bypass for API keys
    "bypass_cloudflare": True,
    # Special headers for different access types
    "auth_headers": {
        "copilot": "X-MCP-Copilot-Key",
        "cli": "X-MCP-CLI-Key",
        "api": "X-API-Key",
        "bearer": "Authorization",
    },
}


def get_auth_context(headers: dict) -> dict:
    """Determine authentication context from headers"""
    context = {
        "authenticated": False,
        "method": "none",
        "user_type": "anonymous",
        "permissions": ["public"],
    }

    # Check for Cloudflare Access headers (set by Cloudflare)
    cf_access_email = headers.get("Cf-Access-Authenticated-User-Email")
    if cf_access_email:
        context.update(
            {
                "authenticated": True,
                "method": "cloudflare_access",
                "user_type": "oauth_user",
                "user_email": cf_access_email,
                "permissions": ["public", "personal", "files"],
            }
        )
        return context

    # Check for API keys
    for auth_type, header_name in AUTH_CONFIG["auth_headers"].items():
        api_key = headers.get(header_name)
        if not api_key and header_name == "Authorization":
            # Handle Bearer token format
            auth_header = headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header[7:]

        if api_key:
            # Validate against configured keys
            for key_type, valid_key in AUTH_CONFIG["api_keys"].items():
                if valid_key and api_key == valid_key:
                    permissions = ["public"]
                    if key_type in ["copilot", "cli", "personal"]:
                        permissions.extend(["personal", "files"])

                    context.update(
                        {
                            "authenticated": True,
                            "method": "api_key",
                            "user_type": key_type,
                            "api_key_type": key_type,
                            "permissions": permissions,
                        }
                    )
                    return context

    return context


# Create the MCP server instance
server = Server("my-hybrid-auth-mcp-server")


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available resources based on authentication"""
    # In a real implementation, you'd get headers from the request context
    # For now, return all resources (filtering would happen in read_resource)

    resources = [
        # Public resources (always available)
        Resource(
            uri="public://info",
            name="Public Information",
            description="Public server information",
            mimeType="application/json",
        ),
        Resource(
            uri="public://time",
            name="Current Time",
            description="Current date and time",
            mimeType="text/plain",
        ),
        # Personal resources (require authentication)
        Resource(
            uri="personal://notes",
            name="Personal Notes",
            description="Your personal notes and data",
            mimeType="text/plain",
        ),
        Resource(
            uri="files://documents",
            name="Document Access",
            description="Access to your documents",
            mimeType="application/octet-stream",
        ),
    ]

    return resources


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read a specific resource with authentication checks"""
    # In real implementation, get headers from request context
    headers = {}  # Placeholder
    auth_context = get_auth_context(headers)

    resource_type = uri.split("://")[0]

    # Public resources
    if resource_type == "public":
        if uri == "public://info":
            info = {
                "server": "my-hybrid-auth-mcp-server",
                "version": "1.0.0",
                "auth_method": auth_context["method"],
                "user_type": auth_context["user_type"],
                "timestamp": datetime.now().isoformat(),
            }
            return json.dumps(info, indent=2)
        elif uri == "public://time":
            return f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    # Protected resources
    elif resource_type in ["personal", "files"]:
        if not auth_context["authenticated"]:
            raise ValueError("Authentication required for this resource")

        if resource_type not in auth_context["permissions"]:
            raise ValueError("Insufficient permissions for this resource")

        if uri == "personal://notes":
            # Access personal data
            notes_file = os.path.expanduser("~/secure_mcp_data/notes.txt")
            try:
                with open(notes_file, "r") as f:
                    return f.read()
            except FileNotFoundError:
                return "No personal notes found. Create some at ~/secure_mcp_data/notes.txt"

        elif uri == "files://documents":
            # List documents
            docs_dir = os.path.expanduser("~/Documents")
            try:
                files = os.listdir(docs_dir)[:10]  # Limit to 10 files
                return f"Recent documents: {', '.join(files)}"
            except OSError:
                return "Documents directory not accessible"

    raise ValueError(f"Unknown or unauthorized resource: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools based on authentication"""
    # Base tools available to everyone
    tools = [
        Tool(
            name="echo",
            description="Echo back a message",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Message to echo"}
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="current_time",
            description="Get current time",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]

    # Add authenticated tools
    # (In real implementation, check auth context)
    tools.extend(
        [
            Tool(
                name="personal_search",
                description="Search your personal data (requires authentication)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"],
                },
            ),
            Tool(
                name="file_operations",
                description="File operations (requires authentication)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "description": "Operation: list, search, read",
                        },
                        "path": {
                            "type": "string",
                            "description": "File path (optional)",
                        },
                    },
                    "required": ["operation"],
                },
            ),
        ]
    )

    return tools


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent]:
    """Handle tool calls with authentication checks"""
    # Get auth context (placeholder)
    headers = {}
    auth_context = get_auth_context(headers)

    if name == "echo":
        message = arguments.get("message", "")
        return [types.TextContent(type="text", text=f"Echo: {message}")]

    elif name == "current_time":
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return [types.TextContent(type="text", text=f"Current time: {current_time}")]

    elif name == "personal_search":
        if not auth_context["authenticated"]:
            return [
                types.TextContent(type="text", text="Error: Authentication required")
            ]

        query = arguments.get("query", "")
        result = f"Personal search for '{query}' (authenticated via {auth_context['method']})"
        return [types.TextContent(type="text", text=result)]

    elif name == "file_operations":
        if not auth_context["authenticated"]:
            return [
                types.TextContent(type="text", text="Error: Authentication required")
            ]

        operation = arguments.get("operation", "")
        result = (
            f"File operation '{operation}' (authenticated via {auth_context['method']})"
        )
        return [types.TextContent(type="text", text=result)]

    else:
        raise ValueError(f"Unknown tool: {name}")


@click.command()
@click.option("--log-level", default="INFO", help="Set the logging level")
@click.option("--transport", default="stdio", help="Transport type: stdio or http")
@click.option(
    "--host", default="127.0.0.1", help="Host to bind to (for HTTP transport)"
)
@click.option("--port", default=8000, help="Port to bind to (for HTTP transport)")
@click.option(
    "--auth-mode",
    default="hybrid",
    help="Authentication mode: hybrid, api-only, cf-only",
)
def main(log_level: str, transport: str, host: str, port: int, auth_mode: str):
    """Run the hybrid authentication MCP server."""
    import logging

    logging.basicConfig(level=getattr(logging, log_level.upper()))

    print(f"🔐 Hybrid Auth MCP Server")
    print(f"Auth mode: {auth_mode}")
    print(f"Transport: {transport}")

    if transport == "stdio":
        # STDIO mode for local VS Code
        async def run_stdio_server():
            async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
                await server.run(
                    read_stream, write_stream, server.create_initialization_options()
                )

        try:
            asyncio.run(run_stdio_server())
        except KeyboardInterrupt:
            print("\nServer stopped by user")

    elif transport == "http":
        # HTTP mode for remote access
        import uvicorn
        from fastapi import FastAPI, Request, HTTPException
        from fastapi.responses import JSONResponse

        app = FastAPI(
            title="Hybrid Auth MCP Server",
            version="1.0.0",
            description="MCP Server with Cloudflare Access + API Key support",
        )

        @app.middleware("http")
        async def auth_middleware(request: Request, call_next):
            """Authentication middleware"""
            # Get authentication context
            headers = dict(request.headers)
            auth_context = get_auth_context(headers)

            # Store in request state for handlers to use
            request.state.auth_context = auth_context

            response = await call_next(request)

            # Add auth info to response headers
            response.headers["X-Auth-Method"] = auth_context["method"]
            response.headers["X-User-Type"] = auth_context["user_type"]

            return response

        @app.get("/")
        async def root(request: Request):
            auth_context = request.state.auth_context
            return {
                "message": "Hybrid Auth MCP Server",
                "version": "1.0.0",
                "auth_method": auth_context["method"],
                "authenticated": auth_context["authenticated"],
                "user_type": auth_context["user_type"],
            }

        @app.get("/health")
        async def health(request: Request):
            auth_context = request.state.auth_context
            return {
                "status": "healthy",
                "server": "hybrid-auth-mcp-server",
                "auth_method": auth_context["method"],
                "timestamp": datetime.now().isoformat(),
            }

        @app.post("/mcp")
        async def mcp_endpoint(request: Request):
            """Handle MCP requests over HTTP"""
            auth_context = request.state.auth_context

            try:
                # This would need proper MCP-over-HTTP implementation
                return {
                    "jsonrpc": "2.0",
                    "result": {
                        "status": "MCP endpoint ready",
                        "auth_method": auth_context["method"],
                        "permissions": auth_context["permissions"],
                    },
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        print(f"🚀 Starting HTTP server on {host}:{port}")
        print(f"🔗 Access at: http://{host}:{port}")
        print(f"🌐 External: https://mcp.deejpotter.com")
        print()
        print(f"📋 Authentication methods:")
        print(f"  1. Browser: Cloudflare Access + Google OAuth")
        print(f"  2. CLI: X-MCP-CLI-Key header")
        print(f"  3. Copilot: X-MCP-Copilot-Key header")
        print(f"  4. API: X-API-Key or Authorization Bearer")

        try:
            uvicorn.run(app, host=host, port=port, log_level=log_level.lower())
        except KeyboardInterrupt:
            print("\nServer stopped by user")

    else:
        print(f"Unknown transport: {transport}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
