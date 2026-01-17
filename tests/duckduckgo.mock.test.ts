import { describe, it, expect, vi, afterEach } from "vitest";
import { registerDuckDuckGoSearchTools } from "../src/tools/duckduckgoSearchTools.js";

describe("DuckDuckGo Search (mocked fetch)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses HTML results from mocked DuckDuckGo", async () => {
    const fakeHtml = `
      <div>
        <div class="result">
          <div>
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example Title</a>
            <a class="result__snippet">Example snippet here</a>
          </div>
        </div>
      </div>
    `;

    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => fakeHtml,
    } as any));

    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerDuckDuckGoSearchTools(fakeServer);

    const handler = registered["duckduckgo_search"];
    expect(typeof handler).toBe("function");

    const res: any = await handler({ query: "example", max_results: 5 });

    expect(res.structuredContent).toBeDefined();
    expect(res.structuredContent.results.length).toBeGreaterThan(0);
    expect(res.structuredContent.results[0].title).toContain("Example Title");
  });
});
