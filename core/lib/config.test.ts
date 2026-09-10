import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPaths } from "./config";

test("defaults: knowledge=<root>/.intern, target=root, plans=<knowledge>/plans", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  const p = loadPaths(r);
  expect(p.knowledge).toBe(join(r, ".intern"));
  expect(p.target).toBe(r);
  expect(p.root).toBe(r);
  expect(p.plans).toBe(join(r, ".intern", "plans"));
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
  expect(p.plans).toBe(join(r, "know", "plans"));
});

test("plansDir overrides the plans location", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  writeFileSync(
    join(r, "internify.json"),
    JSON.stringify({ knowledge: "intern", plansDir: "superpowers/plans" }),
  );
  const p = loadPaths(r);
  expect(p.knowledge).toBe(join(r, "intern"));
  expect(p.plans).toBe(join(r, "intern", "superpowers", "plans"));
});

test("malformed config falls back to defaults", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-cfg-"));
  writeFileSync(join(r, "internify.json"), "{ not json");
  const p = loadPaths(r);
  expect(p.knowledge).toBe(join(r, ".intern"));
  expect(p.target).toBe(r);
  expect(p.plans).toBe(join(r, ".intern", "plans"));
});
