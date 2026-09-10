import { test, expect } from "bun:test";
import { InternHarness } from "./plugins/intern-harness";

test("plugin registers the intern_* tools and hooks", async () => {
  const ctx = {
    project: {},
    directory: process.cwd(),
    worktree: process.cwd(),
    client: {},
    $: {},
  } as never;
  const hooks = (await InternHarness(ctx, {})) as Record<string, unknown>;
  const tools = hooks.tool as Record<string, unknown>;
  for (const name of [
    "intern_boot",
    "intern_index",
    "intern_context",
    "intern_step",
    "intern_evidence",
    "intern_close",
    "intern_status",
    "intern_override",
  ]) {
    expect(Object.keys(tools)).toContain(name);
  }
  expect(typeof hooks["tool.execute.before"]).toBe("function");
  expect(typeof hooks["tool.execute.after"]).toBe("function");
  expect(typeof hooks["experimental.chat.system.transform"]).toBe("function");
});

test("INTERN_HARNESS=off disables the plugin", async () => {
  process.env.INTERN_HARNESS = "off";
  const hooks = (await InternHarness({} as never, {})) as Record<string, unknown>;
  expect(Object.keys(hooks)).toHaveLength(0);
  delete process.env.INTERN_HARNESS;
});
