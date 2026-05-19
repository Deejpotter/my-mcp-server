/**
 * bookStackTools.ts - BookStack MCP tools
 *
 * Exposes BookStack API endpoints as MCP tools.
 *
 * Env vars (loaded from .env):
 *   BOOKSTACK_URL - base site URL (e.g. https://your-bookstack.example)
 *   BOOKSTACK_TOKEN_ID - API token id
 *   BOOKSTACK_TOKEN_SECRET - API token secret
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BOOKSTACK_URL = process.env.BOOKSTACK_URL || "";
const BOOKSTACK_TOKEN_ID = process.env.BOOKSTACK_TOKEN_ID || "";
const BOOKSTACK_TOKEN_SECRET = process.env.BOOKSTACK_TOKEN_SECRET || "";
const API_BASE = BOOKSTACK_URL ? `${BOOKSTACK_URL.replace(/\/$/, "")}/api` : "";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${BOOKSTACK_TOKEN_ID}:${BOOKSTACK_TOKEN_SECRET}`,
    "Content-Type": "application/json",
  };
}

async function bookStackFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data as any).message) || `HTTP ${res.status}`;
    throw new Error(`BookStack API error: ${msg}`);
  }
  return data;
}

export function registerBookStackTools(server: McpServer): void {
  const noKey = () => {
    return { content: [{ type: "text" as const, text: "BOOKSTACK_URL, BOOKSTACK_TOKEN_ID or BOOKSTACK_TOKEN_SECRET not set in environment." }] };
  };

  // --- List shelves ---
  server.registerTool(
    "bookstack_list_shelves",
    {
      title: "List BookStack Shelves",
      description: "List all bookshelves in BookStack.",
      inputSchema: {},
    },
    async () => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", "/shelves");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get shelf by id ---
  server.registerTool(
    "bookstack_get_shelf",
    {
      title: "Get BookStack Shelf",
      description: "Get details for a single BookStack shelf by ID.",
      inputSchema: {
        id: z.string().describe("Shelf ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", `/shelves/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List books ---
  server.registerTool(
    "bookstack_list_books",
    {
      title: "List BookStack Books",
      description: "List all books in BookStack.",
      inputSchema: {},
    },
    async () => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", "/books");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get book by id ---
  server.registerTool(
    "bookstack_get_book",
    {
      title: "Get BookStack Book",
      description: "Get details for a single BookStack book by ID.",
      inputSchema: {
        id: z.string().describe("Book ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", `/books/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List pages ---
  server.registerTool(
    "bookstack_list_pages",
    {
      title: "List BookStack Pages",
      description: "List pages. Optional limit parameter.",
      inputSchema: {
        limit: z.number().optional().describe("Max results (optional)."),
      },
    },
    async ({ limit }) => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      let path = "/pages";
      if (limit) path += `?limit=${limit}`;
      const data = await bookStackFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get page by id ---
  server.registerTool(
    "bookstack_get_page",
    {
      title: "Get BookStack Page",
      description: "Get a single BookStack page by ID (returns page content).",
      inputSchema: {
        id: z.string().describe("Page ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", `/pages/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Search ---
  server.registerTool(
    "bookstack_search",
    {
      title: "Search BookStack",
      description: "Search BookStack using the query string.",
      inputSchema: {
        query: z.string().describe("Search query string"),
      },
    },
    async ({ query }: { query: string }) => {
      if (!API_BASE || !BOOKSTACK_TOKEN_ID || !BOOKSTACK_TOKEN_SECRET) return noKey();
      const data = await bookStackFetch("GET", `/search?query=${encodeURIComponent(query)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
