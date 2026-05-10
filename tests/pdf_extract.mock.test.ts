import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("pdf-parse-new", () => ({
	default: async () => ({ text: "" }),
}));

import { registerPDFTools } from "../src/tools/pdfTools.js";

describe("PDF extract local error handling", () => {
	const dir = join(tmpdir(), `mcp-pdf-extract-${Date.now()}`);

	beforeEach(async () => {
		await mkdir(dir, { recursive: true });
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("returns helpful error when local text extraction finds no content", async () => {
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};

		registerPDFTools(fakeServer);
		const handler = registered["pdf_extract_receipt"];

		const pdfPath = join(dir, "receipt.pdf");
		await writeFile(pdfPath, "%PDF-1.4\n%EOF", "utf-8");

		const res: any = await handler({ file_path: pdfPath });
		expect(res.isError).toBe(true);
		expect(res.content[0].text).toMatch(/Failed to extract receipt data locally/i);
	});
});
