import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Coolify tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function makeFakeServerAndRegister() {
		const { registerCoolifyTools } = await import("../src/tools/coolifyTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerCoolifyTools(fakeServer);
		return registered;
	}

	it("registers coolify_get_servers and coolify_health_check", async () => {
		const registered = await makeFakeServerAndRegister();
		expect(typeof registered["coolify_get_servers"]).toBe("function");
		expect(typeof registered["coolify_health_check"]).toBe("function");
	});

	it("coolify_get_servers and coolify_health_check return content", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ servers: [{ name: "s1" }] }),
			text: async () => JSON.stringify({ servers: [{ name: "s1" }] }),
		});

		const registered = await makeFakeServerAndRegister();
		const serversHandler = registered["coolify_get_servers"];
		const healthHandler = registered["coolify_health_check"];

		const serversRes: any = await serversHandler({});
		const healthRes: any = await healthHandler({});

		expect(Array.isArray(serversRes.content)).toBe(true);
		expect(Array.isArray(healthRes.content)).toBe(true);
	});
});
