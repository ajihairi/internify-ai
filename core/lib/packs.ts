import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

export interface PackEntry {
  name: string;
  origin: "bundled" | "external";
  source: string;
  hash: string;
  updated: string;
}

export interface Manifest {
  packs: PackEntry[];
}

export function manifestPath(skillsDir: string): string {
  return join(skillsDir, ".internify-packs.json");
}

export function readManifest(skillsDir: string): Manifest {
  const p = manifestPath(skillsDir);
  if (!existsSync(p)) return { packs: [] };
  try {
    const m = JSON.parse(readFileSync(p, "utf8")) as Manifest;
    return { packs: Array.isArray(m.packs) ? m.packs : [] };
  } catch {
    return { packs: [] };
  }
}

export function writeManifest(skillsDir: string, m: Manifest): void {
  writeFileSync(manifestPath(skillsDir), JSON.stringify(m, null, 2) + "\n");
}

/** Stable content hash of a directory (sorted path + bytes). */
export function hashDir(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else {
        h.update(relative(dir, p));
        h.update("\0");
        h.update(readFileSync(p));
        h.update("\0");
      }
    }
  };
  walk(dir);
  return h.digest("hex");
}

export interface PackAction {
  name: string;
  action: "create" | "update" | "skip" | "missing";
  reason: string;
}

/**
 * Decide what to do for each requested pack. Pure: given the installed manifest
 * entries and the resolved sources, no filesystem writes.
 */
export function planPackActions(
  names: string[],
  sources: { name: string; source: string; hash: string; origin: "bundled" | "external" }[],
  installed: Map<string, string>,
  force: boolean,
): PackAction[] {
  return names.map((name) => {
    const src = sources.find((s) => s.name === name);
    if (!src) return { name, action: "missing" as const, reason: "not found" };
    const current = installed.get(name);
    if (current === undefined) {
      return force
        ? { name, action: "create" as const, reason: "installing (force)" }
        : { name, action: "skip" as const, reason: "not installed (use --force)" };
    }
    if (current === src.hash && !force) {
      return { name, action: "skip" as const, reason: "up to date" };
    }
    return { name, action: "update" as const, reason: current === src.hash ? "identical (force)" : "changed" };
  });
}
