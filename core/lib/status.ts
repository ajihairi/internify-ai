export type DocStatus = "draft" | "review" | "fixed";

/**
 * Read the `status:` from a document's YAML frontmatter.
 * Returns null when there is no frontmatter or no valid status.
 */
export function parseStatus(md: string): DocStatus | null {
  const m = md.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const s = m[1].match(/^\s*status\s*:\s*["']?([A-Za-z]+)["']?\s*$/m);
  if (!s) return null;
  const v = s[1].toLowerCase();
  return v === "draft" || v === "review" || v === "fixed" ? v : null;
}

/**
 * A document must be read before editing when it has no status (default,
 * back-compat) or is `fixed` (canonical / source of truth).
 * `draft` and `review` are optional reads.
 */
export function isRequiredRead(status: DocStatus | null): boolean {
  return status === null || status === "fixed";
}

/** `fixed` documents must not be rewritten. */
export function isFixed(status: DocStatus | null): boolean {
  return status === "fixed";
}
