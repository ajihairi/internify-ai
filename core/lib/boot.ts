import { KNOWLEDGE_DIR } from "./state";
import type { Ledger } from "./types";

export function parseDailyDate(name: string): Date | null {
  const m = name.match(/^(\d{1,2})-(\d{2})-(\d{4})\.md$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

export function pickLatestDaily(names: string[]): string | null {
  const dated = names
    .map((n) => ({ n, d: parseDailyDate(n) }))
    .filter((x): x is { n: string; d: Date } => x.d !== null)
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return dated[0]?.n ?? null;
}

export function extractSummary(md: string): string {
  const m = md.match(
    /##\s+Summary\s*\n([\s\S]*?)(?:\n##\s|\n---\s*\n|\n---\s*$|$)/,
  );
  if (!m) return "";
  return m[1].trim().split("\n\n")[0].trim();
}

export interface BootInput {
  generated: string;
  latestDaily: string | null;
  dailySummary: string;
  ledger: Ledger | null;
  specs: string[];
}

export function buildContextPack(input: BootInput): string {
  const active = input.ledger
    ? `- task: ${input.ledger.taskId} | phase: ${input.ledger.phase} | step: ${input.ledger.activeStep ?? "(none)"}\n` +
      `- pending reads: ${input.ledger.requiredReads.filter((r) => r.required !== false && !r.read).map((r) => r.path).join(", ") || "(none)"}`
    : "- (no active task)";
  return [
    "# CONTEXT — session pack",
    `generated: ${input.generated}`,
    "",
    "## Rules",
    `- ${KNOWLEDGE_DIR}/rules.md (loaded via AGENTS.md)`,
    "",
    "## Last daily",
    `- file: ${KNOWLEDGE_DIR}/daily/${input.latestDaily ?? "(none)"}`,
    `- summary: ${input.dailySummary || "(none)"}`,
    "",
    "## Active task",
    active,
    "",
    "## Available specs",
    input.specs.map((s) => `- ${s}`).join("\n") || "- (none)",
    "",
    "## Next actions",
    "- Continue the active step, start a new spec via /work, or discuss/bugfix.",
    "",
  ].join("\n");
}
