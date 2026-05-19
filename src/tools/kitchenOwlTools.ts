/**
 * kitchenOwlTools.ts - KitchenOwl MCP tools
 *
 * Exposes KitchenOwl API as MCP tools.
 *
 * Env vars:
 *   KITCHENOWL_API_URL - base URL for KitchenOwl (e.g. https://api.kitchenowl.example)
 *   KITCHENOWL_API_TOKEN - Bearer token
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const KITCHENOWL_API_URL = process.env.KITCHENOWL_API_URL || "";
const KITCHENOWL_API_TOKEN = process.env.KITCHENOWL_API_TOKEN || "";
const BASE = KITCHENOWL_API_URL ? `${KITCHENOWL_API_URL.replace(/\/$/, "")}/api` : "";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${KITCHENOWL_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function kitchenOwlFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data as any).message) || `HTTP ${res.status}`;
    throw new Error(`KitchenOwl API error: ${msg}`);
  }
  return data;
}

export function registerKitchenOwlTools(server: McpServer): void {
  const noKey = () => {
    return { content: [{ type: "text" as const, text: "KITCHENOWL_API_URL or KITCHENOWL_API_TOKEN not set in environment." }] };
  };

  // --- Get current meal plan ---
  server.registerTool(
    "kitchenowl_get_meal_plan",
    {
      title: "Get KitchenOwl Meal Plan",
      description: "Get the current meal plan from KitchenOwl.",
      inputSchema: {},
    },
    async () => {
      if (!KITCHENOWL_API_URL || !KITCHENOWL_API_TOKEN) return noKey();
      const data = await kitchenOwlFetch("GET", "/meal-plan");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List recipes ---
  server.registerTool(
    "kitchenowl_list_recipes",
    {
      title: "List KitchenOwl Recipes",
      description: "List recipes from KitchenOwl.",
      inputSchema: {
        limit: z.number().optional().describe("Max results (optional)."),
      },
    },
    async ({ limit } = {}) => {
      if (!KITCHENOWL_API_URL || !KITCHENOWL_API_TOKEN) return noKey();
      let path = "/recipes";
      if (limit) path += `?limit=${limit}`;
      const data = await kitchenOwlFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get single recipe ---
  server.registerTool(
    "kitchenowl_get_recipe",
    {
      title: "Get KitchenOwl Recipe",
      description: "Get details for a single recipe by ID.",
      inputSchema: {
        recipe_id: z.string().describe("Recipe ID."),
      },
    },
    async ({ recipe_id }: { recipe_id: string }) => {
      if (!KITCHENOWL_API_URL || !KITCHENOWL_API_TOKEN) return noKey();
      const data = await kitchenOwlFetch("GET", `/recipes/${encodeURIComponent(recipe_id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get shopping list ---
  server.registerTool(
    "kitchenowl_get_shopping_list",
    {
      title: "Get KitchenOwl Shopping List",
      description: "Get the current shopping list from KitchenOwl.",
      inputSchema: {},
    },
    async () => {
      if (!KITCHENOWL_API_URL || !KITCHENOWL_API_TOKEN) return noKey();
      const data = await kitchenOwlFetch("GET", "/shopping-list");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List households (optional endpoint) ---
  server.registerTool(
    "kitchenowl_list_households",
    {
      title: "List KitchenOwl Households",
      description: "List households from KitchenOwl (if supported).",
      inputSchema: {
        limit: z.number().optional().describe("Max results (optional)."),
      },
    },
    async ({ limit } = {}) => {
      if (!KITCHENOWL_API_URL || !KITCHENOWL_API_TOKEN) return noKey();
      let path = "/households";
      if (limit) path += `?limit=${limit}`;
      const data = await kitchenOwlFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
