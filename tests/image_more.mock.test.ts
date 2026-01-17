import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock sharp similar to previous tests
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

import { imageResizeTool, imageOptimizeTool } from "../src/tools/imageTools.js";

describe("ImageTools additional flows (resize & optimize)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `mcp-image-more-${Date.now()}`);
    await mkdir(dir, { recursive: true });

    // create sample image files
    await writeFile(join(dir, "a.jpg"), Buffer.from([255, 216, 255]));
    await writeFile(join(dir, "b.png"), Buffer.from([137, 80, 78, 71]));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("resizes images in a directory using preset", async () => {
    const res: any = await imageResizeTool.handler({
      input: dir,
      preset: "thumbnail",
      maintain_aspect_ratio: true,
    } as any);

    expect(res).toBeDefined();
    expect(res.content[0].text).toContain("Image resizing complete");
  });

  it("optimizes images in a directory", async () => {
    const res: any = await imageOptimizeTool.handler({
      input: dir,
      quality: 80,
    } as any);

    expect(res).toBeDefined();
    expect(res.content[0].text).toContain("Image optimization complete");
  });
});
