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

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { buildIndex } from "./lib/index-builder";
import { canEdit, canStep, canClose, canBash } from "./lib/gates";
import { sliceFunction, sliceSection } from "./lib/context";
import { loadPaths } from "./lib/config";
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
const { knowledge, target } = loadPaths(root);

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
  const dailies = listDaily(knowledge);
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
    specs: listSpecs(knowledge),
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
  ledger.scope = idx.requiredReads.filter((r) => r.kind === "code").map((r) => r.path);
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
  const daily = appendDaily(
    knowledge,
    `### internify task closed — ${active.taskId} ${nowIso()}\n` +
      `- steps: ${ledger.steps.map((s) => s.id).join(", ")}\n` +
      `- evidence: .intern/state/tasks/${active.taskId}/EVIDENCE.md`,
  );
  ledger.steps.forEach((s) => (s.done = true));
  ledger.phase = "done";
  ledger.updated = nowIso();
  saveLedger(knowledge, ledger);
  console.log(`Task ${active.taskId} closed. Daily: .intern/daily/${daily}`);
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
  const d = canEdit(root, ledger, file);
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

function usage(): void {
  console.log(`internify — disk-backed engineer loop for AI agents

Commands:
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
  { "target": "...", "knowledge": "..." }`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
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
