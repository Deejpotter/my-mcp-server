/**
 * vikunjaTasks.ts - Vikunja task management MCP tools
 *
 * Exposes Vikunja REST API as MCP tools so any connected agent
 * (VS Code Copilot, Cursor, LM Studio, OpenClaw) can read and
 * manage tasks without needing direct HTTP access.
 *
 * Env vars (loaded from .env):
 *   VIKUNJA_API_URL   - base URL, e.g. http://localhost:3456
 *   VIKUNJA_API_TOKEN - Bearer token (tk_...)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || "http://localhost:3456";
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN || "";

function authHeaders(): Record<string, string> {
	return {
		Authorization: `Bearer ${VIKUNJA_TOKEN}`,
		"Content-Type": "application/json",
	};
}

async function vkFetch(method: string, path: string, body?: unknown): Promise<unknown> {
	const url = `${VIKUNJA_URL}/api/v1${path}`;
	const res = await fetch(url, {
		method,
		headers: authHeaders(),
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	const data = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const msg = data?.message || `HTTP ${res.status}`;
		throw new Error(`Vikunja API error: ${msg}`);
	}
	return data;
}

export function registerVikunjaTaskTools(server: McpServer): void {
	// --- List projects ---
	server.registerTool(
		"vikunja_get_projects",
		{
			title: "List Vikunja Projects",
			description: "List all task projects in Vikunja. Returns id, title, and description for each.",
			inputSchema: {},
		},
		async () => {
			if (!VIKUNJA_TOKEN) {
				return { content: [{ type: "text" as const, text: "VIKUNJA_API_TOKEN not set in environment." }] };
			}
			const projects = await vkFetch("GET", "/projects") as Array<{
				id: number;
				title: string;
				description: string;
			}>;
			const lines = projects.map((p) => `#${p.id}: ${p.title}${p.description ? ` — ${p.description}` : ""}`);
			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		}
	);

	// --- List tasks ---
	server.registerTool(
		"vikunja_get_tasks",
		{
			title: "Get Vikunja Tasks",
			description:
				"List tasks from Vikunja. Optionally filter by project ID or include completed tasks. Returns task id, title, project, and done status.",
			inputSchema: {
				project_id: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Filter to a specific project by ID. Omit for all tasks."),
				include_done: z
					.boolean()
					.optional()
					.default(false)
					.describe("Include completed tasks (default: false, open only)"),
				filter: z
					.string()
					.optional()
					.describe("Optional text filter — only return tasks whose title contains this string"),
			},
		},
		async ({ project_id, include_done = false, filter }) => {
			if (!VIKUNJA_TOKEN) {
				return { content: [{ type: "text" as const, text: "VIKUNJA_API_TOKEN not set in environment." }] };
			}
			let tasks: Array<{ id: number; title: string; done: boolean; project_id: number; due_date?: string }>;
			if (project_id) {
				tasks = await vkFetch("GET", `/projects/${project_id}/tasks`) as typeof tasks;
			} else {
				tasks = await vkFetch("GET", "/tasks") as typeof tasks;
			}
			if (!include_done) tasks = tasks.filter((t) => !t.done);
			if (filter) tasks = tasks.filter((t) => t.title.toLowerCase().includes(filter.toLowerCase()));

			if (tasks.length === 0) return { content: [{ type: "text" as const, text: "No tasks found." }] };
			const lines = tasks.map(
				(t) =>
					`#${t.id} [project:${t.project_id}] ${t.done ? "✅" : "☐"} ${t.title}${t.due_date ? ` (due: ${t.due_date.slice(0, 10)})` : ""}`
			);
			return { content: [{ type: "text" as const, text: lines.join("\n") }] };
		}
	);

	// --- Add task ---
	server.registerTool(
		"vikunja_add_task",
		{
			title: "Add Vikunja Task",
			description:
				"Create a new task in Vikunja. Requires a project_id (use vikunja_get_projects to find the right one).",
			inputSchema: {
				title: z.string().min(1).describe("Task title"),
				project_id: z
					.number()
					.int()
					.positive()
					.describe("Project to add the task to. Use vikunja_get_projects to find IDs."),
				description: z.string().optional().describe("Optional longer description"),
				due_date: z
					.string()
					.optional()
					.describe("Optional due date in ISO format, e.g. 2026-05-01T00:00:00Z"),
			},
		},
		async ({ title, project_id, description, due_date }) => {
			if (!VIKUNJA_TOKEN) {
				return { content: [{ type: "text" as const, text: "VIKUNJA_API_TOKEN not set in environment." }] };
			}
			const body: Record<string, unknown> = { title };
			if (description) body.description = description;
			if (due_date) body.due_date = due_date;
			const task = await vkFetch("PUT", `/projects/${project_id}/tasks`, body) as {
				id: number;
				title: string;
				project_id: number;
			};
			return {
				content: [
					{
						type: "text" as const,
						text: `Task created: #${task.id} "${task.title}" in project #${task.project_id}`,
					},
				],
			};
		}
	);

	// --- Complete task ---
	server.registerTool(
		"vikunja_complete_task",
		{
			title: "Complete Vikunja Task",
			description: "Mark a task as done by its ID.",
			inputSchema: {
				task_id: z.number().int().positive().describe("The numeric task ID to mark as complete"),
			},
		},
		async ({ task_id }) => {
			if (!VIKUNJA_TOKEN) {
				return { content: [{ type: "text" as const, text: "VIKUNJA_API_TOKEN not set in environment." }] };
			}
			const task = await vkFetch("POST", `/tasks/${task_id}`, { done: true }) as {
				id: number;
				title: string;
				done: boolean;
			};
			return {
				content: [
					{
						type: "text" as const,
						text: `Task #${task.id} "${task.title}" marked as ${task.done ? "done ✅" : "not done"}`,
					},
				],
			};
		}
	);

	// --- Update task ---
	server.registerTool(
		"vikunja_update_task",
		{
			title: "Update Vikunja Task",
			description: "Update a task's title, description, or due date by ID.",
			inputSchema: {
				task_id: z.number().int().positive().describe("The numeric task ID to update"),
				title: z.string().optional().describe("New title (omit to keep current)"),
				description: z.string().optional().describe("New description (omit to keep current)"),
				due_date: z.string().optional().describe("New due date in ISO format, or empty string to clear"),
			},
		},
		async ({ task_id, title, description, due_date }) => {
			if (!VIKUNJA_TOKEN) {
				return { content: [{ type: "text" as const, text: "VIKUNJA_API_TOKEN not set in environment." }] };
			}
			const body: Record<string, unknown> = {};
			if (title) body.title = title;
			if (description !== undefined) body.description = description;
			if (due_date !== undefined) body.due_date = due_date;
			const task = await vkFetch("POST", `/tasks/${task_id}`, body) as {
				id: number;
				title: string;
			};
			return {
				content: [{ type: "text" as const, text: `Task #${task.id} updated: "${task.title}"` }],
			};
		}
	);
}
