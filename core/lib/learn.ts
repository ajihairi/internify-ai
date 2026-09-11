import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { DEFAULT_SKIP_DIRS, isIgnoredPath, refreshManifest } from "./discover";
import {
  loadLearnManifest,
  saveLearnManifest,
  writeLearnIndex,
  writeLearnDigest,
} from "./io";
import type { ManifestEntry } from "./types";

export const LEARN_SKIP_DIRS = [...DEFAULT_SKIP_DIRS, "DerivedData", "xcuserdata"];

export interface LearnOptions {
  root: string;
  ignore?: string[];
  depth?: number;
}

export interface LearnSymbol {
  path: string;
  line: number;
  symbol: string;
  kind: "type" | "func" | "var";
}

export interface LearnModule {
  dir: string;
  files: number;
}

const LEARN_SYMBOL_RE =
  /^\s*(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+|static\s+|final\s+)*(?:(?:class|struct|enum|protocol|extension|typealias)\s+([A-Za-z_]\w*)|func\s+([A-Za-z_]\w*)|(?:let|var)\s+([A-Za-z_]\w*))/;

const IMPORT_RE = /^\s*import\s+([A-Za-z_][\w.]*)\s*$/;

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function walkSwift(root: string, ignore: string[] = []): string[] {
  const depth = 4;
  const out: string[] = [];
  const walk = (dir: string, level: number): void => {
    if (level > depth) return;
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = relative(root, abs).split("\\").join("/");
      if (isIgnoredPath(rel, ignore)) continue;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs, level + 1);
      else if (st.isFile() && rel.endsWith(".swift")) out.push(rel);
    }
  };
  walk(root, 0);
  return out;
}

export function extractSymbols(text: string): Omit<LearnSymbol, "path">[] {
  const out: Omit<LearnSymbol, "path">[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LEARN_SYMBOL_RE);
    if (!m) continue;
    if (m[1]) out.push({ line: i + 1, symbol: m[1], kind: "type" });
    else if (m[2]) out.push({ line: i + 1, symbol: m[2], kind: "func" });
    else if (m[3]) out.push({ line: i + 1, symbol: m[3], kind: "var" });
  }
  return out;
}

export function extractImports(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(IMPORT_RE);
    if (m) out.push(m[1]);
  }
  return out;
}

export function contentHash(abs: string): string {
  return hashText(readFileSync(abs, "utf8"));
}

export function buildIndexEntries(root: string, files: string[]): LearnSymbol[] {
  const out: LearnSymbol[] = [];
  for (const f of files) {
    const text = readFileSync(join(root, f), "utf8");
    for (const sym of extractSymbols(text)) out.push({ path: f, ...sym });
  }
  return out;
}

export function buildDigest(
  root: string,
  files: string[],
  symbols: LearnSymbol[],
): string {
  const modules = new Map<string, number>();
  const imports = new Map<string, Set<string>>();
  for (const f of files) {
    const d = f.split("/")[0] ?? f;
    modules.set(d, (modules.get(d) ?? 0) + 1);
    const text = readFileSync(join(root, f), "utf8");
    for (const imp of extractImports(text)) {
      if (!imports.has(d)) imports.set(d, new Set());
      imports.get(d)!.add(imp);
    }
  }
  const sections: string[] = [
    "# Code knowledge digest",
    "",
    `Modules (${modules.size}), symbols (${symbols.length}).`,
    "",
  ];
  for (const [dir, count] of [...modules.entries()].sort()) {
    sections.push(`## ${dir}`);
    sections.push("");
    sections.push(`Files: ${count}`);
    const imps = imports.get(dir);
    if (imps && imps.size > 0) {
      sections.push(`Imports: ${[...imps].sort().join(", ")}`);
    }
    sections.push("");
  }
  sections.push("## Where is X");
  sections.push("");
  const bySym = new Map<string, string[]>();
  for (const s of symbols) {
    if (!bySym.has(s.symbol)) bySym.set(s.symbol, []);
    bySym.get(s.symbol)!.push(`${s.path}:${s.line}`);
  }
  for (const [sym, locs] of [...bySym.entries()].sort()) {
    sections.push(`- \`${sym}\` → ${locs.join(", ")}`);
  }
  return sections.join("\n").trimEnd() + "\n";
}

export interface LearnSyncResult {
  changed: boolean;
  count: number;
  changedPaths: string[];
}

/** Compact summary for the boot context: module headings + stats, no symbols. */
export function buildDigestSummary(digest: string): string {
  const lines = digest.split("\n");
  const out: string[] = [];
  let inWhere = false;
  for (const line of lines) {
    if (/^## Where is X/.test(line)) break;
    if (inWhere) continue;
    if (/^## /.test(line)) out.push(line);
  }
  const stat = lines.find((l) => l.startsWith("Modules (")) ?? "";
  return [stat, "", ...out].filter(Boolean).join("\n").trim();
}

/**
 * Lazy sync: walk Swift files, diff against the learn manifest (size/mtime),
 * re-read only changed, and rewrite the index + digest only when something
 * changed. Manual-only — never called at boot.
 */
export function syncCodeKnowledge(
  knowledgeRoot: string,
  target: string,
  ignore: string[] = [],
): LearnSyncResult {
  const prev = loadLearnManifest(knowledgeRoot);
  const files = walkSwift(resolve(target), ignore);
  const candidates = files.map((path) => {
    const abs = join(resolve(target), path);
    const st = statSync(abs);
    return { path, hash: "", size: st.size, mtimeMs: st.mtimeMs };
  });
  const { entries, changed, removed } = refreshManifest(
    resolve(target),
    prev,
    candidates,
  );
  const changedPaths = [...changed, ...removed];
  if (changedPaths.length > 0 || entries.length === 0) {
    const active = entries.map((e) => e.path);
    const symbols = buildIndexEntries(resolve(target), active);
    saveLearnManifest(knowledgeRoot, entries);
    writeLearnIndex(knowledgeRoot, symbols as unknown[]);
    writeLearnDigest(
      knowledgeRoot,
      entries.length > 0
        ? buildDigest(resolve(target), active, symbols)
        : "# Code knowledge digest\n\n(no swift files)\n",
    );
  }
  return { changed: changedPaths.length > 0, count: entries.length, changedPaths };
}
