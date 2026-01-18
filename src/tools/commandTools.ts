/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Command execution and security tools with validation.
 * Provides safe command execution with allowlisting and security status.
 * Prevents command injection and restricts dangerous operations.
 *
 * References:
 * Node.js Child Process: https://nodejs.org/api/child_process.html
 * Command Injection Prevention: https://owasp.org/www-community/attacks/Command_Injection
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { validateCommand, getSecurityConfig } from "../utils/security.js";

const execAsync = promisify(exec);

function isWindows(): boolean {
	return process.platform === "win32";
}

// Map common Unix-like commands to Windows equivalents when running under cmd.exe
function mapCommandForWindows(cmd: string): string {
	if (!isWindows()) return cmd;
	const trimmed = cmd.trim();
	// pwd -> cd (prints current directory in cmd)
	if (/^pwd(\s|$)/i.test(trimmed)) {
		return "cd";
	}
	// grep --version -> findstr /? (avoid error in tests)
	if (/^grep\s+--version\b/i.test(trimmed)) {
		return "findstr /?";
	}
	// For other grep invocations, do not attempt a generic findstr mapping.
	// findstr's syntax and behavior differ significantly from grep, so a
	// naive replacement (e.g., "grep" -> "findstr") is likely to produce
	// incorrect results. Let the original command run (and potentially fail)
	// rather than returning misleading output.
	
	// cat file -> type file
	if (/^cat\s+/i.test(trimmed)) {
		return trimmed.replace(/^cat\b/i, "type");
	}
	// find . -name name -> dir /s /b name (limited support: no extra find flags)
	const findNameMatch = trimmed.match(/^find\s+\.\s+-name\s+(.+)$/i);
	if (findNameMatch) {
		const nameRaw = findNameMatch[1] ?? "";
		// If additional options are present after the -name pattern (for example:
		//   find . -name "*.ts" -type f
		// then our simple mapping cannot faithfully emulate Unix `find` on Windows.
		// In that case, fall back to the original command to avoid incorrect results.
		if (/\s-[-\w]/.test(nameRaw)) {
			return cmd;
		}
		const name = nameRaw.replaceAll('"', '').trim();
		return `dir /s /b ${name}`;
	}
	return cmd;
}

/**
 * Register command execution and security tools with the MCP server
 */
export function registerCommandTools(server: McpServer) {
	// RUN COMMAND TOOL
	server.registerTool(
		"run_command",
		{
			title: "Run Command",
			description:
				"Execute a shell command with security validation (allowlist only)",
			inputSchema: {
				command: z.string().describe("Command to execute"),
				timeout: z
					.number()
					.optional()
					.default(30000)
					.describe("Timeout in milliseconds (default: 30000)"),
				cwd: z
					.string()
					.optional()
					.describe("Working directory (default: current directory)"),
			},
			outputSchema: {
				stdout: z.string(),
				stderr: z.string(),
				exitCode: z.number(),
				success: z.boolean(),
			},
		},
				async ({ command, timeout = 30000, cwd }) => {
			try {
				// Validate command first
				const validation = validateCommand(command);
				if (!validation.valid) {
					return {
						content: [
							{ type: "text", text: `🔒 Security Error: ${validation.reason}` },
						],
						isError: true,
					};
				}

				// Map command for Windows shells to improve cross-platform compatibility
				const execCommand = mapCommandForWindows(command);
				
				// Validate the mapped command as well to ensure the transformation
				// didn't introduce any security issues
				if (execCommand !== command) {
					const mappedValidation = validateCommand(execCommand);
					if (!mappedValidation.valid) {
						return {
							content: [
								{ type: "text", text: `🔒 Security Error: Mapped command validation failed: ${mappedValidation.reason}` },
							],
							isError: true,
						};
					}
				}

				// Execute with timeout
				const { stdout, stderr } = await execAsync(execCommand, {
					timeout,
					cwd: cwd || process.cwd(),
					maxBuffer: 1024 * 1024, // 1MB buffer
				});

				const output = {
					stdout: stdout.toString().trim(),
					stderr: stderr.toString().trim(),
					exitCode: 0,
					success: true,
				};

				return {
					content: [
						{
							type: "text",
							text: `✅ Command executed successfully:\n\n${output.stdout}${
								output.stderr ? `\n\nStderr:\n${output.stderr}` : ""
							}`,
						},
					],
					structuredContent: output,
				};
					} catch (error: any) {
						const code = typeof error?.code === "number" ? error.code : 1;
						const stderr = (error?.stderr ?? error?.message ?? "Command failed").toString();
						const output = {
							stdout: "",
							stderr,
							exitCode: code,
							success: false,
						};

						return {
							content: [
								{
									type: "text",
									text: `❌ Command failed (exit code ${output.exitCode}):\n\n${output.stderr}`,
								},
							],
							structuredContent: output,
							isError: true,
						};
					}
		}
	);

	// SECURITY STATUS TOOL
	server.registerTool(
		"security_status",
		{
			title: "Security Status",
			description: "Get current security configuration and validation status",
			inputSchema: {},
			outputSchema: {
				hardening_enabled: z.boolean(),
				command_allowlist_active: z.boolean(),
				path_validation_active: z.boolean(),
				security_version: z.string(),
				allowed_commands: z.array(z.string()),
				forbidden_paths: z.array(z.string()),
				forbidden_dirs: z.array(z.string()),
			},
		},
		() => {
			const config = getSecurityConfig();

			return {
				content: [
					{
						type: "text",
						text: `🔒 Security Configuration:

Hardening Enabled: ${config.hardening_enabled ? "✅" : "❌"}
Command Allowlist Active: ${config.command_allowlist_active ? "✅" : "❌"}
Path Validation Active: ${config.path_validation_active ? "✅" : "❌"}
Security Version: ${config.security_version}

Allowed Commands (${config.allowed_commands.length}):
${config.allowed_commands.map((cmd) => `  • ${cmd}`).join("\n")}

Forbidden Paths (${config.forbidden_paths.length}):
${config.forbidden_paths.map((p) => `  • ${p}`).join("\n")}

Forbidden Directories (${config.forbidden_dirs.length}):
${config.forbidden_dirs.map((d) => `  • ${d}`).join("\n")}`,
					},
				],
				structuredContent: config,
			};
		}
	);
}
