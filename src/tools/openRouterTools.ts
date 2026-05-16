/**
 * openRouterTools.ts - OpenRouter management MCP tools
 *
 * Provides API key management and usage monitoring via the OpenRouter management API.
 *
 * Env vars:
 *   OPENROUTER_MANAGEMENT_KEY - Management API key for governance
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API_BASE = "https://openrouter.ai/api/v1";
const MGMT_KEY = process.env.OPENROUTER_MANAGEMENT_KEY || "";

function noKey() {
  return { content: [{ type: "text" as const, text: "OPENROUTER_MANAGEMENT_KEY not set in environment." }] };
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${MGMT_KEY}`,
    "Content-Type": "application/json",
  };
}

async function openRouterFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(`OpenRouter API error: ${msg}`);
  }
  return data;
}

export function registerOpenRouterTools(server: McpServer): void {
  // --- List API keys ---
  server.registerTool(
    "openrouter_list_keys",
    {
      title: "OpenRouter — List API Keys",
      description: "List all API keys managed under this account.",
      inputSchema: {},
    },
    async () => {
      if (!MGMT_KEY) return noKey();
      const data = await openRouterFetch("GET", "/keys");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get key details ---
  server.registerTool(
    "openrouter_get_key",
    {
      title: "OpenRouter — Get Key Details",
      description: "Get details for a specific API key by its hash.",
      inputSchema: {
        hash: z.string().describe("Key hash (returned from list_keys)."),
      },
    },
    async ({ hash }) => {
      if (!MGMT_KEY) return noKey();
      const data = await openRouterFetch("GET", `/keys/${encodeURIComponent(hash)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Create API key ---
  server.registerTool(
    "openrouter_create_key",
    {
      title: "OpenRouter — Create API Key",
      description: "Create a new API sub-key for use in clients.",
      inputSchema: {
        name: z.string().describe("Display name for the new key."),
        disabled: z.boolean().optional().describe("Set to true to create disabled."),
        limit: z.number().optional().describe("Optional credit limit in USD."),
      },
    },
    async ({ name, disabled = false, limit }) => {
      if (!MGMT_KEY) return noKey();
      const body: Record<string, unknown> = { name, disabled };
      if (limit !== undefined) body.limit = limit;
      const data = await openRouterFetch("POST", "/keys", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Delete API key ---
  server.registerTool(
    "openrouter_delete_key",
    {
      title: "OpenRouter — Delete API Key",
      description: "Delete (revoke) an API key by its hash.",
      inputSchema: {
        hash: z.string().describe("Key hash to revoke."),
      },
    },
    async ({ hash }) => {
      if (!MGMT_KEY) return noKey();
      await openRouterFetch("DELETE", `/keys/${encodeURIComponent(hash)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted: hash }, null, 2) }] };
    },
  );

  // --- List models ---
  server.registerTool(
    "openrouter_list_models",
    {
      title: "OpenRouter — List Models",
      description: "List all models available through OpenRouter.",
      inputSchema: {},
    },
    async () => {
      if (!MGMT_KEY) return noKey();
      const data = await openRouterFetch("GET", "/models");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get credits/usage ---
  server.registerTool(
    "openrouter_get_credits",
    {
      title: "OpenRouter — Credits & Usage",
      description: "Get current credit balance and usage statistics.",
      inputSchema: {},
    },
    async () => {
      if (!MGMT_KEY) return noKey();
      const data = await openRouterFetch("GET", "/credits");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
