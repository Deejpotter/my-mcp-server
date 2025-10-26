#!/usr/bin/env python3
"""
Integration Tests for New Features
Tests for newly implemented MCP tools
Created: 26/01/25
Reference: https://github.com/yourusername/my-mcp-server
"""

import sys
from pathlib import Path

# Add src to path for imports
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


def test_cache_utilities():
    """Test cache utilities work correctly"""
    from utils.cache_rate_limit import SimpleCache

    cache = SimpleCache(ttl_seconds=2)

    # Test set/get
    cache.set("test_key", "test_value")
    assert cache.get("test_key") == "test_value", "Cache should return stored value"

    # Test cache miss
    assert cache.get("nonexistent") is None, "Cache should return None for missing keys"

    print("✓ Cache utilities test passed")


def test_rate_limiter():
    """Test rate limiter works correctly"""
    from utils.cache_rate_limit import RateLimiter

    # Create a limiter that allows 5 calls per second
    limiter = RateLimiter(max_calls=5, period_seconds=1)

    # First 5 calls should be allowed
    allowed_count = sum(1 for _ in range(5) if limiter.allow("test"))
    assert allowed_count == 5, "First 5 calls should be allowed"

    # 6th call should be denied
    assert not limiter.allow("test"), "6th call should be rate limited"

    # Check wait time is calculated
    wait_time = limiter.time_until_allowed("test")
    assert wait_time > 0, "Wait time should be positive when rate limited"

    print("✓ Rate limiter test passed")


def test_bookstack_schemas_exist():
    """Test BookStack integration schemas are defined"""
    from integrations.external_apis import (
        bookstack_create_page_schema,
        bookstack_get_page_schema,
        bookstack_search_schema,
    )

    # Verify schemas have required fields
    assert bookstack_create_page_schema["name"] == "bookstack_create_page"
    assert "description" in bookstack_create_page_schema
    assert "inputSchema" in bookstack_create_page_schema

    assert bookstack_get_page_schema["name"] == "bookstack_get_page"
    assert "description" in bookstack_get_page_schema

    assert bookstack_search_schema["name"] == "bookstack_search"
    assert "description" in bookstack_search_schema

    print("✓ BookStack schemas test passed")


def test_system_stats_schema():
    """Test system stats tool schema is defined"""
    from tools.system_commands import system_stats_schema

    assert system_stats_schema["name"] == "system_stats"
    assert "description" in system_stats_schema
    assert "inputSchema" in system_stats_schema

    # Verify parameters
    props = system_stats_schema["inputSchema"]["properties"]
    assert "interval" in props, "Should have interval parameter"
    assert "per_cpu" in props, "Should have per_cpu parameter"

    print("✓ System stats schema test passed")


def test_search_docs_online_schema():
    """Test search_docs_online tool schema is defined"""
    from tools.search_tools import search_docs_online_schema

    assert search_docs_online_schema["name"] == "search_docs_online"
    assert "description" in search_docs_online_schema
    assert "inputSchema" in search_docs_online_schema

    # Verify parameters
    props = search_docs_online_schema["inputSchema"]["properties"]
    assert "query" in props, "Should have query parameter"
    assert "source" in props, "Should have source parameter"
    assert "limit" in props, "Should have limit parameter"

    print("✓ Search docs online schema test passed")


if __name__ == "__main__":
    print("=" * 60)
    print("Running Integration Tests for New Features")
    print("=" * 60 + "\n")

    tests = [
        ("Cache Utilities", test_cache_utilities),
        ("Rate Limiter", test_rate_limiter),
        ("BookStack Schemas", test_bookstack_schemas_exist),
        ("System Stats Schema", test_system_stats_schema),
        ("Search Docs Online Schema", test_search_docs_online_schema),
    ]

    results = {}
    for test_name, test_func in tests:
        try:
            print(f"Testing {test_name}...")
            test_func()
            results[test_name] = True
        except Exception as e:
            print(f"✗ {test_name} failed: {e}")
            import traceback

            traceback.print_exc()
            results[test_name] = False
        print()

    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} - {test_name}")

    total = len(results)
    passed_count = sum(results.values())
    print(f"\nTotal: {passed_count}/{total} tests passed")

    sys.exit(0 if all(results.values()) else 1)
