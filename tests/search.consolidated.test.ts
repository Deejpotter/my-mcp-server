import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Consolidated search tool", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandler() {
		const { registerSearchTools } = await import("../src/tools/searchTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerSearchTools(fakeServer);
		return registered["search"];
	}

	it("registers the 'search' tool", async () => {
		const handler = await getHandler();
		expect(typeof handler).toBe("function");
	});

	it("falls through to DDG with no API keys", async () => {
		process.env.TAVILY_API_KEY = "";
		process.env.SERPER_API_KEY = "";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => "<html></html>",
		});

		const handler = await getHandler();
		const res: any = await handler({ query: "test" });
		expect(res.content[0].text).toContain("duckduckgo");
	});

	it("uses forced serper provider", async () => {
		process.env.SERPER_API_KEY = "serper-test-key";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () =>
				JSON.stringify({
					organic: [{ title: "S", link: "https://s.com", snippet: "s" }],
				}),
		});

		const handler = await getHandler();
		const res: any = await handler({ query: "test", provider: "serper" });
		expect(res.content[0].text).toContain("serper");
	});

	it("uses forced tavily provider", async () => {
		process.env.TAVILY_API_KEY = "tvly-test-key";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () =>
				JSON.stringify({
					results: [{ title: "T", url: "https://t.com", content: "t" }],
				}),
		});

		const handler = await getHandler();
		const res: any = await handler({ query: "test", provider: "tavily" });
		expect(res.content[0].text).toContain("tavily");
	});
});
