export function sliceSection(md: string, heading: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^#{1,6}\s+/.test(l) && l.includes(heading));
  if (start === -1) return "";
  const level = (lines[start].match(/^#+/) ?? ["#"])[0].length;
  const out: string[] = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripNonCode(line: string): string {
  return line
    .replace(/\/\/.*$/, "")
    .replace(/\/\*.*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

export function sliceFunction(code: string, name: string): string {
  const lines = code.split("\n");
  const re = new RegExp(`\\bfunc\\s+${escapeRegex(name)}\\s*[(<]`);
  const start = lines.findIndex(
    (l) => !l.trim().startsWith("//") && re.test(l),
  );
  if (start === -1) return "";
  let depth = 0;
  let seen = false;
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (!seen && i > start) {
      const t = lines[i].trim();
      if (
        t === "" ||
        t === "}" ||
        /^(func|var|let|init|deinit|subscript|@|\/\/\/)/.test(t)
      ) {
        break;
      }
    }
    out.push(lines[i]);
    for (const ch of stripNonCode(lines[i])) {
      if (ch === "{") {
        depth++;
        seen = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (seen && depth <= 0) break;
  }
  return out.join("\n");
}
