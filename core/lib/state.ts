import { join } from "node:path";
import { extractBlock, upsertBlock } from "./markdown";
import type { Ledger } from "./types";

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

/** Folder that holds internify knowledge + runtime state, relative to the root. */
export const KNOWLEDGE_DIR = ".intern";

export function knowledgeDir(repoRoot: string): string {
  return join(repoRoot, KNOWLEDGE_DIR);
}

export function stateRoot(repoRoot: string): string {
  return join(repoRoot, KNOWLEDGE_DIR, "state");
}

export function taskDir(repoRoot: string, taskId: string): string {
  return join(stateRoot(repoRoot), "tasks", taskId);
}
