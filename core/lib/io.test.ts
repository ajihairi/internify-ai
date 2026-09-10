import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyLedger } from "./state";
import {
  saveLedger,
  loadLedger,
  saveIndex,
  readIndex,
  appendEvidence,
  readEvidence,
  setActive,
  getActive,
  appendDaily,
  listDaily,
  listSpecs,
  writeContext,
} from "./io";

function tmp() {
  return mkdtempSync(join(tmpdir(), "internify-io-"));
}

test("ledger save/load round-trip", () => {
  const k = tmp();
  const l = emptyLedger("t1", "spec/FeatureX");
  l.phase = "acting";
  saveLedger(k, l);
  expect(loadLedger(k, "t1")?.phase).toBe("acting");
  expect(loadLedger(k, "missing")).toBeNull();
});

test("index save/read round-trip (markdown + block)", () => {
  const k = tmp();
  const idx = {
    specRoot: "s",
    generated: "g",
    requiredReads: [],
    anchors: [],
    slices: [],
  };
  saveIndex(k, "t1", idx);
  const md = readFileSync(join(k, "state", "tasks", "t1", "INDEX.md"), "utf8");
  expect(md).toContain("| key | path | kind | hash |");
  expect(readIndex(k, "t1")?.specRoot).toBe("s");
});

test("evidence append/read", () => {
  const k = tmp();
  appendEvidence(k, "t1", "## S1 2026 result=pass\nclaim: c\nproof: p");
  appendEvidence(k, "t1", "## S2 2026 result=fail\nclaim: c\nproof: p");
  expect(readEvidence(k, "t1")).toEqual([
    { step: "S1", result: "pass" },
    { step: "S2", result: "fail" },
  ]);
});

test("active set/get + shape guard", () => {
  const k = tmp();
  expect(getActive(k)).toBeNull();
  setActive(k, "t1", "s");
  expect(getActive(k)).toEqual({ taskId: "t1", specRoot: "s" });
});

test("daily append + list", () => {
  const k = tmp();
  const name = appendDaily(k, "did stuff");
  expect(name).toMatch(/^\d{2}-\d{2}-\d{4}\.md$/);
  expect(listDaily(k)).toContain(name);
});

test("listSpecs walks the plans dir", () => {
  const k = tmp();
  mkdirSync(join(k, "plans", "Module", "FeatureX"), { recursive: true });
  expect(listSpecs(k).some((s) => s.includes("FeatureX"))).toBe(true);
});

test("listSpecs accepts a custom plans root", () => {
  const k = tmp();
  mkdirSync(join(k, "intern", "plans", "FeatureY"), { recursive: true });
  const specs = listSpecs(k, join(k, "intern", "plans"));
  expect(specs.some((s) => s.includes("FeatureY"))).toBe(true);
});

test("writeContext writes CONTEXT.md", () => {
  const k = tmp();
  writeContext(k, "hello");
  expect(existsSync(join(k, "state", "CONTEXT.md"))).toBe(true);
});
