import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Vault tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function makeFakeServerAndRegister() {
		const { registerVaultTools } = await import("../src/tools/vaultTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerVaultTools(fakeServer);
		return registered;
	}

	it("registers vault_get_folders and vault_search_items", async () => {
		const registered = await makeFakeServerAndRegister();
		expect(typeof registered["vault_get_folders"]).toBe("function");
		expect(typeof registered["vault_search_items"]).toBe("function");
	});

	it("vault_health returns a no-auth message when env vars are missing", async () => {
		// Ensure modules are reloaded with env vars unset
		process.env.VAULT_ADDR = "";
		process.env.VAULT_TOKEN = "";

		const registered = await makeFakeServerAndRegister();
		const healthHandler = registered["vault_health"];
		const res: any = await healthHandler({});

		expect(Array.isArray(res.content)).toBe(true);
		const text = (res.content[0] && res.content[0].text) || "";
		expect(String(text).toLowerCase()).toContain("auth");
	});
});
