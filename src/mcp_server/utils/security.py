"""
Security and file operation utilities for MCP server
Updated: 26/10/25
By: Daniel Potter

Enhanced security utilities with hardened protections against command injection,
path traversal, and credential exposure. Maintains backward compatibility while
adding comprehensive input validation and access controls.

References:
MCP Security Guidelines: https://modelcontextprotocol.io/docs/concepts/security
Python subprocess Security: https://docs.python.org/3/library/subprocess.html#security-considerations
OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
"""

import os
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional

# Security configuration - allowlist approach for maximum protection
# Only explicitly allowed commands can be executed to prevent injection attacks
ALLOWED_COMMANDS = {
    "git": ["status", "log", "diff", "show", "branch", "remote", "rev-parse"],
    "ls": [],
    "pwd": [],
    "echo": [],
    "cat": [],
    "grep": ["-n", "-i", "-r"],  # Safe grep options only
    "find": ["-name", "-type", "-maxdepth"],  # Restricted find options
    "which": [],
    "whoami": [],
}

# Directory access control - only allow operations within safe directories
# Prevents path traversal attacks by restricting file operations to allowed paths
ALLOWED_DIRECTORIES = [
    os.getcwd(),  # Current working directory and subdirectories
    tempfile.gettempdir(),  # System temp directory for legitimate temporary files
]

# System path protection - block access to sensitive system directories
# Prevents reading configuration files, credentials, and system binaries
FORBIDDEN_PATHS = [
    "/etc",
    "/proc",
    "/sys",
    "/root",
    "/boot",
    "/dev",
    "C:\\Windows",
    "C:\\System32",
    "C:\\Users\\Administrator",
    "~/.ssh",
    "~/.aws",
    "~/.config",
    "~/.gnupg",
]

# Environment variable protection - comprehensive pattern matching for credentials
# Prevents accidental exposure of API keys, tokens, and other sensitive data
SENSITIVE_ENV_PATTERNS = [
    "_KEY",
    "_TOKEN",
    "_SECRET",
    "_PASSWORD",
    "_AUTH",
    "_PRIVATE",
    "_CREDENTIAL",
    "API_",
    "SECRET_",
    "GITHUB_",
    "CLICKUP_",
    "CONTEXT7_",
    "BOOKSTACK_",
    "_PASS",
    "BEARER_",
    "CTX7SK",
    "GHP_",
    "AKIA",  # Specific API key prefixes
]


def _is_path_allowed(path: Path) -> bool:
    """
    Validate that a file path is within allowed directories.

    Implementation uses canonical path resolution to prevent traversal attacks.
    Only paths within ALLOWED_DIRECTORIES and their subdirectories are permitted.

    Args:
        path: Resolved Path object to validate

    Returns:
        True if path is allowed, False otherwise

    References:
    CWE-22 Path Traversal: https://cwe.mitre.org/data/definitions/22.html
    """
    try:
        path_str = str(path)
        for allowed_dir in ALLOWED_DIRECTORIES:
            allowed_path = Path(allowed_dir).resolve()
            if path.is_relative_to(allowed_path):
                return True
        return False
    except (OSError, ValueError):
        return False


def _is_path_forbidden(path: Path) -> bool:
    """
    Check if path accesses forbidden system directories.

    Provides defense-in-depth by blocking access to sensitive system paths
    even if they might be within allowed directories due to symlinks.

    Args:
        path: Resolved Path object to check

    Returns:
        True if path is forbidden, False if safe to access
    """
    path_str = str(path).lower()
    for forbidden in FORBIDDEN_PATHS:
        forbidden_resolved = os.path.expanduser(forbidden).lower()
        if path_str.startswith(forbidden_resolved):
            return True
    return False


def _validate_command_security(command: str) -> Dict[str, Any]:
    """
    Comprehensive command validation against injection attacks.

    Uses allowlist approach - only explicitly permitted commands and arguments
    are allowed. Prevents arbitrary command execution through input validation.

    Args:
        command: Command string to validate

    Returns:
        Dict with validation results and parsed components

    Security Design:
    - Allowlist approach prevents unknown commands
    - Argument validation prevents injection via command parameters
    - Shell metacharacter detection catches injection attempts
    """
    # Parse command safely using shlex to handle quoting correctly
    try:
        parts = shlex.split(command.strip())
    except ValueError as e:
        return {
            "valid": False,
            "error": f"Command parsing failed: {e}",
            "command": command,
        }

    if not parts:
        return {
            "valid": False,
            "error": "Empty command not allowed",
            "command": command,
        }

    cmd_name = parts[0]
    cmd_args = parts[1:] if len(parts) > 1 else []

    # Check if base command is in allowlist
    if cmd_name not in ALLOWED_COMMANDS:
        return {
            "valid": False,
            "error": f"Command '{cmd_name}' not in allowlist",
            "command": command,
        }

    # Validate arguments against allowed parameters for this command
    allowed_args = ALLOWED_COMMANDS[cmd_name]
    if allowed_args:  # If command has restricted arguments
        for arg in cmd_args:
            if arg.startswith("-") and arg not in allowed_args:
                return {
                    "valid": False,
                    "error": f"Argument '{arg}' not allowed for command '{cmd_name}'",
                    "command": command,
                }

    # Additional security: detect shell metacharacters that could enable injection
    dangerous_chars = ["|", "&", ";", "$(", "`", ">", "<", "*"]
    for char in dangerous_chars:
        if char in command:
            return {
                "valid": False,
                "error": f"Dangerous character '{char}' detected in command",
                "command": command,
            }

    return {
        "valid": True,
        "command_name": cmd_name,
        "arguments": cmd_args,
        "original": command,
    }


def filter_sensitive_environment() -> Dict[str, str]:
    """
    Create filtered environment dictionary excluding sensitive variables.

    Prevents accidental exposure of credentials, API keys, and tokens in
    command output or error messages. Uses pattern matching for comprehensive
    detection of sensitive variable names.

    Returns:
        Filtered environment dictionary safe for exposure

    Security Design:
    - Pattern-based detection catches various naming conventions
    - Case-insensitive matching prevents bypass attempts
    - Preserves necessary system variables while filtering credentials
    """
    filtered_env = {}

    for key, value in os.environ.items():
        # Check if variable name matches sensitive patterns
        is_sensitive = any(
            pattern.lower() in key.lower() for pattern in SENSITIVE_ENV_PATTERNS
        )

        if not is_sensitive:
            filtered_env[key] = value
        # else: silently exclude sensitive variables

    return filtered_env


def safe_read_file(file_path: str, max_size: int = 1024 * 1024) -> str:
    """
    Securely read file contents with comprehensive protection against path traversal
    and unauthorized access. Validates path safety and enforces size limits.

    Enhanced security measures:
    - Path traversal prevention through canonical path resolution
    - Directory access validation against allowlist
    - File size limits to prevent memory exhaustion attacks
    - Forbidden path checking to protect system files

    Args:
        file_path: Target file path (validated for security)
        max_size: Maximum file size in bytes (default 1MB for protection)

    Returns:
        File contents as string

    Raises:
        ValueError: Path validation failures or security violations
        FileNotFoundError: File does not exist
        PermissionError: Insufficient permissions

    References:
    OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
    """
    # Convert to absolute path and resolve all symbolic links/references
    # This prevents path traversal attacks using ../../../etc/passwd patterns
    try:
        abs_path = Path(file_path).resolve(strict=True)
    except (OSError, RuntimeError) as e:
        raise ValueError(f"Invalid file path: {e}")

    # Validate the resolved path is within allowed directories
    # Ensures we can only access files in approved locations
    if not _is_path_allowed(abs_path):
        raise ValueError(f"Access denied: {abs_path} is outside allowed directories")

    # Check against forbidden system paths for additional protection
    # Prevents access to sensitive configuration and credential files
    if _is_path_forbidden(abs_path):
        raise ValueError(f"Access denied: {abs_path} is a protected system path")

    # Verify file exists and is actually a file (not directory)
    if not abs_path.is_file():
        raise FileNotFoundError(f"File not found: {abs_path}")

    # Enforce file size limits to prevent memory exhaustion attacks
    # Large files could cause DoS by consuming excessive memory
    file_size = abs_path.stat().st_size
    if file_size > max_size:
        raise ValueError(f"File too large: {file_size} bytes (max: {max_size})")

    # Read file with explicit encoding and error handling
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except UnicodeDecodeError:
        # Fallback for binary files - read as bytes and decode safely
        with open(abs_path, "rb") as f:
            return f.read().decode("utf-8", errors="replace")


def safe_write_file(file_path: str, content: str) -> None:
    """
    Securely write content to a file with comprehensive path validation
    and directory access controls. Prevents unauthorized file creation.

    Enhanced security measures:
    - Path traversal prevention through canonical path resolution
    - Directory access validation against allowlist
    - Forbidden path checking to protect system directories
    - Safe directory creation with proper permissions

    Args:
        file_path: Target file path (validated for security)
        content: Content to write to file

    Raises:
        ValueError: Path validation failures or security violations
        PermissionError: Insufficient permissions for write operation

    References:
    CWE-22 Path Traversal: https://cwe.mitre.org/data/definitions/22.html
    """
    # Convert to absolute path and resolve all symbolic links/references
    # This prevents path traversal attacks and ensures we know the real destination
    try:
        abs_path = Path(file_path).resolve()
    except (OSError, RuntimeError) as e:
        raise ValueError(f"Invalid file path: {e}")

    # Validate the resolved path is within allowed directories
    # Ensures we can only write files in approved locations
    if not _is_path_allowed(abs_path):
        raise ValueError(f"Access denied: {abs_path} is outside allowed directories")

    # Check against forbidden system paths for additional protection
    # Prevents writing to sensitive system directories
    if _is_path_forbidden(abs_path):
        raise ValueError(f"Access denied: {abs_path} is a protected system path")

    # Validate parent directory is also allowed before creating
    parent_path = abs_path.parent
    if not _is_path_allowed(parent_path):
        raise ValueError(
            f"Access denied: Parent directory {parent_path} is not allowed"
        )

    # Create directory structure safely with proper permissions
    try:
        parent_path.mkdir(parents=True, exist_ok=True, mode=0o755)
    except OSError as e:
        raise PermissionError(f"Cannot create directory {parent_path}: {e}")

    # Write file with explicit encoding and safe error handling
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
    except OSError as e:
        raise PermissionError(f"Cannot write to file {abs_path}: {e}")


def run_command(command: str, cwd: str = None, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute shell commands with comprehensive security validation and injection protection.

    SECURITY WARNING: This function has been hardened against command injection attacks.
    Only allowlisted commands with validated arguments are permitted for execution.

    Enhanced security measures:
    - Command allowlist prevents arbitrary code execution
    - Argument validation blocks injection via parameters
    - Shell metacharacter detection catches bypass attempts
    - Environment variable filtering prevents credential exposure
    - Timeout protection prevents resource exhaustion

    Args:
        command: Shell command to execute (validated against allowlist)
        cwd: Working directory (optional, must be within allowed paths)
        timeout: Timeout in seconds (default: 30, max: 300)

    Returns:
        Dict containing execution results and security validation info

    Raises:
        ValueError: Command validation failures or security violations

    References:
    CWE-78 Command Injection: https://cwe.mitre.org/data/definitions/78.html
    Python subprocess Security: https://docs.python.org/3/library/subprocess.html#security-considerations
    """
    # Validate timeout to prevent extremely long-running processes
    if timeout > 300:  # 5 minute maximum
        raise ValueError(f"Timeout too long: {timeout}s (max: 300s)")

    # Comprehensive command security validation
    validation_result = _validate_command_security(command)
    if not validation_result["valid"]:
        return {
            "success": False,
            "error": f"Security validation failed: {validation_result['error']}",
            "command": command,
            "security_check": "FAILED",
        }

    # Validate working directory if provided
    if cwd:
        try:
            cwd_path = Path(cwd).resolve()
            if not _is_path_allowed(cwd_path):
                return {
                    "success": False,
                    "error": f"Working directory not allowed: {cwd}",
                    "command": command,
                    "security_check": "FAILED",
                }
        except (OSError, RuntimeError) as e:
            return {
                "success": False,
                "error": f"Invalid working directory: {e}",
                "command": command,
                "security_check": "FAILED",
            }

    # Create filtered environment to prevent credential exposure
    # Use sanitized environment that excludes sensitive variables
    safe_env = filter_sensitive_environment()

    try:
        # Execute command with security protections
        # Using shell=False and list of arguments prevents injection
        cmd_parts = shlex.split(command)
        result = subprocess.run(
            cmd_parts,  # Use parsed command parts instead of shell=True
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=safe_env,  # Use filtered environment
            shell=False,  # Critical: Never use shell=True for security
        )

        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "command": command,
            "security_check": "PASSED",
            "command_validated": validation_result["command_name"],
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"Command timed out after {timeout} seconds",
            "command": command,
            "security_check": "TIMEOUT",
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": f"Command not found: {validation_result['command_name']}",
            "command": command,
            "security_check": "COMMAND_NOT_FOUND",
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Execution error: {str(e)}",
            "command": command,
            "security_check": "EXECUTION_ERROR",
        }


# Backward compatibility and enhanced security functions
# These functions provide additional security features while maintaining API compatibility


def secure_run_command(
    command: str, cwd: str = None, timeout: int = 30, allow_dangerous: bool = False
) -> Dict[str, Any]:
    """
    Enhanced version of run_command with explicit security controls.

    This function provides the same interface as run_command but with
    additional security controls and explicit dangerous operation handling.

    Args:
        command: Shell command to execute
        cwd: Working directory (optional)
        timeout: Timeout in seconds
        allow_dangerous: If True, bypasses some security checks (USE WITH CAUTION)

    Returns:
        Dict containing execution results with enhanced security metadata
    """
    if allow_dangerous:
        # Log dangerous operation for security monitoring
        import logging

        logging.warning(f"SECURITY: Dangerous command execution allowed: {command}")

        # Fall back to less secure but more permissive execution
        # This is for backward compatibility with existing functionality
        try:
            result = subprocess.run(
                command,
                shell=True,  # Allow shell for backward compatibility
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=filter_sensitive_environment(),  # Still filter environment
            )
            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "command": command,
                "security_check": "BYPASSED_DANGEROUS",
                "warning": "Command executed with reduced security checks",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "command": command,
                "security_check": "BYPASSED_ERROR",
            }
    else:
        # Use secure command execution
        return run_command(command, cwd, timeout)


def validate_file_path(file_path: str, operation: str = "read") -> Dict[str, Any]:
    """
    Standalone path validation function for external use.

    Provides path security validation that can be used by other modules
    to check file access before performing operations.

    Args:
        file_path: Path to validate
        operation: Type of operation ("read", "write", "execute")

    Returns:
        Dict with validation results and normalized path
    """
    try:
        abs_path = Path(file_path).resolve()

        validation_result = {
            "valid": True,
            "path": str(abs_path),
            "operation": operation,
            "checks": [],
        }

        # Check path allowlist
        if not _is_path_allowed(abs_path):
            validation_result["valid"] = False
            validation_result["checks"].append("Path outside allowed directories")

        # Check forbidden paths
        if _is_path_forbidden(abs_path):
            validation_result["valid"] = False
            validation_result["checks"].append("Path is in forbidden system directory")

        # Operation-specific checks
        if operation == "write":
            parent_path = abs_path.parent
            if not _is_path_allowed(parent_path):
                validation_result["valid"] = False
                validation_result["checks"].append("Parent directory not allowed")

        if not validation_result["checks"]:
            validation_result["checks"].append("All security checks passed")

        return validation_result

    except (OSError, RuntimeError) as e:
        return {
            "valid": False,
            "error": f"Path resolution failed: {e}",
            "operation": operation,
            "checks": ["Path resolution error"],
        }


def get_security_config() -> Dict[str, Any]:
    """
    Return current security configuration for monitoring and debugging.

    Provides visibility into security settings without exposing sensitive
    information. Useful for troubleshooting and security audits.

    Returns:
        Dict containing security configuration summary
    """
    return {
        "allowed_commands": list(ALLOWED_COMMANDS.keys()),
        "allowed_directories_count": len(ALLOWED_DIRECTORIES),
        "forbidden_paths_count": len(FORBIDDEN_PATHS),
        "sensitive_patterns_count": len(SENSITIVE_ENV_PATTERNS),
        "security_version": "1.0.0",
        "hardening_enabled": True,
        "command_allowlist_active": True,
        "path_validation_active": True,
        "environment_filtering_active": True,
    }
