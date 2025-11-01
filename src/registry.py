"""
registry.py
----------------
Small decorator-based registry PoC for MCP-style handler registration.

Purpose:
- Provide `@registry.tool()`, `@registry.resource()`, and `@registry.prompt()`
  decorators so the codebase can incrementally adopt the MCP SDK-style
  decorator registration pattern.
- If the official MCP Python SDK (`mcp.server.fastmcp.FastMCP`) is
  available at runtime we delegate to it. Otherwise we fall back to a
  lightweight in-process registry which exposes the same decorator API
  surface for local testing and gradual migration.

This is intentionally small and non-invasive: it does not change how
existing tools are dispatched in `src/tools.py`. Instead it provides a
coexistence path so handlers can be registered with decorators and used
by future PoC server wiring.
"""
from __future__ import annotations

import asyncio
import inspect
from typing import Any, Awaitable, Callable, Dict, Optional

try:
    # Prefer the official FastMCP if available (standard MCP pattern)
    from mcp.server.fastmcp import FastMCP

    _FASTMCP_AVAILABLE = True
except Exception:
    _FASTMCP_AVAILABLE = False


class _LocalRegistry:
    """Lightweight in-process registry that mimics the decorator API.

    Usage:
        @registry.tool()
        async def my_tool(arg: str) -> str:
            return f"got {arg}"

        await registry.call_tool("my_tool", {"arg": "x"})
    """

    def __init__(self) -> None:
        self.tools: Dict[str, Callable[..., Awaitable[Any] | Any]] = {}
        self.resources: Dict[str, Callable[..., Any]] = {}
        self.prompts: Dict[str, Callable[..., Any]] = {}

    def tool(self, name: Optional[str] = None):
        def decorator(fn: Callable[..., Any]):
            key = name or fn.__name__
            # Accept sync or async functions
            self.tools[key] = fn
            return fn

        return decorator

    def resource(self, uri_pattern: Optional[str] = None):
        def decorator(fn: Callable[..., Any]):
            key = uri_pattern or fn.__name__
            self.resources[key] = fn
            return fn

        return decorator

    def prompt(self, name: Optional[str] = None):
        def decorator(fn: Callable[..., Any]):
            key = name or fn.__name__
            self.prompts[key] = fn
            return fn

        return decorator

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        if name not in self.tools:
            raise KeyError(name)

        fn = self.tools[name]
        if inspect.iscoroutinefunction(fn):
            return await fn(**arguments)
        else:
            # Run sync function in threadpool to avoid blocking
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, lambda: fn(**arguments))


# Prefer FastMCP implementation if available
if _FASTMCP_AVAILABLE:
    _fast = FastMCP("my-mcp-server")


    class _FastAdapter:
        def __init__(self, fastmcp: FastMCP):
            self._m = fastmcp

        def tool(self, *a, **k):
            return self._m.tool(*a, **k)

        def resource(self, *a, **k):
            return self._m.resource(*a, **k)

        def prompt(self, *a, **k):
            return self._m.prompt(*a, **k)

        async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
            # FastMCP manages its own invocation lifecycle; for PoC we raise
            raise NotImplementedError("Call-through to FastMCP is not supported in the PoC")

    registry = _FastAdapter(_fast)
else:
    registry = _LocalRegistry()
