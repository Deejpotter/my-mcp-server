import { describe, it, expect } from "vitest";
import { registerDuckDuckGoSearchTools } from "../src/tools/duckduckgoSearchTools.js";
import { registerContext7Tools } from "../src/tools/context7Tools.js";
import { registerImageTools } from "../src/tools/imageTools.js";
import { registerMakerImageConverterTools } from "../src/tools/makerImageConverterTools.js";
import { registerExcelTools } from "../src/tools/excelTools.js";
import { registerLocalKnowledgeTools } from "../src/tools/localKnowledgeTools.js";

function makeFakeServer() {
	const tools: string[] = [];
	return {
		registerTool: (name: string) => tools.push(name),
		getTools: () => tools,
	} as any;
}

describe("Tool registration", () => {
	it("registers duckduckgo search tools", () => {
		const s = makeFakeServer();
		registerDuckDuckGoSearchTools(s);
		expect(s.getTools().length).toBeGreaterThan(0);
	});

	it("registers context7 tools", () => {
		const s = makeFakeServer();
		registerContext7Tools(s);
		expect(s.getTools().length).toBeGreaterThan(0);
	});

	it("registers image tools", () => {
		const s = makeFakeServer();
		registerImageTools(s);
		expect(s.getTools()).toContain("image_analyze_color_profile");
		expect(s.getTools()).toContain("image_color_correct");
		expect(s.getTools().length).toBeGreaterThan(0);
	});

	it("registers maker image converter tools", () => {
		const s = makeFakeServer();
		registerMakerImageConverterTools(s);
		expect(s.getTools()).toContain("maker_image_convert");
	});

	it("registers active excel tools", () => {
		const s = makeFakeServer();
		registerExcelTools(s);
		expect(s.getTools()).toContain("excel_workbook_info");
		expect(s.getTools()).toContain("excel_active_workbook_info");
		expect(s.getTools()).toContain("excel_active_read_range");
		expect(s.getTools()).toContain("excel_active_write_range");
	});

	it("registers local knowledge tools", () => {
		const s = makeFakeServer();
		registerLocalKnowledgeTools(s);
		expect(s.getTools()).toContain("local_knowledge_status");
		expect(s.getTools()).toContain("local_knowledge_lookup");
		expect(s.getTools()).toContain("local_knowledge_search");
		expect(s.getTools()).toContain("local_knowledge_rebuild");
		expect(s.getTools()).toContain("local_knowledge_seed");
	});
});
