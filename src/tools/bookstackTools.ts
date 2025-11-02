/**
 * Created: 02/11/25
 * By: Daniel Potter
 *
 * BookStack REST API integration for MCP server.
 * Provides search and content retrieval from BookStack documentation platforms.
 *
 * Requires environment variables:
 * - BOOKSTACK_URL: Base URL of BookStack instance (e.g., https://docs.example.com)
 * - BOOKSTACK_TOKEN_ID: API token ID from BookStack user profile
 * - BOOKSTACK_TOKEN_SECRET: API token secret from BookStack user profile
 *
 * References:
 * - BookStack API Docs: https://demo.bookstackapp.com/api/docs
 * - Search Documentation: https://www.bookstackapp.com/docs/user/searching/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * BookStack search result item
 */
interface SearchResult {
	id: number;
	name: string;
	slug: string;
	type: "bookshelf" | "book" | "chapter" | "page";
	url: string;
	preview_html?: string;
	created_at: string;
	updated_at: string;
}

/**
 * BookStack page content response
 */
interface PageContent {
	id: number;
	name: string;
	slug: string;
	html: string;
	markdown?: string;
	raw_html: string;
	book_id: number;
	chapter_id?: number;
	created_at: string;
	updated_at: string;
	url: string;
}

/**
 * BookStack book content response
 */
interface BookContent {
	id: number;
	name: string;
	slug: string;
	description: string;
	contents: Array<{
		id: number;
		name: string;
		slug: string;
		type: "page" | "chapter";
	}>;
	created_at: string;
	updated_at: string;
	url: string;
}

/**
 * Make authenticated request to BookStack API
 */
async function bookstackRequest(
	endpoint: string,
	method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
	body?: unknown
): Promise<unknown> {
	const baseUrl = process.env.BOOKSTACK_URL;
	const tokenId = process.env.BOOKSTACK_TOKEN_ID;
	const tokenSecret = process.env.BOOKSTACK_TOKEN_SECRET;

	if (!baseUrl) {
		throw new Error(
			"BOOKSTACK_URL environment variable is not set. Please add your BookStack instance URL."
		);
	}

	if (!tokenId || !tokenSecret) {
		throw new Error(
			"BOOKSTACK_TOKEN_ID or BOOKSTACK_TOKEN_SECRET environment variable is not set. " +
				"Please create an API token in your BookStack user profile."
		);
	}

	// Ensure URL doesn't end with slash for consistent endpoint construction
	const normalizedUrl = baseUrl.replace(/\/$/, "");
	const url = `${normalizedUrl}/api/${endpoint}`;

	const headers: Record<string, string> = {
		Authorization: `Token ${tokenId}:${tokenSecret}`,
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
		let errorMessage = `BookStack API error: ${response.status} ${response.statusText}`;

		try {
			const errorJson = JSON.parse(errorText);
			if (errorJson.error?.message) {
				errorMessage = errorJson.error.message;
			}
		} catch {
			// Error response wasn't JSON, use text
			if (errorText) {
				errorMessage += ` - ${errorText}`;
			}
		}

		throw new Error(errorMessage);
	}

	return await response.json();
}

/**
 * Register BookStack tools with the MCP server
 */
export function registerBookStackTools(server: McpServer) {
	// BOOKSTACK SEARCH TOOL
	server.registerTool(
		"bookstack_search",
		{
			title: "BookStack Search",
			description:
				"Search across BookStack documentation (shelves, books, chapters, pages). " +
				"Supports advanced search syntax including filters, exact matches, and tags. " +
				"Returns results with previews and metadata.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						"Search query. Supports: exact phrases (quotes), filters ([tag_name]), " +
							"exclusions (-term), wildcards (*). See BookStack search docs for full syntax."
					),
				count: z
					.number()
					.optional()
					.default(20)
					.describe(
						"Maximum number of results to return (default: 20, max: 100)"
					),
				page: z
					.number()
					.optional()
					.default(1)
					.describe("Page number for pagination (default: 1)"),
			},
			outputSchema: {
				results: z.array(
					z.object({
						id: z.number(),
						name: z.string(),
						type: z.enum(["bookshelf", "book", "chapter", "page"]),
						url: z.string(),
						preview: z.string().optional(),
						created_at: z.string(),
						updated_at: z.string(),
					})
				),
				total: z.number(),
				query: z.string(),
				page: z.number(),
			},
		},
		async ({ query, count = 20, page = 1 }) => {
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

				// Calculate offset for pagination
				const offset = (page - 1) * count;

				// Make search request
				const data = (await bookstackRequest(
					`search?query=${encodeURIComponent(
						query
					)}&count=${count}&offset=${offset}`
				)) as {
					data: SearchResult[];
					total: number;
				};

				// Format results
				const results = data.data.map((item) => ({
					id: item.id,
					name: item.name,
					type: item.type,
					url: item.url,
					preview: item.preview_html
						? item.preview_html.replace(/<[^>]*>/g, "").substring(0, 200)
						: undefined,
					created_at: item.created_at,
					updated_at: item.updated_at,
				}));

				const output = {
					results,
					total: data.total,
					query,
					page,
				};

				// Format text output
				let formattedResults = "";
				if (results.length > 0) {
					formattedResults = results
						.map((r) => {
							const preview = r.preview ? `\n${r.preview}...` : "";
							return `[${r.type.toUpperCase()}] ${r.name}\nID: ${r.id}\nURL: ${
								r.url
							}${preview}`;
						})
						.join("\n\n");
				} else {
					formattedResults = "No results found. Try a different search query.";
				}

				const pageInfo =
					data.total > count
						? `\n\nShowing results ${offset + 1}-${Math.min(
								offset + count,
								data.total
						  )} of ${data.total}`
						: "";

				return {
					content: [
						{
							type: "text",
							text: `BookStack Search Results for "${query}":\n\n${formattedResults}${pageInfo}`,
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
							text: `Error searching BookStack: ${err.message}

Common issues:
1. Check that BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET are set
2. Ensure your API token has "Access System API" permission
3. Verify the BookStack instance is accessible
4. Check that your search query syntax is valid`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK GET PAGE TOOL
	server.registerTool(
		"bookstack_get_page",
		{
			title: "BookStack Get Page",
			description:
				"Retrieve the full content of a BookStack page by ID. " +
				"Returns both rendered HTML and markdown (if available), plus metadata.",
			inputSchema: {
				page_id: z
					.number()
					.positive()
					.describe("The ID of the page to retrieve"),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				html: z.string(),
				markdown: z.string().optional(),
				book_id: z.number(),
				chapter_id: z.number().optional(),
				url: z.string(),
				created_at: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ page_id }) => {
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

				// Get page content
				const page = (await bookstackRequest(
					`pages/${page_id}`
				)) as PageContent;

				// Strip HTML tags for text preview
				const textContent = page.html.replace(/<[^>]*>/g, "");
				const preview =
					textContent.length > 500
						? textContent.substring(0, 500) + "..."
						: textContent;

				const output = {
					id: page.id,
					name: page.name,
					slug: page.slug,
					html: page.html,
					markdown: page.markdown,
					book_id: page.book_id,
					chapter_id: page.chapter_id,
					url: page.url,
					created_at: page.created_at,
					updated_at: page.updated_at,
				};

				return {
					content: [
						{
							type: "text",
							text: `BookStack Page: ${page.name}\n\nURL: ${page.url}\n\nContent Preview:\n${preview}\n\n[Full content available in structuredContent]`,
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
							text: `Error retrieving BookStack page: ${err.message}

Common issues:
1. Check that the page ID exists and you have permission to view it
2. Verify your API credentials are correct
3. Ensure the page hasn't been deleted or moved to recycle bin`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK GET BOOK TOOL
	server.registerTool(
		"bookstack_get_book",
		{
			title: "BookStack Get Book",
			description:
				"Retrieve a BookStack book's details and table of contents by ID. " +
				"Returns book metadata and a structured list of chapters and pages.",
			inputSchema: {
				book_id: z
					.number()
					.positive()
					.describe("The ID of the book to retrieve"),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				description: z.string(),
				contents: z.array(
					z.object({
						id: z.number(),
						name: z.string(),
						type: z.enum(["page", "chapter"]),
					})
				),
				url: z.string(),
				created_at: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ book_id }) => {
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

				// Get book details
				const book = (await bookstackRequest(
					`books/${book_id}`
				)) as BookContent;

				const output = {
					id: book.id,
					name: book.name,
					slug: book.slug,
					description: book.description,
					contents: book.contents.map((item) => ({
						id: item.id,
						name: item.name,
						type: item.type,
					})),
					url: book.url,
					created_at: book.created_at,
					updated_at: book.updated_at,
				};

				// Format contents list
				const contentsList = book.contents
					.map(
						(item) =>
							`  - [${item.type.toUpperCase()}] ${item.name} (ID: ${item.id})`
					)
					.join("\n");

				return {
					content: [
						{
							type: "text",
							text: `BookStack Book: ${book.name}\n\nURL: ${book.url}\n\nDescription: ${book.description}\n\nTable of Contents:\n${contentsList}\n\nTotal items: ${book.contents.length}`,
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
							text: `Error retrieving BookStack book: ${err.message}

Common issues:
1. Check that the book ID exists and you have permission to view it
2. Verify your API credentials are correct
3. Ensure the book hasn't been deleted or moved to recycle bin`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK CREATE BOOK TOOL
	server.registerTool(
		"bookstack_create_book",
		{
			title: "BookStack Create Book",
			description:
				"Create a new book in the system. Books are top-level containers for organizing " +
				"chapters and pages. Returns the created book with ID and URL.",
			inputSchema: {
				name: z.string().min(1).describe("The name/title of the book (required)"),
				description: z
					.string()
					.optional()
					.describe("Description text for the book"),
				tags: z
					.array(
						z.object({
							name: z.string(),
							value: z.string().optional(),
						})
					)
					.optional()
					.describe(
						"Array of tags to apply to the book. Each tag has a name and optional value."
					),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				description: z.string(),
				url: z.string(),
				created_at: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ name, description, tags }) => {
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

				// Build request body
				const requestBody: Record<string, unknown> = {
					name,
				};

				if (description) {
					requestBody.description = description;
				}

				if (tags) {
					requestBody.tags = tags;
				}

				// Create the book
				const book = (await bookstackRequest(
					"books",
					"POST",
					requestBody
				)) as BookContent;

				const output = {
					id: book.id,
					name: book.name,
					slug: book.slug,
					description: book.description,
					url: book.url,
					created_at: book.created_at,
					updated_at: book.updated_at,
				};

				return {
					content: [
						{
							type: "text",
							text: `Successfully created book: "${book.name}"\n\nID: ${book.id}\nURL: ${book.url}\nSlug: ${book.slug}\n\nYou can now add chapters and pages to this book.`,
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
							text: `Error creating BookStack book: ${err.message}

Common issues:
1. Check that you have permission to create books
2. Ensure the book name is not empty
3. Verify your API credentials are correct`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK CREATE CHAPTER TOOL
	server.registerTool(
		"bookstack_create_chapter",
		{
			title: "BookStack Create Chapter",
			description:
				"Create a new chapter within a book. Chapters are containers for organizing " +
				"pages within a book. Returns the created chapter with ID and URL.",
			inputSchema: {
				name: z.string().min(1).describe("The name/title of the chapter (required)"),
				book_id: z
					.number()
					.positive()
					.describe("The ID of the parent book (required)"),
				description: z
					.string()
					.optional()
					.describe("Description text for the chapter"),
				tags: z
					.array(
						z.object({
							name: z.string(),
							value: z.string().optional(),
						})
					)
					.optional()
					.describe(
						"Array of tags to apply to the chapter. Each tag has a name and optional value."
					),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				book_id: z.number(),
				description: z.string(),
				url: z.string(),
				created_at: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ name, book_id, description, tags }) => {
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

				// Build request body
				const requestBody: Record<string, unknown> = {
					name,
					book_id,
				};

				if (description) {
					requestBody.description = description;
				}

				if (tags) {
					requestBody.tags = tags;
				}

				// Create the chapter
				const chapter = (await bookstackRequest(
					"chapters",
					"POST",
					requestBody
				)) as {
					id: number;
					name: string;
					slug: string;
					book_id: number;
					description: string;
					url: string;
					created_at: string;
					updated_at: string;
				};

				const output = {
					id: chapter.id,
					name: chapter.name,
					slug: chapter.slug,
					book_id: chapter.book_id,
					description: chapter.description,
					url: chapter.url,
					created_at: chapter.created_at,
					updated_at: chapter.updated_at,
				};

				return {
					content: [
						{
							type: "text",
							text: `Successfully created chapter: "${chapter.name}"\n\nID: ${chapter.id}\nURL: ${chapter.url}\nBook ID: ${chapter.book_id}\n\nYou can now add pages to this chapter.`,
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
							text: `Error creating BookStack chapter: ${err.message}

Common issues:
1. Check that the book_id exists and you have permission to add to it
2. Ensure the chapter name is not empty
3. Verify your API credentials are correct`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK CREATE PAGE TOOL
	server.registerTool(
		"bookstack_create_page",
		{
			title: "BookStack Create Page",
			description:
				"Create a new page within a book or chapter. Pages contain the actual content. " +
				"You must provide either book_id (for top-level page) or chapter_id (for page in chapter). " +
				"Content can be provided as HTML or Markdown. Returns the created page with ID and URL.",
			inputSchema: {
				name: z.string().min(1).describe("The name/title of the page (required)"),
				book_id: z
					.number()
					.positive()
					.optional()
					.describe("The ID of the parent book (required if chapter_id not provided)"),
				chapter_id: z
					.number()
					.positive()
					.optional()
					.describe(
						"The ID of the parent chapter (required if book_id not provided)"
					),
				html: z
					.string()
					.optional()
					.describe(
						"HTML content for the page. Use single-block depth HTML. Images via base64 data URIs will be extracted to gallery."
					),
				markdown: z
					.string()
					.optional()
					.describe("Markdown content for the page (alternative to HTML)"),
				tags: z
					.array(
						z.object({
							name: z.string(),
							value: z.string().optional(),
						})
					)
					.optional()
					.describe(
						"Array of tags to apply to the page. Each tag has a name and optional value."
					),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				book_id: z.number(),
				chapter_id: z.number().optional(),
				url: z.string(),
				created_at: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ name, book_id, chapter_id, html, markdown, tags }) => {
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

				// Validate that either book_id or chapter_id is provided
				if (!book_id && !chapter_id) {
					return {
						content: [
							{
								type: "text",
								text: "Error: Either book_id or chapter_id must be provided to create a page.",
							},
						],
						isError: true,
					};
				}

				// Build request body
				const requestBody: Record<string, unknown> = {
					name,
				};

				if (book_id) {
					requestBody.book_id = book_id;
				}

				if (chapter_id) {
					requestBody.chapter_id = chapter_id;
				}

				if (html) {
					requestBody.html = html;
				}

				if (markdown) {
					requestBody.markdown = markdown;
				}

				if (tags) {
					requestBody.tags = tags;
				}

				// Create the page
				const page = (await bookstackRequest(
					"pages",
					"POST",
					requestBody
				)) as PageContent;

				const output = {
					id: page.id,
					name: page.name,
					slug: page.slug,
					book_id: page.book_id,
					chapter_id: page.chapter_id,
					url: page.url,
					created_at: page.created_at,
					updated_at: page.updated_at,
				};

				const location = chapter_id
					? `Chapter ID: ${chapter_id}`
					: `Book ID: ${book_id}`;

				return {
					content: [
						{
							type: "text",
							text: `Successfully created page: "${page.name}"\n\nID: ${page.id}\nURL: ${page.url}\nLocation: ${location}\n\nPage has been created with your content.`,
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
							text: `Error creating BookStack page: ${err.message}

Common issues:
1. Check that the book_id or chapter_id exists and you have permission to add to it
2. Ensure the page name is not empty
3. Provide either HTML or Markdown content
4. Verify your API credentials are correct`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK UPDATE BOOK TOOL
	server.registerTool(
		"bookstack_update_book",
		{
			title: "BookStack Update Book",
			description:
				"Update an existing book's details including name, description, and tags. " +
				"Only provide the fields you want to update. Returns the updated book.",
			inputSchema: {
				book_id: z
					.number()
					.positive()
					.describe("The ID of the book to update (required)"),
				name: z
					.string()
					.min(1)
					.optional()
					.describe("New name/title for the book"),
				description: z
					.string()
					.optional()
					.describe("New description text for the book"),
				tags: z
					.array(
						z.object({
							name: z.string(),
							value: z.string().optional(),
						})
					)
					.optional()
					.describe(
						"New array of tags for the book. Replaces existing tags completely."
					),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				description: z.string(),
				url: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ book_id, name, description, tags }) => {
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

				// Build request body with only provided fields
				const requestBody: Record<string, unknown> = {};

				if (name) {
					requestBody.name = name;
				}

				if (description !== undefined) {
					requestBody.description = description;
				}

				if (tags) {
					requestBody.tags = tags;
				}

				// Update the book
				const book = (await bookstackRequest(
					`books/${book_id}`,
					"PUT",
					requestBody
				)) as BookContent;

				const output = {
					id: book.id,
					name: book.name,
					slug: book.slug,
					description: book.description,
					url: book.url,
					updated_at: book.updated_at,
				};

				return {
					content: [
						{
							type: "text",
							text: `Successfully updated book: "${book.name}"\n\nID: ${book.id}\nURL: ${book.url}\nLast updated: ${book.updated_at}`,
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
							text: `Error updating BookStack book: ${err.message}

Common issues:
1. Check that the book_id exists and you have permission to edit it
2. Ensure at least one field is provided to update
3. Verify your API credentials are correct`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// BOOKSTACK UPDATE PAGE TOOL
	server.registerTool(
		"bookstack_update_page",
		{
			title: "BookStack Update Page",
			description:
				"Update an existing page's content and details. Can update name, HTML/Markdown content, " +
				"and tags. Can also move page to different book or chapter. Only provide fields to update.",
			inputSchema: {
				page_id: z
					.number()
					.positive()
					.describe("The ID of the page to update (required)"),
				name: z
					.string()
					.min(1)
					.optional()
					.describe("New name/title for the page"),
				html: z.string().optional().describe("New HTML content for the page"),
				markdown: z
					.string()
					.optional()
					.describe("New Markdown content for the page"),
				book_id: z
					.number()
					.positive()
					.optional()
					.describe("Move page to this book (changes parent)"),
				chapter_id: z
					.number()
					.positive()
					.optional()
					.describe("Move page to this chapter (changes parent)"),
				tags: z
					.array(
						z.object({
							name: z.string(),
							value: z.string().optional(),
						})
					)
					.optional()
					.describe(
						"New array of tags for the page. Replaces existing tags completely."
					),
			},
			outputSchema: {
				id: z.number(),
				name: z.string(),
				slug: z.string(),
				book_id: z.number(),
				chapter_id: z.number().optional(),
				url: z.string(),
				updated_at: z.string(),
			},
		},
		async ({ page_id, name, html, markdown, book_id, chapter_id, tags }) => {
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

				// Build request body with only provided fields
				const requestBody: Record<string, unknown> = {};

				if (name) {
					requestBody.name = name;
				}

				if (html) {
					requestBody.html = html;
				}

				if (markdown) {
					requestBody.markdown = markdown;
				}

				if (book_id) {
					requestBody.book_id = book_id;
				}

				if (chapter_id) {
					requestBody.chapter_id = chapter_id;
				}

				if (tags) {
					requestBody.tags = tags;
				}

				// Update the page
				const page = (await bookstackRequest(
					`pages/${page_id}`,
					"PUT",
					requestBody
				)) as PageContent;

				const output = {
					id: page.id,
					name: page.name,
					slug: page.slug,
					book_id: page.book_id,
					chapter_id: page.chapter_id,
					url: page.url,
					updated_at: page.updated_at,
				};

				const location = page.chapter_id
					? `Chapter ID: ${page.chapter_id}`
					: `Book ID: ${page.book_id}`;

				return {
					content: [
						{
							type: "text",
							text: `Successfully updated page: "${page.name}"\n\nID: ${page.id}\nURL: ${page.url}\nLocation: ${location}\nLast updated: ${page.updated_at}`,
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
							text: `Error updating BookStack page: ${err.message}

Common issues:
1. Check that the page_id exists and you have permission to edit it
2. Ensure at least one field is provided to update
3. If moving to different book/chapter, verify those IDs exist
4. Verify your API credentials are correct`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
