import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerPDFTools } from "../src/tools/pdfTools.js";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

class MockServer {
  tools: Record<string, any> = {};
  registerTool(name: string, _def: any, handler: any) {
    this.tools[name] = handler;
  }
}

describe("pdfTools guard when OPENAI_API_KEY missing", () => {
  let originalKey: string | undefined;
  let tempDir: string;

  beforeAll(async () => {
    originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    tempDir = await mkdtemp(join(tmpdir(), "mcp-pdf-test-"));
  });

  afterAll(async () => {
    if (originalKey !== undefined) {
      process.env.OPENAI_API_KEY = originalKey;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns helpful error if key not set", async () => {
    const server: any = new MockServer();
    registerPDFTools(server);
    const run = server.tools["pdf_extract_receipt"];

    const pdfPath = join(tempDir, "test.pdf");
    await writeFile(pdfPath, "%PDF-1.3\n%\u00e2\u00e3\u00cf\u00d3\n");

    const res = await run({ file_path: pdfPath });
    expect(res.isError).toBe(true);
    const text = res.content?.[0]?.text || "";
    expect(text).toMatch(/OPENAI_API_KEY.*not set/i);
  });
});
