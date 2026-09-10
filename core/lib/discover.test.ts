import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProjectContext,
  hashText,
  isAIFile,
  isIgnoredPath,
  refreshManifest,
  syncProjectContext,
  walkCandidates,
} from "./discover";
import {
  loadProjectManifest,
  readProjectContext,
  projectContextPath,
} from "./io";

function tmp() {
  return mkdtempSync(join(tmpdir(), "internify-scan-"));
}

test("hashText is deterministic and content-sensitive", () => {
  expect(hashText("a")).toBe(hashText("a"));
  expect(hashText("a")).not.toBe(hashText("b"));
});

test("isIgnoredPath skips known dirs + extra ignores", () => {
  expect(isIgnoredPath("Pods/AGENTS.md")).toBe(true);
  expect(isIgnoredPath("node_modules/x/AGENTS.md")).toBe(true);
  expect(isIgnoredPath("docs/a.md")).toBe(false);
  expect(isIgnoredPath("intern/x.md", ["intern"])).toBe(true);
  expect(isIgnoredPath("src/main.swift")).toBe(false);
});

test("isAIFile whitelist", () => {
  expect(isAIFile("AGENTS.md")).toBe(true);
  expect(isAIFile("CLAUDE.md")).toBe(true);
  expect(isAIFile("docs/a.md")).toBe(true);
  expect(isAIFile(".cursor/rules/x.md")).toBe(true);
  expect(isAIFile("team.skills.md")).toBe(true);
  expect(isAIFile("prompt.ai.md")).toBe(true);
  expect(isAIFile("README.md")).toBe(false);
  expect(isAIFile("src/main.swift")).toBe(false);
});

test("walkCandidates finds whitelisted files and skips the rest", () => {
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "agents\n");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "a.md"), "doc\n");
  writeFileSync(join(root, "README.md"), "readme\n");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "main.swift"), "// swift\n");
  mkdirSync(join(root, "Pods"), { recursive: true });
  writeFileSync(join(root, "Pods", "Pods.md"), "pod\n");

  const res = walkCandidates({ root, depth: 3 });
  const paths = res.files.map((f) => f.path).sort();
  expect(paths).toEqual(["AGENTS.md", "docs/a.md"]);
});

test("walkCandidates honors extraInclude", () => {
  const root = tmp();
  writeFileSync(join(root, "Team.md"), "team\n");
  const res = walkCandidates({ root, extraInclude: ["Team.md"] });
  expect(res.files.map((f) => f.path)).toContain("Team.md");
});

test("refreshManifest only rehashes changed files", () => {
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "v1\n");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "a.md"), "a\n");
  const first = walkCandidates({ root });
  const r1 = refreshManifest(root, [], first.files);
  expect(r1.changed.length).toBe(2);

  const r2 = refreshManifest(root, r1.entries, first.files);
  expect(r2.changed.length).toBe(0);

  writeFileSync(join(root, "AGENTS.md"), "v2\n");
  const second = walkCandidates({ root });
  const r3 = refreshManifest(root, r1.entries, second.files);
  expect(r3.changed).toEqual(["AGENTS.md"]);
});

test("syncProjectContext writes manifest + bundle, then is a no-op when unchanged", () => {
  const know = tmp();
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "agents\n");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "a.md"), "doc\n");

  const first = syncProjectContext(know, root);
  expect(first.changed).toBe(true);
  expect(first.count).toBe(2);
  expect(existsSync(projectContextPath(know))).toBe(true);
  expect(loadProjectManifest(know).length).toBe(2);
  expect(readProjectContext(know)).toContain("## AGENTS.md");
  expect(readProjectContext(know)).toContain("## docs/a.md");

  const second = syncProjectContext(know, root);
  expect(second.changed).toBe(false);
  expect(second.count).toBe(2);
});

test("syncProjectContext detects edits and removals", () => {
  const know = tmp();
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "v1\n");
  syncProjectContext(know, root);

  writeFileSync(join(root, "AGENTS.md"), "v2\n");
  const edited = syncProjectContext(know, root);
  expect(edited.changed).toBe(true);
  expect(edited.changedPaths).toEqual(["AGENTS.md"]);
  expect(readProjectContext(know)).toContain("v2");

  // removal
  unlinkSync(join(root, "AGENTS.md"));
  const removed = syncProjectContext(know, root);
  expect(removed.changed).toBe(true);
  expect(removed.changedPaths).toEqual(["AGENTS.md"]);
  expect(loadProjectManifest(know)).toEqual([]);
});

test("buildProjectContext embeds file contents", () => {
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "hello\n");
  const { files } = walkCandidates({ root });
  const { entries } = refreshManifest(root, [], files);
  const ctx = buildProjectContext(root, entries);
  expect(ctx).toContain("# Project AI context");
  expect(ctx).toContain("hello");
});
