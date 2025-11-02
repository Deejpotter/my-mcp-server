/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Google Search tool using SerpAPI for web search capabilities.
 * Provides structured search results with titles, URLs, and descriptions.
 * Requires SERPAPI_API_KEY environment variable for API access.
 *
 * References:
 * SerpAPI JavaScript: https://github.com/serpapi/serpapi-javascript
 * SerpAPI Documentation: https://serpapi.com/search-api
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * SerpAPI response structure for organic search results
 * Reference: https://serpapi.com/search-api
 */
interface SerpAPIResult {
	title?: string;
	link?: string;
	snippet?: string;
	position?: number;
}

interface SerpAPIResponse {
	organic_results?: SerpAPIResult[];
	search_metadata?: {
		status?: string;
	};
}

/**
 * Structured search result returned to the client
 */
interface SearchResult {
	title: string;
	link: string;
	snippet: string;
	position: number;
}

/**
 * Register Google Search tools with the MCP server
 *
 * Uses SerpAPI for reliable, structured search results from Google.
 * API key should be set in SERPAPI_API_KEY environment variable.
 * Free tier: 100 searches/month, paid plans available for higher limits.
 */
export function registerGoogleSearchTools(server: McpServer) {
	// GOOGLE SEARCH TOOL
	server.registerTool(
		"google_search",
		{
			title: "Google Search",
			description:
				"Search Google and get structured results (titles, URLs, descriptions). Requires SERPAPI_API_KEY environment variable.",
			inputSchema: {
				query: z.string().describe("Search query"),
				num_results: z
					.number()
					.optional()
					.default(10)
					.describe("Number of results to return (default: 10, max: 100)"),
				location: z
					.string()
					.optional()
					.describe("Location for localized results (e.g., 'Austin, Texas')"),
			},
			outputSchema: {
				results: z.array(
					z.object({
						title: z.string(),
						link: z.string(),
						snippet: z.string(),
						position: z.number(),
					})
				),
				totalResults: z.number(),
				searchParameters: z.object({
					query: z.string(),
					location: z.string().optional(),
				}),
			},
		},
		async ({ query, num_results = 10, location }) => {
			try {
				// Check for API key
				const apiKey = process.env.SERPAPI_API_KEY;
				if (!apiKey) {
					return {
						content: [
							{
								type: "text",
								text: `Error: SERPAPI_API_KEY environment variable not set.

Get your API key from: https://serpapi.com/manage-api-key
Free tier: 100 searches/month

Add to your .env file:
SERPAPI_API_KEY=your_api_key_here`,
							},
						],
						isError: true,
					};
				}

				// Check rate limit
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds before making another search request.`,
							},
						],
						isError: true,
					};
				}

				// Use Node.js built-in fetch (available in Node 18+)
				// Construct SerpAPI request
				const params = new URLSearchParams({
					engine: "google",
					api_key: apiKey,
					q: query,
					num: Math.min(num_results, 100).toString(),
				});

				if (location) {
					params.append("location", location);
				}

				const response = await fetch(
					`https://serpapi.com/search?${params.toString()}`,
					{
						method: "GET",
						headers: {
							"Content-Type": "application/json",
						},
					}
				);

				if (!response.ok) {
					throw new Error(
						`SerpAPI request failed: ${response.status} ${response.statusText}`
					);
				}

				const data = (await response.json()) as SerpAPIResponse;

				// Extract organic results
				const organicResults = data.organic_results || [];
				const results: SearchResult[] = organicResults.map(
					(result, index: number) => ({
						title: result.title || "",
						link: result.link || "",
						snippet: result.snippet || "",
						position: result.position || index + 1,
					})
				);

				const output = {
					results,
					totalResults: results.length,
					searchParameters: {
						query,
						...(location && { location }),
					},
				};

				// Format results for text output
				const formattedResults =
					results.length > 0
						? results
								.map(
									(r: SearchResult) =>
										`[${r.position}] ${r.title}\n${r.link}\n${r.snippet}\n`
								)
								.join("\n")
						: "No results found";

				return {
					content: [
						{
							type: "text",
							text: `Google Search Results for "${query}"${
								location ? ` (${location})` : ""
							}:\n\n${formattedResults}\n\nTotal Results: ${results.length}`,
						},
					],
					structuredContent: output,
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{
							type: "text",
							text: `Error performing Google search: ${err.message}

Make sure:
1. SERPAPI_API_KEY is set in your .env file
2. Your API key is valid (check: https://serpapi.com/manage-api-key)
3. You have remaining API credits (Free tier: 100 searches/month)`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
