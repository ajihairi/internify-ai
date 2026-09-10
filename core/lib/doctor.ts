import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Paths } from "./config";
import { getActive, loadLedger, readIndex } from "./io";

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

  const active = getActive(paths.knowledge);
  if (!active) {
    add("active task", true, "none", "ok");
  } else {
    const ledger = loadLedger(paths.knowledge, active.taskId);
    if (!ledger) {
      add("active task", false, `corrupt/missing ledger: ${active.taskId}`, "error");
    } else {
      const idx = readIndex(paths.knowledge, active.taskId);
      const pending = ledger.requiredReads.filter((r) => r.required !== false && !r.read).length;
      add(
        "active task",
        !!idx,
        `${ledger.taskId} · phase=${ledger.phase} · pending reads=${pending}${idx ? "" : " (INDEX missing)"}`,
        idx ? "ok" : "warn",
      );
    }
  }

  return checks;
}

export function configPath(root: string): string {
  return join(root, "internify.json");
}
