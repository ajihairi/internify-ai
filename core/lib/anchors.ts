import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { IndexFile } from "./types";

/** Re-check every anchor status against the file on disk (hash vs token).
 * Mutates idx.anchors in place; returns how many statuses changed. */
export function refreshAnchorStatuses(root: string, idx: IndexFile): number {
  let changed = 0;
  for (const anchor of idx.anchors) {
    const abs = join(root, anchor.file);
    if (!existsSync(abs)) {
      if (anchor.status !== "unresolved") {
        anchor.status = "unresolved";
        changed++;
      }
    } else {
      const content = readFileSync(abs);
      const hash = createHash("sha256").update(content).digest("hex").slice(0, 8);
      const expected = anchor.token || hash;
      if (hash !== expected) {
        if (anchor.status !== "stale") {
          anchor.status = "stale";
          changed++;
        }
      } else {
        if (anchor.status !== "ok") {
          anchor.status = "ok";
          changed++;
        }
      }
    }
  }
  return changed;
}
