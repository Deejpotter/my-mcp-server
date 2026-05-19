/**
 * coolifyTools.ts - Coolify deployment management MCP tools
 *
 * Exposes Coolify REST API as MCP tools so OpenClaw can manage
 * deployments, servers, and applications programmatically.
 *
 * Env vars (loaded from .env):
 *   COOLIFY_URL        - base URL, e.g. https://coolify.deejpotter.com
 *   COOLIFY_API_TOKEN  - Bearer token
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const COOLIFY_URL = process.env.COOLIFY_URL || "https://coolify.deejpotter.com";
const COOLIFY_TOKEN = process.env.COOLIFY_API_TOKEN || "";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${COOLIFY_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${COOLIFY_URL}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(`Coolify API error: ${msg}`);
  }
  return data;
}

export function registerCoolifyTools(server: McpServer): void {
  const noToken = () => {
    return { content: [{ type: "text" as const, text: "COOLIFY_API_TOKEN not set in environment." }] };
  };

  // --- List servers ---
  server.registerTool(
    "coolify_get_servers",
    {
      title: "List Coolify Servers",
      description: "List all servers registered in Coolify with their IP, user, port, reachability, and validation status.",
      inputSchema: {},
    },
    async () => {
      if (!COOLIFY_TOKEN) return noToken();
      const data = await cfFetch("GET", "/servers") as { data?: Array<Record<string, unknown>> };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Get a single server ---
  server.registerTool(
    "coolify_get_server",
    {
      title: "Get Coolify Server",
      description: "Get details for a single Coolify server by ID.",
      inputSchema: {
        server_id: z.string().describe("Server ID (numeric or uuid)."),
      },
    },
    async ({ server_id }) => {
      if (!COOLIFY_TOKEN) return noToken();
      const data = await cfFetch("GET", `/servers/${server_id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- List applications ---
  server.registerTool(
    "coolify_get_applications",
    {
      title: "List Coolify Applications",
      description: "List all applications/deployments in Coolify.",
      inputSchema: {},
    },
    async () => {
      if (!COOLIFY_TOKEN) return noToken();
      const data = await cfFetch("GET", "/applications") as { data?: Array<Record<string, unknown>> };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Get deployment status ---
  server.registerTool(
    "coolify_get_deployment",
    {
      title: "Get Deployment Status",
      description: "Get deployment status for an application by deployment ID.",
      inputSchema: {
        deployment_id: z.string().describe("Deployment ID (uuid)."),
      },
    },
    async ({ deployment_id }) => {
      if (!COOLIFY_TOKEN) return noToken();
      const data = await cfFetch("GET", `/deployments/${deployment_id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Trigger deployment ---
  server.registerTool(
    "coolify_trigger_deployment",
    {
      title: "Trigger Coolify Deployment",
      description: "Trigger a new deployment for an application. Optionally specify the git branch to deploy.",
      inputSchema: {
        application_id: z.string().describe("Application ID (uuid)."),
        branch: z.string().optional().describe("Git branch to deploy (default: main)."),
      },
    },
    async ({ application_id, branch }) => {
      if (!COOLIFY_TOKEN) return noToken();
      const body: Record<string, unknown> = { application_id };
      if (branch) body.branch = branch;
      const data = await cfFetch("POST", "/deployments", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Get application logs ---
  server.registerTool(
    "coolify_get_logs",
    {
      title: "Get Coolify Application Logs",
      description: "Fetch build/deployment logs for an application.",
      inputSchema: {
        application_id: z.string().describe("Application ID (uuid)."),
        lines: z.number().optional().describe("Number of log lines to fetch (default: 100)."),
      },
    },
    async ({ application_id, lines = 100 }) => {
      if (!COOLIFY_TOKEN) return noToken();
      const data = await cfFetch("GET", `/applications/${application_id}/logs?lines=${lines}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Health check ---
  server.registerTool(
    "coolify_health_check",
    {
      title: "Coolify Health Check",
      description: "Check if Coolify API is reachable and responding.",
      inputSchema: {},
    },
    async () => {
      if (!COOLIFY_TOKEN) return noToken();
      try {
        const data = await cfFetch("GET", "/health");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Coolify API unreachable: ${e}` }],
        };
      }
    },
  );
}
