"""
Updated: 26/10/25
By: Daniel Potter

Caching and rate limiting utilities for API calls.
Provides in-memory caching with TTL and rate limiting to prevent API quota exhaustion.

Features:
- Time-based cache with configurable TTL (Time To Live)
- Per-endpoint rate limiting using token bucket algorithm
- Thread-safe operations for concurrent access
- Automatic cache cleanup and expiration

References:
Token Bucket Algorithm: https://en.wikipedia.org/wiki/Token_bucket
Python Threading: https://docs.python.org/3/library/threading.html
"""

import time
from typing import Any, Dict, Optional
from threading import Lock
from datetime import datetime, timedelta


class SimpleCache:
    """
    Simple in-memory cache with TTL (Time To Live).

    Provides thread-safe caching for expensive API calls with automatic expiration.
    Uses a simple dictionary-based storage with timestamp tracking.

    Example:
        cache = SimpleCache(ttl_seconds=300)  # 5 minute cache

        # Try to get from cache
        result = cache.get("api_key")
        if result is None:
            # Cache miss - fetch from API
            result = expensive_api_call()
            cache.set("api_key", result)
    """

    def __init__(self, ttl_seconds: int = 300):
        """
        Initialize cache with configurable TTL.

        Args:
            ttl_seconds: Time to live for cache entries in seconds (default: 300 = 5 minutes)
        """
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
        self.ttl_seconds = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        """
        Retrieve value from cache if not expired.

        Args:
            key: Cache key to retrieve

        Returns:
            Cached value if found and not expired, None otherwise
        """
        with self._lock:
            if key not in self._cache:
                return None

            entry = self._cache[key]
            # Check if cache entry has expired
            if time.time() - entry["timestamp"] > self.ttl_seconds:
                # Remove expired entry
                del self._cache[key]
                return None

            return entry["value"]

    def set(self, key: str, value: Any) -> None:
        """
        Store value in cache with current timestamp.

        Args:
            key: Cache key to store under
            value: Value to cache (can be any serializable type)
        """
        with self._lock:
            self._cache[key] = {"value": value, "timestamp": time.time()}

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self) -> int:
        """
        Remove all expired cache entries.

        Returns:
            Number of entries removed
        """
        with self._lock:
            current_time = time.time()
            expired_keys = [
                key
                for key, entry in self._cache.items()
                if current_time - entry["timestamp"] > self.ttl_seconds
            ]

            for key in expired_keys:
                del self._cache[key]

            return len(expired_keys)


class RateLimiter:
    """
    Token bucket rate limiter for API calls.

    Implements a token bucket algorithm to limit the rate of operations.
    Each operation consumes one token. Tokens refill at a constant rate.

    Example:
        limiter = RateLimiter(max_calls=10, period_seconds=60)  # 10 calls per minute

        if limiter.allow("api_endpoint"):
            # Rate limit allows this call
            result = api_call()
        else:
            # Rate limit exceeded
            wait_time = limiter.time_until_allowed("api_endpoint")
            print(f"Rate limit exceeded. Wait {wait_time}s")
    """

    def __init__(self, max_calls: int = 60, period_seconds: int = 60):
        """
        Initialize rate limiter with call limits.

        Args:
            max_calls: Maximum number of calls allowed in the time period
            period_seconds: Time period in seconds for the rate limit
        """
        self._buckets: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
        self.max_calls = max_calls
        self.period_seconds = period_seconds
        # Calculate token refill rate (tokens per second)
        self.refill_rate = max_calls / period_seconds

    def _get_or_create_bucket(self, key: str) -> Dict[str, Any]:
        """
        Get or create a token bucket for the given key.

        Args:
            key: Identifier for the rate limit bucket (e.g., API endpoint)

        Returns:
            Bucket dictionary with tokens and last_refill timestamp
        """
        if key not in self._buckets:
            self._buckets[key] = {
                "tokens": float(self.max_calls),
                "last_refill": time.time(),
            }
        return self._buckets[key]

    def _refill_tokens(self, bucket: Dict[str, Any]) -> None:
        """
        Refill tokens based on time elapsed since last refill.

        Args:
            bucket: Token bucket to refill
        """
        current_time = time.time()
        time_passed = current_time - bucket["last_refill"]

        # Calculate tokens to add based on time passed and refill rate
        tokens_to_add = time_passed * self.refill_rate
        bucket["tokens"] = min(self.max_calls, bucket["tokens"] + tokens_to_add)
        bucket["last_refill"] = current_time

    def allow(self, key: str, tokens: int = 1) -> bool:
        """
        Check if operation is allowed under rate limit and consume tokens if so.

        Args:
            key: Identifier for the rate limit bucket
            tokens: Number of tokens to consume (default: 1)

        Returns:
            True if operation is allowed, False if rate limit exceeded
        """
        with self._lock:
            bucket = self._get_or_create_bucket(key)
            self._refill_tokens(bucket)

            if bucket["tokens"] >= tokens:
                bucket["tokens"] -= tokens
                return True

            return False

    def time_until_allowed(self, key: str, tokens: int = 1) -> float:
        """
        Calculate time in seconds until operation would be allowed.

        Args:
            key: Identifier for the rate limit bucket
            tokens: Number of tokens needed (default: 1)

        Returns:
            Time in seconds until enough tokens will be available
        """
        with self._lock:
            bucket = self._get_or_create_bucket(key)
            self._refill_tokens(bucket)

            if bucket["tokens"] >= tokens:
                return 0.0

            # Calculate time needed to accumulate required tokens
            tokens_needed: float = tokens - bucket["tokens"]
            return tokens_needed / self.refill_rate

    def reset(self, key: str) -> None:
        """
        Reset rate limit bucket for a specific key.

        Args:
            key: Identifier for the rate limit bucket to reset
        """
        with self._lock:
            if key in self._buckets:
                self._buckets[key] = {
                    "tokens": float(self.max_calls),
                    "last_refill": time.time(),
                }


# Global cache and rate limiter instances for API calls
# Cache with 5 minute TTL - reasonable for documentation that doesn't change frequently
api_cache = SimpleCache(ttl_seconds=300)

# Rate limiters for different APIs
# Context7: 100 requests per minute (conservative limit)
context7_limiter = RateLimiter(max_calls=100, period_seconds=60)

# GitHub: 60 requests per hour for unauthenticated, 5000 for authenticated
# Using conservative 30 per minute to stay well under both limits
github_limiter = RateLimiter(max_calls=30, period_seconds=60)

# Generic API rate limiter for other services
generic_limiter = RateLimiter(max_calls=60, period_seconds=60)
