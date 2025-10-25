#!/usr/bin/env python3
"""
Security test script for MCP server
"""

import requests
import json
import time
import os
from typing import Dict, List

# Test configuration
BASE_URL = "https://mcp.deejpotter.com"  # Change to your server URL
API_KEYS = {
    "admin": os.getenv("MCP_ADMIN_KEY", ""),
    "user": os.getenv("MCP_USER_KEY", ""),
    "public": os.getenv("MCP_PUBLIC_KEY", ""),
}


def test_endpoint(
    endpoint: str, api_key: str = None, expected_status: int = 200
) -> Dict:
    """Test an endpoint with optional API key"""
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        return {
            "endpoint": endpoint,
            "status": response.status_code,
            "expected": expected_status,
            "success": response.status_code == expected_status,
            "response": response.text[:200] if response.text else "",
            "headers": dict(response.headers),
        }
    except Exception as e:
        return {
            "endpoint": endpoint,
            "status": "ERROR",
            "expected": expected_status,
            "success": False,
            "response": str(e),
            "headers": {},
        }


def test_rate_limiting(
    endpoint: str, api_key: str = None, requests_count: int = 25
) -> Dict:
    """Test rate limiting by making multiple requests"""
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    success_count = 0
    rate_limited_count = 0
    error_count = 0

    for i in range(requests_count):
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=5)
            if response.status_code == 200:
                success_count += 1
            elif response.status_code == 429:  # Too Many Requests
                rate_limited_count += 1
            else:
                error_count += 1
        except Exception:
            error_count += 1

        time.sleep(0.1)  # Small delay between requests

    return {
        "total_requests": requests_count,
        "successful": success_count,
        "rate_limited": rate_limited_count,
        "errors": error_count,
        "rate_limiting_working": rate_limited_count > 0,
    }


def run_security_tests():
    """Run comprehensive security tests"""
    print("🔐 MCP Server Security Testing")
    print("=" * 50)

    # Check if API keys are loaded
    if not any(API_KEYS.values()):
        print("⚠️  No API keys found in environment")
        print("   Run: source .env")
        print("   Or: export MCP_ADMIN_KEY=your-key")
        return

    test_results = []

    print("\n1️⃣ Testing Public Access (No API Key)")
    print("-" * 40)

    # Test public endpoints without API key
    public_tests = [
        ("/health", 200),
        ("/", 200),
        ("/mcp", 200),  # Might be protected
    ]

    for endpoint, expected in public_tests:
        result = test_endpoint(endpoint, expected_status=expected)
        test_results.append(result)
        status = "✅" if result["success"] else "❌"
        print(f"{status} {endpoint}: {result['status']} (expected {expected})")

    print("\n2️⃣ Testing API Key Authentication")
    print("-" * 40)

    # Test with different API keys
    for role, api_key in API_KEYS.items():
        if not api_key:
            continue

        print(f"\n🔑 Testing {role.upper()} key: {api_key[:10]}...")

        # Test access with this key
        result = test_endpoint("/health", api_key=api_key)
        status = "✅" if result["success"] else "❌"
        print(f"{status} Health check: {result['status']}")

        # Test protected endpoints if implemented
        protected_tests = [
            ("/personal", 200 if role in ["admin", "user"] else 403),
            ("/files", 200 if role == "admin" else 403),
            ("/system", 200 if role == "admin" else 403),
        ]

        for endpoint, expected in protected_tests:
            result = test_endpoint(endpoint, api_key=api_key, expected_status=expected)
            status = "✅" if result["success"] else "❌"
            print(f"{status} {endpoint}: {result['status']} (expected {expected})")

    print("\n3️⃣ Testing Rate Limiting")
    print("-" * 40)

    # Test rate limiting for public access
    print("Testing public rate limiting (25 requests)...")
    rate_test = test_rate_limiting("/health", requests_count=25)
    print(
        f"Results: {rate_test['successful']} success, {rate_test['rate_limited']} rate-limited"
    )

    if rate_test["rate_limiting_working"]:
        print("✅ Rate limiting is working")
    else:
        print("⚠️  Rate limiting may not be configured")

    print("\n4️⃣ Testing Security Headers")
    print("-" * 40)

    result = test_endpoint("/health")
    security_headers = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Strict-Transport-Security",
        "Content-Security-Policy",
    ]

    for header in security_headers:
        if header.lower() in [h.lower() for h in result["headers"]]:
            print(f"✅ {header}: Present")
        else:
            print(f"⚠️  {header}: Missing")

    print("\n5️⃣ Testing Invalid Requests")
    print("-" * 40)

    # Test invalid API keys
    invalid_key_result = test_endpoint(
        "/health", api_key="invalid-key", expected_status=401
    )
    status = "✅" if invalid_key_result["status"] == 401 else "⚠️"
    print(f"{status} Invalid API key: {invalid_key_result['status']}")

    # Test malformed requests
    malformed_tests = [
        ("/nonexistent", 404),
        ("/../../../etc/passwd", 404),  # Path traversal attempt
        (
            "/health?param=' OR 1=1--",
            200,
        ),  # SQL injection attempt (should be sanitized)
    ]

    for endpoint, expected in malformed_tests:
        result = test_endpoint(endpoint, expected_status=expected)
        status = "✅" if result["success"] else "⚠️"
        print(f"{status} {endpoint}: {result['status']}")

    print("\n📊 Security Test Summary")
    print("=" * 50)

    total_tests = len(test_results)
    passed_tests = sum(1 for r in test_results if r["success"])

    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(
        f"Success rate: {(passed_tests/total_tests)*100:.1f}%"
        if total_tests > 0
        else "No tests run"
    )

    print("\n🔧 Recommendations:")
    if rate_test.get("rate_limiting_working", False):
        print("✅ Rate limiting is working")
    else:
        print("⚠️  Consider implementing rate limiting")

    if any(h.lower().startswith("x-") for h in result["headers"]):
        print("✅ Some security headers present")
    else:
        print("⚠️  Add security headers (X-Frame-Options, etc.)")

    if API_KEYS["admin"]:
        print("✅ API keys configured")
    else:
        print("⚠️  Configure API keys for authentication")

    print("\n🎯 Next Steps:")
    print("1. Fix any failed tests")
    print("2. Implement missing security headers")
    print("3. Set up Cloudflare Access for additional protection")
    print("4. Enable audit logging")
    print("5. Regular security reviews")


if __name__ == "__main__":
    # Load environment variables if .env exists
    if os.path.exists(".env"):
        with open(".env") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value

        # Reload API keys
        API_KEYS.update(
            {
                "admin": os.getenv("MCP_ADMIN_KEY", ""),
                "user": os.getenv("MCP_USER_KEY", ""),
                "public": os.getenv("MCP_PUBLIC_KEY", ""),
            }
        )

    run_security_tests()
