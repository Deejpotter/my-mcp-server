"""
Updated: 26/10/25
By: Daniel Potter

Tool registry - Central place to collect all tools and their handlers.
This module provides a centralized routing system for MCP tool calls, organizing tools
by category (file operations, system commands, search, API integrations).

References:
MCP Tools Pattern: https://modelcontextprotocol.io/docs/concepts/tools
"""

from typing import Any, Dict, List
import time
import logging

from mcp.types import Tool, TextContent
import mcp.types as types

from .tools.file_operations import get_file_operation_tools, handle_file_operations
from .tools.system_commands import get_system_command_tools, handle_system_commands
from .tools.search_tools import get_search_tools, handle_search_tools
from .tools.web_search import get_web_search_tools, handle_web_search
from .integrations.external_apis import get_integration_tools, handle_integration_tools
from .utils.performance import get_tracker

# Configure logger
logger = logging.getLogger(__name__)


def get_all_tools() -> List[Tool]:
    """Get all available tools from all modules"""
    tools = []
    tools.extend(get_file_operation_tools())
    tools.extend(get_system_command_tools())
    tools.extend(get_search_tools())
    tools.extend(get_web_search_tools())
    tools.extend(get_integration_tools())
    return tools


async def handle_tool_call(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """
    Route tool calls to appropriate handlers with performance tracking.

    Automatically tracks execution time and logs metrics for all tool calls.
    """
    tracker = get_tracker()
    start_time = time.perf_counter()
    success = True

    try:
        # File operations
        if name in [
            "read_file",
            "write_file",
            "list_files",
            "validate_path",
            "batch_file_check",
        ]:
            return await handle_file_operations(name, arguments)

        # System commands
        elif name in [
            "run_command",
            "git_command",
            "system_stats",
            "security_status",
            "performance_metrics",
        ]:
            return await handle_system_commands(name, arguments)

        # Search tools
        elif name in ["search_files", "fetch_url", "search_docs_online"]:
            return await handle_search_tools(name, arguments)

        # Web search tools
        elif name in ["web_search", "web_search_news"]:
            return await handle_web_search(name, arguments)

        # External API integrations
        elif name in [
            "clickup_get_tasks",
            "clickup_create_task",
            "clickup_get_workspaces",
            "bookstack_create_page",
            "bookstack_get_page",
            "bookstack_search",
            "github_search_code",
            "context7_search",
        ]:
            return await handle_integration_tools(name, arguments)

        else:
            success = False
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        success = False
        raise
    finally:
        # Record performance metrics
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000
        tracker.record_execution(name, duration_ms, success)

        # Log slow operations (>1000ms)
        if duration_ms > 1000:
            logger.warning(f"Slow tool execution: {name} took {duration_ms:.2f}ms")
        else:
            logger.debug(f"Tool executed: {name} in {duration_ms:.2f}ms")
