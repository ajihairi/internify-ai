import { test, expect } from "bun:test";
import { parseDailyDate, pickLatestDaily, extractSummary, buildContextPack } from "./boot";
import { emptyLedger } from "./state";

test("parseDailyDate parses DD-MM-YYYY.md", () => {
  expect(parseDailyDate("09-09-2026.md")?.getFullYear()).toBe(2026);
  expect(parseDailyDate("nope.md")).toBeNull();
});

test("pickLatestDaily sorts by date desc", () => {
  expect(pickLatestDaily(["09-09-2026.md", "31-08-2026.md", "01-09-2026.md"])).toBe(
    "09-09-2026.md",
  );
  expect(pickLatestDaily([])).toBeNull();
});

test("extractSummary pulls text under ## Summary", () => {
  const md = "# x\n\n## Summary\n\nHello world.\n\n---\nnext";
  expect(extractSummary(md)).toBe("Hello world.");
});

test("buildContextPack includes active task and specs", () => {
  const pack = buildContextPack({
    generated: "2026-09-10T00:00:00.000Z",
    latestDaily: "09-09-2026.md",
    dailySummary: "did stuff",
    ledger: null,
    specs: ["intern/plans/Module/FeatureX"],
  });
  expect(pack).toContain("09-09-2026.md");
  expect(pack).toContain("did stuff");
  expect(pack).toContain("FeatureX");
});

test("parseDailyDate rejects rolled-over dates", () => {
  expect(parseDailyDate("31-02-2026.md")).toBeNull();
});

test("extractSummary stops at a trailing horizontal rule at EOF", () => {
  expect(extractSummary("## Summary\nonly\n---")).toBe("only");
});

test("buildContextPack includes active ledger details", () => {
  const ledger = emptyLedger("t1", "/s");
  ledger.phase = "acting";
  ledger.activeStep = "S1";
  ledger.requiredReads = [
    { key: "SPECmd.md", path: "p/SPECmd.md", kind: "spec", hash: "h", read: false },
  ];
  const pack = buildContextPack({
    generated: "x",
    latestDaily: null,
    dailySummary: "",
    ledger,
    specs: [],
  });
  expect(pack).toContain("t1");
  expect(pack).toContain("p/SPECmd.md");
});
