import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock Hugging Face InferenceClient before importing handlers
vi.mock("@huggingface/inference", () => {
  return {
    InferenceClient: class {
      token: string;
      constructor(token: string) {
        this.token = token;
      }
      async textToImage(_opts: any, _cfg: any) {
        return {
          arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer, // PNG header bytes
        };
      }
    },
  };
});

// Mock sharp to avoid native dependency work
vi.mock("sharp", () => {
  const fs = require("fs/promises");
  const factory = (input: any) => {
    const api: any = {
      webp: (_opts: any) => api,
      png: (_opts: any) => api,
      jpeg: (_opts: any) => api,
      avif: (_opts: any) => api,
      gif: () => api,
      tiff: (_opts: any) => api,
      withMetadata: () => api,
      toBuffer: async () => Buffer.from([1, 2, 3]),
      toFile: async (out: string) => {
        await fs.writeFile(out, Buffer.from([1, 2, 3]));
      },
      resize: (_opts: any) => api,
    };
    return api;
  };
  return { default: factory };
});

import { imageGenerateTool, imageConvertTool } from "../src/tools/imageTools.js";

describe("Image Tools (mocked HF + sharp)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `mcp-image-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    process.env.HUGGING_FACE_API_KEY = "hf-test";
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("generates an image using mocked HF client", async () => {
    const out = join(dir, "out.png");

    const res: any = await imageGenerateTool.handler({
      prompt: "A test image",
      output_path: out,
      size: "512x512",
      model: "flux-schnell",
    } as any);

    expect(res).toBeDefined();
    const s = await stat(out);
    expect(s.size).toBeGreaterThan(0);
  });

  it("converts single image using mocked sharp", async () => {
    const input = join(dir, "in.png");
    await writeFile(input, Buffer.from([137, 80, 78, 71]));

    const res: any = await imageConvertTool.handler({
      input,
      output_format: "webp",
      quality: 80,
    } as any);

    expect(res).toBeDefined();
    expect(res.content[0].text).toContain("Image conversion complete");
  });
});
