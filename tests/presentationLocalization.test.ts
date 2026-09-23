import { describe, expect, it } from "vitest";
import { seedData } from "../src/lib/seed";
import {
  localizedEvidenceFamily,
  localizedEvaluationDataQuality,
  localizedEvaluationDiagnostics,
  localizedEvaluationWhyNow,
} from "../src/lib/presentationLocalization";
import { buildStockVisualAnalysisGroups } from "../src/lib/visualEvidence";
import type { Evaluation, Recipe } from "../src/types";

const recipe: Recipe = {
  id: "recipe-system-copy",
  version: 1,
  name: "User authored recipe name",
  purpose: "Keep this user-authored purpose unchanged.",
  timeHorizon: "Swing",
  intendedUseCase: "Review",
  notes: "User notes stay as entered.",
  conditions: [],
  createdAt: "2026-09-01T00:00:00.000Z",
};

const evaluation: Evaluation = {
  eyeId: "eye-system-copy",
  recipeId: recipe.id,
  recipeVersion: 1,
  previousState: "Not Relevant",
  currentState: "Not Relevant",
  stateChanged: false,
  whyNow: "User authored recipe name v1 remains Not Relevant because the current condition mix is materially unchanged.",
  supportingEvidence: [],
  contradictingEvidence: [],
  missingData: ["Revenue growth is missing data for Growth formula."],
  staleData: ["Snapshot freshness is stale."],
  dataQuality: "Mock-backed snapshot from Market. Partial confidence due to missing or stale inputs.",
  setupStrength: "Low",
  actionUrgency: "Wait",
  alertSuggested: false,
  evaluatedAt: "2026-09-23T12:00:00.000Z",
  conditionResults: [{
    conditionId: "condition-revenue",
    role: "Eligibility Filter",
    passed: false,
    metricKey: "revenue_growth_yoy",
    formulaKey: "growth_formula",
    explanation: "Revenue growth is missing data for Growth formula.",
    missingData: true,
  }],
};

describe("presentation-only localization for generated review copy", () => {
  it("reconstructs generated why-now text from evaluation state without changing authored names", () => {
    const original = structuredClone(evaluation);
    const korean = localizedEvaluationWhyNow("ko", evaluation, recipe);
    expect(korean).toContain("User authored recipe name v1");
    expect(korean).toContain("해당 없음 상태를 유지합니다.");
    expect(korean).not.toContain("remains Not Relevant");
    expect(evaluation).toEqual(original);
    expect(localizedEvaluationWhyNow("en", evaluation, recipe)).toBe(evaluation.whyNow);
  });

  it("keeps unknown or user-authored copy byte-for-byte", () => {
    const authored = "Keep my manual evaluation note in exactly this wording.";
    expect(localizedEvaluationWhyNow("ko", { ...evaluation, whyNow: authored }, recipe)).toBe(authored);
    expect(localizedEvaluationDataQuality("ko", "External source label from a custom adapter")).toBe("External source label from a custom adapter");
  });

  it("localizes generated data-quality grammar and preserves provider names", () => {
    const quality = localizedEvaluationDataQuality("ko", evaluation.dataQuality);
    expect(quality).toContain("데이터 원천: Market.");
    expect(quality).toContain("누락되었거나 오래된 입력");
    expect(quality).not.toContain("Mock-backed snapshot from Market");
    expect(quality).not.toContain("Partial confidence due to missing or stale inputs");
    expect(localizedEvaluationDataQuality("en", evaluation.dataQuality)).toBe(evaluation.dataQuality);
  });

  it("builds Korean missing and stale diagnostics from structured condition data", () => {
    const diagnostics = localizedEvaluationDiagnostics("ko", evaluation);
    expect(diagnostics.missingData).toEqual([
      "매출 성장률 입력값이 누락되었습니다 (계산식 growth_formula).",
    ]);
    expect(diagnostics.staleData).toEqual(["스냅샷 최신성: 오래됨."]);
    expect(diagnostics.missingData.join(" ")).not.toContain("is missing data for");
    expect(localizedEvaluationDiagnostics("en", evaluation)).toEqual({
      missingData: evaluation.missingData,
      staleData: evaluation.staleData,
    });
  });

  it("localizes the Financial Quality evidence card and family for Korean review", () => {
    const stock = seedData.stocks.find((item) => item.symbol === "AAPL")!;
    const source = seedData.snapshots.find((item) => item.stockId === stock.id)!;
    const snapshot = { ...source, revenueGrowthYoY: 0, marginChangePct: 0 };
    const card = buildStockVisualAnalysisGroups({
      stock,
      snapshot,
      eyes: [],
      recipes: [],
      benchmark: "SPY",
      lookbackLabel: "20D",
      language: "ko",
    }).flatMap((group) => group.cards).find((item) => item.id.endsWith("-quality"))!;

    expect(localizedEvidenceFamily("ko", card.family)).toBe("재무 건전성");
    expect(card.title).toBe("기초 체력 점검");
    expect(card.summary).toContain("매출 성장률");
    expect(card.summary).toContain("마진 변화");
    expect(card.effect).not.toContain("Weak business quality");
    expect(card.whyItMatters).not.toContain("Price damage matters less");
    expect(card.metric.currentLabel).toBe("0.0% 매출 / 0.0포인트 마진");
    expect(card.metric.thresholdLabel).toBe("매출 성장률 ≥ 0%, 마진 변화 > -3포인트");
    expect(card.metric.comparisonLabel).toBe("최근 영업 흐름");
    expect(card.visual.kind).toBe("checklist");
    if (card.visual.kind === "checklist") {
      expect(card.visual.items?.map((item) => item.label)).toEqual([
        "매출 성장률 0.0%",
        "마진 변화 0.0포인트",
      ]);
    }
    expect(card.formulaName).toBe("기초 체력 체크");
    expect(card.relatedConditionLabel).not.toContain("No active recipe condition");

    const englishCard = buildStockVisualAnalysisGroups({
      stock,
      snapshot,
      eyes: [],
      recipes: [],
      benchmark: "SPY",
      lookbackLabel: "20D",
      language: "en",
    }).flatMap((group) => group.cards).find((item) => item.id.endsWith("-quality"))!;
    expect(englishCard.title).toBe("Financial quality check");
    expect(englishCard.metric.currentLabel).toBe("0.0% rev / 0.0 pts margin");
    expect(englishCard.visual.kind).toBe("checklist");
    if (englishCard.visual.kind === "checklist") {
      expect(englishCard.visual.items?.map((item) => item.label)).toEqual([
        "Revenue growth 0.0%",
        "Margin change 0.0 pts",
      ]);
    }
  });
});
