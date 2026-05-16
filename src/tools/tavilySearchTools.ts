/**
 * tavilySearchTools.ts - Tavily AI Search MCP tools
 *
 * Tavily is an AI-native search API built for LLM agents.
 * Returns pre-cleaned full page content alongside search results.
 * Free tier: 1,000 queries/month. Metered after that.
 *
 * Env vars:
 *   TAVILY_API_KEY - API key from tavily.com
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TAVILY_KEY = process.env.TAVILY_API_KEY || "";

function noKey() {
  return { content: [{ type: "text" as const, text: "TAVILY_API_KEY not set in environment." }] };
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
  answer?: string;
  response_time?: number;
}

async function tavilyFetch(query: string, count: number = 10): Promise<TavilyResponse> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      max_results: count,
      include_answer: true,
      include_raw_content: false,
    }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(`Tavily API error: ${msg}`);
  }
  return data;
}

export function registerTavilySearchTools(server: McpServer): void {
  server.registerTool(
    "tavily_search",
    {
      title: "Tavily AI Search",
      description: "AI-native search using Tavily API. Returns pre-cleaned page content ready for LLM consumption. Free tier: 1k queries/month.",
      inputSchema: {
        query: z.string().describe("Search query."),
        count: z.number().optional().describe("Number of results (default 10)."),
      },
    },
    async ({ query, count = 10 }) => {
      if (!TAVILY_KEY) return noKey();
      const data = await tavilyFetch(query, count);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
