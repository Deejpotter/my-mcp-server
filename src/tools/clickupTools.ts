/**
 * Created: 02/11/25
 * By: Daniel Potter
 *
 * ClickUp API v2 integration for MCP server.
 * Provides task management functionality including search, retrieval, and updates.
 *
 * Requires environment variable:
 * - CLICKUP_API_TOKEN: Personal or OAuth API token from ClickUp
 *   Get from: https://app.clickup.com/settings/apps
 *
 * References:
 * - ClickUp API Docs: https://developer.clickup.com/
 * - Rate Limits: 100 requests/minute per token
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { genericLimiter } from "../utils/cache.js";

/**
 * ClickUp Task response
 */
interface ClickUpTask {
	id: string;
	name: string;
	description?: string;
	status: {
		status: string;
		type: string;
		color: string;
	};
	priority?: {
		id: string;
		priority: string;
		color: string;
	} | null;
	assignees: Array<{
		id: number;
		username: string;
		email: string;
	}>;
	tags: Array<{
		name: string;
	}>;
	date_created: string;
	date_updated: string;
	due_date?: string | null;
	url: string;
	list: {
		id: string;
		name: string;
	};
}

/**
 * Make authenticated request to ClickUp API
 */
async function clickupRequest(
	endpoint: string,
	method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
	body?: unknown
): Promise<unknown> {
	const apiToken = process.env.CLICKUP_API_TOKEN;

	if (!apiToken) {
		throw new Error(
			"CLICKUP_API_TOKEN environment variable is not set. " +
				"Get your API token from: https://app.clickup.com/settings/apps"
		);
	}

	const url = `https://api.clickup.com/api/v2/${endpoint}`;

	const headers: Record<string, string> = {
		Authorization: apiToken,
		"Content-Type": "application/json",
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
		let errorMessage = `ClickUp API error: ${response.status} ${response.statusText}`;

		try {
			const errorJson = JSON.parse(errorText) as { err?: string; error?: string };
			if (errorJson.err) {
				errorMessage = errorJson.err;
			} else if (errorJson.error) {
				errorMessage = errorJson.error;
			}
		} catch {
			if (errorText) {
				errorMessage += ` - ${errorText}`;
			}
		}

		// Handle rate limit specifically
		if (response.status === 429) {
			const resetHeader = response.headers.get("X-RateLimit-Reset");
			const resetTime = resetHeader
				? new Date(parseInt(resetHeader) * 1000).toLocaleTimeString()
				: "unknown";
			errorMessage = `Rate limit exceeded. Resets at ${resetTime}. Limit: 100 requests/minute.`;
		}

		throw new Error(errorMessage);
	}

	return await response.json();
}

/**
 * Register ClickUp tools with the MCP server
 */
export function registerClickUpTools(server: McpServer) {
	// CLICKUP GET TASK TOOL
	server.registerTool(
		"clickup_get_task",
		{
			title: "ClickUp Get Task",
			description:
				"Retrieve detailed information about a specific ClickUp task by ID. " +
				"Returns task details including name, description, status, priority, assignees, tags, and dates.",
			inputSchema: {
				task_id: z.string().min(1).describe("The ID of the task to retrieve"),
			},
			outputSchema: {
				id: z.string(),
				name: z.string(),
				description: z.string().optional(),
				status: z.object({
					status: z.string(),
					type: z.string(),
					color: z.string(),
				}),
				priority: z
					.object({
						priority: z.string(),
						color: z.string(),
					})
					.optional(),
				assignees: z.array(
					z.object({
						id: z.number(),
						username: z.string(),
						email: z.string(),
					})
				),
				tags: z.array(z.object({ name: z.string() })),
				date_created: z.string(),
				date_updated: z.string(),
				due_date: z.string().optional(),
				url: z.string(),
				list: z.object({
					id: z.string(),
					name: z.string(),
				}),
			},
		},
		async ({ task_id }) => {
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

				// Get task details
				const response = (await clickupRequest(`task/${task_id}`)) as {
					id: string;
					name: string;
					description?: string;
					status: { status: string; type: string; color: string };
					priority?: { id: string; priority: string; color: string } | null;
					assignees: Array<{ id: number; username: string; email: string }>;
					tags: Array<{ name: string }>;
					date_created: string;
					date_updated: string;
					due_date?: string | null;
					url: string;
					list: { id: string; name: string };
				};

				const output = {
					id: response.id,
					name: response.name,
					description: response.description,
					status: response.status,
					priority: response.priority
						? {
								priority: response.priority.priority,
								color: response.priority.color,
							}
						: undefined,
					assignees: response.assignees,
					tags: response.tags,
					date_created: response.date_created,
					date_updated: response.date_updated,
					due_date: response.due_date || undefined,
					url: response.url,
					list: response.list,
				};

				// Format text output
				const assigneesList =
					response.assignees.length > 0
						? response.assignees.map((a) => `  - ${a.username} (${a.email})`).join("\n")
						: "  None";

				const tagsList =
					response.tags.length > 0
						? response.tags.map((t) => `  - ${t.name}`).join("\n")
						: "  None";

				const dueDate = response.due_date
					? `\nDue Date: ${new Date(parseInt(response.due_date)).toLocaleString()}`
					: "";

				const priority = response.priority
					? `\nPriority: ${response.priority.priority}`
					: "\nPriority: None";

				return {
					content: [
						{
							type: "text",
							text: `ClickUp Task: ${response.name}\n\nID: ${response.id}\nStatus: ${response.status.status}${priority}${dueDate}\nList: ${response.list.name}\n\nAssignees:\n${assigneesList}\n\nTags:\n${tagsList}\n\nDescription:\n${response.description || "No description"}\n\nURL: ${response.url}`,
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
							text: `Error retrieving ClickUp task: ${err.message}

Common issues:
1. Check that CLICKUP_API_TOKEN is set correctly
2. Verify the task ID is valid and you have access to it
3. Ensure your API token has the necessary permissions`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// CLICKUP UPDATE TASK TOOL
	server.registerTool(
		"clickup_update_task",
		{
			title: "ClickUp Update Task",
			description:
				"Update an existing ClickUp task. " +
				"Can update name, description, status, priority, due date, and assignees. " +
				"Only provide the fields you want to update.",
			inputSchema: {
				task_id: z.string().min(1).describe("The ID of the task to update"),
				name: z.string().optional().describe("New task name"),
				description: z.string().optional().describe("New task description"),
				status: z.string().optional().describe("New status (e.g., 'to do', 'in progress', 'complete')"),
				priority: z
					.number()
					.optional()
					.describe("Priority level: 1=Urgent, 2=High, 3=Normal, 4=Low, null=No priority"),
				due_date: z
					.number()
					.optional()
					.describe("Due date as Unix timestamp in milliseconds"),
				assignees_add: z
					.array(z.number())
					.optional()
					.describe("Array of user IDs to add as assignees"),
				assignees_rem: z
					.array(z.number())
					.optional()
					.describe("Array of user IDs to remove as assignees"),
			},
			outputSchema: {
				id: z.string(),
				name: z.string(),
				status: z.object({
					status: z.string(),
				}),
				url: z.string(),
			},
		},
		async ({ task_id, name, description, status, priority, due_date, assignees_add, assignees_rem }) => {
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

				// Build update payload
				const updateData: Record<string, unknown> = {};
				if (name) updateData.name = name;
				if (description !== undefined) updateData.description = description;
				if (status) updateData.status = status;
				if (priority !== undefined) updateData.priority = priority;
				if (due_date) updateData.due_date = due_date;

				// Handle assignees
				if (assignees_add || assignees_rem) {
					updateData.assignees = {};
					if (assignees_add) {
						(updateData.assignees as Record<string, unknown>).add = assignees_add;
					}
					if (assignees_rem) {
						(updateData.assignees as Record<string, unknown>).rem = assignees_rem;
					}
				}

				// Update task
				const response = (await clickupRequest(`task/${task_id}`, "PUT", updateData)) as ClickUpTask;

				const output = {
					id: response.id,
					name: response.name,
					status: {
						status: response.status.status,
					},
					url: response.url,
				};

				return {
					content: [
						{
							type: "text",
							text: `✓ Task updated successfully!\n\nTask: ${response.name}\nStatus: ${response.status.status}\nURL: ${response.url}`,
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
							text: `Error updating ClickUp task: ${err.message}

Common issues:
1. Check that CLICKUP_API_TOKEN is set correctly
2. Verify the task ID is valid and you have access to it
3. Ensure status names match exactly (case-sensitive)
4. Check that user IDs for assignees are valid`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// CLICKUP CREATE TASK TOOL
	server.registerTool(
		"clickup_create_task",
		{
			title: "ClickUp Create Task",
			description:
				"Create a new task in a ClickUp list. " +
				"Requires a list ID and task name. Optionally set description, status, priority, assignees, and due date.",
			inputSchema: {
				list_id: z.string().min(1).describe("The ID of the list where the task will be created"),
				name: z.string().min(1).describe("Task name"),
				description: z.string().optional().describe("Task description"),
				status: z.string().optional().describe("Initial status (e.g., 'to do')"),
				priority: z
					.number()
					.optional()
					.describe("Priority: 1=Urgent, 2=High, 3=Normal, 4=Low"),
				due_date: z.number().optional().describe("Due date as Unix timestamp in milliseconds"),
				assignees: z.array(z.number()).optional().describe("Array of user IDs to assign"),
				tags: z.array(z.string()).optional().describe("Array of tag names"),
			},
			outputSchema: {
				id: z.string(),
				name: z.string(),
				status: z.object({
					status: z.string(),
				}),
				url: z.string(),
			},
		},
		async ({ list_id, name, description, status, priority, due_date, assignees, tags }) => {
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

				// Build task payload
				const taskData: Record<string, unknown> = {
					name,
				};

				if (description) taskData.description = description;
				if (status) taskData.status = status;
				if (priority) taskData.priority = priority;
				if (due_date) taskData.due_date = due_date;
				if (assignees && assignees.length > 0) taskData.assignees = assignees;
				if (tags && tags.length > 0) taskData.tags = tags;

				// Create task
				const response = (await clickupRequest(`list/${list_id}/task`, "POST", taskData)) as ClickUpTask;

				const output = {
					id: response.id,
					name: response.name,
					status: {
						status: response.status.status,
					},
					url: response.url,
				};

				return {
					content: [
						{
							type: "text",
							text: `✓ Task created successfully!\n\nTask: ${response.name}\nID: ${response.id}\nStatus: ${response.status.status}\nURL: ${response.url}`,
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
							text: `Error creating ClickUp task: ${err.message}

Common issues:
1. Check that CLICKUP_API_TOKEN is set correctly
2. Verify the list ID is valid and you have access to it
3. Ensure you have permission to create tasks in this list
4. Check that status and priority values are valid`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
