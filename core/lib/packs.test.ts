import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashDir, readManifest, writeManifest, planPackActions, type PackEntry } from "./packs";

test("hashDir is stable and changes with content", () => {
  const d = mkdtempSync(join(tmpdir(), "internify-packs-"));
  writeFileSync(join(d, "SKILL.md"), "a");
  const h1 = hashDir(d);
  expect(hashDir(d)).toBe(h1);
  writeFileSync(join(d, "SKILL.md"), "b");
  expect(hashDir(d)).not.toBe(h1);
});

test("manifest round-trip", () => {
  const d = mkdtempSync(join(tmpdir(), "internify-packs-"));
  mkdirSync(d, { recursive: true });
  const entry: PackEntry = { name: "status", origin: "bundled", source: "/x", hash: "h", updated: "t" };
  writeManifest(d, { packs: [entry] });
  expect(readManifest(d).packs[0].name).toBe("status");
  expect(readManifest(join(d, "nope")).packs).toEqual([]);
});

test("planPackActions decides create/update/skip/missing", () => {
  const sources = [
    { name: "a", source: "/a", hash: "h1", origin: "bundled" as const },
    { name: "b", source: "/b", hash: "h2", origin: "external" as const },
    { name: "c", source: "/c", hash: "h3", origin: "bundled" as const },
  ];
  const installed = new Map<string, string>([
    ["a", "h1"],
    ["b", "old"],
  ]);
  const plan = Object.fromEntries(
    planPackActions(["a", "b", "c", "z"], sources, installed, false).map((p) => [p.name, p.action]),
  );
  expect(plan.a).toBe("skip"); // up to date
  expect(plan.b).toBe("update"); // changed
  expect(plan.c).toBe("skip"); // not installed, no force
  expect(plan.z).toBe("missing"); // unknown

  const forced = Object.fromEntries(
    planPackActions(["c"], sources, installed, true).map((p) => [p.name, p.action]),
  );
  expect(forced.c).toBe("create");
});
