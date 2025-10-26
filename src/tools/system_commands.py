"""
System command tools for MCP server
Updated: 26/10/25
By: Daniel Potter

Enhanced system command execution with comprehensive security validation and injection protection.
All command operations now use hardened security functions with allowlist-based validation.

Security Enhancements:
- Command injection prevention through allowlist validation
- Shell metacharacter detection and blocking
- Environment variable filtering to prevent credential exposure
- Working directory validation against security policies
- Enhanced error reporting with security context

References:
CWE-78 Command Injection: https://cwe.mitre.org/data/definitions/78.html
Python subprocess Security: https://docs.python.org/3/library/subprocess.html#security-considerations
MCP Security Guidelines: https://modelcontextprotocol.io/docs/concepts/security
"""

from typing import Any, Dict, List

from mcp.types import Tool, TextContent
import mcp.types as types

from ..utils.security import (
    run_command,
    secure_run_command,
    validate_file_path,
    get_security_config,
)


def get_system_command_tools() -> List[Tool]:
    """
    Get all system command tool definitions with enhanced security documentation.

    All command operations now include comprehensive security validation:
    - Command allowlist validation prevents arbitrary code execution
    - Shell metacharacter detection blocks injection attacks
    - Environment filtering prevents credential exposure
    - Working directory validation ensures path safety

    Returns:
        List of Tool definitions with security-enhanced descriptions
    """
    return [
        Tool(
            name="run_command",
            description="Execute a shell command with comprehensive security validation. "
            "Commands are validated against an allowlist to prevent injection attacks. "
            "Only explicitly permitted commands and arguments are allowed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute (validated against security allowlist)",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory (validated for security, default: current directory)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 30, max: 300 for security)",
                        "default": 30,
                    },
                    "allow_dangerous": {
                        "type": "boolean",
                        "description": "Allow execution with reduced security checks (USE WITH EXTREME CAUTION)",
                        "default": False,
                    },
                },
                "required": ["command"],
            },
        ),
        Tool(
            name="git_command",
            description="Execute git commands with security validation. "
            "Git operations are validated to ensure only safe git commands "
            "and arguments are executed in allowed directories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "git_args": {
                        "type": "string",
                        "description": "Git command arguments (e.g., 'status', 'log --oneline', 'diff') - validated for security",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Repository directory (validated for security, default: current directory)",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 60 for git operations)",
                        "default": 60,
                    },
                },
                "required": ["git_args"],
            },
        ),
        Tool(
            name="security_status",
            description="Display current security configuration and validation status. "
            "Shows allowlisted commands, security settings, and validation policies.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


async def handle_system_commands(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """
    Handle system command tool calls with comprehensive security validation.

    All operations now include:
    - Pre-execution command validation against security allowlists
    - Working directory validation for path safety
    - Enhanced error reporting with security context
    - Command injection prevention and detection

    Args:
        name: Tool name to execute
        arguments: Tool arguments with validated commands and paths

    Returns:
        List of TextContent with operation results and security status
    """

    if name == "run_command":
        try:
            command = arguments.get("command", "")
            cwd = arguments.get("cwd")
            timeout = arguments.get("timeout", 30)
            allow_dangerous = arguments.get("allow_dangerous", False)

            if not command:
                return [
                    types.TextContent(
                        type="text", text="❌ Error: command is required for execution"
                    )
                ]

            # Validate working directory if provided
            if cwd:
                path_validation = validate_file_path(cwd, "read")
                if not path_validation["valid"]:
                    security_errors = "; ".join(path_validation["checks"])
                    return [
                        types.TextContent(
                            type="text",
                            text=f"🔒 Security Error: Invalid working directory '{cwd}' - {security_errors}",
                        )
                    ]

            # Execute command with appropriate security level
            if allow_dangerous:
                # Log security override for monitoring
                result = secure_run_command(command, cwd, timeout, allow_dangerous=True)
                security_status = "⚠️ SECURITY REDUCED"
            else:
                # Use hardened security validation
                result = run_command(command, cwd, timeout)
                security_status = "🔒 SECURITY VALIDATED"

            # Format response with security context
            if result["success"]:
                output = f"✅ Command executed successfully ({security_status})\n"
                output += f"📝 Command: {result['command']}\n"

                # Include security check results if available
                if "security_check" in result:
                    output += f"🔍 Security Check: {result['security_check']}\n"

                if "command_validated" in result:
                    output += f"✅ Validated Command: {result['command_validated']}\n"

                if result.get("stdout"):
                    output += f"📤 Output:\n{result['stdout']}"

                if result.get("stderr"):
                    output += f"⚠️ Stderr:\n{result['stderr']}"

                output += f"\n🔢 Return code: {result['returncode']}"

                # Add security warning if dangerous mode was used
                if allow_dangerous and "warning" in result:
                    output += f"\n⚠️ Security Warning: {result['warning']}"

                return [types.TextContent(type="text", text=output)]
            else:
                error_output = f"❌ Command failed ({security_status})\n"
                error_output += f"📝 Command: {result['command']}\n"
                error_output += f"💥 Error: {result['error']}\n"

                # Include security context in error
                if "security_check" in result:
                    error_output += f"🔍 Security Check: {result['security_check']}"

                return [types.TextContent(type="text", text=error_output)]

        except ValueError as e:
            # Security-related errors
            return [
                types.TextContent(
                    type="text", text=f"🔒 Security Error executing command: {str(e)}"
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error executing command: {str(e)}"
                )
            ]

    elif name == "git_command":
        try:
            git_args = arguments.get("git_args", "")
            cwd = arguments.get("cwd")
            timeout = arguments.get("timeout", 60)

            if not git_args:
                return [
                    types.TextContent(
                        type="text",
                        text="❌ Error: git_args is required for git operations",
                    )
                ]

            # Validate working directory if provided (should be git repository)
            if cwd:
                path_validation = validate_file_path(cwd, "read")
                if not path_validation["valid"]:
                    security_errors = "; ".join(path_validation["checks"])
                    return [
                        types.TextContent(
                            type="text",
                            text=f"🔒 Security Error: Invalid git directory '{cwd}' - {security_errors}",
                        )
                    ]

            # Construct and validate the full git command
            git_command = f"git {git_args}"
            result = run_command(git_command, cwd, timeout)

            # Format response with security context
            if result["success"]:
                output = (
                    f"✅ Git command executed successfully (🔒 SECURITY VALIDATED)\n"
                )
                output += f"📝 Command: {result['command']}\n"

                # Include security validation results
                if "security_check" in result:
                    output += f"🔍 Security Check: {result['security_check']}\n"

                if "command_validated" in result:
                    output += f"✅ Validated Command: {result['command_validated']}\n"

                if result.get("stdout"):
                    output += f"📤 Output:\n{result['stdout']}"

                if result.get("stderr"):
                    output += f"⚠️ Stderr:\n{result['stderr']}"

                output += f"\n🔢 Return code: {result['returncode']}"
                return [types.TextContent(type="text", text=output)]
            else:
                error_output = f"❌ Git command failed (🔒 SECURITY VALIDATED)\n"
                error_output += f"📝 Command: {result['command']}\n"
                error_output += f"💥 Error: {result['error']}\n"

                # Include security context in error
                if "security_check" in result:
                    error_output += f"🔍 Security Check: {result['security_check']}"

                return [types.TextContent(type="text", text=error_output)]

        except ValueError as e:
            # Security-related errors
            return [
                types.TextContent(
                    type="text",
                    text=f"🔒 Security Error executing git command: {str(e)}",
                )
            ]
        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error executing git command: {str(e)}"
                )
            ]

    elif name == "security_status":
        try:
            # Get current security configuration
            security_config = get_security_config()

            status_output = "🔒 MCP Server Security Status\n"
            status_output += "=" * 40 + "\n\n"

            status_output += (
                f"🛡️ Security Version: {security_config['security_version']}\n"
            )
            status_output += f"🔐 Hardening Enabled: {'✅ YES' if security_config['hardening_enabled'] else '❌ NO'}\n\n"

            status_output += "📋 Security Features:\n"
            status_output += f"  • Command Allowlist: {'✅ Active' if security_config['command_allowlist_active'] else '❌ Disabled'}\n"
            status_output += f"  • Path Validation: {'✅ Active' if security_config['path_validation_active'] else '❌ Disabled'}\n"
            status_output += f"  • Environment Filtering: {'✅ Active' if security_config['environment_filtering_active'] else '❌ Disabled'}\n\n"

            status_output += "📊 Configuration Summary:\n"
            status_output += f"  • Allowed Commands: {security_config['allowed_commands_count']} commands\n"
            status_output += f"  • Allowed Directories: {security_config['allowed_directories_count']} paths\n"
            status_output += f"  • Forbidden Paths: {security_config['forbidden_paths_count']} protected locations\n"
            status_output += f"  • Sensitive Patterns: {security_config['sensitive_patterns_count']} credential filters\n\n"

            status_output += "✅ Allowed Commands:\n"
            for cmd in security_config["allowed_commands"]:
                status_output += f"  • {cmd}\n"

            return [types.TextContent(type="text", text=status_output)]

        except Exception as e:
            return [
                types.TextContent(
                    type="text", text=f"❌ Error retrieving security status: {str(e)}"
                )
            ]

    else:
        return [
            types.TextContent(
                type="text", text=f"❌ Unknown system command tool: {name}"
            )
        ]
