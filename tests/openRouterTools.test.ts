import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("OpenRouter tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerOpenRouterTools } = await import("../src/tools/openRouterTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerOpenRouterTools(fakeServer);
		return registered;
	}

	it("registers OpenRouter handlers", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["openrouter_list_keys"]).toBe("function");
		expect(typeof handlers["openrouter_get_credits"]).toBe("function");
		expect(typeof handlers["openrouter_list_models"]).toBe("function");
	});

	it("returns no-auth when OPENROUTER_MANAGEMENT_KEY is missing", async () => {
		process.env.OPENROUTER_MANAGEMENT_KEY = "";

		const handlers = await getHandlers();
		const res: any = await handlers["openrouter_list_keys"]();
		expect(res.content[0].text).toContain("OPENROUTER_MANAGEMENT_KEY not set in environment");
	});

	it("calls list_keys and returns JSON text", async () => {
		process.env.OPENROUTER_MANAGEMENT_KEY = "mgmt-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify([{ id: "k1" }]),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["openrouter_list_keys"]();
		expect(res.content[0].text).toContain("k1");
	});

	it("calls get_credits and returns JSON text", async () => {
		process.env.OPENROUTER_MANAGEMENT_KEY = "mgmt-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ credits: 100 }),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["openrouter_get_credits"]();
		expect(res.content[0].text).toContain("100");
	});
});
