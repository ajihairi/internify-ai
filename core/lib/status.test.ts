import { test, expect } from "bun:test";
import { parseStatus, isRequiredRead, isFixed } from "./status";

test("parseStatus reads status from frontmatter", () => {
  expect(parseStatus("---\nstatus: draft\n---\n# x")).toBe("draft");
  expect(parseStatus('---\nstatus: "fixed"\n---\n# x')).toBe("fixed");
  expect(parseStatus("---\nstatus: Review\n---\n# x")).toBe("review");
});

test("parseStatus returns null without frontmatter or valid status", () => {
  expect(parseStatus("# x\nstatus: draft")).toBeNull();
  expect(parseStatus("---\ntitle: x\n---\n# x")).toBeNull();
  expect(parseStatus("---\nstatus: weird\n---\n# x")).toBeNull();
});

test("isRequiredRead: default and fixed are required; draft/review optional", () => {
  expect(isRequiredRead(null)).toBe(true);
  expect(isRequiredRead("fixed")).toBe(true);
  expect(isRequiredRead("review")).toBe(false);
  expect(isRequiredRead("draft")).toBe(false);
});

test("isFixed", () => {
  expect(isFixed("fixed")).toBe(true);
  expect(isFixed("draft")).toBe(false);
  expect(isFixed(null)).toBe(false);
});
