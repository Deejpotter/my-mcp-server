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

// CRITICAL: Must be first import so .env is loaded during module resolution
// (ESM imports resolve before any module body code executes)
import "dotenv/config";

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the project root directory (one level up from dist/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Load .env from project root
dotenv.config({ path: join(projectRoot, ".env") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFileTools } from "./tools/fileTools.js";
import { registerCommandTools } from "./tools/commandTools.js";
import { registerGitTools } from "./tools/gitTools.js";
import { registerSearchTools } from "./tools/searchTools.js";
import { registerContext7Tools } from "./tools/context7Tools.js";
import { registerImageTools } from "./tools/imageTools.js";
import { registerMakerImageConverterTools } from "./tools/makerImageConverterTools.js";
import { registerPDFTools } from "./tools/pdfTools.js";
import { registerDiscoveryTools } from "./tools/discoveryTools.js";
import { registerExcelTools } from "./tools/excelTools.js";
import { registerLocalMediaTools } from "./tools/localMediaTools.js";
import { registerImageToDxfTools } from "./tools/imageToDxfTools.js";
import { registerLocalKnowledgeTools } from "./tools/localKnowledgeTools.js";
import { registerMailTools } from "./tools/mailTools.js";
import { registerCoolifyTools } from "./tools/coolifyTools.js";
import { registerGelatoTools } from "./tools/gelatoTools.js";
import { registerVaultTools } from "./tools/vaultTools.js";
import { registerOpenProjectTools } from "./tools/openProjectTools.js";
import { registerGrocyTools } from "./tools/grocyTools.js";
import { registerFireflyTools } from "./tools/fireflyTools.js";
import { registerKitchenOwlTools } from "./tools/kitchenOwlTools.js";
import { registerBookStackTools } from "./tools/bookStackTools.js";
import { registerOpenRouterTools } from "./tools/openRouterTools.js";
import { registerGitResources } from "./resources/gitResources.js";
import { registerPrompts } from "./prompts/prompts.js";

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
registerSearchTools(server);
registerContext7Tools(server);
registerImageTools(server);
registerMakerImageConverterTools(server);
registerPDFTools(server);
registerExcelTools(server);
registerLocalMediaTools(server);
registerImageToDxfTools(server);
registerLocalKnowledgeTools(server);
registerMailTools(server);
registerCoolifyTools(server);
registerGelatoTools(server);
registerVaultTools(server);
registerOpenProjectTools(server);
registerGrocyTools(server);
registerFireflyTools(server);
registerKitchenOwlTools(server);
registerBookStackTools(server);
registerOpenRouterTools(server);
// Register runtime discovery tool last so it can scan compiled tool files
registerDiscoveryTools(server);

// Register all resources
registerGitResources(server);

// Register prompts (quality-focused workflows)
registerPrompts(server);

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
