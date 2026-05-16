/**
 * grocyTools.ts - Grocy MCP tools
 *
 * Exposes selected Grocy API endpoints as MCP tools.
 *
 * Env vars:
 *   GROCY_BASE_URL - base URL for Grocy (e.g. https://grocy.example.com)
 *   GROCY_API_KEY  - API key for Grocy (header: GROCY-API-KEY)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const GROCY_URL = process.env.GROCY_BASE_URL || "";
const GROCY_KEY = process.env.GROCY_API_KEY || "";
const GROCY_BASE = (GROCY_URL ? GROCY_URL.replace(/\/$/, "") : GROCY_URL) + "/api";

function authHeaders(): Record<string, string> {
  return {
    "GROCY-API-KEY": GROCY_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function grocyFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${GROCY_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(`Grocy API error: ${msg}`);
  }
  return data;
}

export function registerGrocyTools(server: McpServer): void {
  const noKey = () => {
    return { content: [{ type: "text" as const, text: "GROCY_BASE_URL or GROCY_API_KEY not set in environment." }] };
  };

  // --- List products ---
  server.registerTool(
    "grocy_list_products",
    {
      title: "List Grocy Products",
      description: "List all products from Grocy (objects/products).",
      inputSchema: {
        limit: z.number().optional().describe("Optional limit to trim the result"),
      },
    },
    async ({ limit }) => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      let path = `/objects/products`;
      if (limit) path += `?limit=${limit}`;
      const data = await grocyFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get stock overview ---
  server.registerTool(
    "grocy_get_stock",
    {
      title: "Get Grocy Stock",
      description: "Get current stock overview (GET /stock).",
      inputSchema: {},
    },
    async () => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/stock`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get product stock ---
  server.registerTool(
    "grocy_get_product_stock",
    {
      title: "Get Grocy Product Stock",
      description: "Get stock entries for a single product (GET /stock/products/{product_id}).",
      inputSchema: {
        product_id: z.union([z.string(), z.number()]).describe("Product ID (number or string)."),
      },
    },
    async ({ product_id }: { product_id: string | number }) => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/stock/products/${encodeURIComponent(String(product_id))}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get shopping list ---
  server.registerTool(
    "grocy_get_shopping_list",
    {
      title: "Get Grocy Shopping List",
      description: "Get the current shopping list (GET /shoppinglist).",
      inputSchema: {},
    },
    async () => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/objects/shopping_list`);
      // Note: some grocy installs expose /shoppinglist or /objects/shopping_list depending on version.
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get current meal plan ---
  server.registerTool(
    "grocy_get_meal_plan",
    {
      title: "Get Grocy Meal Plan",
      description: "Get the current meal plan (GET /meal_plan/current).",
      inputSchema: {},
    },
    async () => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/meal_plan/current`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List chores ---
  server.registerTool(
    "grocy_list_chores",
    {
      title: "List Grocy Chores",
      description: "List chores configured in Grocy (GET /chores).",
      inputSchema: {},
    },
    async () => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/chores`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List recipes ---
  server.registerTool(
    "grocy_list_recipes",
    {
      title: "List Grocy Recipes",
      description: "List recipes from Grocy (GET /recipes).",
      inputSchema: {},
    },
    async () => {
      if (!GROCY_URL || !GROCY_KEY) return noKey();
      const data = await grocyFetch("GET", `/recipes`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
