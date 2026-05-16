import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

describe("Mail tools", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function getHandlers() {
		const { registerMailTools } = await import("../src/tools/mailTools.js");
		const registered: Record<string, Function> = {};
		const fakeServer: any = {
			registerTool: (name: string, _opts: any, handler: Function) => {
				registered[name] = handler;
			},
		};
		registerMailTools(fakeServer);
		return registered;
	}

	it("registers mail_search and mail_recent tools", async () => {
		const registered = await getHandlers();
		expect(typeof registered["mail_search"]).toBe("function");
		expect(typeof registered["mail_recent"]).toBe("function");
	});

	it(
		"returns mailbox-not-found when mbox file missing",
		async () => {
			process.env.MAIL_MBOX_PATH = "Z:\\does-not-exist\\INBOX";
			const registered = await getHandlers();
			const handler = registered["mail_search"];
			const res: any = await handler({ query: "test" });
			expect(res.content[0].text).toContain("Mailbox not found");
		},
		10000,
	);
});
