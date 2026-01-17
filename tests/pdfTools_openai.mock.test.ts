import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("PDF Tools with mocked OpenAI", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `mcp-pdf-openai-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "receipt.pdf"), "%PDF-1.4\n%EOF", "utf-8");
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(async () => {
    delete process.env.OPENAI_API_KEY;
    await rm(dir, { recursive: true, force: true });
  });

  it("extracts receipt using mocked OpenAI", async () => {
    // Mock pdf-parse-new and openai dynamically to avoid global hoisting issues
    vi.doMock("pdf-parse-new", () => ({
      default: async (_buf: Buffer) => ({ text: "Item A 1 x 5.00\nTotal 5.00\nDate: 2025-01-01" }),
    }));

    vi.doMock("openai", () => ({
      default: class OpenAI {
        constructor(_opts: any) {}
        chat = {
          completions: {
            create: async (_: any) => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      store_name: "Test Store",
                      date: "2025-01-01",
                      items: [
                        { name: "Item A", quantity: 1, unit_price: 5.0, total_price: 5.0 },
                      ],
                      subtotal: 5.0,
                      total: 5.0,
                    }),
                  },
                },
              ],
            }),
          },
        };
      },
    }));

    const { registerPDFTools } = await import("../src/tools/pdfTools.js");

    const registered: Record<string, Function> = {};
    const fakeServer: any = { registerTool: (name: string, _opts: any, handler: Function) => { registered[name] = handler; } };

    registerPDFTools(fakeServer);

    const handler = registered["pdf_extract_receipt"];
    expect(typeof handler).toBe("function");

    const res: any = await handler({ file_path: join(dir, "receipt.pdf") });

    expect(res).toHaveProperty("content");
    const text = res.content[0].text;
    expect(text).toContain("success");
    expect(text).toContain("Test Store");
  });
});
