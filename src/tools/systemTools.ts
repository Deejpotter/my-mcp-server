/**
 * System Information Tools
 *
 * Provides system metrics and status information.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as os from "os";

/**
 * Register system information tools with the MCP server
 */
export function registerSystemTools(server: McpServer) {
	// SYSTEM STATS TOOL
	server.registerTool(
		"system_stats",
		{
			title: "System Statistics",
			description: "Get current system resource usage (CPU, memory, disk)",
			inputSchema: {},
			outputSchema: {
				platform: z.string(),
				hostname: z.string(),
				cpus: z.number(),
				totalMemory: z.number(),
				freeMemory: z.number(),
				uptime: z.number(),
				loadAverage: z.array(z.number()),
			},
		},
		async () => {
			const totalMem = os.totalmem();
			const freeMem = os.freemem();
			const usedMem = totalMem - freeMem;
			const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

			const output = {
				platform: os.platform(),
				hostname: os.hostname(),
				cpus: os.cpus().length,
				totalMemory: totalMem,
				freeMemory: freeMem,
				uptime: os.uptime(),
				loadAverage: os.loadavg(),
			};

			const text = `📊 System Statistics

🖥️  Platform: ${os.platform()} (${os.arch()})
🏷️  Hostname: ${os.hostname()}
⚙️  CPUs: ${os.cpus().length} cores
💾 Memory: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB / ${(
				totalMem /
				1024 /
				1024 /
				1024
			).toFixed(2)} GB (${memPercent}% used)
⏱️  Uptime: ${Math.floor(os.uptime() / 3600)} hours
📈 Load Average: ${os
				.loadavg()
				.map((l) => l.toFixed(2))
				.join(", ")}`;

			return {
				content: [{ type: "text", text }],
				structuredContent: output,
			};
		}
	);
}
