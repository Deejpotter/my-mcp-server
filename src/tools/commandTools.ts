/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Security status tool.
 * Exposes the current security configuration (allowlist, forbidden paths, etc.)
 * for inspection by AI assistants.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSecurityConfig } from "../utils/security.js";

/**
 * Register security tools with the MCP server
 */
export function registerCommandTools(server: McpServer) {
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
