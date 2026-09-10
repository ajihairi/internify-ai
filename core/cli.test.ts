import { test, expect } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "cli.ts");

function run(args: string[], cwd: string) {
  const p = Bun.spawnSync([process.execPath, CLI, ...args], {
    cwd,
    env: { ...process.env, INTERNIFY_ROOT: cwd },
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

function tmp() {
  return mkdtempSync(join(tmpdir(), "internify-cli-"));
}

test("cli: skills list", () => {
  const r = run(["skills", "list"], import.meta.dir);
  expect(r.code).toBe(0);
});

test("cli: help", () => {
  const r = run(["--help"], import.meta.dir);
  expect(r.code).toBe(0);
  expect(r.out).toContain("internify");
});

test("cli: init scaffolds knowledge + commands", () => {
  const ws = tmp();
  const r = run(["init", "--tool", "opencode", "--yes"], ws);
  expect(r.code).toBe(0);
  expect(existsSync(join(ws, ".intern", "rules.md"))).toBe(true);
  expect(existsSync(join(ws, "AGENTS.md"))).toBe(true);
  expect(existsSync(join(ws, ".opencode", "command", "internify.work.md"))).toBe(true);
});

test("cli: commands generate for gemini", () => {
  const ws = tmp();
  const r = run(["commands", "generate", "--providers", "gemini"], ws);
  expect(r.code).toBe(0);
  expect(existsSync(join(ws, ".gemini", "commands", "internify.work.toml"))).toBe(true);
});

test("cli: doctor on a fresh workspace", () => {
  const ws = tmp();
  const r = run(["doctor"], ws);
  expect(r.out).toContain("workspace root");
});
