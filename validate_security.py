#!/usr/bin/env python3
"""
Security validation script for hardened MCP server functions
Created: 26/10/25
By: Daniel Potter

Simple validation script that tests core security functions without external dependencies.
Verifies that security hardening is working correctly across all modules.

Usage: python validate_security.py
"""

import os
import sys
import tempfile
from pathlib import Path
import asyncio

# Add src to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

try:
    from mcp_server.utils.security import (
        safe_read_file,
        safe_write_file,
        run_command,
        validate_file_path,
        filter_sensitive_environment,
        get_security_config,
        _validate_command_security,
    )
    from mcp_server.tools.file_operations import handle_file_operations
    from mcp_server.tools.system_commands import handle_system_commands
    from mcp_server.tools.search_tools import _validate_url_security

    print("✅ All security modules imported successfully")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


def test_path_traversal_protection():
    """Test path traversal attack prevention"""
    print("\n🔍 Testing Path Traversal Protection...")

    dangerous_paths = ["../../../etc/passwd", "/etc/shadow", "~/.ssh/id_rsa"]

    for path in dangerous_paths:
        try:
            safe_read_file(path)
            print(f"❌ SECURITY FAILURE: Path traversal not blocked for {path}")
            return False
        except ValueError as e:
            if "Access denied" in str(e) or "outside allowed directories" in str(e):
                print(f"✅ Path traversal blocked: {path}")
            else:
                print(f"⚠️ Unexpected error for {path}: {e}")

    return True


def test_command_injection_protection():
    """Test command injection attack prevention"""
    print("\n🔍 Testing Command Injection Protection...")

    malicious_commands = [
        "ls; rm -rf /",
        "echo hello && cat /etc/passwd",
        "ls | grep secret",
        "echo test `whoami`",
    ]

    for cmd in malicious_commands:
        result = run_command(cmd)
        if result["success"]:
            print(f"❌ SECURITY FAILURE: Command injection not blocked for: {cmd}")
            return False
        elif (
            "security" in result.get("error", "").lower()
            or result.get("security_check") == "FAILED"
        ):
            print(f"✅ Command injection blocked: {cmd}")
        else:
            print(
                f"⚠️ Command failed for other reason: {cmd} - {result.get('error', 'Unknown')}"
            )

    return True


def test_environment_filtering():
    """Test environment variable filtering"""
    print("\n🔍 Testing Environment Variable Filtering...")

    # Set some test environment variables
    original_env = os.environ.copy()
    os.environ["TEST_API_KEY"] = "secret123"
    os.environ["TEST_SECRET"] = "supersecret"
    os.environ["TEST_SAFE_VAR"] = "safe_value"

    try:
        filtered_env = filter_sensitive_environment()

        if "TEST_API_KEY" in filtered_env or "TEST_SECRET" in filtered_env:
            print("❌ SECURITY FAILURE: Sensitive environment variables not filtered")
            return False

        if "TEST_SAFE_VAR" not in filtered_env:
            print("❌ FAILURE: Safe environment variable was incorrectly filtered")
            return False

        print("✅ Environment variable filtering working correctly")
        return True

    finally:
        # Restore original environment
        os.environ.clear()
        os.environ.update(original_env)


def test_file_size_protection():
    """Test file size limit protection"""
    print("\n🔍 Testing File Size Protection...")

    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        # Create a small test file
        content = "A" * 100
        f.write(content)
        temp_path = f.name

    try:
        # Should work with normal size
        result = safe_read_file(temp_path, max_size=200)
        if len(result) != 100:
            print("❌ FAILURE: File reading returned wrong content")
            return False

        # Should fail with small limit
        try:
            safe_read_file(temp_path, max_size=50)
            print("❌ SECURITY FAILURE: File size limit not enforced")
            return False
        except ValueError as e:
            if "too large" in str(e):
                print("✅ File size protection working correctly")
                return True
            else:
                print(f"⚠️ Unexpected error: {e}")
                return False

    finally:
        os.unlink(temp_path)


def test_url_validation():
    """Test URL validation for SSRF protection"""
    print("\n🔍 Testing URL Validation (SSRF Protection)...")

    dangerous_urls = [
        "http://localhost:8080/admin",
        "http://127.0.0.1/sensitive",
        "http://10.0.0.1/internal",
        "file:///etc/passwd",
    ]

    for url in dangerous_urls:
        result = _validate_url_security(url)
        if result["valid"]:
            print(f"❌ SECURITY FAILURE: Dangerous URL not blocked: {url}")
            return False
        else:
            print(f"✅ Dangerous URL blocked: {url}")

    # Test safe URL
    safe_url = "https://www.google.com"
    result = _validate_url_security(safe_url)
    if not result["valid"]:
        print(f"❌ FAILURE: Safe URL incorrectly blocked: {safe_url}")
        return False

    print(f"✅ Safe URL allowed: {safe_url}")
    return True


def test_security_configuration():
    """Test security configuration"""
    print("\n🔍 Testing Security Configuration...")

    config = get_security_config()

    required_keys = [
        "allowed_commands",
        "hardening_enabled",
        "security_version",
        "command_allowlist_active",
        "path_validation_active",
    ]

    for key in required_keys:
        if key not in config:
            print(f"❌ FAILURE: Missing security config key: {key}")
            return False

    if not config["hardening_enabled"]:
        print("❌ SECURITY FAILURE: Security hardening not enabled")
        return False

    if not config["command_allowlist_active"]:
        print("❌ SECURITY FAILURE: Command allowlist not active")
        return False

    print("✅ Security configuration valid")
    return True


async def test_integration():
    """Test integration with tool handlers"""
    print("\n🔍 Testing Integration with Tool Handlers...")

    # Test file operations with invalid path
    try:
        result = await handle_file_operations("read_file", {"file_path": "/etc/passwd"})
        if len(result) > 0 and "Security Error" in result[0].text:
            print("✅ File operations security integration working")
        else:
            print(f"❌ FAILURE: File operations security not working. Result: {result}")
            return False
    except Exception as e:
        print(f"⚠️ Error testing file operations integration: {e}")
        return False

    # Test command execution with malicious command
    try:
        result = await handle_system_commands(
            "run_command", {"command": "ls && cat /etc/passwd"}
        )
        if len(result) > 0 and (
            "Security Error" in result[0].text or "failed" in result[0].text.lower()
        ):
            print("✅ Command execution security integration working")
            return True
        else:
            print(
                f"❌ FAILURE: Command execution security not working. Result: {result}"
            )
            return False
    except Exception as e:
        print(f"⚠️ Error testing command execution integration: {e}")
        return False


def main():
    """Run all security validation tests"""
    print("🔒 MCP Server Security Validation")
    print("=" * 50)

    tests = [
        ("Path Traversal Protection", test_path_traversal_protection),
        ("Command Injection Protection", test_command_injection_protection),
        ("Environment Filtering", test_environment_filtering),
        ("File Size Protection", test_file_size_protection),
        ("URL Validation", test_url_validation),
        ("Security Configuration", test_security_configuration),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")

    # Run async integration test
    try:
        if asyncio.run(test_integration()):
            passed += 1
        total += 1
    except Exception as e:
        print(f"❌ Integration test failed with exception: {e}")
        total += 1

    print("\n" + "=" * 50)
    print(f"🔒 Security Validation Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ ALL SECURITY TESTS PASSED - System is hardened")
        return 0
    else:
        print("❌ SECURITY FAILURES DETECTED - Review and fix issues")
        return 1


if __name__ == "__main__":
    sys.exit(main())
