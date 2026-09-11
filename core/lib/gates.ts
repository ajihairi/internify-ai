import { isAbsolute, join, relative } from "node:path";
import type { Anchor, Ledger } from "./types";

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

export interface EditOptions {
  /** Status of the target document (from its frontmatter), if known. */
  targetStatus?: string;
}

export function canEdit(
  repoRoot: string,
  ledger: Ledger,
  filePath: string,
  opts: EditOptions = {},
): Decision {
  if (ledger.forceAllow) return { ok: true };
  // Finished tasks let their files stay editable (authoring/tweaks after close).
  if (ledger.phase === "done") return { ok: true };
  if (ledger.phase !== "planned" && ledger.phase !== "acting") {
    return {
      ok: false,
      reason: `BLOCKED: cannot edit in phase "${ledger.phase}". Declare a step via intern_step.`,
    };
  }
  const unread = ledger.requiredReads.filter((r) => r.required !== false && !r.read);
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
  if (opts.targetStatus === "fixed") {
    return {
      ok: false,
      reason: `BLOCKED: ${filePath} is a fixed document (source of truth). Change its status or use intern_override.`,
    };
  }
  return { ok: true };
}

/**
 * Verify an anchor before entering the plan.
 * - the anchor must be one declared by a plan step, and
 * - if the index knows it, its status must be `ok`.
 */
export function canStep(
  ledger: Ledger,
  anchor: string,
  anchors: Anchor[] = [],
): Decision {
  if (ledger.requiredReads.some((r) => r.required !== false && !r.read)) {
    return { ok: false, reason: "BLOCKED: finish the required reads first." };
  }
  if (!anchor) return { ok: false, reason: "BLOCKED: anchor is required." };
  if (!ledger.steps.some((s) => s.anchor === anchor)) {
    return {
      ok: false,
      reason: `BLOCKED: anchor "${anchor}" is not a declared plan anchor.`,
    };
  }
  const known = anchors.find((a) => a.id === anchor);
  if (known && known.status !== "ok") {
    return {
      ok: false,
      reason: `BLOCKED: anchor ${anchor} is ${known.status}. Re-run intern_index.`,
    };
  }
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

/** Does a shell command look like it writes to the filesystem? */
export function bashWrites(command: string): boolean {
  return (
    /(^|\s)(>>?|tee\b|sed\s+-i|mv\b|cp\b|rm\b|dd\b|truncate\b|install\b|ln\b)/.test(
      command,
    ) || /(^|\s)>/.test(command)
  );
}

/**
 * Gate the `bash` tool. Non-writing commands pass. Writing commands are only
 * allowed when a step is active and the command references a file in scope
 * (or an override is in force).
 */
export function canBash(
  repoRoot: string,
  ledger: Ledger,
  command: string,
): Decision {
  if (ledger.forceAllow) return { ok: true };
  if (!bashWrites(command)) return { ok: true };
  if (ledger.phase !== "planned" && ledger.phase !== "acting") {
    return {
      ok: false,
      reason: "BLOCKED: bash write before a step. Declare a step via intern_step.",
    };
  }
  const mentionsScope = ledger.scope.some((s) => command.includes(s));
  if (!mentionsScope) {
    return {
      ok: false,
      reason:
        "BLOCKED: bash write does not reference a file in scope. Prefer the edit/write tools.",
    };
  }
  return { ok: true };
}
