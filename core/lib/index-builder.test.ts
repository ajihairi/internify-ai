import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractRefs, buildIndex } from "./index-builder";

test("extractRefs finds backticked paths", () => {
  const refs = extractRefs("see `src/A/B.swift` and `Plan.md` but not `foo`");
  expect(refs).toContain("src/A/B.swift");
  expect(refs).toContain("Plan.md");
  expect(refs).not.toContain("foo");
});

test("buildIndex hashes existing files and marks reads unread", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  mkdirSync(join(root, "spec"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "spec", "SPECmd.md"), "# spec `src/X.swift`");
  writeFileSync(join(root, "src", "X.swift"), "func mainButtonTitle() {}");
  const idx = buildIndex(join(root, "spec"), root);
  expect(idx.requiredReads.length).toBeGreaterThan(0);
  expect(idx.requiredReads[0].hash.length).toBeGreaterThan(0);
  expect(idx.requiredReads[0].read).toBe(false);
});

test("unresolved ref yields unresolved anchor", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  mkdirSync(join(root, "spec"), { recursive: true });
  writeFileSync(join(root, "spec", "SPECmd.md"), "# spec `src/Missing.swift`");
  const idx = buildIndex(join(root, "spec"), root);
  const a = idx.anchors.find((x) => x.file === "src/Missing.swift");
  expect(a).toBeDefined();
  expect(a?.status).toBe("unresolved");
});

test("same code ref from two specs produces one required read", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  mkdirSync(join(root, "spec"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "spec", "A.md"), "# a `src/X.swift`");
  writeFileSync(join(root, "spec", "B.md"), "# b `src/X.swift`");
  writeFileSync(join(root, "src", "X.swift"), "func mainButtonTitle() {}");
  const idx = buildIndex(join(root, "spec"), root);
  const code = idx.requiredReads.filter((r) => r.path === "src/X.swift");
  expect(code.length).toBe(1);
});

test("traversal escaping repo becomes anchor, not read", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  mkdirSync(join(root, "spec"), { recursive: true });
  writeFileSync(
    join(root, "spec", "SPECmd.md"),
    "# spec `../../etc/hosts.swift`",
  );
  let idx: ReturnType<typeof buildIndex>;
  expect(() => {
    idx = buildIndex(join(root, "spec"), root);
  }).not.toThrow();
  expect(idx!.requiredReads.some((r) => r.path.includes(".."))).toBe(false);
  expect(idx!.anchors.some((a) => a.file === "../../etc/hosts.swift")).toBe(true);
});

test("fenced heading is not a slice", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  mkdirSync(join(root, "spec"), { recursive: true });
  writeFileSync(
    join(root, "spec", "SPECmd.md"),
    "# spec\n```\n# NotASlice\n```\n# RealSlice\n",
  );
  const idx = buildIndex(join(root, "spec"), root);
  expect(idx.slices.some((s) => s.selector === "NotASlice")).toBe(false);
  expect(idx.slices.some((s) => s.selector === "RealSlice")).toBe(true);
});

test("missing specRoot throws", () => {
  const root = mkdtempSync(join(tmpdir(), "idx-"));
  expect(() => buildIndex(join(root, "nope"), root)).toThrow();
});
