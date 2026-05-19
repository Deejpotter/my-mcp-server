import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Grocy tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerGrocyTools } = await import("../src/tools/grocyTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerGrocyTools(fakeServer);
		return registered;
	}

	it("registers grocy_list_products, grocy_get_stock, and grocy_get_shopping_list", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["grocy_list_products"]).toBe("function");
		expect(typeof handlers["grocy_get_stock"]).toBe("function");
		expect(typeof handlers["grocy_get_shopping_list"]).toBe("function");
	});

	it("calls handlers with mocked fetch and returns content arrays", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ items: [{ id: 1, name: "Item A" }] }),
		});

		const handlers = await getHandlers();
		const productsRes: any = await handlers["grocy_list_products"]?.({});
		const stockRes: any = await handlers["grocy_get_stock"]?.({ product_id: 1 });
		const shopRes: any = await handlers["grocy_get_shopping_list"]?.({});

		expect(productsRes).toBeDefined();
		expect(stockRes).toBeDefined();
		expect(shopRes).toBeDefined();

		expect(Array.isArray(productsRes?.content)).toBe(true);
		expect(Array.isArray(stockRes?.content)).toBe(true);
		expect(Array.isArray(shopRes?.content)).toBe(true);
	});
});