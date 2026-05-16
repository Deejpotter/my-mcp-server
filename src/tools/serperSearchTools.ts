/**
 * serperSearchTools.ts - Serper.dev Google Search MCP tools
 *
 * Serper.dev provides pay-as-you-go Google search API access.
 * Cost: $1 USD per 1,000 queries. No monthly subscription.
 *
 * Env vars:
 *   SERPER_API_KEY - API key from serper.dev
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SERPER_KEY = process.env.SERPER_API_KEY || "";

function noKey() {
  return { content: [{ type: "text" as const, text: "SERPER_API_KEY not set in environment." }] };
}

async function serperFetch(query: string, count: number = 10): Promise<unknown> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: count }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(`Serper API error: ${msg}`);
  }
  return data;
}

export function registerSerperSearchTools(server: McpServer): void {
  server.registerTool(
    "serper_search",
    {
      title: "Serper.dev Google Search",
      description: "Search Google via Serper.dev API. Returns organic results, knowledge graph, and related searches. Pay-as-you-go at $1/1k queries.",
      inputSchema: {
        query: z.string().describe("Search query."),
        count: z.number().optional().describe("Number of results (default 10)."),
      },
    },
    async ({ query, count = 10 }) => {
      if (!SERPER_KEY) return noKey();
      const data = await serperFetch(query, count);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
