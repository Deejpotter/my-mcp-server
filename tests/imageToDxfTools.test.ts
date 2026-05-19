import { describe, it, expect, vi, afterEach } from "vitest";
import { registerImageToDxfTools } from "../src/tools/imageToDxfTools.js";

describe("Image to DXF tools", () => {
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

	it("registers trace_image_to_dxf tool", () => {
		const s = getFakeServer();
		registerImageToDxfTools(s);
		expect(s.getTools()).toContain("trace_image_to_dxf");
	});

	it("registers with correct number of tools", () => {
		const s = getFakeServer();
		registerImageToDxfTools(s);
		expect(s.getTools().length).toBeGreaterThan(0);
	});
});
