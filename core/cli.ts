#!/usr/bin/env bun
/**
 * internify CLI — tool-agnostic entry point over core/lib.
 *
 * Usage:
 *   internify boot
 *   internify index <spec-folder>
 *   internify read <path>
 *   internify context <path> <selector> [--kind section|function]
 *   internify step <id> <anchor>
 *   internify evidence <step> --claim <c> --proof <p> --result pass|fail
 *   internify close
 *   internify status
 *   internify override <reason>
 *   internify gate edit <file>
 *   internify gate bash "<command>"
 *
 * Workspace root = cwd, or INTERNIFY_ROOT. Knowledge dir defaults to
 * <root>/.intern; override both root and target via <root>/internify.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { buildIndex } from "./lib/index-builder";
import { canEdit, canStep, canClose, canBash } from "./lib/gates";
import { sliceFunction, sliceSection } from "./lib/context";
import { loadPaths } from "./lib/config";
import { parseStatus } from "./lib/status";
import {
  commandFileName,
  getProvider,
  providerNames,
  renderCommand,
} from "./lib/providers";
import { slug, emptyLedger, nowIso } from "./lib/state";
import {
  loadLedger,
  saveLedger,
  saveIndex,
  readIndex,
  appendEvidence,
  readEvidence,
  setActive,
  getActive,
  appendDaily,
  listDaily,
  listSpecs,
  writeContext,
} from "./lib/io";
import { buildContextPack, extractSummary, pickLatestDaily } from "./lib/boot";

const root = process.env.INTERNIFY_ROOT
  ? resolve(process.env.INTERNIFY_ROOT)
  : process.cwd();
const { knowledge, target, plans, daily } = loadPaths(root);

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function toRel(p: string): string {
  return relative(root, isAbsolute(p) ? p : join(root, p)).split("\\").join("/");
}

function inRepo(rel: string): boolean {
  return rel.length > 0 && !rel.startsWith("..");
}

function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1] ?? "true";
      i++;
    }
  }
  return out;
}

function cmdBoot(): void {
  const dailies = listDaily(knowledge, daily);
  const latest = pickLatestDaily(dailies);
  let dailyText = "";
  if (latest) {
    try {
      dailyText = readFileSync(join(knowledge, "daily", latest), "utf8");
    } catch {
      dailyText = "";
    }
  }
  const active = getActive(knowledge);
  const ledger = active ? loadLedger(knowledge, active.taskId) : null;
  const pack = buildContextPack({
    generated: nowIso(),
    latestDaily: latest,
    dailySummary: extractSummary(dailyText),
    ledger,
    specs: listSpecs(knowledge, plans),
  });
  writeContext(knowledge, pack);
  console.log(pack);
}

function cmdIndex(specArg: string): void {
  if (!specArg) fail("usage: internify index <spec-folder>");
  const rel = toRel(specArg);
  if (!inRepo(rel)) fail(`specRoot outside repo: ${specArg}`);
  const taskId = slug(rel);
  const idx = buildIndex(join(root, rel), root, target);
  saveIndex(knowledge, taskId, idx);
  const ledger = loadLedger(knowledge, taskId) ?? emptyLedger(taskId, rel);
  ledger.requiredReads = idx.requiredReads.map((r) => ({ ...r, read: false }));
  ledger.scope = idx.requiredReads.map((r) => r.path);
  if (ledger.scope.length === 0) ledger.scope = [rel];
  if (ledger.steps.length === 0) {
    ledger.steps = idx.slices.slice(0, 5).map((s, i) => ({
      id: `S${i + 1}`,
      title: s.selector,
      anchor: idx.anchors[i]?.id ?? s.key,
      done: false,
    }));
  }
  ledger.phase = "orient";
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  setActive(knowledge, taskId, rel);
  console.log(`INDEX built. task=${taskId} reads=${idx.requiredReads.length}`);
}

function cmdRead(pathArg: string): void {
  if (!pathArg) fail("usage: internify read <path>");
  const abs = join(root, pathArg);
  const rel = toRel(abs);
  if (!inRepo(rel) || !existsSync(abs)) fail(`path outside repo or missing: ${pathArg}`);
  const active = getActive(knowledge);
  if (active) {
    const ledger = loadLedger(knowledge, active.taskId);
    if (ledger) {
      let changed = false;
      for (const r of ledger.requiredReads) {
        if (!r.read && r.path === rel) {
          r.read = true;
          changed = true;
        }
      }
      if (changed) {
        ledger.updated = nowIso();
        saveLedger(knowledge, ledger);
      }
    }
  }
  process.stdout.write(readFileSync(abs, "utf8"));
}

function cmdContext(pathArg: string, selector: string, kind: string): void {
  if (!pathArg || !selector) fail("usage: internify context <path> <selector> [--kind section|function]");
  const abs = join(root, pathArg);
  const rel = toRel(abs);
  if (!inRepo(rel) || !existsSync(abs)) fail(`path outside repo or missing: ${pathArg}`);
  const text = readFileSync(abs, "utf8");
  console.log(kind === "function" ? sliceFunction(text, selector) : sliceSection(text, selector));
}

function activeLedger(): { taskId: string } {
  const active = getActive(knowledge);
  if (!active) fail("no active task. run: internify index <spec-folder>");
  return active;
}

function cmdStep(id: string, anchor: string): void {
  if (!id) fail("usage: internify step <id> <anchor>");
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const idx = readIndex(knowledge, active.taskId);
  const d = canStep(ledger, anchor ?? "", idx?.anchors ?? []);
  if (!d.ok) fail(d.reason ?? "blocked");
  ledger.activeStep = id;
  ledger.phase = "planned";
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  console.log(`Step ${id} active (anchor ${anchor ?? ""}).`);
}

function cmdEvidence(step: string, argv: string[]): void {
  if (!step) fail("usage: internify evidence <step> --claim <c> --proof <p> --result pass|fail");
  const f = flags(argv);
  const result = (f.result ?? "pass") as "pass" | "fail";
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  if (!ledger.steps.some((s) => s.id === step)) fail(`unknown step: ${step}`);
  appendEvidence(
    knowledge,
    active.taskId,
    `## ${step} ${nowIso()} result=${result}\nclaim: ${f.claim ?? ""}\nproof: ${f.proof ?? ""}`,
  );
  ledger.phase = "verifying";
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  console.log(`Evidence recorded for ${step} (${result}).`);
}

function cmdClose(): void {
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const d = canClose(ledger, readEvidence(knowledge, active.taskId));
  if (!d.ok) fail(d.reason ?? "blocked");
  const dailyName = appendDaily(
    knowledge,
    `### internify task closed — ${active.taskId} ${nowIso()}\n` +
      `- steps: ${ledger.steps.map((s) => s.id).join(", ")}\n` +
      `- evidence: .intern/state/tasks/${active.taskId}/EVIDENCE.md`,
    daily,
  );
  ledger.steps.forEach((s) => (s.done = true));
  ledger.phase = "done";
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  console.log(`Task ${active.taskId} closed. Daily: ${dailyName}`);
}

function cmdStatus(): void {
  const active = getActive(knowledge);
  if (!active) fail("no active task.");
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt.");
  console.log(JSON.stringify(ledger, null, 2));
}

function cmdOverride(reason: string): void {
  if (!reason) fail("usage: internify override <reason>");
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  ledger.decisions.push(`OVERRIDE ${nowIso()}: ${reason}`);
  ledger.forceAllow = true;
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  appendEvidence(knowledge, active.taskId, `## OVERRIDE ${nowIso()}\nreason: ${reason}`);
  console.log("Override recorded (one-shot).");
}

function cmdGateEdit(file: string): void {
  if (!file) fail("usage: internify gate edit <file>");
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const abs = isAbsolute(file) ? file : join(root, file);
  let targetStatus: string | undefined;
  try {
    if (existsSync(abs)) targetStatus = parseStatus(readFileSync(abs, "utf8")) ?? undefined;
  } catch {
    /* ignore */
  }
  const d = canEdit(root, ledger, file, { targetStatus });
  if (!d.ok) fail(d.reason ?? "blocked");
  if (ledger.forceAllow) {
    ledger.forceAllow = false;
    ledger.updated = nowIso();
    saveLedger(knowledge, ledger);
  }
  console.log(`OK: ${file} is editable.`);
}

function cmdGateBash(command: string): void {
  if (!command) fail('usage: internify gate bash "<command>"');
  const active = activeLedger();
  const ledger = loadLedger(knowledge, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const d = canBash(root, ledger, command);
  if (!d.ok) fail(d.reason ?? "blocked");
  console.log("OK: bash command allowed.");
}

function pkgRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

type Pack = { name: string; source: string; origin: "bundled" | "external" };

function packRoots(): string[] {
  return [
    join(homedir(), ".config", "opencode", "skills"),
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
  ];
}

function listPacks(pkg: string): Pack[] {
  const found = new Map<string, { source: string; origin: "bundled" | "external" }>();
  const bundled = join(pkg, "packs");
  if (existsSync(bundled)) {
    for (const e of readdirSync(bundled)) {
      const p = join(bundled, e);
      if (e !== "README.md" && existsSync(p) && statSync(p).isDirectory()) {
        found.set(e, { source: p, origin: "bundled" });
      }
    }
  }
  for (const root of packRoots()) {
    if (!existsSync(root)) continue;
    for (const e of readdirSync(root)) {
      const p = join(root, e);
      if (existsSync(p) && statSync(p).isDirectory() && !found.has(e)) {
        found.set(e, { source: p, origin: "external" });
      }
    }
  }
  return [...found.entries()].map(([name, v]) => ({ name, ...v }));
}

function skillsTarget(ws: string, tool: string, know: string): string {
  if (tool === "opencode") return join(ws, ".opencode", "skills");
  if (tool === "claude") return join(ws, ".claude", "skills");
  return join(ws, know, "skills");
}

function installPacks(
  ws: string,
  tool: string,
  know: string,
  pkg: string,
  names: string[],
): string[] {
  const target = skillsTarget(ws, tool, know);
  const packs = listPacks(pkg);
  const installed: string[] = [];
  for (const name of names) {
    const pack = packs.find((p) => p.name === name);
    if (!pack) {
      console.log(`  ! unknown pack: ${name}`);
      continue;
    }
    const dest = join(target, name);
    if (existsSync(dest)) {
      console.log(`  = ${name} (already present)`);
      continue;
    }
    mkdirSync(target, { recursive: true });
    cpSync(pack.source, dest, { recursive: true });
    installed.push(name);
    console.log(`  + ${name} (${pack.origin})`);
  }
  return installed;
}

async function promptSkills(pkg: string): Promise<string[]> {
  const packs = listPacks(pkg);
  if (packs.length === 0) return [];
  if (!process.stdin.isTTY) {
    console.log(
      `skill packs available: ${packs.map((p) => p.name).join(", ")} (skipped; use --skills)`,
    );
    return [];
  }
  console.log("\nOptional skill packs:");
  packs.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.origin})`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (
      await rl.question("Install packs? [a]ll / [s]elect / [n]one (default n): ")
    )
      .trim()
      .toLowerCase();
    if (ans === "a" || ans === "all") return packs.map((p) => p.name);
    if (ans === "s" || ans === "select") {
      const sel = (await rl.question("Numbers or names (comma-separated): ")).trim();
      const names: string[] = [];
      for (const part of sel.split(/[,\s]+/).filter(Boolean)) {
        const n = Number(part);
        if (!Number.isNaN(n) && n >= 1 && n <= packs.length) names.push(packs[n - 1].name);
        else if (packs.some((p) => p.name === part)) names.push(part);
      }
      return names;
    }
  } finally {
    rl.close();
  }
  return [];
}

const WORK_BODY_TOOLS = `Work on the spec folder: {ARGS}

Steps:
1. Call \`intern_index\` with \`specRoot="{ARGS}"\`.
2. For every required read listed by the harness, use the \`read\` tool. Required reads MUST be read with \`read\` — \`intern_context\` does NOT satisfy Gate 1. Use \`intern_context\` only for extra, non-required slices.
3. For each plan step in \`.intern/state/tasks/<id>/LEDGER.md\`, in order:
   a. Call \`intern_step\` with the step id and its anchor (recorded in LEDGER.md).
   b. Edit only files in Scope.
   c. Call \`intern_evidence\` with claim + proof + result.
4. When all steps pass, call \`intern_close\`.`;

const WORK_BODY_CLI = `Work on the spec folder: {ARGS}

This workspace uses internify. Use the \`internify\` CLI.

Steps:
1. \`internify index {ARGS}\`
2. Read every required read with \`internify read <path>\` (this marks it done).
3. \`internify step <id> <anchor>\`
4. Edit only files in scope; check with \`internify gate edit <file>\` (exit 1 = blocked).
5. \`internify evidence <step> --claim "..." --proof "..." --result pass\`
6. When all steps pass: \`internify close\`.`;

const BOOT_BODY_TOOLS =
  "Collect the session context: call `intern_boot` (no arguments) and show the resulting brief to the user.";
const BOOT_BODY_CLI = "Collect the session context: run `internify boot` and summarize it.";

const STATUS_BODY_TOOLS =
  "Show the current task: call `intern_status` and summarize phase, active step, and pending reads.";
const STATUS_BODY_CLI = "Show the current task: run `internify status` and summarize it.";

interface CmdDef {
  name: string;
  description: string;
  tools: string;
  cli: string;
}

const COMMANDS: CmdDef[] = [
  {
    name: "work",
    description: "Start a harnessed work task from a spec folder.",
    tools: WORK_BODY_TOOLS,
    cli: WORK_BODY_CLI,
  },
  {
    name: "boot",
    description: "Collect session context from disk.",
    tools: BOOT_BODY_TOOLS,
    cli: BOOT_BODY_CLI,
  },
  {
    name: "status",
    description: "Show the current task phase and pending reads.",
    tools: STATUS_BODY_TOOLS,
    cli: STATUS_BODY_CLI,
  },
];

function generateCommands(ws: string, names: string[], pkg: string): string[] {
  void pkg;
  const written: string[] = [];
  for (const name of names) {
    const p = getProvider(name);
    if (!p) {
      console.log(`  ! unknown provider: ${name}`);
      continue;
    }
    for (const def of COMMANDS) {
      const body = (p.name === "opencode" ? def.tools : def.cli).replaceAll(
        "{ARGS}",
        p.argsToken,
      );
      const file = commandFileName(p, def.name);
      const dest = join(ws, p.commandDir, file);
      if (existsSync(dest)) {
        console.log(`  = ${name}:${def.name} exists`);
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, renderCommand(p, def.name, def.description, body));
      written.push(`${name}:${dest}`);
    }
    console.log(`  + ${name} -> ${p.commandDir}/ {work,boot,status}${p.hooks ? "" : " (no hooks: command only)"}`);
  }
  return written;
}

function cmdSkillsList(pkg: string): void {  const packs = listPacks(pkg);
  if (packs.length === 0) {
    console.log("no skill packs found");
    return;
  }
  for (const p of packs) {
    console.log(`${p.origin === "bundled" ? "*" : "-"} ${p.name}  (${p.origin})  ${p.source}`);
  }
  console.log("\n* bundled, - external");
}

function positionals(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      i++; // skip the flag's value
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

async function cmdInit(argv: string[], f: Record<string, string>): Promise<void> {
  const targetArg = positionals(argv)[0];
  const ws = targetArg ? resolve(targetArg) : root;
  const tool = f.tool ?? "opencode";
  const know = f.knowledge ?? ".intern";
  const profile = f.profile ?? "simple";
  const pkg = pkgRoot();
  const template = join(pkg, "template");

  if (!existsSync(template)) {
    fail(`template not found at ${template} (run init from the internify package)`);
  }

  const kdest = join(ws, know);
  if (existsSync(kdest)) {
    console.log(`${know}/ already exists — left untouched`);
  } else if (profile === "advanced") {
    const para = [
      "00-inbox",
      "01-projects",
      "02-areas",
      "03-resources",
      "04-archive",
      "05-templates",
      "06-daily",
    ];
    for (const d of para) mkdirSync(join(kdest, d), { recursive: true });
    cpSync(join(template, ".intern", "rules.md"), join(kdest, "rules.md"));
    cpSync(join(template, ".intern", "roles"), join(kdest, "roles"), { recursive: true });
    cpSync(join(template, ".intern", "plans", "_template"), join(kdest, "05-templates", "_template"), {
      recursive: true,
    });
    console.log(`scaffolded ${know}/ (advanced: PARA)`);
  } else if (profile !== "simple") {
    fail(`unknown profile: ${profile} (use simple|advanced)`);
  } else {
    cpSync(join(template, ".intern"), kdest, { recursive: true });
    console.log(`scaffolded ${know}/`);
  }

  const agentsDest = join(ws, "AGENTS.md");
  if (!existsSync(agentsDest)) {
    cpSync(join(template, "AGENTS.md"), agentsDest);
    console.log("wrote AGENTS.md");
  } else {
    console.log("AGENTS.md already exists — left untouched");
  }

  if (f.target || f.knowledge || f.plansDir || f.dailyDir || profile === "advanced") {
    const cfgPath = join(ws, "internify.json");
    let cfg: Record<string, unknown> = {};
    if (existsSync(cfgPath)) {
      try {
        cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
      } catch {
        /* keep default */
      }
    }
    if (f.target) cfg.target = f.target;
    if (f.knowledge) cfg.knowledge = f.knowledge;
    if (f.plansDir) cfg.plansDir = f.plansDir;
    else if (profile === "advanced") cfg.plansDir = "01-projects";
    if (f.dailyDir) cfg.dailyDir = f.dailyDir;
    else if (profile === "advanced") cfg.dailyDir = "06-daily";
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    console.log("wrote internify.json");
  }

  if (tool === "opencode") {
    const plugin = join(pkg, "adapters/opencode/plugins/intern-harness.ts");
    const cfgPath = join(ws, "opencode.json");
    let cfg: Record<string, unknown> = { $schema: "https://opencode.ai/config.json" };
    if (existsSync(cfgPath)) {
      try {
        cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
      } catch {
        /* keep default */
      }
    }
    const plugins = Array.isArray(cfg.plugin) ? (cfg.plugin as string[]) : [];
    if (!plugins.includes(plugin)) plugins.push(plugin);
    cfg.plugin = plugins;
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    console.log(`wired opencode plugin -> ${plugin}`);
  } else if (tool === "claude") {
    const hook = join(pkg, "adapters/claude/hook.ts");
    const dir = join(ws, ".claude");
    mkdirSync(dir, { recursive: true });
    const setPath = join(dir, "settings.json");
    let s: Record<string, unknown> = {};
    if (existsSync(setPath)) {
      try {
        s = JSON.parse(readFileSync(setPath, "utf8")) as Record<string, unknown>;
      } catch {
        /* keep default */
      }
    }
    const hooks = (s.hooks as Record<string, unknown>) ?? {};
    const pre = Array.isArray(hooks.PreToolUse) ? (hooks.PreToolUse as unknown[]) : [];
    pre.push({
      matcher: "Edit|Write|MultiEdit",
      hooks: [{ type: "command", command: `bun "${hook}"` }],
    });
    hooks.PreToolUse = pre;
    const readHook = join(pkg, "adapters/claude/read.ts");
    const post = Array.isArray(hooks.PostToolUse) ? (hooks.PostToolUse as unknown[]) : [];
    post.push({
      matcher: "Read",
      hooks: [{ type: "command", command: `bun "${readHook}"` }],
    });
    hooks.PostToolUse = post;
    s.hooks = hooks;
    writeFileSync(setPath, JSON.stringify(s, null, 2) + "\n");
    console.log(`wired claude hooks -> ${hook}`);
  } else if (tool === "none") {
    // CLI only.
  } else if (getProvider(tool)) {
    console.log(`(${tool}: command only; no hooks — gates run via the CLI)`);
  } else {
    fail(`unknown tool: ${tool} (use ${["none", ...providerNames()].join("|")})`);
  }

  if (getProvider(tool)) {
    generateCommands(ws, [tool], pkg);
  }

  let skillNames: string[] = [];
  if (f.skills === "all") {
    skillNames = listPacks(pkg).map((p) => p.name);
  } else if (f.skills && f.skills !== "none") {
    skillNames = f.skills.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (f.skills === undefined && !f.yes) {
    skillNames = await promptSkills(pkg);
  }
  if (skillNames.length > 0) {
    console.log(`\nSkill packs -> ${skillsTarget(ws, tool, know)}`);
    installPacks(ws, tool, know, pkg, skillNames);
  }

  console.log(
    `\nDone. Next:\n  1. restart the AI tool (config is not hot-reloaded)\n  2. bootstrap:  internify boot\n  3. start work: /work ${know}/plans/<SpecName>   (or the CLI)`,
  );
}

function cmdUpdate(f: Record<string, string>): void {
  const pkg = pkgRoot();
  const template = join(pkg, "template");
  if (!existsSync(template)) fail(`template not found at ${template}`);
  const tplSrc = join(template, ".intern", "plans", "_template");
  if (!existsSync(tplSrc)) fail(`template skeleton not found at ${tplSrc}`);
  const tplDest = existsSync(join(knowledge, "05-templates"))
    ? join(knowledge, "05-templates", "_template")
    : join(plans, "_template");
  mkdirSync(dirname(tplDest), { recursive: true });
  cpSync(tplSrc, tplDest, { recursive: true, force: true });
  console.log(`updated spec templates -> ${tplDest}`);
  if (f.force === "true") {
    cpSync(join(template, ".intern", "rules.md"), join(knowledge, "rules.md"), { force: true });
    cpSync(join(template, ".intern", "roles"), join(knowledge, "roles"), {
      recursive: true,
      force: true,
    });
    console.log("force: refreshed rules.md + roles/");
  } else {
    console.log("(rules.md and roles/ untouched — use --force to refresh them)");
  }
}

function usage(): void {
  console.log(`internify — disk-backed engineer loop for AI agents

Commands:
  init [dir] [--tool opencode|claude|gemini|qwen|cursor|none] [--knowledge .intern]
                                    [--profile simple|advanced]
                                    [--target <projectDir>] [--plansDir <dir>]
                                    [--dailyDir <dir>] [--skills all|none|a,b] [--yes]
                                    scaffold knowledge + wire the provider
  skills list                       list available skill packs
  commands generate [dir] [--providers opencode,claude,gemini,qwen,cursor]
                                    install the /work command per provider
  update [--force]                  refresh spec templates (roles/rules with --force)
  boot                              collect session context -> .intern/state/CONTEXT.md
  index <spec-folder>               build INDEX, start/resume a task
  read <path>                       print a file and mark a required read as done
  context <path> <selector> [--kind section|function]
  step <id> <anchor>                declare the active step
  evidence <step> --claim <c> --proof <p> --result pass|fail
  close                             validate evidence, append daily, finish
  status                            show phase + ledger
  override <reason>                 one-shot recorded gate bypass
  gate edit <file>                  exit 1 if the file is blocked
  gate bash "<command>"             exit 1 if the bash write is blocked

Env: INTERNIFY_ROOT (default: cwd). Config: <root>/internify.json
  { "target", "knowledge", "plansDir", "dailyDir" }`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "init":
    await cmdInit(rest, flags(rest));
    break;
  case "skills":
    if (rest[0] === "list") cmdSkillsList(pkgRoot());
    else fail("usage: internify skills list");
    break;
  case "update":
    cmdUpdate(flags(rest));
    break;
  case "commands":
    if (rest[0] === "generate" || rest[0] === "install") {
      const cf = flags(rest);
      const dir = positionals(rest.slice(1))[0];
      const names = (cf.providers ?? cf.provider ?? "opencode")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      generateCommands(dir ? resolve(dir) : root, names, pkgRoot());
    } else {
      fail("usage: internify commands generate [dir] [--providers opencode,claude,gemini,qwen,cursor]");
    }
    break;
  case "boot":
    cmdBoot();
    break;
  case "index":
    cmdIndex(rest[0]);
    break;
  case "read":
    cmdRead(rest[0]);
    break;
  case "context":
    cmdContext(rest[0], rest[1], flags(rest).kind ?? "section");
    break;
  case "step":
    cmdStep(rest[0], rest[1]);
    break;
  case "evidence":
    cmdEvidence(rest[0], rest);
    break;
  case "close":
    cmdClose();
    break;
  case "status":
    cmdStatus();
    break;
  case "override":
    cmdOverride(rest.join(" "));
    break;
  case "gate":
    if (rest[0] === "edit") cmdGateEdit(rest[1]);
    else if (rest[0] === "bash") cmdGateBash(rest.slice(1).join(" "));
    else fail("usage: internify gate edit <file> | gate bash \"<command>\"");
    break;
  case undefined:
  case "-h":
  case "--help":
  case "help":
    usage();
    break;
  default:
    usage();
    fail(`unknown command: ${cmd}`);
}
