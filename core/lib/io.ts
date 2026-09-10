import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { parseIndex, parseLedger, serializeIndex, serializeLedger, taskDir } from "./state";
import type { EvidenceRecord } from "./gates";
import type { IndexFile, Ledger, ManifestEntry } from "./types";

/**
 * All functions take `knowledgeRoot` — the directory that holds `state/`,
 * `daily/`, and `plans/` (default `<workspace>/.intern`).
 */

export function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

export function loadLedger(knowledgeRoot: string, taskId: string): Ledger | null {
  const p = join(taskDir(knowledgeRoot, taskId), "LEDGER.md");
  if (!existsSync(p)) return null;
  return parseLedger(readFileSync(p, "utf8"));
}

export function saveLedger(knowledgeRoot: string, ledger: Ledger) {
  const dir = taskDir(knowledgeRoot, ledger.taskId);
  ensureDir(dir);
  writeFileSync(join(dir, "LEDGER.md"), serializeLedger(ledger));
}

export function markRead(knowledgeRoot: string, taskId: string, relPath: string): boolean {
  const ledger = loadLedger(knowledgeRoot, taskId);
  if (!ledger) return false;
  let changed = false;
  for (const r of ledger.requiredReads) {
    if (!r.read && r.path === relPath) {
      r.read = true;
      changed = true;
    }
  }
  if (changed) {
    ledger.updated = new Date().toISOString();
    saveLedger(knowledgeRoot, ledger);
  }
  return changed;
}

export function saveIndex(knowledgeRoot: string, taskId: string, idx: IndexFile) {
  const dir = taskDir(knowledgeRoot, taskId);
  ensureDir(dir);
  writeFileSync(join(dir, "INDEX.md"), serializeIndex(idx));
}

export function readIndex(knowledgeRoot: string, taskId: string): IndexFile | null {
  const p = join(taskDir(knowledgeRoot, taskId), "INDEX.md");
  if (!existsSync(p)) return null;
  return parseIndex(readFileSync(p, "utf8"));
}

export function appendEvidence(knowledgeRoot: string, taskId: string, text: string) {
  const dir = taskDir(knowledgeRoot, taskId);
  ensureDir(dir);
  const p = join(dir, "EVIDENCE.md");
  const prev = existsSync(p) ? readFileSync(p, "utf8") : "# EVIDENCE\n";
  writeFileSync(p, prev.trimEnd() + "\n\n" + text + "\n");
}

export function readEvidence(knowledgeRoot: string, taskId: string): EvidenceRecord[] {  const p = join(taskDir(knowledgeRoot, taskId), "EVIDENCE.md");
  if (!existsSync(p)) return [];
  const out: EvidenceRecord[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^##\s+(\S+)\s+.*result=(pass|fail)/);
    if (m) out.push({ step: m[1], result: m[2] as "pass" | "fail" });
  }
  return out;
}

export function activePath(knowledgeRoot: string) {
  return join(knowledgeRoot, "state", "active.json");
}

export function setActive(knowledgeRoot: string, taskId: string, specRoot: string) {
  ensureDir(join(knowledgeRoot, "state"));
  writeFileSync(
    activePath(knowledgeRoot),
    JSON.stringify({ taskId, specRoot }, null, 2) + "\n",
  );
}

export function getActive(
  knowledgeRoot: string,
): { taskId: string; specRoot: string } | null {
  const p = activePath(knowledgeRoot);
  if (!existsSync(p)) return null;
  try {
    const obj = JSON.parse(readFileSync(p, "utf8")) as unknown;
    if (typeof obj !== "object" || obj === null) return null;
    const a = obj as Record<string, unknown>;
    if (typeof a.taskId !== "string" || typeof a.specRoot !== "string") return null;
    return { taskId: a.taskId, specRoot: a.specRoot };
  } catch {
    return null;
  }
}

export function appendDaily(knowledgeRoot: string, text: string, dailyRoot?: string): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const name = `${dd}-${mm}-${yyyy}.md`;
  const dir = dailyRoot ?? join(knowledgeRoot, "daily");
  ensureDir(dir);
  const p = join(dir, name);
  const prev = existsSync(p)
    ? readFileSync(p, "utf8")
    : `# Daily Log — ${dd} ${mm} ${yyyy}\n`;
  writeFileSync(p, prev.trimEnd() + "\n\n" + text + "\n");
  return name;
}

export function listDaily(knowledgeRoot: string, dailyRoot?: string): string[] {
  const dir = dailyRoot ?? join(knowledgeRoot, "daily");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{1,2}-\d{2}-\d{4}\.md$/.test(f));
}

export function listSpecs(knowledgeRoot: string, plansRoot?: string): string[] {
  const base = plansRoot ?? join(knowledgeRoot, "plans");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (d: string, depth: number, base: string) => {
    if (depth > 3) return;
    for (const e of readdirSync(d)) {
      if (e.startsWith("_")) continue; // skip _template etc.
      const p = join(d, e);
      if (statSync(p).isDirectory()) {
        out.push(relative(base, p));
        walk(p, depth + 1, base);
      }
    }
  };
  walk(base, 0, base);
  return out;
}

export function writeContext(knowledgeRoot: string, text: string) {
  ensureDir(join(knowledgeRoot, "state"));
  writeFileSync(join(knowledgeRoot, "state", "CONTEXT.md"), text);
}

export function projectStateDir(knowledgeRoot: string): string {
  return join(knowledgeRoot, "state");
}

export function projectManifestPath(knowledgeRoot: string): string {
  return join(projectStateDir(knowledgeRoot), "project-files.json");
}

export function projectContextPath(knowledgeRoot: string): string {
  return join(projectStateDir(knowledgeRoot), "PROJECT_CONTEXT.md");
}

export function loadProjectManifest(knowledgeRoot: string): ManifestEntry[] {
  const p = projectManifestPath(knowledgeRoot);
  if (!existsSync(p)) return [];
  try {
    const obj = JSON.parse(readFileSync(p, "utf8")) as unknown;
    if (Array.isArray(obj)) return obj as ManifestEntry[];
  } catch {
    /* malformed → treat as empty */
  }
  return [];
}

export function saveProjectManifest(knowledgeRoot: string, entries: ManifestEntry[]) {
  ensureDir(projectStateDir(knowledgeRoot));
  writeFileSync(projectManifestPath(knowledgeRoot), JSON.stringify(entries, null, 2) + "\n");
}

export function readProjectContext(knowledgeRoot: string): string | null {
  const p = projectContextPath(knowledgeRoot);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function writeProjectContext(knowledgeRoot: string, text: string) {
  ensureDir(projectStateDir(knowledgeRoot));
  writeFileSync(projectContextPath(knowledgeRoot), text);
}
