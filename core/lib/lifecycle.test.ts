import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyLedger } from "./state";
import { saveLedger, setActive, loadActiveTasks, saveActiveTasks } from "./io";
import {
  removeActiveTask,
  pruneActiveTasks,
  resolveDailyChecklists,
} from "./lifecycle";

function tmp() {
  return mkdtempSync(join(tmpdir(), "internify-lifecycle-"));
}

function seedLedger(k: string, taskId: string) {
  saveLedger(k, emptyLedger(taskId, `spec/${taskId}`));
}

test("removeActiveTask removes only the closed task", () => {
  const k = tmp();
  setActive(k, "t1", "spec/t1");
  setActive(k, "t2", "spec/t2");
  const rest = removeActiveTask(k, "t1");
  expect(rest.map((t) => t.taskId)).toEqual(["t2"]);
  expect(loadActiveTasks(k).map((t) => t.taskId)).toEqual(["t2"]);
});

test("removeActiveTask promotes first remaining to primary", () => {
  const k = tmp();
  setActive(k, "t1", "spec/t1"); // primary
  setActive(k, "t2", "spec/t2");
  const rest = removeActiveTask(k, "t1");
  expect(rest[0].taskId).toBe("t2");
  expect(rest[0].primary).toBe(true);
});

test("removeActiveTask keeps flags when closed task was not primary", () => {
  const k = tmp();
  setActive(k, "t1", "spec/t1"); // primary
  setActive(k, "t2", "spec/t2");
  const rest = removeActiveTask(k, "t2");
  expect(rest[0].primary).toBe(true);
});

test("removeActiveTask no-op for unknown task", () => {
  const k = tmp();
  setActive(k, "t1", "spec/t1");
  const rest = removeActiveTask(k, "ghost");
  expect(rest.map((t) => t.taskId)).toEqual(["t1"]);
});

test("removeActiveTask clears last entry", () => {
  const k = tmp();
  setActive(k, "t1", "spec/t1");
  const rest = removeActiveTask(k, "t1");
  expect(rest).toEqual([]);
  expect(loadActiveTasks(k)).toEqual([]);
});

test("pruneActiveTasks drops entries without valid ledger", () => {
  const k = tmp();
  seedLedger(k, "valid1");
  setActive(k, "valid1", "spec/valid1");
  setActive(k, "orphan", "spec/orphan");
  const res = pruneActiveTasks(k);
  expect(res.pruned).toEqual(["orphan"]);
  expect(res.kept.map((t) => t.taskId)).toEqual(["valid1"]);
  expect(loadActiveTasks(k).map((t) => t.taskId)).toEqual(["valid1"]);
});

test("pruneActiveTasks promotes primary when primary pruned", () => {
  const k = tmp();
  seedLedger(k, "valid1");
  setActive(k, "orphan", "spec/orphan"); // primary (set first)
  setActive(k, "valid1", "spec/valid1");
  const res = pruneActiveTasks(k);
  expect(res.pruned).toEqual(["orphan"]);
  expect(res.kept[0].taskId).toBe("valid1");
  expect(res.kept[0].primary).toBe(true);
});

test("pruneActiveTasks no-op when all valid", () => {
  const k = tmp();
  seedLedger(k, "t1");
  setActive(k, "t1", "spec/t1");
  const res = pruneActiveTasks(k);
  expect(res.pruned).toEqual([]);
  expect(res.kept.length).toBe(1);
});

test("pruneActiveTasks handles malformed active.json", () => {
  const k = tmp();
  mkdirSync(join(k, "state"), { recursive: true });
  writeFileSync(join(k, "state", "active.json"), "{not json");
  const res = pruneActiveTasks(k);
  expect(res.pruned).toEqual([]);
  expect(res.kept).toEqual([]);
});

test("pruneActiveTasks treats corrupt ledger as orphan", () => {
  const k = tmp();
  setActive(k, "broken", "spec/broken");
  mkdirSync(join(k, "state", "tasks", "broken"), { recursive: true });
  writeFileSync(join(k, "state", "tasks", "broken", "LEDGER.md"), "garbage no json block");
  const res = pruneActiveTasks(k);
  expect(res.pruned).toEqual(["broken"]);
});

test("resolveDailyChecklists flips tagged checkboxes across files", () => {
  const k = tmp();
  const dir = join(k, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "17-09-2026.md"),
    "# Daily\n- [ ] [#t1] DP 414M saat tenor nil\n- [ ] untagged stays\n- [x] [#t1] already done\n",
  );
  writeFileSync(join(dir, "18-09-2026.md"), "# Daily\n- [ ] [#t1] Build success\n");
  const res = resolveDailyChecklists(dir, "t1");
  expect(res.files.sort()).toEqual(["17-09-2026.md", "18-09-2026.md"]);
  expect(res.checked).toBe(2);
  const after = readFileSync(join(dir, "17-09-2026.md"), "utf8");
  expect(after).toContain("- [x] [#t1] DP 414M saat tenor nil");
  expect(after).toContain("- [ ] untagged stays");
});

test("resolveDailyChecklists matches tag anywhere in line", () => {
  const k = tmp();
  const dir = join(k, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "d.md"), "- [ ] cek DP dulu [#t1]\n");
  const res = resolveDailyChecklists(dir, "t1");
  expect(res.checked).toBe(1);
  expect(readFileSync(join(dir, "d.md"), "utf8")).toContain("- [x] cek DP dulu [#t1]");
});

test("resolveDailyChecklists ignores other task tags", () => {
  const k = tmp();
  const dir = join(k, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "d.md"), "- [ ] [#other] bukan tugas t1\n");
  const res = resolveDailyChecklists(dir, "t1");
  expect(res.checked).toBe(0);
  expect(res.files).toEqual([]);
});

test("resolveDailyChecklists missing dir returns empty result", () => {
  const k = tmp();
  const res = resolveDailyChecklists(join(k, "daily"), "t1");
  expect(res).toEqual({ files: [], checked: 0 });
});

test("resolveDailyChecklists skips non-md and unreadable files", () => {
  const k = tmp();
  const dir = join(k, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "notes.txt"), "- [ ] [#t1] not markdown\n");
  const res = resolveDailyChecklists(dir, "t1");
  expect(res.checked).toBe(0);
});
