import { describe, it, expect } from "vitest";
import path from "path";
import { registerGitTools } from "../src/tools/gitTools.js";

class MockServer {
  tools: Record<string, any> = {};
  registerTool(name: string, _def: any, handler: any) {
    this.tools[name] = handler;
  }
}

describe("gitTools git_command", () => {
  it("runs git status successfully in repo", async () => {
    const server: any = new MockServer();
    registerGitTools(server);
    const run = server.tools["git_command"];

    const res = await run({ git_args: "status" });
    expect(res.isError).not.toBe(true);
    const text = res.content?.[0]?.text || "";
    expect(text.toLowerCase()).toContain("git command executed successfully".toLowerCase());
  });

  it("rejects invalid working directory (forbidden path)", async () => {
    const server: any = new MockServer();
    registerGitTools(server);
    const run = server.tools["git_command"];

    // Use a clearly forbidden/system path to trigger security validation
    const invalidCwd = process.platform === "win32"
      ? path.resolve(process.cwd().split(path.sep)[0] + path.sep, "Windows", "System32")
      : "/etc";
    const res = await run({ git_args: "status", cwd: invalidCwd });
    expect(res.isError).toBe(true);
    const text = res.content?.[0]?.text || "";
    expect(text).toMatch(/Security Error: Invalid git directory/i);
  });
});
