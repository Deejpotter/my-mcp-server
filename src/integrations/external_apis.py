"""
External API integration tools
"""

import os
from typing import Any, Dict, List

import httpx
from mcp.types import Tool, TextContent
import mcp.types as types


def get_integration_tools() -> List[Tool]:
    """Get all external API integration tool definitions"""
    return [
        # ClickUp Tools
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
                    "assignees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of user IDs to assign (optional)",
                    },
                    "priority": {
                        "type": "string",
                        "description": "Task priority: urgent, high, normal, low (optional)",
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
        # GitHub Search Tool
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
        # Context7 Search Tool
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
    ]


async def handle_integration_tools(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle external API integration tool calls"""

    # ClickUp handlers
    if name == "clickup_get_tasks":
        return await _handle_clickup_get_tasks(arguments)
    elif name == "clickup_create_task":
        return await _handle_clickup_create_task(arguments)
    elif name == "clickup_get_workspaces":
        return await _handle_clickup_get_workspaces(arguments)

    # GitHub handler
    elif name == "github_search_code":
        return await _handle_github_search_code(arguments)

    # Context7 handler
    elif name == "context7_search":
        return await _handle_context7_search(arguments)

    else:
        raise ValueError(f"Unknown integration tool: {name}")


async def _handle_clickup_get_tasks(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """Handle ClickUp get tasks"""
    try:
        api_key = os.getenv("CLICKUP_API_KEY")
        if not api_key:
            return [
                types.TextContent(
                    type="text",
                    text="ClickUp API key not found. Please set CLICKUP_API_KEY environment variable.",
                )
            ]

        list_id = arguments.get("list_id", "")
        status = arguments.get("status")
        assignee = arguments.get("assignee")

        if not list_id:
            return [types.TextContent(type="text", text="Error: list_id is required")]

        url = f"https://api.clickup.com/api/v2/list/{list_id}/task"
        headers = {"Authorization": api_key}
        params = {}

        if status:
            params["statuses[]"] = status
        if assignee:
            params["assignees[]"] = assignee

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)

            if response.status_code == 200:
                data = response.json()
                tasks = data.get("tasks", [])

                if tasks:
                    output = f"✅ Found {len(tasks)} tasks in list {list_id}:\n\n"
                    for task in tasks[:10]:  # Limit to first 10 tasks
                        output += f"📋 {task['name']}\n"
                        output += f"   ID: {task['id']}\n"
                        output += f"   Status: {task['status']['status']}\n"
                        if task.get("assignees"):
                            assignees = [a["username"] for a in task["assignees"]]
                            output += f"   Assignees: {', '.join(assignees)}\n"
                        output += "\n"
                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text", text="No tasks found in the specified list"
                        )
                    ]
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


async def _handle_clickup_create_task(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """Handle ClickUp create task"""
    try:
        api_key = os.getenv("CLICKUP_API_KEY")
        if not api_key:
            return [
                types.TextContent(
                    type="text",
                    text="ClickUp API key not found. Please set CLICKUP_API_KEY environment variable.",
                )
            ]

        list_id = arguments.get("list_id", "")
        name = arguments.get("name", "")
        description = arguments.get("description", "")
        assignees = arguments.get("assignees", [])
        priority = arguments.get("priority")

        if not list_id or not name:
            return [
                types.TextContent(
                    type="text", text="Error: list_id and name are required"
                )
            ]

        url = f"https://api.clickup.com/api/v2/list/{list_id}/task"
        headers = {"Authorization": api_key, "Content-Type": "application/json"}

        task_data = {"name": name}
        if description:
            task_data["description"] = description
        if assignees:
            task_data["assignees"] = assignees
        if priority:
            priority_map = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
            task_data["priority"] = priority_map.get(priority.lower(), 3)

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=task_data)

            if response.status_code == 200:
                task = response.json()
                output = f"✅ Task created successfully!\n\n"
                output += f"📋 {task['name']}\n"
                output += f"ID: {task['id']}\n"
                output += f"URL: {task['url']}\n"
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


async def _handle_clickup_get_workspaces(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """Handle ClickUp get workspaces"""
    try:
        api_key = os.getenv("CLICKUP_API_KEY")
        if not api_key:
            return [
                types.TextContent(
                    type="text",
                    text="ClickUp API key not found. Please set CLICKUP_API_KEY environment variable.",
                )
            ]

        url = "https://api.clickup.com/api/v2/team"
        headers = {"Authorization": api_key}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                teams = data.get("teams", [])

                if teams:
                    output = f"✅ Found {len(teams)} ClickUp workspaces:\n\n"
                    for team in teams:
                        output += f"🏢 {team['name']}\n"
                        output += f"   ID: {team['id']}\n"
                        output += f"   Members: {len(team.get('members', []))}\n\n"
                    return [types.TextContent(type="text", text=output)]
                else:
                    return [types.TextContent(type="text", text="No workspaces found")]
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


async def _handle_github_search_code(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """Handle GitHub code search"""
    try:
        query = arguments.get("query", "")
        language = arguments.get("language")
        repo = arguments.get("repo")
        limit = arguments.get("limit", 5)

        if not query:
            return [types.TextContent(type="text", text="Error: query is required")]

        # Build search query
        search_query = query
        if language:
            search_query += f" language:{language}"
        if repo:
            search_query += f" repo:{repo}"

        url = "https://api.github.com/search/code"
        headers = {"Accept": "application/vnd.github.v3+json"}

        # Add authentication if available
        github_token = os.getenv("GITHUB_TOKEN")
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        params = {"q": search_query, "per_page": limit}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)

            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])

                if items:
                    output = f"✅ Found {len(items)} code results for '{query}':\n\n"
                    for item in items:
                        output += f"📄 {item['name']}\n"
                        output += f"   Repository: {item['repository']['full_name']}\n"
                        output += f"   Path: {item['path']}\n"
                        output += f"   URL: {item['html_url']}\n\n"
                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text", text=f"No code found for query '{query}'"
                        )
                    ]
            else:
                return [
                    types.TextContent(
                        type="text",
                        text=f"GitHub API error: {response.status_code} - {response.text}",
                    )
                ]

    except Exception as e:
        return [
            types.TextContent(type="text", text=f"Error searching GitHub: {str(e)}")
        ]


async def _handle_context7_search(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle Context7 documentation search"""
    try:
        library = arguments.get("library", "")
        query = arguments.get("query", "")
        tokens = arguments.get("tokens", 5000)

        if not library or not query:
            return [
                types.TextContent(
                    type="text", text="Error: library and query are required"
                )
            ]

        # Context7 API endpoint
        url = "https://mcp.context7.com/mcp"

        # Build the request payload for Context7 MCP protocol
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "search",
                "arguments": {"library": library, "query": query, "tokens": tokens},
            },
            "id": 1,
        }

        headers = {"Content-Type": "application/json"}

        # Add API key if available
        context7_api_key = os.getenv("CONTEXT7_API_KEY")
        if context7_api_key:
            headers["Authorization"] = f"Bearer {context7_api_key}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=payload)

            if response.status_code == 200:
                data = response.json()
                if "result" in data and "content" in data["result"]:
                    content = data["result"]["content"]
                    if content and len(content) > 0:
                        text_content = content[0].get("text", "No content found")
                        return [types.TextContent(type="text", text=text_content)]
                    else:
                        return [types.TextContent(type="text", text="No results found")]
                else:
                    return [
                        types.TextContent(
                            type="text", text=f"Unexpected Context7 response: {data}"
                        )
                    ]
            else:
                return [
                    types.TextContent(
                        type="text",
                        text=f"Context7 API error: {response.status_code} - {response.text}",
                    )
                ]

    except Exception as e:
        return [
            types.TextContent(type="text", text=f"Error searching Context7: {str(e)}")
        ]
