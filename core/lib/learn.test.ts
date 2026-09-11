import { test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDigest,
  buildIndexEntries,
  extractImports,
  extractSymbols,
  syncCodeKnowledge,
  walkSwift,
} from "./learn";
import {
  loadLearnManifest,
  readLearnDigest,
  readLearnIndex,
} from "./io";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "internify-learn-"));
}

test("extractSymbols captures types, funcs, and top-level vars", () => {
  const src = [
    "import Foundation",
    "public class HomeViewModel {",
    "  let title: String",
    "  func loadData() {}",
    "}",
    "enum Route {",
    "  case home",
    "}",
    "let constantValue = 5",
  ].join("\n");
  const syms = extractSymbols(src);
  const names = syms.map((s) => s.symbol);
  expect(names).toContain("HomeViewModel");
  expect(names).toContain("Route");
  expect(names).toContain("loadData");
  expect(names).toContain("constantValue");
  const home = syms.find((s) => s.symbol === "HomeViewModel");
  expect(home?.kind).toBe("type");
  expect(home?.line).toBeGreaterThan(0);
});

test("extractImports collects module names", () => {
  const src = ["import Foundation", "import UIKit", "let x = 1"].join("\n");
  expect(extractImports(src)).toEqual(["Foundation", "UIKit"]);
});

test("buildIndexEntries produces path+line+symbol", () => {
  const root = tmp();
  mkdirSync(join(root, "A"), { recursive: true });
  writeFileSync(join(root, "A", "Thing.swift"), "class Thing {\n  func go() {}\n}");
  const entries = buildIndexEntries(root, ["A/Thing.swift"]);
  expect(entries.length).toBeGreaterThanOrEqual(2);
  expect(entries.some((e) => e.symbol === "Thing" && e.path === "A/Thing.swift")).toBe(true);
});

test("buildDigest groups by top-level dir and lists where-is-X", () => {
  const root = tmp();
  mkdirSync(join(root, "A"), { recursive: true });
  mkdirSync(join(root, "B"), { recursive: true });
  writeFileSync(join(root, "A", "X.swift"), "class X {}");
  writeFileSync(join(root, "B", "Y.swift"), "class Y {}");
  const syms = buildIndexEntries(root, ["A/X.swift", "B/Y.swift"]);
  const digest = buildDigest(root, ["A/X.swift", "B/Y.swift"], syms);
  expect(digest).toContain("## A");
  expect(digest).toContain("## B");
  expect(digest).toContain("Where is X");
  expect(digest).toContain("`X`");
});

test("walkSwift only collects .swift and skips ignored dirs", () => {
  const root = tmp();
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "Pods"), { recursive: true });
  writeFileSync(join(root, "src", "a.swift"), "class A {}");
  writeFileSync(join(root, "Pods", "b.swift"), "class B {}");
  writeFileSync(join(root, "src", "note.md"), "x");
  const files = walkSwift(root, []);
  expect(files).toEqual(["src/a.swift"]);
});

test("syncCodeKnowledge caches manifest + index + digest, unchanged on rerun", () => {
  const knowledge = tmp();
  const target = tmp();
  mkdirSync(join(target, "src"), { recursive: true });
  writeFileSync(join(target, "src", "Home.swift"), "class HomeViewModel { func load() {} }");
  const first = syncCodeKnowledge(knowledge, target, []);
  expect(first.changed).toBe(true);
  expect(first.count).toBe(1);
  expect(loadLearnManifest(knowledge).length).toBe(1);
  expect((readLearnIndex(knowledge) as unknown[]).length).toBeGreaterThan(0);
  expect(readLearnDigest(knowledge)).toContain("HomeViewModel");

  const second = syncCodeKnowledge(knowledge, target, []);
  expect(second.changed).toBe(false);
});
