import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSpecTemplate, newSpec, normalizeSpecName, specNameFromPath } from "./spec";

const PKG_TEMPLATE = join(
  import.meta.dir,
  "..",
  "..",
  "template",
  ".intern",
  "plans",
  "_template",
);

function tmp() {
  return mkdtempSync(join(tmpdir(), "internify-spec-"));
}

test("normalizeSpecName trims and rejects traversal", () => {
  expect(normalizeSpecName(" FeatureX ")).toBe("FeatureX");
  expect(normalizeSpecName("ApplyCNAF/FeatX")).toBe("ApplyCNAF/FeatX");
  expect(() => normalizeSpecName("../evil")).toThrow();
  expect(() => normalizeSpecName("")).toThrow();
});

test("specNameFromPath strips the plans-dir prefix", () => {
  const root = "/ws";
  const plans = "/ws/intern/plans";
  expect(specNameFromPath(root, plans, "intern/plans/ApplyCNAF/FeatX")).toBe(
    "ApplyCNAF/FeatX",
  );
  expect(specNameFromPath(root, plans, "FeatureX")).toBe("FeatureX");
  expect(specNameFromPath(root, plans, "./intern/plans/FeatureX")).toBe("FeatureX");
});

test("findSpecTemplate: simple layout", () => {
  const ws = tmp();
  mkdirSync(join(ws, "plans", "_template"), { recursive: true });
  expect(findSpecTemplate(join(ws, "plans"))).toBe(join(ws, "plans", "_template"));
});

test("findSpecTemplate: advanced layout uses the templates dir", () => {
  const ws = tmp();
  mkdirSync(join(ws, "05-templates", "_template"), { recursive: true });
  expect(findSpecTemplate(join(ws, "01-projects"), join(ws, "05-templates"))).toBe(
    join(ws, "05-templates", "_template"),
  );
});

test("findSpecTemplate: null when missing", () => {
  const ws = tmp();
  expect(findSpecTemplate(join(ws, "plans"))).toBeNull();
});

test("newSpec scaffolds the three files and substitutes placeholders", () => {
  const ws = tmp();
  const res = newSpec({
    template: PKG_TEMPLATE,
    plansDir: join(ws, "plans"),
    name: "FeatureX",
    role: "Engineer",
    date: "2026-09-10",
  });
  expect(res.files.length).toBe(3);
  expect(res.skipped.length).toBe(0);
  expect(existsSync(join(ws, "plans", "FeatureX", "SPECmd.md"))).toBe(true);
  expect(existsSync(join(ws, "plans", "FeatureX", "Plan.md"))).toBe(true);
  expect(existsSync(join(ws, "plans", "FeatureX", "Task.md"))).toBe(true);

  const spec = readFileSync(join(ws, "plans", "FeatureX", "SPECmd.md"), "utf8");
  expect(spec).toContain("# SPEC — FeatureX");
  expect(spec).toContain("updated: 2026-09-10");
  expect(spec).toContain("owner: Engineer");
  expect(spec).not.toContain("<SpecName>");
  expect(spec).not.toContain("<role>");
  expect(spec).not.toContain("<YYYY-MM-DD>");
});

test("newSpec supports nested names", () => {
  const ws = tmp();
  newSpec({
    template: PKG_TEMPLATE,
    plansDir: join(ws, "plans"),
    name: "ApplyCNAF/FeatX",
    date: "2026-09-10",
  });
  expect(existsSync(join(ws, "plans", "ApplyCNAF", "FeatX", "Plan.md"))).toBe(true);
  const spec = readFileSync(join(ws, "plans", "ApplyCNAF", "FeatX", "SPECmd.md"), "utf8");
  expect(spec).toContain("# SPEC — FeatX");
});

test("newSpec refuses an existing folder by default", () => {
  const ws = tmp();
  mkdirSync(join(ws, "plans", "FeatureX"), { recursive: true });
  expect(() =>
    newSpec({
      template: PKG_TEMPLATE,
      plansDir: join(ws, "plans"),
      name: "FeatureX",
    }),
  ).toThrow(/already exists/);
});

test("newSpec ifMissing skips a complete spec and never overwrites", () => {
  const ws = tmp();
  const opts = {
    template: PKG_TEMPLATE,
    plansDir: join(ws, "plans"),
    name: "FeatureX",
    date: "2026-09-10",
  };
  newSpec(opts);
  const spec = join(ws, "plans", "FeatureX", "SPECmd.md");
  const before = readFileSync(spec, "utf8");

  const res = newSpec({ ...opts, ifMissing: true });
  expect(res.files.length).toBe(0);
  expect(res.skipped.length).toBe(3);
  expect(readFileSync(spec, "utf8")).toBe(before);
});

test("newSpec ifMissing fills only the missing files", () => {
  const ws = tmp();
  const dir = join(ws, "plans", "FeatureX");
  mkdirSync(dir, { recursive: true });
  const kept = join(dir, "SPECmd.md");
  writeFileSync(kept, "# custom spec\n");

  const res = newSpec({
    template: PKG_TEMPLATE,
    plansDir: join(ws, "plans"),
    name: "FeatureX",
    ifMissing: true,
    date: "2026-09-10",
  });
  expect(res.files.length).toBe(2);
  expect(res.skipped).toContain(kept);
  expect(readFileSync(kept, "utf8")).toBe("# custom spec\n");
  expect(existsSync(join(dir, "Plan.md"))).toBe(true);
  expect(existsSync(join(dir, "Task.md"))).toBe(true);
});
