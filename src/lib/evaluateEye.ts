import { Evaluation, Eye, EyeState, MockSnapshot, Recipe } from "../types";

const nextStateFromSnapshot = (snapshot: MockSnapshot): EyeState => {
  if (snapshot.riskFlags.includes("thesis_broken")) {
    return "Thesis Broken";
  }

  if (snapshot.riskFlags.length >= 2 || snapshot.analystRevisionTrend === "weak") {
    return "Thesis Risk Rising";
  }

  const score =
    (snapshot.drawdownPct <= -25 ? 1 : 0) +
    (snapshot.nearSupport ? 1 : 0) +
    (snapshot.stabilizationScore >= 65 ? 1 : 0) +
    (snapshot.valuationDiscount ? 1 : 0) -
    (snapshot.earningsSoon ? 1 : 0);

  if (score >= 4) {
    return "Attention Needed";
  }
  if (score === 3) {
    return "Opportunity Zone Forming";
  }
  if (score === 2) {
    return "Watch Closely";
  }
  if (score === 1) {
    return "Becoming Interesting";
  }
  return "Not Relevant";
};

export const evaluateEye = (
  eye: Eye,
  recipe: Recipe,
  snapshot: MockSnapshot,
): Evaluation => {
  const previousState = eye.lastEvaluation?.currentState ?? "Not Relevant";
  const currentState = nextStateFromSnapshot(snapshot);

  const supportingEvidence: string[] = [];
  const contradictingEvidence: string[] = [];

  if (snapshot.drawdownPct <= -25) {
    supportingEvidence.push(
      `${Math.abs(snapshot.drawdownPct)}% drawdown from the recent high fits a bargain-style setup.`,
    );
  } else {
    contradictingEvidence.push(
      `Only ${Math.abs(snapshot.drawdownPct)}% off the recent high, so the discount is not deep yet.`,
    );
  }

  if (snapshot.nearSupport) {
    supportingEvidence.push("Price is holding near a prior support zone.");
  } else {
    contradictingEvidence.push("Price has not stabilized near support yet.");
  }

  if (snapshot.stabilizationScore >= 65) {
    supportingEvidence.push("Selling pressure is showing early signs of stabilization.");
  } else {
    contradictingEvidence.push("Stabilization is still weak.");
  }

  if (snapshot.valuationDiscount) {
    supportingEvidence.push("Valuation looks more attractive than the recent baseline.");
  } else {
    contradictingEvidence.push("Valuation has not clearly reset yet.");
  }

  if (snapshot.earningsSoon) {
    contradictingEvidence.push("An earnings event is close, which raises short-term uncertainty.");
  }

  if (snapshot.analystRevisionTrend === "weak") {
    contradictingEvidence.push("Analyst revision trend is still weak.");
  } else if (snapshot.analystRevisionTrend === "improving") {
    supportingEvidence.push("Analyst revisions are stabilizing or improving.");
  }

  const riskEvidence = snapshot.riskFlags
    .filter((flag) => flag !== "thesis_broken")
    .map((flag) => flag.replaceAll("_", " "));
  contradictingEvidence.push(...riskEvidence.map((flag) => `Risk flag: ${flag}.`));

  const stateChanged = previousState !== currentState;
  const staleData =
    snapshot.freshness === "Stale" || snapshot.freshness === "Partial"
      ? [`Snapshot freshness is ${snapshot.freshness.toLowerCase()}.`]
      : [];
  const whyNow = stateChanged
    ? `${recipe.name} changed from ${previousState} to ${currentState} because the latest evidence mix shifted.`
    : `${recipe.name} remains ${currentState} because the latest evidence mix is mostly unchanged.`;

  const priority =
    currentState === "Attention Needed" || currentState === "Thesis Broken"
      ? "Actively Review"
      : currentState === "Opportunity Zone Forming" || currentState === "Thesis Risk Rising"
        ? "Review Soon"
        : "Wait";

  return {
    eyeId: eye.id,
    previousState,
    currentState,
    stateChanged,
    whyNow,
    supportingEvidence,
    contradictingEvidence,
    missingData: [],
    staleData,
    dataQuality: snapshot.isMock
      ? `Mock-backed snapshot from ${snapshot.sourceName}.`
      : `Snapshot from ${snapshot.sourceName}.`,
    setupStrength:
      currentState === "Attention Needed" || currentState === "Opportunity Zone Forming"
        ? "High"
        : currentState === "Watch Closely" || currentState === "Thesis Risk Rising"
          ? "Medium"
          : "Low",
    actionUrgency: priority,
    alertSuggested:
      stateChanged &&
      [
        "Opportunity Zone Forming",
        "Attention Needed",
        "Thesis Risk Rising",
        "Thesis Broken",
      ].includes(currentState),
    alertReason: stateChanged ? whyNow : undefined,
    evaluatedAt: snapshot.updatedAt,
  };
};
