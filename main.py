#!/usr/bin/env python3
"""
My Personal MCP Server

This server provides practical development tools and resources for MCP clients.
It includes file system operations, git commands, process management, and more.
"""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
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


# Helper functions for file operations
def safe_read_file(file_path: str, max_size: int = 1024 * 1024) -> str:
    """Safely read a file with size limits."""
    path = Path(file_path).resolve()

    # Basic security check - don't read outside reasonable boundaries
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.stat().st_size > max_size:
        raise ValueError(
            f"File too large: {path.stat().st_size} bytes (max: {max_size})"
        )

    return path.read_text(encoding="utf-8", errors="replace")


def safe_write_file(file_path: str, content: str) -> None:
    """Safely write content to a file."""
    path = Path(file_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def run_command(command: str, cwd: str = None, timeout: int = 30) -> dict:
    """Run a shell command safely."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "command": command,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"Command timed out after {timeout} seconds",
            "command": command,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "command": command}


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
            uri="workspace://info",
            name="Workspace Information",
            description="Information about the current workspace",
            mimeType="application/json",
        ),
        Resource(
            uri="git://status",
            name="Git Status",
            description="Current git repository status",
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
            "cwd": os.getcwd(),
        }
        return json.dumps(info, indent=2)

    elif uri == "workspace://info":
        cwd = Path.cwd()
        info = {
            "workspace_path": str(cwd),
            "workspace_name": cwd.name,
            "files_count": len(list(cwd.rglob("*"))),
            "python_files": len(list(cwd.rglob("*.py"))),
            "git_repo": (cwd / ".git").exists(),
            "timestamp": datetime.now().isoformat(),
        }
        return json.dumps(info, indent=2)

    elif uri == "git://status":
        result = run_command("git status --porcelain")
        if result["success"]:
            return f"Git Status:\n{result['stdout']}\n\nErrors:\n{result['stderr']}"
        else:
            return f"Git Status Error: {result.get('error', 'Unknown error')}"

    else:
        raise ValueError(f"Unknown resource: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="read_file",
            description="Read the contents of a file",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to read",
                    },
                    "max_size": {
                        "type": "integer",
                        "description": "Maximum file size in bytes (default: 1MB)",
                        "default": 1024 * 1024,
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="write_file",
            description="Write content to a file",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to write",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file",
                    },
                },
                "required": ["file_path", "content"],
            },
        ),
        Tool(
            name="list_files",
            description="List files in a directory",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory path to list (default: current directory)",
                        "default": ".",
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern to filter files (e.g., '*.py')",
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Whether to search recursively",
                        "default": False,
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="run_command",
            description="Execute a shell command",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory (default: current directory)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 30)",
                        "default": 30,
                    },
                },
                "required": ["command"],
            },
        ),
        Tool(
            name="git_command",
            description="Execute git commands",
            inputSchema={
                "type": "object",
                "properties": {
                    "git_args": {
                        "type": "string",
                        "description": "Git command arguments (e.g., 'status', 'log --oneline', 'diff')",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Repository directory (default: current directory)",
                    },
                },
                "required": ["git_args"],
            },
        ),
        Tool(
            name="search_files",
            description="Search for text content in files",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for",
                    },
                    "directory": {
                        "type": "string",
                        "description": "Directory to search in (default: current directory)",
                        "default": ".",
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "File pattern to search (e.g., '*.py', '*.md')",
                        "default": "*",
                    },
                    "case_sensitive": {
                        "type": "boolean",
                        "description": "Whether search should be case sensitive",
                        "default": False,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="fetch_url",
            description="Fetch content from a URL",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to fetch",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Request timeout in seconds",
                        "default": 10,
                    },
                },
                "required": ["url"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Handle tool calls."""

    if name == "read_file":
        file_path = arguments.get("file_path", "")
        max_size = arguments.get("max_size", 1024 * 1024)

        try:
            content = safe_read_file(file_path, max_size)
            return [
                types.TextContent(type="text", text=f"File: {file_path}\n\n{content}")
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error reading file '{file_path}': {str(e)}"
                )
            ]

    elif name == "write_file":
        file_path = arguments.get("file_path", "")
        content = arguments.get("content", "")

        try:
            safe_write_file(file_path, content)
            return [
                types.TextContent(
                    type="text",
                    text=f"Successfully wrote {len(content)} characters to {file_path}",
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error writing file '{file_path}': {str(e)}"
                )
            ]

    elif name == "list_files":
        directory = arguments.get("directory", ".")
        pattern = arguments.get("pattern", "*")
        recursive = arguments.get("recursive", False)

        try:
            path = Path(directory).resolve()
            if recursive:
                files = list(path.rglob(pattern))
            else:
                files = list(path.glob(pattern))

            files_list = []
            for file in sorted(files):
                rel_path = file.relative_to(path) if file.is_relative_to(path) else file
                stat = file.stat()
                files_list.append(
                    {
                        "name": file.name,
                        "path": str(rel_path),
                        "type": "directory" if file.is_dir() else "file",
                        "size": stat.st_size if file.is_file() else None,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    }
                )

            result = f"Files in {directory} (pattern: {pattern}, recursive: {recursive}):\n\n"
            result += json.dumps(files_list, indent=2)
            return [types.TextContent(type="text", text=result)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error listing files in '{directory}': {str(e)}"
                )
            ]

    elif name == "run_command":
        command = arguments.get("command", "")
        cwd = arguments.get("cwd")
        timeout = arguments.get("timeout", 30)

        result = run_command(command, cwd, timeout)

        if result["success"]:
            output = f"Command: {command}\n"
            output += f"Exit Code: {result['returncode']}\n\n"
            if result["stdout"]:
                output += f"STDOUT:\n{result['stdout']}\n"
            if result["stderr"]:
                output += f"STDERR:\n{result['stderr']}\n"
        else:
            output = f"Command Failed: {command}\nError: {result['error']}"

        return [types.TextContent(type="text", text=output)]

    elif name == "git_command":
        git_args = arguments.get("git_args", "")
        cwd = arguments.get("cwd")

        command = f"git {git_args}"
        result = run_command(command, cwd)

        if result["success"]:
            output = f"Git Command: {command}\n"
            output += f"Exit Code: {result['returncode']}\n\n"
            if result["stdout"]:
                output += f"Output:\n{result['stdout']}\n"
            if result["stderr"]:
                output += f"Errors/Warnings:\n{result['stderr']}\n"
        else:
            output = f"Git Command Failed: {command}\nError: {result['error']}"

        return [types.TextContent(type="text", text=output)]

    elif name == "search_files":
        query = arguments.get("query", "")
        directory = arguments.get("directory", ".")
        file_pattern = arguments.get("file_pattern", "*")
        case_sensitive = arguments.get("case_sensitive", False)

        try:
            path = Path(directory).resolve()
            matches = []
            search_query = query if case_sensitive else query.lower()

            for file in path.rglob(file_pattern):
                if file.is_file():
                    try:
                        content = file.read_text(encoding="utf-8", errors="replace")
                        search_content = content if case_sensitive else content.lower()

                        if search_query in search_content:
                            lines = content.split("\n")
                            matching_lines = []
                            for i, line in enumerate(lines, 1):
                                check_line = line if case_sensitive else line.lower()
                                if search_query in check_line:
                                    matching_lines.append(f"{i}: {line.strip()}")

                            matches.append(
                                {
                                    "file": str(
                                        file.relative_to(path)
                                        if file.is_relative_to(path)
                                        else file
                                    ),
                                    "lines": matching_lines[
                                        :10
                                    ],  # Limit to first 10 matches per file
                                }
                            )
                    except Exception:
                        continue  # Skip files that can't be read

            if matches:
                result = f"Search results for '{query}' in {directory}:\n\n"
                for match in matches:
                    result += f"File: {match['file']}\n"
                    for line in match["lines"]:
                        result += f"  {line}\n"
                    result += "\n"
            else:
                result = f"No matches found for '{query}' in {directory}"

            return [types.TextContent(type="text", text=result)]

        except Exception as e:
            return [
                types.TextContent(type="text", text=f"Error searching files: {str(e)}")
            ]

    elif name == "fetch_url":
        url = arguments.get("url", "")
        timeout = arguments.get("timeout", 10)

        try:
            import asyncio
            import aiohttp

            async def fetch():
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as session:
                    async with session.get(url) as response:
                        content = await response.text()
                        return {
                            "status": response.status,
                            "headers": dict(response.headers),
                            "content": content[:10000],  # Limit content size
                            "content_length": len(content),
                        }

            result = await fetch()
            output = f"URL: {url}\n"
            output += f"Status: {result['status']}\n"
            output += f"Content Length: {result['content_length']} characters\n\n"
            if result["content_length"] > 10000:
                output += f"Content (first 10,000 characters):\n{result['content']}"
            else:
                output += f"Content:\n{result['content']}"

            return [types.TextContent(type="text", text=output)]

        except ImportError:
            # Fallback to httpx if aiohttp is not available
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(url)
                    content = response.text

                    output = f"URL: {url}\n"
                    output += f"Status: {response.status_code}\n"
                    output += f"Content Length: {len(content)} characters\n\n"
                    if len(content) > 10000:
                        output += (
                            f"Content (first 10,000 characters):\n{content[:10000]}"
                        )
                    else:
                        output += f"Content:\n{content}"

                    return [types.TextContent(type="text", text=output)]
            except Exception as e:
                return [
                    types.TextContent(
                        type="text", text=f"Error fetching URL '{url}': {str(e)}"
                    )
                ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error fetching URL '{url}': {str(e)}"
                )
            ]

    else:
        raise ValueError(f"Unknown tool: {name}")


@click.command()
@click.option("--log-level", default="INFO", help="Set the logging level")
@click.option("--transport", default="stdio", help="Transport type: stdio or http")
@click.option(
    "--host", default="127.0.0.1", help="Host to bind to (for HTTP transport)"
)
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
                    read_stream, write_stream, server.create_initialization_options()
                )

        try:
            asyncio.run(run_stdio_server())
        except KeyboardInterrupt:
            print("\nServer stopped by user")
        except Exception as e:
            print(f"Server error: {e}", file=sys.stderr)
            sys.exit(1)

    elif transport == "http":
        # Implement HTTP MCP server using FastAPI and MCP protocol
        import uvicorn
        from fastapi import FastAPI, HTTPException, Request
        from fastapi.responses import JSONResponse

        app = FastAPI(
            title="My MCP Server",
            version="0.1.0",
            description="MCP Server with practical development tools",
        )

        async def handle_mcp_request(request_data: dict) -> dict:
            """Handle MCP JSON-RPC requests"""
            try:
                method = request_data.get("method")
                params = request_data.get("params", {})
                request_id = request_data.get("id")

                if method == "initialize":
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {
                                "tools": {},
                                "resources": {},
                            },
                            "serverInfo": {
                                "name": "my-mcp-server",
                                "version": "0.1.0"
                            }
                        }
                    }
                
                elif method == "tools/list":
                    tools = await handle_list_tools()
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "tools": [
                                {
                                    "name": tool.name,
                                    "description": tool.description,
                                    "inputSchema": tool.inputSchema
                                } for tool in tools
                            ]
                        }
                    }
                
                elif method == "tools/call":
                    tool_name = params.get("name")
                    arguments = params.get("arguments", {})
                    
                    result = await handle_call_tool(tool_name, arguments)
                    
                    # Convert TextContent results to simple strings for HTTP response
                    content_text = ""
                    for item in result:
                        if hasattr(item, 'text'):
                            content_text += item.text
                        else:
                            content_text += str(item)
                    
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "content": [{"type": "text", "text": content_text}],
                            "isError": False
                        }
                    }
                
                elif method == "resources/list":
                    resources = await handle_list_resources()
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "resources": [
                                {
                                    "uri": resource.uri,
                                    "name": resource.name,
                                    "description": resource.description,
                                    "mimeType": resource.mimeType
                                } for resource in resources
                            ]
                        }
                    }
                
                elif method == "resources/read":
                    uri = params.get("uri")
                    content = await handle_read_resource(uri)
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "contents": [{"uri": uri, "mimeType": "text/plain", "text": content}]
                        }
                    }
                
                else:
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {method}"
                        }
                    }
                    
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": request_data.get("id"),
                    "error": {
                        "code": -32603,
                        "message": f"Internal error: {str(e)}"
                    }
                }

        @app.post("/")
        async def mcp_root(request: Request):
            """Handle MCP requests on root endpoint"""
            try:
                request_data = await request.json()
                response = await handle_mcp_request(request_data)
                return response
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @app.get("/health")
        async def health():
            return {"status": "healthy", "server": "my-mcp-server", "tools_count": len(await handle_list_tools())}

        print(f"🚀 Starting MCP HTTP server on {host}:{port}")
        print(f"📡 Ready for Cloudflare Tunnel at mcp.deejpotter.com")
        print(f"🔗 Access at: http://{host}:{port}")
        print(f"🛠️  Available tools: read_file, write_file, list_files, run_command, git_command, search_files, fetch_url")

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
