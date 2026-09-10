import { isAbsolute, join, relative } from "node:path";
import type { Ledger } from "./types";

export interface Decision {
  ok: boolean;
  reason?: string;
}

export interface EvidenceRecord {
  step: string;
  result: "pass" | "fail";
}

function toRel(root: string, p: string): string {
  const abs = isAbsolute(p) ? p : join(root, p);
  return relative(root, abs).split("\\").join("/").replace(/\/+$/, "");
}

function inScope(root: string, filePath: string, scope: string[]): boolean {
  const file = toRel(root, filePath);
  if (!file || file.startsWith("..")) return false;
  return scope.some((raw) => {
    if (!raw) return false;
    const s = toRel(root, raw);
    return file === s || file.startsWith(s + "/");
  });
}

export function canEdit(repoRoot: string, ledger: Ledger, filePath: string): Decision {
  if (ledger.forceAllow) return { ok: true };
  if (ledger.phase !== "planned" && ledger.phase !== "acting") {
    return {
      ok: false,
      reason: `BLOCKED: cannot edit in phase "${ledger.phase}". Declare a step via intern_step.`,
    };
  }
  const unread = ledger.requiredReads.filter((r) => !r.read);
  if (unread.length > 0) {
    return {
      ok: false,
      reason: `BLOCKED: ground first. Read: ${unread.map((r) => r.path).join(", ")}`,
    };
  }
  if (!ledger.activeStep) {
    return { ok: false, reason: "BLOCKED: no active step. Declare a step first." };
  }
  if (!inScope(repoRoot, filePath, ledger.scope)) {
    return { ok: false, reason: `BLOCKED: file outside task scope: ${filePath}` };
  }
  return { ok: true };
}

export function canStep(ledger: Ledger, anchor: string): Decision {
  if (ledger.requiredReads.some((r) => !r.read)) {
    return { ok: false, reason: "BLOCKED: finish the required reads first." };
  }
  if (!anchor) return { ok: false, reason: "BLOCKED: anchor is required." };
  return { ok: true };
}

export function canClose(ledger: Ledger, evidence: EvidenceRecord[]): Decision {
  if (ledger.steps.length === 0) {
    return { ok: false, reason: "BLOCKED: no plan steps." };
  }
  const missing = ledger.steps.filter(
    (s) => !evidence.some((e) => e.step === s.id && e.result === "pass"),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `BLOCKED: no passing evidence for step(s): ${missing.map((s) => s.id).join(", ")}`,
    };
  }
  return { ok: true };
}
