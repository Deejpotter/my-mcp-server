/**
 * fireflyTools.ts - Firefly financial API MCP tools
 *
 * Exposes a small set of Firefly-like API endpoints as MCP tools.
 *
 * Env vars:
 *   FIREFLY_API_URL   - base URL for the Firefly instance (e.g. https://firefly.example.com)
 *   FIREFLY_API_TOKEN - Bearer token for API access
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const FIREFLY_API_URL = process.env.FIREFLY_API_URL || "";
const FIREFLY_API_TOKEN = process.env.FIREFLY_API_TOKEN || "";
const BASE = FIREFLY_API_URL ? `${FIREFLY_API_URL.replace(/\/+$/, "")}/api/v1` : "";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${FIREFLY_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function fireflyFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!BASE) throw new Error("FIREFLY_API_URL not set in environment.");
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data as any).message) || `HTTP ${res.status}`;
    throw new Error(`Firefly API error: ${msg}`);
  }
  return data;
}

export function registerFireflyTools(server: McpServer): void {
  const noKey = () => {
    return { content: [{ type: "text" as const, text: "FIREFLY_API_TOKEN not set in environment." }] };
  };

  // --- List accounts ---
  server.registerTool(
    "firefly_list_accounts",
    {
      title: "List Firefly Accounts",
      description: "List all accounts from Firefly.",
      inputSchema: {},
    },
    async () => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", "/accounts");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get account by id ---
  server.registerTool(
    "firefly_get_account",
    {
      title: "Get Firefly Account",
      description: "Get details for a single account by ID.",
      inputSchema: {
        id: z.string().describe("Account ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", `/accounts/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List transactions ---
  server.registerTool(
    "firefly_list_transactions",
    {
      title: "List Firefly Transactions",
      description: "List transactions with optional paging or date range.",
      inputSchema: {
        limit: z.number().optional().describe("Max number of transactions to return."),
        start: z.string().optional().describe("Start date (ISO string)."),
        end: z.string().optional().describe("End date (ISO string)."),
      },
    },
    async ({ limit, start, end }) => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const params: string[] = [];
      if (limit !== undefined) params.push(`limit=${encodeURIComponent(String(limit))}`);
      if (start) params.push(`start=${encodeURIComponent(start)}`);
      if (end) params.push(`end=${encodeURIComponent(end)}`);
      const path = `/transactions${params.length ? `?${params.join("&")}` : ""}`;
      const data = await fireflyFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get transaction by id ---
  server.registerTool(
    "firefly_get_transaction",
    {
      title: "Get Firefly Transaction",
      description: "Get a single transaction by ID.",
      inputSchema: {
        id: z.string().describe("Transaction ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", `/transactions/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List budgets ---
  server.registerTool(
    "firefly_list_budgets",
    {
      title: "List Firefly Budgets",
      description: "List budgets.",
      inputSchema: {},
    },
    async () => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", "/budgets");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get budget by id ---
  server.registerTool(
    "firefly_get_budget",
    {
      title: "Get Firefly Budget",
      description: "Get a single budget by ID.",
      inputSchema: {
        id: z.string().describe("Budget ID"),
      },
    },
    async ({ id }: { id: string }) => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", `/budgets/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List categories ---
  server.registerTool(
    "firefly_list_categories",
    {
      title: "List Firefly Categories",
      description: "List all categories.",
      inputSchema: {},
    },
    async () => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", "/categories");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get basic summary ---
  server.registerTool(
    "firefly_get_summary",
    {
      title: "Get Firefly Basic Summary",
      description: "Get a basic account summary.",
      inputSchema: {},
    },
    async () => {
      if (!FIREFLY_API_TOKEN) return noKey();
      const data = await fireflyFetch("GET", "/summary/basic");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
