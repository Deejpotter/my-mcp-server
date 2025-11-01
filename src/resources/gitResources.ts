/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Git resources for MCP server.
 * Provides read-only git repository status information.
 *
 * References:
 * MCP Resources: https://modelcontextprotocol.io/docs/concepts/resources
 * Git Documentation: https://git-scm.com/doc
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Register git resources with the MCP server
 */
export function registerGitResources(server: McpServer) {
	// Register git://status resource
	server.registerResource(
		"git-status",
		"git://status",
		{
			title: "Git Status",
			description: "Current git repository status",
			mimeType: "text/plain",
		},
		async (uri) => {
			try {
				// Get git status
				const { stdout } = await execAsync("git status", {
					timeout: 10000,
					maxBuffer: 1024 * 1024,
				});

				return {
					contents: [
						{
							uri: uri.href,
							text: stdout.toString().trim(),
							mimeType: "text/plain",
						},
					],
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					contents: [
						{
							uri: uri.href,
							text: `Error getting git status: ${err.message}`,
							mimeType: "text/plain",
						},
					],
				};
			}
		}
	);
}
