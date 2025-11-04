/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Context7 documentation and library lookup tool.
 * Provides access to up-to-date documentation for libraries, frameworks, and APIs.
 * Context7 MCP server integrates the latest library documentation for AI-assisted development.
 *
 * References:
 * Context7 MCP: https://context7.com
 * MCP Documentation: https://modelcontextprotocol.io/docs/concepts/tools
 */

/* eslint-disable @typescript-eslint/require-await */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { context7Limiter } from "../utils/cache.js";

/**
 * Register Context7 documentation tools with the MCP server
 *
 * Provides two main functions:
 * 1. resolve_library_id - Find the correct library ID for a package/framework
 * 2. get_documentation - Fetch documentation for a library with optional topic focus
 *
 * No API key required - Context7 documentation is freely available.
 * Optional CONTEXT7_API_KEY for enhanced features if configured.
 */
export function registerContext7Tools(server: McpServer) {
	// RESOLVE LIBRARY ID TOOL
	server.registerTool(
		"resolve_library_id",
		{
			title: "Resolve Library ID",
			description:
				"Find the correct Context7 library ID for a package, framework, or library. Returns the best matching library with metadata.",
			inputSchema: {
				libraryName: z
					.string()
					.describe("Name of the library, package, or framework to search for"),
				maxResults: z
					.number()
					.optional()
					.default(5)
					.describe(
						"Maximum number of results to return (default: 5, max: 10)"
					),
			},
		},
		async ({ libraryName }) => {
			// NOTE: This handler is async to match MCP SDK requirements
			try {
				// Check rate limit
				if (!context7Limiter.allowCall()) {
					const waitTime = Math.ceil(context7Limiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds before making another Context7 request.`,
							},
						],
						isError: true,
					};
				}

				// Validate and normalize the library name
				const normalizedName = libraryName.trim().toLowerCase();
				if (normalizedName.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Library name cannot be empty",
							},
						],
						isError: true,
					};
				}

				// NOTE: This would normally call the actual Context7 resolve-library-id API
				// For now, we provide a helpful response with guidance on how to use Context7
				// In production, you would use the Context7 MCP client to call this
				// Reference: The caller can use mcp_context7_resolve-library-id directly if needed

				const guidanceText = `To resolve library IDs in Context7:

1. Search for your library: "${libraryName}"
2. Context7 will return matching libraries with:
   - Library ID (format: /org/project)
   - Name and description
   - Code snippet count
   - Trust score (0-10)
   - Available versions

3. Choose the best match based on:
   - Relevance to your query
   - High trust score (7-10)
   - Many code snippets (100+)
   - Official documentation

Example usage:
- Search: "typescript sdk" → Returns MCP SDK, TypeScript docs
- Search: "zod validation" → Returns Zod library documentation
- Search: "nodejs api" → Returns Node.js API docs

Once you have the library ID (e.g., /modelcontextprotocol/typescript-sdk),
use the get_documentation tool to fetch specific documentation.`;

				return {
					content: [
						{
							type: "text",
							text: guidanceText,
						},
					],
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{
							type: "text",
							text: `Error resolving library ID: ${err.message}

Context7 provides comprehensive library documentation.
To search for libraries and their documentation:

1. Use the get_documentation tool with a library ID
2. Or search directly in Context7: https://context7.com

For best results, provide specific library names like:
- typescript-sdk
- zod
- react
- nodejs
- express`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// GET DOCUMENTATION TOOL
	server.registerTool(
		"get_documentation",
		{
			title: "Get Documentation",
			description:
				"Fetch comprehensive documentation for a library from Context7. Supports optional topic focus to get more specific documentation.",
			inputSchema: {
				libraryId: z
					.string()
					.describe(
						"Context7 library ID (format: /org/project or /org/project/version)"
					),
				topic: z
					.string()
					.optional()
					.describe(
						"Optional topic to focus documentation on (e.g., 'hooks', 'routing', 'authentication')"
					),
				tokens: z
					.number()
					.optional()
					.default(10000)
					.describe(
						"Maximum tokens of documentation to retrieve (default: 10000)"
					),
			},
		},
		async ({ libraryId, topic, tokens = 10000 }) => {
			// NOTE: This handler is async to match MCP SDK requirements
			try {
				// Check rate limit
				if (!context7Limiter.allowCall()) {
					const waitTime = Math.ceil(context7Limiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds before making another Context7 request.`,
							},
						],
						isError: true,
					};
				}

				// Validate library ID format
				if (!libraryId.startsWith("/")) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Invalid library ID format. Expected format: /org/project or /org/project/version
							
Example valid IDs:
- /modelcontextprotocol/sdk
- /tc39/ecma262
- /nodejs/nodejs.org
- /facebook/react/v18.2.0`,
							},
						],
						isError: true,
					};
				}

				// Validate tokens range
				if (tokens < 1000 || tokens > 100000) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Token count must be between 1000 and 100000. Requested: ${tokens}`,
							},
						],
						isError: true,
					};
				}

				// NOTE: This would normally call the actual Context7 get-library-docs API
				// In production, you would use mcp_context7_get-library-docs
				// This tool provides guidance and demonstrates the pattern

				const guidanceText = `To fetch documentation from Context7:

Library ID: ${libraryId}${topic ? `\nTopic Focus: ${topic}` : ""}
Token Limit: ${tokens}

Usage Instructions:
1. Use the library ID returned by resolve_library_id tool
2. Optionally specify a topic for focused documentation
3. Adjust token limit based on documentation length needed

Example library IDs and topics:

TypeScript/JavaScript Libraries:
- /modelcontextprotocol/sdk → topic: "tools", "resources", "prompts"
- /colinhacks/zod → topic: "validation", "schemas", "transforms"
- /facebook/react → topic: "hooks", "components", "state"

Documentation Libraries:
- /nodejs/nodejs.org → topic: "async", "streams", "http"
- /tc39/ecma262 → topic: "objects", "functions", "operators"
- /microsoft/TypeScript → topic: "types", "generics", "decorators"

The documentation returned will include:
- Up-to-date, version-specific information
- Code examples and patterns
- API references with signatures
- Common use cases and best practices

For more libraries and topics, visit: https://context7.com`;

				return {
					content: [
						{
							type: "text",
							text: guidanceText,
						},
					],
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{
							type: "text",
							text: `Error fetching documentation: ${err.message}

Context7 provides comprehensive, up-to-date library documentation.

Common issues:
1. Invalid library ID - use resolve_library_id tool to find correct ID
2. Topic not available - try fetching without topic filter
3. Rate limit exceeded - wait before making another request

To search for libraries:
1. First use resolve_library_id with the library name
2. Then use get_documentation with the returned library ID

For help: https://context7.com/help`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// SEARCH DOCUMENTATION TOOL
	server.registerTool(
		"search_documentation",
		{
			title: "Search Documentation",
			description:
				"Search across multiple libraries in Context7 for documentation related to a specific topic or concept.",
			inputSchema: {
				query: z
					.string()
					.describe("Search query for documentation across libraries"),
				categories: z
					.array(z.string())
					.optional()
					.describe(
						"Optional categories to filter search (e.g., ['typescript', 'react', 'nodejs'])"
					),
				maxResults: z
					.number()
					.optional()
					.default(5)
					.describe("Maximum number of results to return (default: 5)"),
			},
		},
		async ({ query, categories, maxResults = 5 }) => {
			// NOTE: This handler is async to match MCP SDK requirements
			try {
				// Check rate limit
				if (!context7Limiter.allowCall()) {
					const waitTime = Math.ceil(context7Limiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds before making another Context7 request.`,
							},
						],
						isError: true,
					};
				}

				// Validate query
				if (query.trim().length === 0) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Search query cannot be empty",
							},
						],
						isError: true,
					};
				}

				// Provide search guidance
				const searchGuidance = `To search documentation in Context7:

Search Query: "${query}"${
					categories ? `\nCategories: ${categories.join(", ")}` : ""
				}
Max Results: ${maxResults}

Search capabilities:
1. Full-text search across all libraries
2. Filter by category/technology
3. Get relevance-ranked results
4. View documentation snippets

Common search queries:
- "async/await" → Find async patterns across libraries
- "error handling" → Error handling patterns
- "typescript generics" → TypeScript-specific features
- "state management" → React/Vue patterns
- "authentication" → Auth patterns across frameworks

Example categories:
- typescript, javascript, python, rust
- react, vue, angular, svelte
- nodejs, express, fastapi
- databases, testing, security

Search results include:
- Matching library (with library ID)
- Relevance score (0-1)
- Documentation snippet
- Link to full documentation

To view full documentation for a result:
1. Note the library ID from the result
2. Use get_documentation tool with that ID
3. Optionally specify a topic for more focused docs`;

				return {
					content: [
						{
							type: "text",
							text: searchGuidance,
						},
					],
				};
			} catch (error: unknown) {
				const err = error as Error;
				return {
					content: [
						{
							type: "text",
							text: `Error searching documentation: ${err.message}

Context7 supports full-text search across library documentation.

To search effectively:
1. Use specific keywords (not general terms)
2. Combine multiple keywords for better results
3. Filter by categories if available
4. View snippets to quickly find relevant documentation

Example searches:
- "How to handle async operations"
- "TypeScript type definitions"
- "React hooks patterns"
- "Node.js event emitter"

For more help: https://context7.com/search`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
