"""
Updated: 29/10/25
By: Daniel Potter

All MCP server tools consolidated into a single file for easier maintenance and navigation.
Includes file operations, system commands, search tools, and web search functionality.

Security Features:
- Path traversal attack prevention through canonical path resolution
- Command injection prevention through allowlist validation
- SSRF protection for URL fetching
- Environment variable filtering to prevent credential exposure
- File size limits to prevent memory exhaustion

References:
MCP Tools Pattern: https://modelcontextprotocol.io/docs/concepts/tools
OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
CWE-78 Command Injection: https://cwe.mitre.org/data/definitions/78.html
DuckDuckGo Search: https://github.com/deedy5/ddgs
"""

import glob
import os
import re
import logging
from pathlib import Path
from typing import Any, Dict, List

import httpx
from mcp.types import Tool, TextContent
import mcp.types as types

from .utils.security import (
    safe_read_file,
    safe_write_file,
    validate_file_path,
    run_command,
    secure_run_command,
    get_security_config,
)

logger = logging.getLogger(__name__)


# ============================================================================
# TOOL DEFINITIONS - All tools registered with MCP
# ============================================================================


def get_all_tools() -> List[Tool]:
    """
    Get all available MCP tools across all categories.

    Tools are organized by function:
    - File Operations: read_file, write_file, list_files, validate_path, batch_file_check
    - System Commands: run_command, git_command, system_stats, security_status, performance_metrics
    - Search Tools: search_files, fetch_url, search_docs_online
    - Web Search: web_search, web_search_news

    Returns:
        List of all Tool definitions with schemas
    """
    tools = []

    # File operation tools
    tools.extend(_get_file_tools())

    # System command tools
    tools.extend(_get_system_tools())

    # Search and fetch tools
    tools.extend(_get_search_tools())

    # Web search tools
    tools.extend(_get_web_search_tools())

    return tools


def _get_file_tools() -> List[Tool]:
    """File operation tool definitions with security documentation."""
    return [
        Tool(
            name="read_file",
            description="Read the contents of a file with comprehensive security validation. "
            "Validates file paths against security allowlists and prevents path traversal attacks. "
            "Enforces file size limits to prevent memory exhaustion.",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to read (validated for security)",
                    },
                    "max_size": {
                        "type": "integer",
                        "description": "Maximum file size in bytes (default: 1MB, protects against DoS)",
                        "default": 1024 * 1024,
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="write_file",
            description="Write content to a file with security path validation. "
            "Validates destination paths against security allowlists and prevents "
            "writing to protected system directories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to write (validated for security)",
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
            description="List files in a directory with security path validation. "
            "Validates directory paths against security allowlists and prevents "
            "listing protected system directories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory path to list (default: current directory, validated for security)",
                        "default": ".",
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern to filter files (e.g., '*.py')",
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Whether to search recursively (limited to allowed directories)",
                        "default": False,
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="validate_path",
            description="Validate a file path against security policies without performing operations. "
            "Useful for checking path safety before performing file operations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to validate for security",
                    },
                    "operation": {
                        "type": "string",
                        "description": "Intended operation: 'read', 'write', or 'list'",
                        "default": "read",
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="batch_file_check",
            description="Validate multiple files at once for syntax errors, security issues, and basic linting. "
            "Supports Python files (.py) with syntax checking. "
            "Returns a comprehensive report with validation status for each file.",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of file paths to validate (absolute or relative paths)",
                    },
                    "check_syntax": {
                        "type": "boolean",
                        "description": "Check for syntax errors (default: true)",
                        "default": True,
                    },
                    "check_security": {
                        "type": "boolean",
                        "description": "Check for security issues (path validation) (default: true)",
                        "default": True,
                    },
                    "max_file_size": {
                        "type": "integer",
                        "description": "Maximum file size in bytes to process (default: 1MB)",
                        "default": 1048576,
                    },
                },
                "required": ["file_paths"],
            },
        ),
    ]


def _get_system_tools() -> List[Tool]:
    """System command tool definitions with security documentation."""
    return [
        Tool(
            name="run_command",
            description="Execute a shell command with comprehensive security validation. "
            "Commands are validated against an allowlist to prevent injection attacks. "
            "Only explicitly permitted commands and arguments are allowed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute (validated against security allowlist)",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory (validated for security, default: current directory)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 30, max: 300 for security)",
                        "default": 30,
                    },
                    "allow_dangerous": {
                        "type": "boolean",
                        "description": "Allow execution with reduced security checks (USE WITH EXTREME CAUTION)",
                        "default": False,
                    },
                },
                "required": ["command"],
            },
        ),
        Tool(
            name="git_command",
            description="Execute git commands with security validation. "
            "Git operations are validated to ensure only safe git commands "
            "and arguments are executed in allowed directories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "git_args": {
                        "type": "string",
                        "description": "Git command arguments (e.g., 'status', 'log --oneline', 'diff') - validated for security",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Repository directory (validated for security, default: current directory)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 60 for git operations)",
                        "default": 60,
                    },
                },
                "required": ["git_args"],
            },
        ),
        Tool(
            name="system_stats",
            description="Monitor system resource usage including CPU, memory, disk, and network statistics. "
            "Provides real-time system performance metrics using psutil library. "
            "Requires psutil package to be installed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "interval": {
                        "type": "number",
                        "description": "CPU measurement interval in seconds (default: 1.0)",
                        "default": 1.0,
                    },
                    "per_cpu": {
                        "type": "boolean",
                        "description": "Show per-CPU statistics (default: false)",
                        "default": False,
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="security_status",
            description="Display current security configuration and validation status. "
            "Shows allowlisted commands, security settings, and validation policies.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="performance_metrics",
            description="Get performance metrics and execution time statistics for MCP tools. "
            "Tracks total calls, success/failure rates, and execution times (min/max/avg). "
            "Useful for identifying slow operations and monitoring tool usage patterns.",
            inputSchema={
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Specific tool name to get metrics for (optional, omit for summary of all tools)",
                    },
                },
                "required": [],
            },
        ),
    ]


def _get_search_tools() -> List[Tool]:
    """Search and fetch tool definitions with security documentation."""
    return [
        Tool(
            name="search_files",
            description="Search for text content in files with comprehensive security validation. "
            "Validates all file paths against security allowlists and prevents "
            "unauthorized access to system directories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for",
                    },
                    "directory": {
                        "type": "string",
                        "description": "Directory to search in (validated for security, default: current directory)",
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
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of matching files to return (default: 50, prevents resource exhaustion)",
                        "default": 50,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="fetch_url",
            description="Fetch content from a URL with security validation and size limits. "
            "Validates URLs and enforces content size limits to prevent resource exhaustion.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to fetch (validated for security)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Request timeout in seconds (default: 10, max: 60 for security)",
                        "default": 10,
                    },
                    "max_size": {
                        "type": "integer",
                        "description": "Maximum content size in bytes (default: 1MB for protection)",
                        "default": 1024 * 1024,
                    },
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="search_docs_online",
            description="Search online documentation from multiple sources (MDN, Stack Overflow, GitHub, DevDocs). "
            "Provides aggregated results from various documentation platforms with security validation.",
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
                        "description": "Maximum number of results to return per source (default: 5)",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
    ]


def _get_web_search_tools() -> List[Tool]:
    """Web search tool definitions using DuckDuckGo."""
    return [
        Tool(
            name="web_search",
            description="Search the web using DuckDuckGo for general information, blog posts, articles, "
            "and online discussions. Returns title, URL, and description for each result. "
            "Use this to find recent information, opinions, tutorials, or any web content.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (supports operators like 'site:', 'filetype:', etc.)",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 10, max: 50)",
                        "default": 10,
                    },
                    "region": {
                        "type": "string",
                        "description": "Region code for localized results (e.g., 'us-en', 'uk-en', 'wt-wt' for worldwide)",
                        "default": "wt-wt",
                    },
                    "time_limit": {
                        "type": "string",
                        "description": "Time filter: 'd' (day), 'w' (week), 'm' (month), 'y' (year), or null for all time",
                        "default": None,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="web_search_news",
            description="Search for recent news articles and blog posts using DuckDuckGo News. "
            "Ideal for finding breaking news, recent developments, or timely discussions. "
            "Returns article title, URL, summary, publication date, and source.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "News search query",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of articles to return (default: 10, max: 50)",
                        "default": 10,
                    },
                    "region": {
                        "type": "string",
                        "description": "Region code for localized news (e.g., 'us-en', 'uk-en', 'wt-wt')",
                        "default": "wt-wt",
                    },
                    "time_limit": {
                        "type": "string",
                        "description": "Time filter: 'd' (day), 'w' (week), 'm' (month), or null for all time",
                        "default": "w",
                    },
                },
                "required": ["query"],
            },
        ),
    ]


# ============================================================================
# TOOL HANDLERS - Route and execute tool calls
# ============================================================================


async def handle_tool_call(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """
    Route tool calls to appropriate handlers.

    This is the main dispatcher that routes incoming tool calls to their
    specific implementation functions based on the tool name.

    Args:
        name: Tool name to execute
        arguments: Tool arguments dictionary

    Returns:
        List of TextContent with operation results
    """
    # File operations
    if name in [
        "read_file",
        "write_file",
        "list_files",
        "validate_path",
        "batch_file_check",
    ]:
        return await _handle_file_operations(name, arguments)

    # System commands
    elif name in [
        "run_command",
        "git_command",
        "system_stats",
        "security_status",
        "performance_metrics",
    ]:
        return await _handle_system_commands(name, arguments)

    # Search tools
    elif name in ["search_files", "fetch_url", "search_docs_online"]:
        return await _handle_search_tools(name, arguments)

    # Web search tools
    elif name in ["web_search", "web_search_news"]:
        return await _handle_web_search(name, arguments)

    else:
        return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


# ============================================================================
# FILE OPERATIONS HANDLERS
# ============================================================================


async def _handle_file_operations(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle file operation tool calls with comprehensive security validation."""

    if name == "read_file":
        try:
            file_path = arguments.get("file_path", "")
            max_size = arguments.get("max_size", 1024 * 1024)

            if not file_path:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: file_path is required for read operation",
                    )
                ]

            # Pre-validate path for security before attempting read
            path_validation = validate_file_path(file_path, "read")
            if not path_validation["valid"]:
                security_errors = "; ".join(path_validation["checks"])
                return [
                    types.TextContent(
                        type="text",
                        text=f"🔒 Security Error: Cannot read file '{file_path}' - {security_errors}",
                    )
                ]

            # Perform secure file read with hardened function
            content = safe_read_file(file_path, max_size)

            # Success response with security confirmation
            return [
                types.TextContent(
                    type="text",
                    text=f"📖 File read successfully (security validated)\n\n{content}",
                )
            ]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error reading file: {str(e)}"
                )
            ]
        except FileNotFoundError as e:
            return [types.TextContent(type="text", text=f"📁 File not found: {str(e)}")]
        except Exception as e:
            return [
                types.TextContent(type="text", text=f"❌ Error reading file: {str(e)}")
            ]

    elif name == "write_file":
        try:
            file_path = arguments.get("file_path", "")
            content = arguments.get("content", "")

            if not file_path:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: file_path is required for write operation",
                    )
                ]

            # Pre-validate path for security before attempting write
            path_validation = validate_file_path(file_path, "write")
            if not path_validation["valid"]:
                security_errors = "; ".join(path_validation["checks"])
                return [
                    types.TextContent(
                        type="text",
                        text=f"🔒 Security Error: Cannot write to '{file_path}' - {security_errors}",
                    )
                ]

            # Perform secure file write with hardened function
            safe_write_file(file_path, content)

            # Success response with security confirmation
            return [
                types.TextContent(
                    type="text",
                    text=f"✅ File written successfully (security validated): {file_path}",
                )
            ]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error writing file: {str(e)}"
                )
            ]
        except PermissionError as e:
            return [
                types.TextContent(type="text", text=f"🔐 Permission Error: {str(e)}")
            ]
        except Exception as e:
            return [
                types.TextContent(type="text", text=f"❌ Error writing file: {str(e)}")
            ]

    elif name == "list_files":
        try:
            directory = arguments.get("directory", ".")
            pattern = arguments.get("pattern", "*")
            recursive = arguments.get("recursive", False)

            # Pre-validate directory path for security
            path_validation = validate_file_path(directory, "read")
            if not path_validation["valid"]:
                security_errors = "; ".join(path_validation["checks"])
                return [
                    types.TextContent(
                        type="text",
                        text=f"🔒 Security Error: Cannot list directory '{directory}' - {security_errors}",
                    )
                ]

            base_path = Path(directory).resolve()
            if not base_path.exists():
                return [
                    types.TextContent(
                        type="text", text=f"📁 Directory not found: {directory}"
                    )
                ]

            if not base_path.is_dir():
                return [
                    types.TextContent(
                        type="text", text=f"❌ Path is not a directory: {directory}"
                    )
                ]

            # Secure file listing with path validation
            if recursive:
                search_pattern = str(base_path / "**" / pattern)
                files = glob.glob(search_pattern, recursive=True)
            else:
                search_pattern = str(base_path / pattern)
                files = glob.glob(search_pattern)

            # Filter out directories and validate each file path for security
            validated_files = []
            for file_path in files:
                if os.path.isfile(file_path):
                    # Additional security check for each file
                    file_validation = validate_file_path(file_path, "read")
                    if file_validation["valid"]:
                        validated_files.append(file_path)

            validated_files.sort()

            if validated_files:
                file_list = "\n".join(
                    f"📄 {os.path.relpath(f, directory)}" for f in validated_files
                )
                return [
                    types.TextContent(
                        type="text",
                        text=f"📂 Files in {directory} (security validated):\n{file_list}",
                    )
                ]
            else:
                return [
                    types.TextContent(
                        type="text",
                        text=f"📭 No accessible files found matching pattern '{pattern}' in {directory}",
                    )
                ]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error listing files: {str(e)}"
                )
            ]
        except Exception as e:
            return [
                types.TextContent(type="text", text=f"❌ Error listing files: {str(e)}")
            ]

    elif name == "validate_path":
        try:
            file_path = arguments.get("file_path", "")
            operation = arguments.get("operation", "read")

            if not file_path:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: file_path is required for validation",
                    )
                ]

            # Perform comprehensive path validation
            validation_result = validate_file_path(file_path, operation)

            if validation_result["valid"]:
                return [
                    types.TextContent(
                        type="text",
                        text=f"✅ Path validation PASSED for '{file_path}'\n"
                        f"🔒 Operation: {operation}\n"
                        f"📍 Resolved path: {validation_result['path']}\n"
                        f"✓ Checks: {'; '.join(validation_result['checks'])}",
                    )
                ]
            else:
                return [
                    types.TextContent(
                        type="text",
                        text=f"❌ Path validation FAILED for '{file_path}'\n"
                        f"🔒 Operation: {operation}\n"
                        f"❌ Issues: {'; '.join(validation_result['checks'])}",
                    )
                ]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error validating path: {str(e)}"
                )
            ]

    elif name == "batch_file_check":
        try:
            file_paths = arguments.get("file_paths", [])
            check_syntax = arguments.get("check_syntax", True)
            check_security = arguments.get("check_security", True)
            max_file_size = arguments.get("max_file_size", 1048576)

            if not file_paths:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: file_paths is required (provide list of files to check)",
                    )
                ]

            results = []
            passed_count = 0
            failed_count = 0

            for file_path in file_paths:
                file_result = {"path": file_path, "status": "✅ PASS", "issues": []}

                # Security check
                if check_security:
                    validation = validate_file_path(file_path, "read")
                    if not validation["valid"]:
                        file_result["status"] = "❌ FAIL"
                        file_result["issues"].append(
                            f"Security: {'; '.join(validation['checks'])}"
                        )

                # File existence and size check
                try:
                    if not os.path.exists(file_path):
                        file_result["status"] = "❌ FAIL"
                        file_result["issues"].append("File not found")
                        results.append(file_result)
                        failed_count += 1
                        continue

                    file_size = os.path.getsize(file_path)
                    if file_size > max_file_size:
                        file_result["status"] = "⚠️ SKIP"
                        file_result["issues"].append(
                            f"File too large ({file_size} bytes > {max_file_size} bytes)"
                        )
                        results.append(file_result)
                        continue

                except Exception as e:
                    file_result["status"] = "❌ FAIL"
                    file_result["issues"].append(f"Access error: {str(e)}")
                    results.append(file_result)
                    failed_count += 1
                    continue

                # Syntax check for Python files
                if check_syntax and file_path.endswith(".py"):
                    try:
                        file_content = safe_read_file(file_path, max_file_size)
                        compile(file_content, file_path, "exec")
                        file_result["issues"].append("Syntax: OK")
                    except SyntaxError as e:
                        file_result["status"] = "❌ FAIL"
                        file_result["issues"].append(
                            f"Syntax error line {e.lineno}: {e.msg}"
                        )
                    except Exception as e:
                        file_result["status"] = "❌ FAIL"
                        file_result["issues"].append(f"Syntax check error: {str(e)}")

                results.append(file_result)

                if file_result["status"] == "✅ PASS":
                    passed_count += 1
                elif file_result["status"] == "❌ FAIL":
                    failed_count += 1

            # Format output
            output = f"Batch File Check Results\n"
            output += f"{'=' * 60}\n"
            output += f"Total Files: {len(file_paths)} | ✅ Passed: {passed_count} | ❌ Failed: {failed_count}\n"
            output += f"{'=' * 60}\n\n"

            for result in results:
                output += f"{result['status']} {result['path']}\n"
                if result["issues"]:
                    for issue in result["issues"]:
                        output += f"  • {issue}\n"
                output += "\n"

            return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error in batch file check: {str(e)}"
                )
            ]

    else:
        return [
            types.TextContent(
                type="text", text=f"❌ Unknown file operation tool: {name}"
            )
        ]


# ============================================================================
# SYSTEM COMMANDS HANDLERS
# ============================================================================


async def _handle_system_commands(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle system command tool calls with comprehensive security validation."""

    if name == "run_command":
        try:
            command = arguments.get("command", "")
            cwd = arguments.get("cwd")
            timeout = arguments.get("timeout", 30)
            allow_dangerous = arguments.get("allow_dangerous", False)

            if not command:
                return [
                    types.TextContent(
                        type="text", text="❌ Error: command is required for execution"
                    )
                ]

            # Validate working directory if provided
            if cwd:
                path_validation = validate_file_path(cwd, "read")
                if not path_validation["valid"]:
                    security_errors = "; ".join(path_validation["checks"])
                    return [
                        types.TextContent(
                            type="text",
                            text=f"🔒 Security Error: Invalid working directory '{cwd}' - {security_errors}",
                        )
                    ]

            # Execute command with appropriate security level
            if allow_dangerous:
                result = secure_run_command(
                    command, cwd or os.getcwd(), timeout, allow_dangerous=True
                )
                security_status = "⚠️ SECURITY REDUCED"
            else:
                result = run_command(command, cwd or os.getcwd(), timeout)
                security_status = "🔒 SECURITY VALIDATED"

            # Format response with security context
            if result["success"]:
                output = f"✅ Command executed successfully ({security_status})\n"
                output += f"📝 Command: {result['command']}\n"

                if "security_check" in result:
                    output += f"🔍 Security Check: {result['security_check']}\n"

                if "command_validated" in result:
                    output += f"✅ Validated Command: {result['command_validated']}\n"

                if result.get("stdout"):
                    output += f"📤 Output:\n{result['stdout']}"

                if result.get("stderr"):
                    output += f"⚠️ Stderr:\n{result['stderr']}"

                output += f"\n🔢 Return code: {result['returncode']}"

                if allow_dangerous and "warning" in result:
                    output += f"\n⚠️ Security Warning: {result['warning']}"

                return [types.TextContent(type="text", text=output)]
            else:
                error_output = f"❌ Command failed ({security_status})\n"
                error_output += f"📝 Command: {result['command']}\n"
                error_output += f"💥 Error: {result['error']}\n"

                if "security_check" in result:
                    error_output += f"🔍 Security Check: {result['security_check']}"

                return [types.TextContent(type="text", text=error_output)]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error executing command: {str(e)}"
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error executing command: {str(e)}"
                )
            ]

    elif name == "git_command":
        try:
            git_args = arguments.get("git_args", "")
            cwd = arguments.get("cwd")
            timeout = arguments.get("timeout", 60)

            if not git_args:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: git_args is required for git operations",
                    )
                ]

            # Validate working directory if provided
            if cwd:
                path_validation = validate_file_path(cwd, "read")
                if not path_validation["valid"]:
                    security_errors = "; ".join(path_validation["checks"])
                    return [
                        types.TextContent(
                            type="text",
                            text=f"🔒 Security Error: Invalid git directory '{cwd}' - {security_errors}",
                        )
                    ]

            # Construct and validate the full git command
            git_command = f"git {git_args}"
            result = run_command(git_command, cwd or os.getcwd(), timeout)

            # Format response with security context
            if result["success"]:
                output = (
                    f"✅ Git command executed successfully (🔒 SECURITY VALIDATED)\n"
                )
                output += f"📝 Command: {result['command']}\n"

                if "security_check" in result:
                    output += f"🔍 Security Check: {result['security_check']}\n"

                if "command_validated" in result:
                    output += f"✅ Validated Command: {result['command_validated']}\n"

                if result.get("stdout"):
                    output += f"📤 Output:\n{result['stdout']}"

                if result.get("stderr"):
                    output += f"⚠️ Stderr:\n{result['stderr']}"

                output += f"\n🔢 Return code: {result['returncode']}"
                return [types.TextContent(type="text", text=output)]
            else:
                error_output = f"❌ Git command failed (🔒 SECURITY VALIDATED)\n"
                error_output += f"📝 Command: {result['command']}\n"
                error_output += f"💥 Error: {result['error']}\n"

                if "security_check" in result:
                    error_output += f"🔍 Security Check: {result['security_check']}"

                return [types.TextContent(type="text", text=error_output)]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text",
                    text=f"🔒 Security Error executing git command: {str(e)}",
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error executing git command: {str(e)}"
                )
            ]

    elif name == "system_stats":
        try:
            # Check if psutil is installed
            try:
                import psutil
            except ImportError:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: psutil library is not installed.\n\n"
                        "Install it with: pip install psutil\n"
                        "or: pip install psutil",
                    )
                ]

            interval = arguments.get("interval", 1.0)
            per_cpu = arguments.get("per_cpu", False)

            output = "📊 **System Statistics**\n\n"

            # CPU Statistics
            output += "### 🖥️  CPU Usage\n"
            cpu_percent = psutil.cpu_percent(interval=interval, percpu=per_cpu)
            if per_cpu:
                output += f"Overall: {psutil.cpu_percent(interval=0)}%\n"
                for i, percent in enumerate(cpu_percent):
                    output += f"  CPU {i}: {percent}%\n"
            else:
                output += f"  {cpu_percent}%\n"

            cpu_count_logical = psutil.cpu_count(logical=True)
            cpu_count_physical = psutil.cpu_count(logical=False)
            output += f"  Logical CPUs: {cpu_count_logical}\n"
            output += f"  Physical CPUs: {cpu_count_physical}\n\n"

            # Memory Statistics
            output += "### 💾 Memory Usage\n"
            mem = psutil.virtual_memory()
            output += f"  Total: {mem.total / (1024**3):.2f} GB\n"
            output += f"  Available: {mem.available / (1024**3):.2f} GB\n"
            output += f"  Used: {mem.used / (1024**3):.2f} GB ({mem.percent}%)\n"
            output += f"  Free: {mem.free / (1024**3):.2f} GB\n\n"

            # Swap Memory
            swap = psutil.swap_memory()
            output += "### 🔄 Swap Memory\n"
            output += f"  Total: {swap.total / (1024**3):.2f} GB\n"
            output += f"  Used: {swap.used / (1024**3):.2f} GB ({swap.percent}%)\n"
            output += f"  Free: {swap.free / (1024**3):.2f} GB\n\n"

            # Disk Statistics
            output += "### 💿 Disk Usage\n"
            partitions = psutil.disk_partitions()
            for partition in partitions:
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    output += f"  {partition.device} ({partition.mountpoint}):\n"
                    output += f"    Total: {usage.total / (1024**3):.2f} GB\n"
                    output += f"    Used: {usage.used / (1024**3):.2f} GB ({usage.percent}%)\n"
                    output += f"    Free: {usage.free / (1024**3):.2f} GB\n"
                except PermissionError:
                    output += f"  {partition.device}: Permission Denied\n"

            output += "\n"

            # Network Statistics
            output += "### 🌐 Network I/O\n"
            net_io = psutil.net_io_counters()
            output += f"  Bytes Sent: {net_io.bytes_sent / (1024**2):.2f} MB\n"
            output += f"  Bytes Received: {net_io.bytes_recv / (1024**2):.2f} MB\n"
            output += f"  Packets Sent: {net_io.packets_sent:,}\n"
            output += f"  Packets Received: {net_io.packets_recv:,}\n"

            return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error getting system stats: {str(e)}"
                )
            ]

    elif name == "security_status":
        try:
            # Get current security configuration
            security_config = get_security_config()

            status_output = "🔒 MCP Server Security Status\n"
            status_output += "=" * 40 + "\n\n"

            status_output += (
                f"🛡️ Security Version: {security_config['security_version']}\n"
            )
            status_output += f"🔐 Hardening Enabled: {'✅ YES' if security_config['hardening_enabled'] else '❌ NO'}\n\n"

            status_output += "📋 Security Features:\n"
            status_output += f"  • Command Allowlist: {'✅ Active' if security_config['command_allowlist_active'] else '❌ Disabled'}\n"
            status_output += f"  • Path Validation: {'✅ Active' if security_config['path_validation_active'] else '❌ Disabled'}\n"
            status_output += f"  • Environment Filtering: {'✅ Active' if security_config['environment_filtering_active'] else '❌ Disabled'}\n\n"

            status_output += "📊 Configuration Summary:\n"
            status_output += f"  • Allowed Commands: {len(security_config['allowed_commands'])} commands\n"
            status_output += f"  • Allowed Directories: {security_config['allowed_directories_count']} paths\n"
            status_output += f"  • Forbidden Paths: {security_config['forbidden_paths_count']} protected locations\n"
            status_output += f"  • Sensitive Patterns: {security_config['sensitive_patterns_count']} credential filters\n\n"

            status_output += "✅ Allowed Commands:\n"
            for cmd in security_config["allowed_commands"]:
                status_output += f"  • {cmd}\n"

            return [types.TextContent(type="text", text=status_output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error retrieving security status: {str(e)}"
                )
            ]

    elif name == "performance_metrics":
        try:
            from .utils.performance import get_tracker

            tracker = get_tracker()
            tool_name = arguments.get("tool_name")

            if tool_name:
                # Get metrics for specific tool
                metrics = tracker.get_metrics(tool_name)
                if not metrics:
                    return [
                        types.TextContent(
                            type="text",
                            text=f"No performance data available for tool: {tool_name}",
                        )
                    ]

                output = f"Performance Metrics for {tool_name}:\n"
                output += f"  Total Calls: {metrics['total_calls']}\n"
                output += f"  Successful: {metrics['successful_calls']}\n"
                output += f"  Failed: {metrics['failed_calls']}\n"
                output += f"  Avg Time: {metrics.get('avg_time_ms', 0):.2f}ms\n"
                output += f"  Min Time: {metrics['min_time_ms']:.2f}ms\n"
                output += f"  Max Time: {metrics['max_time_ms']:.2f}ms\n"
                output += f"  Last Called: {metrics['last_called']}\n"

                return [types.TextContent(type="text", text=output)]
            else:
                # Get summary of all tools
                summary = tracker.get_summary()
                return [types.TextContent(type="text", text=summary)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text",
                    text=f"❌ Error retrieving performance metrics: {str(e)}",
                )
            ]

    else:
        return [
            types.TextContent(
                type="text", text=f"❌ Unknown system command tool: {name}"
            )
        ]


# ============================================================================
# SEARCH TOOLS HANDLERS
# ============================================================================


def _validate_url_security(url: str) -> Dict[str, Any]:
    """
    Validate URL for security before fetching.

    Prevents Server-Side Request Forgery (SSRF) attacks by blocking:
    - Local network addresses (localhost, 127.0.0.1, private IPs)
    - File:// and other non-HTTP schemes
    - URLs with suspicious patterns
    """
    try:
        if not url or not isinstance(url, str):
            return {"valid": False, "error": "Invalid URL format"}

        # Ensure URL uses safe protocols
        if not url.lower().startswith(("http://", "https://")):
            return {
                "valid": False,
                "error": "Only HTTP and HTTPS protocols are allowed",
            }

        # Block localhost and local network access (SSRF prevention)
        blocked_patterns = [
            r"localhost",
            r"127\.0\.0\.1",
            r"0\.0\.0\.0",
            r"10\.\d+\.\d+\.\d+",
            r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+",
            r"192\.168\.\d+\.\d+",
            r"169\.254\.\d+\.\d+",
        ]

        url_lower = url.lower()
        for pattern in blocked_patterns:
            if re.search(pattern, url_lower):
                return {
                    "valid": False,
                    "error": "Access to local/private networks is blocked for security",
                }

        return {"valid": True, "url": url}

    except Exception as e:
        return {"valid": False, "error": f"URL validation error: {str(e)}"}


async def _handle_search_tools(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle search and fetch tool calls with comprehensive security validation."""

    if name == "search_files":
        query = arguments.get("query", "")
        directory = arguments.get("directory", ".")
        file_pattern = arguments.get("file_pattern", "*")
        case_sensitive = arguments.get("case_sensitive", False)
        max_results = arguments.get("max_results", 50)

        try:
            if not query:
                return [
                    types.TextContent(
                        type="text", text="❌ Error: search query is required"
                    )
                ]

            # Validate search directory for security
            path_validation = validate_file_path(directory, "read")
            if not path_validation["valid"]:
                security_errors = "; ".join(path_validation["checks"])
                return [
                    types.TextContent(
                        type="text",
                        text=f"🔒 Security Error: Cannot search directory '{directory}' - {security_errors}",
                    )
                ]

            path = Path(directory).resolve()
            if not path.exists():
                return [
                    types.TextContent(
                        type="text", text=f"📁 Directory not found: {directory}"
                    )
                ]

            if not path.is_dir():
                return [
                    types.TextContent(
                        type="text", text=f"❌ Path is not a directory: {directory}"
                    )
                ]

            matches = []
            search_query = query if case_sensitive else query.lower()
            files_processed = 0
            files_skipped_security = 0

            # Secure file search with validation
            for file in path.rglob(file_pattern):
                if file.is_file():
                    # Security validation for each file
                    file_validation = validate_file_path(str(file), "read")
                    if not file_validation["valid"]:
                        files_skipped_security += 1
                        continue

                    try:
                        # Use secure file reading with size limits
                        content = safe_read_file(str(file), max_size=1024 * 1024)
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
                                    "lines": matching_lines[:10],
                                }
                            )

                        files_processed += 1

                        if len(matches) >= max_results:
                            break

                    except ValueError:
                        files_skipped_security += 1
                        continue
                    except Exception:
                        continue

            # Format results with security context
            if matches:
                result = f"🔍 Search results for '{query}' in {directory} (🔒 SECURITY VALIDATED):\n\n"
                for match in matches:
                    result += f"📄 File: {match['file']}\n"
                    for line in match["lines"]:
                        result += f"  {line}\n"
                    result += "\n"

                result += f"📊 Summary: {len(matches)} files with matches, {files_processed} files processed"
                if files_skipped_security > 0:
                    result += f", {files_skipped_security} files skipped (security)"
            else:
                result = f"📭 No matches found for '{query}' in {directory}\n"
                result += f"📊 Summary: {files_processed} files processed"
                if files_skipped_security > 0:
                    result += f", {files_skipped_security} files skipped (security)"

            return [types.TextContent(type="text", text=result)]

        except ValueError as e:
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error searching files: {str(e)}"
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error searching files: {str(e)}"
                )
            ]

    elif name == "fetch_url":
        url = arguments.get("url", "")
        timeout = arguments.get("timeout", 10)
        max_size = arguments.get("max_size", 1024 * 1024)

        try:
            if not url:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: URL is required for fetch operation",
                    )
                ]

            if timeout > 60:
                return [
                    types.TextContent(
                        type="text",
                        text="🔒 Security Error: Timeout too long (max: 60 seconds)",
                    )
                ]

            # Validate URL for security (SSRF prevention)
            url_validation = _validate_url_security(url)
            if not url_validation["valid"]:
                return [
                    types.TextContent(
                        type="text",
                        text=f"🔒 Security Error: Invalid URL - {url_validation['error']}",
                    )
                ]

            # Perform secure HTTP request with limits
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("GET", url) as response:
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_size:
                        return [
                            types.TextContent(
                                type="text",
                                text=f"🔒 Security Error: Content too large ({content_length} bytes, max: {max_size})",
                            )
                        ]

                    content_chunks = []
                    total_size = 0

                    async for chunk in response.aiter_bytes():
                        total_size += len(chunk)
                        if total_size > max_size:
                            return [
                                types.TextContent(
                                    type="text",
                                    text=f"🔒 Security Error: Content exceeded size limit ({total_size} bytes, max: {max_size})",
                                )
                            ]
                        content_chunks.append(chunk)

                    content = b"".join(content_chunks).decode("utf-8", errors="replace")

                output = f"🌐 URL fetch successful (🔒 SECURITY VALIDATED)\n"
                output += f"📍 URL: {url}\n"
                output += f"📊 Status: {response.status_code}\n"
                output += f"📏 Content Length: {len(content)} characters\n"
                output += (
                    f"🔒 Security: SSRF protection enabled, size limits enforced\n\n"
                )

                if len(content) > 10000:
                    output += (
                        f"📄 Content (first 10,000 characters):\n{content[:10000]}\n\n"
                    )
                    output += f"... (content truncated for display, {len(content) - 10000} more characters)"
                else:
                    output += f"📄 Content:\n{content}"

                return [types.TextContent(type="text", text=output)]

        except httpx.TimeoutException:
            return [
                types.TextContent(
                    type="text",
                    text=f"⏱️ Request timeout: URL '{url}' took longer than {timeout} seconds",
                )
            ]
        except httpx.RequestError as e:
            return [
                types.TextContent(
                    type="text", text=f"🌐 Network error fetching URL '{url}': {str(e)}"
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error fetching URL '{url}': {str(e)}"
                )
            ]

    elif name == "search_docs_online":
        query = arguments.get("query", "")
        source = arguments.get("source", "all")
        limit = arguments.get("limit", 5)

        try:
            if not query:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: query is required for documentation search",
                    )
                ]

            output = f"🔍 **Documentation Search Results for: '{query}'**\n\n"
            results_found = False

            # MDN Web Docs search
            if source in ["all", "mdn"]:
                try:
                    mdn_url = f"https://developer.mozilla.org/api/v1/search?q={query}&locale=en-US"
                    async with httpx.AsyncClient(timeout=10) as client:
                        response = await client.get(mdn_url)
                        if response.status_code == 200:
                            data = response.json()
                            documents = data.get("documents", [])[:limit]
                            if documents:
                                output += "### 📘 MDN Web Docs\n"
                                for doc in documents:
                                    output += f"- **{doc.get('title', 'Untitled')}**\n"
                                    output += f"  {doc.get('summary', 'No summary available')}\n"
                                    output += f"  🔗 https://developer.mozilla.org{doc.get('mdn_url', '')}\n\n"
                                results_found = True
                except Exception as e:
                    output += f"⚠️ MDN search error: {str(e)}\n\n"

            # Stack Overflow search
            if source in ["all", "stackoverflow"]:
                try:
                    so_query = f"site:stackoverflow.com {query}"
                    so_url = f"https://api.duckduckgo.com/?q={so_query}&format=json&no_html=1"
                    async with httpx.AsyncClient(timeout=10) as client:
                        response = await client.get(so_url)
                        if response.status_code == 200:
                            data = response.json()
                            related_topics = data.get("RelatedTopics", [])[:limit]
                            if related_topics:
                                output += "### 💬 Stack Overflow\n"
                                for topic in related_topics:
                                    if isinstance(topic, dict) and "Text" in topic:
                                        output += f"- {topic.get('Text', '')}\n"
                                        if "FirstURL" in topic:
                                            output += (
                                                f"  🔗 {topic.get('FirstURL', '')}\n"
                                            )
                                        output += "\n"
                                results_found = True
                except Exception as e:
                    output += f"⚠️ Stack Overflow search error: {str(e)}\n\n"

            # GitHub search
            if source in ["all", "github"]:
                try:
                    github_url = f"https://api.github.com/search/repositories?q={query}&sort=stars&per_page={limit}"
                    headers = {"Accept": "application/vnd.github.v3+json"}

                    github_token = os.getenv("GITHUB_TOKEN")
                    if github_token:
                        headers["Authorization"] = f"token {github_token}"

                    async with httpx.AsyncClient(timeout=10) as client:
                        response = await client.get(github_url, headers=headers)
                        if response.status_code == 200:
                            data = response.json()
                            items = data.get("items", [])[:limit]
                            if items:
                                output += "### 💻 GitHub Repositories\n"
                                for item in items:
                                    output += f"- **{item.get('full_name', 'Unknown')}** ⭐ {item.get('stargazers_count', 0)}\n"
                                    output += f"  {item.get('description', 'No description')}\n"
                                    output += f"  🔗 {item.get('html_url', '')}\n\n"
                                results_found = True
                        elif response.status_code == 403:
                            output += "⚠️ GitHub: Rate limit exceeded. Set GITHUB_TOKEN for higher limits.\n\n"
                except Exception as e:
                    output += f"⚠️ GitHub search error: {str(e)}\n\n"

            # DevDocs link
            if source in ["all", "devdocs"]:
                try:
                    devdocs_url = f"https://devdocs.io/search?q={query}"
                    output += f"### 📚 DevDocs\n"
                    output += f"Search DevDocs directly: {devdocs_url}\n\n"
                    results_found = True
                except Exception as e:
                    output += f"⚠️ DevDocs link error: {str(e)}\n\n"

            if not results_found:
                output += "❌ No results found. Try refining your search query.\n"

            output += f"\n💡 **Tip**: Use 'source' parameter to search specific platforms only."

            return [types.TextContent(type="text", text=output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error searching documentation: {str(e)}"
                )
            ]

    else:
        return [types.TextContent(type="text", text=f"❌ Unknown search tool: {name}")]


# ============================================================================
# WEB SEARCH HANDLERS
# ============================================================================


async def _handle_web_search(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle web search tool calls using DuckDuckGo."""

    if name == "web_search":
        return await _handle_general_web_search(arguments)
    elif name == "web_search_news":
        return await _handle_news_search(arguments)
    else:
        return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


async def _handle_general_web_search(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """Handle general web search requests using Google Search."""
    query = arguments.get("query", "")
    max_results = min(arguments.get("max_results", 10), 50)

    if not query:
        return [
            types.TextContent(type="text", text="Error: Query parameter is required")
        ]

    try:
        logger.info(
            f"Performing web search: query='{query}', max_results={max_results}"
        )

        search = GoogleSearch(
            {"q": query, "num": max_results, "api_key": os.getenv("SERPAPI_API_KEY")}
        )
        results = search.get_dict().get("organic_results", [])

        if not results:
            return [
                types.TextContent(
                    type="text", text=f"No results found for query: {query}"
                )
            ]

        formatted_results = [f"🔍 **Web Search Results for: {query}**\n"]
        formatted_results.append(f"Found {len(results)} results:\n")

        for i, result in enumerate(results, 1):
            title = result.get("title", "No title")
            url = result.get("link", "")
            snippet = result.get("snippet", "No description")

            formatted_results.append(f"\n**{i}. {title}**")
            formatted_results.append(f"🔗 {url}")
            formatted_results.append(f"📝 {snippet}\n")

        return [types.TextContent(type="text", text="\n".join(formatted_results))]

    except Exception as e:
        logger.error(f"Web search failed: {e}")
        return [
            types.TextContent(
                type="text", text=f"Error performing web search: {str(e)}"
            )
        ]


async def _handle_news_search(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle news search requests using Google News."""
    query = arguments.get("query", "")
    max_results = min(arguments.get("max_results", 10), 50)

    if not query:
        return [
            types.TextContent(type="text", text="Error: Query parameter is required")
        ]

    try:
        logger.info(
            f"Performing news search: query='{query}', max_results={max_results}"
        )

        search = GoogleSearch(
            {
                "q": query,
                "tbm": "nws",
                "num": max_results,
                "api_key": os.getenv("SERPAPI_API_KEY"),
            }
        )
        results = search.get_dict().get("news_results", [])

        if not results:
            return [
                types.TextContent(
                    type="text", text=f"No news articles found for query: {query}"
                )
            ]

        formatted_results = [f"📰 **News Search Results for: {query}**\n"]
        formatted_results.append(f"Found {len(results)} articles:\n")

        for i, result in enumerate(results, 1):
            title = result.get("title", "No title")
            url = result.get("link", "")
            snippet = result.get("snippet", "No description")
            source = result.get("source", "Unknown source")

            formatted_results.append(f"\n**{i}. {title}**")
            formatted_results.append(f"🔗 {url}")
            formatted_results.append(f"📰 {source}")
            formatted_results.append(f"📝 {snippet}\n")

        return [types.TextContent(type="text", text="\n".join(formatted_results))]

    except Exception as e:
        logger.error(f"News search failed: {e}")
        return [
            types.TextContent(
                type="text", text=f"Error performing news search: {str(e)}"
            )
        ]
