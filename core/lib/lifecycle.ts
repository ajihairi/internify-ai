import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadActiveTasks, saveActiveTasks, loadLedger, type ActiveTask } from "./io";

/** Remove one task entry from active.json. Promotes first remaining entry to
 * primary if the removed one was primary. Multi-task safe: other entries stay. */
export function removeActiveTask(knowledgeRoot: string, taskId: string): ActiveTask[] {
  const all = loadActiveTasks(knowledgeRoot);
  const rest = all.filter((t) => t.taskId !== taskId);
  if (rest.length === all.length) return rest;
  const wasPrimary = all.find((t) => t.taskId === taskId)?.primary === true;
  const next =
    wasPrimary && rest.length > 0
      ? rest.map((t, i) => ({ ...t, primary: i === 0 }))
      : rest;
  saveActiveTasks(knowledgeRoot, next);
  return next;
}

export interface PruneResult {
  pruned: string[];
  kept: ActiveTask[];
}

/** Drop active.json entries whose task ledger is missing or unparseable.
 * Rewrites active.json only when something was pruned. Promotes first kept
 * entry to primary if the pruned one held primary. */
export function pruneActiveTasks(knowledgeRoot: string): PruneResult {
  const all = loadActiveTasks(knowledgeRoot);
  const kept: ActiveTask[] = [];
  const pruned: string[] = [];
  let primaryPruned = false;
  for (const t of all) {
    if (loadLedger(knowledgeRoot, t.taskId) !== null) {
      kept.push(t);
    } else {
      pruned.push(t.taskId);
      if (t.primary) primaryPruned = true;
    }
  }
  if (pruned.length === 0) return { pruned, kept };
  const next =
    primaryPruned && kept.length > 0
      ? kept.map((t, i) => ({ ...t, primary: i === 0 }))
      : kept;
  saveActiveTasks(knowledgeRoot, next);
  return { pruned, kept: next };
}

export interface DailyResolveResult {
  files: string[];
  checked: number;
}

/** Flip `- [ ]` to `- [x]` for checklist items whose text contains `[#taskId]`
 * (tag position free) across every .md file in dailyDir. Files that cannot be
 * read/written are skipped. Untagged items are never touched. */
export function resolveDailyChecklists(
  dailyDir: string,
  taskId: string,
): DailyResolveResult {
  if (!existsSync(dailyDir)) return { files: [], checked: 0 };
  const tag = `[#${taskId}]`;
  const files: string[] = [];
  let checked = 0;
  let names: string[] = [];
  try {
    names = readdirSync(dailyDir);
  } catch {
    return { files: [], checked: 0 };
  }
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const abs = join(dailyDir, name);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (!content.includes(tag)) continue;
    let fileChecked = 0;
    const next = content.split("\n").map((line) => {
      const m = line.match(/^(\s*[-*]\s+)\[ \](\s+.*)$/);
      if (!m || !m[2].includes(tag)) return line;
      fileChecked++;
      return `${m[1]}[x]${m[2]}`;
    });
    if (fileChecked === 0) continue;
    try {
      writeFileSync(abs, next.join("\n"));
      files.push(name);
      checked += fileChecked;
    } catch {
      continue;
    }
  }
  return { files, checked };
}
