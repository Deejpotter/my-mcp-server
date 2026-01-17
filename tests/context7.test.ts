import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerContext7Tools } from "../src/tools/context7Tools.js";
import * as cache from "../src/utils/cache.js";

describe("Context7 Tools", () => {
  beforeEach(() => {
    // Ensure rate limiter allows by default
    vi.spyOn(cache.context7Limiter, "allowCall").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolve_library_id returns guidance for valid input", async () => {
    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerContext7Tools(fakeServer);
    const handler = registered["resolve_library_id"];
    const res: any = await handler({ libraryName: "zod" });

    expect(res).toBeDefined();
    expect(res.content[0].text).toContain("To resolve library IDs in Context7");
  });

  it("get_documentation validates libraryId format and tokens", async () => {
    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerContext7Tools(fakeServer);
    const handler = registered["get_documentation"];

    // invalid libraryId
    const bad: any = await handler({ libraryId: "invalid-id" });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toContain("Invalid library ID format");

    // invalid tokens
    const badTokens: any = await handler({ libraryId: "/model/context", tokens: 10 });
    expect(badTokens.isError).toBe(true);
    expect(badTokens.content[0].text).toContain("Token count must be between");
  });

  it("search_documentation validates empty query and respects rate limit", async () => {
    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerContext7Tools(fakeServer);
    const handler = registered["search_documentation"];

    const empty: any = await handler({ query: "" });
    expect(empty.isError).toBe(true);
    expect(empty.content[0].text).toContain("Search query cannot be empty");

    // Simulate rate limit exceeded
    vi.spyOn(cache.context7Limiter, "allowCall").mockReturnValue(false);
    const rateLimited: any = await handler({ query: "async" });
    expect(rateLimited.isError).toBe(true);
    expect(rateLimited.content[0].text).toContain("Rate limit exceeded");
  });
});
