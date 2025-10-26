"""
Performance Tracking Utilities
Created: 26/10/25
By: Daniel Potter

Provides decorators and utilities for tracking tool execution time and performance metrics.

References:
Python Decorators: https://docs.python.org/3/glossary.html#term-decorator
Asyncio Time Measurement: https://docs.python.org/3/library/asyncio-task.html#asyncio.sleep
"""

import time
import logging
from functools import wraps
from typing import Any, Callable, Dict, Optional
from datetime import datetime

# Configure logger
logger = logging.getLogger(__name__)


class PerformanceTracker:
    """
    Tracks performance metrics for tool executions.

    Stores execution times, call counts, and average durations for each tool.
    Thread-safe for concurrent operations.
    """

    def __init__(self):
        self._metrics: Dict[str, Dict[str, Any]] = {}

    def record_execution(
        self, tool_name: str, duration_ms: float, success: bool = True
    ):
        """
        Record a tool execution with timing information.

        Args:
            tool_name: Name of the tool that was executed
            duration_ms: Execution time in milliseconds
            success: Whether the execution was successful
        """
        if tool_name not in self._metrics:
            self._metrics[tool_name] = {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_time_ms": 0.0,
                "min_time_ms": float("inf"),
                "max_time_ms": 0.0,
                "last_called": None,
            }

        metrics = self._metrics[tool_name]
        metrics["total_calls"] += 1

        if success:
            metrics["successful_calls"] += 1
        else:
            metrics["failed_calls"] += 1

        metrics["total_time_ms"] += duration_ms
        metrics["min_time_ms"] = min(metrics["min_time_ms"], duration_ms)
        metrics["max_time_ms"] = max(metrics["max_time_ms"], duration_ms)
        metrics["last_called"] = datetime.now().isoformat()

    def get_metrics(self, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get performance metrics for a specific tool or all tools.

        Args:
            tool_name: Optional specific tool name. If None, returns all metrics.

        Returns:
            Dictionary of performance metrics
        """
        if tool_name:
            metrics = self._metrics.get(tool_name, {})
            if metrics and metrics["total_calls"] > 0:
                metrics["avg_time_ms"] = (
                    metrics["total_time_ms"] / metrics["total_calls"]
                )
            return metrics

        # Return all metrics with calculated averages
        result = {}
        for name, metrics in self._metrics.items():
            result[name] = metrics.copy()
            if metrics["total_calls"] > 0:
                result[name]["avg_time_ms"] = (
                    metrics["total_time_ms"] / metrics["total_calls"]
                )

        return result

    def get_summary(self) -> str:
        """
        Get a formatted summary of all performance metrics.

        Returns:
            Human-readable string with performance summary
        """
        if not self._metrics:
            return "No performance data recorded yet."

        lines = ["Tool Performance Summary", "=" * 60]

        # Sort by total calls descending
        sorted_tools = sorted(
            self._metrics.items(), key=lambda x: x[1]["total_calls"], reverse=True
        )

        for name, metrics in sorted_tools:
            avg_time = (
                metrics["total_time_ms"] / metrics["total_calls"]
                if metrics["total_calls"] > 0
                else 0
            )
            lines.append(f"\n{name}:")
            lines.append(
                f"  Total Calls: {metrics['total_calls']} (✓ {metrics['successful_calls']}, ✗ {metrics['failed_calls']})"
            )
            lines.append(f"  Avg Time: {avg_time:.2f}ms")
            lines.append(
                f"  Min/Max: {metrics['min_time_ms']:.2f}ms / {metrics['max_time_ms']:.2f}ms"
            )

        return "\n".join(lines)


# Global performance tracker instance
_tracker = PerformanceTracker()


def get_tracker() -> PerformanceTracker:
    """Get the global performance tracker instance"""
    return _tracker


def track_execution_time(func: Callable) -> Callable:
    """
    Decorator to track execution time of async functions.

    Automatically records timing metrics and logs slow operations.

    Usage:
        @track_execution_time
        async def my_tool_handler(name: str, args: dict):
            # tool implementation
            pass
    """

    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        tool_name = kwargs.get("name", args[0] if args else "unknown")
        start_time = time.perf_counter()
        success = True

        try:
            result = await func(*args, **kwargs)
            return result
        except Exception as e:
            success = False
            raise
        finally:
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000

            # Record metrics
            _tracker.record_execution(tool_name, duration_ms, success)

            # Log slow operations (>1000ms)
            if duration_ms > 1000:
                logger.warning(
                    f"Slow tool execution: {tool_name} took {duration_ms:.2f}ms"
                )
            else:
                logger.debug(f"Tool executed: {tool_name} in {duration_ms:.2f}ms")

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        tool_name = kwargs.get("name", args[0] if args else "unknown")
        start_time = time.perf_counter()
        success = True

        try:
            result = func(*args, **kwargs)
            return result
        except Exception as e:
            success = False
            raise
        finally:
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000

            # Record metrics
            _tracker.record_execution(tool_name, duration_ms, success)

            # Log slow operations (>1000ms)
            if duration_ms > 1000:
                logger.warning(
                    f"Slow tool execution: {tool_name} took {duration_ms:.2f}ms"
                )
            else:
                logger.debug(f"Tool executed: {tool_name} in {duration_ms:.2f}ms")

    # Return appropriate wrapper based on whether function is async
    import inspect

    if inspect.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper
