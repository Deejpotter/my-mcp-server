import { describe, it, expect, beforeEach } from "vitest";
import {
  trackToolExecution,
  getToolMetrics,
  resetMetrics,
  formatMetrics,
  measureTime,
} from "../src/utils/performance.js";

describe("Performance Metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("tracks executions and computes metrics", () => {
    trackToolExecution("toolA", 50, true);
    trackToolExecution("toolA", 150, false);

    const m = getToolMetrics("toolA");
    expect(m).not.toBeNull();
    expect(m!.totalCalls).toBe(2);
    expect(m!.successCount).toBe(1);
    expect(m!.failureCount).toBe(1);
    expect(m!.totalTime).toBeCloseTo(200, -1);
    expect(m!.minTime).toBe(50);
    expect(m!.maxTime).toBe(150);
    expect(m!.avgTime).toBeGreaterThan(0);
  });

  it("formats metrics into a readable string", () => {
    trackToolExecution("toolB", 20, true);
    const formatted = formatMetrics("toolB");
    expect(typeof formatted).toBe("string");
    expect(formatted).toContain("Tool: toolB");
  });

  it("measureTime returns result and duration", async () => {
    const [result, elapsed] = await measureTime(async () => {
      await new Promise((r) => setTimeout(r, 60));
      return "ok";
    });

    expect(result).toBe("ok");
    expect(elapsed).toBeGreaterThan(40);
  });
});
