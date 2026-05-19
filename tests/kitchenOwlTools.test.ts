import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("KitchenOwl tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerKitchenOwlTools } = await import("../src/tools/kitchenOwlTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerKitchenOwlTools(fakeServer);
		return registered;
	}

	it("registers the KitchenOwl handlers", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["kitchenowl_get_meal_plan"]).toBe("function");
		expect(typeof handlers["kitchenowl_list_recipes"]).toBe("function");
		expect(typeof handlers["kitchenowl_get_shopping_list"]).toBe("function");
	});

	it("calls meal plan and returns JSON text", async () => {
		process.env.KITCHENOWL_API_URL = "https://kitchen.test";
		process.env.KITCHENOWL_API_TOKEN = "token-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ meal: "dinner", items: ["eggs"] }),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["kitchenowl_get_meal_plan"]();
		expect(res.content[0].text).toContain("dinner");
	});

	it("calls list_recipes with limit and returns JSON text", async () => {
		process.env.KITCHENOWL_API_URL = "https://kitchen.test";
		process.env.KITCHENOWL_API_TOKEN = "token-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify([{ id: 1, name: "R1" }, { id: 2, name: "R2" }]),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["kitchenowl_list_recipes"]({ limit: 2 });
		expect(res.content[0].text).toContain("R1");
	});

	it("calls shopping list and returns JSON text", async () => {
		process.env.KITCHENOWL_API_URL = "https://kitchen.test";
		process.env.KITCHENOWL_API_TOKEN = "token-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ items: ["milk", "bread"] }),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["kitchenowl_get_shopping_list"]();
		expect(res.content[0].text).toContain("milk");
	});
});
