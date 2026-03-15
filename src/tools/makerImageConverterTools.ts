import { execFile, type ExecFileOptions } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validatePath } from "../utils/security.js";

const execFileAsync = promisify(execFile);
const DEFAULT_CONVERTER_ROOT = "C:\\Users\\Deej\\Repos\\maker-image-converter";
const CLI_RELATIVE_PATH = path.join("bin", "convert.js");

const makerImageCommandSchema = z.enum([
	"convert",
	"overlay",
	"diagonal",
	"full",
]);

export interface MakerImageConvertInput {
	command?: "convert" | "overlay" | "diagonal" | "full";
	input_folder: string;
	converter_root?: string | undefined;
	watermark_path?: string | undefined;
	watermark_opacity?: number | undefined;
	dims_keyword?: string | undefined;
	dims_folder?: string | undefined;
	timeout?: number | undefined;
}

type CliRunner = (
	executable: string,
	args: string[],
	options: ExecFileOptions
) => Promise<{ stdout: string; stderr: string }>;

type ExecFailure = Error & {
	code?: number | string;
	stdout?: string | Buffer;
	stderr?: string | Buffer;
};

const defaultCliRunner: CliRunner = async (executable, args, options) => {
	const result = (await execFileAsync(executable, args, {
		...options,
		encoding: "utf8",
	})) as { stdout: string | Buffer; stderr: string | Buffer };

	return {
		stdout: String(result.stdout ?? "").trim(),
		stderr: String(result.stderr ?? "").trim(),
	};
};

function resolveConverterRoot(override?: string): string {
	return path.resolve(
		override ?? process.env.MAKER_IMAGE_CONVERTER_ROOT ?? DEFAULT_CONVERTER_ROOT
	);
}

function truncate(text: string, maxChars = 2500): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n... (truncated)`;
}

function validateInputPath(
	filePath: string,
	operation: "read" | "write" | "list"
) {
	const validation = validatePath(filePath, operation);
	if (!validation.valid) {
		return `Security validation failed for path '${filePath}': ${validation.checks.join(
			", "
		)}`;
	}
	return undefined;
}

async function assertPathType(
	filePath: string,
	expected: "file" | "directory"
): Promise<string | undefined> {
	try {
		const details = await stat(filePath);
		if (expected === "file" && !details.isFile()) {
			return `Expected a file but found another type: ${filePath}`;
		}
		if (expected === "directory" && !details.isDirectory()) {
			return `Expected a directory but found another type: ${filePath}`;
		}
		return undefined;
	} catch {
		return `Path not found: ${filePath}`;
	}
}

export function buildMakerImageCliArgs(input: {
	cliPath: string;
	command: "convert" | "overlay" | "diagonal" | "full";
	inputFolder: string;
	watermarkPath?: string | undefined;
	watermarkOpacity?: number | undefined;
	dimsKeyword?: string | undefined;
	dimsFolder?: string | undefined;
}): string[] {
	const args: string[] = [input.cliPath, input.command, input.inputFolder];

	if (input.watermarkPath) {
		args.push("--watermark", input.watermarkPath);
	}
	if (typeof input.watermarkOpacity === "number") {
		args.push("--watermark-opacity", String(input.watermarkOpacity));
	}
	if (input.dimsKeyword) {
		args.push("--dims-keyword", input.dimsKeyword);
	}
	if (input.dimsFolder) {
		args.push("--dims-folder", input.dimsFolder);
	}

	return args;
}

export function createMakerImageConvertHandler(
	runner: CliRunner = defaultCliRunner
) {
	return async ({
		command = "full",
		input_folder,
		converter_root,
		watermark_path,
		watermark_opacity = 0.2,
		dims_keyword = "-dims",
		dims_folder,
		timeout = 300000,
	}: MakerImageConvertInput) => {
		const selectedCommand = command;
		const resolvedInputFolder = path.resolve(input_folder);
		const resolvedConverterRoot = resolveConverterRoot(converter_root);
		const resolvedCliPath = path.join(resolvedConverterRoot, CLI_RELATIVE_PATH);
		const resolvedWatermarkPath = watermark_path
			? path.resolve(watermark_path)
			: undefined;
		const resolvedDimsFolder = dims_folder
			? path.resolve(dims_folder)
			: undefined;
		const outputFolder = path.join(path.dirname(resolvedInputFolder), "webp");

		const pathChecks: string[] = [];
		pathChecks.push(
			validateInputPath(resolvedInputFolder, "list") ?? "",
			validateInputPath(resolvedConverterRoot, "read") ?? "",
			validateInputPath(resolvedCliPath, "read") ?? ""
		);
		if (resolvedWatermarkPath) {
			pathChecks.push(validateInputPath(resolvedWatermarkPath, "read") ?? "");
		}
		if (resolvedDimsFolder) {
			pathChecks.push(validateInputPath(resolvedDimsFolder, "list") ?? "");
		}
		const securityFailures = pathChecks.filter(Boolean);
		if (securityFailures.length > 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: `🔒 Security Error:\n${securityFailures.join("\n")}`,
					},
				],
				isError: true,
			};
		}

		const inputPathIssue = await assertPathType(
			resolvedInputFolder,
			"directory"
		);
		if (inputPathIssue) {
			return {
				content: [{ type: "text" as const, text: `❌ ${inputPathIssue}` }],
				isError: true,
			};
		}

		const converterRootIssue = await assertPathType(
			resolvedConverterRoot,
			"directory"
		);
		if (converterRootIssue) {
			return {
				content: [
					{
						type: "text" as const,
						text: `❌ Converter root issue: ${converterRootIssue}`,
					},
				],
				isError: true,
			};
		}

		const cliPathIssue = await assertPathType(resolvedCliPath, "file");
		if (cliPathIssue) {
			return {
				content: [
					{
						type: "text" as const,
						text: `❌ CLI script issue: ${cliPathIssue}`,
					},
				],
				isError: true,
			};
		}

		if (resolvedWatermarkPath) {
			const watermarkIssue = await assertPathType(
				resolvedWatermarkPath,
				"file"
			);
			if (watermarkIssue) {
				return {
					content: [
						{
							type: "text" as const,
							text: `❌ Watermark path issue: ${watermarkIssue}`,
						},
					],
					isError: true,
				};
			}
		}

		if (resolvedDimsFolder) {
			const dimsIssue = await assertPathType(resolvedDimsFolder, "directory");
			if (dimsIssue) {
				return {
					content: [
						{
							type: "text" as const,
							text: `❌ Dims folder issue: ${dimsIssue}`,
						},
					],
					isError: true,
				};
			}
		}

		const cliArgs = buildMakerImageCliArgs({
			cliPath: resolvedCliPath,
			command: selectedCommand,
			inputFolder: resolvedInputFolder,
			watermarkPath: resolvedWatermarkPath,
			watermarkOpacity: watermark_opacity,
			dimsKeyword: dims_keyword,
			dimsFolder: resolvedDimsFolder,
		});

		try {
			const { stdout, stderr } = await runner("node", cliArgs, {
				cwd: resolvedConverterRoot,
				timeout,
				maxBuffer: 10 * 1024 * 1024,
				windowsHide: true,
				shell: false,
			});

			const output = {
				success: true,
				command: selectedCommand,
				converter_root: resolvedConverterRoot,
				input_folder: resolvedInputFolder,
				output_folder: outputFolder,
				exitCode: 0,
				stdout,
				stderr,
			};

			return {
				content: [
					{
						type: "text" as const,
						text: `✅ Maker Image Converter completed successfully.

Mode: ${selectedCommand}
Input: ${resolvedInputFolder}
Output: ${outputFolder}
Converter root: ${resolvedConverterRoot}

Stdout:
${truncate(stdout || "(empty)")}

Stderr:
${truncate(stderr || "(empty)")}`,
					},
				],
				structuredContent: output,
			};
		} catch (error: unknown) {
			const err = error as ExecFailure;
			const stdout = String(err.stdout ?? "").trim();
			const stderr = String(err.stderr ?? err.message ?? "").trim();
			const exitCode = typeof err.code === "number" ? err.code : 1;

			const output = {
				success: false,
				command: selectedCommand,
				converter_root: resolvedConverterRoot,
				input_folder: resolvedInputFolder,
				output_folder: outputFolder,
				exitCode,
				stdout,
				stderr,
			};

			return {
				content: [
					{
						type: "text" as const,
						text: `❌ Maker Image Converter failed (exit code ${exitCode}).

Mode: ${selectedCommand}
Input: ${resolvedInputFolder}
Converter root: ${resolvedConverterRoot}

Stderr:
${truncate(stderr || "(empty)")}

Stdout:
${truncate(stdout || "(empty)")}`,
					},
				],
				structuredContent: output,
				isError: true,
			};
		}
	};
}

/**
 * Register maker-image-converter integration tools with the MCP server.
 *
 * This preserves the standalone desktop app while exposing the same conversion
 * modes to AI agents via MCP.
 */
export function registerMakerImageConverterTools(server: McpServer): void {
	server.registerTool(
		"maker_image_convert",
		{
			title: "Maker Image Convert",
			description:
				"Run maker-image-converter CLI modes (convert, overlay, diagonal, full) for batch image processing.",
			inputSchema: {
				command: makerImageCommandSchema
					.optional()
					.default("full")
					.describe("Conversion mode: convert, overlay, diagonal, or full"),
				input_folder: z
					.string()
					.describe("Absolute path to the input folder of images"),
				converter_root: z
					.string()
					.optional()
					.describe(
						"Optional path to maker-image-converter repo (default: MAKER_IMAGE_CONVERTER_ROOT env or user default path)"
					),
				watermark_path: z
					.string()
					.optional()
					.describe("Optional absolute path to watermark image"),
				watermark_opacity: z
					.number()
					.min(0)
					.max(1)
					.optional()
					.default(0.2)
					.describe("Watermark opacity from 0.0 to 1.0 (default: 0.2)"),
				dims_keyword: z
					.string()
					.optional()
					.default("-dims")
					.describe(
						"Keyword to classify diagonal watermark files (default: -dims)"
					),
				dims_folder: z
					.string()
					.optional()
					.describe("Optional absolute path to dimensions folder"),
				timeout: z
					.number()
					.optional()
					.default(300000)
					.describe("Timeout in milliseconds (default: 300000)"),
			},
			outputSchema: {
				success: z.boolean(),
				command: makerImageCommandSchema,
				converter_root: z.string(),
				input_folder: z.string(),
				output_folder: z.string(),
				exitCode: z.number(),
				stdout: z.string(),
				stderr: z.string(),
			},
		},
		createMakerImageConvertHandler()
	);

	console.error("✅ Maker image converter tool registered");
}
