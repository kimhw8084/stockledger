export type EyeState =
  | "Not Relevant"
  | "Becoming Interesting"
  | "Watch Closely"
  | "Opportunity Zone Forming"
  | "Attention Needed"
  | "Thesis Risk Rising"
  | "Thesis Broken";

export type DecisionAction =
  | "Entered"
  | "Skipped"
  | "Snoozed"
  | "Revised"
  | "Rejected"
  | "Marked Thesis Broken";

export type FreshnessStatus =
  | "Fresh"
  | "Delayed"
  | "Stale"
  | "Partial"
  | "Unavailable"
  | "Mock Data";

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  thesis: string;
  createdAt: string;
}

export interface RecipeCondition {
  id: string;
  label: string;
  kind: "required" | "supporting" | "negative" | "disqualifier";
}

export interface Recipe {
  id: string;
  version: number;
  name: string;
  purpose: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  conditions: RecipeCondition[];
  createdAt: string;
}

export interface MockSnapshot {
  stockId: string;
  price: number;
  drawdownPct: number;
  nearSupport: boolean;
  stabilizationScore: number;
  valuationDiscount: boolean;
  analystRevisionTrend: "improving" | "flat" | "weak";
  earningsSoon: boolean;
  riskFlags: string[];
  updatedAt: string;
  sourceName: string;
  freshness: FreshnessStatus;
  isMock: boolean;
}

export interface Evaluation {
  eyeId: string;
  previousState: EyeState;
  currentState: EyeState;
  stateChanged: boolean;
  whyNow: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingData: string[];
  staleData: string[];
  dataQuality: string;
  setupStrength: "Low" | "Medium" | "High";
  actionUrgency: "Wait" | "Review Soon" | "Actively Review";
  alertSuggested: boolean;
  alertReason?: string;
  evaluatedAt: string;
}

export interface Eye {
  id: string;
  stockId: string;
  recipeId: string;
  createdAt: string;
  thesisSnapshot: string;
  lastEvaluation?: Evaluation;
}

export interface Alert {
  id: string;
  eyeId: string;
  title: string;
  stateChange: string;
  whyNow: string;
  supportingEvidence: string[];
  risks: string[];
  dataQuality: string;
  priority: "Low" | "Medium" | "High";
  createdAt: string;
  reviewed: boolean;
}

export interface Decision {
  id: string;
  eyeId: string;
  alertId?: string;
  action: DecisionAction;
  note: string;
  concern: string;
  thesisValid: "Yes" | "Partly" | "No";
  timing: "Early" | "On Time" | "Late";
  createdAt: string;
}

export interface Outcome {
  id: string;
  decisionId: string;
  reviewWindow: string;
  priceChangeNote: string;
  maxRunupNote: string;
  maxDrawdownNote: string;
  lesson: string;
  recipeSuggestion: string;
  createdAt: string;
}

export interface AppData {
  stocks: Stock[];
  recipes: Recipe[];
  eyes: Eye[];
  alerts: Alert[];
  decisions: Decision[];
  outcomes: Outcome[];
  snapshots: MockSnapshot[];
}
