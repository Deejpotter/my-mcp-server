import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock sharp — returns fixed channel stats (warm orange source, neutral-silver ref)
vi.mock("sharp", () => {
	const fs = require("fs/promises");
	const factory = (_input: any) => {
		const api: any = {
			webp: (_opts: any) => api,
			png: (_opts: any) => api,
			jpeg: (_opts: any) => api,
			avif: (_opts: any) => api,
			gif: () => api,
			tiff: (_opts: any) => api,
			withMetadata: () => api,
			flatten: (_opts: any) => api,
			linear: (_a: any, _b: any) => api,
			toBuffer: async () => Buffer.from([1, 2, 3]),
			toFile: async (out: string) => {
				await fs.writeFile(out, Buffer.from([1, 2, 3]));
			},
			resize: (_opts: any) => api,
			stats: async () => ({
				channels: [
					{ mean: 175, stdev: 32 }, // R - warm orange-ish
					{ mean: 145, stdev: 28 }, // G
					{ mean: 95, stdev: 22 },  // B - low blue = orange cast
				],
				isOpaque: true,
				entropy: 7.5,
				sharpness: 0.5,
				dominant: { r: 175, g: 145, b: 95 },
			}),
		};
		return api;
	};
	return { default: factory };
});

import {
	imageAnalyzeColorProfileTool,
	imageColorCorrectTool,
} from "../src/tools/imageTools.js";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let dir: string;
let refDir: string;
let srcDir: string;
let profilePath: string;

beforeEach(async () => {
	dir = join(tmpdir(), `mcp-color-${Date.now()}`);
	refDir = join(dir, "reference");
	srcDir = join(dir, "source");
	await mkdir(refDir, { recursive: true });
	await mkdir(srcDir, { recursive: true });

	// Fake image files
	await writeFile(join(refDir, "ref1.jpg"), Buffer.from([255, 216, 255]));
	await writeFile(join(refDir, "ref2.jpg"), Buffer.from([255, 216, 255]));
	await writeFile(join(srcDir, "bracket1.jpg"), Buffer.from([255, 216, 255]));
	await writeFile(join(srcDir, "bracket2.jpg"), Buffer.from([255, 216, 255]));

	profilePath = join(dir, "color-profile.json");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// image_analyze_color_profile
// ---------------------------------------------------------------------------

describe("imageAnalyzeColorProfileTool", () => {
	it("analyzes reference directory and saves a profile JSON", async () => {
		const res: any = await imageAnalyzeColorProfileTool.handler({
			reference: refDir,
			profile_path: profilePath,
		});

		expect(res.content[0].text).toContain("Color profile saved");
		expect(res.content[0].text).toContain("Reference images analyzed: 2");
		expect(res.structuredContent.profilePath).toBe(profilePath);

		// Profile JSON should exist on disk and have r/g/b entries
		const raw = await readFile(profilePath, "utf8");
		const profile = JSON.parse(raw);
		expect(profile.r).toHaveProperty("mean");
		expect(profile.g).toHaveProperty("stdev");
		expect(profile.version).toBe(1);
		expect(profile.imageCount).toBe(2);
	});

	it("uses default profile path next to reference directory", async () => {
		const res: any = await imageAnalyzeColorProfileTool.handler({
			reference: refDir,
		});

		expect(res.structuredContent.profilePath).toContain("color-profile.json");
		expect(res.isError).toBeUndefined();
	});

	it("returns error when reference directory is empty", async () => {
		const emptyRef = join(dir, "empty");
		await mkdir(emptyRef, { recursive: true });

		const res: any = await imageAnalyzeColorProfileTool.handler({
			reference: emptyRef,
		});

		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("No image files found");
	});
});

// ---------------------------------------------------------------------------
// image_color_correct
// ---------------------------------------------------------------------------

describe("imageColorCorrectTool", () => {
	// Build a real profile file before each correction test
	beforeEach(async () => {
		await imageAnalyzeColorProfileTool.handler({
			reference: refDir,
			profile_path: profilePath,
		});
	});

	it("corrects a directory of source images using a saved profile", async () => {
		const res: any = await imageColorCorrectTool.handler({
			source: srcDir,
			profile_path: profilePath,
			output_dir: join(dir, "corrected"),
		});

		expect(res.content[0].text).toContain("Color correction complete");
		expect(res.content[0].text).toContain("Corrected: 2 images");
		expect(res.structuredContent.results).toHaveLength(2);
	});

	it("respects strength parameter", async () => {
		const res: any = await imageColorCorrectTool.handler({
			source: srcDir,
			profile_path: profilePath,
			output_dir: join(dir, "corrected-50"),
			strength: 0.5,
		});

		expect(res.content[0].text).toContain("Strength: 50%");
		expect(res.content[0].text).toContain("Color correction complete");
	});

	it("corrects a single source file", async () => {
		const res: any = await imageColorCorrectTool.handler({
			source: join(srcDir, "bracket1.jpg"),
			profile_path: profilePath,
			output_dir: join(dir, "corrected-single"),
		});

		expect(res.content[0].text).toContain("Corrected: 1 image");
	});

	it("includes profilePath and outputDir in structuredContent", async () => {
		const res: any = await imageColorCorrectTool.handler({
			source: srcDir,
			profile_path: profilePath,
			output_dir: join(dir, "corrected-struct"),
		});

		expect(res.structuredContent.profilePath).toBe(profilePath);
		expect(res.structuredContent.outputDir).toContain("corrected-struct");
	});

	it("returns error when profile file does not exist", async () => {
		const res: any = await imageColorCorrectTool.handler({
			source: srcDir,
			profile_path: join(dir, "nonexistent-profile.json"),
		});

		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("Could not load color profile");
	});

	it("returns error when source directory contains no images", async () => {
		const emptySrc = join(dir, "empty-src");
		await mkdir(emptySrc, { recursive: true });

		const res: any = await imageColorCorrectTool.handler({
			source: emptySrc,
			profile_path: profilePath,
		});

		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("No image files found");
	});
});
