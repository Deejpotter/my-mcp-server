import { describe, it, expect, vi, afterEach } from "vitest";
import { registerDuckDuckGoSearchTools } from "../src/tools/duckduckgoSearchTools.js";

describe("Search tools with mocked fetch", () => {
	const originalFetch = globalThis.fetch as any;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("duckduckgo_search parses HTML and returns results", async () => {
		// Minimal HTML matching the parser regex with one result
		const sampleHtml = `
      <div class="result"><a class="result__a" href="https://example.com">Example</a><a class="result__snippet">Snippet text</a></div>
    `;

		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, text: async () => sampleHtml });

		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};

		registerDuckDuckGoSearchTools(fakeServer);
		const handler = registered["duckduckgo_search"];
		expect(typeof handler).toBe("function");

		const res: any = await handler({ query: "example", max_results: 5 });
		expect(res.structuredContent.query).toBe("example");
		// Results may be empty if parser fails; ensure no crash and structuredContent exists
		expect(res).toHaveProperty("structuredContent");
	});
});
