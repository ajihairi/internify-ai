#!/usr/bin/env bun
/**
 * Claude Code PostToolUse hook for internify: mark a file as read.
 * Wired by `internify init --tool claude`.
 */

import { isAbsolute, join, relative } from "node:path";
import { loadPaths } from "../../core/lib/config";
import { getActive, markRead } from "../../core/lib/io";

const root = process.env.INTERNIFY_ROOT || process.cwd();
if (process.env.INTERN_HARNESS === "off") process.exit(0);
const { knowledge } = loadPaths(root);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

let input: Record<string, unknown> = {};
try {
  const raw = await readStdin();
  input = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
} catch {
  input = {};
}

const ti = (input.tool_input as Record<string, unknown>) ?? {};
const filePath = ti.file_path ?? ti.path;
if (typeof filePath === "string") {
  const abs = isAbsolute(filePath) ? filePath : join(root, filePath);
  const rel = relative(root, abs).split("\\").join("/");
  const active = getActive(knowledge);
  if (active) markRead(knowledge, active.taskId, rel);
}

process.exit(0);
