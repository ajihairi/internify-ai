import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listDaily } from "./io";
import { extractSummary, parseDailyDate } from "./boot";

export interface DailyUnfinished {
  checkboxes: string[];
  openRows: string[];
  nextSteps: string[];
}

export interface LatestDaily {
  file: string | null;
  summary: string;
  unfinished: DailyUnfinished;
}

const NEXT_RE = /(next steps?|langkah berikutnya|action items?)/i;
const HEADER_CELL_RE = /^\*{0,2}(#|status|role|task|item|done|files|catatan)\*{0,2}$/i;

/**
 * Parse a daily log for unfinished markers, read-only.
 * Groups: `[ ]` checkboxes, table rows without ✅, and "Next steps" sections.
 */
export function parseDailyUnfinished(md: string): DailyUnfinished {
  const checkboxes: string[] = [];
  const openRows: string[] = [];
  const nextSteps: string[] = [];
  let inNext = false;

  for (const line of md.split("\n")) {
    const cb = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (cb) {
      if (cb[1] === " ") checkboxes.push(cb[2].trim());
      continue;
    }
    const table = line.match(/^\s*\|(.+)\|\s*$/);
    if (table) {
      const cells = table[1].split("|").map((c) => c.trim());
      if (cells.some((c) => /^:?-+:?$/.test(c))) continue; // separator
      if (cells.length === 0 || cells.every((c) => HEADER_CELL_RE.test(c))) continue; // header
      let end = cells.length;
      while (end > 0 && cells[end - 1] === "") end--;
      const joined = cells.slice(0, end).join(" | ");
      if (!joined.includes("✅")) openRows.push(joined);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      inNext = NEXT_RE.test(heading[1]);
      continue;
    }
    if (inNext) {
      const item = line.match(/^\s*(?:\d+[.)]\s+|[-*]\s+)?(.*)$/);
      const text = item?.[1]?.trim() ?? line.trim();
      if (text && !/^(---|\*)/.test(text)) nextSteps.push(text);
    }
  }

  return { checkboxes, openRows, nextSteps };
}

/** Render the unfinished groups for display in status output. */
export function formatDailyUnfinished(u: DailyUnfinished): string {
  const parts: string[] = [];
  if (u.checkboxes.length) {
    parts.push(`- checklists:`);
    for (const x of u.checkboxes) parts.push(`  - [ ] ${x}`);
  }
  if (u.openRows.length) {
    parts.push(`- open rows:`);
    for (const x of u.openRows) parts.push(`  - ${x}`);
  }
  if (u.nextSteps.length) {
    parts.push(`- next steps:`);
    for (const x of u.nextSteps) parts.push(`  - ${x}`);
  }
  return parts.length ? parts.join("\n") : "(none)";
}

/** Pick the `n` newest daily names, newest first. */
export function pickRecentDailies(names: string[], n: number): string[] {
  return [...names]
    .sort((a, b) => (parseDailyDate(b)?.getTime() ?? 0) - (parseDailyDate(a)?.getTime() ?? 0))
    .slice(0, n);
}

/**
 * Load the most recent daily(s) and their unfinished markers, merged newest
 * first. Reads only; never writes anything.
 */
export function loadLatestDaily(
  knowledgeRoot: string,
  dailyRoot?: string,
  max = 2,
): LatestDaily {
  const dir = dailyRoot ?? join(knowledgeRoot, "daily");
  const files = pickRecentDailies(listDaily(knowledgeRoot, dir), max);
  if (files.length === 0) {
    return { file: null, summary: "", unfinished: { checkboxes: [], openRows: [], nextSteps: [] } };
  }
  const merged: DailyUnfinished = { checkboxes: [], openRows: [], nextSteps: [] };
  for (const f of files) {
    const u = parseDailyUnfinished(readFileSync(join(dir, f), "utf8"));
    merged.checkboxes.push(...u.checkboxes);
    merged.openRows.push(...u.openRows);
    merged.nextSteps.push(...u.nextSteps);
  }
  const newest = files[0];
  return {
    file: newest,
    summary: extractSummary(readFileSync(join(dir, newest), "utf8")),
    unfinished: merged,
  };
}
