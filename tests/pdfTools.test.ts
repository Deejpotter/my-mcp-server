import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerPDFTools } from "../src/tools/pdfTools.js";
import { writeFile, mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

class MockServer {
  tools: Record<string, any> = {};
  registerTool(name: string, _def: any, handler: any) {
    this.tools[name] = handler;
  }
}

describe("PDF Tools - list receipts", () => {
  it("lists PDF files in a directory", async () => {
    const dir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });

    // create some dummy pdf files
    const files = ["a.pdf", "b.pdf", "sub/c.pdf"];
    await mkdir(join(dir, "sub"), { recursive: true });

    for (const f of files) {
      await writeFile(join(dir, f), "%PDF-1.4\n%EOF", "utf-8");
    }

    // Fake server that captures registered tools
    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerPDFTools(fakeServer);

    const handler = registered["pdf_list_receipts"];
    expect(typeof handler).toBe("function");

    const res: any = await handler({ directory: dir, recursive: true });

    // Should return content with JSON text
    const text = res.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.total_files).toBe(3);

    // Cleanup
    await rm(dir, { recursive: true, force: true });
  });
});

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
