import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("PDF tools local parser smoke test", () => {
	let dir: string;

	beforeEach(async () => {
		dir = join(tmpdir(), `mcp-pdf-local-${Date.now()}`);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "receipt.pdf"), "%PDF-1.4\n%EOF", "utf-8");
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("extracts a simple local receipt payload with mocked PDF text", async () => {
		vi.doMock("pdf-parse-new", () => ({
			default: async () => ({
				text: `BakeryBakery\n1 Test bread loaf 1 1 $3.50 $3.50\n$3.50\n$0.00\n$0.00\n$0.00\n$3.50\n$0.32\n$3.50\nRegistered Office: Woolworths Group Limited\nInvoice/Order Number: 999999999\nDate: 10 May 2026`,
			}),
		}));

		const { registerPDFTools } = await import("../src/tools/pdfTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};

		registerPDFTools(fakeServer);
		const handler = registered["pdf_extract_receipt"];
		const res: any = await handler({ file_path: join(dir, "receipt.pdf") });
		const payload = JSON.parse(res.content[0].text);

		expect(payload.success).toBe(true);
		expect(payload.receipt.order_number).toBe("999999999");
		expect(payload.receipt.total).toBe(3.5);
		expect(payload.receipt.items[0].category).toBe("Bakery");
	});
});
