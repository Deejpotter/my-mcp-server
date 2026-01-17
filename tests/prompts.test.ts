import { describe, it, expect } from "vitest";
import { registerPrompts } from "../src/prompts/prompts.js";

describe("Prompt registrations", () => {
  it("registers multiple prompts", () => {
    const names: string[] = [];
    const fakeServer: any = {
      prompt: (name: string) => names.push(name),
    };

    registerPrompts(fakeServer);

    expect(names.length).toBeGreaterThan(0);
  });
});
