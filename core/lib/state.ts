import { join } from "node:path";
import { extractBlock, upsertBlock } from "./markdown";
import type { IndexFile, Ledger } from "./types";

/** Default folder (relative to the workspace root) holding internify knowledge. */
export const KNOWLEDGE_DIR = ".intern";

export function slug(specRoot: string): string {
  const name = specRoot.replace(/\/+$/, "").split("/").pop() || "task";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function emptyLedger(
  taskId: string,
  specRoot: string,
  role = "UIUXEngineer",
): Ledger {
  return {
    taskId,
    specRoot,
    role,
    phase: "orient",
    scope: [],
    requiredReads: [],
    steps: [],
    decisions: [],
    openQuestions: [],
    activeStep: null,
    updated: nowIso(),
  };
}

export function serializeLedger(l: Ledger): string {
  const readRows = l.requiredReads
    .map((r) => `- [${r.read ? "x" : " "}] ${r.key} (${r.path}) @${r.hash.slice(0, 4)}`)
    .join("\n");
  const scopeRows = l.scope.map((s) => `- ${s}`).join("\n");
  const stepRows = l.steps
    .map((s) => `- [${s.done ? "x" : " "}] ${s.id} — ${s.title} (anchor ${s.anchor})`)
    .join("\n");
  const md = [
    `# LEDGER — ${l.taskId}`,
    `spec_root: ${l.specRoot}`,
    `role: ${l.role}`,
    `phase: ${l.phase}`,
    `updated: ${l.updated}`,
    "",
    "## Scope (allowed files)",
    scopeRows || "- (none)",
    "",
    "## Required reads",
    readRows || "- (none)",
    "",
    "## Plan steps",
    stepRows || "- (none)",
    "",
    "## Decisions",
    l.decisions.map((d) => `- ${d}`).join("\n") || "- (none)",
    "",
    "## Open questions",
    l.openQuestions.map((q) => `- ${q}`).join("\n") || "- (none)",
  ].join("\n");
  return upsertBlock(md + "\n", "ledger", l);
}

export function parseLedger(md: string): Ledger | null {
  const raw = extractBlock(md, "ledger");
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null) return null;
    const l = obj as Record<string, unknown>;
    if (typeof l.taskId !== "string" || typeof l.phase !== "string") return null;
    if (
      !Array.isArray(l.scope) ||
      !Array.isArray(l.steps) ||
      !Array.isArray(l.requiredReads)
    ) {
      return null;
    }
    return obj as Ledger;
  } catch {
    return null;
  }
}

export function serializeIndex(idx: IndexFile): string {
  const readRows = idx.requiredReads
    .map((r) => `| ${r.key} | \`${r.path}\` | ${r.kind} | \`${r.hash.slice(0, 8)}\` |`)
    .join("\n");
  const anchorRows = idx.anchors
    .map((a) => `| ${a.id} | \`${a.file}\` | ${a.line} | ${a.token || "-"} | ${a.status} |`)
    .join("\n");
  const sliceRows = idx.slices
    .map((s) => `| ${s.key} | \`${s.from}\` | ${s.selector} |`)
    .join("\n");
  const md = [
    `# INDEX — ${idx.specRoot}`,
    `spec_root: ${idx.specRoot}`,
    `generated: ${idx.generated}`,
    "",
    "## Required reads",
    "| key | path | kind | hash |",
    "|-----|------|------|------|",
    readRows || "| (none) | | | |",
    "",
    "## Anchors",
    "| id | file | line | token | status |",
    "|----|------|------|-------|--------|",
    anchorRows || "| (none) | | | | |",
    "",
    "## Slices",
    "| key | from | selector |",
    "|-----|------|----------|",
    sliceRows || "| (none) | | |",
  ].join("\n");
  return upsertBlock(md + "\n", "index", idx);
}

export function parseIndex(md: string): IndexFile | null {
  const raw = extractBlock(md, "index");
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null) return null;
    const i = obj as Record<string, unknown>;
    if (typeof i.specRoot !== "string") return null;
    if (
      !Array.isArray(i.requiredReads) ||
      !Array.isArray(i.anchors) ||
      !Array.isArray(i.slices)
    ) {
      return null;
    }
    return obj as IndexFile;
  } catch {
    return null;
  }
}

export function stateRoot(knowledgeRoot: string): string {
  return join(knowledgeRoot, "state");
}

export function taskDir(knowledgeRoot: string, taskId: string): string {
  return join(stateRoot(knowledgeRoot), "tasks", taskId);
}
