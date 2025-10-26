"""
Enhanced security utilities with hardened protections
"""

import os
import shlex
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional


# Security configuration
ALLOWED_COMMANDS = {
    "git": ["status", "log", "diff", "show", "branch", "remote"],
    "ls": [],
    "pwd": [],
    "echo": [],
    "cat": [],
    "grep": [],
    "find": [],
    "which": [],
    "whoami": [],
}

ALLOWED_DIRECTORIES = [
    os.getcwd(),  # Current working directory
]

FORBIDDEN_PATHS = [
    "/etc",
    "/proc",
    "/sys",
    "/root",
    "/boot",
    "C:\\Windows",
    "C:\\System32",
    "C:\\Users\\Administrator",
    "~/.ssh",
    "~/.aws",
    "~/.config",
]

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
]


def validate_command(command: str) -> bool:
    """
    Validate if a command is allowed to be executed.

    Args:
        command: The command string to validate

    Returns:
        bool: True if command is allowed, False otherwise
    """
    try:
        cmd_parts = shlex.split(command)
        if not cmd_parts:
            return False

        base_cmd = cmd_parts[0]

        # Check if base command is allowed
        if base_cmd not in ALLOWED_COMMANDS:
            return False

        # For git commands, validate subcommand
        if base_cmd == "git" and len(cmd_parts) > 1:
            git_subcmd = cmd_parts[1]
            if git_subcmd not in ALLOWED_COMMANDS["git"]:
                return False

        # Check for dangerous patterns
        dangerous_patterns = ["|", "&", ";", "`", "$", ">", "<", ">>"]
        for pattern in dangerous_patterns:
            if pattern in command:
                return False

        return True

    except Exception:
        return False


def validate_file_path(file_path: str, operation: str = "read") -> bool:
    """
    Validate if a file path is safe to access.

    Args:
        file_path: Path to validate
        operation: Type of operation ("read" or "write")

    Returns:
        bool: True if path is safe, False otherwise
    """
    try:
        path = Path(file_path).resolve()

        # Check if path exists (for read operations)
        if operation == "read" and not path.exists():
            return False

        # Check against forbidden paths
        path_str = str(path)
        for forbidden in FORBIDDEN_PATHS:
            if path_str.startswith(forbidden) or path_str.startswith(
                os.path.expanduser(forbidden)
            ):
                return False

        # For write operations, ensure we're within allowed directories
        if operation == "write":
            allowed = False
            for allowed_dir in ALLOWED_DIRECTORIES:
                try:
                    path.relative_to(Path(allowed_dir).resolve())
                    allowed = True
                    break
                except ValueError:
                    continue
            if not allowed:
                return False

        return True

    except Exception:
        return False


def secure_read_file(file_path: str, max_size: int = 1024 * 1024) -> str:
    """
    Securely read a file with comprehensive safety checks.

    Args:
        file_path: Path to the file to read
        max_size: Maximum file size in bytes (default: 1MB)

    Returns:
        File content as string

    Raises:
        PermissionError: If file access is not allowed
        FileNotFoundError: If file doesn't exist
        ValueError: If file is too large
    """
    # Validate file path
    if not validate_file_path(file_path, "read"):
        raise PermissionError(f"Access denied to file: {file_path}")

    path = Path(file_path).resolve()

    # Check file size
    file_size = path.stat().st_size
    if file_size > max_size:
        raise ValueError(f"File too large: {file_size} bytes (max: {max_size})")

    # Check file type - only allow text files
    if file_size > 0:  # Don't check MIME for empty files
        try:
            # Try to read first few bytes to check if it's text
            with open(path, "rb") as f:
                sample = f.read(1024)
                if b"\x00" in sample:  # Binary file detection
                    raise ValueError("Binary files are not allowed")
        except Exception as e:
            raise ValueError(f"Unable to validate file type: {str(e)}")

    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except UnicodeDecodeError:
        raise ValueError("File encoding not supported")


def secure_write_file(
    file_path: str, content: str, max_size: int = 10 * 1024 * 1024
) -> None:
    """
    Securely write content to a file with safety checks.

    Args:
        file_path: Path to the file to write
        content: Content to write
        max_size: Maximum content size in bytes (default: 10MB)

    Raises:
        PermissionError: If file access is not allowed
        ValueError: If content is too large
    """
    # Validate file path
    if not validate_file_path(file_path, "write"):
        raise PermissionError(f"Write access denied to: {file_path}")

    # Check content size
    content_size = len(content.encode("utf-8"))
    if content_size > max_size:
        raise ValueError(f"Content too large: {content_size} bytes (max: {max_size})")

    # Validate content - no binary data
    try:
        content.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("Invalid content encoding")

    path = Path(file_path).resolve()

    # Create parent directories safely
    parent = path.parent
    if not parent.exists():
        # Ensure parent is within allowed directories
        if not validate_file_path(str(parent), "write"):
            raise PermissionError(f"Cannot create directory: {parent}")
        parent.mkdir(parents=True, exist_ok=True, mode=0o755)

    # Write file with restricted permissions
    path.write_text(content, encoding="utf-8")
    path.chmod(0o644)  # Read/write for owner, read for group/others


def secure_run_command(
    command: str, cwd: Optional[str] = None, timeout: int = 30
) -> Dict[str, Any]:
    """
    Execute shell commands with comprehensive security checks.

    Args:
        command: Shell command to execute
        cwd: Working directory (optional, must be validated)
        timeout: Timeout in seconds (max: 60)

    Returns:
        Dict containing success status, output, and error information

    Raises:
        PermissionError: If command is not allowed
        ValueError: If parameters are invalid
    """
    # Validate command
    if not validate_command(command):
        raise PermissionError(f"Command not allowed: {command}")

    # Validate timeout
    if timeout > 60:
        timeout = 60
    if timeout < 1:
        timeout = 1

    # Validate working directory
    if cwd and not validate_file_path(cwd, "read"):
        raise PermissionError(f"Access denied to directory: {cwd}")

    try:
        # Split command safely
        cmd_parts = shlex.split(command)

        # Execute with restricted environment
        restricted_env = get_restricted_environment()

        result = subprocess.run(
            cmd_parts,
            shell=False,  # Never use shell=True
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=restricted_env,
        )

        # Limit output size
        max_output = 100 * 1024  # 100KB
        stdout = result.stdout[:max_output] if result.stdout else ""
        stderr = result.stderr[:max_output] if result.stderr else ""

        if len(result.stdout or "") > max_output:
            stdout += "\n... (output truncated)"
        if len(result.stderr or "") > max_output:
            stderr += "\n... (error output truncated)"

        return {
            "success": result.returncode == 0,
            "stdout": stdout,
            "stderr": stderr,
            "returncode": result.returncode,
            "command": command,
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"Command timed out after {timeout} seconds",
            "command": command,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Command execution failed: {str(e)}",
            "command": command,
        }


def get_restricted_environment() -> Dict[str, str]:
    """
    Get a restricted environment for command execution.

    Returns:
        Dict with essential environment variables only
    """
    essential_vars = [
        "PATH",
        "HOME",
        "USER",
        "TERM",
        "LANG",
        "LC_ALL",
        "PWD",
        "SHELL",
        "TMPDIR",
        "TMP",
        "TEMP",
    ]

    restricted_env = {}
    for var in essential_vars:
        if var in os.environ:
            restricted_env[var] = os.environ[var]

    return restricted_env


def filter_sensitive_environment() -> Dict[str, str]:
    """
    Filter environment variables to hide sensitive information.

    Returns:
        Dict with sensitive values redacted
    """
    filtered_env = {}

    for key, value in os.environ.items():
        # Check if key contains sensitive patterns
        is_sensitive = any(pattern in key.upper() for pattern in SENSITIVE_ENV_PATTERNS)

        if is_sensitive:
            filtered_env[key] = "***REDACTED***"
        else:
            # Still redact values that look like secrets
            if (
                len(value) > 20
                and any(
                    char in value
                    for char in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                )
                and not value.startswith(("/", "C:\\", "~"))
            ):  # Not a path
                filtered_env[key] = "***REDACTED***"
            else:
                filtered_env[key] = value

    return filtered_env


# Legacy compatibility functions (deprecated)
def safe_read_file(file_path: str, max_size: int = 1024 * 1024) -> str:
    """Legacy function - use secure_read_file instead"""
    return secure_read_file(file_path, max_size)


def safe_write_file(file_path: str, content: str) -> None:
    """Legacy function - use secure_write_file instead"""
    return secure_write_file(file_path, content)


def run_command(
    command: str, cwd: Optional[str] = None, timeout: int = 30
) -> Dict[str, Any]:
    """Legacy function - use secure_run_command instead"""
    return secure_run_command(command, cwd, timeout)
