import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { buildIndex } from "../../../core/lib/index-builder";
import { canEdit, canStep, canClose, canBash } from "../../../core/lib/gates";
import { sliceFunction, sliceSection } from "../../../core/lib/context";
import { parseStatus } from "../../../core/lib/status";
import { loadPaths } from "../../../core/lib/config";
import { slug, emptyLedger, nowIso } from "../../../core/lib/state";
import {
  buildContextPack,
  extractSummary,
  pickLatestDaily,
} from "../../../core/lib/boot";
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
} from "../../../core/lib/io";
import { readFileSync, existsSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

function toRel(root: string, p: string): string {
  const abs = isAbsolute(p) ? p : join(root, p);
  return relative(root, abs).split("\\").join("/");
}

export const InternHarness: Plugin = async ({ directory, worktree }) => {
  if (process.env.INTERN_HARNESS === "off") return {};
  const root = worktree || directory;
  const paths = loadPaths(root);
  const knowledge = paths.knowledge;
  const target = paths.target;
  const plans = paths.plans;
  const daily = paths.daily;

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const active = getActive(knowledge);
      if (active) {
        const ledger = loadLedger(knowledge, active.taskId);
        if (!ledger) {
          if (Array.isArray(output.system)) {
            output.system.push(
              "## HARNESS STATE: LEDGER CORRUPT — gates fail-closed until intern_index re-run",
            );
          }
        } else {
          const state = [
            "## HARNESS STATE (from disk, not memory)",
            `task: ${ledger.taskId} | phase: ${ledger.phase}`,
            `active step: ${ledger.activeStep ?? "(not declared)"}`,
            `pending reads: ${
              ledger.requiredReads.filter((r) => !r.read).map((r) => r.path).join(", ") || "none"
            }`,
            `scope: ${ledger.scope.join(", ") || "(none)"}`,
          ].join("\n");
          if (Array.isArray(output.system)) output.system.push(state);
        }
      }
      const contextPath = join(knowledge, "state", "CONTEXT.md");
      if (existsSync(contextPath)) {
        output.system.push(
          "## SESSION CONTEXT (.intern/state/CONTEXT.md)\n" +
            readFileSync(contextPath, "utf8"),
        );
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      const active = getActive(knowledge);
      if (!active) return;
      const ledger = loadLedger(knowledge, active.taskId);
      if (ledger && Array.isArray(output.context)) {
        output.context.push(`HARNESS LEDGER:\n${JSON.stringify(ledger)}`);
      }
    },

    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        const active = getActive(knowledge);
        if (!active) return;
        const ledger = loadLedger(knowledge, active.taskId);
        if (!ledger) {
          throw new Error(
            "BLOCKED: ledger corrupt or unreadable. Re-run intern_index or fix .intern/state/tasks/<id>/LEDGER.md",
          );
        }
        const command: unknown = output.args?.command;
        if (typeof command === "string") {
          const d = canBash(root, ledger, command);
          if (!d.ok) throw new Error(d.reason);
        }
        return;
      }
      if (input.tool !== "edit" && input.tool !== "write") return;
      const active = getActive(knowledge);
      if (!active) return;
      const ledger = loadLedger(knowledge, active.taskId);
      if (!ledger) {
        throw new Error(
          "BLOCKED: ledger corrupt or unreadable. Re-run intern_index or fix .intern/state/tasks/<id>/LEDGER.md",
        );
      }
      const filePath: string | undefined =
        output.args?.filePath ?? output.args?.path;
      if (!filePath) return;
      let targetStatus: string | undefined;
      try {
        const abs = isAbsolute(filePath) ? filePath : join(root, filePath);
        if (existsSync(abs)) targetStatus = parseStatus(readFileSync(abs, "utf8")) ?? undefined;
      } catch {
        /* ignore */
      }
      const d = canEdit(root, ledger, filePath, { targetStatus });
      if (!d.ok) throw new Error(d.reason);
      let dirty = false;
      if (ledger.forceAllow) {
        ledger.forceAllow = false;
        dirty = true;
      }
      if (ledger.phase === "planned") {
        ledger.phase = "acting";
        dirty = true;
      }
      if (dirty) {
        ledger.updated = nowIso();
        saveLedger(knowledge, ledger);
      }
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "read") return;
      const active = getActive(knowledge);
      if (!active) return;
      const ledger = loadLedger(knowledge, active.taskId);
      if (!ledger) return;
      const filePath: string | undefined =
        input.args?.filePath ?? input.args?.path;
      if (!filePath) return;
      const rel = toRel(root, filePath);
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
    },

    tool: {
      intern_boot: tool({
        description:
          "Collect session context from disk and write .intern/state/CONTEXT.md. Call once per new session.",
        args: {},
        async execute() {
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
          return pack;
        },
      }),

      intern_index: tool({
        description:
          "Scan a spec folder, build/refresh INDEX.md, start or resume a task.",
        args: {
          specRoot: tool.schema.string().describe("Relative spec folder path."),
        },
        async execute(args) {
          const specRel = toRel(root, args.specRoot.replace(/\/+$/, ""));
          if (!specRel || specRel.startsWith("..")) {
            throw new Error(`specRoot outside repo: ${args.specRoot}`);
          }
          const taskId = slug(specRel);
          const idx = buildIndex(join(root, specRel), root, target);
          saveIndex(knowledge, taskId, idx);
          const ledger = loadLedger(knowledge, taskId) ?? emptyLedger(taskId, specRel);
          ledger.requiredReads = idx.requiredReads.map((r) => ({ ...r, read: false }));
          ledger.scope = idx.requiredReads.map((r) => r.path);
          if (ledger.scope.length === 0) ledger.scope = [specRel];
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
          setActive(knowledge, taskId, specRel);
          return `INDEX built. task=${taskId} reads=${idx.requiredReads.length}`;
        },
      }),

      intern_context: tool({
        description: "Return only a slice of spec/code (minimal context).",
        args: {
          path: tool.schema.string(),
          selector: tool.schema.string(),
          kind: tool.schema.enum(["section", "function"]),
        },
        async execute(args) {
          const rel = toRel(root, args.path);
          if (!rel || rel.startsWith("..")) {
            throw new Error(`path outside repo: ${args.path}`);
          }
          const text = readFileSync(join(root, rel), "utf8");
          return args.kind === "section"
            ? sliceSection(text, args.selector)
            : sliceFunction(text, args.selector);
        },
      }),

      intern_step: tool({
        description: "Declare the active plan step and anchor.",
        args: { stepId: tool.schema.string(), anchor: tool.schema.string() },
        async execute(args) {
          const active = getActive(knowledge);
          if (!active) return "No active task. Run intern_index first.";
          const ledger = loadLedger(knowledge, active.taskId);
          if (!ledger) return "Ledger missing.";
          const idx = readIndex(knowledge, active.taskId);
          const d = canStep(ledger, args.anchor, idx?.anchors ?? []);
          if (!d.ok) throw new Error(d.reason);
          ledger.activeStep = args.stepId;
          ledger.phase = "planned";
          ledger.updated = nowIso();
          saveLedger(knowledge, ledger);
          return `Step ${args.stepId} active (anchor ${args.anchor}).`;
        },
      }),

      intern_evidence: tool({
        description: "Append an evidence record for a step.",
        args: {
          step: tool.schema.string(),
          claim: tool.schema.string(),
          proof: tool.schema.string(),
          result: tool.schema.enum(["pass", "fail"]),
        },
        async execute(args) {
          const active = getActive(knowledge);
          if (!active) return "No active task.";
          const ledger = loadLedger(knowledge, active.taskId);
          if (!ledger) return "Ledger missing.";
          if (!ledger.steps.some((s) => s.id === args.step)) {
            throw new Error(`unknown step: ${args.step}`);
          }
          appendEvidence(
            knowledge,
            active.taskId,
            `## ${args.step} ${nowIso()} result=${args.result}\nclaim: ${args.claim}\nproof: ${args.proof}`,
          );
          ledger.phase = "verifying";
          ledger.updated = nowIso();
          saveLedger(knowledge, ledger);
          return `Evidence recorded for ${args.step} (${args.result}).`;
        },
      }),

      intern_close: tool({
        description: "Close the task after all steps have passing evidence.",
        args: {},
        async execute() {
          const active = getActive(knowledge);
          if (!active) return "No active task.";
          const ledger = loadLedger(knowledge, active.taskId);
          if (!ledger) return "Ledger missing.";
          const d = canClose(ledger, readEvidence(knowledge, active.taskId));
          if (!d.ok) throw new Error(d.reason);
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
          return `Task ${active.taskId} closed. Daily log: ${dailyName}`;
        },
      }),

      intern_status: tool({
        description: "Show current phase and ledger summary.",
        args: {},
        async execute() {
          const active = getActive(knowledge);
          if (!active) return "No active task.";
          const ledger = loadLedger(knowledge, active.taskId);
          if (!ledger) return "Ledger missing.";
          return JSON.stringify(ledger, null, 2);
        },
      }),

      intern_override: tool({
        description: "Override a gate with a recorded reason (escape hatch).",
        args: { reason: tool.schema.string() },
        async execute(args) {
          const active = getActive(knowledge);
          if (!active) return "No active task.";
          const ledger = loadLedger(knowledge, active.taskId);
          if (!ledger) return "Ledger missing.";
          ledger.decisions.push(`OVERRIDE ${nowIso()}: ${args.reason}`);
          ledger.forceAllow = true;
          ledger.updated = nowIso();
          saveLedger(knowledge, ledger);
          appendEvidence(
            knowledge,
            active.taskId,
            `## OVERRIDE ${nowIso()}\nreason: ${args.reason}`,
          );
          return "Override recorded.";
        },
      }),
    },
  };
};
