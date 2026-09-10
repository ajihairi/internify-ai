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
}

export function loadPaths(root: string): Paths {
  const abs = resolve(root);
  let knowledge = join(abs, KNOWLEDGE_DIR);
  let target = abs;
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
    } catch {
      // ignore malformed config; fall back to defaults
    }
  }
  return { root: abs, knowledge, target };
}
