import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { KNOWLEDGE_DIR, parseLedger, serializeLedger, taskDir } from "./state";
import type { EvidenceRecord } from "./gates";
import type { IndexFile, Ledger } from "./types";

export function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

export function loadLedger(repoRoot: string, taskId: string): Ledger | null {
  const p = join(taskDir(repoRoot, taskId), "LEDGER.md");
  if (!existsSync(p)) return null;
  return parseLedger(readFileSync(p, "utf8"));
}

export function saveLedger(repoRoot: string, ledger: Ledger) {
  const dir = taskDir(repoRoot, ledger.taskId);
  ensureDir(dir);
  writeFileSync(join(dir, "LEDGER.md"), serializeLedger(ledger));
}

export function saveIndex(repoRoot: string, taskId: string, idx: IndexFile) {
  const dir = taskDir(repoRoot, taskId);
  ensureDir(dir);
  writeFileSync(join(dir, "INDEX.md"), JSON.stringify(idx, null, 2) + "\n");
}

export function appendEvidence(repoRoot: string, taskId: string, text: string) {
  const dir = taskDir(repoRoot, taskId);
  ensureDir(dir);
  const p = join(dir, "EVIDENCE.md");
  const prev = existsSync(p) ? readFileSync(p, "utf8") : "# EVIDENCE\n";
  writeFileSync(p, prev.trimEnd() + "\n\n" + text + "\n");
}

export function readEvidence(repoRoot: string, taskId: string): EvidenceRecord[] {
  const p = join(taskDir(repoRoot, taskId), "EVIDENCE.md");
  if (!existsSync(p)) return [];
  const out: EvidenceRecord[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^##\s+(\S+)\s+.*result=(pass|fail)/);
    if (m) out.push({ step: m[1], result: m[2] as "pass" | "fail" });
  }
  return out;
}

export function activePath(repoRoot: string) {
  return join(repoRoot, KNOWLEDGE_DIR, "state", "active.json");
}

export function setActive(repoRoot: string, taskId: string, specRoot: string) {
  ensureDir(join(repoRoot, KNOWLEDGE_DIR, "state"));
  writeFileSync(
    activePath(repoRoot),
    JSON.stringify({ taskId, specRoot }, null, 2) + "\n",
  );
}

export function getActive(
  repoRoot: string,
): { taskId: string; specRoot: string } | null {
  const p = activePath(repoRoot);
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

export function appendDaily(repoRoot: string, text: string): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const name = `${dd}-${mm}-${yyyy}.md`;
  const dir = join(repoRoot, KNOWLEDGE_DIR, "daily");
  ensureDir(dir);
  const p = join(dir, name);
  const prev = existsSync(p)
    ? readFileSync(p, "utf8")
    : `# Daily Log — ${dd} ${mm} ${yyyy}\n`;
  writeFileSync(p, prev.trimEnd() + "\n\n" + text + "\n");
  return name;
}

export function listDaily(repoRoot: string): string[] {
  const dir = join(repoRoot, KNOWLEDGE_DIR, "daily");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{1,2}-\d{2}-\d{4}\.md$/.test(f));
}

export function listSpecs(repoRoot: string): string[] {
  const base = join(repoRoot, KNOWLEDGE_DIR, "plans");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 3) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) {
        out.push(relative(repoRoot, p));
        walk(p, depth + 1);
      }
    }
  };
  walk(base, 0);
  return out;
}

export function writeContext(repoRoot: string, text: string) {
  ensureDir(join(repoRoot, KNOWLEDGE_DIR, "state"));
  writeFileSync(join(repoRoot, KNOWLEDGE_DIR, "state", "CONTEXT.md"), text);
}
