"""
Search and fetch tools for MCP server
Updated: 26/10/25
By: Daniel Potter

Enhanced search and fetch operations with comprehensive security validation and path protection.
All file search operations now use hardened security functions and validate paths against allowlists.

Security Enhancements:
- Path traversal attack prevention through canonical path resolution
- Directory access validation against security allowlists
- URL validation and sanitization for fetch operations
- File access permission validation before reading
- Enhanced error handling with security context

References:
OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
URL Security Best Practices: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
"""

from pathlib import Path
from typing import Any, Dict, List
import re

import httpx
from mcp.types import Tool, TextContent
import mcp.types as types

from ..utils.security import safe_read_file, validate_file_path, get_security_config


def get_search_tools() -> List[Tool]:
    """
    Get all search and fetch tool definitions with enhanced security documentation.

    All search operations now include comprehensive security validation:
    - Path traversal protection through canonical path resolution
    - Directory allowlist validation prevents unauthorized access
    - URL validation and sanitization for fetch operations
    - File access permission validation before reading

    Returns:
        List of Tool definitions with security-enhanced descriptions
    """
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
    ]


def _validate_url_security(url: str) -> Dict[str, Any]:
    """
    Validate URL for security before fetching.

    Prevents Server-Side Request Forgery (SSRF) attacks by blocking:
    - Local network addresses (localhost, 127.0.0.1, private IPs)
    - File:// and other non-HTTP schemes
    - URLs with suspicious patterns

    Args:
        url: URL to validate

    Returns:
        Dict with validation results
    """
    try:
        # Basic URL format validation
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
            r"10\.\d+\.\d+\.\d+",  # 10.0.0.0/8
            r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+",  # 172.16.0.0/12
            r"192\.168\.\d+\.\d+",  # 192.168.0.0/16
            r"169\.254\.\d+\.\d+",  # 169.254.0.0/16 (link-local)
        ]

        url_lower = url.lower()
        for pattern in blocked_patterns:
            if re.search(pattern, url_lower):
                return {
                    "valid": False,
                    "error": f"Access to local/private networks is blocked for security",
                }

        return {"valid": True, "url": url}

    except Exception as e:
        return {"valid": False, "error": f"URL validation error: {str(e)}"}


async def handle_search_tools(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """
    Handle search and fetch tool calls with comprehensive security validation.

    All operations now include:
    - Pre-operation path/URL validation against security policies
    - Enhanced error reporting with security context
    - Resource limits to prevent exhaustion attacks
    - Path traversal and SSRF attack prevention

    Args:
        name: Tool name to execute
        arguments: Tool arguments with validated paths and URLs

    Returns:
        List of TextContent with operation results and security status
    """

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
                        continue  # Skip files that fail security validation

                    try:
                        # Use secure file reading with size limits
                        content = safe_read_file(
                            str(file), max_size=1024 * 1024
                        )  # 1MB limit
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

                        files_processed += 1

                        # Limit total results to prevent resource exhaustion
                        if len(matches) >= max_results:
                            break

                    except ValueError as e:
                        # Security-related errors (file too large, forbidden access)
                        files_skipped_security += 1
                        continue
                    except Exception:
                        # Other file reading errors (permissions, encoding, etc.)
                        continue

            # Format results with security context
            if matches:
                result = f"🔍 Search results for '{query}' in {directory} (🔒 SECURITY VALIDATED):\n\n"
                for match in matches:
                    result += f"📄 File: {match['file']}\n"
                    for line in match["lines"]:
                        result += f"  {line}\n"
                    result += "\n"

                # Add processing summary
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
            # Security-related errors
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

            # Validate timeout limits for security
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
                # Stream response to check size before loading all content
                async with client.stream("GET", url) as response:
                    # Check response size before downloading
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_size:
                        return [
                            types.TextContent(
                                type="text",
                                text=f"🔒 Security Error: Content too large ({content_length} bytes, max: {max_size})",
                            )
                        ]

                    # Read content with size limit
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

                # Format response with security confirmation
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

    else:
        return [types.TextContent(type="text", text=f"❌ Unknown search tool: {name}")]
