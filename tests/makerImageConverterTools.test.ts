import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	buildMakerImageCliArgs,
	createMakerImageConvertHandler,
} from "../src/tools/makerImageConverterTools.js";

const tempDirs: string[] = [];

async function setupConverterFixture() {
	const root = await mkdtemp(join(tmpdir(), "mcp-maker-image-"));
	tempDirs.push(root);

	const converterRoot = join(root, "maker-image-converter");
	const inputFolder = join(root, "input");
	const dimsFolder = join(root, "dimensions");
	const watermarkPath = join(root, "watermark.png");
	const cliPath = join(converterRoot, "bin", "convert.js");

	await mkdir(join(converterRoot, "bin"), { recursive: true });
	await mkdir(inputFolder, { recursive: true });
	await mkdir(dimsFolder, { recursive: true });
	await writeFile(cliPath, "#!/usr/bin/env node\nconsole.log('ok');\n", "utf8");
	await writeFile(watermarkPath, "fake-image", "utf8");

	return {
		root,
		converterRoot,
		inputFolder,
		dimsFolder,
		watermarkPath,
		cliPath,
	};
}

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			await rm(dir, { recursive: true, force: true });
		}
	}
});

describe("makerImageConverterTools", () => {
	it("buildMakerImageCliArgs maps options correctly", () => {
		const args = buildMakerImageCliArgs({
			cliPath: "/tmp/maker/bin/convert.js",
			command: "full",
			inputFolder: "/tmp/input",
			watermarkPath: "/tmp/watermark.png",
			watermarkOpacity: 0.35,
			dimsKeyword: "-dims",
			dimsFolder: "/tmp/dimensions",
		});

		expect(args).toEqual([
			"/tmp/maker/bin/convert.js",
			"full",
			"/tmp/input",
			"--watermark",
			"/tmp/watermark.png",
			"--watermark-opacity",
			"0.35",
			"--dims-keyword",
			"-dims",
			"--dims-folder",
			"/tmp/dimensions",
		]);
	});

	it("runs the converter CLI with mapped args", async () => {
		const fixture = await setupConverterFixture();
		const calls: Array<{
			executable: string;
			args: string[];
			cwd?: string;
			timeout?: number;
		}> = [];

		const handler = createMakerImageConvertHandler(
			async (executable, args, options) => {
				calls.push({
					executable,
					args,
					cwd: options.cwd,
					timeout: options.timeout,
				});
				return { stdout: "done", stderr: "" };
			}
		);

		const result: any = await handler({
			command: "full",
			input_folder: fixture.inputFolder,
			converter_root: fixture.converterRoot,
			watermark_path: fixture.watermarkPath,
			dims_folder: fixture.dimsFolder,
			dims_keyword: "-dims",
			watermark_opacity: 0.22,
			timeout: 120000,
		});

		expect(result.isError).not.toBe(true);
		expect(result.structuredContent.success).toBe(true);
		expect(result.structuredContent.command).toBe("full");
		expect(result.structuredContent.converter_root).toBe(fixture.converterRoot);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.executable).toBe("node");
		expect(calls[0]?.args).toContain(fixture.cliPath);
		expect(calls[0]?.args).toContain("--watermark-opacity");
		expect(calls[0]?.cwd).toBe(fixture.converterRoot);
		expect(calls[0]?.timeout).toBe(120000);
	});

	it("returns structured error when CLI runner fails", async () => {
		const fixture = await setupConverterFixture();
		const handler = createMakerImageConvertHandler(async () => {
			const error = new Error("process failed") as Error & {
				code?: number;
				stdout?: string;
				stderr?: string;
			};
			error.code = 3;
			error.stdout = "partial output";
			error.stderr = "bad things happened";
			throw error;
		});

		const result: any = await handler({
			command: "overlay",
			input_folder: fixture.inputFolder,
			converter_root: fixture.converterRoot,
		});

		expect(result.isError).toBe(true);
		expect(result.structuredContent.success).toBe(false);
		expect(result.structuredContent.exitCode).toBe(3);
		expect(result.structuredContent.stderr).toContain("bad things happened");
	});

	it("blocks forbidden paths by security validation", async () => {
		const fixture = await setupConverterFixture();
		const handler = createMakerImageConvertHandler(async () => ({
			stdout: "ok",
			stderr: "",
		}));

		const result: any = await handler({
			command: "convert",
			input_folder: join(fixture.root, ".git"),
			converter_root: fixture.converterRoot,
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("Security Error");
	});
});
