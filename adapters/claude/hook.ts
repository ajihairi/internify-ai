#!/usr/bin/env bun
/**
 * Claude Code PreToolUse hook for internify.
 *
 * Reads the hook payload on stdin, evaluates the same gates as the opencode
 * adapter, and exits 2 (block) with a reason on stderr when an action is not
 * allowed. Exits 0 otherwise.
 *
 * Wired by `internify init --tool claude`.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { getActive, loadLedger } from "../../core/lib/io";
import { loadPaths } from "../../core/lib/config";
import { canEdit, canBash } from "../../core/lib/gates";
import { parseStatus } from "../../core/lib/status";

const root = process.env.INTERNIFY_ROOT || process.cwd();

// Kill switch — same semantics as the opencode adapter.
if (process.env.INTERN_HARNESS === "off") process.exit(0);

const { knowledge } = loadPaths(root);

let input: Record<string, unknown> = {};
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
try {
  const raw = await readStdin();
  input = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
} catch {
  input = {};
}

const tool = typeof input.tool_name === "string" ? input.tool_name : "";
const ti = (input.tool_input as Record<string, unknown>) ?? {};

const active = getActive(knowledge);
if (!active) process.exit(0); // no task → nothing to enforce

const ledger = loadLedger(knowledge, active.taskId);
if (!ledger) {
  console.error(
    "BLOCKED: ledger corrupt or unreadable. Re-run internify index or fix the LEDGER.md.",
  );
  process.exit(2);
}

if (tool === "Bash") {
  const command = ti.command;
  if (typeof command === "string") {
    const d = canBash(root, ledger, command);
    if (!d.ok) {
      console.error(d.reason ?? "BLOCKED");
      process.exit(2);
    }
  }
  process.exit(0);
}

const filePath = ti.file_path ?? ti.path;
if (typeof filePath === "string") {
  let targetStatus: string | undefined;
  try {
    const abs = isAbsolute(filePath) ? filePath : join(root, filePath);
    if (existsSync(abs)) targetStatus = parseStatus(readFileSync(abs, "utf8")) ?? undefined;
  } catch {
    /* ignore */
  }
  const d = canEdit(root, ledger, filePath, { targetStatus });
  if (!d.ok) {
    console.error(d.reason ?? "BLOCKED");
    process.exit(2);
  }
}

process.exit(0);
