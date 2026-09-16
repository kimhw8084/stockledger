import { expect, it } from "vitest";
import { publishRecipeRevision } from "../src/domain/recipeRevision";
import { evaluateWorkspace } from "../src/domain/evaluateWorkspace";
import { contentHash } from "../src/domain/contentHash";
import { buildChartData } from "../src/domain/chartSeries";
import { seedData } from "../src/lib/seed";
import { validateAppData } from "../src/domain/appDataSchema";

it("publishes immutable recipe revisions with stable condition lineage", () => {
  const source = structuredClone(seedData.recipes[0]);
  const original = JSON.stringify(source);
  const next = publishRecipeRevision([source], source, { name: "Changed" }, "recipe-next");
  expect(JSON.stringify(source)).toBe(original);
  expect(next.version).toBe(source.version + 1);
  expect(next.conditions[0].lineageId).toBe(source.conditions[0].id);
  expect(next.conditions[0].id).not.toBe(source.conditions[0].id);
});
it("records evaluation history once per evidence revision, preserving previous records", () => {
  const now = new Date("2026-09-14T22:00:00Z");
  const first = evaluateWorkspace(structuredClone(seedData), now);
  const saved = JSON.stringify(first.evaluations);
  const repeated = evaluateWorkspace(first, now);
  expect(repeated.evaluations?.length).toBe(first.evaluations?.length);
  expect(repeated.alerts.length).toBe(first.alerts.length);
  const revised = evaluateWorkspace({ ...first, eyes: first.eyes.map((eye, i) => i ? eye : { ...eye, manualFlags: ["Review required"] }) }, now);
  expect(revised.evaluations?.length).toBe((first.evaluations?.length ?? 0) + 1);
  expect(JSON.stringify(first.evaluations)).toBe(saved);
  expect(() => validateAppData(revised)).not.toThrow();
});
it("hashes equivalent object key orders consistently", () => {
  expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  expect(contentHash({ a: 2, b: 2 })).not.toBe(contentHash({ b: 2, a: 1 }));
});
it("charts use lookback windows and comparable percentage returns", () => {
  const snapshot = { ...seedData.snapshots[0], priceHistorySeries: Array.from({length:70}, (_, i) => 100+i), benchmarkHistorySeries: Array.from({length:70}, (_, i) => (100+i)*5) };
  const chart = buildChartData(snapshot, "20D", "SPY");
  expect(chart.prices.length).toBe(21);
  expect(chart.returns[20]).toBeCloseTo(chart.benchmarkReturns[20], 9);
  expect(buildChartData(snapshot, "3M", "SPY").prices.length).toBe(64);
  expect(buildChartData(snapshot, "3M", "QQQ").benchmarkReturns).toEqual([]);
});

it("respects cooldowns and permits a later recurrence", () => {
  const now = new Date("2026-09-14T22:00:00Z");
  const data = structuredClone(seedData);
  data.eyes = [{ ...data.eyes[0], lastEvaluation: undefined }];
  data.alerts = []; data.decisions = []; data.outcomes = [];
  const recipe = data.recipes.find(recipe => recipe.id === data.eyes[0].recipeId)!;
  recipe.conditions = ["Eligibility Filter", "Supporting Evidence", "Timing Trigger"].map((role, index) => ({ id: `c-${index}`, label: role, kind: "supporting", role: role as any, metricKey: "days_until_earnings", operator: "=", value: 7 }));
  recipe.alertConfig = { cooldownHours: 24, dedupeKey: "state_change", priorityOnAttention: "Low", priorityOnRisk: "High" };
  const stockId = data.eyes[0].stockId;
  data.snapshots = data.snapshots.map(snapshot => snapshot.stockId === stockId ? { ...snapshot, daysUntilEarnings: 7 } : snapshot);
  const first = evaluateWorkspace(data, now);
  expect(first.alerts).toHaveLength(1);
  expect(first.alerts[0].priority).toBe("Low");
  const change = (state: typeof data, days: number, clock: Date) => evaluateWorkspace({ ...state, snapshots: state.snapshots.map(snapshot => snapshot.stockId === stockId ? { ...snapshot, daysUntilEarnings: days } : snapshot) }, clock);
  const reset = change(first, 8, now);
  const repeat = change(reset, 7, now);
  expect(repeat.alerts).toHaveLength(1);
  const later = new Date("2026-09-16T22:00:00Z");
  const laterReset = change(repeat, 8, later);
  expect(change(laterReset, 7, later).alerts).toHaveLength(2);
});
