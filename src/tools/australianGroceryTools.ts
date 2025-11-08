/**
 * Created: 08/11/25
 * By: Daniel Potter
 *
 * Australian Grocery Price API integration for Woolworths and Coles.
 * Provides price comparison, shopping list cost analysis, and integration with Grocy.
 *
 * Requires environment variables:
 * - COLES_API_KEY: API key for Coles API (subscription-key)
 *
 * Woolworths API is public and doesn't require authentication.
 *
 * References:
 * - Woolworths API: https://www.woolworths.com.au/apis/ui/Search/products
 * - Coles API: https://www.coles.com.au/api/bff/products/search
 * - Based on: https://github.com/hung-ngm/coles-woolworths-mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * Product result from Australian grocery stores
 */
interface AustralianGroceryProduct {
	name: string;
	price: number | null;
	unit: string; // e.g., "kg", "g", "L", "ml", "each", "pack"
	store: "woolworths" | "coles";
	packageSize?: string | undefined;
}

/**
 * Woolworths API product structure
 */
interface WoolworthsProduct {
	Stockcode: number;
	Name?: string;
	DisplayName?: string;
	Price: number;
	InstorePrice?: number;
	WasPrice?: number;
	PackageSize?: string;
	CupString?: string;
	CupMeasure?: string;
	Unit?: string;
}

/**
 * Woolworths API response structure
 */
interface WoolworthsApiResponse {
	Products?: Array<{
		Products?: WoolworthsProduct[];
	}>;
}

/**
 * Coles API product structure
 */
interface ColesProduct {
	name: string;
	pricing?: {
		now?: number;
		was?: number;
	};
	packageSize?: string;
	quantity?: string;
	size?: string;
	description?: string;
}

/**
 * Coles API response structure
 */
interface ColesApiResponse {
	results?: ColesProduct[];
}

/**
 * Extract unit from Woolworths product fields
 */
function extractWoolworthsUnit(product: WoolworthsProduct): string {
	// Priority 1: PackageSize
	const packageSize = product.PackageSize;
	if (packageSize && typeof packageSize === "string") {
		const ps = packageSize.toLowerCase();
		if (ps.includes("kg")) return "kg";
		if (ps.includes("g") && !ps.includes("kg")) return "g";
		if (ps.includes("l") && !ps.includes("ml")) return "L";
		if (ps.includes("ml")) return "ml";
		if (ps.includes("each")) return "each";
		if (ps.includes("pack") || ps.includes("pk")) return "pack";
	}

	// Priority 2: CupString
	const cupString = product.CupString;
	if (cupString && typeof cupString === "string") {
		const cs = cupString.toLowerCase();
		const parts = cs.split("/");
		const target =
			parts.length > 1 ? parts[parts.length - 1]?.trim() ?? cs : cs;

		if (target.includes("kg")) return "kg";
		if (target.includes("g") && !target.includes("kg")) return "g";
		if (target.includes("l") && !target.includes("ml")) return "L";
		if (target.includes("ml")) return "ml";
		if (target.includes("each") || target.includes("ea")) return "each";
		if (target.includes("pack") || target.includes("pk")) return "pack";
	}

	// Priority 3: CupMeasure
	const cupMeasure = product.CupMeasure;
	if (cupMeasure && typeof cupMeasure === "string") {
		const cm = cupMeasure.toLowerCase();
		if (cm.includes("kg")) return "kg";
		if (cm.includes("g") && !cm.includes("kg")) return "g";
		if (cm.includes("l") && !cm.includes("ml")) return "L";
		if (cm.includes("ml")) return "ml";
		if (cm.includes("each")) return "each";
		if (cm.includes("pack") || cm.includes("pk")) return "pack";
	}

	// Priority 4: Unit field
	const apiUnit = product.Unit;
	if (apiUnit && typeof apiUnit === "string") {
		if (apiUnit.toLowerCase() === "each") return "each";
	}

	return "each";
}

/**
 * Extract unit from Coles product fields
 */
function extractColesUnit(product: ColesProduct): string {
	const fields = [
		product.packageSize,
		product.quantity,
		product.size,
		product.description,
	];

	for (const field of fields) {
		if (!field) continue;

		const lower = field.toLowerCase();
		if (lower.includes("kg")) return "kg";
		if (lower.includes("g") && !lower.includes("mg")) return "g";
		if (lower.includes("l") && !lower.includes("ml")) return "L";
		if (lower.includes("ml")) return "ml";
		if (lower.includes("each")) return "each";
		if (lower.includes("pack")) return "pack";
	}

	return "each";
}

/**
 * Search Woolworths products
 */
async function searchWoolworths(
	query: string
): Promise<AustralianGroceryProduct[]> {
	genericLimiter.allowCall();

	const formattedQuery = query.replace(/ /g, "+");
	const url = `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${formattedQuery}`;

	const headers = {
		Accept: "application/json",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
	};

	const response = await fetch(url, { headers });

	if (!response.ok) {
		throw new Error(
			`Woolworths API error: ${response.status} ${response.statusText}`
		);
	}

	const data = (await response.json()) as WoolworthsApiResponse;
	const products: AustralianGroceryProduct[] = [];

	// Parse nested Products structure
	if (data.Products && Array.isArray(data.Products)) {
		for (const productCategory of data.Products) {
			let productList = productCategory.Products;

			// Handle direct product objects
			if (
				!Array.isArray(productList) &&
				typeof productCategory === "object" &&
				"Stockcode" in productCategory &&
				!("Products" in productCategory)
			) {
				productList = [productCategory as unknown as WoolworthsProduct];
			}

			if (!Array.isArray(productList)) continue;

			for (const product of productList) {
				const name = product.DisplayName || product.Name || "";
				const price =
					product.Price ?? product.InstorePrice ?? product.WasPrice ?? null;
				const unit = extractWoolworthsUnit(product);

				products.push({
					name,
					price: price !== null ? Number(price) : null,
					unit,
					store: "woolworths",
					packageSize: product.PackageSize,
				});
			}
		}
	}

	return products;
}

/**
 * Search Coles products
 */
async function searchColes(
	query: string,
	storeId: string = "0584"
): Promise<AustralianGroceryProduct[]> {
	genericLimiter.allowCall();

	const apiKey = process.env.COLES_API_KEY;
	if (!apiKey) {
		throw new Error(
			"COLES_API_KEY environment variable is not set. " +
				"Please add your Coles API subscription key."
		);
	}

	const url = "https://www.coles.com.au/api/bff/products/search";
	const params = new URLSearchParams({
		storeId,
		searchTerm: query,
		start: "0",
		sortBy: "salesDescending",
		excludeAds: "true",
		authenticated: "false",
		"subscription-key": apiKey,
	});

	const headers = {
		Accept: "application/json",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
	};

	const response = await fetch(`${url}?${params.toString()}`, { headers });

	if (!response.ok) {
		throw new Error(
			`Coles API error: ${response.status} ${response.statusText}`
		);
	}

	const data = (await response.json()) as ColesApiResponse;
	const products: AustralianGroceryProduct[] = [];

	if (data.results && Array.isArray(data.results)) {
		for (const product of data.results) {
			const name = product.name || "";
			const pricing = product.pricing || {};
			const price = pricing.now ?? pricing.was ?? null;
			const unit = extractColesUnit(product);

			products.push({
				name,
				price: price !== null ? Number(price) : null,
				unit,
				store: "coles",
				packageSize: product.packageSize,
			});
		}
	}

	return products;
}

/**
 * Register Australian grocery tools with the MCP server
 */
export function registerAustralianGroceryTools(server: McpServer) {
	// WOOLWORTHS - SEARCH PRODUCTS
	server.registerTool(
		"woolworths_search_product",
		{
			title: "Search Woolworths Products",
			description:
				"Search for products at Woolworths Australia and get current prices. " +
				"Returns product names, prices, units (kg, g, L, ml, each, pack), and package sizes. " +
				"Useful for price checking and comparing with other stores.",
			inputSchema: {
				query: z
					.string()
					.describe(
						"Product name to search for (e.g., 'ground beef', 'spaghetti')"
					),
				limit: z
					.number()
					.optional()
					.default(10)
					.describe("Maximum number of results to return (default: 10)"),
			},
		},
		async ({ query, limit = 10 }) => {
			try {
				genericLimiter.allowCall();
				const products = await searchWoolworths(query);
				const limited = products.slice(0, limit);

				if (limited.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No products found at Woolworths for "${query}".`,
							},
						],
					};
				}

				const formatted = limited.map((p) => {
					const priceStr = p.price !== null ? `$${p.price.toFixed(2)}` : "N/A";
					const unitStr = p.unit || "N/A";
					const sizeStr = p.packageSize ? ` (${p.packageSize})` : "";
					return `• ${p.name}${sizeStr}\n  Price: ${priceStr} | Unit: ${unitStr}`;
				});

				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${
								limited.length
							} products at Woolworths for "${query}":\n\n${formatted.join(
								"\n\n"
							)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error searching Woolworths: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// COLES - SEARCH PRODUCTS
	server.registerTool(
		"coles_search_product",
		{
			title: "Search Coles Products",
			description:
				"Search for products at Coles Australia and get current prices. " +
				"Returns product names, prices, units (kg, g, L, ml, each, pack), and package sizes. " +
				"Requires COLES_API_KEY environment variable. Default store is 0584.",
			inputSchema: {
				query: z
					.string()
					.describe(
						"Product name to search for (e.g., 'ground beef', 'spaghetti')"
					),
				store_id: z
					.string()
					.optional()
					.default("0584")
					.describe("Coles store ID (default: 0584)"),
				limit: z
					.number()
					.optional()
					.default(10)
					.describe("Maximum number of results to return (default: 10)"),
			},
		},
		async ({ query, store_id = "0584", limit = 10 }) => {
			try {
				genericLimiter.allowCall();
				const products = await searchColes(query, store_id);
				const limited = products.slice(0, limit);

				if (limited.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No products found at Coles for "${query}".`,
							},
						],
					};
				}

				const formatted = limited.map((p) => {
					const priceStr = p.price !== null ? `$${p.price.toFixed(2)}` : "N/A";
					const unitStr = p.unit || "N/A";
					const sizeStr = p.packageSize ? ` (${p.packageSize})` : "";
					return `• ${p.name}${sizeStr}\n  Price: ${priceStr} | Unit: ${unitStr}`;
				});

				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${
								limited.length
							} products at Coles for "${query}" (Store: ${store_id}):\n\n${formatted.join(
								"\n\n"
							)}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error searching Coles: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// COMPARE PRICES - SINGLE PRODUCT
	server.registerTool(
		"grocery_compare_prices",
		{
			title: "Compare Product Prices Across Stores",
			description:
				"Search for a product at both Woolworths and Coles, compare prices, and find the cheapest option. " +
				"Returns detailed price comparison with best matches from each store and savings calculation.",
			inputSchema: {
				query: z
					.string()
					.describe(
						"Product name to search for (e.g., 'ground beef', 'tomato sauce')"
					),
				limit_per_store: z
					.number()
					.optional()
					.default(5)
					.describe("Maximum results per store (default: 5)"),
			},
		},
		async ({ query, limit_per_store = 5 }) => {
			try {
				genericLimiter.allowCall();

				// Search both stores in parallel
				const [woolworthsProducts, colesProducts] = await Promise.all([
					searchWoolworths(query),
					searchColes(query),
				]);

				const woolworthsLimited = woolworthsProducts
					.filter((p) => p.price !== null)
					.slice(0, limit_per_store);
				const colesLimited = colesProducts
					.filter((p) => p.price !== null)
					.slice(0, limit_per_store);

				if (woolworthsLimited.length === 0 && colesLimited.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No products with prices found at either store for "${query}".`,
							},
						],
					};
				}

				// Find best price from each store
				const woolworthsBest = woolworthsLimited[0];
				const colesBest = colesLimited[0];

				let comparison = `🛒 Price Comparison for "${query}"\n\n`;

				// Woolworths results
				if (woolworthsBest) {
					comparison += `🟢 WOOLWORTHS - Best Match:\n`;
					comparison += `   ${woolworthsBest.name}\n`;
					comparison += `   💰 $${woolworthsBest.price?.toFixed(2)} (${
						woolworthsBest.unit
					})\n`;
					if (woolworthsBest.packageSize) {
						comparison += `   📦 ${woolworthsBest.packageSize}\n`;
					}
					comparison += `\n`;
				} else {
					comparison += `🟢 WOOLWORTHS: No results\n\n`;
				}

				// Coles results
				if (colesBest) {
					comparison += `🔴 COLES - Best Match:\n`;
					comparison += `   ${colesBest.name}\n`;
					comparison += `   💰 $${colesBest.price?.toFixed(2)} (${
						colesBest.unit
					})\n`;
					if (colesBest.packageSize) {
						comparison += `   📦 ${colesBest.packageSize}\n`;
					}
					comparison += `\n`;
				} else {
					comparison += `🔴 COLES: No results\n\n`;
				}

				// Calculate cheapest option
				if (
					woolworthsBest &&
					colesBest &&
					woolworthsBest.price &&
					colesBest.price
				) {
					const diff = Math.abs(woolworthsBest.price - colesBest.price);
					if (woolworthsBest.price < colesBest.price) {
						comparison += `✅ CHEAPEST: Woolworths (save $${diff.toFixed(
							2
						)})\n`;
					} else if (colesBest.price < woolworthsBest.price) {
						comparison += `✅ CHEAPEST: Coles (save $${diff.toFixed(2)})\n`;
					} else {
						comparison += `✅ SAME PRICE at both stores\n`;
					}
				} else if (woolworthsBest) {
					comparison += `✅ ONLY AVAILABLE: Woolworths\n`;
				} else if (colesBest) {
					comparison += `✅ ONLY AVAILABLE: Coles\n`;
				}

				return {
					content: [
						{
							type: "text" as const,
							text: comparison,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error comparing prices: ${
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
