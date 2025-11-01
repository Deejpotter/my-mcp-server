/**
 * System Resources
 *
 * Provides read-only access to system and workspace information
 * via MCP resources (URIs that can be read by AI clients).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as os from "os";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Register system resources with the MCP server
 */
export function registerSystemResources(server: McpServer) {
	// SYSTEM INFO RESOURCE (security-hardened - no sensitive paths/hostnames)
	server.registerResource(
		"system-info",
		"system://info",
		{
			title: "System Information",
			description: "Basic development environment details (no sensitive data)",
			mimeType: "text/plain",
		},
		async (uri) => {
			const info = `System Information
==================

Platform: ${os.platform()} (${os.arch()})
Node.js: ${process.version}
CPUs: ${os.cpus().length} cores
Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB total
System Uptime: ${Math.floor(os.uptime() / 3600)} hours

🔒 Security Note: Hostname and working directory paths are not exposed for privacy.
`;

			return {
				contents: [
					{
						uri: uri.href,
						text: info,
						mimeType: "text/plain",
					},
				],
			};
		}
	);

	// WORKSPACE INFO RESOURCE (security-hardened - no full paths)
	server.registerResource(
		"workspace-info",
		"workspace://info",
		{
			title: "Workspace Information",
			description: "Project structure and file statistics (no absolute paths)",
			mimeType: "text/plain",
		},
		async (uri) => {
			const cwd = process.cwd();

			try {
				// Count files in workspace
				const entries = await fs.readdir(cwd, { withFileTypes: true });
				const files = entries.filter((e) => e.isFile()).length;
				const dirs = entries.filter((e) => e.isDirectory()).length;

				// Check for common project files
				const projectFiles = [
					"package.json",
					"tsconfig.json",
					".git",
					"README.md",
				];
				const present = await Promise.all(
					projectFiles.map(async (file) => {
						try {
							await fs.access(path.join(cwd, file));
							return `✅ ${file}`;
						} catch {
							return `❌ ${file}`;
						}
					})
				);

				// Get just the project folder name (not full path)
				const projectName = path.basename(cwd);

				const info = `Workspace Information
====================

Project: ${projectName}
Files: ${files}
Directories: ${dirs}

Project Files:
${present.join("\n")}

🔒 Security Note: Full directory paths are not exposed for privacy.
`;

				return {
					contents: [
						{
							uri: uri.href,
							text: info,
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
							text: `Error reading workspace: ${err.message}`,
							mimeType: "text/plain",
						},
					],
				};
			}
		}
	);
}
