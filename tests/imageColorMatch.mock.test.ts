import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Mock sharp with stat support for color matching
vi.mock("sharp", () => {
  const fs = require("fs/promises");
  const factory = (_input: any) => {
    const api: any = {
      webp: (_opts: any) => api,
      png: (_opts: any) => api,
      jpeg: (_opts: any) => api,
      avif: (_opts: any) => api,
      gif: () => api,
      tiff: (_opts: any) => api,
      withMetadata: () => api,
      flatten: (_opts: any) => api,
      linear: (_a: any, _b: any) => api,
      toBuffer: async () => Buffer.from([1, 2, 3]),
      toFile: async (out: string) => {
        await fs.writeFile(out, Buffer.from([1, 2, 3]));
      },
      resize: (_opts: any) => api,
      stats: async () => ({
        channels: [
          { mean: 180, stdev: 30 }, // R - warm orange-ish source
          { mean: 150, stdev: 25 }, // G
          { mean: 100, stdev: 20 }, // B
        ],
        isOpaque: true,
        entropy: 7.5,
        sharpness: 0.5,
        dominant: { r: 180, g: 150, b: 100 },
      }),
    };
    return api;
  };
  return { default: factory };
});

import { imageColorMatchTool } from "../src/tools/imageTools.js";

describe("imageColorMatchTool", () => {
  let dir: string;
  let srcDir: string;
  let refDir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `mcp-color-match-${Date.now()}`);
    srcDir = join(dir, "source");
    refDir = join(dir, "reference");
    await mkdir(srcDir, { recursive: true });
    await mkdir(refDir, { recursive: true });

    // Create sample image files
    await writeFile(join(srcDir, "bracket1.jpg"), Buffer.from([255, 216, 255]));
    await writeFile(join(srcDir, "bracket2.jpg"), Buffer.from([255, 216, 255]));
    await writeFile(join(refDir, "ref1.jpg"), Buffer.from([255, 216, 255]));
    await writeFile(join(refDir, "ref2.jpg"), Buffer.from([255, 216, 255]));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("color-matches source directory to reference directory", async () => {
    const res: any = await imageColorMatchTool.handler({
      source: srcDir,
      reference: refDir,
      output_dir: join(dir, "output"),
      strength: 1.0,
      quality: 90,
    });

    expect(res).toBeDefined();
    expect(res.content[0].text).toContain("Color matching complete");
    expect(res.content[0].text).toContain("Processed: 2 images");
    expect(res.content[0].text).toContain("Reference images sampled: 2");
  });

  it("applies reduced strength blend", async () => {
    const res: any = await imageColorMatchTool.handler({
      source: srcDir,
      reference: refDir,
      output_dir: join(dir, "output-50"),
      strength: 0.5,
    });

    expect(res.content[0].text).toContain("Strength: 50%");
    expect(res.content[0].text).toContain("Color matching complete");
  });

  it("processes a single source file against a reference directory", async () => {
    const singleFile = join(srcDir, "bracket1.jpg");
    const res: any = await imageColorMatchTool.handler({
      source: singleFile,
      reference: refDir,
      output_dir: join(dir, "output-single"),
    });

    expect(res.content[0].text).toContain("Color matching complete");
    expect(res.content[0].text).toContain("Processed: 1 image");
  });

  it("returns error when reference directory contains no images", async () => {
    const emptyRef = join(dir, "empty-ref");
    await mkdir(emptyRef, { recursive: true });

    const res: any = await imageColorMatchTool.handler({
      source: srcDir,
      reference: emptyRef,
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("No image files found in reference path");
  });

  it("includes structuredContent with referenceStats and outputDir", async () => {
    const res: any = await imageColorMatchTool.handler({
      source: srcDir,
      reference: refDir,
      output_dir: join(dir, "output-struct"),
    });

    expect(res.structuredContent).toBeDefined();
    expect(res.structuredContent.referenceStats).toBeDefined();
    expect(res.structuredContent.referenceStats.r).toHaveProperty("mean");
    expect(res.structuredContent.referenceStats.r).toHaveProperty("stdev");
    expect(res.structuredContent.outputDir).toContain("output-struct");
  });

  it("preserves original format when preserve_format is true", async () => {
    const res: any = await imageColorMatchTool.handler({
      source: srcDir,
      reference: refDir,
      output_dir: join(dir, "output-pf"),
      preserve_format: true,
    });

    expect(res.content[0].text).toContain("Color matching complete");
    // Output files should keep .jpg extension
    const outputFiles: string[] = res.structuredContent.results;
    for (const f of outputFiles) {
      expect(f).toMatch(/\.jpg$/i);
    }
  });
});
