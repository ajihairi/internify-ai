import { test, expect } from "bun:test";
import { canEdit, canStep, canClose, canBash, bashWrites } from "./gates";
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

test("canStep blocks an anchor that is not a declared plan anchor", () => {
  expect(canStep(ledger(), "ZZ").ok).toBe(false);
});

test("canStep blocks an anchor whose index status is stale", () => {
  const anchors = [
    { id: "A1", file: "src/A.swift", line: 3, token: "a", status: "stale" as const },
  ];
  const r = canStep(ledger(), "A1", anchors);
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("stale");
});

test("bashWrites detects redirects and mutators", () => {
  expect(bashWrites("echo hi > a.txt")).toBe(true);
  expect(bashWrites("cat x >> y")).toBe(true);
  expect(bashWrites("sed -i '' s/a/b/ f")).toBe(true);
  expect(bashWrites("mv a b")).toBe(true);
  expect(bashWrites("ls -la")).toBe(false);
  expect(bashWrites("grep foo bar")).toBe(false);
});

test("canBash blocks a write before a step", () => {
  const l = ledger({ phase: "orient", scope: ["src/A.swift"] });
  expect(canBash("/repo", l, "echo x > src/A.swift").ok).toBe(false);
});

test("canBash blocks a write that does not reference scope", () => {
  const l = ledger({ phase: "acting", scope: ["src/A.swift"] });
  expect(canBash("/repo", l, "echo x > src/B.swift").ok).toBe(false);
});

test("canBash allows a scoped write when acting", () => {
  const l = ledger({ phase: "acting", scope: ["src/A.swift"] });
  expect(canBash("/repo", l, "echo x > src/A.swift").ok).toBe(true);
});

test("canBash allows non-writing commands unconditionally", () => {
  expect(canBash("/repo", ledger({ phase: "orient", scope: [] }), "ls -la").ok).toBe(true);
});

test("canEdit blocks rewriting a fixed document", () => {
  const r = canEdit("/repo", ledger({ phase: "acting" }), "src/A.swift", {
    targetStatus: "fixed",
  });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("fixed");
});

test("canEdit ignores unread optional (draft) reads", () => {
  const l = ledger({
    phase: "acting",
    requiredReads: [
      {
        key: "x",
        path: "p/draft.md",
        kind: "spec",
        hash: "h",
        read: false,
        status: "draft",
        required: false,
      },
    ],
  });
  expect(canEdit("/repo", l, "src/A.swift").ok).toBe(true);
});

test("canStep ignores unread optional reads", () => {
  const l = ledger({
    requiredReads: [
      { key: "x", path: "p/draft.md", kind: "spec", hash: "h", read: false, required: false },
    ],
  });
  expect(canStep(l, "A1").ok).toBe(true);
});

test("canStep passes for a resolved (status ok) anchor", () => {
  const l = ledger({
    requiredReads: [],
    steps: [{ id: "S1", title: "x", anchor: "A1", done: false }],
  });
  const r = canStep(l, "A1", [
    { id: "A1", file: "internify-ai/core/lib/boot.ts", line: 1, token: "boot", status: "ok" },
  ]);
  expect(r.ok).toBe(true);
});

test("canEdit allows a root-relative cross-repo scope entry", () => {
  const l = ledger({
    phase: "acting",
    scope: ["internify-ai/core/lib/boot.ts"],
    activeStep: "S1",
  });
  expect(canEdit("/repo", l, "internify-ai/core/lib/boot.ts").ok).toBe(true);
});

