import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ManifestEntry } from "./types";
import {
  loadProjectManifest,
  saveProjectManifest,
  writeProjectContext,
  projectContextPath,
} from "./io";

/** Root-level docs that are always interesting. */
export const DEFAULT_AI_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "OPENCODE.md"];

/** Directories whose markdown is treated as AI context. */
export const DEFAULT_AI_DIRS = [
  "docs",
  ".cursor",
  ".claude",
  ".opencode",
  ".github",
  "skills",
];

/** Directory names that are never walked. */
export const DEFAULT_SKIP_DIRS = [
  ".git",
  "node_modules",
  "Pods",
  "build",
  "DerivedData",
  "vendor",
  ".build",
];

export interface ScanOptions {
  /** Absolute path to the project dir (`target`). */
  root: string;
  /** Extra relative paths to ignore (e.g. the knowledge dir). */
  ignore?: string[];
  /** Extra relative paths to force-include (files or dirs), from `scan`. */
  extraInclude?: string[];
  /** Max directory depth below root. Default 4. */
  depth?: number;
}

export interface DiscoveredFile {
  /** Path relative to root, posix separators. */
  path: string;
  /** Content hash (empty until content is read). */
  hash: string;
  size: number;
  mtimeMs: number;
}

export interface ScanResult {
  files: DiscoveredFile[];
  skipped: number;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function dirnamePosix(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "" : p.slice(0, i);
}

/** True when any path segment is in the skip list (or extra ignores). */
export function isIgnoredPath(relPosix: string, extraIgnore: string[] = []): boolean {
  const ignore = new Set([
    ...DEFAULT_SKIP_DIRS,
    ...extraIgnore.map((p) => p.replace(/\\/g, "/")),
  ]);
  return relPosix.split("/").some((seg) => ignore.has(seg));
}

/** Whitelist match: root AI docs, AI dirs, or `*.skills.md` / `*.ai.md`. */
export function isAIFile(relPosix: string): boolean {
  const lower = relPosix.toLowerCase();
  if (DEFAULT_AI_FILES.some((f) => lower === f.toLowerCase())) return true;
  const dir = dirnamePosix(lower);
  if (DEFAULT_AI_DIRS.some((d) => dir === d || dir.startsWith(d + "/"))) return true;
  const name = lower.split("/").pop() ?? "";
  return /\.skills\.md$/.test(name) || /\.ai\.md$/.test(name);
}

/**
 * Walk the project dir collecting whitelisted files. Cheap: reads metadata
 * only, no file content.
 */
export function walkCandidates(opts: ScanOptions): ScanResult {
  const depth = opts.depth ?? 4;
  const root = resolve(opts.root);
  const extra = (opts.extraInclude ?? [])
    .map((p) => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  const extraDirs = extra.filter((e) => !/\.[a-z0-9]+$/i.test(e) || e.endsWith("/"));
  const files: DiscoveredFile[] = [];
  let skipped = 0;
  if (!existsSync(root)) return { files, skipped };

  const included = (rel: string): boolean =>
    isAIFile(rel) ||
    extra.includes(rel) ||
    extraDirs.some((d) => rel === d || rel.startsWith(d + "/"));

  const walk = (dir: string, level: number): void => {
    if (level > depth) return;
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = relative(root, abs).split("\\").join("/");
      if (isIgnoredPath(rel, opts.ignore)) {
        skipped++;
        continue;
      }
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs, level + 1);
      else if (st.isFile() && included(rel)) {
        files.push({ path: rel, hash: "", size: st.size, mtimeMs: st.mtimeMs });
      }
    }
  };
  walk(root, 0);
  return { files, skipped };
}

export function contentHash(abs: string): string {
  return hashText(readFileSync(abs, "utf8"));
}

/**
 * Diff candidates against the previous manifest. Only files whose size or
 * mtime changed get content-read + rehashed; the rest are kept as-is.
 */
export function refreshManifest(
  root: string,
  prev: ManifestEntry[],
  candidates: DiscoveredFile[],
): { entries: ManifestEntry[]; changed: string[]; removed: string[] } {
  const prevMap = new Map(prev.map((e) => [e.path, e]));
  const entries: ManifestEntry[] = [];
  const changed: string[] = [];
  const now = new Date().toISOString();
  for (const c of candidates) {
    const old = prevMap.get(c.path);
    if (old && old.size === c.size && old.mtimeMs === c.mtimeMs) {
      entries.push(old);
    } else {
      entries.push({
        path: c.path,
        hash: contentHash(join(root, c.path)),
        size: c.size,
        mtimeMs: c.mtimeMs,
        updated: now,
      });
      changed.push(c.path);
    }
  }
  const removed = prev.map((e) => e.path).filter((p) => !candidates.some((c) => c.path === p));
  return { entries, changed, removed };
}

/** Build the markdown bundle from the manifest entries. */
export function buildProjectContext(root: string, entries: ManifestEntry[]): string {
  const sections = entries.map((e) => {
    let text = "";
    try {
      text = readFileSync(join(root, e.path), "utf8").trim();
    } catch {
      text = "";
    }
    return `## ${e.path}\n\n${text}\n`;
  });
  return (
    `# Project AI context\n\nDiscovered ${entries.length} file(s) from the project.\n\n` +
    sections.join("\n---\n\n")
  ).trimEnd() + "\n";
}

/**
 * Lazy sync: walk candidates, diff the manifest, and only rewrite the bundle
 * when something changed. Returns what happened.
 */
export function syncProjectContext(
  knowledgeRoot: string,
  target: string,
  extraIgnore: string[] = [],
  extraInclude: string[] = [],
): { changed: boolean; count: number; changedPaths: string[] } {
  const prev = loadProjectManifest(knowledgeRoot);
  const candidates = walkCandidates({
    root: target,
    ignore: extraIgnore,
    extraInclude,
  });
  const { entries, changed, removed } = refreshManifest(target, prev, candidates.files);
  const changedPaths = [...changed, ...removed];
  if (changedPaths.length > 0 || entries.length === 0) {
    saveProjectManifest(knowledgeRoot, entries);
    writeProjectContext(
      knowledgeRoot,
      entries.length > 0
        ? buildProjectContext(target, entries)
        : "# Project AI context\n\n(none discovered)\n",
    );
  }
  return { changed: changedPaths.length > 0, count: entries.length, changedPaths };
}

/** True when a previously written project context exists (used by boot). */
export function hasProjectContext(knowledgeRoot: string): boolean {
  return existsSync(projectContextPath(knowledgeRoot));
}
