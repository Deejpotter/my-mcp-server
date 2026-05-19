import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Firefly tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
		process.env.FIREFLY_API_URL = "http://localhost:3600";
		process.env.FIREFLY_API_TOKEN = "test-token";
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerFireflyTools } = await import("../src/tools/fireflyTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerFireflyTools(fakeServer);
		return registered;
	}

	it("registers firefly_list_accounts, firefly_list_transactions, and firefly_get_summary", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["firefly_list_accounts"]).toBe("function");
		expect(typeof handlers["firefly_list_transactions"]).toBe("function");
		expect(typeof handlers["firefly_get_summary"]).toBe("function");
	});

	it("calls handlers with mocked fetch and returns content arrays", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ data: [{ id: 1, amount: 100 }] }),
		});

		const handlers = await getHandlers();
		const accountsRes: any = await handlers["firefly_list_accounts"]?.({});
		const txRes: any = await handlers["firefly_list_transactions"]?.({});
		const summaryRes: any = await handlers["firefly_get_summary"]?.({});

		expect(accountsRes).toBeDefined();
		expect(txRes).toBeDefined();
		expect(summaryRes).toBeDefined();

		expect(Array.isArray(accountsRes?.content)).toBe(true);
		expect(Array.isArray(txRes?.content)).toBe(true);
		expect(Array.isArray(summaryRes?.content)).toBe(true);
	});
});