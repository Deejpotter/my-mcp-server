"""
File operation tools for MCP server
Updated: 26/10/25
By: Daniel Potter

Enhanced file operations with comprehensive security validation and path traversal protection.
All file operations now use hardened security functions and validate paths against allowlists.

Security Enhancements:
- Path traversal attack prevention through canonical path resolution
- Directory access validation against security allowlists
- Forbidden path checking to protect system directories
- Enhanced error handling with security context

References:
OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
MCP Security Guidelines: https://modelcontextprotocol.io/docs/concepts/security
"""

import glob
import os
from pathlib import Path
from typing import Any, Dict, List

from mcp.types import Tool, TextContent
import mcp.types as types

from ..utils.security import (
    safe_read_file,
    safe_write_file,
    validate_file_path,
    get_security_config,
)


def get_file_operation_tools() -> List[Tool]:
    """
    Get all file operation tool definitions with enhanced security documentation.

    All file operations now include comprehensive security validation:
    - Path traversal protection through canonical path resolution
    - Directory allowlist validation prevents unauthorized access
    - System path protection blocks access to sensitive directories
    - File size limits prevent memory exhaustion attacks

    Returns:
        List of Tool definitions with security-enhanced descriptions
    """
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
    ]


async def handle_file_operations(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """
    Handle file operation tool calls with comprehensive security validation.

    All operations now include:
    - Pre-operation path validation against security policies
    - Enhanced error reporting with security context
    - Path traversal attack prevention
    - System directory access protection

    Args:
        name: Tool name to execute
        arguments: Tool arguments with validated paths

    Returns:
        List of TextContent with operation results and security status
    """

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
            # Security-related errors (path validation, forbidden access)
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
            # Security-related errors (path validation, forbidden access)
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
                    # Silently skip files that fail security validation

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
            # Security-related errors
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

    else:
        return [
            types.TextContent(
                type="text", text=f"❌ Unknown file operation tool: {name}"
            )
        ]
