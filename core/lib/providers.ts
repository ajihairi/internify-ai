export type CommandFormat = "md" | "toml" | "mdc";

export interface Provider {
  name: string;
  /** Command directory, relative to the workspace root. */
  commandDir: string;
  format: CommandFormat;
  /** Whether this provider supports tool hooks (gates). */
  hooks: boolean;
  /** Placeholder used for the command arguments. */
  argsToken: string;
}

export const PROVIDERS: Record<string, Provider> = {
  opencode: {
    name: "opencode",
    commandDir: ".opencode/command",
    format: "md",
    hooks: true,
    argsToken: "$ARGUMENTS",
  },
  claude: {
    name: "claude",
    commandDir: ".claude/commands",
    format: "md",
    hooks: true,
    argsToken: "$ARGUMENTS",
  },
  gemini: {
    name: "gemini",
    commandDir: ".gemini/commands",
    format: "toml",
    hooks: false,
    argsToken: "{{args}}",
  },
  qwen: {
    name: "qwen",
    commandDir: ".qwen/commands",
    format: "md",
    hooks: false,
    argsToken: "$ARGUMENTS",
  },
  cursor: {
    name: "cursor",
    commandDir: ".cursor/rules",
    format: "mdc",
    hooks: false,
    argsToken: "$ARGUMENTS",
  },
};

export function providerNames(): string[] {
  return Object.keys(PROVIDERS);
}

export function getProvider(name: string): Provider | null {
  return PROVIDERS[name] ?? null;
}

export function commandFileName(p: Provider, name: string): string {
  const ext = p.format === "toml" ? "toml" : p.format === "mdc" ? "mdc" : "md";
  return `${name}.${ext}`;
}

/** Branded command name as typed in the chat. */
export function commandName(p: Provider, base: string): string {
  return p.name === "claude" ? `internify:${base}` : `internify.${base}`;
}

/**
 * Branded path (relative to the provider's command dir) for a command.
 * - opencode/qwen/gemini: `internify.<base>.<ext>`
 * - claude: `internify/<base>.md` (namespaced → `/internify:<base>`)
 * - cursor: `internify-<base>.mdc`
 */
export function commandRelPath(p: Provider, base: string): string {
  const ext = p.format === "toml" ? "toml" : p.format === "mdc" ? "mdc" : "md";
  if (p.name === "claude") return `internify/${base}.${ext}`;
  if (p.format === "mdc") return `internify-${base}.${ext}`;
  return `internify.${base}.${ext}`;
}

/** Render a command definition into the provider's format. */
export function renderCommand(
  p: Provider,
  name: string,
  description: string,
  body: string,
): string {
  switch (p.format) {
    case "toml":
      return `# ${name}\ndescription = ${JSON.stringify(description)}\nprompt = """\n${body}\n"""\n`;
    case "mdc":
      return `---\ndescription: ${description}\nalwaysApply: false\n---\n\n${body}\n`;
    default:
      return `---\ndescription: ${description}\n---\n\n${body}\n`;
  }
}
