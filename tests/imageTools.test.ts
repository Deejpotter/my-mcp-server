import { describe, it, expect } from "vitest";
import { imageConvertTool } from "../src/tools/imageTools.js";

// These tests validate input schema defaults and enums without calling external services

describe("imageTools input schema validation", () => {
  it("imageConvertTool accepts minimal args and validates enums", () => {
    const parsed = (imageConvertTool as any).inputSchema.parse({
      input: "/tmp/sample",
      output_format: "webp",
    });
    expect(parsed.output_format).toBe("webp");
    // Optional fields may be undefined if not provided
    expect(parsed.quality === undefined || typeof parsed.quality === "number").toBe(true);
    expect(
      parsed.preserve_structure === undefined || typeof parsed.preserve_structure === "boolean"
    ).toBe(true);
  });

  it("imageConvertTool supports expected formats", () => {
    const formats = ["webp", "png", "jpeg", "jpg", "avif", "gif", "tiff"];
    for (const f of formats) {
      const parsed = (imageConvertTool as any).inputSchema.parse({
        input: "/tmp/sample",
        output_format: f,
      });
      expect(parsed.output_format).toBe(f);
    }
  });
});
