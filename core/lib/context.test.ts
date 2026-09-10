import { test, expect } from "bun:test";
import { sliceSection, sliceFunction } from "./context";

const MD = "# A\n\nalpha\n\n# B\n\nbeta\n";

test("sliceSection returns one heading section", () => {
  expect(sliceSection(MD, "B")).toContain("beta");
  expect(sliceSection(MD, "B")).not.toContain("alpha");
});

test("sliceFunction returns the function block", () => {
  const code = "func a() {\n  x\n}\nfunc b() {\n  y\n}";
  expect(sliceFunction(code, "b")).toContain("y");
  expect(sliceFunction(code, "b")).not.toContain("func a");
});

test("sliceFunction returns empty when function not found", () => {
  const code = "func a() {\n  x\n}";
  expect(sliceFunction(code, "zzz")).toBe("");
});

test("sliceFunction does not overrun a bodyless declaration", () => {
  const code = "protocol P {\n  func foo() async throws\n  func bar() { x }\n}";
  const out = sliceFunction(code, "foo");
  expect(out).toContain("func foo");
  expect(out).not.toContain("x");
});

test("sliceFunction respects name boundaries", () => {
  const code = "func abc() {\n  x\n}";
  expect(sliceFunction(code, "a")).toBe("");
});

test("sliceFunction ignores braces in line comments", () => {
  const code = "func b() {\n  // }\n  y\n}";
  expect(sliceFunction(code, "b")).toContain("y");
});

test("sliceFunction handles nested closures", () => {
  const code = "func c() {\n  run {\n    z\n  }\n}";
  const out = sliceFunction(code, "c");
  expect(out).toContain("run {");
  expect(out).toContain("z");
});

test("sliceFunction ignores braces in string literals", () => {
  const code = 'func foo() {\n  let s = "{"\n}\nfunc bar() {\n  y\n}';
  const out = sliceFunction(code, "foo");
  expect(out).toContain("let s");
  expect(out).not.toContain("func bar");
});

test("sliceFunction ignores braces in inline block comments", () => {
  const code = "func b() {\n  /* } */\n  y\n}";
  expect(sliceFunction(code, "b")).toContain("y");
});

test("sliceFunction does not leak enclosing brace on bodyless decl", () => {
  const code = "protocol P {\n  func foo()\n}";
  expect(sliceFunction(code, "foo")).not.toContain("}");
});

test("sliceFunction skips function declarations inside line comments", () => {
  const code = "// func foo()\nfunc foo() {\n  z\n}";
  expect(sliceFunction(code, "foo")).toContain("z");
});
