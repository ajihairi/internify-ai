import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve, isAbsolute } from "node:path";
import type { Anchor, IndexFile, RequiredRead, Slice } from "./types";
import { nowIso } from "./state";

const REF_RE = /`([^`\n]+?\.(?:swift|md|strings|json|ts))`/g;

export function extractRefs(text: string): string[] {
  REF_RE.lastIndex = 0;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(text)) !== null) out.add(m[1].trim());
  return [...out];
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listMd(dir: string, visited = new Set<string>()): string[] {
  const real = realpathSync(dir);
  if (visited.has(real)) return [];
  visited.add(real);
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...listMd(p, visited));
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

function withinRepo(repoRoot: string, abs: string): boolean {
  const rel = relative(resolve(repoRoot), resolve(abs));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export function buildIndex(specRoot: string, repoRoot: string): IndexFile {
  const requiredReads: RequiredRead[] = [];
  const anchors: Anchor[] = [];
  const slices: Slice[] = [];
  if (!existsSync(specRoot) || !statSync(specRoot).isDirectory()) {
    throw new Error(`specRoot is not a directory: ${specRoot}`);
  }
  const specFiles = listMd(specRoot);

  for (const f of specFiles) {
    const rel = relative(repoRoot, f);
    requiredReads.push({
      key: rel.split("/").pop() ?? rel,
      path: rel,
      kind: "spec",
      hash: hashFile(f),
      read: false,
    });
    const text = readFileSync(f, "utf8");
    for (const ref of extractRefs(text)) {
      const abs = resolve(repoRoot, ref);
      const ok =
        withinRepo(repoRoot, abs) &&
        existsSync(abs) &&
        statSync(abs).isFile();
      if (!ok) {
        if (!anchors.some((a) => a.file === ref)) {
          anchors.push({
            id: `U${anchors.length + 1}`,
            file: ref,
            line: 0,
            token: "",
            status: "unresolved",
          });
        }
        continue;
      }
      const rrel = relative(repoRoot, abs);
      if (!requiredReads.some((r) => r.path === rrel)) {
        requiredReads.push({
          key: rrel.split("/").pop() ?? rrel,
          path: rrel,
          kind: "code",
          hash: hashFile(abs),
          read: false,
        });
      }
    }
    let inFence = false;
    for (const line of text.split("\n")) {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const am = line.match(/^#{1,6}\s+(.+)$/);
      if (am) {
        slices.push({
          key: `slice-${slices.length + 1}`,
          from: rel,
          selector: am[1].trim(),
        });
      }
    }
  }

  return { specRoot, generated: nowIso(), requiredReads, anchors, slices };
}
