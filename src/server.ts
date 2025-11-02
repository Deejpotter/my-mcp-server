/**
 * MCP Server - TypeScript Implementation
 *
 * Entry point for the Model Context Protocol server.
 * This server exposes tools, resources, and prompts via stdio transport
 * for integration with VS Code, GitHub Copilot, and other MCP clients.
 *
 * Architecture:
 * - Uses @modelcontextprotocol/sdk for standard MCP server implementation
 * - Stdio transport for direct IDE integration
 * - Modular tool registration (tools/, resources/, prompts/)
 * - Zod schemas for type-safe input/output validation
 *
 * @author Daniel Potter
 * @date 2025-11-02
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/fileTools.js";
import { registerCommandTools } from "./tools/commandTools.js";
import { registerGitTools } from "./tools/gitTools.js";
import { registerGoogleSearchTools } from "./tools/googleSearchTools.js";
import { registerDuckDuckGoSearchTools } from "./tools/duckduckgoSearchTools.js";
import { registerContext7Tools } from "./tools/context7Tools.js";
import { registerGitResources } from "./resources/gitResources.js";

// CRITICAL: Never use console.log in MCP servers - it corrupts stdio transport
// Use console.error for debugging (writes to stderr)

const server = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});

// Register all tools
registerFileTools(server);
registerCommandTools(server);
registerGitTools(server);
registerGoogleSearchTools(server);
registerDuckDuckGoSearchTools(server);
registerContext7Tools(server);

// Register all resources
registerGitResources(server);

// Connect via stdio (for VS Code/Copilot integration)
async function main() {
	const transport = new StdioServerTransport();

	await server.connect(transport);

	// Log to stderr only (safe for stdio transport)
	console.error("MCP Server started successfully");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
