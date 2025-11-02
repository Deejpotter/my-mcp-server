/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * DuckDuckGo Search tool using HTML search endpoint.
 * Provides web search results without requiring an API key.
 * Free and unlimited searches with no authentication required.
 *
 * References:
 * DuckDuckGo HTML Search: https://html.duckduckgo.com/html/
 * duckduckgo_search Python library: https://github.com/deedy5/duckduckgo_search
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * Structured search result returned to the client
 */
interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	position: number;
}

/**
 * Register DuckDuckGo Search tools with the MCP server
 *
 * Uses DuckDuckGo's Instant Answer API for free, unlimited searches.
 * No API key required. Rate limiting applied locally to be respectful.
 */
export function registerDuckDuckGoSearchTools(server: McpServer) {
	// DUCKDUCKGO SEARCH TOOL
	server.registerTool(
		"duckduckgo_search",
		{
			title: "DuckDuckGo Search",
			description:
				"Search DuckDuckGo and get results (no API key required). Returns instant answers and related topics.",
			inputSchema: {
				query: z.string().describe("Search query"),
				max_results: z
					.number()
					.optional()
					.default(10)
					.describe("Maximum number of results to return (default: 10)"),
			},
			outputSchema: {
				results: z.array(
					z.object({
						title: z.string(),
						url: z.string(),
						snippet: z.string(),
						position: z.number(),
					})
				),
				totalResults: z.number(),
				query: z.string(),
			},
		},
		async ({ query, max_results = 10 }) => {
			try {
				// Apply local rate limiting to be respectful
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

				// Use DuckDuckGo HTML search endpoint for actual web results
				// Reference: https://html.duckduckgo.com/html/
				const params = new URLSearchParams({
					q: query,
					kl: "wt-wt", // Region: worldwide
				});

				const response = await fetch(
					`https://html.duckduckgo.com/html/?${params.toString()}`,
					{
						method: "GET",
						headers: {
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
							Accept: "text/html",
						},
					}
				);

				if (!response.ok) {
					throw new Error(
						`DuckDuckGo search failed: ${response.status} ${response.statusText}`
					);
				}

				const html = await response.text();

				// Parse HTML to extract search results
				const results: SearchResult[] = [];
				let position = 1;

				// Helper function to decode HTML entities and strip HTML tags
				const cleanHtml = (text: string): string => {
					return text
						.replace(/<[^>]*>/g, "") // Strip HTML tags
						.replace(/&amp;/g, "&")
						.replace(/&lt;/g, "<")
						.replace(/&gt;/g, ">")
						.replace(/&quot;/g, '"')
						.replace(/&#x27;/g, "'")
						.replace(/&#39;/g, "'")
						.replace(/&nbsp;/g, " ")
						.trim();
				};

				// Extract result blocks - each result is in a div with class starting with "result"
				const resultRegex = /<div[^>]*class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
				let resultMatch;

				while (
					(resultMatch = resultRegex.exec(html)) !== null &&
					position <= max_results
				) {
					const resultBlock = resultMatch[1];
					if (!resultBlock) continue;

					// Extract title from result__a link
					const titleMatch = resultBlock.match(
						/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/
					);
					if (!titleMatch) continue;

					const [, hrefAttr, titleText] = titleMatch;
					if (!hrefAttr || !titleText) continue;

					// Decode the URL (DuckDuckGo wraps URLs in //duckduckgo.com/l/?uddg= parameter)
					let url = hrefAttr;
					const uddgMatch = url.match(/uddg=([^&]+)/);
					if (uddgMatch && uddgMatch[1]) {
						try {
							url = decodeURIComponent(uddgMatch[1]);
						} catch (e) {
							url = uddgMatch[1];
						}
					}

					// Clean title
					const title = cleanHtml(titleText);

					// Extract snippet from result__snippet
					let snippet = "";
					const snippetMatch = resultBlock.match(
						/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/
					);
					if (snippetMatch && snippetMatch[1]) {
						snippet = cleanHtml(snippetMatch[1]);
					}

					// Only add if we have a valid URL (not a relative DuckDuckGo link)
					if (url && !url.startsWith("/") && !url.startsWith("//") && title) {
						results.push({
							title,
							url,
							snippet,
							position: position++,
						});
					}
				}

				const output = {
					results: results.slice(0, max_results),
					totalResults: results.length,
					query,
				};

				// Format results for text output
				let formattedResults = "";

				if (results.length > 0) {
					formattedResults = results
						.map((r) => {
							const snippetText = r.snippet ? `\n${r.snippet}` : "";
							return `[${r.position}] ${r.title}\n${r.url}${snippetText}`;
						})
						.join("\n\n");
				} else {
					formattedResults =
						"No results found. Try a different search query or check your spelling.";
				}

				return {
					content: [
						{
							type: "text",
							text: `DuckDuckGo Search Results for "${query}":\n\n${formattedResults}`,
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
							text: `Error performing DuckDuckGo search: ${err.message}

DuckDuckGo Instant Answer API is free and doesn't require an API key.
If you're experiencing issues:
1. Check your internet connection
2. Try a different search query
3. The API may be temporarily unavailable`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
