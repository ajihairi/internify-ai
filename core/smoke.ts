import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildIndex } from "./lib/index-builder";
import { slug, emptyLedger, serializeLedger, parseLedger } from "./lib/state";
import { canEdit, canStep, canClose } from "./lib/gates";
import {
  saveIndex,
  saveLedger,
  loadLedger,
  appendEvidence,
  readEvidence,
  appendDaily,
  listDaily,
  setActive,
  getActive,
  writeContext,
} from "./lib/io";
import { buildContextPack, extractSummary, pickLatestDaily } from "./lib/boot";
import { sliceSection, sliceFunction } from "./lib/context";

interface Result {
  name: string;
  ok: boolean;
  observed: string;
}

const results: Result[] = [];
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, observed: string) {
  if (ok) pass++;
  else fail++;
  results.push({ name, ok, observed });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  —  ${observed}`);
}

const root = mkdtempSync(join(tmpdir(), "intern-harness-smoke-"));
const knowledge = join(root, ".intern");
const specDir = join(root, "spec");

function put(rel: string, content: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

console.log(`# intern-harness smoke (isolated temp root)\nroot: ${root}\n`);

console.log("## fixture");
put(
  "spec/SPECmd.md",
  [
    "# Summary",
    "",
    "Implement `src/Feature.swift` main button title.",
    "",
  ].join("\n"),
);
put("spec/Plan.md", "Plan: do the thing. No headings here.\n");
put("src/Feature.swift", "func mainButtonTitle() { }\n");
put(
  ".intern/daily/09-09-2026.md",
  [
    "# Daily Log — 09 September 2026",
    "",
    "## Summary",
    "",
    "Fixture daily summary for smoke test.",
    "",
  ].join("\n"),
);
console.log("wrote spec/SPECmd.md, spec/Plan.md, src/Feature.swift, .intern/daily/09-09-2026.md\n");

console.log("## index + ledger");
const idx = buildIndex(specDir, root);
const taskId = slug(specDir);
const ledger = emptyLedger(taskId, "spec");
ledger.requiredReads = idx.requiredReads.map((r) => ({ ...r, read: false }));
ledger.scope = idx.requiredReads
  .filter((r) => r.kind === "code")
  .map((r) => r.path);
if (ledger.scope.length === 0) ledger.scope = ["spec"];
ledger.steps = idx.slices.slice(0, 5).map((s, i) => ({
  id: `S${i + 1}`,
  title: s.selector,
  anchor: idx.anchors[i]?.id ?? s.key,
  done: false,
}));
saveIndex(knowledge, taskId, idx);
saveLedger(knowledge, ledger);
setActive(knowledge, taskId, "spec");

check(
  "index: buildIndex resolves spec+code reads",
  idx.requiredReads.length === 3 &&
    idx.requiredReads.some(
      (r) => r.path === "src/Feature.swift" && r.kind === "code",
    ) &&
    idx.requiredReads.every((r) => r.read === false),
  `reads=${idx.requiredReads.length} [${idx.requiredReads
    .map((r) => `${r.path}:${r.kind}`)
    .join(", ")}]`,
);

check(
  "index: saveIndex writes INDEX.md",
  existsSync(join(root, ".intern", "state", "tasks", taskId, "INDEX.md")),
  `.intern/state/tasks/${taskId}/INDEX.md`,
);

check(
  "ledger: scope from code refs",
  JSON.stringify(ledger.scope) === JSON.stringify(["src/Feature.swift"]),
  `scope=${JSON.stringify(ledger.scope)}`,
);

check(
  "ledger: steps from slices with a non-empty anchor",
  ledger.steps.length === 1 &&
    ledger.steps[0].id === "S1" &&
    ledger.steps[0].title === "Summary" &&
    ledger.steps[0].anchor.length > 0,
  `steps=${JSON.stringify(ledger.steps.map((s) => ({
    id: s.id,
    title: s.title,
    anchor: s.anchor,
  })))}`,
);

const active = getActive(knowledge);
check(
  "active: setActive/getActive round-trip",
  !!active && active.taskId === taskId && active.specRoot === "spec",
  `active=${JSON.stringify(active)}`,
);

const codeFile = "src/Feature.swift";

console.log("\n## gate 1 — read");
const dOrient = canEdit(root, ledger, codeFile);
check(
  "gate1: orient edit blocked",
  !dOrient.ok,
  dOrient.reason ?? "(unexpected ok)",
);

ledger.requiredReads = ledger.requiredReads.map((r) => ({ ...r, read: true }));
ledger.phase = "grounded";
const dGrounded = canEdit(root, ledger, codeFile);
check(
  "gate1: grounded (unread cleared, not planned) blocked",
  !dGrounded.ok,
  dGrounded.reason ?? "(unexpected ok)",
);

console.log("\n## gate 2 — step + scope");
const anchor = ledger.steps[0].anchor;
const dStep = canStep(ledger, anchor);
check("gate2: canStep ok after reads", dStep.ok, dStep.reason ?? "ok");
ledger.activeStep = "S1";
ledger.phase = "planned";
const dIn = canEdit(root, ledger, codeFile);
check("gate2: in-scope planned edit allowed", dIn.ok, dIn.reason ?? "ok");
const dOut = canEdit(root, ledger, join(root, "src", "Other.swift"));
check(
  "gate2: out-of-scope edit blocked",
  !dOut.ok,
  dOut.reason ?? "(unexpected ok)",
);

console.log("\n## gate 3 — evidence + close");
const evBefore = readEvidence(knowledge, taskId);
const closeBefore = canClose(ledger, evBefore);
check(
  "gate3: no evidence before",
  evBefore.length === 0,
  `evidence=${JSON.stringify(evBefore)}`,
);
check(
  "gate3: canClose blocked before evidence",
  !closeBefore.ok,
  closeBefore.reason ?? "(unexpected ok)",
);

appendEvidence(
  knowledge,
  taskId,
  `## S1 ${new Date().toISOString()} result=pass\nclaim: sim claim\nproof: sim proof`,
);
const evAfter = readEvidence(knowledge, taskId);
check(
  "gate3: readEvidence parses pass record",
  evAfter.length === 1 &&
    evAfter[0].step === "S1" &&
    evAfter[0].result === "pass",
  `evidence=${JSON.stringify(evAfter)}`,
);
const closeAfter = canClose(ledger, evAfter);
check("gate3: canClose ok after evidence", closeAfter.ok, closeAfter.reason ?? "ok");

console.log("\n## ledger round-trip");
const round = parseLedger(serializeLedger(ledger));
check(
  "ledger: serialize/parse round-trip",
  !!round &&
    round.taskId === ledger.taskId &&
    round.phase === ledger.phase &&
    round.activeStep === ledger.activeStep &&
    JSON.stringify(round.scope) === JSON.stringify(ledger.scope) &&
    round.steps.length === ledger.steps.length,
  round
    ? `taskId=${round.taskId} phase=${round.phase} activeStep=${round.activeStep} steps=${round.steps.length}`
    : "parse returned null",
);
saveLedger(knowledge, ledger);
const reloaded = loadLedger(knowledge, taskId);
check(
  "ledger: save/load via disk",
  !!reloaded && reloaded.activeStep === "S1" && reloaded.steps.length === 1,
  reloaded ? `activeStep=${reloaded.activeStep} steps=${reloaded.steps.length}` : "null",
);

console.log("\n## daily + boot");
const dailyName = appendDaily(knowledge, "sim closed");
const dailyList = listDaily(knowledge);
const latest = pickLatestDaily(dailyList);
const fixtureDaily = readFileSync(
  join(root, ".intern", "daily", "09-09-2026.md"),
  "utf8",
);
const summary = extractSummary(fixtureDaily);
check(
  "daily: appendDaily writes DD-MM-YYYY.md",
  /^\d{1,2}-\d{2}-\d{4}\.md$/.test(dailyName) &&
    existsSync(join(root, ".intern", "daily", dailyName)),
  `name=${dailyName}`,
);
check(
  "daily: listDaily finds appended file",
  dailyList.includes(dailyName),
  `list=${dailyList.join(", ")}`,
);
check(
  "daily: pickLatestDaily picks appended file",
  latest === dailyName,
  `latest=${latest}`,
);
check(
  "daily: extractSummary non-empty on fixture",
  summary.length > 0,
  JSON.stringify(summary),
);

console.log("\n## context pack + slices");
const pack = buildContextPack({
  generated: new Date().toISOString(),
  latestDaily: latest,
  dailySummary: summary,
  ledger,
  specs: ["spec"],
});
writeContext(knowledge, pack);
const ctxPath = join(root, ".intern", "state", "CONTEXT.md");
const ctx = existsSync(ctxPath) ? readFileSync(ctxPath, "utf8") : "";
check(
  "context: writeContext persists pack",
  ctx === pack && ctx.includes("# CONTEXT — session pack"),
  `bytes=${ctx.length}`,
);
check(
  "context: buildContextPack carries active task",
  pack.includes(taskId) && pack.includes(`phase: ${ledger.phase}`),
  pack.split("\n").find((l) => l.includes("task:")) ?? "(no task line)",
);

const mdText = readFileSync(join(specDir, "SPECmd.md"), "utf8");
const section = sliceSection(mdText, "Summary");
check(
  "context: sliceSection returns Summary section",
  section.includes("# Summary") && section.includes("src/Feature.swift"),
  JSON.stringify(section),
);

const codeText = readFileSync(join(root, codeFile), "utf8");
const fn = sliceFunction(codeText, "mainButtonTitle");
check(
  "context: sliceFunction returns function body",
  fn.includes("func mainButtonTitle") && fn.includes("}"),
  JSON.stringify(fn),
);

console.log("\n## summary");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${results.length} total`);
console.log(`temp root left for inspection: ${root}`);

if (fail > 0) process.exitCode = 1;
