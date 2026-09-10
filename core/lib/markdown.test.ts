import { test, expect } from "bun:test";
import { extractBlock, upsertBlock } from "./markdown";

test("extractBlock returns null when block missing", () => {
  expect(extractBlock("# hi", "ledger")).toBeNull();
});

test("upsertBlock inserts then round-trips", () => {
  const md = upsertBlock("# hi", "ledger", { phase: "orient" });
  expect(extractBlock(md, "ledger")).toBe(JSON.stringify({ phase: "orient" }, null, 2));
});

test("upsertBlock does not interpret $ in json values", () => {
  let md = upsertBlock("# hi", "ledger", { phase: "orient" });
  md = upsertBlock(md, "ledger", { note: "a $& b $' c" });
  expect(extractBlock(md, "ledger")).toBe(
    JSON.stringify({ note: "a $& b $' c" }, null, 2),
  );
});

test("upsertBlock replaces existing block", () => {
  let md = upsertBlock("# hi", "ledger", { phase: "orient" });
  md = upsertBlock(md, "ledger", { phase: "grounded" });
  expect(extractBlock(md, "ledger")).toContain("grounded");
  expect(extractBlock(md, "ledger")).not.toContain("orient");
});
