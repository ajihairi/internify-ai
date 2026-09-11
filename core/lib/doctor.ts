import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Paths } from "./config";
import { loadActiveTasks, loadLedger, readIndex } from "./io";

export interface Check {
  name: string;
  ok: boolean;
  level: "ok" | "warn" | "error";
  detail: string;
}

function hasBun(): boolean {
  return typeof (globalThis as Record<string, unknown>).Bun !== "undefined";
}

/** Environment + state health checks. Errors mean "not ready". */
export function doctorChecks(paths: Paths): Check[] {
  const checks: Check[] = [];
  const add = (
    name: string,
    ok: boolean,
    detail: string,
    level: Check["level"] = ok ? "ok" : "error",
  ) => checks.push({ name, ok, level, detail });

  add("bun runtime", hasBun(), hasBun() ? "available" : "run internify with Bun", hasBun() ? "ok" : "warn");
  add("workspace root", existsSync(paths.root), paths.root);
  add(
    "knowledge dir",
    existsSync(paths.knowledge),
    existsSync(paths.knowledge) ? paths.knowledge : `${paths.knowledge} (run internify init)`,
    existsSync(paths.knowledge) ? "ok" : "warn",
  );
  add(
    "plans dir",
    existsSync(paths.plans),
    existsSync(paths.plans) ? paths.plans : `${paths.plans} (no plans yet)`,
    existsSync(paths.plans) ? "ok" : "warn",
  );

  const all = loadActiveTasks(paths.knowledge);
  if (all.length === 0) {
    add("active tasks", true, "none", "ok");
  } else {
    for (const t of all) {
      const ledger = loadLedger(paths.knowledge, t.taskId);
      if (!ledger) {
        add(`task ${t.taskId}${t.primary ? " (focus)" : ""}`, false, `corrupt/missing ledger`, "error");
        continue;
      }
      const idx = readIndex(paths.knowledge, t.taskId);
      const pending = ledger.requiredReads.filter((r) => r.required !== false && !r.read).length;
      add(
        `task ${t.taskId}${t.primary ? " (focus)" : ""}`,
        !!idx,
        `phase=${ledger.phase} · pending reads=${pending}${idx ? "" : " (INDEX missing)"}`,
        idx ? "ok" : "warn",
      );
    }
  }

  return checks;
}

export function configPath(root: string): string {
  return join(root, "internify.json");
}
