import { test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatDailyUnfinished, loadLatestDaily, parseDailyUnfinished } from "./daily";

test("parseDailyUnfinished groups checkboxes, open rows, and next steps", () => {
  const md = [
    "# Daily",
    "## Summary",
    "Progress hari ini.",
    "",
    "## Selesai",
    "- [x] done item",
    "- [ ] open checklist",
    "",
    "| # | Task | Status |",
    "|---|------|--------|",
    "| 1 | finished row | ✅ |",
    "| 2 | pending row | ⏳ |",
    "| 3 | plain open row | |",
    "",
    "## Langkah berikutnya (kamu, manual)",
    "1. Baca artikel.",
    "2. Restart opencode.",
    "",
    "## Notes",
    "tidak relevan",
  ].join("\n");

  const u = parseDailyUnfinished(md);
  expect(u.checkboxes).toEqual(["open checklist"]);
  expect(u.openRows).toContain("2 | pending row | ⏳");
  expect(u.openRows).toContain("3 | plain open row");
  expect(u.openRows.some((r) => r.includes("finished row"))).toBe(false);
  expect(u.nextSteps).toContain("Baca artikel.");
  expect(u.nextSteps).toContain("Restart opencode.");
});

test("parseDailyUnfinished returns empty for a clean daily", () => {
  const u = parseDailyUnfinished("# Daily\n\nSemua beres. ✅\n");
  expect(u.checkboxes).toEqual([]);
  expect(u.openRows).toEqual([]);
  expect(u.nextSteps).toEqual([]);
  expect(formatDailyUnfinished(u)).toBe("(none)");
});

test("formatDailyUnfinished renders groups or (none)", () => {
  const u = { checkboxes: ["a"], openRows: [], nextSteps: [] };
  expect(formatDailyUnfinished(u)).toContain("- [ ] a");
});

test("loadLatestDaily picks the latest file and parses it", () => {
  const dir = mkdtempSync(join(tmpdir(), "internify-daily-"));
  const daily = join(dir, "daily");
  mkdirSync(daily, { recursive: true });
  writeFileSync(
    join(daily, "10-09-2026.md"),
    "## Summary\nsesi panjang\n\n## Langkah berikutnya\n1. Update artikel\n",
  );
  writeFileSync(join(daily, "11-09-2026.md"), "## Summary\nhari ini\n");

  const l = loadLatestDaily(dir, daily);
  expect(l.file).toBe("11-09-2026.md");
  expect(l.summary).toBe("hari ini");
  expect(l.unfinished.nextSteps).toEqual(["Update artikel"]);
});

test("loadLatestDaily with no files returns null file", () => {
  const dir = mkdtempSync(join(tmpdir(), "internify-daily-"));
  const l = loadLatestDaily(dir, join(dir, "daily"));
  expect(l.file).toBeNull();
  expect(formatDailyUnfinished(l.unfinished)).toBe("(none)");
});
