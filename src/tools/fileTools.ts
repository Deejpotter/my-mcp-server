/**
 * File Operations Tools
 *
 * Provides secure file read/write/list operations with comprehensive
 * security validation and path traversal protection.
 *
 * All tools use Zod for schema validation and return structured output.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

/**
 * Validate file path for security (prevent path traversal)
 */
function validatePath(
	filePath: string,
	_operation: "read" | "write" | "list"
): { valid: boolean; error?: string } {
	const resolved = path.resolve(filePath);
	const cwd = process.cwd();

	// Ensure path is within working directory (prevent path traversal)
	if (!resolved.startsWith(cwd)) {
		return {
			valid: false,
			error: "Path traversal detected - path must be within working directory",
		};
	}

	// Block access to sensitive directories
	const forbiddenPaths = [".git", "node_modules", ".env"];
	const relativePath = path.relative(cwd, resolved);

	for (const forbidden of forbiddenPaths) {
		if (
			relativePath.startsWith(forbidden) ||
			relativePath.includes(`${path.sep}${forbidden}${path.sep}`)
		) {
			return { valid: false, error: `Access to ${forbidden} is forbidden` };
		}
	}

	return { valid: true };
}

/**
 * Register file operation tools with the MCP server
 */
export function registerFileTools(server: McpServer) {
	// READ FILE TOOL
	server.registerTool(
		"read_file",
		{
			title: "Read File",
			description: "Read the contents of a file with security validation",
			inputSchema: {
				file_path: z.string().describe("Path to the file to read"),
				max_size: z
					.number()
					.optional()
					.default(1024 * 1024)
					.describe("Maximum file size in bytes (default: 1MB)"),
			},
			outputSchema: {
				content: z.string(),
				size: z.number(),
				path: z.string(),
			},
		},
		async ({ file_path, max_size = 1024 * 1024 }) => {
			try {
				// Security validation
				const validation = validatePath(file_path, "read");
				if (!validation.valid) {
					return {
						content: [
							{ type: "text", text: `🔒 Security Error: ${validation.error}` },
						],
						isError: true,
					};
				}

				// Check file exists
				const stats = await fs.stat(file_path);

				if (!stats.isFile()) {
					return {
						content: [{ type: "text", text: "❌ Path is not a file" }],
						isError: true,
					};
				}

				// Check file size
				if (stats.size > max_size) {
					return {
						content: [
							{
								type: "text",
								text: `🔒 File too large: ${stats.size} bytes exceeds ${max_size} bytes limit`,
							},
						],
						isError: true,
					};
				}

				// Read file
				const content = await fs.readFile(file_path, "utf-8");
				const output = {
					content,
					size: stats.size,
					path: path.resolve(file_path),
				};

				return {
					content: [
						{
							type: "text",
							text: `📖 File read successfully (${stats.size} bytes)\n\n${content}`,
						},
					],
					structuredContent: output,
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{ type: "text", text: `❌ Error reading file: ${err.message}` },
					],
					isError: true,
				};
			}
		}
	);

	// WRITE FILE TOOL
	server.registerTool(
		"write_file",
		{
			title: "Write File",
			description: "Write content to a file with security validation",
			inputSchema: {
				file_path: z.string().describe("Path to the file to write"),
				content: z.string().describe("Content to write to the file"),
			},
			outputSchema: {
				success: z.boolean(),
				path: z.string(),
				size: z.number(),
			},
		},
		async ({ file_path, content }) => {
			try {
				// Security validation
				const validation = validatePath(file_path, "write");
				if (!validation.valid) {
					return {
						content: [
							{ type: "text", text: `🔒 Security Error: ${validation.error}` },
						],
						isError: true,
					};
				}

				// Ensure directory exists
				const dir = path.dirname(file_path);
				await fs.mkdir(dir, { recursive: true });

				// Write file
				await fs.writeFile(file_path, content, "utf-8");
				const size = Buffer.byteLength(content, "utf-8");

				const output = {
					success: true,
					path: path.resolve(file_path),
					size,
				};

				return {
					content: [
						{
							type: "text",
							text: `✅ File written successfully: ${file_path} (${size} bytes)`,
						},
					],
					structuredContent: output,
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{ type: "text", text: `❌ Error writing file: ${err.message}` },
					],
					isError: true,
				};
			}
		}
	);

	// LIST FILES TOOL
	server.registerTool(
		"list_files",
		{
			title: "List Files",
			description:
				"List files in a directory with optional glob pattern and recursive search",
			inputSchema: {
				directory: z
					.string()
					.optional()
					.default(".")
					.describe("Directory to list"),
				pattern: z
					.string()
					.optional()
					.default("*")
					.describe("Glob pattern (e.g., *.ts, **/*.json)"),
				recursive: z
					.boolean()
					.optional()
					.default(false)
					.describe("Search recursively"),
			},
			outputSchema: {
				files: z.array(z.string()),
				count: z.number(),
				directory: z.string(),
			},
		},
		async ({ directory = ".", pattern = "*", recursive = false }) => {
			try {
				// Security validation
				const validation = validatePath(directory, "list");
				if (!validation.valid) {
					return {
						content: [
							{ type: "text", text: `🔒 Security Error: ${validation.error}` },
						],
						isError: true,
					};
				}

				// Check directory exists
				const stats = await fs.stat(directory);
				if (!stats.isDirectory()) {
					return {
						content: [{ type: "text", text: "❌ Path is not a directory" }],
						isError: true,
					};
				}

				// Build glob pattern
				const searchPattern = recursive
					? path.join(directory, "**", pattern)
					: path.join(directory, pattern);

				// Find files
				const files = await glob(searchPattern, {
					nodir: true,
					absolute: false,
				});

				// Validate each file path
				const validFiles = files.filter(
					(file) => validatePath(file, "read").valid
				);

				const output = {
					files: validFiles.sort(),
					count: validFiles.length,
					directory: path.resolve(directory),
				};

				const fileList =
					validFiles.length > 0
						? validFiles.map((f) => `📄 ${f}`).join("\n")
						: "📭 No files found";

				return {
					content: [
						{
							type: "text",
							text: `📂 Files in ${directory}:\n${fileList}\n\nTotal: ${validFiles.length} files`,
						},
					],
					structuredContent: output,
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{ type: "text", text: `❌ Error listing files: ${err.message}` },
					],
					isError: true,
				};
			}
		}
	);
}
