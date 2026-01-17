import { describe, it, expect } from "vitest";
import { registerGoogleSearchTools } from "../src/tools/googleSearchTools.js";
import { registerDuckDuckGoSearchTools } from "../src/tools/duckduckgoSearchTools.js";
import { registerContext7Tools } from "../src/tools/context7Tools.js";
import { registerClickUpTools } from "../src/tools/clickupTools.js";
import { registerImageTools } from "../src/tools/imageTools.js";

function makeFakeServer() {
  const tools: string[] = [];
  return {
    registerTool: (name: string) => tools.push(name),
    getTools: () => tools,
  } as any;
}

describe("Tool registration", () => {
  it("registers google search tools", () => {
    const s = makeFakeServer();
    registerGoogleSearchTools(s);
    expect(s.getTools().length).toBeGreaterThan(0);
  });

  it("registers duckduckgo search tools", () => {
    const s = makeFakeServer();
    registerDuckDuckGoSearchTools(s);
    expect(s.getTools().length).toBeGreaterThan(0);
  });

  it("registers context7 tools", () => {
    const s = makeFakeServer();
    registerContext7Tools(s);
    expect(s.getTools().length).toBeGreaterThan(0);
  });

  it("registers clickup tools", () => {
    const s = makeFakeServer();
    registerClickUpTools(s);
    expect(s.getTools().length).toBeGreaterThan(0);
  });

  it("registers image tools", () => {
    const s = makeFakeServer();
    registerImageTools(s);
    expect(s.getTools().length).toBeGreaterThan(0);
  });
});
