/**
 * vaultTools.ts - Vaultwarden secrets management MCP tools
 *
 * Exposes Vaultwarden (Bitwarden-compatible) API as MCP tools for
 * storing and retrieving API keys, passwords, and secure notes.
 *
 * Env vars (loaded from .env):
 *   VAULT_URL                 - base URL, e.g. https://vault.deejpotter.com
 *   VAULT_OAUTH_CLIENT_ID     - OAuth client ID
 *   VAULT_OAUTH_CLIENT_SECRET - OAuth client secret
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const VAULT_URL = process.env.VAULT_URL || "https://vault.deejpotter.com";
const VAULT_CLIENT_ID = process.env.VAULT_OAUTH_CLIENT_ID || "";
const VAULT_CLIENT_SECRET = process.env.VAULT_OAUTH_CLIENT_SECRET || "";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function vaultAuth(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const res = await fetch(`${VAULT_URL}/identity/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: VAULT_CLIENT_ID,
      client_secret: VAULT_CLIENT_SECRET,
      scope: "api",
      device_identifier: "f0e5d2a1-4b3c-4d5e-8f9a-0b1c2d3e4f5a",
      device_name: "openclaw-mcp",
      device_type: "14",
    }),
  });
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error(`Vault auth failed: ${JSON.stringify(data)}`);
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function vaultFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await vaultAuth();
  const res = await fetch(`${VAULT_URL}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.Message || data?.message || `HTTP ${res.status}`;
    throw new Error(`Vault API error: ${msg}`);
  }
  return data;
}

export function registerVaultTools(server: McpServer): void {
  const noAuth = () => {
    return { content: [{ type: "text" as const, text: "VAULT_OAUTH_CLIENT_ID or VAULT_OAUTH_CLIENT_SECRET not set in environment." }] };
  };
  const notReady = () => (!VAULT_CLIENT_ID || !VAULT_CLIENT_SECRET);

  // --- Health / auth check ---
  server.registerTool(
    "vault_health",
    {
      title: "Vault Health Check",
      description: "Check if Vaultwarden is reachable and authentication works.",
      inputSchema: {},
    },
    async () => {
      if (notReady()) return noAuth();
      try {
        await vaultAuth();
        return { content: [{ type: "text" as const, text: "Vaultwarden reachable, authentication OK." }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Vaultwarden unreachable: ${e}` }] };
      }
    },
  );

  // --- Search / list items ---
  server.registerTool(
    "vault_search_items",
    {
      title: "Search Vault Items",
      description: "Search for items in Vaultwarden by name, type, or folder. Returns matching items with IDs.",
      inputSchema: {
        query: z.string().optional().describe("Search term to filter by name."),
        type: z.enum(["login", "note", "card", "identity"]).optional().describe("Filter by item type."),
        folder_id: z.string().optional().describe("Filter by folder ID."),
        limit: z.number().optional().describe("Max results (default 20)."),
      },
    },
    async ({ query, type, folder_id, limit = 20 }) => {
      if (notReady()) return noAuth();
      let path = `/ciphers?limit=${limit}`;
      if (query) path += `&search=${encodeURIComponent(query)}`;
      if (type) path += `&type=${type}`;
      if (folder_id) path += `&folderId=${folder_id}`;
      const data = await vaultFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get item details ---
  server.registerTool(
    "vault_get_item",
    {
      title: "Get Vault Item",
      description: "Get full details of a Vaultwarden item, including secret values. WARNING: returns sensitive data.",
      inputSchema: {
        item_id: z.string().describe("Item ID (UUID)."),
      },
    },
    async ({ item_id }) => {
      if (notReady()) return noAuth();
      const data = await vaultFetch("GET", `/ciphers/${item_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Create a login item ---
  server.registerTool(
    "vault_create_login",
    {
      title: "Create Vault Login",
      description: "Store a username/password credential in Vaultwarden.",
      inputSchema: {
        name: z.string().describe("Display name for this credential."),
        username: z.string().optional().describe("Username or email."),
        password: z.string().describe("The password or API key to store."),
        uri: z.string().optional().describe("URL this credential is for."),
        notes: z.string().optional().describe("Additional notes."),
        folder_id: z.string().optional().describe("Folder ID to place item in."),
      },
    },
    async ({ name, username, password, uri, notes, folder_id }) => {
      if (notReady()) return noAuth();
      const body: Record<string, unknown> = { cipher: { type: 1, name, login: {} } };
      const login: Record<string, unknown> = {};
      if (username) login.username = username;
      if (password) login.password = password;
      if (uri) (login as Record<string, unknown>).uris = [{ uri }];
      (body.cipher as Record<string, unknown>).login = login;
      if (notes) (body.cipher as Record<string, unknown>).notes = notes;
      if (folder_id) (body.cipher as Record<string, unknown>).folderId = folder_id;

      const data = await vaultFetch("POST", "/ciphers", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Create a secure note ---
  server.registerTool(
    "vault_create_note",
    {
      title: "Create Vault Secure Note",
      description: "Store a secure text note in Vaultwarden (for API keys, tokens, etc).",
      inputSchema: {
        name: z.string().describe("Display name for this note."),
        notes: z.string().describe("The secret content to store."),
        folder_id: z.string().optional().describe("Folder ID to place item in."),
      },
    },
    async ({ name, notes, folder_id }) => {
      if (notReady()) return noAuth();
      const body: Record<string, unknown> = { cipher: { type: 2, name, notes } };
      if (folder_id) (body.cipher as Record<string, unknown>).folderId = folder_id;

      const data = await vaultFetch("POST", "/ciphers", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List folders ---
  server.registerTool(
    "vault_get_folders",
    {
      title: "List Vault Folders",
      description: "List all folders in Vaultwarden.",
      inputSchema: {},
    },
    async () => {
      if (notReady()) return noAuth();
      const data = await vaultFetch("GET", "/folders");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
