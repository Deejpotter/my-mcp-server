"""
Web search tools for MCP server using DuckDuckGo
Created: 27/10/25
By: Daniel Potter

Provides web search capabilities for finding recent blog posts, news articles,
and general information from the web. Uses DuckDuckGo for privacy-focused searches.

Features:
- General web search with customizable result limits
- News search with time filters (day, week, month)
- Safe search and region filtering
- No API key required (uses DuckDuckGo)

References:
DuckDuckGo Search: https://github.com/deedy5/duckduckgo_search
"""

from typing import Any, Dict, List
import logging

from mcp.types import Tool, TextContent
import mcp.types as types

logger = logging.getLogger(__name__)

def get_web_search_tools() -> List[Tool]:
    """
    Get all web search tool definitions.
    
    Provides tools for searching the web, finding recent news/blog posts,
    and discovering up-to-date information online.
    """
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


async def handle_web_search(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle web search tool calls."""
    
    if name == "web_search":
        return await _handle_general_search(arguments)
    elif name == "web_search_news":
        return await _handle_news_search(arguments)
    else:
        return [types.TextContent(
            type="text",
            text=f"Unknown tool: {name}"
        )]


async def _handle_general_search(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle general web search requests."""
    query = arguments.get("query", "")
    max_results = min(arguments.get("max_results", 10), 50)  # Cap at 50
    region = arguments.get("region", "wt-wt")
    time_limit = arguments.get("time_limit")
    
    if not query:
        return [types.TextContent(
            type="text",
            text="Error: Query parameter is required"
        )]
    
    try:
        # Import here to avoid startup overhead if not used
        from duckduckgo_search import DDGS
        
        logger.info(f"Performing web search: query='{query}', max_results={max_results}")
        
        with DDGS() as ddgs:
            results = ddgs.text(
                keywords=query,
                region=region,
                safesearch="moderate",
                timelimit=time_limit,
                max_results=max_results
            )
        
        if not results:
            return [types.TextContent(
                type="text",
                text=f"No results found for query: {query}"
            )]
        
        # Format results as readable text
        formatted_results = [f"🔍 **Web Search Results for: {query}**\n"]
        formatted_results.append(f"Found {len(results)} results:\n")
        
        for i, result in enumerate(results, 1):
            title = result.get("title", "No title")
            url = result.get("href", "")
            body = result.get("body", "No description")
            
            formatted_results.append(f"\n**{i}. {title}**")
            formatted_results.append(f"🔗 {url}")
            formatted_results.append(f"📝 {body}\n")
        
        return [types.TextContent(
            type="text",
            text="\n".join(formatted_results)
        )]
        
    except Exception as e:
        logger.error(f"Web search failed: {e}")
        return [types.TextContent(
            type="text",
            text=f"Error performing web search: {str(e)}"
        )]


async def _handle_news_search(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle news search requests."""
    query = arguments.get("query", "")
    max_results = min(arguments.get("max_results", 10), 50)  # Cap at 50
    region = arguments.get("region", "wt-wt")
    time_limit = arguments.get("time_limit", "w")  # Default to week
    
    if not query:
        return [types.TextContent(
            type="text",
            text="Error: Query parameter is required"
        )]
    
    try:
        # Import here to avoid startup overhead if not used
        from duckduckgo_search import DDGS
        
        logger.info(f"Performing news search: query='{query}', max_results={max_results}, time_limit={time_limit}")
        
        with DDGS() as ddgs:
            results = ddgs.news(
                keywords=query,
                region=region,
                safesearch="moderate",
                timelimit=time_limit,
                max_results=max_results
            )
        
        if not results:
            return [types.TextContent(
                type="text",
                text=f"No news articles found for query: {query}"
            )]
        
        # Format results as readable text
        formatted_results = [f"📰 **News Search Results for: {query}**\n"]
        formatted_results.append(f"Found {len(results)} articles:\n")
        
        for i, result in enumerate(results, 1):
            title = result.get("title", "No title")
            url = result.get("url", "")
            body = result.get("body", "No description")
            date = result.get("date", "Unknown date")
            source = result.get("source", "Unknown source")
            
            formatted_results.append(f"\n**{i}. {title}**")
            formatted_results.append(f"🔗 {url}")
            formatted_results.append(f"📅 {date} | 📰 {source}")
            formatted_results.append(f"📝 {body}\n")
        
        return [types.TextContent(
            type="text",
            text="\n".join(formatted_results)
        )]
        
    except Exception as e:
        logger.error(f"News search failed: {e}")
        return [types.TextContent(
            type="text",
            text=f"Error performing news search: {str(e)}"
        )]
