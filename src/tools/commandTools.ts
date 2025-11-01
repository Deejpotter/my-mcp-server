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

				// Execute with timeout
				const { stdout, stderr } = await execAsync(command, {
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
				const output = {
					stdout: error.stdout?.toString().trim() || "",
					stderr: error.stderr?.toString().trim() || error.message,
					exitCode: error.code || 1,
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
		async () => {
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
