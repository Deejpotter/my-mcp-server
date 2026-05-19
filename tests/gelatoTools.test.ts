import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Gelato tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function makeFakeServerAndRegister() {
		const { registerGelatoTools } = await import("../src/tools/gelatoTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerGelatoTools(fakeServer);
		return registered;
	}

	it("registers gelato_get_products, gelato_get_product, gelato_get_shipping_estimate", async () => {
		const registered = await makeFakeServerAndRegister();
		expect(typeof registered["gelato_get_products"]).toBe("function");
		expect(typeof registered["gelato_get_product"]).toBe("function");
		expect(typeof registered["gelato_get_shipping_estimate"]).toBe("function");
	});

	it("tools return content when fetch is mocked", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ products: [{ id: "p1" }] }),
			text: async () => JSON.stringify({ products: [{ id: "p1" }] }),
		});

		const registered = await makeFakeServerAndRegister();
		const productsHandler = registered["gelato_get_products"];
		const productHandler = registered["gelato_get_product"];
		const shippingHandler = registered["gelato_get_shipping_estimate"];

		const productsRes: any = await productsHandler({});
		const productRes: any = await productHandler({ product_id: "p1" });
		const shippingRes: any = await shippingHandler({ product_id: "p1", country: "AU" });

		expect(Array.isArray(productsRes.content)).toBe(true);
		expect(Array.isArray(productRes.content)).toBe(true);
		expect(Array.isArray(shippingRes.content)).toBe(true);
	});
});
