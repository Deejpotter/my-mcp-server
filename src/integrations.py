"""
Updated: 26/10/25
By: Daniel Potter

External API integration tools for ClickUp, GitHub, Context7, and BookStack.
Provides unified interface for third-party API access with proper error handling
and authentication using environment variables.

References:
ClickUp API: https://clickup.com/api
GitHub REST API: https://docs.github.com/en/rest
Context7 MCP: https://github.com/upstash/context7
BookStack API: https://www.bookstackapp.com/docs/admin/hacking-bookstack/
"""

import os
from typing import Any, Dict, List
import hashlib

import httpx
from mcp.types import Tool, TextContent
import mcp.types as types

# Import caching and rate limiting utilities
from .utils.cache_rate_limit import (
    api_cache,
    context7_limiter,
    github_limiter,
    generic_limiter,
)


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
        # BookStack Tools
        Tool(
            name="bookstack_create_page",
            description="Create a new page in BookStack. Requires BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
            inputSchema={
                "type": "object",
                "properties": {
                    "book_id": {
                        "type": "integer",
                        "description": "BookStack book ID to create page in (use if not using chapter_id)",
                    },
                    "chapter_id": {
                        "type": "integer",
                        "description": "BookStack chapter ID to create page in (use if not using book_id)",
                    },
                    "name": {
                        "type": "string",
                        "description": "Page title/name",
                    },
                    "html": {
                        "type": "string",
                        "description": "Page content in HTML format",
                    },
                    "markdown": {
                        "type": "string",
                        "description": "Page content in Markdown format (alternative to html)",
                    },
                    "tags": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "value": {"type": "string"},
                            },
                        },
                        "description": "Array of tag objects with name and value",
                    },
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="bookstack_get_page",
            description="Get content of a specific BookStack page by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "page_id": {
                        "type": "integer",
                        "description": "BookStack page ID",
                    }
                },
                "required": ["page_id"],
            },
        ),
        Tool(
            name="bookstack_search",
            description="Search BookStack for pages, books, chapters, or shelves. Takes same query format as BookStack search bar.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query text (supports filters like 'name:', 'type:', etc.)",
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of results to return (default: 20, suggestion only)",
                        "default": 20,
                    },
                    "page": {
                        "type": "integer",
                        "description": "Page number for pagination (default: 1)",
                        "default": 1,
                    },
                },
                "required": ["query"],
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

    # BookStack handlers
    elif name == "bookstack_create_page":
        return await _handle_bookstack_create_page(arguments)
    elif name == "bookstack_get_page":
        return await _handle_bookstack_get_page(arguments)
    elif name == "bookstack_search":
        return await _handle_bookstack_search(arguments)

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


async def _handle_bookstack_create_page(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """
    Handle BookStack page creation using REST API.

    Reference: https://demo.bookstackapp.com/api/docs#pages-create
    Authentication: Token-based using BOOKSTACK_TOKEN_ID and BOOKSTACK_TOKEN_SECRET
    """
    try:
        # Get environment variables for BookStack authentication
        bookstack_url = os.getenv("BOOKSTACK_URL")
        token_id = os.getenv("BOOKSTACK_TOKEN_ID")
        token_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

        if not all([bookstack_url, token_id, token_secret]):
            return [
                types.TextContent(
                    type="text",
                    text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                )
            ]

        # Type narrowing - after check, we know these are not None
        assert bookstack_url is not None
        assert token_id is not None
        assert token_secret is not None

        # Extract parameters from arguments
        book_id = arguments.get("book_id")
        chapter_id = arguments.get("chapter_id")
        name = arguments.get("name", "")
        html = arguments.get("html", "")
        markdown = arguments.get("markdown", "")
        tags = arguments.get("tags", [])

        # Validation - need either book_id or chapter_id
        if not (book_id or chapter_id):
            return [
                types.TextContent(
                    type="text",
                    text="Error: Either book_id or chapter_id is required to create a page",
                )
            ]

        if not name:
            return [types.TextContent(type="text", text="Error: name is required")]

        # Build page data payload
        page_data = {"name": name}

        if book_id:
            page_data["book_id"] = book_id
        if chapter_id:
            page_data["chapter_id"] = chapter_id
        if html:
            page_data["html"] = html
        if markdown:
            page_data["markdown"] = markdown
        if tags:
            page_data["tags"] = tags

        # BookStack API endpoint and authentication
        url = f"{bookstack_url.rstrip('/')}/api/pages"
        headers = {
            "Authorization": f"Token {token_id}:{token_secret}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=page_data)

            if response.status_code in [200, 201]:
                page = response.json()
                output = f"✅ Page created successfully in BookStack!\n\n"
                output += f"📄 {page['name']}\n"
                output += f"ID: {page['id']}\n"
                output += f"Slug: {page['slug']}\n"
                if "book_id" in page:
                    output += f"Book ID: {page['book_id']}\n"
                if "chapter_id" in page:
                    output += f"Chapter ID: {page['chapter_id']}\n"
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


async def _handle_bookstack_get_page(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """
    Handle retrieving a BookStack page by ID.

    Reference: https://demo.bookstackapp.com/api/docs#pages-read
    Returns both HTML and Markdown content if available
    """
    try:
        bookstack_url = os.getenv("BOOKSTACK_URL")
        token_id = os.getenv("BOOKSTACK_TOKEN_ID")
        token_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

        if not all([bookstack_url, token_id, token_secret]):
            return [
                types.TextContent(
                    type="text",
                    text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                )
            ]

        # Type narrowing
        assert bookstack_url is not None
        assert token_id is not None
        assert token_secret is not None

        page_id = arguments.get("page_id")
        if not page_id:
            return [types.TextContent(type="text", text="Error: page_id is required")]

        url = f"{bookstack_url.rstrip('/')}/api/pages/{page_id}"
        headers = {"Authorization": f"Token {token_id}:{token_secret}"}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers)

            if response.status_code == 200:
                page = response.json()
                output = f"📄 **{page['name']}**\n\n"
                output += f"ID: {page['id']}\n"
                output += f"Slug: {page['slug']}\n"
                output += f"Book ID: {page.get('book_id', 'N/A')}\n"
                if page.get("chapter_id"):
                    output += f"Chapter ID: {page['chapter_id']}\n"
                output += f"Created: {page.get('created_at', 'N/A')}\n"
                output += f"Updated: {page.get('updated_at', 'N/A')}\n\n"

                # Add content - prioritize markdown if available, otherwise HTML
                if page.get("markdown"):
                    output += "**Content (Markdown):**\n\n"
                    output += page["markdown"]
                elif page.get("raw_html"):
                    output += "**Content (HTML):**\n\n"
                    output += page["raw_html"]
                else:
                    output += "*(No content available)*"

                return [types.TextContent(type="text", text=output)]
            elif response.status_code == 404:
                return [
                    types.TextContent(
                        type="text", text=f"Page with ID {page_id} not found"
                    )
                ]
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
                type="text", text=f"Error retrieving BookStack page: {str(e)}"
            )
        ]


async def _handle_bookstack_search(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """
    Handle BookStack search across all content types.

    Reference: https://demo.bookstackapp.com/api/docs#search-all
    Searches books, chapters, pages, and bookshelves
    """
    try:
        bookstack_url = os.getenv("BOOKSTACK_URL")
        token_id = os.getenv("BOOKSTACK_TOKEN_ID")
        token_secret = os.getenv("BOOKSTACK_TOKEN_SECRET")

        if not all([bookstack_url, token_id, token_secret]):
            return [
                types.TextContent(
                    type="text",
                    text="BookStack credentials not found. Please set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET environment variables.",
                )
            ]

        # Type narrowing
        assert bookstack_url is not None
        assert token_id is not None
        assert token_secret is not None

        query = arguments.get("query", "")
        count = arguments.get("count", 20)
        page = arguments.get("page", 1)

        if not query:
            return [types.TextContent(type="text", text="Error: query is required")]

        url = f"{bookstack_url.rstrip('/')}/api/search"
        headers = {"Authorization": f"Token {token_id}:{token_secret}"}
        params = {"query": query, "count": count, "page": page}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)

            if response.status_code == 200:
                data = response.json()
                results = data.get("data", [])
                total = data.get("total", 0)

                if results:
                    output = f"🔍 Found {total} results for '{query}' (showing {len(results)}):\n\n"
                    for item in results:
                        # Icon based on type
                        icons = {
                            "page": "📄",
                            "chapter": "📁",
                            "book": "📚",
                            "bookshelf": "📚",
                        }
                        icon = icons.get(item.get("type"), "📌")

                        output += f"{icon} **{item['name']}** ({item['type']})\n"
                        output += f"   ID: {item['id']}\n"

                        # Add snippet if available (preview text)
                        if item.get("preview_content"):
                            preview = item["preview_content"]["content"][:150]
                            output += f"   Preview: {preview}...\n"

                        output += "\n"

                    return [types.TextContent(type="text", text=output)]
                else:
                    return [
                        types.TextContent(
                            type="text", text=f"No results found for query '{query}'"
                        )
                    ]
            else:
                return [
                    types.TextContent(
                        type="text",
                        text=f"BookStack API error: {response.status_code} - {response.text}",
                    )
                ]

    except Exception as e:
        return [
            types.TextContent(type="text", text=f"Error searching BookStack: {str(e)}")
        ]


async def _handle_github_search_code(
    arguments: Dict[str, Any],
) -> List[types.TextContent]:
    """
    Handle GitHub code search with caching and rate limiting.

    Implements:
    - In-memory caching with 5-minute TTL
    - Rate limiting (30 requests/minute) to stay under GitHub limits
    - Cache key based on query + language + repo + limit

    Reference: https://docs.github.com/en/rest
    """
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

        # Generate cache key from request parameters
        cache_key = f"github:{search_query}:{limit}"
        cache_key_hash = hashlib.md5(cache_key.encode()).hexdigest()

        # Check cache first
        cached_result = api_cache.get(cache_key_hash)
        if cached_result is not None:
            return [
                types.TextContent(
                    type="text",
                    text=f"📦 (Cached)\n\n{cached_result}",
                )
            ]

        # Check rate limit before making API call
        if not github_limiter.allow("github_api"):
            wait_time = github_limiter.time_until_allowed("github_api")
            return [
                types.TextContent(
                    type="text",
                    text=f"⏱️ Rate limit exceeded for GitHub API. Please wait {wait_time:.1f} seconds.",
                )
            ]

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

                    # Cache successful result
                    api_cache.set(cache_key_hash, output)
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
    """
    Handle Context7 documentation search with caching and rate limiting.

    Implements:
    - In-memory caching with 5-minute TTL to reduce API calls
    - Rate limiting (100 requests/minute) to prevent quota exhaustion
    - Cache key based on library + query + tokens for precise matching

    Reference: https://github.com/upstash/context7
    """
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

        # Generate cache key from request parameters
        cache_key = f"context7:{library}:{query}:{tokens}"
        cache_key_hash = hashlib.md5(cache_key.encode()).hexdigest()

        # Check cache first - avoid unnecessary API calls
        cached_result = api_cache.get(cache_key_hash)
        if cached_result is not None:
            return [
                types.TextContent(
                    type="text",
                    text=f"📦 (Cached) {cached_result}",
                )
            ]

        # Check rate limit before making API call
        if not context7_limiter.allow("context7_api"):
            wait_time = context7_limiter.time_until_allowed("context7_api")
            return [
                types.TextContent(
                    type="text",
                    text=f"⏱️ Rate limit exceeded for Context7 API. Please wait {wait_time:.1f} seconds.",
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
                        # Cache successful result for 5 minutes
                        api_cache.set(cache_key_hash, text_content)
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
