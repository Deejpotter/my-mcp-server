import { describe, it, expect, beforeEach } from "vitest";
import { Cache, RateLimiter } from "../src/utils/cache.js";
describe("Cache", () => {
    let cache;
    beforeEach(() => {
        cache = new Cache(100);
    });
    it("should store and retrieve values", () => {
        cache.set("key1", "value1");
        expect(cache.get("key1")).toBe("value1");
    });
    it("should return undefined for missing keys", () => {
        expect(cache.get("nonexistent")).toBeUndefined();
    });
    it("should expire entries after TTL", async () => {
        cache.set("key1", "value1");
        expect(cache.get("key1")).toBe("value1");
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(cache.get("key1")).toBeUndefined();
    });
    it("should clear all entries", () => {
        cache.set("key1", "value1");
        cache.set("key2", "value2");
        cache.clear();
        expect(cache.get("key1")).toBeUndefined();
        expect(cache.get("key2")).toBeUndefined();
    });
});
describe("RateLimiter", () => {
    it("should allow calls within limit", () => {
        const limiter = new RateLimiter(3, 1000);
        expect(limiter.allowCall()).toBe(true);
        expect(limiter.allowCall()).toBe(true);
        expect(limiter.allowCall()).toBe(true);
    });
    it("should reject calls exceeding limit", () => {
        const limiter = new RateLimiter(2, 1000);
        limiter.allowCall();
        limiter.allowCall();
        const result = limiter.allowCall();
        expect(result).toBe(false);
    });
    it("should reset after window expires", async () => {
        const limiter = new RateLimiter(2, 100);
        limiter.allowCall();
        limiter.allowCall();
        await new Promise((resolve) => setTimeout(resolve, 150));
        const result = limiter.allowCall();
        expect(result).toBe(true);
    });
    it("should return correct wait time", () => {
        const limiter = new RateLimiter(1, 1000);
        limiter.allowCall();
        const waitTime = limiter.getWaitTime();
        expect(waitTime).toBeGreaterThan(0);
        expect(waitTime).toBeLessThanOrEqual(1000);
    });
});
//# sourceMappingURL=cache.test.js.map