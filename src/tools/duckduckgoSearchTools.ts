/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * DuckDuckGo Search tool using Instant Answer API.
 * Provides web search results without requiring an API key.
 * Free and unlimited searches with no authentication required.
 *
 * References:
 * DuckDuckGo Instant Answer API: https://duckduckgo.com/api
 * DuckDuckGo HTML Scraping (used for fallback): https://html.duckduckgo.com/html/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * DuckDuckGo Instant Answer API response structure
 * Reference: https://duckduckgo.com/api
 */
interface DDGRelatedTopic {
	Text?: string;
	FirstURL?: string;
}

interface DDGResponse {
	Abstract?: string;
	AbstractText?: string;
	AbstractSource?: string;
	AbstractURL?: string;
	RelatedTopics?: (DDGRelatedTopic | { Topics?: DDGRelatedTopic[] })[];
	Heading?: string;
}

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
				abstract: z.string().optional(),
				abstractSource: z.string().optional(),
				abstractURL: z.string().optional(),
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

				// Use DuckDuckGo Instant Answer API
				// Reference: https://duckduckgo.com/api
				const params = new URLSearchParams({
					q: query,
					format: "json",
					no_html: "1",
					skip_disambig: "1",
				});

				const response = await fetch(
					`https://api.duckduckgo.com/?${params.toString()}`,
					{
						method: "GET",
						headers: {
							"User-Agent": "my-mcp-server/1.0.0",
							Accept: "application/json",
						},
					}
				);

				if (!response.ok) {
					throw new Error(
						`DuckDuckGo API request failed: ${response.status} ${response.statusText}`
					);
				}

				const data = (await response.json()) as DDGResponse;

				// Extract results from related topics
				const results: SearchResult[] = [];
				let position = 1;

				// Add abstract as first result if available
				if (data.AbstractText && data.AbstractURL) {
					results.push({
						title: data.Heading || query,
						url: data.AbstractURL,
						snippet: data.AbstractText,
						position: position++,
					});
				}

				// Extract related topics
				if (data.RelatedTopics) {
					for (const topic of data.RelatedTopics) {
						if (position > max_results) break;

						// Handle nested topics
						if ("Topics" in topic && topic.Topics) {
							for (const subTopic of topic.Topics) {
								if (position > max_results) break;
								if (subTopic.Text && subTopic.FirstURL) {
									results.push({
										title: subTopic.Text.split(" - ")[0] || subTopic.Text,
										url: subTopic.FirstURL,
										snippet: subTopic.Text,
										position: position++,
									});
								}
							}
						} else if ("Text" in topic && topic.Text && topic.FirstURL) {
							results.push({
								title: topic.Text.split(" - ")[0] || topic.Text,
								url: topic.FirstURL,
								snippet: topic.Text,
								position: position++,
							});
						}
					}
				}

				const output = {
					abstract: data.AbstractText,
					abstractSource: data.AbstractSource,
					abstractURL: data.AbstractURL,
					results: results.slice(0, max_results),
					totalResults: results.length,
					query,
				};

				// Format results for text output
				let formattedResults = "";
				if (data.AbstractText) {
					formattedResults += `Abstract: ${data.AbstractText}\n`;
					if (data.AbstractSource) {
						formattedResults += `Source: ${data.AbstractSource}\n`;
					}
					if (data.AbstractURL) {
						formattedResults += `URL: ${data.AbstractURL}\n`;
					}
					formattedResults += "\n";
				}

				if (results.length > 0) {
					formattedResults += results
						.map((r) => `[${r.position}] ${r.title}\n${r.url}\n${r.snippet}\n`)
						.join("\n");
				} else {
					formattedResults +=
						"No results found. Try a more specific search query.";
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
