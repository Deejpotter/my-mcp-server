import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("pdf-parse-new", () => ({
	default: async () => ({
		text: `Sub Total:Sub Total:
Thank you for working with us towards a greener future. Thank you for working with us towards a greener future.  Paper bags: Paper bags:
Collection feeCollection fee
Service feesService fees
Invoice Total:Invoice Total:
Invoice total includes GST of:Invoice total includes GST of:
Paid Amount:Paid Amount:
SuppliedSupplied
LineLine DescriptionDescription OrderedOrdered SuppliedSupplied PricePrice AmountAmount
BakeryBakery
1 Tip top the one wholemeal bread sandwich slice loaf bakery 700g 2 2 $4.70 $9.40
2 * Woolworths pikelets 8 pack 2 2 $2.50 $5.00
DairyDairy
3 Woolworths free from lactose full cream long life milk uht 1l 4 4 $2.10 $8.40
$79.28
$2.00
$0.00
$2.00
$83.28
$1.43
$83.28
Registered Office: Woolworths Group Limited t/a Woolworths Online, 1 Woolworths Way, Bella Vista NSW 2153
Tax Invoice Page 1 of 2
ABN 88 000 014 675
Invoice/Order Number: 304713676
Customer: Daniel Potter
Date: 03 May 2026
Pickup: 1400 - 1500`,
	}),
}));

import { registerPDFTools } from "../src/tools/pdfTools.js";

class MockServer {
	tools: Record<string, any> = {};
	registerTool(name: string, _def: any, handler: any) {
		this.tools[name] = handler;
	}
}

describe("PDF tools", () => {
	const dir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);

	beforeEach(async () => {
		await mkdir(dir, { recursive: true });
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("lists PDF files in a directory", async () => {
		await writeFile(join(dir, "a.pdf"), "%PDF-1.4\n%EOF", "utf-8");
		await mkdir(join(dir, "sub"), { recursive: true });
		await writeFile(join(dir, "sub", "b.pdf"), "%PDF-1.4\n%EOF", "utf-8");

		const server: any = new MockServer();
		registerPDFTools(server);

		const res: any = await server.tools["pdf_list_receipts"]({ directory: dir, recursive: true });
		const parsed = JSON.parse(res.content[0].text);
		expect(parsed.total_files).toBe(2);
	});

	it("extracts receipt data locally without OPENAI_API_KEY", async () => {
		delete process.env.OPENAI_API_KEY;
		const server: any = new MockServer();
		registerPDFTools(server);
		const run = server.tools["pdf_extract_receipt"];

		const pdfPath = join(dir, "receipt.pdf");
		await writeFile(pdfPath, "%PDF-1.3\n%EOF", "utf-8");

		const res = await run({ file_path: pdfPath });
		expect(res.isError).not.toBe(true);
		const payload = JSON.parse(res.content[0].text);
		expect(payload.success).toBe(true);
		expect(payload.parser).toBe("local-text");
		expect(payload.receipt.store_name).toBe("Woolworths");
		expect(payload.receipt.order_number).toBe("304713676");
		expect(payload.receipt.date).toBe("2026-05-03");
		expect(payload.receipt.total).toBe(83.28);
		expect(payload.receipt.subtotal).toBe(79.28);
		expect(payload.receipt.items).toHaveLength(3);
		expect(payload.receipt.items[0]).toMatchObject({
			name: "Tip top the one wholemeal bread sandwich slice loaf bakery 700g",
			quantity: 2,
			unit_price: 4.7,
			total_price: 9.4,
			category: "Bakery",
		});
	});
});
