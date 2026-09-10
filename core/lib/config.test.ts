import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPaths } from "./config";

test("defaults: knowledge=<root>/.intern, target=root", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  const p = loadPaths(r);
  expect(p.knowledge).toBe(join(r, ".intern"));
  expect(p.target).toBe(r);
  expect(p.root).toBe(r);
});

test("internify.json overrides target + knowledge", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  writeFileSync(
    join(r, "internify.json"),
    JSON.stringify({ target: "../projectA", knowledge: "know" }),
  );
  const p = loadPaths(r);
  expect(p.target.endsWith("projectA")).toBe(true);
  expect(p.knowledge).toBe(join(r, "know"));
});

test("malformed config falls back to defaults", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  writeFileSync(join(r, "internify.json"), "{ not json");
  const p = loadPaths(r);
  expect(p.knowledge).toBe(join(r, ".intern"));
  expect(p.target).toBe(r);
});
