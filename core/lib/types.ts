export type Phase =
  | "idle"
  | "orient"
  | "grounded"
  | "planned"
  | "acting"
  | "verifying"
  | "recorded"
  | "done";

export interface RequiredRead {
  key: string;
  path: string;
  kind: "spec" | "code";
  hash: string;
  read: boolean;
  /** Document status from frontmatter, if any. */
  status?: "draft" | "review" | "fixed";
  /** Whether this read must be satisfied before editing. Defaults to true. */
  required?: boolean;
}

export interface Anchor {
  id: string;
  file: string;
  line: number;
  token: string;
  status: "ok" | "stale" | "unresolved";
}

export interface Slice {
  key: string;
  from: string;
  selector: string;
}

export interface IndexFile {
  specRoot: string;
  generated: string;
  requiredReads: RequiredRead[];
  anchors: Anchor[];
  slices: Slice[];
}

export interface PlanStep {
  id: string;
  title: string;
  anchor: string;
  done: boolean;
}

export interface Ledger {
  taskId: string;
  specRoot: string;
  role: string;
  phase: Phase;
  scope: string[];
  requiredReads: RequiredRead[];
  steps: PlanStep[];
  decisions: string[];
  openQuestions: string[];
  activeStep: string | null;
  updated: string;
  forceAllow?: boolean;
}

export interface ManifestEntry {
  path: string;
  hash: string;
  size: number;
  mtimeMs: number;
  updated: string;
}
