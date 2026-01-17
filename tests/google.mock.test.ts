import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerGoogleSearchTools } from "../src/tools/googleSearchTools.js";

describe("Google Search (mocked fetch)", () => {
  beforeEach(() => {
    // Provide a fake SERPAPI key so the tool proceeds
    process.env.SERPAPI_API_KEY = "serp-test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns structured results from mocked SerpAPI", async () => {
    // Stub global fetch
    vi.stubGlobal("fetch", async () => {
      return {
        ok: true,
        json: async () => ({
          organic_results: [
            { title: "T1", link: "https://example.com/1", snippet: "S1", position: 1 },
          ],
        }),
      } as any;
    });

    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerGoogleSearchTools(fakeServer);

    const handler = registered["google_search"];
    expect(typeof handler).toBe("function");

    const res: any = await handler({ query: "test", num_results: 1 });

    expect(res.structuredContent).toBeDefined();
    expect(res.structuredContent.results.length).toBe(1);
    expect(res.structuredContent.results[0].link).toBe("https://example.com/1");
  });
});
