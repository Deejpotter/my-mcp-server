import { describe, it, expect } from "vitest";
import { makeStructuredError } from "../src/utils/errors.js";

describe("Structured Errors", () => {
  it("formats Error objects correctly", () => {
    const err = new Error("something went wrong");
    const out = makeStructuredError(err);

    expect(out).toHaveProperty("error_code", "internal_error");
    expect(out).toHaveProperty("message", "something went wrong");
    expect(out).toHaveProperty("retryable", false);
    expect(typeof out.timestamp).toBe("string");
  });

  it("handles non-Error values", () => {
    const out = makeStructuredError("plain string", "bad_input", true);

    expect(out.error_code).toBe("bad_input");
    expect(out.message).toBe("plain string");
    expect(out.retryable).toBe(true);
    expect(new Date(out.timestamp).toString()).not.toBe("Invalid Date");
  });
});
