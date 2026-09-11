import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyLedger } from "./state";
import {
  saveLedger,
  loadLedger,
  markRead,
  saveIndex,
  readIndex,
  appendEvidence,
  readEvidence,
  setActive,
  getActive,
  clearActive,
  loadActiveTasks,
  getPrimary,
  setPrimary,
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

test("active set/get + shape guard", () => {  const k = tmp();
  expect(getActive(k)).toBeNull();
  setActive(k, "t1", "s");
  expect(getActive(k)).toEqual({ taskId: "t1", specRoot: "s" });
});

test("clearActive removes the active pointer", () => {
  const k = tmp();
  setActive(k, "t1", "s");
  clearActive(k);
  expect(getActive(k)).toBeNull();
  clearActive(k); // idempotent, no throw
});

test("multi-active: setActive adds tasks; primary switches", () => {
  const k = tmp();
  setActive(k, "a", "spec/A");
  setActive(k, "b", "spec/B");
  const all = loadActiveTasks(k);
  expect(all.map((t) => t.taskId)).toEqual(["a", "b"]);
  // last setActive becomes primary
  expect(getPrimary(k)?.taskId).toBe("b");
  expect(getActive(k)?.taskId).toBe("b");
  // switching primary back to a keeps both on the list
  setPrimary(k, "a");
  expect(getPrimary(k)?.taskId).toBe("a");
  expect(loadActiveTasks(k).map((t) => t.taskId)).toEqual(["a", "b"]);
});

test("multi-active: legacy single active.json migrates to one-entry list", () => {
  const k = tmp();
  mkdirSync(join(k, "state"), { recursive: true });
  writeFileSync(join(k, "state", "active.json"), JSON.stringify({ taskId: "t1", specRoot: "s" }));
  const all = loadActiveTasks(k);
  expect(all).toEqual([{ taskId: "t1", specRoot: "s", primary: true }]);
  expect(getActive(k)?.taskId).toBe("t1");
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

test("markRead marks a required read by path", () => {
  const k = tmp();
  const l = emptyLedger("t1", "s");
  l.requiredReads = [
    { key: "A.swift", path: "src/A.swift", kind: "code", hash: "h", read: false },
  ];
  saveLedger(k, l);
  expect(markRead(k, "t1", "src/A.swift")).toBe(true);
  expect(loadLedger(k, "t1")?.requiredReads[0].read).toBe(true);
  expect(markRead(k, "t1", "nope")).toBe(false);
});
