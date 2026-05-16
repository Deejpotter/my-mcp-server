import { describe, it, expect, vi, afterEach } from "vitest";
import { registerExcelTools } from "../src/tools/excelTools.js";

describe("Excel tools", () => {
	afterEach(() => vi.restoreAllMocks());

	function getFakeServer() {
		const tools: string[] = [];
		return {
			registerTool: (name: string, _opts: any, _handler: any) => {
				tools.push(name);
			},
			getTools: () => tools,
		} as any;
	}

	it("registers all excel tools", () => {
		const s = getFakeServer();
		registerExcelTools(s);
		const names = s.getTools();
		expect(names).toContain("excel_workbook_info");
		expect(names).toContain("excel_read_range");
		expect(names).toContain("excel_write_range");
		expect(names).toContain("excel_active_workbook_info");
		expect(names).toContain("excel_active_read_range");
		expect(names).toContain("excel_active_write_range");
		expect(names.length).toBeGreaterThanOrEqual(6);
	});
});
