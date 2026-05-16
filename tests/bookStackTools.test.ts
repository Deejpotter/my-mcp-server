import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("BookStack tools", () => {
	const originalFetch = globalThis.fetch as any;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerBookStackTools } = await import("../src/tools/bookStackTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerBookStackTools(fakeServer);
		return registered;
	}

	it("registers BookStack handlers", async () => {
		const handlers = await getHandlers();
		expect(typeof handlers["bookstack_list_shelves"]).toBe("function");
		expect(typeof handlers["bookstack_list_books"]).toBe("function");
		expect(typeof handlers["bookstack_search"]).toBe("function");
	});

	it("returns no-auth message when BOOKSTACK_TOKEN_ID is missing", async () => {
		process.env.BOOKSTACK_URL = "https://book.test";
		process.env.BOOKSTACK_TOKEN_ID = "";
		process.env.BOOKSTACK_TOKEN_SECRET = "secret-123";

		const handlers = await getHandlers();
		const res: any = await handlers["bookstack_list_shelves"]();
		expect(res.content[0].text).toContain("BOOKSTACK_URL, BOOKSTACK_TOKEN_ID or BOOKSTACK_TOKEN_SECRET not set");
	});

	it("calls list_shelves and returns JSON text", async () => {
		process.env.BOOKSTACK_URL = "https://book.test";
		process.env.BOOKSTACK_TOKEN_ID = "id-123";
		process.env.BOOKSTACK_TOKEN_SECRET = "secret-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify([{ id: 1, name: "Shelf A" }]),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["bookstack_list_shelves"]();
		expect(res.content[0].text).toContain("Shelf A");
	});

	it("calls search and returns JSON text", async () => {
		process.env.BOOKSTACK_URL = "https://book.test";
		process.env.BOOKSTACK_TOKEN_ID = "id-123";
		process.env.BOOKSTACK_TOKEN_SECRET = "secret-123";

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ results: ["match1"] }),
		});

		const handlers = await getHandlers();
		const res: any = await handlers["bookstack_search"]({ query: "test" });
		expect(res.content[0].text).toContain("match1");
	});
});
