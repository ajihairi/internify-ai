const begin = (tag: string) => `<!-- intern:${tag}:begin -->`;
const end = (tag: string) => `<!-- intern:${tag}:end -->`;

export function extractBlock(md: string, tag: string): string | null {
  const b = begin(tag);
  const e = end(tag);
  const i = md.indexOf(b);
  const j = md.indexOf(e);
  if (i === -1 || j === -1 || j < i) return null;
  return md.slice(i + b.length, j).trim();
}

export function upsertBlock(md: string, tag: string, json: unknown): string {
  const block = `${begin(tag)}\n${JSON.stringify(json, null, 2)}\n${end(tag)}`;
  const re = new RegExp(
    `<!-- intern:${tag}:begin -->[\\s\\S]*?<!-- intern:${tag}:end -->`,
  );
  if (re.test(md)) return md.replace(re, () => block);
  return md.trimEnd() + "\n\n" + block + "\n";
}
