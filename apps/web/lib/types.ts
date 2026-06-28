// ─── Blockend design tokens ───────────────────────────────────────────────────
export type AccentColor = "accent" | "ready" | "muted";

// ─── Nav ──────────────────────────────────────────────────────────────────────
export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export type TerminalLineType = "cmd" | "out" | "tree";

export interface TerminalLine {
  type: TerminalLineType;
  text: string;
}

// ─── Problem section ──────────────────────────────────────────────────────────
export interface BlockChip {
  label: string;
  available: boolean;
}

// ─── How it works ─────────────────────────────────────────────────────────────
export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  command: string;
  commandMuted?: boolean;
}

// ─── Rate-limiter spotlight ───────────────────────────────────────────────────
export interface FeaturePoint {
  text: string;
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
export type BrickStatus = "ready" | "planned";

export interface RoadmapBrick {
  label: string;
  description: string;
  status: BrickStatus;
  wide?: boolean;
}

// ─── Philosophy ───────────────────────────────────────────────────────────────
export interface PhilosophyCard {
  title: string;
  body: string;
}

// ─── CLI Init simulation (new section) ────────────────────────────────────────
export type InitStepStatus = "done" | "active" | "pending";

export interface InitStep {
  id: string;
  label: string;
  output?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
export interface FooterLink {
  href: string;
  label: string;
}
