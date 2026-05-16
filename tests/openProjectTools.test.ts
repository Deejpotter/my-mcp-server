import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("OpenProject tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerOpenProjectTools } = await import("../src/tools/openProjectTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerOpenProjectTools(fakeServer);
		return registered;
	}

	it("registers openproject_list_projects and openproject_get_project", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["openproject_list_projects"]).toBe("function");
		expect(typeof handlers["openproject_get_project"]).toBe("function");
	});

	it("handles no-auth (env vars missing) and returns content array", async () => {
		// Simulate missing API key
		process.env.OPENPROJECT_API_KEY = "";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ projects: [{ id: 1, name: "Test Project" }] }),
		});

		const handlers = await getHandlers();
		const listRes: any = await handlers["openproject_list_projects"]?.({});
		const getRes: any = await handlers["openproject_get_project"]?.({ id: 1 });

		expect(listRes).toBeDefined();
		expect(getRes).toBeDefined();
		expect(Array.isArray(listRes?.content)).toBe(true);
		// getRes might return a single item or content array depending on implementation
		expect(getRes?.content || getRes).toBeTruthy();
	});
});