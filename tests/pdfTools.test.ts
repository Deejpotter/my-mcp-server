import { describe, it, expect } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { writeFile, mkdir, rm } from "fs/promises";
import { registerPDFTools } from "../src/tools/pdfTools.js";

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
