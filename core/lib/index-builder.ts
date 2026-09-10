import { readFileSync, existsSync, readdirSync, statSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve, isAbsolute } from "node:path";
import type { Anchor, IndexFile, RequiredRead, Slice } from "./types";
import { nowIso } from "./state";
import { isRequiredRead, parseStatus } from "./status";

const REF_RE = /`([^`\n]+?\.(?:swift|md|strings|json|ts|tsx|js|jsx|kt|java|py|go|rs|rb))`/g;

const SYMBOL_RE =
  /^\s*(?:public\s+|private\s+|internal\s+|protected\s+|static\s+|final\s+|export\s+(?:default\s+)?)*(?:func|function|def|class|struct|enum|interface|trait|type|const|let|var)\s+([A-Za-z_]\w*)/;

export function extractRefs(text: string): string[] {
  const out = new Set<string>();
  REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(text)) !== null) out.add(m[1].trim());
  return [...out];
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findSymbol(text: string): { token: string; line: number } {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SYMBOL_RE);
    if (m) return { token: m[1], line: i + 1 };
  }
  return { token: "", line: 0 };
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

function within(root: string, abs: string): boolean {
  const rel = relative(resolve(root), resolve(abs));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Scan a spec folder and build an index.
 *
 * @param specRoot absolute path to the spec folder (under the knowledge dir)
 * @param root     workspace root — read paths are stored relative to this
 * @param target   project root — code refs are resolved against this (default root)
 */
export function buildIndex(
  specRoot: string,
  root: string,
  target: string = root,
): IndexFile {
  if (!existsSync(specRoot) || !statSync(specRoot).isDirectory()) {
    throw new Error(`specRoot is not a directory: ${specRoot}`);
  }
  const requiredReads: RequiredRead[] = [];
  const anchors: Anchor[] = [];
  const slices: Slice[] = [];
  const specFiles = listMd(specRoot);

  const addAnchor = (file: string, status: Anchor["status"], token = "", line = 0) => {
    if (anchors.some((a) => a.file === file)) return;
    const prefix = status === "unresolved" ? "U" : "A";
    anchors.push({
      id: `${prefix}${anchors.length + 1}`,
      file,
      line,
      token,
      status,
    });
  };

  for (const f of specFiles) {
    const rel = relative(root, f);
    const text = readFileSync(f, "utf8");
    const status = parseStatus(text);
    requiredReads.push({
      key: rel.split("/").pop() ?? rel,
      path: rel,
      kind: "spec",
      hash: hashFile(f),
      read: false,
      status: status ?? undefined,
      required: isRequiredRead(status),
    });
    for (const ref of extractRefs(text)) {
      const abs = resolve(target, ref);
      const ok =
        within(target, abs) && existsSync(abs) && statSync(abs).isFile();
      if (!ok) {
        addAnchor(ref, "unresolved");
        continue;
      }
      const rrel = relative(root, abs);
      if (!requiredReads.some((r) => r.path === rrel)) {
        requiredReads.push({
          key: rrel.split("/").pop() ?? rrel,
          path: rrel,
          kind: "code",
          hash: hashFile(abs),
          read: false,
        });
      }
      const { token, line } = findSymbol(readFileSync(abs, "utf8"));
      addAnchor(ref, token ? "ok" : "stale", token, line);
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
