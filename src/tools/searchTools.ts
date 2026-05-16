/**
 * searchTools.ts — Consolidated search tool with intelligent provider routing
 *
 * Automatically routes queries through the best available provider:
 *   Tavily AI (AI-native, content extraction) → Serper.dev (Google data) → DuckDuckGo (free fallback)
 *
 * The LLM doesn't need to know which provider to use — it just calls "search"
 * and gets the best result the available API keys allow.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Provider configuration ──

const TAVILY_KEY = process.env.TAVILY_API_KEY || "";
const SERPER_KEY = process.env.SERPER_API_KEY || "";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  source: string;
}

// ── Tavily provider ──

async function tavilySearch(query: string, count: number): Promise<SearchResult[]> {
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
  if (!res.ok) throw new Error(data?.message || `Tavily HTTP ${res.status}`);
  return (data?.results || []).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
    content: r.content || undefined,
    source: "tavily",
  }));
}

// ── Serper.dev provider ──

async function serperSearch(query: string, count: number): Promise<SearchResult[]> {
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
  if (!res.ok) throw new Error(data?.message || `Serper HTTP ${res.status}`);
  const results: SearchResult[] = [];
  if (data?.organic) {
    for (const r of data.organic) {
      results.push({
        title: r.title || "",
        url: r.link || "",
        snippet: r.snippet || "",
        source: "serper",
      });
    }
  }
  return results;
}

// ── DuckDuckGo fallback provider ──

async function ddgSearch(query: string, count: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MCP-Server/1.0)" },
  });
  const html = await res.text();

  const results: SearchResult[] = [];
  const parts = html.split('<div class="result__body"');
  for (let i = 1; i < parts.length && results.length < count; i++) {
    const part: string = parts[i] || "";
    const titleMatch = part.match(/<a[^>]+rel="nofollow"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = part.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)>/i);
    const urlMatch = part.match(/href="(https?:\/\/[^"]+)"/i);
    if (titleMatch) {
      const title = titleMatch[1] ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const snippet = snippetMatch && snippetMatch[1] ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const url = urlMatch && urlMatch[1] ? urlMatch[1] : "";
      results.push({ title, url, snippet, source: "duckduckgo" });
    }
  }
  return results;
}

// ── Master search function ──

async function searchAll(query: string, count: number, forcedProvider?: string): Promise<{
  results: SearchResult[];
  provider: string;
}> {
  // Force a specific provider if requested
  if (forcedProvider === "tavily" && TAVILY_KEY) {
    const results = await tavilySearch(query, count);
    return { results, provider: "tavily" };
  }
  if (forcedProvider === "serper" && SERPER_KEY) {
    const results = await serperSearch(query, count);
    return { results, provider: "serper" };
  }
  if (forcedProvider === "duckduckgo") {
    const results = await ddgSearch(query, count);
    return { results, provider: "duckduckgo" };
  }

  // Auto-route: Tavily first (AI-native, best for LLMs)
  if (TAVILY_KEY) {
    try {
      const results = await tavilySearch(query, count);
      if (results.length > 0) return { results, provider: "tavily" };
    } catch (e) {
      console.error("Tavily failed, falling back:", String(e));
    }
  }

  // Fall back to Serper.dev (Google data)
  if (SERPER_KEY) {
    try {
      const results = await serperSearch(query, count);
      if (results.length > 0) return { results, provider: "serper" };
    } catch (e) {
      console.error("Serper failed, falling back:", String(e));
    }
  }

  // Final fallback: DuckDuckGo (free, always available)
  const results = await ddgSearch(query, count);
  return { results, provider: "duckduckgo" };
}

// ── Tool registration ──

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "search",
    {
      title: "Web Search",
      description: "Search the web using the best available provider (Tavily AI > Serper.dev > DuckDuckGo). Returns titles, URLs, and snippets. Tavily also returns cleaned page content. Optionally force a specific provider.",
      inputSchema: {
        query: z.string().describe("Search query."),
        count: z.number().optional().describe("Number of results (default 10, max 20)."),
        provider: z.enum(["auto", "tavily", "serper", "duckduckgo"]).optional().describe("Force a specific search provider. Default: auto (picks best available)."),
      },
    },
    async ({ query, count = 10, provider = "auto" }) => {
      const forced = provider === "auto" ? undefined : provider;
      const { results, provider: used } = await searchAll(query, Math.min(count, 20), forced);
      return {
        content: [
          { type: "text" as const, text: `Results from ${used}:\n${JSON.stringify(results, null, 2)}` },
        ],
      };
    },
  );
}
