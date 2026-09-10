import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

/** Placeholder tokens used by the spec template. */
const NAME_TOKEN = /<SpecName>/g;
const ROLE_TOKEN = /<role>/g;
const DATE_TOKEN = /<YYYY-MM-DD>/g;

export interface NewSpecOptions {
  /** Absolute path to the `_template` directory that holds `SpecName/`. */
  template: string;
  /** Absolute path to the plans directory where specs live. */
  plansDir: string;
  /** Spec name, e.g. `FeatureX` or `Module/FeatureX`. */
  name: string;
  /** Role substituted for `<role>`. Default: `Engineer`. */
  role?: string;
  /** Date substituted for `<YYYY-MM-DD>`. Default: today. */
  date?: string;
}

export interface NewSpecResult {
  name: string;
  dir: string;
  files: string[];
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Normalize a spec name into a safe relative path (forward slashes). */
export function normalizeSpecName(raw: string): string {
  const name = raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!name) throw new Error("spec name is required");
  if (name.split("/").some((p) => p === "" || p === "." || p === "..")) {
    throw new Error(`invalid spec name: ${raw}`);
  }
  return name;
}

/**
 * Locate the spec `_template` directory.
 * - Simple profile: `<plansDir>/_template`
 * - Advanced profile: `<templatesDir>/_template` (e.g. `05-templates`)
 */
export function findSpecTemplate(
  plansDir: string,
  templatesDir?: string,
): string | null {
  const candidates = [join(plansDir, "_template")];
  if (templatesDir) candidates.push(join(templatesDir, "_template"));
  return (
    candidates.find((p) => existsSync(p) && statSync(p).isDirectory()) ?? null
  );
}

/**
 * Create a new spec folder from the template, substituting the placeholders
 * (`<SpecName>`, `<role>`, `<YYYY-MM-DD>`). Throws if the destination exists.
 */
export function newSpec(opts: NewSpecOptions): NewSpecResult {
  const name = normalizeSpecName(opts.name);
  const srcBase = join(opts.template, "SpecName");
  const tpl = existsSync(srcBase) ? srcBase : opts.template;
  if (!existsSync(tpl) || !statSync(tpl).isDirectory()) {
    throw new Error(`spec template not found: ${opts.template}`);
  }
  const dest = join(opts.plansDir, name);
  if (existsSync(dest)) {
    throw new Error(`spec folder already exists: ${name}`);
  }

  const role = opts.role?.trim() || "Engineer";
  const date = opts.date?.trim() || today();
  const leaf = basename(name);
  const files: string[] = [];

  for (const entry of readdirSync(tpl)) {
    const srcFile = join(tpl, entry);
    if (!statSync(srcFile).isFile()) continue;
    const text = readFileSync(srcFile, "utf8")
      .replace(NAME_TOKEN, leaf)
      .replace(ROLE_TOKEN, role)
      .replace(DATE_TOKEN, date);
    const out = join(dest, entry);
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, text);
    files.push(out);
  }

  if (files.length === 0) {
    throw new Error(`spec template is empty: ${opts.template}`);
  }
  return { name, dir: dest, files };
}
