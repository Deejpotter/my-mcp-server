/**
 * openProjectTools.ts - OpenProject MCP tools (READ-ONLY)
 *
 * Exposes OpenProject API as read-only MCP tools for workspace/project inspection.
 * Per TOOLS.md: default behaviour is inspect/search/read/export/compare only.
 *
 * Env vars:
 *   OPENPROJECT_URL (e.g. https://projects.maker-group.net/)
 *   OPENPROJECT_API_KEY (API token with Bearer auth)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const OPENPROJECT_URL = process.env.OPENPROJECT_URL || "";
const OPENPROJECT_KEY = process.env.OPENPROJECT_API_KEY || "";

function noKey() {
  return { content: [{ type: "text" as const, text: "OPENPROJECT_URL or OPENPROJECT_API_KEY not set in environment." }] };
}

function baseUrl(): string {
  return OPENPROJECT_URL.replace(/\/+$/, "") + "/api/v3";
}

async function openProjectFetch(method: string, path: string, params?: Record<string, string | number>): Promise<unknown> {
  const url = new URL(baseUrl() + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${OPENPROJECT_KEY}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(`OpenProject API error: ${msg}`);
  }
  return data;
}

export function registerOpenProjectTools(server: McpServer): void {
  // --- List projects ---
  server.registerTool(
    "openproject_list_projects",
    {
      title: "OpenProject — List Projects",
      description: "List all visible projects (read-only).",
      inputSchema: {
        page: z.number().optional().describe("Page number for pagination."),
        pageSize: z.number().optional().describe("Results per page."),
      },
    },
    async ({ page, pageSize }) => {
      if (!OPENPROJECT_URL || !OPENPROJECT_KEY) return noKey();
      const params: Record<string, string | number> = {};
      if (page !== undefined) params.page = page;
      if (pageSize !== undefined) params.pageSize = pageSize;
      const data = await openProjectFetch("GET", "/projects", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get project ---
  server.registerTool(
    "openproject_get_project",
    {
      title: "OpenProject — Get Project",
      description: "Get a single project by ID (read-only).",
      inputSchema: {
        id: z.union([z.string(), z.number()]).describe("Project ID."),
      },
    },
    async ({ id }) => {
      if (!OPENPROJECT_URL || !OPENPROJECT_KEY) return noKey();
      const data = await openProjectFetch("GET", `/projects/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List work packages ---
  server.registerTool(
    "openproject_list_work_packages",
    {
      title: "OpenProject — List Work Packages",
      description: "List work packages/tasks (read-only). Supports optional filter query and pagination.",
      inputSchema: {
        filters: z.string().optional().describe("OpenProject JSON filter string or query parameters."),
        page: z.number().optional().describe("Page number for pagination."),
        pageSize: z.number().optional().describe("Results per page."),
      },
    },
    async ({ filters, page, pageSize }) => {
      if (!OPENPROJECT_URL || !OPENPROJECT_KEY) return noKey();
      const params: Record<string, string | number> = {};
      if (filters !== undefined) params.filters = filters;
      if (page !== undefined) params.page = page;
      if (pageSize !== undefined) params.pageSize = pageSize;
      const data = await openProjectFetch("GET", "/work_packages", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get work package ---
  server.registerTool(
    "openproject_get_work_package",
    {
      title: "OpenProject — Get Work Package",
      description: "Get a single work package/task by ID (read-only).",
      inputSchema: {
        id: z.union([z.string(), z.number()]).describe("Work package ID."),
      },
    },
    async ({ id }) => {
      if (!OPENPROJECT_URL || !OPENPROJECT_KEY) return noKey();
      const data = await openProjectFetch("GET", `/work_packages/${encodeURIComponent(id)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
