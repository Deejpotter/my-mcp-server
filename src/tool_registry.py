"""
Tool registry - Central place to collect all tools and their handlers
"""

from typing import Any, Dict, List

from mcp.types import Tool, TextContent
import mcp.types as types

from .tools.file_operations import get_file_operation_tools, handle_file_operations
from .tools.system_commands import get_system_command_tools, handle_system_commands
from .tools.search_tools import get_search_tools, handle_search_tools
from .integrations.external_apis import get_integration_tools, handle_integration_tools


def get_all_tools() -> List[Tool]:
    """Get all available tools from all modules"""
    tools = []
    tools.extend(get_file_operation_tools())
    tools.extend(get_system_command_tools())
    tools.extend(get_search_tools())
    tools.extend(get_integration_tools())
    return tools


async def handle_tool_call(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Route tool calls to appropriate handlers"""

    # File operations
    if name in ["read_file", "write_file", "list_files"]:
        return await handle_file_operations(name, arguments)

    # System commands
    elif name in ["run_command", "git_command"]:
        return await handle_system_commands(name, arguments)

    # Search tools
    elif name in ["search_files", "fetch_url"]:
        return await handle_search_tools(name, arguments)

    # External API integrations
    elif name in [
        "clickup_get_tasks",
        "clickup_create_task",
        "clickup_get_workspaces",
        "github_search_code",
        "context7_search",
    ]:
        return await handle_integration_tools(name, arguments)

    else:
        raise ValueError(f"Unknown tool: {name}")
