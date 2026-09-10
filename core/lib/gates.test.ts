import { test, expect } from "bun:test";
import { canEdit, canStep, canClose } from "./gates";
import type { Ledger } from "./types";

function ledger(over: Partial<Ledger> = {}): Ledger {
  return {
    taskId: "t",
    specRoot: "/s",
    role: "UIUXEngineer",
    phase: "grounded",
    scope: ["src/A.swift"],
    requiredReads: [],
    steps: [{ id: "S1", title: "x", anchor: "A1", done: false }],
    decisions: [],
    openQuestions: [],
    activeStep: "S1",
    updated: "",
    ...over,
  };
}

test("canEdit blocks unread required read", () => {
  const l = ledger({
    phase: "acting",
    requiredReads: [
      { key: "SPECmd.md", path: "x", kind: "spec", hash: "h", read: false },
    ],
  });
  const r = canEdit("/repo", l, "src/A.swift");
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("BLOCKED");
});

test("canEdit blocks out-of-scope file", () => {
  expect(canEdit("/repo", ledger({ phase: "acting" }), "src/B.swift").ok).toBe(false);
});

test("canEdit allows in-scope when acting and step set", () => {
  expect(canEdit("/repo", ledger({ phase: "acting" }), "src/A.swift").ok).toBe(true);
});

test("canEdit blocks prefix sibling in scope", () => {
  expect(canEdit("/repo", ledger({ phase: "acting" }), "EVILsrc/A.swift").ok).toBe(false);
});

test("canEdit blocks absolute path outside repo", () => {
  expect(canEdit("/repo", ledger({ phase: "acting" }), "/other/repo/src/A.swift").ok).toBe(false);
});

test("canEdit allows subdirectory of scope entry", () => {
  const l = ledger({ phase: "acting", scope: ["src/Module"] });
  expect(canEdit("/repo", l, "src/Module/A.swift").ok).toBe(true);
});

test("canEdit empty scope entry never matches", () => {
  expect(canEdit("/repo", ledger({ phase: "acting", scope: [""] }), "src/A.swift").ok).toBe(false);
});

test("canEdit phase allowlist blocks non-planned/acting", () => {
  expect(canEdit("/repo", ledger({ phase: "verifying" }), "src/A.swift").ok).toBe(false);
  expect(canEdit("/repo", ledger({ phase: "grounded" }), "src/A.swift").ok).toBe(false);
});

test("canEdit honors one-shot forceAllow override", () => {
  const l = ledger({ phase: "acting", scope: ["src/A.swift"], forceAllow: true });
  expect(canEdit("/repo", l, "src/Unrelated.swift").ok).toBe(true);
});

test("canClose requires every step to have pass evidence", () => {
  const l = ledger({ phase: "verifying" });
  const r = canClose(l, []);
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("S1");
});

test("canClose blocks empty steps", () => {
  expect(canClose(ledger({ steps: [], phase: "verifying" }), []).ok).toBe(false);
});

test("canStep requires an anchor", () => {
  expect(canStep(ledger(), "").ok).toBe(false);
  expect(canStep(ledger(), "A1").ok).toBe(true);
});
