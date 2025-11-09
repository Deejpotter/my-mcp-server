/**
 * Created: 08/11/25
 * By: Daniel Potter
 *
 * Grocy REST API integration for MCP server.
 * Provides kitchen inventory management, shopping lists, recipes, and more.
 *
 * Requires environment variables:
 * - GROCY_BASE_URL: Base URL of Grocy instance (e.g., https://grocy.example.com)
 * - GROCY_API_KEY: API key from Grocy user settings (Manage API keys)
 *
 * References:
 * - Grocy API Docs: https://github.com/grocy/grocy/blob/master/grocy.openapi.json
 * - Grocy GitHub: https://github.com/grocy/grocy
 */

/**
 * Grocy Stock API Reference (copied from supplied API documentation)
 *
 * This section records the canonical shapes used by the Grocy stock endpoints
 * so callers and future maintainers know exactly which fields are expected.
 * Keep this in-sync with BookStack: Grocy API Integration (project book).
 *
 * Endpoints covered (stock):
 *
 * GET /stock
 * - Returns an array of CurrentStockResponse objects (products currently in stock)
 * - Example item fields:
 *   {
 *     product_id: number,
 *     amount: number|string,
 *     amount_aggregated: number|string,
 *     amount_opened: number|string,
 *     amount_opened_aggregated: number|string,
 *     best_before_date: "YYYY-MM-DD",
 *     is_aggregated_amount: boolean,
 *     product: { id, name, description, location_id, qu_id_purchase, qu_id_stock, min_stock_amount, default_best_before_days, ... }
 *   }
 *
 * GET /stock/entry/{entryId}
 * - Returns a StockEntry object with fields such as:
 *   { id, product_id, amount, best_before_date, purchased_date, stock_id, price, open, opened_date, row_created_timestamp, location_id, shopping_location_id }
 *
 * PUT /stock/entry/{entryId}
 * - Edit an existing stock entry. Body fields accepted include:
 *   { id, amount, best_before_date, purchased_date, price, open, location_id }
 *
 * GET /stock/volatile
 * - Returns products due soon / overdue / expired / missing. Query param: due_soon_days (default 5)
 * - Response contains arrays: due_products, overdue_products, expired_products, missing_products
 *
 * GET /stock/products/{productId}
 * - Returns ProductDetailsResponse with product, quantity unit info, last_price, avg_price, stock_amount, next_due_date, location, etc.
 *
 * GET /stock/products/{productId}/price-history
 * - Returns array of { date, price, shopping_location }
 *
 * POST /stock/products/{productId}/add
 * - Adds the given amount of the product to stock (purchase). Important request body fields:
 *   {
 *     amount: number,                    // amount in product's stock unit
 *     best_before_date?: "YYYY-MM-DD", // optional
 *     transaction_type?: "purchase" | "inventory" | string, // usually "purchase"
 *     price?: number,                    // price per stock quantity unit (used to populate last_price)
 *     purchased_date?: "YYYY-MM-DD",   // historic purchase date to record in stock_log
 *     location_id?: number,
 *     shopping_location_id?: number,
 *     note?: string
 *   }
 * - Response: array of StockLogEntry objects similar to:
 *   [{ id, product_id, amount, best_before_date, purchased_date, used_date, spoiled, stock_id, transaction_id, transaction_type, note, row_created_timestamp }]
 *
 * POST /stock/products/{productId}/consume
 * - Removes amount from stock. Body example: { amount: number, transaction_type: "consume", spoiled?: boolean }
 *
 * POST /stock/products/{productId}/inventory
 * - Inventories the product to new_amount. Body example: { new_amount: number, best_before_date?, shopping_location_id?, location_id?, price?, note? }
 *
 * POST /stock/transactions/{transactionId}
 * - Transaction endpoints exist to retrieve bookings or undo transactions: GET /stock/transactions/{transactionId}, POST /stock/transactions/{transactionId}/undo
 *
 * Notes / guidance for my-mcp-server:
 * - Always supply `price` when importing historic receipts if you want Grocy's `last_price` and product UI value to reflect the purchase.
 * - Use `purchased_date` to preserve the receipt date in the stock_log.
 * - The `amount` must be in the product's stock unit (qu_id_stock). If receipts use different units (kg/g, L/mL), normalize the amount and adjust `price` accordingly before posting.
 * - Common unit conversions implemented in this tool: kg <-> g, L <-> mL. Extend as needed and document in BookStack.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * Grocy product with stock information
 */
interface GrocyProduct {
	id: number;
	name: string;
	description?: string;
	location_id?: number;
	qu_id_stock: number;
	qu_id_purchase: number;
	min_stock_amount: number;
	default_best_before_days: number;
	product_group_id?: number;
	picture_file_name?: string;
	barcode?: string;
}

/**
 * Current stock response for a product
 */
interface GrocyStockResponse {
	product_id: number;
	amount: string;
	amount_aggregated: string;
	amount_opened: string;
	amount_opened_aggregated: string;
	best_before_date: string;
	is_aggregated_amount?: boolean;
	product?: GrocyProduct;
}

/**
 * Stock entry with location and dates (unused but kept for future use)
 */
// @ts-expect-error - Unused interface kept for API reference
interface _GrocyStockEntry {
	id: string;
	product_id: number;
	amount: string;
	best_before_date: string;
	purchased_date: string;
	stock_id: string;
	price?: number;
	open: number;
	opened_date?: string;
	location_id: number;
	shopping_location_id?: number;
	note?: string;
}

/**
 * Product details with extended information
 */
interface GrocyProductDetails {
	product: GrocyProduct;
	last_purchased?: string;
	last_used?: string;
	stock_amount: number;
	stock_amount_opened: number;
	next_best_before_date?: string;
	last_price?: number;
	avg_price?: number;
	location?: { id: number; name: string };
}

/**
 * Shopping list item (unused but kept for future use)
 */
// @ts-expect-error - Unused interface kept for API reference
interface _GrocyShoppingListItem {
	id: number;
	product_id?: number;
	note?: string;
	amount: number;
	shopping_list_id: number;
	done: number;
	qu_id?: number;
}

/**
 * Volatile stock (expiring, overdue, missing products)
 */
interface GrocyVolatileStock {
	due_products: GrocyStockResponse[];
	overdue_products: GrocyStockResponse[];
	expired_products: GrocyStockResponse[];
	missing_products: Array<{
		id: number;
		name: string;
		amount_missing: number;
		is_partly_in_stock: boolean;
	}>;
}

/**
 * Recipe fulfillment information
 */
interface GrocyRecipeFulfillment {
	need_fulfilled: boolean;
	need_fulfilled_with_shopping_list: boolean;
	missing_products: Array<{
		id: number;
		amount_missing: number;
		amount_missing_for_recipe: number;
	}>;
}

/**
 * Task information (unused but kept for future use)
 */
// @ts-expect-error - Unused interface kept for API reference
interface _GrocyTask {
	id: number;
	name: string;
	description?: string;
	due_date?: string;
	done: number;
	done_timestamp?: string;
	category_id?: number;
	assigned_to_user_id?: number;
}

/**
 * Stock log entry (transaction)
 */
interface GrocyStockLogEntry {
	id: number;
	product_id: number;
	amount: string;
	best_before_date: string;
	purchased_date: string;
	transaction_type: string;
	price?: number;
	location_id?: number;
	note?: string;
}

/**
 * Make authenticated request to Grocy API
 */
async function grocyRequest(
	endpoint: string,
	method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
	body?: unknown
): Promise<unknown> {
	const baseUrl = process.env.GROCY_BASE_URL;
	const apiKey = process.env.GROCY_API_KEY;

	if (!baseUrl) {
		throw new Error(
			"GROCY_BASE_URL environment variable is not set. Please add your Grocy instance URL."
		);
	}

	if (!apiKey) {
		throw new Error(
			"GROCY_API_KEY environment variable is not set. " +
				"Please create an API key in Grocy user settings (Manage API keys)."
		);
	}

	// Ensure URL doesn't end with slash for consistent endpoint construction
	const normalizedUrl = baseUrl.replace(/\/$/, "");
	const url = `${normalizedUrl}/api/${endpoint}`;

	const headers: Record<string, string> = {
		"GROCY-API-KEY": apiKey,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	const options: RequestInit = {
		method,
		headers,
	};

	if (body && (method === "POST" || method === "PUT")) {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(url, options);

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage = `Grocy API error: ${response.status} ${response.statusText}`;

		try {
			const errorJson = JSON.parse(errorText) as {
				error_message?: string;
				error?: string;
			};
			if (errorJson.error_message) {
				errorMessage = errorJson.error_message;
			} else if (errorJson.error) {
				errorMessage = errorJson.error;
			}
		} catch {
			// Error response wasn't JSON, use text
			if (errorText) {
				errorMessage += ` - ${errorText}`;
			}
		}

		throw new Error(errorMessage);
	}

	// Some endpoints return 204 No Content
	if (response.status === 204 || method === "DELETE") {
		return { success: true };
	}

	return await response.json();
}

/**
 * Register Grocy tools with the MCP server
 */
export function registerGrocyTools(server: McpServer) {
	// STOCK - GET CURRENT STOCK
	server.registerTool(
		"grocy_stock_get_current",
		{
			title: "Get Current Stock Overview",
			description:
				"Returns all products currently in stock with amounts, locations, and best before dates. " +
				"This is your main stock overview showing what you have on hand.",
			inputSchema: {},
		},
		async () => {
			try {
				// Apply rate limiting
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds before making another request.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("stock")) as GrocyStockResponse[];

				// Format results
				const formattedStock = data.map((item) => ({
					product_id: item.product_id,
					product_name: item.product?.name,
					amount: item.amount_aggregated || item.amount,
					amount_opened: item.amount_opened_aggregated || item.amount_opened,
					best_before_date: item.best_before_date,
					location_id: item.product?.location_id,
				}));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_products: formattedStock.length,
									stock: formattedStock,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching stock: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// STOCK - GET PRODUCT DETAILS
	server.registerTool(
		"grocy_stock_get_product",
		{
			title: "Get Product Details",
			description:
				"Returns detailed information about a specific product including current stock, " +
				"locations, prices, and usage history.",
			inputSchema: {
				product_id: z
					.number()
					.positive()
					.describe("The ID of the product to retrieve"),
			},
		},
		async ({ product_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest(
					`stock/products/${product_id}`
				)) as GrocyProductDetails;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									id: data.product.id,
									name: data.product.name,
									description: data.product.description,
									stock_amount: data.stock_amount,
									stock_amount_opened: data.stock_amount_opened,
									location: data.location?.name,
									last_purchased: data.last_purchased,
									last_used: data.last_used,
									next_best_before_date: data.next_best_before_date,
									last_price: data.last_price,
									avg_price: data.avg_price,
									min_stock_amount: data.product.min_stock_amount,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching product: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// STOCK - ADD PRODUCT (PURCHASE)
	server.registerTool(
		"grocy_stock_add_product",
		{
			title: "Add Product to Stock",
			description:
				"Adds a product to stock (purchase). Records the purchase with amount, price, " +
				"best before date, and location.",
			inputSchema: {
				product_id: z.number().positive().describe("The product ID to add"),
				amount: z
					.number()
					.positive()
					.describe("Amount to add in stock quantity units"),
				best_before_date: z
					.string()
					.optional()
					.describe(
						"Best before date (YYYY-MM-DD), defaults to today if omitted"
					),
				purchased_date: z
					.string()
					.optional()
					.describe(
						"Purchased date (YYYY-MM-DD). If omitted Grocy will use the current date"
					),
				price: z.number().optional().describe("Price per stock quantity unit"),
				unit: z
					.string()
					.optional()
					.describe(
						"Optional unit of the provided amount/price (e.g., 'kg','g','l','ml','piece'). If provided, the tool will normalize to the product's stock unit."
					),
				location_id: z
					.number()
					.optional()
					.describe("Location ID, uses product default if omitted"),
				shopping_location_id: z
					.number()
					.optional()
					.describe("Store/shop where purchased"),
				note: z
					.string()
					.optional()
					.describe("Optional note for this stock entry"),
			},
		},
		async ({
			product_id,
			amount,
			best_before_date,
			purchased_date,
			price,
			unit,
			location_id,
			shopping_location_id,
			note,
		}) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				// Normalize amount/price to product stock unit when a unit is provided
				let adjustedAmount = amount;
				let adjustedPrice = price;
				const conversionNotes: string[] = [];

				if (unit) {
					// Fetch product details to know the stock unit
					const prodDetails = (await grocyRequest(
						`stock/products/${product_id}`
					)) as GrocyProductDetails;

					// Fetch quantity units mapping
					const quList = (await grocyRequest(
						"objects/quantity_units"
					)) as Array<{ id: number; name: string }>;

					const quMap = new Map<number, string>();
					for (const q of quList) quMap.set(q.id, (q.name || "").toLowerCase());

					const stockQuId = prodDetails.product.qu_id_stock;
					const stockUnitName = (quMap.get(stockQuId) || "").toLowerCase();
					const unitLower = unit.toLowerCase();

					// Common conversions: kg <-> g, l <-> ml
					if (
						(unitLower === "kg" || unitLower.includes("kilogram")) &&
						stockUnitName.includes("gram")
					) {
						adjustedAmount = amount * 1000;
						if (price !== undefined) adjustedPrice = price / 1000;
						conversionNotes.push(
							`Converted ${amount}${unit} -> ${adjustedAmount} ${stockUnitName} (kg -> g). Price adjusted accordingly.`
						);
					} else if (
						(unitLower === "g" || unitLower.includes("gram")) &&
						stockUnitName.includes("kg")
					) {
						adjustedAmount = amount / 1000;
						if (price !== undefined) adjustedPrice = price * 1000;
						conversionNotes.push(
							`Converted ${amount}${unit} -> ${adjustedAmount} ${stockUnitName} (g -> kg). Price adjusted accordingly.`
						);
					} else if (
						(unitLower === "l" ||
							unitLower.includes("litre") ||
							unitLower.includes("liter")) &&
						stockUnitName.includes("ml")
					) {
						adjustedAmount = amount * 1000;
						if (price !== undefined) adjustedPrice = price / 1000;
						conversionNotes.push(
							`Converted ${amount}${unit} -> ${adjustedAmount} ${stockUnitName} (L -> mL). Price adjusted accordingly.`
						);
					} else if (
						(unitLower === "ml" ||
							unitLower.includes("millilitre") ||
							unitLower.includes("milliliter")) &&
						stockUnitName.includes("l")
					) {
						adjustedAmount = amount / 1000;
						if (price !== undefined) adjustedPrice = price * 1000;
						conversionNotes.push(
							`Converted ${amount}${unit} -> ${adjustedAmount} ${stockUnitName} (mL -> L). Price adjusted accordingly.`
						);
					} else {
						// No recognized conversion, just log a note if units differ textually
						if (!stockUnitName.includes(unitLower)) {
							conversionNotes.push(
								`Provided unit '${unit}' does not match product stock unit '${stockUnitName}'. No numeric conversion performed.`
							);
						}
					}
				}

				const body: Record<string, unknown> = {
					amount: adjustedAmount,
					transaction_type: "purchase",
				};

				if (best_before_date) body.best_before_date = best_before_date;
				if (adjustedPrice !== undefined) body.price = adjustedPrice;
				// Include purchased_date when provided so the stock_log shows the historic purchase date
				if (purchased_date) body.purchased_date = purchased_date;
				if (location_id) body.location_id = location_id;
				if (shopping_location_id)
					body.shopping_location_id = shopping_location_id;
				if (note) body.note = note;

				const data = (await grocyRequest(
					`stock/products/${product_id}/add`,
					"POST",
					body
				)) as GrocyStockLogEntry[];
				// If price was not provided, warn the caller that UI value will be $0.00 until a priced purchase exists
				const responsePayload: Record<string, unknown> = {
					success: true,
					message: `Added ${adjustedAmount} unit(s) of product ${product_id} to stock`,
					transaction: data[0],
				};

				if (price === undefined) {
					responsePayload.note =
						"Price was not provided. Stock overview value will show $0.00 until a purchase with price is recorded.";
				}

				if (conversionNotes.length > 0) {
					responsePayload.conversion = conversionNotes;
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(responsePayload, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding product to stock: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// STOCK - CONSUME PRODUCT
	server.registerTool(
		"grocy_stock_consume_product",
		{
			title: "Consume Product from Stock",
			description:
				"Removes a product from stock (consume/use). Uses FIFO (First In First Out) by default. " +
				"Can mark as spoiled if the product went bad.",
			inputSchema: {
				product_id: z.number().positive().describe("The product ID to consume"),
				amount: z
					.number()
					.positive()
					.describe("Amount to consume in stock quantity units"),
				spoiled: z
					.boolean()
					.optional()
					.default(false)
					.describe("True if the product was spoiled/wasted"),
				location_id: z
					.number()
					.optional()
					.describe("Consume from specific location only"),
				recipe_id: z
					.number()
					.optional()
					.describe("Recipe ID if consumed for a recipe"),
			},
		},
		async ({ product_id, amount, spoiled = false, location_id, recipe_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					amount,
					transaction_type: "consume",
					spoiled,
				};

				if (location_id) body.location_id = location_id;
				if (recipe_id) body.recipe_id = recipe_id;

				const data = (await grocyRequest(
					`stock/products/${product_id}/consume`,
					"POST",
					body
				)) as GrocyStockLogEntry[];

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Consumed ${amount} unit(s) of product ${product_id}${
										spoiled ? " (spoiled)" : ""
									}`,
									transaction: data[0],
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error consuming product: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// STOCK - GET VOLATILE (EXPIRING/MISSING)
	server.registerTool(
		"grocy_stock_get_volatile",
		{
			title: "Get Expiring/Missing Products",
			description:
				"Returns products that are expiring soon, overdue, already expired, or below minimum stock. " +
				"Essential for managing food waste and restocking.",
			inputSchema: {
				due_soon_days: z
					.number()
					.optional()
					.default(5)
					.describe("Number of days to consider as 'due soon' (default: 5)"),
			},
		},
		async ({ due_soon_days = 5 }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest(
					`stock/volatile?due_soon_days=${due_soon_days}`
				)) as GrocyVolatileStock;

				// Format each category
				const formatProducts = (products: GrocyStockResponse[]) =>
					products.map((p) => ({
						id: p.product_id,
						name: p.product?.name || `Product ${p.product_id}`,
						amount: p.amount_aggregated || p.amount,
						best_before_date: p.best_before_date,
					}));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									summary: {
										due_soon: data.due_products.length,
										overdue: data.overdue_products.length,
										expired: data.expired_products.length,
										missing: data.missing_products.length,
									},
									due_products: formatProducts(data.due_products),
									overdue_products: formatProducts(data.overdue_products),
									expired_products: formatProducts(data.expired_products),
									missing_products: data.missing_products.map((p) => ({
										id: p.id,
										name: p.name,
										amount_missing: p.amount_missing,
										is_partly_in_stock: p.is_partly_in_stock,
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching volatile stock: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// STOCK - GET PRODUCT BY BARCODE
	server.registerTool(
		"grocy_stock_get_product_by_barcode",
		{
			title: "Get Product by Barcode",
			description:
				"Look up a product using its barcode. Returns product details if the barcode is registered.",
			inputSchema: {
				barcode: z.string().min(1).describe("The barcode to look up"),
			},
		},
		async ({ barcode }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest(
					`stock/products/by-barcode/${encodeURIComponent(barcode)}`
				)) as GrocyProductDetails;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									id: data.product.id,
									name: data.product.name,
									barcode: barcode,
									stock_amount: data.stock_amount,
									location: data.location?.name,
									last_price: data.last_price,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error looking up barcode: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LIST - ADD PRODUCT
	server.registerTool(
		"grocy_shoppinglist_add_product",
		{
			title: "Add Product to Shopping List",
			description:
				"Adds a product to your shopping list. If the product is already on the list, " +
				"the amount will be increased.",
			inputSchema: {
				product_id: z.number().positive().describe("Product ID to add"),
				product_amount: z
					.number()
					.optional()
					.default(1)
					.describe("Amount to add (default: 1)"),
				list_id: z
					.number()
					.optional()
					.default(1)
					.describe("Shopping list ID (default: 1 = default list)"),
				note: z.string().optional().describe("Optional note for the item"),
			},
		},
		async ({ product_id, product_amount = 1, list_id = 1, note }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					product_id,
					product_amount,
					list_id,
				};

				if (note) body.note = note;

				await grocyRequest("stock/shoppinglist/add-product", "POST", body);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Added ${product_amount} unit(s) of product ${product_id} to shopping list ${list_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding to shopping list: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LIST - REMOVE PRODUCT
	server.registerTool(
		"grocy_shoppinglist_remove_product",
		{
			title: "Remove Product from Shopping List",
			description:
				"Removes a product from your shopping list. If the amount is less than what's on the list, " +
				"it reduces the amount. Otherwise, removes the item completely.",
			inputSchema: {
				product_id: z.number().positive().describe("Product ID to remove"),
				product_amount: z
					.number()
					.optional()
					.default(1)
					.describe("Amount to remove (default: 1)"),
				list_id: z
					.number()
					.optional()
					.default(1)
					.describe("Shopping list ID (default: 1 = default list)"),
			},
		},
		async ({ product_id, product_amount = 1, list_id = 1 }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body = {
					product_id,
					product_amount,
					list_id,
				};

				await grocyRequest("stock/shoppinglist/remove-product", "POST", body);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Removed ${product_amount} unit(s) of product ${product_id} from shopping list ${list_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error removing from shopping list: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LIST - ADD MISSING PRODUCTS
	server.registerTool(
		"grocy_shoppinglist_add_missing",
		{
			title: "Add Missing Products to Shopping List",
			description:
				"Automatically adds all products below their minimum stock amount to the shopping list. " +
				"Great for restocking your pantry.",
			inputSchema: {
				list_id: z
					.number()
					.optional()
					.default(1)
					.describe("Shopping list ID (default: 1 = default list)"),
			},
		},
		async ({ list_id = 1 }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest("stock/shoppinglist/add-missing-products", "POST", {
					list_id,
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Added all missing products (below min stock) to shopping list ${list_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding missing products: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LIST - CLEAR
	server.registerTool(
		"grocy_shoppinglist_clear",
		{
			title: "Clear Shopping List",
			description:
				"Removes all items from a shopping list. Can optionally remove only completed items.",
			inputSchema: {
				list_id: z
					.number()
					.optional()
					.default(1)
					.describe("Shopping list ID (default: 1 = default list)"),
				done_only: z
					.boolean()
					.optional()
					.default(false)
					.describe("If true, only removes completed items (default: false)"),
			},
		},
		async ({ list_id = 1, done_only = false }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest("stock/shoppinglist/clear", "POST", {
					list_id,
					done_only,
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: done_only
										? `Cleared completed items from shopping list ${list_id}`
										: `Cleared all items from shopping list ${list_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error clearing shopping list: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// RECIPES - GET FULFILLMENT
	server.registerTool(
		"grocy_recipe_get_fulfillment",
		{
			title: "Check Recipe Fulfillment",
			description:
				"Checks if you have all ingredients in stock for a recipe. " +
				"Shows which ingredients are missing.",
			inputSchema: {
				recipe_id: z.number().positive().describe("Recipe ID to check"),
			},
		},
		async ({ recipe_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest(
					`recipes/${recipe_id}/fulfillment`
				)) as GrocyRecipeFulfillment;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									recipe_id,
									need_fulfilled: data.need_fulfilled,
									need_fulfilled_with_shopping_list:
										data.need_fulfilled_with_shopping_list,
									missing_products: data.missing_products,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error checking recipe fulfillment: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// RECIPES - CONSUME
	server.registerTool(
		"grocy_recipe_consume",
		{
			title: "Consume Recipe Ingredients",
			description:
				"Consumes all ingredients for a recipe from stock. " +
				"Only works if all ingredients are available (check fulfillment first).",
			inputSchema: {
				recipe_id: z.number().positive().describe("Recipe ID to consume"),
			},
		},
		async ({ recipe_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest(`recipes/${recipe_id}/consume`, "POST");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Successfully consumed all ingredients for recipe ${recipe_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error consuming recipe: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// RECIPES - ADD MISSING TO SHOPPING LIST
	server.registerTool(
		"grocy_recipe_add_missing_to_shoppinglist",
		{
			title: "Add Missing Recipe Ingredients to Shopping List",
			description:
				"Adds all missing ingredients for a recipe to your shopping list. " +
				"Useful for meal planning.",
			inputSchema: {
				recipe_id: z.number().positive().describe("Recipe ID"),
				excluded_product_ids: z
					.array(z.number())
					.optional()
					.describe("Product IDs to exclude from shopping list"),
			},
		},
		async ({ recipe_id, excluded_product_ids }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body = excluded_product_ids
					? { excludedProductIds: excluded_product_ids }
					: undefined;

				await grocyRequest(
					`recipes/${recipe_id}/add-not-fulfilled-products-to-shoppinglist`,
					"POST",
					body
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Added missing ingredients for recipe ${recipe_id} to shopping list`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding recipe ingredients to shopping list: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// RECIPES - CREATE RECIPE
	server.registerTool(
		"grocy_recipe_create",
		{
			title: "Create Recipe",
			description:
				"Creates a new recipe in Grocy with name, description, and serving information. " +
				"Returns the new recipe ID to use when adding ingredients.",
			inputSchema: {
				name: z
					.string()
					.min(1)
					.describe("Recipe name (e.g., 'Spaghetti Bolognese')"),
				description: z
					.string()
					.optional()
					.describe("Optional description or cooking instructions"),
				base_servings: z
					.number()
					.positive()
					.default(4)
					.describe("How many servings the recipe makes (default: 4)"),
				desired_servings: z
					.number()
					.positive()
					.default(4)
					.describe("How many servings you want to make (default: 4)"),
			},
		},
		async ({ name, description, base_servings = 4, desired_servings = 4 }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body = {
					name,
					description: description || "",
					base_servings,
					desired_servings,
				};

				const response = (await grocyRequest(
					"objects/recipes",
					"POST",
					body
				)) as {
					created_object_id: number;
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									recipe_id: response.created_object_id,
									message: `Created recipe "${name}" with ID ${response.created_object_id}`,
									base_servings,
									desired_servings,
									next_step:
										"Use grocy_recipe_add_ingredient to add ingredients to this recipe",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating recipe: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// RECIPES - ADD INGREDIENT
	server.registerTool(
		"grocy_recipe_add_ingredient",
		{
			title: "Add Ingredient to Recipe",
			description:
				"Adds an ingredient (product) to an existing recipe with quantity. " +
				"The product must already exist in Grocy. Get product IDs from grocy_stock_get_current.",
			inputSchema: {
				recipe_id: z
					.number()
					.positive()
					.describe("Recipe ID to add ingredient to"),
				product_id: z
					.number()
					.positive()
					.describe("Product ID of the ingredient (must exist in Grocy)"),
				amount: z
					.number()
					.positive()
					.describe("Quantity of ingredient needed (in product's stock unit)"),
				qu_id: z
					.number()
					.positive()
					.optional()
					.describe(
						"Quantity unit ID (optional, defaults to product's stock unit). " +
							"Common: 1=piece, 2=gram, 3=kg, 4=liter, 5=ml"
					),
				note: z
					.string()
					.optional()
					.describe(
						"Optional note about the ingredient (e.g., 'lean beef', 'fresh')"
					),
			},
		},
		async ({ recipe_id, product_id, amount, qu_id, note }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					recipe_id,
					product_id,
					amount,
				};

				if (qu_id !== undefined) {
					body.qu_id = qu_id;
				}

				if (note) {
					body.note = note;
				}

				const response = (await grocyRequest(
					"objects/recipes_pos",
					"POST",
					body
				)) as {
					created_object_id: number;
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									recipe_pos_id: response.created_object_id,
									message: `Added ingredient (product ${product_id}) to recipe ${recipe_id}`,
									amount,
									qu_id: qu_id || "default",
									note: note || "none",
									next_step:
										"Add more ingredients or use grocy_recipe_get_fulfillment to check status",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding ingredient to recipe: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// TASKS - GET PENDING
	server.registerTool(
		"grocy_tasks_get_pending",
		{
			title: "Get Pending Tasks",
			description:
				"Returns all tasks that are not yet completed. Shows task names, due dates, and assignments.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("tasks")) as Array<{
					id: number;
					name: string;
					description?: string;
					due_date?: string;
					done: number;
					assigned_to_user_id?: number;
				}>;

				const pendingTasks = data.filter((task) => task.done === 0);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_pending: pendingTasks.length,
									tasks: pendingTasks.map((task) => ({
										id: task.id,
										name: task.name,
										description: task.description,
										due_date: task.due_date,
										assigned_to_user_id: task.assigned_to_user_id,
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching tasks: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// TASKS - COMPLETE
	server.registerTool(
		"grocy_task_complete",
		{
			title: "Complete Task",
			description: "Marks a task as completed with the current timestamp.",
			inputSchema: {
				task_id: z.number().positive().describe("Task ID to complete"),
			},
		},
		async ({ task_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest(`tasks/${task_id}/complete`, "POST", {});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Task ${task_id} marked as completed`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error completing task: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PRODUCT - CREATE
	server.registerTool(
		"grocy_product_create",
		{
			title: "Create Product",
			description:
				"Creates a new product in Grocy with nutrition info. Products must be created before they can be added as recipe ingredients or added to stock. Use grocy_location_list and grocy_quantity_unit_list to find valid IDs.",
			inputSchema: {
				name: z
					.string()
					.describe("Product name (e.g., 'Ground Beef', 'Tomato Sauce')"),
				description: z
					.string()
					.optional()
					.describe("Optional product description"),
				location_id: z
					.number()
					.optional()
					.describe(
						"Location ID where product is stored (use grocy_location_list to find IDs)"
					),
				qu_id_stock: z
					.number()
					.optional()
					.describe(
						"Stock quantity unit ID (use grocy_quantity_unit_list). Common: 1=piece, 2=gram, 3=kg, 4=liter, 5=ml"
					),
				qu_id_purchase: z
					.number()
					.optional()
					.describe(
						"Purchase quantity unit ID (defaults to stock QU if omitted)"
					),
				min_stock_amount: z
					.number()
					.optional()
					.describe("Minimum stock amount (for automatic shopping list)"),
				default_best_before_days: z
					.number()
					.optional()
					.describe(
						"Default days until best before date (0 = no expiry tracking)"
					),
				product_group_id: z
					.number()
					.optional()
					.describe("Product group/category ID (use grocy_product_group_list)"),
				calories: z
					.number()
					.optional()
					.describe(
						"Calories per stock quantity unit (e.g., per 100g). Auto-summed in recipes."
					),
				barcode: z.string().optional().describe("Product barcode for scanning"),
				enable_tare_weight_handling: z
					.boolean()
					.optional()
					.describe("Enable tare weight handling (default: false)"),
				tare_weight: z
					.number()
					.optional()
					.describe("Tare weight in stock quantity units (default: 0.0)"),
				should_not_be_frozen: z
					.boolean()
					.optional()
					.describe(
						"Indicates if the product should not be frozen (default: false)"
					),
				default_consume_location_id: z
					.number()
					.optional()
					.describe(
						"Default consume location ID (use grocy_location_list to find IDs)"
					),
				default_quantity_unit_consume: z
					.number()
					.optional()
					.describe(
						"Default quantity unit consume (required for recipes and stock management)"
					),
				default_quantity_unit_for_prices: z
					.number()
					.optional()
					.describe(
						"Default quantity unit for prices (required for pricing calculations)"
					),
				default_store: z
					.number()
					.optional()
					.describe("Default store ID (use grocy_store_list to find IDs)"),
				move_on_open: z
					.boolean()
					.optional()
					.describe(
						"Indicates if the product should move to a different location when opened (default: false)"
					),
				energy_kcal_per_piece: z
					.number()
					.optional()
					.describe(
						"Energy in kcal per piece (used for nutritional calculations)"
					),
				quick_consume_amount: z
					.number()
					.optional()
					.describe(
						"Quick consume amount in stock quantity units (default: 1)"
					),
				quick_open_amount: z
					.number()
					.optional()
					.describe("Quick open amount in stock quantity units (default: 1)"),
			},
		},
		async ({
			name,
			description,
			location_id,
			qu_id_stock,
			qu_id_purchase,
			min_stock_amount,
			default_best_before_days,
			product_group_id,
			calories,
			barcode,
			enable_tare_weight_handling,
			tare_weight,
			should_not_be_frozen,
			default_consume_location_id,
			default_quantity_unit_consume,
			default_quantity_unit_for_prices,
			default_store,
			move_on_open,
			energy_kcal_per_piece,
			quick_consume_amount,
			quick_open_amount,
		}) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					name,
					description: description || "",
					location_id: location_id || 1,
					qu_id_stock: qu_id_stock || 1,
					qu_id_purchase: qu_id_purchase || qu_id_stock || 1,
					min_stock_amount: min_stock_amount || 0,
					default_best_before_days: default_best_before_days || 0,
				};

				// Add optional fields
				if (product_group_id !== undefined)
					body.product_group_id = product_group_id;
				if (calories !== undefined) body.calories = calories;
				if (barcode !== undefined) body.barcode = barcode;
				if (enable_tare_weight_handling !== undefined)
					body.enable_tare_weight_handling = enable_tare_weight_handling;
				if (tare_weight !== undefined) body.tare_weight = tare_weight;
				if (should_not_be_frozen !== undefined)
					body.should_not_be_frozen = should_not_be_frozen;
				if (default_consume_location_id !== undefined)
					body.default_consume_location_id = default_consume_location_id;
				if (default_quantity_unit_consume !== undefined)
					body.default_quantity_unit_consume = default_quantity_unit_consume;
				if (default_quantity_unit_for_prices !== undefined)
					body.default_quantity_unit_for_prices =
						default_quantity_unit_for_prices;
				if (default_store !== undefined) body.default_store = default_store;
				if (move_on_open !== undefined) body.move_on_open = move_on_open;
				if (energy_kcal_per_piece !== undefined)
					body.energy_kcal_per_piece = energy_kcal_per_piece;
				if (quick_consume_amount !== undefined)
					body.quick_consume_amount = quick_consume_amount;
				if (quick_open_amount !== undefined)
					body.quick_open_amount = quick_open_amount;

				const response = (await grocyRequest(
					"objects/products",
					"POST",
					body
				)) as {
					created_object_id: number;
				};

				const nextSteps: string[] = [
					"Use grocy_stock_add_product to add this product to stock",
					"Use grocy_recipe_add_ingredient to add it to a recipe",
				];

				// Add userfields guidance if nutrition provided
				if (calories !== undefined) {
					nextSteps.push(
						"For detailed nutrition (protein, carbs, fat), use grocy_userfield_set with fields: protein_g, carbs_g, fat_g, fiber_g, etc."
					);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									product_id: response.created_object_id,
									message: `Created product "${name}" with ID ${
										response.created_object_id
									}${calories !== undefined ? ` (${calories} cal)` : ""}`,
									name,
									location_id: location_id || 1,
									qu_id_stock: qu_id_stock || 1,
									calories,
									product_group_id,
									barcode,
									next_steps: nextSteps,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating product: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// USERFIELDS - GET
	server.registerTool(
		"grocy_userfield_get",
		{
			title: "Get Userfields",
			description:
				"Retrieves custom userfields for a product, recipe, location, or other entity. Userfields store extra data like nutrition (protein_g, carbs_g, fat_g), metadata (brand, package_size), or custom properties.",
			inputSchema: {
				entity: z
					.enum([
						"products",
						"recipes",
						"locations",
						"shopping_locations",
						"quantity_units",
						"product_groups",
					])
					.describe(
						"Entity type to get userfields for (e.g., 'products', 'recipes')"
					),
				object_id: z
					.number()
					.describe("ID of the specific object to get userfields for"),
			},
		},
		async ({ entity, object_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const response = await grocyRequest(
					`userfields/${entity}/${object_id}`,
					"GET"
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									entity,
									object_id,
									userfields: response || {},
									message: `Retrieved userfields for ${entity} ID ${object_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting userfields: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// USERFIELDS - SET
	server.registerTool(
		"grocy_userfield_set",
		{
			title: "Set Userfields",
			description:
				"Sets custom userfields for a product, recipe, or other entity. Use this to add detailed nutrition data (protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg), metadata (brand, package_size, serving_size), or custom properties. Userfields are NOT auto-aggregated in recipes.",
			inputSchema: {
				entity: z
					.enum([
						"products",
						"recipes",
						"locations",
						"shopping_locations",
						"quantity_units",
						"product_groups",
					])
					.describe(
						"Entity type to set userfields for (e.g., 'products', 'recipes')"
					),
				object_id: z
					.number()
					.describe("ID of the specific object to set userfields for"),
				userfields: z
					.record(z.any())
					.describe(
						"Object containing userfield names and values. Common product fields: protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, brand, package_size, serving_size, is_organic. Common recipe fields: prep_time_minutes, cook_time_minutes, difficulty, cuisine_type, meal_type, is_vegetarian."
					),
			},
		},
		async ({ entity, object_id, userfields }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest(
					`userfields/${entity}/${object_id}`,
					"PUT",
					userfields
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									entity,
									object_id,
									userfields,
									message: `Set ${
										Object.keys(userfields).length
									} userfield(s) for ${entity} ID ${object_id}`,
									note: "Userfields are NOT auto-aggregated in recipes. Use grocy_nutrition_calculate_recipe for manual aggregation.",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error setting userfields: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// LOCATIONS - LIST
	server.registerTool(
		"grocy_location_list",
		{
			title: "List Locations",
			description:
				"Returns all storage locations in Grocy. Use this to find location IDs when creating products or adding stock.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("objects/locations")) as Array<{
					id: number;
					name: string;
					description?: string;
				}>;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_locations: data.length,
									locations: data.map((loc) => ({
										id: loc.id,
										name: loc.name,
										description: loc.description || "",
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching locations: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// QUANTITY UNITS - LIST
	server.registerTool(
		"grocy_quantity_unit_list",
		{
			title: "List Quantity Units",
			description:
				"Returns all quantity units in Grocy (piece, gram, kg, liter, ml, etc). Use this to find qu_id values when creating products or adding ingredients.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("objects/quantity_units")) as Array<{
					id: number;
					name: string;
					name_plural?: string;
					description?: string;
				}>;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_units: data.length,
									quantity_units: data.map((qu) => ({
										id: qu.id,
										name: qu.name,
										name_plural: qu.name_plural || qu.name,
										description: qu.description || "",
									})),
									common_units: {
										1: "piece",
										2: "gram",
										3: "kg",
										4: "liter",
										5: "ml",
									},
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching quantity units: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LOCATIONS (STORES) - LIST
	server.registerTool(
		"grocy_store_list",
		{
			title: "List Shopping Locations (Stores)",
			description:
				"Returns all shopping locations/stores in Grocy (e.g., Woolworths, Coles, local markets). Use this to find store IDs when adding products to stock.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest(
					"objects/shopping_locations"
				)) as Array<{
					id: number;
					name: string;
					description?: string;
				}>;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_stores: data.length,
									stores: data.map((store) => ({
										id: store.id,
										name: store.name,
										description: store.description || "",
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching stores: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SHOPPING LOCATIONS (STORES) - CREATE
	server.registerTool(
		"grocy_store_create",
		{
			title: "Create Shopping Location (Store)",
			description:
				"Creates a new shopping location/store in Grocy (e.g., Woolworths, Coles, local farm market). Use this to track where you purchased products.",
			inputSchema: {
				name: z.string().describe("Store name (e.g., 'Woolworths', 'Coles')"),
				description: z
					.string()
					.optional()
					.describe("Optional description (e.g., 'Local branch on Main St')"),
			},
		},
		async ({ name, description }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					name,
				};

				if (description) {
					body.description = description;
				}

				const data = (await grocyRequest(
					"objects/shopping_locations",
					"POST",
					body
				)) as { created_object_id: string };

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									store_id: data.created_object_id,
									message: `Created store: ${name}`,
									name,
									description: description || "",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating store: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PRODUCT GROUPS - LIST
	server.registerTool(
		"grocy_product_group_list",
		{
			title: "List Product Groups (Categories)",
			description:
				"Returns all product groups/categories in Grocy (e.g., Produce, Dairy, Meat, Pantry Staples). Use this to find group IDs when organizing products.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("objects/product_groups")) as Array<{
					id: number;
					name: string;
					description?: string;
				}>;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_groups: data.length,
									product_groups: data.map((group) => ({
										id: group.id,
										name: group.name,
										description: group.description || "",
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching product groups: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PRODUCT GROUPS - CREATE
	server.registerTool(
		"grocy_product_group_create",
		{
			title: "Create Product Group (Category)",
			description:
				"Creates a new product group/category in Grocy (e.g., Produce, Dairy, Meat, Cleaning Supplies). Use this to organize products by type.",
			inputSchema: {
				name: z
					.string()
					.describe("Group name (e.g., 'Produce', 'Dairy', 'Meat', 'Bakery')"),
				description: z
					.string()
					.optional()
					.describe(
						"Optional description (e.g., 'Fresh fruits and vegetables')"
					),
			},
		},
		async ({ name, description }) => {
					try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const body: Record<string, unknown> = {
					name,
				};

				if (description) {
					body.description = description;
				}

				const data = (await grocyRequest(
					"objects/product_groups",
					"POST",
					body
				)) as { created_object_id: string };

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									group_id: data.created_object_id,
									message: `Created product group: ${name}`,
									name,
									description: description || "",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating product group: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// MEAL PLAN - ADD
	server.registerTool(
		"grocy_meal_plan_add",
		{
			title: "Add Recipe to Meal Plan",
			description:
				"Adds a recipe to your meal plan calendar for a specific date. Great for planning weekly meals and automatically generating shopping lists.",
			inputSchema: {
				recipe_id: z.number().describe("Recipe ID to add to meal plan"),
				date: z
					.string()
					.describe(
						"Date for meal plan (YYYY-MM-DD format, e.g., '2025-11-15')"
					),
				section: z
					.string()
					.optional()
					.describe(
						"Meal section: 'breakfast', 'lunch', 'dinner'. Defaults to 'dinner'"
					),
				servings: z
					.number()
					.optional()
					.describe("Number of servings (defaults to recipe's base_servings)"),
				note: z
					.string()
					.optional()
					.describe("Optional note for this meal plan entry"),
			},
		},
		async ({ recipe_id, date, section, servings, note }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				// Map section string to section_id
				const sectionMap: Record<string, number> = {
					breakfast: 1,
					lunch: 2,
					dinner: 3,
				};
				const section_id = sectionMap[section?.toLowerCase() || "dinner"] || 3;

				const body: Record<string, unknown> = {
					recipe_id,
					day: date,
					type: "recipe",
					section_id,
				};

				if (servings !== undefined) {
					body.recipe_servings = servings;
				}
				if (note) {
					body.note = note;
				}

				const response = (await grocyRequest(
					"objects/meal_plan",
					"POST",
					body
				)) as {
					created_object_id: number;
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									meal_plan_id: response.created_object_id,
									message: `Added recipe ${recipe_id} to meal plan for ${date} (${
										section || "dinner"
									})`,
									date,
									section: section || "dinner",
									servings: servings || "default",
									next_step:
										"Use grocy_recipe_add_missing_to_shoppinglist to add missing ingredients to your shopping list",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error adding recipe to meal plan: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// MEAL PLAN - GET
	server.registerTool(
		"grocy_meal_plan_get",
		{
			title: "Get Meal Plan",
			description:
				"Retrieves meal plans for a date range. See what recipes are planned for specific days. Useful for weekly meal planning overview.",
			inputSchema: {
				start_date: z
					.string()
					.optional()
					.describe("Start date (YYYY-MM-DD). Defaults to today if omitted"),
				end_date: z
					.string()
					.optional()
					.describe(
						"End date (YYYY-MM-DD). Defaults to 7 days from start if omitted"
					),
			},
		},
		async ({ start_date, end_date }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				// Get all meal plans (Grocy doesn't support date filtering in API directly)
				const data = (await grocyRequest("objects/meal_plan")) as Array<{
					id: number;
					recipe_id: number;
					day: string;
					type?: string;
					recipe_servings?: number;
					section_id?: number;
					note?: string;
					recipe?: { id: number; name: string };
				}>;

				// Filter by date range if specified
				let filteredData = data;
				if (start_date || end_date) {
					const startDate = start_date ? new Date(start_date) : new Date();
					const endDate = end_date
						? new Date(end_date)
						: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

					filteredData = data.filter((plan) => {
						const planDate = new Date(plan.day);
						return planDate >= startDate && planDate <= endDate;
					});
				}

				// Sort by date
				filteredData.sort((a, b) => a.day.localeCompare(b.day));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total_plans: filteredData.length,
									start_date: start_date || "today",
									end_date: end_date || "7 days from start",
									meal_plans: filteredData.map((plan) => ({
										id: plan.id,
										recipe_id: plan.recipe_id,
										recipe_name:
											plan.recipe?.name || `Recipe ${plan.recipe_id}`,
										date: plan.day,
										type: plan.type || "dinner",
										servings: plan.recipe_servings || "default",
										note: plan.note || "",
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching meal plans: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// MEAL PLAN - DELETE
	server.registerTool(
		"grocy_meal_plan_delete",
		{
			title: "Delete Meal Plan Entry",
			description:
				"Deletes a meal plan entry by ID. Use grocy_meal_plan_get to find the entry ID first.",
			inputSchema: {
				meal_plan_id: z
					.number()
					.describe("The ID of the meal plan entry to delete"),
			},
		},
		async ({ meal_plan_id }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				await grocyRequest(`objects/meal_plan/${meal_plan_id}`, "DELETE");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Deleted meal plan entry ${meal_plan_id}`,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error deleting meal plan entry: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SYSTEM - GET INFO
	server.registerTool(
		"grocy_system_info",
		{
			title: "Get Grocy System Info",
			description:
				"Returns information about your Grocy installation including version, PHP version, and database info.",
			inputSchema: {},
		},
		async () => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				const data = (await grocyRequest("system/info")) as {
					grocy_version: { Version: string; ReleaseDate: string };
					php_version: string;
					sqlite_version: string;
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									grocy_version: data.grocy_version.Version,
									release_date: data.grocy_version.ReleaseDate,
									php_version: data.php_version,
									sqlite_version: data.sqlite_version,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching system info: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
