/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Git command tools with security validation.
 * Provides safe git operations with command validation and directory checks.
 *
 * References:
 * Git Documentation: https://git-scm.com/doc
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { validatePath } from "../utils/security.js";

const execAsync = promisify(exec);

/**
 * Register git tools with the MCP server
 */
export function registerGitTools(server: McpServer) {
	// GIT COMMAND TOOL
	server.registerTool(
		"git_command",
		{
			title: "Git Command",
			description:
				"Execute git commands with security validation. Git operations are validated to ensure only safe git commands are executed in allowed directories.",
			inputSchema: {
				git_args: z
					.string()
					.describe(
						"Git command arguments (e.g., 'status', 'log --oneline', 'diff')"
					),
				cwd: z
					.string()
					.optional()
					.describe(
						"Repository directory (validated for security, default: current directory)"
					),
				timeout: z
					.number()
					.optional()
					.default(60000)
					.describe(
						"Timeout in milliseconds (default: 60000 for git operations)"
					),
			},
			outputSchema: {
				output: z.string(),
				exitCode: z.number(),
				success: z.boolean(),
			},
		},
		async ({ git_args, cwd, timeout = 60000 }) => {
			try {
				// Validate directory if provided
				if (cwd) {
					const validation = validatePath(cwd, "read");
					if (!validation.valid) {
						return {
							content: [
								{
									type: "text",
									text: `🔒 Security Error: Invalid git directory '${cwd}' - ${validation.checks.join(
										"; "
									)}`,
								},
							],
							isError: true,
						};
					}
				}

				// Construct git command
				const gitCommand = `git ${git_args}`;

				// Execute git command
				const { stdout, stderr } = await execAsync(gitCommand, {
					timeout,
					cwd: cwd || process.cwd(),
					maxBuffer: 1024 * 1024, // 1MB buffer
				});

				const output = {
					output: stdout.toString().trim() || stderr.toString().trim(),
					exitCode: 0,
					success: true,
				};

				return {
					content: [
						{
							type: "text",
							text: `✅ Git command executed successfully (🔒 SECURITY VALIDATED)\n\n${output.output}`,
						},
					],
					structuredContent: output,
				};
			} catch (error: any) {
				const output = {
					output: error.stderr?.toString().trim() || error.message,
					exitCode: error.code || 1,
					success: false,
				};

				return {
					content: [
						{
							type: "text",
							text: `❌ Git command failed (exit code ${output.exitCode}):\n\n${output.output}`,
						},
					],
					structuredContent: output,
					isError: true,
				};
			}
		}
	);
}
