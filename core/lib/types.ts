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
