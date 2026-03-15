import { describe, it, expect } from "vitest";
import { registerDuckDuckGoSearchTools } from "../src/tools/duckduckgoSearchTools.js";
import { registerContext7Tools } from "../src/tools/context7Tools.js";
import { registerImageTools } from "../src/tools/imageTools.js";

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
		expect(s.getTools().length).toBeGreaterThan(0);
	});
});
