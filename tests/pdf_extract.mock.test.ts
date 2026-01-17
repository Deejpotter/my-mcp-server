import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock 'openai' and 'pdf-parse-new' before importing the module under test
vi.mock("openai", () => {
  class MockOpenAI {
    constructor(options: any) {}
    chat = {
      completions: {
        create: async (opts: any) => {
          // Return a JSON object string as the model response
          const fakeJson = JSON.stringify({
            store_name: "Test Store",
            date: "2025-11-01",
            items: [],
            subtotal: 0,
            total: 0,
          });

          return {
            choices: [
              {
                message: {
                  content: fakeJson,
                },
              },
            ],
          };
        },
      },
    };
  }

  return { default: MockOpenAI };
});

vi.mock("pdf-parse-new", () => {
  return {
    default: async (buffer: Buffer) => ({ text: "Dummy receipt text" }),
  };
});

import { registerPDFTools } from "../src/tools/pdfTools.js";

describe("PDF extract (mocked OpenAI)", () => {
  const dir = join(tmpdir(), `mcp-pdf-extract-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  it("calls OpenAI mock and returns structured receipt", async () => {
    // Ensure handler sees an API key
    process.env.OPENAI_API_KEY = "test-key";

    const pdfPath = join(dir, "receipt.pdf");
    await writeFile(pdfPath, "%PDF-1.4\n%EOF", "utf-8");

    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerPDFTools(fakeServer);

    const handler = registered["pdf_extract_receipt"];
    expect(typeof handler).toBe("function");

    const res: any = await handler({ file_path: pdfPath });

    expect(res).toBeDefined();
    expect(res.content).toBeDefined();
    const text = res.content[0].text;
    expect(text).toContain("receipt");
  });
});
