#!/usr/bin/env python3
"""
Secure MCP Server with Authentication and Authorization

This enhanced version includes:
- API Key authentication
- Role-based access control
- Rate limiting
- Audit logging
- Secure file access
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Dict, List, Optional, Set

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

# Security Configuration
SECURITY_CONFIG = {
    "api_keys": {
        # Generate these with: python -c "import secrets; print(secrets.token_urlsafe(32))"
        "admin": os.getenv("MCP_ADMIN_KEY", "your-admin-key-here"),
        "user": os.getenv("MCP_USER_KEY", "your-user-key-here"),
        "public": os.getenv("MCP_PUBLIC_KEY", "your-public-key-here"),
    },
    "roles": {
        "admin": ["system", "personal", "files", "public"],
        "user": ["personal", "public"],
        "public": ["public"],
    },
    "rate_limits": {
        "admin": {"requests_per_minute": 1000},
        "user": {"requests_per_minute": 100},
        "public": {"requests_per_minute": 20},
    },
    "secure_directories": {
        "personal": os.path.expanduser("~/secure_mcp_data"),
        "files": os.path.expanduser("~/Documents"),
    },
}

# Rate limiting storage
rate_limit_storage = {}

# Audit log
audit_logger = logging.getLogger("mcp_audit")
audit_handler = logging.FileHandler("mcp_audit.log")
audit_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
)
audit_logger.addHandler(audit_handler)
audit_logger.setLevel(logging.INFO)


class SecurityContext:
    def __init__(self, api_key: Optional[str] = None, client_ip: str = "unknown"):
        self.api_key = api_key
        self.client_ip = client_ip
        self.role = self._determine_role()
        self.permissions = SECURITY_CONFIG["roles"].get(self.role, [])

    def _determine_role(self) -> str:
        """Determine user role based on API key."""
        if not self.api_key:
            return "public"

        for role, key in SECURITY_CONFIG["api_keys"].items():
            if hmac.compare_digest(self.api_key, key):
                return role

        return "public"

    def has_permission(self, resource_type: str) -> bool:
        """Check if user has permission for resource type."""
        return resource_type in self.permissions

    def check_rate_limit(self) -> bool:
        """Check if user is within rate limits."""
        now = time.time()
        minute_key = f"{self.client_ip}:{self.role}:{int(now // 60)}"

        if minute_key not in rate_limit_storage:
            rate_limit_storage[minute_key] = 0

        rate_limit_storage[minute_key] += 1
        limit = SECURITY_CONFIG["rate_limits"][self.role]["requests_per_minute"]

        # Clean old entries
        cutoff = int((now - 120) // 60)  # Keep last 2 minutes
        keys_to_remove = [
            k for k in rate_limit_storage.keys() if int(k.split(":")[-1]) < cutoff
        ]
        for key in keys_to_remove:
            del rate_limit_storage[key]

        return rate_limit_storage[minute_key] <= limit


def require_permission(resource_type: str):
    """Decorator to require specific permissions."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # In a real implementation, you'd get context from request headers
            context = getattr(wrapper, "_security_context", SecurityContext())

            # Check rate limit
            if not context.check_rate_limit():
                audit_logger.warning(
                    f"Rate limit exceeded for {context.client_ip} ({context.role})"
                )
                raise Exception("Rate limit exceeded")

            # Check permissions
            if not context.has_permission(resource_type):
                audit_logger.warning(
                    f"Permission denied for {context.client_ip} ({context.role}) accessing {resource_type}"
                )
                raise Exception(f"Permission denied for {resource_type}")

            # Log access
            audit_logger.info(
                f"Access granted: {context.client_ip} ({context.role}) -> {resource_type}"
            )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Create the MCP server instance
server = Server("my-secure-mcp-server")


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available resources based on permissions."""
    # This would be enhanced to filter based on user permissions
    resources = []

    # Public resources (always available)
    resources.extend(
        [
            Resource(
                uri="public://info",
                name="Public Information",
                description="Public system information",
                mimeType="application/json",
            ),
            Resource(
                uri="public://time",
                name="Current Time",
                description="Current date and time",
                mimeType="text/plain",
            ),
        ]
    )

    # Add secured resources based on context
    # This would be enhanced with proper context passing
    context = SecurityContext()  # Placeholder

    if context.has_permission("personal"):
        resources.append(
            Resource(
                uri="personal://notes",
                name="Personal Notes",
                description="Access to personal notes and data",
                mimeType="text/plain",
            )
        )

    if context.has_permission("files"):
        resources.append(
            Resource(
                uri="files://documents",
                name="Document Access",
                description="Access to personal documents",
                mimeType="application/octet-stream",
            )
        )

    if context.has_permission("system"):
        resources.append(
            Resource(
                uri="system://admin",
                name="System Administration",
                description="System administration tools",
                mimeType="application/json",
            )
        )

    return resources


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read a specific resource with security checks."""
    resource_type = uri.split("://")[0]

    if resource_type == "public":
        return await _handle_public_resource(uri)
    elif resource_type == "personal":
        return await _handle_personal_resource(uri)
    elif resource_type == "files":
        return await _handle_file_resource(uri)
    elif resource_type == "system":
        return await _handle_system_resource(uri)
    else:
        raise ValueError(f"Unknown resource type: {resource_type}")


@require_permission("public")
async def _handle_public_resource(uri: str) -> str:
    """Handle public resources."""
    if uri == "public://info":
        import platform

        info = {
            "server": "my-secure-mcp-server",
            "version": "1.0.0-secure",
            "platform": platform.system(),
            "timestamp": datetime.now().isoformat(),
        }
        return json.dumps(info, indent=2)
    elif uri == "public://time":
        return f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    else:
        raise ValueError(f"Unknown public resource: {uri}")


@require_permission("personal")
async def _handle_personal_resource(uri: str) -> str:
    """Handle personal resources."""
    if uri == "personal://notes":
        # Read from secure personal directory
        notes_file = os.path.join(
            SECURITY_CONFIG["secure_directories"]["personal"], "notes.txt"
        )
        try:
            with open(notes_file, "r") as f:
                return f.read()
        except FileNotFoundError:
            return "No personal notes found."
    else:
        raise ValueError(f"Unknown personal resource: {uri}")


@require_permission("files")
async def _handle_file_resource(uri: str) -> str:
    """Handle file resources."""
    # Implement secure file access with path validation
    if uri == "files://documents":
        docs_dir = SECURITY_CONFIG["secure_directories"]["files"]
        try:
            files = os.listdir(docs_dir)
            return f"Documents available: {', '.join(files[:10])}"  # Limit listing
        except OSError:
            return "Documents directory not accessible."
    else:
        raise ValueError(f"Unknown file resource: {uri}")


@require_permission("system")
async def _handle_system_resource(uri: str) -> str:
    """Handle system resources."""
    if uri == "system://admin":
        import psutil

        info = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage("/").percent,
        }
        return json.dumps(info, indent=2)
    else:
        raise ValueError(f"Unknown system resource: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools based on permissions."""
    tools = []
    context = SecurityContext()  # Placeholder

    # Public tools
    if context.has_permission("public"):
        tools.extend(
            [
                Tool(
                    name="echo",
                    description="Echo back a message",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "Message to echo",
                            }
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
        )

    # Personal tools
    if context.has_permission("personal"):
        tools.append(
            Tool(
                name="personal_search",
                description="Search personal data",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"],
                },
            )
        )

    # File tools
    if context.has_permission("files"):
        tools.append(
            Tool(
                name="file_search",
                description="Search files securely",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "File to search for",
                        }
                    },
                    "required": ["filename"],
                },
            )
        )

    # System tools
    if context.has_permission("system"):
        tools.append(
            Tool(
                name="system_status",
                description="Get system status",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            )
        )

    return tools


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent]:
    """Handle tool calls with security checks."""
    context = SecurityContext()  # Placeholder

    if name == "echo" and context.has_permission("public"):
        message = arguments.get("message", "")
        return [types.TextContent(type="text", text=f"Echo: {message}")]

    elif name == "current_time" and context.has_permission("public"):
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return [types.TextContent(type="text", text=f"Current time: {current_time}")]

    elif name == "personal_search" and context.has_permission("personal"):
        query = arguments.get("query", "")
        # Implement secure personal data search
        result = (
            f"Personal search for '{query}' - results would be filtered by permissions"
        )
        return [types.TextContent(type="text", text=result)]

    elif name == "file_search" and context.has_permission("files"):
        filename = arguments.get("filename", "")
        # Implement secure file search with path validation
        result = (
            f"File search for '{filename}' - results would be filtered by permissions"
        )
        return [types.TextContent(type="text", text=result)]

    elif name == "system_status" and context.has_permission("system"):
        # Only available to admin users
        try:
            import psutil

            status = {
                "cpu": f"{psutil.cpu_percent()}%",
                "memory": f"{psutil.virtual_memory().percent}%",
                "disk": f"{psutil.disk_usage('/').percent}%",
            }
            result = f"System Status: {json.dumps(status)}"
            return [types.TextContent(type="text", text=result)]
        except ImportError:
            return [
                types.TextContent(type="text", text="System monitoring not available")
            ]

    else:
        audit_logger.warning(
            f"Unauthorized tool access attempt: {name} by {context.role}"
        )
        raise ValueError(f"Tool '{name}' not available or permission denied")


# Rest of the server code (HTTP setup, etc.) would be similar to original
# but with security middleware to extract API keys from headers

if __name__ == "__main__":
    print("🔐 Secure MCP Server")
    print("Configure your API keys via environment variables:")
    print("  MCP_ADMIN_KEY=your-admin-key")
    print("  MCP_USER_KEY=your-user-key")
    print("  MCP_PUBLIC_KEY=your-public-key")
