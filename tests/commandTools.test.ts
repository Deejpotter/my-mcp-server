import { describe, it, expect } from "vitest";
import { registerCommandTools } from "../src/tools/commandTools.js";

// Minimal mock MCP server to capture tool registrations
class MockServer {
  tools: Record<string, any> = {};
  registerTool(name: string, _def: any, handler: any) {
    this.tools[name] = handler;
  }
}

describe("commandTools run_command", () => {
  it("rejects disallowed command", async () => {
    const server: any = new MockServer();
    registerCommandTools(server);
    const run = server.tools["run_command"];

    const res = await run({ command: "rm -rf /" });
    expect(res.isError).toBe(true);
    const text = res.content?.[0]?.text || "";
    expect(text).toMatch(/Security Error/i);
  });

  it("accepts allowed command and executes", async () => {
    const server: any = new MockServer();
    registerCommandTools(server);
    const run = server.tools["run_command"];

    const res = await run({ command: "echo hello" });
    expect(res.isError).not.toBe(true);
    const text = res.content?.[0]?.text || "";
    expect(text.toLowerCase()).toContain("hello");
  });
});
