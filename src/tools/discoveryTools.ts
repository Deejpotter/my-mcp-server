import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "path";
import { readdir, readFile } from "fs/promises";
import { makeStructuredError } from "../utils/errors.js";
import { z } from "zod";

export function registerDiscoveryTools(server: McpServer): void {
  server.registerTool(
    "mcp_tools_discovery",
    {
      title: "MCP Tools Discovery",
      description: "Discover registered tools by scanning compiled tool files in dist/tools",
      inputSchema: {},
      outputSchema: {
        tools: z.array(
          z.object({ name: z.string(), file: z.string() })
        ),
      },
    },
    async () => {
      try {
        // Determine dist/tools directory relative to runtime file
        const projectRoot = process.cwd();
        const toolsDir = join(projectRoot, "dist", "tools");

        const entries = await readdir(toolsDir).catch(() => []);
        const tools: Array<{ name: string; file: string }> = [];

        for (const fname of entries) {
          if (!fname.endsWith(".js") && !fname.endsWith(".cjs") && !fname.endsWith(".mjs")) continue;
          const full = join(toolsDir, fname);
          const txt = await readFile(full, "utf-8").catch(() => "");
          const re = /server\.registerTool\(\s*['"`]([^'"`]+)['"`]/g;
          let m;
          while ((m = re.exec(txt))) {
            tools.push({ name: (m[1] as string) ?? "", file: fname });
          }
        }

        return {
          content: [
            { type: "text", text: `Discovered ${tools.length} tools.` },
          ],
          structuredContent: { tools },
        };
      } catch (err) {
        const se = makeStructuredError(err, "discovery_failed", false);
        return {
          content: [{ type: "text", text: `Discovery failed: ${se.message}` }],
          structuredContent: { error: se },
          isError: true,
        };
      }
    }
  );
}
