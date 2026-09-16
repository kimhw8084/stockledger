import { describe, expect, it } from "vitest";
import { seedData } from "../src/lib/seed";
import { evaluateEye } from "../src/lib/evaluateEye";
import { buildLogicLabScorecard, logicThesisRiskLabel } from "../src/lib/logicHelpers";
import { evaluateExpression, referencedExpressionParameters, validateExpressionSyntax } from "../src/lib/expressionEngine";
import { latestCompletedTradingDate, shouldRunAfterClose } from "../src/lib/marketCalendar";
import type { RecipeCondition } from "../src/types";

const eye = seedData.eyes[0];
const snapshot = { ...seedData.snapshots[0], freshness: "Fresh" as const };
const condition = (role: RecipeCondition["role"], expected: number): RecipeCondition => ({
  id: `${role}-${expected}`, kind: "supporting", role,
  metricKey: "days_until_earnings", operator: "=", value: expected, label: role!,
});
const recipe = (conditions: RecipeCondition[]) => ({ ...seedData.recipes[0], conditions, stateConfig: undefined });

describe("eligibility and risk invariants", () => {
  it("never promotes failed eligibility using supporting/timing points", () => {
    const result = evaluateEye(eye, recipe([condition("Eligibility Filter", 999),
      ...[1,2,3].map(i => ({ ...condition("Supporting Evidence", 7), id: `support-${i}` })),
      condition("Timing Trigger", 7)]), { ...snapshot, daysUntilEarnings: 7 });
    expect(result.currentState).toBe("Not Relevant");
    expect(result.alertSuggested).toBe(false);
  });
  it("does not promote when required inputs are missing", () => {
    const result = evaluateEye(eye, recipe([condition("Eligibility Filter", 7),
      condition("Supporting Evidence", 7), condition("Timing Trigger", 7)]),
      { ...snapshot, daysUntilEarnings: undefined });
    expect(result.setupStrength).toBe("Low");
    expect(result.alertSuggested).toBe(false);
    expect(result.conditionResults?.[0].missingData).toBe(true);
  });
  it("blocks opportunity alerts on stale snapshots", () => {
    const result = evaluateEye(eye, recipe([condition("Eligibility Filter", 7),
      condition("Supporting Evidence", 7), condition("Timing Trigger", 7)]),
      { ...snapshot, daysUntilEarnings: 7, freshness: "Stale" });
    expect(result.alertSuggested).toBe(false);
    expect(result.setupStrength).toBe("Low");
  });
  it("uses true risk predicates consistently in the engine and UI", () => {
    const result = evaluateEye(eye, recipe([condition("Hard Disqualifier", 7), condition("Risk Warning", 7)]),
      { ...snapshot, daysUntilEarnings: 7 });
    expect(result.currentState).toBe("Thesis Broken");
    expect(buildLogicLabScorecard(result).blockerCount).toBe(1);
    expect(buildLogicLabScorecard(result).riskPenalty).toBe(12);
    expect(logicThesisRiskLabel("en", result)).toBe("Thesis Broken (Blocked)");
  });
});

describe("bounded expressions and warmups", () => {
  it("recognizes parameters without spaces", () => {
    expect(referencedExpressionParameters("PCT_CHANGE(PRICE_NOW,PRICE_20D_AGO)")).toEqual(["PRICE_NOW", "PRICE_20D_AGO"]);
  });
  it("does not manufacture 200-session averages or 60-session returns from five values", () => {
    const short = { ...snapshot, priceHistorySeries: [10,20,30,40,50] };
    expect(evaluateExpression("PRICE_AVG_200D", ["PRICE_AVG_200D"], short, eye)).toBeUndefined();
    expect(evaluateExpression("PRICE_60D_AGO", ["PRICE_60D_AGO"], short, eye)).toBeUndefined();
  });
  it("evaluates accepted arithmetic and checks arity without executing formulas", () => {
    expect(evaluateExpression("CLAMP(2+3*4,0,10)", [], snapshot, eye)).toBe(10);
    expect(validateExpressionSyntax("AVG(1)", []).valid).toBe(false);
    expect(validateExpressionSyntax("1/0", []).valid).toBe(true);
    expect(evaluateExpression("PCT_CHANGE(2,0)", [], snapshot, eye)).toBeUndefined();
    expect(validateExpressionSyntax("(".repeat(100) + "1" + ")".repeat(100), []).valid).toBe(false);
  });
});

describe("NYSE session dates", () => {
  it.each([
    ["2026-09-14T22:00:00Z", "2026-09-14"],
    ["2026-09-15T13:00:00Z", "2026-09-14"],
    ["2026-09-13T18:00:00Z", "2026-09-11"],
    ["2026-09-08T00:00:00Z", "2026-09-04"],
    ["2026-11-27T18:44:00Z", "2026-11-25"],
    ["2026-11-27T18:45:00Z", "2026-11-27"],
    ["2026-12-24T18:45:00Z", "2026-12-24"],
    ["2027-12-31T22:00:00Z", "2027-12-31"],
    ["2026-03-09T20:45:00Z", "2026-03-09"],
    ["2026-11-02T21:45:00Z", "2026-11-02"],
  ])("%s resolves to %s", (instant, expected) => {
    expect(latestCompletedTradingDate(new Date(instant))).toBe(expected);
  });
  it("does not schedule a weekend close", () => expect(shouldRunAfterClose(new Date("2026-09-12T23:00:00Z"))).toBe(false));
});
