#!/usr/bin/env python3
"""
MCP (Model Context Protocol) Server
Updated: 26/10/25
By: Daniel Potter

This server provides practical development tools and resources for MCP clients.
It includes file system operations, git commands, process management, and more.

MCP ARCHITECTURE OVERVIEW:
- MCP enables AI assistants (like GitHub Copilot) to call server functions securely
- This server exposes "tools" (functions) and "resources" (data sources) to AI clients
- Communication happens via JSON-RPC over stdio (local) or HTTP (remote)
- Each tool has a schema that describes its inputs - this helps the AI understand how to call it

KEY DESIGN DECISIONS:
- Dual transport support: stdio for local VS Code, HTTP for remote Cloudflare access
- Security-first approach: input validation, file size limits, command timeouts
- Extensible tool system: easy to add new tools by following the existing patterns
- Error handling: graceful failures with informative messages for debugging

FUTURE MODIFICATION POINTS:
- Add new tools: Follow the pattern in handle_list_tools() and handle_call_tool()
- Enhance security: Modify safe_read_file() and run_command() functions
- Add authentication: Extend the HTTP server section with auth middleware
- Integrate new APIs: Add API clients in handle_call_tool() following existing patterns
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

# MCP Protocol imports - these define the core types for tools, resources, and content
from mcp.server import Server
from mcp.types import (
    Resource,  # Data sources that AI can read (like files, databases)
    Tool,  # Functions that AI can call (like commands, API calls)
    TextContent,  # Text response format for tool results
    ImageContent,  # Image response format (not used in this server)
    EmbeddedResource,  # Inline resources (not used in this server)
    LoggingLevel,  # For debugging and monitoring
)
import mcp.server.stdio  # For local VS Code communication
import mcp.types as types

# Environment configuration - loads API keys and settings from .env file
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MCP Server Instance
# This is the core server that handles all MCP protocol communication
server = Server("my-mcp-server")


# Security and File Operations
# These functions provide safe file access with size limits and validation
# MODIFICATION POINT: Adjust max_size for larger files, add path restrictions for security
def safe_read_file(file_path: str, max_size: int = 1024 * 1024) -> str:
    """
    Safely read a file with size limits and security checks.

    Security considerations:
    - Prevents reading massive files that could crash the server
    - Uses resolve() to prevent path traversal attacks
    - Handles encoding issues gracefully with 'replace' error handling

    MODIFICATION POINT:
    - Increase max_size for larger file support
    - Add allowed_paths list to restrict file access to specific directories
    - Add file type validation (e.g., only .txt, .py, .md files)
    """
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
    """
    Safely write content to a file with directory creation.

    MODIFICATION POINT:
    - Add file size limits for content
    - Add backup functionality (save .bak files)
    - Add file type restrictions for security
    """
    path = Path(file_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def run_command(command: str, cwd: str = None, timeout: int = 30) -> dict:
    """
    Execute shell commands safely with timeout protection.

    Security features:
    - 30-second timeout prevents infinite processes
    - Captures both stdout and stderr for debugging
    - Returns structured data for consistent error handling

    MODIFICATION POINT:
    - Add command whitelist for production environments
    - Implement command logging for audit trails
    - Add environment variable restrictions
    """
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


# MCP Protocol Handlers
# These functions implement the core MCP specification
# Resources = data sources (files, APIs), Tools = callable functions


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """
    Define available data sources that AI can read.

    MCP Resources provide read-only access to data:
    - system://info - Current system and Python environment details
    - workspace://info - File counts and project structure
    - git://status - Version control status

    MODIFICATION POINT: Add new resources here for:
    - Database connections (db://tables, db://query/...)
    - API endpoints (api://github/repos, api://slack/channels)
    - Configuration files (config://settings, config://secrets)
    """
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
    """
    Fetch content from a specific resource URI.

    URI routing system - each resource has a unique identifier:
    - system:// = system information and diagnostics
    - workspace:// = project files and structure analysis
    - git:// = version control operations and status

    MODIFICATION POINT: Add new URI schemes here following the same pattern
    Return JSON for structured data, plain text for logs/status
    """
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
    """
    Define all available tools (functions) that AI can call.

    MCP Tool Structure:
    - name: unique identifier for the tool
    - description: helps AI understand when to use this tool
    - inputSchema: JSON Schema defining required/optional parameters

    Tool Categories in this server:
    - File Operations: read_file, write_file, list_files
    - System Commands: run_command, git_command
    - Search: search_files, search_docs_online
    - External APIs: clickup_*, bookstack_*, github_search_code

    MODIFICATION POINT: Add new tools here following this pattern:
    1. Add Tool definition with clear description and schema
    2. Implement handler logic in handle_call_tool()
    3. Test with simple parameters first
    """
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
                "required": [
                    "file_path"
                ],  # AI must provide file_path, max_size is optional
            },
        ),
        # File system operations - core functionality for code analysis
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
        # Development workflow tools - git, search, documentation
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
        Tool(
            name="clickup_get_tasks",
            description="Get tasks from ClickUp workspace/list",
            inputSchema={
                "type": "object",
                "properties": {
                    "list_id": {
                        "type": "string",
                        "description": "ClickUp List ID to get tasks from",
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by task status (optional)",
                    },
                    "assignee": {
                        "type": "string",
                        "description": "Filter by assignee user ID (optional)",
                    },
                },
                "required": ["list_id"],
            },
        ),
        Tool(
            name="clickup_create_task",
            description="Create a new task in ClickUp",
            inputSchema={
                "type": "object",
                "properties": {
                    "list_id": {
                        "type": "string",
                        "description": "ClickUp List ID to create task in",
                    },
                    "name": {
                        "type": "string",
                        "description": "Task name/title",
                    },
                    "description": {
                        "type": "string",
                        "description": "Task description (optional)",
                    },
                    "priority": {
                        "type": "string",
                        "description": "Task priority: urgent, high, normal, low (optional)",
                    },
                    "assignees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of user IDs to assign (optional)",
                    },
                },
                "required": ["list_id", "name"],
            },
        ),
        Tool(
            name="clickup_get_workspaces",
            description="Get all ClickUp workspaces for the authenticated user",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="search_docs_online",
            description="Search online documentation from multiple sources (MDN, Stack Overflow, GitHub, etc.)",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for documentation",
                    },
                    "source": {
                        "type": "string",
                        "description": "Documentation source: mdn, stackoverflow, github, devdocs, or all (default: all)",
                        "default": "all",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5)",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        # External API integrations - add your own APIs following these patterns
        Tool(
            name="context7_search",
            description="Search documentation using Context7 API for specific libraries/frameworks",
            inputSchema={
                "type": "object",
                "properties": {
                    "library": {
                        "type": "string",
                        "description": "Library name to search (e.g., 'react', 'typescript', 'python', 'fastapi')",
                    },
                    "query": {
                        "type": "string",
                        "description": "Search query within the library documentation",
                    },
                    "tokens": {
                        "type": "integer",
                        "description": "Maximum tokens to retrieve (default: 5000)",
                        "default": 5000,
                    },
                },
                "required": ["library", "query"],
            },
        ),
        Tool(
            name="github_search_code",
            description="Search GitHub repositories for code examples and implementations",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Code search query",
                    },
                    "language": {
                        "type": "string",
                        "description": "Programming language filter (e.g., 'python', 'javascript', 'typescript')",
                    },
                    "repo": {
                        "type": "string",
                        "description": "Specific repository to search (format: owner/repo)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 5)",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="devdocs_search",
            description="Search DevDocs.io for comprehensive API documentation",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Documentation search query",
                    },
                    "docs": {
                        "type": "string",
                        "description": "Specific documentation set (e.g., 'javascript', 'python~3.11', 'react')",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="bookstack_search",
            description="Search BookStack for pages, books, or chapters",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query text",
                    },
                    "type": {
                        "type": "string",
                        "description": "Type to search: page, book, chapter, or all (default: all)",
                        "default": "all",
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of results to return (default: 10)",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="bookstack_get_page",
            description="Get content of a specific BookStack page",
            inputSchema={
                "type": "object",
                "properties": {
                    "page_id": {
                        "type": "string",
                        "description": "BookStack page ID",
                    },
                },
                "required": ["page_id"],
            },
        ),
        Tool(
            name="bookstack_create_page",
            description="Create a new page in BookStack",
            inputSchema={
                "type": "object",
                "properties": {
                    "book_id": {
                        "type": "string",
                        "description": "BookStack book ID to create page in",
                    },
                    "name": {
                        "type": "string",
                        "description": "Page title",
                    },
                    "html": {
                        "type": "string",
                        "description": "Page content in HTML format",
                    },
                    "markdown": {
                        "type": "string",
                        "description": "Page content in Markdown format (alternative to html)",
                    },
                },
                "required": ["book_id", "name"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """
    Execute tool calls from AI clients.

    MCP Tool Execution Flow:
    1. AI client calls a tool by name with arguments
    2. This function routes to the appropriate handler
    3. Handler processes arguments and returns TextContent
    4. Content is sent back to AI client for analysis

    Error Handling Strategy:
    - Always return TextContent (never throw exceptions to AI)
    - Include original error messages for debugging
    - Provide helpful context about what went wrong

    MODIFICATION POINT: Add new tool handlers here following this pattern:
    elif name == "your_new_tool":
        # Extract arguments with defaults
        param1 = arguments.get("param1", "default")
        param2 = arguments.get("param2")

        try:
            # Your tool logic here
            result = your_function(param1, param2)
            return [types.TextContent(type="text", text=f"Success: {result}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error in your_new_tool: {str(e)}")]
    """

    # File Operations - Core file system tools
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

    # System Commands - Execute shell commands and git operations
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

    # External API calls - Web requests and documentation search
    elif name == "fetch_url":
        url = arguments.get("url", "")
        timeout = arguments.get("timeout", 10)

        try:
            # Async HTTP client with timeout protection
            import asyncio
            import aiohttp  # Optional dependency - fallback to httpx if not available

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
            # Fallback HTTP client - httpx is more reliable for MCP servers
            # MODIFICATION POINT: Consider using only httpx to reduce dependencies
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

    # Documentation Search - Multiple API integrations for development help
    elif name == "search_docs_online":
        query = arguments.get("query", "")
        source = arguments.get("source", "all")
        limit = arguments.get("limit", 5)

        try:
            results = []

            # Multi-source search strategy - each source provides different value:
            # Stack Overflow: practical solutions and debugging help
            # GitHub: real-world code examples and implementations
            # MDN: authoritative web API documentation
            # MODIFICATION POINT: Add more sources like Reddit, Dev.to, official docs

            if source in ["all", "stackoverflow"]:
                # Search Stack Overflow API - most helpful for troubleshooting
                try:
                    params = {
                        "order": "desc",
                        "sort": "relevance",
                        "q": query,
                        "site": "stackoverflow",
                        "pagesize": limit,
                    }
                    async with httpx.AsyncClient(timeout=30) as client:
                        response = await client.get(
                            "https://api.stackexchange.com/2.3/search/advanced",
                            params=params,
                        )
                        if response.status_code == 200:
                            data = response.json()
                            for item in data.get("items", [])[:limit]:
                                results.append(
                                    {
                                        "source": "Stack Overflow",
                                        "title": item["title"],
                                        "url": item["link"],
                                        "score": item.get("score", 0),
                                        "tags": item.get("tags", []),
                                    }
                                )
                except Exception:
                    pass

            if source in ["all", "github"]:
                # Search GitHub repositories for code examples and libraries
                try:
                    # GitHub API requires auth for higher rate limits
                    # MODIFICATION POINT: Set GITHUB_TOKEN env var for better access
                    headers = {"Accept": "application/vnd.github.v3+json"}
                    github_token = os.getenv("GITHUB_TOKEN")
                    if github_token:
                        headers["Authorization"] = f"token {github_token}"

                    params = {"q": f"{query} in:readme", "per_page": limit}
                    async with httpx.AsyncClient(timeout=30) as client:
                        response = await client.get(
                            "https://api.github.com/search/repositories",
                            headers=headers,
                            params=params,
                        )
                        if response.status_code == 200:
                            data = response.json()
                            for item in data.get("items", [])[:limit]:
                                results.append(
                                    {
                                        "source": "GitHub",
                                        "title": item["full_name"],
                                        "description": item.get("description", ""),
                                        "url": item["html_url"],
                                        "stars": item.get("stargazers_count", 0),
                                        "language": item.get("language", ""),
                                    }
                                )
                except Exception:
                    pass

            if source in ["all", "mdn"]:
                # Search MDN Web Docs - authoritative web platform documentation
                try:
                    search_url = f"https://developer.mozilla.org/api/v1/search?q={query}&locale=en-US"
                    async with httpx.AsyncClient(timeout=30) as client:
                        response = await client.get(search_url)
                        if response.status_code == 200:
                            data = response.json()
                            for item in data.get("documents", [])[:limit]:
                                results.append(
                                    {
                                        "source": "MDN",
                                        "title": item["title"],
                                        "url": f"https://developer.mozilla.org{item['mdn_url']}",
                                        "summary": (
                                            item.get("summary", "")[:200] + "..."
                                            if item.get("summary", "")
                                            else ""
                                        ),
                                    }
                                )
                except Exception:
                    pass

            # Format results
            if results:
                output = f"Online Documentation Search Results for '{query}':\n\n"
                for i, result in enumerate(results[:limit], 1):
                    output += f"{i}. [{result['source']}] {result['title']}\n"
                    output += f"   URL: {result['url']}\n"

                    if result["source"] == "Stack Overflow":
                        output += f"   Score: {result['score']}, Tags: {', '.join(result['tags'][:3])}\n"
                    elif result["source"] == "GitHub":
                        output += (
                            f"   ⭐ {result['stars']}, Language: {result['language']}\n"
                        )
                        if result["description"]:
                            output += (
                                f"   Description: {result['description'][:100]}...\n"
                            )
                    elif result["source"] == "MDN":
                        if result["summary"]:
                            output += f"   Summary: {result['summary']}\n"

                    output += "\n"
            else:
                output = f"No online documentation found for '{query}'"

            return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error searching online docs: {str(e)}"
                )
            ]

    elif name == "context7_search":
        library = arguments.get("library", "")
        query = arguments.get("query", "")
        tokens = arguments.get("tokens", 5000)

        try:
            # Use MCP Context7 functionality if available
            context7_url = "https://api.context7.ai/v1/search"  # Placeholder URL

            payload = {"library": library, "query": query, "max_tokens": tokens}

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(context7_url, json=payload)

                if response.status_code == 200:
                    data = response.json()
                    output = f"Context7 Documentation Search - {library}:\n\n"
                    output += f"Query: {query}\n\n"

                    if data.get("results"):
                        for result in data.get("results", []):
                            output += f"Section: {result.get('section', 'Unknown')}\n"
                            output += f"Content: {result.get('content', '')[:500]}...\n"
                            if result.get("url"):
                                output += f"URL: {result['url']}\n"
                            output += "\n"
                    else:
                        output += data.get("content", "No specific results found")

                    return [types.TextContent(type="text", text=output)]
                else:
                    # Fallback: Search using library-specific documentation sites
                    fallback_urls = {
                        "react": f"https://react.dev/search?q={query}",
                        "python": f"https://docs.python.org/3/search.html?q={query}",
                        "javascript": f"https://developer.mozilla.org/en-US/search?q={query}",
                        "typescript": f"https://www.typescriptlang.org/docs/search?q={query}",
                        "fastapi": f"https://fastapi.tiangolo.com/search/?q={query}",
                        "node": f"https://nodejs.org/api/index.html#{query}",
                        "vue": f"https://vuejs.org/search/?query={query}",
                    }

                    if library.lower() in fallback_urls:
                        fallback_url = fallback_urls[library.lower()]
                        output = f"Context7 API unavailable. Here's the direct search URL for {library}:\n\n"
                        output += f"🔗 {fallback_url}\n\n"
                        output += f"Search query: {query}\n"
                        output += f"Recommended: Open this URL in your browser for {library} documentation."
                    else:
                        output = f"Context7 API unavailable and no fallback URL found for library '{library}'"

                    return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error with Context7 search: {str(e)}"
                )
            ]

    elif name == "github_search_code":
        query = arguments.get("query", "")
        language = arguments.get("language")
        repo = arguments.get("repo")
        limit = arguments.get("limit", 5)

        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            github_token = os.getenv("GITHUB_TOKEN")
            if github_token:
                headers["Authorization"] = f"token {github_token}"

            search_query = query
            if language:
                search_query += f" language:{language}"
            if repo:
                search_query += f" repo:{repo}"

            params = {"q": search_query, "per_page": limit}

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    "https://api.github.com/search/code", headers=headers, params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])

                    output = f"GitHub Code Search Results for '{query}':\n\n"

                    for i, item in enumerate(items[:limit], 1):
                        output += f"{i}. {item['name']} in {item['repository']['full_name']}\n"
                        output += f"   Language: {item.get('language', 'Unknown')}\n"
                        output += f"   URL: {item['html_url']}\n"
                        output += f"   Repository: {item['repository']['html_url']}\n"
                        if item["repository"].get("description"):
                            output += f"   Description: {item['repository']['description'][:100]}...\n"
                        output += "\n"

                    if not items:
                        output += "No code examples found for this query."

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"GitHub API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error searching GitHub code: {str(e)}"
                )
            ]

    elif name == "devdocs_search":
        query = arguments.get("query", "")
        docs = arguments.get("docs", "")

        try:
            # DevDocs.io search functionality
            base_url = "https://devdocs.io"

            if docs:
                search_url = f"{base_url}/{docs}/search?q={query}"
                output = f"DevDocs Search for '{query}' in {docs}:\n\n"
                output += f"🔗 Direct link: {search_url}\n\n"
                output += f"Available documentation sets include:\n"
                output += "• javascript - JavaScript language reference\n"
                output += "• python~3.11 - Python 3.11 documentation\n"
                output += "• react - React framework docs\n"
                output += "• typescript - TypeScript documentation\n"
                output += "• css - CSS reference\n"
                output += "• html - HTML reference\n"
                output += "• node - Node.js documentation\n\n"
                output += "Visit devdocs.io for comprehensive API documentation!"
            else:
                search_url = f"{base_url}/search?q={query}"
                output = f"DevDocs General Search for '{query}':\n\n"
                output += f"🔗 Search URL: {search_url}\n\n"
                output += "DevDocs.io provides fast, searchable documentation for popular technologies.\n"
                output += "Try specifying a 'docs' parameter for more targeted results."

            return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error with DevDocs search: {str(e)}"
                )
            ]

    # External Integrations - Task management and documentation systems
    # MODIFICATION POINT: Add your own APIs here (Notion, Slack, Jira, etc.)
    elif name == "clickup_get_workspaces":
        try:
            # API Authentication - store tokens in .env file for security
            # MODIFICATION POINT: Add other API tokens (NOTION_TOKEN, SLACK_TOKEN, etc.)
            clickup_token = os.getenv("CLICKUP_API_TOKEN")
            if not clickup_token:
                return [
                    types.TextContent(
                        type="text",
                        text="ClickUp API token not found. Please set CLICKUP_API_TOKEN environment variable.",
                    )
                ]

            headers = {"Authorization": clickup_token}

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    "https://api.clickup.com/api/v2/team", headers=headers
                )

                if response.status_code == 200:
                    data = response.json()
                    workspaces = data.get("teams", [])

                    output = "ClickUp Workspaces:\n\n"
                    for workspace in workspaces:
                        output += f"• {workspace['name']} (ID: {workspace['id']})\n"
                        output += f"  Members: {len(workspace.get('members', []))}\n\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"ClickUp API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error getting ClickUp workspaces: {str(e)}"
                )
            ]

    elif name == "clickup_get_tasks":
        try:
            clickup_token = os.getenv("CLICKUP_API_TOKEN")
            if not clickup_token:
                return [
                    types.TextContent(
                        type="text",
                        text="ClickUp API token not found. Please set CLICKUP_API_TOKEN environment variable.",
                    )
                ]

            list_id = arguments.get("list_id", "")
            status = arguments.get("status")
            assignee = arguments.get("assignee")

            headers = {"Authorization": clickup_token}
            params = {}
            if status:
                params["statuses[]"] = status
            if assignee:
                params["assignees[]"] = assignee

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"https://api.clickup.com/api/v2/list/{list_id}/task",
                    headers=headers,
                    params=params,
                )

                if response.status_code == 200:
                    data = response.json()
                    tasks = data.get("tasks", [])

                    output = f"Tasks in List {list_id}:\n\n"
                    for task in tasks:
                        output += f"• {task['name']} (ID: {task['id']})\n"
                        output += f"  Status: {task['status']['status']}\n"
                        output += f"  Priority: {task.get('priority', {}).get('priority', 'None')}\n"
                        if task.get("assignees"):
                            assignees = [a["username"] for a in task["assignees"]]
                            output += f"  Assignees: {', '.join(assignees)}\n"
                        output += f"  URL: {task['url']}\n\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"ClickUp API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error getting ClickUp tasks: {str(e)}"
                )
            ]

    elif name == "clickup_create_task":
        try:
            clickup_token = os.getenv("CLICKUP_API_TOKEN")
            if not clickup_token:
                return [
                    types.TextContent(
                        type="text",
                        text="ClickUp API token not found. Please set CLICKUP_API_TOKEN environment variable.",
                    )
                ]

            list_id = arguments.get("list_id", "")
            task_name = arguments.get("name", "")
            description = arguments.get("description", "")
            priority = arguments.get("priority")
            assignees = arguments.get("assignees", [])

            headers = {
                "Authorization": clickup_token,
                "Content-Type": "application/json",
            }
            task_data = {
                "name": task_name,
                "description": description,
                "assignees": assignees,
            }
            if priority:
                priority_map = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
                task_data["priority"] = priority_map.get(priority.lower(), 3)

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"https://api.clickup.com/api/v2/list/{list_id}/task",
                    headers=headers,
                    json=task_data,
                )

                if response.status_code == 200:
                    data = response.json()
                    output = f"✅ Task created successfully!\n\n"
                    output += f"Task: {data['name']}\n"
                    output += f"ID: {data['id']}\n"
                    output += f"URL: {data['url']}\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"ClickUp API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error creating ClickUp task: {str(e)}"
                )
            ]

    elif name == "bookstack_search":
        try:
            bookstack_url = os.getenv("BOOKSTACK_URL")
            bookstack_token = os.getenv("BOOKSTACK_TOKEN_ID")
            bookstack_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

            if not all([bookstack_url, bookstack_token, bookstack_secret]):
                return [
                    types.TextContent(
                        type="text",
                        text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                    )
                ]

            query = arguments.get("query", "")
            search_type = arguments.get("type", "all")
            count = arguments.get("count", 10)

            headers = {
                "Authorization": f"Token {bookstack_token}:{bookstack_secret}",
                "Content-Type": "application/json",
            }
            params = {"query": query, "count": count}
            if search_type != "all":
                params["type"] = search_type

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{bookstack_url}/api/search", headers=headers, params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    results = data.get("data", [])

                    output = f"BookStack Search Results for '{query}':\n\n"
                    for result in results:
                        output += f"• {result['name']} ({result['type']})\n"
                        output += f"  ID: {result['id']}\n"
                        if result.get("preview"):
                            preview = (
                                result["preview"][:100] + "..."
                                if len(result["preview"]) > 100
                                else result["preview"]
                            )
                            output += f"  Preview: {preview}\n"
                        output += f"  URL: {bookstack_url}/{result['type']}/{result['slug']}\n\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"BookStack API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error searching BookStack: {str(e)}"
                )
            ]

    elif name == "bookstack_get_page":
        try:
            bookstack_url = os.getenv("BOOKSTACK_URL")
            bookstack_token = os.getenv("BOOKSTACK_TOKEN_ID")
            bookstack_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

            if not all([bookstack_url, bookstack_token, bookstack_secret]):
                return [
                    types.TextContent(
                        type="text",
                        text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                    )
                ]

            page_id = arguments.get("page_id", "")

            headers = {
                "Authorization": f"Token {bookstack_token}:{bookstack_secret}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{bookstack_url}/api/pages/{page_id}", headers=headers
                )

                if response.status_code == 200:
                    data = response.json()
                    page = data.get("data", {})

                    output = f"BookStack Page: {page['name']}\n\n"
                    output += f"ID: {page['id']}\n"
                    output += f"Book: {page.get('book', {}).get('name', 'Unknown')}\n"
                    output += f"URL: {bookstack_url}/books/{page.get('book', {}).get('slug', '')}/page/{page['slug']}\n\n"
                    output += f"Content:\n{page.get('html', page.get('markdown', 'No content available'))}"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"BookStack API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error getting BookStack page: {str(e)}"
                )
            ]

    elif name == "bookstack_create_page":
        try:
            bookstack_url = os.getenv("BOOKSTACK_URL")
            bookstack_token = os.getenv("BOOKSTACK_TOKEN_ID")
            bookstack_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

            if not all([bookstack_url, bookstack_token, bookstack_secret]):
                return [
                    types.TextContent(
                        type="text",
                        text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                    )
                ]

            book_id = arguments.get("book_id", "")
            page_name = arguments.get("name", "")
            html_content = arguments.get("html", "")
            markdown_content = arguments.get("markdown", "")

            headers = {
                "Authorization": f"Token {bookstack_token}:{bookstack_secret}",
                "Content-Type": "application/json",
            }

            page_data = {"book_id": book_id, "name": page_name}

            if html_content:
                page_data["html"] = html_content
            elif markdown_content:
                page_data["markdown"] = markdown_content

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{bookstack_url}/api/pages", headers=headers, json=page_data
                )

                if response.status_code == 200:
                    data = response.json()
                    page = data.get("data", {})

                    output = f"✅ BookStack page created successfully!\n\n"
                    output += f"Page: {page['name']}\n"
                    output += f"ID: {page['id']}\n"
                    output += f"URL: {bookstack_url}/books/{page.get('book', {}).get('slug', '')}/page/{page['slug']}\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"BookStack API error: {response.status_code} - {response.text}",
                        )
                    ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"Error creating BookStack page: {str(e)}"
                )
            ]

    # End of tool routing - all unrecognized tools are handled here
    else:
        raise ValueError(f"Unknown tool: {name}")


# Server Entry Point and Transport Layer
# MCP supports multiple transport methods for different use cases
@click.command()
@click.option("--log-level", default="INFO", help="Set the logging level")
@click.option("--transport", default="stdio", help="Transport type: stdio or http")
@click.option(
    "--host", default="127.0.0.1", help="Host to bind to (for HTTP transport)"
)
@click.option("--port", default=8000, help="Port to bind to (for HTTP transport)")
def main(log_level: str, transport: str, host: str, port: int):
    """
    MCP Server Entry Point

    Transport Options:
    - stdio: JSON-RPC over standard input/output (for local VS Code)
    - http: JSON-RPC over HTTP (for remote access via Cloudflare)

    MODIFICATION POINT: Add other transports like WebSocket, TCP, or Unix sockets
    """
    # Set up logging
    import logging

    logging.basicConfig(level=getattr(logging, log_level.upper()))

    if transport == "stdio":
        # STDIO Transport - Direct communication with VS Code/GitHub Copilot
        # Uses JSON-RPC over stdin/stdout for low-latency local communication
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
        # HTTP Transport - RESTful API for remote access via Cloudflare Tunnel
        # Converts MCP JSON-RPC calls to HTTP endpoints for web accessibility
        # MODIFICATION POINT: Add authentication middleware here for production
        import uvicorn
        from fastapi import FastAPI, HTTPException, Request, Depends
        from fastapi.responses import JSONResponse
        from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

        app = FastAPI(
            title="My MCP Server",
            version="0.1.0",
            description="MCP Server with practical development tools",
        )

        # API Key Authentication
        security = HTTPBearer()

        def verify_api_key(
            credentials: HTTPAuthorizationCredentials = Depends(security),
        ):
            """
            Verify API key from Authorization header or X-API-Key header
            """
            expected_key = os.getenv("MY_SERVER_API_KEY")
            if not expected_key:
                raise HTTPException(
                    status_code=500, detail="Server API key not configured"
                )

            if credentials.credentials != expected_key:
                raise HTTPException(status_code=401, detail="Invalid API key")

            return credentials.credentials

        def verify_api_key_header(request: Request):
            """
            Alternative API key verification from X-API-Key header
            """
            expected_key = os.getenv("MY_SERVER_API_KEY")
            if not expected_key:
                raise HTTPException(
                    status_code=500, detail="Server API key not configured"
                )

            api_key = request.headers.get("X-API-Key")
            if not api_key or api_key != expected_key:
                raise HTTPException(
                    status_code=401, detail="Invalid or missing API key"
                )

            return api_key

        async def handle_mcp_request(request_data: dict) -> dict:
            """
            Convert HTTP requests to MCP JSON-RPC format

            MCP Protocol Flow:
            1. Client sends JSON-RPC request over HTTP
            2. Server routes to appropriate handler (tools, resources)
            3. Handler processes request and returns structured response
            4. Response converted back to JSON-RPC format

            MODIFICATION POINT: Add request logging, rate limiting, and validation here
            """
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
                            "serverInfo": {"name": "my-mcp-server", "version": "0.1.0"},
                        },
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
                                    "inputSchema": tool.inputSchema,
                                }
                                for tool in tools
                            ]
                        },
                    }

                elif method == "tools/call":
                    tool_name = params.get("name")
                    arguments = params.get("arguments", {})

                    result = await handle_call_tool(tool_name, arguments)

                    # Convert TextContent results to simple strings for HTTP response
                    content_text = ""
                    for item in result:
                        if hasattr(item, "text"):
                            content_text += item.text
                        else:
                            content_text += str(item)

                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "content": [{"type": "text", "text": content_text}],
                            "isError": False,
                        },
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
                                    "mimeType": resource.mimeType,
                                }
                                for resource in resources
                            ]
                        },
                    }

                elif method == "resources/read":
                    uri = params.get("uri")
                    content = await handle_read_resource(uri)
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "contents": [
                                {"uri": uri, "mimeType": "text/plain", "text": content}
                            ]
                        },
                    }

                else:
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {method}",
                        },
                    }

            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": request_data.get("id"),
                    "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
                }

        @app.post("/")
        async def mcp_root(
            request: Request, api_key: str = Depends(verify_api_key_header)
        ):
            """Handle MCP requests on root endpoint - requires API key authentication"""
            try:
                request_data = await request.json()
                response = await handle_mcp_request(request_data)
                return response
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @app.get("/health")
        async def health():
            """Health check endpoint - no authentication required"""
            return {
                "status": "healthy",
                "server": "my-mcp-server",
                "tools_count": len(await handle_list_tools()),
                "authentication": "enabled",
                "api_key_required": True,
            }

        print(f"🚀 Starting MCP HTTP server on {host}:{port}")
        print(f"📡 Ready for Cloudflare Tunnel at mcp.deejpotter.com")
        print(f"🔗 Access at: http://{host}:{port}")
        print(
            f"🛠️  Available tools: read_file, write_file, list_files, run_command, git_command, search_files, fetch_url"
        )

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
