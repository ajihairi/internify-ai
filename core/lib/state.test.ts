import { test, expect } from "bun:test";
import { slug, emptyLedger, serializeLedger, parseLedger } from "./state";
import { upsertBlock } from "./markdown";

test("slug from spec folder", () => {
  expect(slug("/x/plans/Module/FeatureX")).toBe("featurex");
});

test("ledger round-trips through markdown", () => {
  const l = emptyLedger("t1", "/spec/root", "dataAndAPIIntegrator");
  const md = serializeLedger(l);
  const back = parseLedger(md);
  expect(back?.taskId).toBe("t1");
  expect(back?.phase).toBe("orient");
});

test("populated ledger round-trips exactly", () => {
  const l = emptyLedger("t2", "/spec/root");
  l.phase = "acting";
  l.scope = ["src/A.swift"];
  l.requiredReads = [
    { key: "SPECmd.md", path: "p", kind: "spec", hash: "abcd", read: true },
  ];
  l.steps = [{ id: "S1", title: "do x", anchor: "A1", done: false }];
  l.decisions = ["D1 thing"];
  l.openQuestions = ["Q1?"];
  l.activeStep = "S1";
  expect(parseLedger(serializeLedger(l))).toEqual(l);
});

test("parseLedger returns null for missing/corrupt/wrong-shape", () => {
  expect(parseLedger("# hi")).toBeNull();
  const corrupt =
    "# x\n\n<!-- intern:ledger:begin -->\n{not json\n<!-- intern:ledger:end -->\n";
  expect(parseLedger(corrupt)).toBeNull();
  const wrongShape = upsertBlock("# x", "ledger", 42);
  expect(parseLedger(wrongShape)).toBeNull();
});

test("emptyLedger defaults revision to 1", () => {
  const l = emptyLedger("t", "/s");
  expect(l.revision).toBe(1);
});

test("parseLedger defaults missing revision to 1 (backward compat)", () => {
  const md = upsertBlock("# x", "ledger", {
    taskId: "t",
    specRoot: "/s",
    role: "r",
    phase: "orient",
    scope: [],
    requiredReads: [],
    steps: [],
    decisions: [],
    openQuestions: [],
    activeStep: null,
    updated: "",
  });
  const back = parseLedger(md);
  expect(back?.revision).toBe(1);
});
