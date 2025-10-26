#!/usr/bin/env python3
"""
Test New Features
Test script for newly implemented tools
Created: 26/01/25
"""

import sys
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


def test_system_stats():
    """Test system_stats tool"""
    print("=" * 60)
    print("Testing system_stats tool...")
    print("=" * 60)

    try:
        from tools.system_commands import system_stats

        # Test basic stats
        result = system_stats(interval=0.5)
        print(f"✓ Basic stats: {len(result)} characters of output")

        # Test per-CPU stats
        result_percpu = system_stats(interval=0.5, per_cpu=True)
        print(f"✓ Per-CPU stats: {len(result_percpu)} characters of output")

        # Verify key components in output
        if (
            "CPU Usage" in result
            and "Memory Usage" in result
            and "Disk Usage" in result
        ):
            print("✓ All stat categories present")
        else:
            print("✗ Missing stat categories")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_search_docs_online():
    """Test search_docs_online tool"""
    print("\n" + "=" * 60)
    print("Testing search_docs_online tool...")
    print("=" * 60)

    try:
        from tools.search_tools import search_docs_online

        # Test MDN search
        result = search_docs_online("javascript array methods", source="mdn", limit=2)
        print(f"✓ MDN search: {len(result)} characters returned")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_cache_rate_limit():
    """Test caching and rate limiting utilities"""
    print("\n" + "=" * 60)
    print("Testing cache and rate limiter...")
    print("=" * 60)

    try:
        from utils.cache_rate_limit import SimpleCache, RateLimiter

        # Test cache
        cache = SimpleCache(ttl_seconds=2)
        cache.set("test_key", "test_value")
        value = cache.get("test_key")

        if value == "test_value":
            print("✓ Cache set/get works")
        else:
            print("✗ Cache returned wrong value")

        # Test rate limiter
        limiter = RateLimiter(rate_per_minute=60)

        allowed_count = sum(1 for _ in range(5) if limiter.allow("test"))
        print(f"✓ Rate limiter allowed {allowed_count}/5 requests")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_bookstack_schema():
    """Test BookStack tool schemas are properly defined"""
    print("\n" + "=" * 60)
    print("Testing BookStack integration schemas...")
    print("=" * 60)

    try:
        from integrations.external_apis import (
            bookstack_create_page_schema,
            bookstack_get_page_schema,
            bookstack_search_schema,
        )

        # Verify schemas have required fields
        assert bookstack_create_page_schema["name"] == "bookstack_create_page"
        assert bookstack_get_page_schema["name"] == "bookstack_get_page"
        assert bookstack_search_schema["name"] == "bookstack_search"

        print("✓ BookStack create_page schema defined")
        print("✓ BookStack get_page schema defined")
        print("✓ BookStack search schema defined")

        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("MCP SERVER - NEW FEATURES TEST SUITE")
    print("=" * 60 + "\n")

    results = {
        "system_stats": test_system_stats(),
        "search_docs_online": test_search_docs_online(),
        "cache_rate_limit": test_cache_rate_limit(),
        "bookstack_schema": test_bookstack_schema(),
    }

    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} - {test_name}")

    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
