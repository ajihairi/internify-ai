import { test, expect } from "bun:test";
import {
  PROVIDERS,
  providerNames,
  getProvider,
  commandFileName,
  commandName,
  commandRelPath,
  renderCommand,
} from "./providers";

test("provider registry", () => {
  expect(providerNames()).toContain("opencode");
  expect(providerNames()).toContain("gemini");
  expect(getProvider("opencode")?.hooks).toBe(true);
  expect(getProvider("gemini")?.hooks).toBe(false);
  expect(getProvider("nope")).toBeNull();
});

test("commandFileName per format", () => {
  expect(commandFileName(PROVIDERS.opencode, "work")).toBe("work.md");
  expect(commandFileName(PROVIDERS.gemini, "work")).toBe("work.toml");
  expect(commandFileName(PROVIDERS.cursor, "work")).toBe("work.mdc");
});

test("commandName is branded", () => {
  expect(commandName(PROVIDERS.opencode, "work")).toBe("internify.work");
  expect(commandName(PROVIDERS.gemini, "boot")).toBe("internify.boot");
  expect(commandName(PROVIDERS.claude, "work")).toBe("internify:work");
});

test("commandRelPath is branded + provider-specific", () => {
  expect(commandRelPath(PROVIDERS.opencode, "work")).toBe("internify.work.md");
  expect(commandRelPath(PROVIDERS.gemini, "boot")).toBe("internify.boot.toml");
  expect(commandRelPath(PROVIDERS.cursor, "work")).toBe("internify-work.mdc");
  expect(commandRelPath(PROVIDERS.claude, "work")).toBe("internify/work.md");
});

test("renderCommand: md has frontmatter", () => {
  const out = renderCommand(PROVIDERS.claude, "work", "Start work", "do it");
  expect(out).toContain("---");
  expect(out).toContain("description: Start work");
  expect(out).toContain("do it");
});

test("renderCommand: toml wraps the prompt", () => {
  const out = renderCommand(PROVIDERS.gemini, "work", "Start work", "do it");
  expect(out).toContain('description = "Start work"');
  expect(out).toContain('prompt = """');
  expect(out).toContain("do it");
});

test("renderCommand: mdc has alwaysApply", () => {
  const out = renderCommand(PROVIDERS.cursor, "work", "Start work", "do it");
  expect(out).toContain("alwaysApply: false");
  expect(out).toContain("do it");
});
