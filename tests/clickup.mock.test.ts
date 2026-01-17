import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerClickUpTools } from "../src/tools/clickupTools.js";

describe("ClickUp Tools (mocked fetch)", () => {
  beforeEach(() => {
    process.env.CLICKUP_API_TOKEN = "clickup-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles get, update, and create task endpoints", async () => {
    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      // simple routing based on URL
      if (url.includes("/task/")) {
        if (opts?.method === "PUT") {
          return {
            ok: true,
            json: async () => ({ id: "1", name: "Updated Task", status: { status: "in progress" }, url: "https://clickup.example/t/1" }),
          } as any;
        }

        // GET
        return {
          ok: true,
          json: async () => ({ id: "1", name: "Test Task", status: { status: "to do" }, assignees: [], tags: [], date_created: "0", date_updated: "0", url: "https://clickup.example/t/1", list: { id: "l1", name: "List" } }),
        } as any;
      }

      if (url.includes("/list/") && opts?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "2", name: "Created Task", status: { status: "to do" }, url: "https://clickup.example/t/2" }),
        } as any;
      }

      return { ok: false, status: 404, text: async () => "not found" } as any;
    });

    const registered: Record<string, Function> = {};
    const fakeServer: any = {
      registerTool: (name: string, _opts: any, handler: Function) => {
        registered[name] = handler;
      },
    };

    registerClickUpTools(fakeServer);

    // Get task
    const getHandler = registered["clickup_get_task"];
    const getRes: any = await getHandler({ task_id: "1" });
    expect(getRes.structuredContent).toBeDefined();
    expect(getRes.structuredContent.id).toBe("1");

    // Update task
    const updateHandler = registered["clickup_update_task"];
    const updateRes: any = await updateHandler({ task_id: "1", name: "Updated Task" });
    expect(updateRes.structuredContent).toBeDefined();
    expect(updateRes.structuredContent.name).toBe("Updated Task");

    // Create task
    const createHandler = registered["clickup_create_task"];
    const createRes: any = await createHandler({ list_id: "l1", name: "New Task" });
    expect(createRes.structuredContent).toBeDefined();
    expect(createRes.structuredContent.id).toBe("2");
  });
});
