import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeStructuredError } from "../utils/errors.js";

const DEFAULT_IMAGE_BASE_URL = process.env.LOCAL_IMAGE_SERVER_URL || "http://127.0.0.1:8189";
const DEFAULT_TTS_BASE_URL = process.env.LOCAL_TTS_SERVER_URL || "http://127.0.0.1:8190";
const DEFAULT_VIDEO_BASE_URL = process.env.LOCAL_VIDEO_SERVER_URL || "http://127.0.0.1:8191";

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
	const response = await fetch(url, init);
	const text = await response.text();
	let data: unknown = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = { raw: text };
	}

	if (!response.ok) {
		const message =
			typeof data === "object" && data && "detail" in data
				? String((data as { detail?: unknown }).detail)
				: `HTTP ${response.status}`;
		throw new Error(message);
	}

	if (typeof data === "object" && data !== null && !Array.isArray(data)) {
		return data as Record<string, unknown>;
	}

	return { value: data };
}

export function registerLocalMediaTools(server: McpServer): void {
	server.registerTool(
		"local_image_generate",
		{
			title: "Generate Image via Local my-image-server",
			description:
				"Generate an image using the local FastAPI image server backed by ComfyUI/FLUX.",
			inputSchema: {
				prompt: z.string().min(3).describe("Prompt for image generation"),
				width: z.number().int().min(64).max(4096).optional().default(1024),
				height: z.number().int().min(64).max(4096).optional().default(1024),
				steps: z.number().int().min(1).max(100).optional().default(4),
				seed: z.number().int().nonnegative().optional(),
				return_base64: z.boolean().optional().default(false),
				server_url: z.string().url().optional().describe("Override image server base URL"),
			},
		},
		async ({ prompt, width = 1024, height = 1024, steps = 4, seed, return_base64 = false, server_url }) => {
			const baseUrl = server_url || DEFAULT_IMAGE_BASE_URL;
			try {
				const payload: Record<string, unknown> = {
					prompt,
					width,
					height,
					steps,
					return_base64,
				};
				if (seed !== undefined) payload.seed = seed;

				const data = await fetchJson(`${baseUrl}/generate`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
				});

				return {
					content: [
						{
							type: "text",
							text: `✅ Local image generation complete via ${baseUrl}`,
						},
					],
					structuredContent: data,
				};
			} catch (err) {
				const se = makeStructuredError(err, "local_image_generate_failed", false);
				return {
					content: [
						{
							type: "text",
							text: `❌ Local image generation failed: ${se.message}`,
						},
					],
					structuredContent: { error: se, serverUrl: baseUrl },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"local_tts_generate",
		{
			title: "Generate Speech via Local my-tts-server",
			description:
				"Generate WAV audio using the local FastAPI TTS server backed by Kokoro.",
			inputSchema: {
				text: z.string().min(1).describe("Text to synthesize"),
				voice: z.string().optional().default("af_heart"),
				speed: z.number().min(0.25).max(4).optional().default(1),
				server_url: z.string().url().optional().describe("Override TTS server base URL"),
			},
		},
		async ({ text, voice = "af_heart", speed = 1, server_url }) => {
			const baseUrl = server_url || DEFAULT_TTS_BASE_URL;
			try {
				const response = await fetch(`${baseUrl}/tts`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text, voice, speed }),
				});

				if (!response.ok) {
					const detail = await response.text();
					throw new Error(detail || `HTTP ${response.status}`);
				}

				const arrayBuffer = await response.arrayBuffer();
				const base64 = Buffer.from(arrayBuffer).toString("base64");
				return {
					content: [
						{
							type: "text",
							text: `✅ Local TTS generation complete via ${baseUrl}`,
						},
					],
					structuredContent: {
						serverUrl: baseUrl,
						voice,
						speed,
						mimeType: "audio/wav",
						base64,
						bytes: arrayBuffer.byteLength,
					},
				};
			} catch (err) {
				const se = makeStructuredError(err, "local_tts_generate_failed", false);
				return {
					content: [
						{
							type: "text",
							text: `❌ Local TTS generation failed: ${se.message}`,
						},
					],
					structuredContent: { error: se, serverUrl: baseUrl },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"local_video_generate",
		{
			title: "Generate Video via Local my-video-server",
			description:
				"Request video generation from the local FastAPI video server. This depends on local Wan/ComfyUI setup.",
			inputSchema: {
				prompt: z.string().min(3).describe("Prompt for video generation"),
				width: z.number().int().min(64).max(4096).optional().default(832),
				height: z.number().int().min(64).max(4096).optional().default(480),
				frames: z.number().int().min(1).max(256).optional().default(49),
				fps: z.number().int().min(1).max(60).optional().default(16),
				server_url: z.string().url().optional().describe("Override video server base URL"),
			},
		},
		async ({ prompt, width = 832, height = 480, frames = 49, fps = 16, server_url }) => {
			const baseUrl = server_url || DEFAULT_VIDEO_BASE_URL;
			try {
				const data = await fetchJson(`${baseUrl}/generate`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ prompt, width, height, frames, fps }),
				});
				return {
					content: [
						{
							type: "text",
							text: `✅ Local video request completed via ${baseUrl}`,
						},
					],
					structuredContent: data,
				};
			} catch (err) {
				const se = makeStructuredError(err, "local_video_generate_failed", false);
				return {
					content: [
						{
							type: "text",
							text: `❌ Local video generation failed: ${se.message}`,
						},
					],
					structuredContent: { error: se, serverUrl: baseUrl },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"local_media_health",
		{
			title: "Check Local Media Service Health",
			description: "Check health/status of local image, TTS, and video services.",
			inputSchema: {
				image_server_url: z.string().url().optional(),
				tts_server_url: z.string().url().optional(),
				video_server_url: z.string().url().optional(),
			},
		},
		async ({ image_server_url, tts_server_url, video_server_url }) => {
			const imageUrl = image_server_url || DEFAULT_IMAGE_BASE_URL;
			const ttsUrl = tts_server_url || DEFAULT_TTS_BASE_URL;
			const videoUrl = video_server_url || DEFAULT_VIDEO_BASE_URL;

			const check = async (name: string, baseUrl: string) => {
				try {
					const data = await fetchJson(`${baseUrl}/health`);
					return { name, ok: true, baseUrl, data };
				} catch (err) {
					const se = makeStructuredError(err, `${name}_health_failed`, false);
					return { name, ok: false, baseUrl, error: se };
				}
			};

			const results = await Promise.all([
				check("image", imageUrl),
				check("tts", ttsUrl),
				check("video", videoUrl),
			]);

			const summary = results
				.map((r) => `${r.name}: ${r.ok ? "ok" : "down"} (${r.baseUrl})`)
				.join("\n");

			return {
				content: [{ type: "text", text: summary }],
				structuredContent: { services: results },
			};
		}
	);
}
