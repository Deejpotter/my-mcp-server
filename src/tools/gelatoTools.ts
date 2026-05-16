/**
 * gelatoTools.ts - Gelato print-on-demand MCP tools
 *
 * Exposes Gelato POD API as MCP tools for automated e-commerce:
 * product catalog, order creation, order status, shipping estimates.
 *
 * Env vars (loaded from .env):
 *   GELATO_API_KEY - API key from dashboard.gelato.com
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const GELATO_KEY = process.env.GELATO_API_KEY || "";

function authHeaders(): Record<string, string> {
  return {
    "X-API-KEY": GELATO_KEY,
    "Content-Type": "application/json",
  };
}

async function gelatoFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `https://api.gelato.com/v2${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(`Gelato API error: ${msg}`);
  }
  return data;
}

export function registerGelatoTools(server: McpServer): void {
  const noKey = () => {
    return { content: [{ type: "text" as const, text: "GELATO_API_KEY not set in environment." }] };
  };

  // --- List products ---
  server.registerTool(
    "gelato_get_products",
    {
      title: "List Gelato Products",
      description: "List available print-on-demand products from Gelato catalog.",
      inputSchema: {
        category: z.string().optional().describe("Filter by product category (e.g. apparel, wall-art, accessories)."),
        limit: z.number().optional().describe("Max results (default 20)."),
      },
    },
    async ({ category, limit = 20 }) => {
      if (!GELATO_KEY) return noKey();
      let path = `/products?limit=${limit}`;
      if (category) path += `&category=${encodeURIComponent(category)}`;
      const data = await gelatoFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get product details ---
  server.registerTool(
    "gelato_get_product",
    {
      title: "Get Gelato Product",
      description: "Get details for a single Gelato product by ID.",
      inputSchema: {
        product_id: z.string().describe("Gelato product ID."),
      },
    },
    async ({ product_id }) => {
      if (!GELATO_KEY) return noKey();
      const data = await gelatoFetch("GET", `/products/${product_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Create order ---
  server.registerTool(
    "gelato_create_order",
    {
      title: "Create Gelato Order",
      description: "Place a print-on-demand order with Gelato. Requires product ID, shipping address, and print file URL.",
      inputSchema: {
        product_id: z.string().describe("Gelato product ID to order."),
        quantity: z.number().optional().describe("Quantity (default 1)."),
        shipping_address: z.object({
          name: z.string(),
          addressLine1: z.string(),
          city: z.string(),
          state: z.string(),
          postcode: z.string(),
          country: z.string(),
          email: z.string().optional(),
          phone: z.string().optional(),
        }).describe("Shipping destination."),
        file_url: z.string().describe("Public URL of the print file (image/PDF)."),
        reference: z.string().optional().describe("Your internal order reference."),
      },
    },
    async ({ product_id, quantity = 1, shipping_address, file_url, reference }) => {
      if (!GELATO_KEY) return noKey();
      const body = {
        productId: product_id,
        quantity,
        shippingAddress: shipping_address,
        files: [{ url: file_url }],
        ...(reference ? { reference } : {}),
      };
      const data = await gelatoFetch("POST", "/orders", body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Get order status ---
  server.registerTool(
    "gelato_get_order",
    {
      title: "Get Gelato Order Status",
      description: "Check the status and tracking of a Gelato order.",
      inputSchema: {
        order_id: z.string().describe("Gelato order ID."),
      },
    },
    async ({ order_id }) => {
      if (!GELATO_KEY) return noKey();
      const data = await gelatoFetch("GET", `/orders/${order_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- List orders ---
  server.registerTool(
    "gelato_get_orders",
    {
      title: "List Gelato Orders",
      description: "List recent Gelato orders with optional status filter.",
      inputSchema: {
        status: z.string().optional().describe("Filter by status (pending, processing, shipped, delivered, cancelled)."),
        limit: z.number().optional().describe("Max results (default 20)."),
      },
    },
    async ({ status, limit = 20 }) => {
      if (!GELATO_KEY) return noKey();
      let path = `/orders?limit=${limit}`;
      if (status) path += `&status=${encodeURIComponent(status)}`;
      const data = await gelatoFetch("GET", path);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // --- Shipping estimate ---
  server.registerTool(
    "gelato_get_shipping_estimate",
    {
      title: "Get Shipping Estimate",
      description: "Estimate shipping cost and delivery time for a Gelato product to a destination.",
      inputSchema: {
        product_id: z.string().describe("Gelato product ID."),
        country: z.string().describe("Destination country code (e.g. AU)."),
        quantity: z.number().optional().describe("Quantity (default 1)."),
      },
    },
    async ({ product_id, country, quantity = 1 }) => {
      if (!GELATO_KEY) return noKey();
      const data = await gelatoFetch("GET", `/products/${product_id}/shipping?country=${country}&quantity=${quantity}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
