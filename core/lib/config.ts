import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { KNOWLEDGE_DIR } from "./state";

/**
 * Paths for a workspace.
 *
 * - `root`      workspace root (where internify.json / .intern live)
 * - `knowledge` where rules/plans/daily/state live (default `<root>/.intern`)
 * - `target`    where the project code lives (default `root`)
 *
 * Mode A (default): target == root, knowledge == root/.intern
 * Mode B: `internify.json` sets `target` (and optionally `knowledge`) so the
 * knowledge dir and the project can live side by side.
 */
export interface Paths {
  root: string;
  knowledge: string;
  target: string;
  /** Absolute path to the plans directory (default `<knowledge>/plans`). */
  plans: string;
  /** Absolute path to the daily log directory (default `<knowledge>/daily`). */
  daily: string;
  /** Extra AI-file includes (relative to target). */
  scan?: string[];
  /** Extra paths to skip during scan (relative to target). */
  scanIgnore?: string[];
}

export function loadPaths(root: string): Paths {
  const abs = resolve(root);
  let knowledge = join(abs, KNOWLEDGE_DIR);
  let target = abs;
  let plans = "";
  let daily = "";
  let scan: string[] | undefined;
  let scanIgnore: string[] | undefined;
  const cfg = join(abs, "internify.json");
  if (existsSync(cfg)) {
    try {
      const c = JSON.parse(readFileSync(cfg, "utf8")) as Record<string, unknown>;
      if (typeof c.knowledge === "string") {
        knowledge = isAbsolute(c.knowledge) ? c.knowledge : resolve(abs, c.knowledge);
      }
      if (typeof c.target === "string") {
        target = isAbsolute(c.target) ? c.target : resolve(abs, c.target);
      }
      if (typeof c.plansDir === "string") {
        plans = isAbsolute(c.plansDir) ? c.plansDir : resolve(knowledge, c.plansDir);
      }
      if (typeof c.dailyDir === "string") {
        daily = isAbsolute(c.dailyDir) ? c.dailyDir : resolve(knowledge, c.dailyDir);
      }
      if (Array.isArray(c.scan)) scan = (c.scan as unknown[]).filter((x) => typeof x === "string") as string[];
      if (Array.isArray(c.scanIgnore)) scanIgnore = (c.scanIgnore as unknown[]).filter((x) => typeof x === "string") as string[];
    } catch {
      // ignore malformed config; fall back to defaults
    }
  }
  if (!plans) plans = join(knowledge, "plans");
  if (!daily) daily = join(knowledge, "daily");
  return { root: abs, knowledge, target, plans, daily, scan, scanIgnore };
}
