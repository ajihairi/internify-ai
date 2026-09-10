#!/usr/bin/env bun
/**
 * internify CLI — tool-agnostic entry point over core/lib.
 *
 * Usage:
 *   internify boot
 *   internify index <spec-folder>
 *   internify context <path> <selector> [--kind section|function]
 *   internify step <id> <anchor>
 *   internify evidence <step> --claim <c> --proof <p> --result pass|fail
 *   internify close
 *   internify status
 *   internify override <reason>
 *   internify gate edit <file>      (exit 1 if blocked)
 *
 * Root = cwd, or INTERNIFY_ROOT. Knowledge lives in <root>/.intern.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { buildIndex } from "./lib/index-builder";
import { canEdit, canStep, canClose } from "./lib/gates";
import { sliceFunction, sliceSection } from "./lib/context";
import {
  KNOWLEDGE_DIR,
  slug,
  emptyLedger,
  nowIso,
} from "./lib/state";
import {
  loadLedger,
  saveLedger,
  saveIndex,
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
  const dailies = listDaily(root);
  const latest = pickLatestDaily(dailies);
  let dailyText = "";
  if (latest) {
    try {
      dailyText = readFileSync(join(root, KNOWLEDGE_DIR, "daily", latest), "utf8");
    } catch {
      dailyText = "";
    }
  }
  const active = getActive(root);
  const ledger = active ? loadLedger(root, active.taskId) : null;
  const pack = buildContextPack({
    generated: nowIso(),
    latestDaily: latest,
    dailySummary: extractSummary(dailyText),
    ledger,
    specs: listSpecs(root),
  });
  writeContext(root, pack);
  console.log(pack);
}

function cmdIndex(specArg: string): void {
  if (!specArg) fail("usage: internify index <spec-folder>");
  const rel = toRel(specArg);
  if (!inRepo(rel)) fail(`specRoot outside repo: ${specArg}`);
  const abs = join(root, rel);
  const taskId = slug(rel);
  const idx = buildIndex(abs, root);
  saveIndex(root, taskId, idx);
  const ledger = loadLedger(root, taskId) ?? emptyLedger(taskId, rel);
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
  saveLedger(root, ledger);
  setActive(root, taskId, rel);
  console.log(`INDEX built. task=${taskId} reads=${idx.requiredReads.length}`);
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
  const active = getActive(root);
  if (!active) fail("no active task. run: internify index <spec-folder>");
  return active;
}

function cmdStep(id: string, anchor: string): void {
  if (!id) fail("usage: internify step <id> <anchor>");
  const active = activeLedger();
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const d = canStep(ledger, anchor ?? "");
  if (!d.ok) fail(d.reason ?? "blocked");
  ledger.activeStep = id;
  ledger.phase = "planned";
  ledger.updated = nowIso();
  saveLedger(root, ledger);
  console.log(`Step ${id} active (anchor ${anchor ?? ""}).`);
}

function cmdEvidence(step: string, argv: string[]): void {
  if (!step) fail("usage: internify evidence <step> --claim <c> --proof <p> --result pass|fail");
  const f = flags(argv);
  const result = (f.result ?? "pass") as "pass" | "fail";
  const active = activeLedger();
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  if (!ledger.steps.some((s) => s.id === step)) fail(`unknown step: ${step}`);
  appendEvidence(
    root,
    active.taskId,
    `## ${step} ${nowIso()} result=${result}\nclaim: ${f.claim ?? ""}\nproof: ${f.proof ?? ""}`,
  );
  ledger.phase = "verifying";
  ledger.updated = nowIso();
  saveLedger(root, ledger);
  console.log(`Evidence recorded for ${step} (${result}).`);
}

function cmdClose(): void {
  const active = activeLedger();
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const d = canClose(ledger, readEvidence(root, active.taskId));
  if (!d.ok) fail(d.reason ?? "blocked");
  const daily = appendDaily(
    root,
    `### internify task closed — ${active.taskId} ${nowIso()}\n` +
      `- steps: ${ledger.steps.map((s) => s.id).join(", ")}\n` +
      `- evidence: ${KNOWLEDGE_DIR}/state/tasks/${active.taskId}/EVIDENCE.md`,
  );
  ledger.steps.forEach((s) => (s.done = true));
  ledger.phase = "done";
  ledger.updated = nowIso();
  saveLedger(root, ledger);
  console.log(`Task ${active.taskId} closed. Daily: ${KNOWLEDGE_DIR}/daily/${daily}`);
}

function cmdStatus(): void {
  const active = getActive(root);
  if (!active) fail("no active task.");
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt.");
  console.log(JSON.stringify(ledger, null, 2));
}

function cmdOverride(reason: string): void {
  if (!reason) fail("usage: internify override <reason>");
  const active = activeLedger();
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  ledger.decisions.push(`OVERRIDE ${nowIso()}: ${reason}`);
  ledger.forceAllow = true;
  ledger.updated = nowIso();
  saveLedger(root, ledger);
  appendEvidence(root, active.taskId, `## OVERRIDE ${nowIso()}\nreason: ${reason}`);
  console.log("Override recorded (one-shot).");
}

function cmdGateEdit(file: string): void {
  if (!file) fail("usage: internify gate edit <file>");
  const active = activeLedger();
  const ledger = loadLedger(root, active.taskId);
  if (!ledger) fail("ledger missing/corrupt. re-run: internify index");
  const d = canEdit(root, ledger, file);
  if (!d.ok) fail(d.reason ?? "blocked");
  if (ledger.forceAllow) {
    ledger.forceAllow = false;
    ledger.updated = nowIso();
    saveLedger(root, ledger);
  }
  console.log(`OK: ${file} is editable.`);
}

function cmdRead(pathArg: string): void {
  if (!pathArg) fail("usage: internify read <path>");
  const abs = join(root, pathArg);
  const rel = toRel(abs);
  if (!inRepo(rel) || !existsSync(abs)) fail(`path outside repo or missing: ${pathArg}`);
  const active = getActive(root);
  if (active) {
    const ledger = loadLedger(root, active.taskId);
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
        saveLedger(root, ledger);
      }
    }
  }
  process.stdout.write(readFileSync(abs, "utf8"));
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

Env: INTERNIFY_ROOT (default: cwd). Knowledge dir: ${KNOWLEDGE_DIR}`);
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
    else fail("usage: internify gate edit <file>");
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
