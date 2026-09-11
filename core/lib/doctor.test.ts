import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctorChecks } from "./doctor";
import { loadPaths } from "./config";
import { emptyLedger } from "./state";
import { saveLedger, saveIndex, setActive } from "./io";

test("doctor reports a fresh workspace", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-doc-"));
  const checks = doctorChecks(loadPaths(r));
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  expect(byName["workspace root"].ok).toBe(true);
  expect(byName["knowledge dir"].ok).toBe(false);
  expect(byName["knowledge dir"].level).toBe("warn");
  expect(byName["active tasks"].detail).toBe("none");
});

test("doctor flags a corrupt active ledger", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-doc-"));
  const paths = loadPaths(r);
  mkdirSync(paths.knowledge, { recursive: true });
  setActive(paths.knowledge, "t1", "spec");
  // no ledger written → corrupt
  const checks = doctorChecks(paths);
  const active = checks.find((c) => c.name === "task t1 (focus)");
  expect(active?.level).toBe("error");
});

test("doctor passes a healthy active task", () => {
  const r = mkdtempSync(join(tmpdir(), "internify-doc-"));
  const paths = loadPaths(r);
  mkdirSync(paths.knowledge, { recursive: true });
  setActive(paths.knowledge, "t1", "spec");
  saveLedger(paths.knowledge, emptyLedger("t1", "spec"));
  saveIndex(paths.knowledge, "t1", {
    specRoot: "spec",
    generated: "g",
    requiredReads: [],
    anchors: [],
    slices: [],
  });
  const checks = doctorChecks(paths);
  const active = checks.find((c) => c.name === "task t1 (focus)");
  expect(active?.level).toBe("ok");
});
