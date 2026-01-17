import { describe, it, expect } from "vitest";
import { registerGitResources } from "../src/resources/gitResources.js";

describe("Git resources registration", () => {
  it("registers git-status resource", () => {
    const resources: string[] = [];
    const fakeServer: any = {
      registerResource: (name: string, uri: string, meta: any, handler: Function) => {
        resources.push(name);
      },
    };

    registerGitResources(fakeServer);
    expect(resources).toContain("git-status");
  });
});
