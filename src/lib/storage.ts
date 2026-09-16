import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildMockSnapshot } from "./mockSnapshot";
import { seedData } from "./seed";
import {
  Alert,
  AppData,
  Decision,
  Eye,
  ForwardProofLedger,
  LogicRule,
  LogicSet,
  MetricDefinition,
  MockSnapshot,
  Outcome,
  ProcessedFeatureRecord,
  RawBarArchiveBatch,
  Recipe,
  ReviewLog,
  ScanRun,
  ScanSignal,
  ScannerSettings,
  Stock,
  UniverseSnapshot,
} from "../types";

const STORAGE_KEY = "stockledger.appData.v1";

const cloneSeedData = (): AppData => JSON.parse(JSON.stringify(seedData)) as AppData;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const uniqueMetricsByKey = (items: MetricDefinition[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

const normalizeKoreanTags = (values: string[] | undefined) =>
  (values ?? []).map((value) => {
    switch (value) {
      case "guidance_pressure":
        return "가이던스 압박";
      case "entry_zone":
        return "진입 구간";
      case "stabilization":
        return "안정화";
      case "valuation":
        return "밸류에이션";
      case "risk_check":
        return "위험 점검";
      case "relative_strength":
        return "상대강도";
      case "trend_hold":
        return "추세 유지";
      case "gap_down":
        return "급락 갭";
      case "thesis_recheck":
        return "논리 재점검";
      case "earnings_reset":
        return "실적 리셋";
      case "stabilization_followthrough":
        return "안정화 후속 확인";
      default:
        return value;
    }
  });

const preserveSnapshotFields = (generated: MockSnapshot, existing?: Partial<MockSnapshot>): MockSnapshot => ({
  ...generated,
  plannedEntryLow: existing?.plannedEntryLow ?? generated.plannedEntryLow,
  plannedEntryHigh: existing?.plannedEntryHigh ?? generated.plannedEntryHigh,
  lastThesisReviewAt: existing?.lastThesisReviewAt ?? generated.lastThesisReviewAt,
  riskFlags: normalizeKoreanTags(existing?.riskFlags ?? generated.riskFlags),
  sourceName: existing?.sourceName ?? generated.sourceName,
  freshness: existing?.freshness ?? generated.freshness,
  isMock: typeof existing?.isMock === "boolean" ? existing.isMock : generated.isMock,
});

const seededStocksById = new Map(seedData.stocks.map((stock) => [stock.id, stock] as const));
const seededRecipesById = new Map(seedData.recipes.map((recipe) => [recipe.id, recipe] as const));
const seededLogicRulesById = new Map(seedData.logicRules.map((rule) => [rule.id, rule] as const));
const seededLogicSetsById = new Map(seedData.logicSets.map((set) => [set.id, set] as const));
const seededEyesById = new Map(seedData.eyes.map((eye) => [eye.id, eye] as const));
const seededAlertsById = new Map(seedData.alerts.map((alert) => [alert.id, alert] as const));
const seededDecisionsById = new Map(seedData.decisions.map((decision) => [decision.id, decision] as const));
const seededOutcomesById = new Map(seedData.outcomes.map((outcome) => [outcome.id, outcome] as const));
const seededSnapshotsByStockId = new Map(seedData.snapshots.map((snapshot) => [snapshot.stockId, snapshot] as const));
const seededCustomMetricsByKey = new Map(seedData.customMetrics.map((metric) => [metric.key, metric] as const));

const normalizeSeededStock = (stock: Stock): Stock => {
  const seeded = seededStocksById.get(stock.id);
  if (!seeded) return stock;
  return {
    ...stock,
    name: seeded.name,
    thesis: seeded.thesis,
  };
};

const normalizeSeededRecipe = (recipe: Recipe): Recipe => {
  const seeded = seededRecipesById.get(recipe.id);
  if (!seeded) {
    return {
      ...recipe,
      lineageId: recipe.lineageId ?? recipe.id,
      outcomeConfig: recipe.outcomeConfig
        ? {
            ...recipe.outcomeConfig,
            trackedTags: normalizeKoreanTags(recipe.outcomeConfig.trackedTags),
          }
        : recipe.outcomeConfig,
    };
  }
  return {
    ...recipe,
    lineageId: recipe.lineageId ?? seeded.lineageId ?? recipe.id,
    name: seeded.name,
    purpose: seeded.purpose,
    opportunityType: seeded.opportunityType,
    timeHorizon: seeded.timeHorizon,
    intendedUseCase: seeded.intendedUseCase,
    notes: seeded.notes,
    conditions: seeded.conditions,
    outcomeConfig: seeded.outcomeConfig,
  };
};

const logicSetFromRecipe = (recipe: Recipe): LogicSet => ({
  id: recipe.id,
  lineageId: recipe.lineageId ?? recipe.id,
  version: recipe.version,
  name: recipe.name,
  purpose: recipe.purpose,
  opportunityType: recipe.opportunityType,
  timeHorizon: recipe.timeHorizon,
  intendedUseCase: recipe.intendedUseCase,
  notes: recipe.notes,
  createdAt: recipe.createdAt,
  retiredAt: recipe.retiredAt,
  reviewConfig: recipe.reviewConfig,
  alertConfig: recipe.alertConfig,
  outcomeConfig: recipe.outcomeConfig,
});

const logicRuleFromCondition = (recipe: Recipe, condition: Recipe["conditions"][number]): LogicRule => ({
  id: condition.id,
  lineageId: condition.id,
  setId: recipe.id,
  setVersion: recipe.version,
  label: condition.label,
  kind: condition.kind,
  role: condition.role,
  metricKey: condition.metricKey,
  formulaKey: condition.formulaKey,
  operator: condition.operator,
  value: condition.value,
  unit: condition.unit,
  humanDescription: condition.humanDescription,
  notes: condition.notes,
  availability: condition.availability,
  createdAt: recipe.createdAt,
});

const normalizeSeededEye = (eye: Eye): Eye => {
  const seeded = seededEyesById.get(eye.id);
  if (!seeded) {
    return {
      ...eye,
      manualFlags: normalizeKoreanTags(eye.manualFlags),
    };
  }
  return {
    ...eye,
    thesisSnapshot: seeded.thesisSnapshot,
    invalidationRule: seeded.invalidationRule ?? eye.invalidationRule,
    manualFlags: normalizeKoreanTags(eye.manualFlags ?? seeded.manualFlags),
  };
};

const normalizeGeneratedOutcome = (outcome: Outcome): Outcome => ({
  ...outcome,
  reviewWindow: outcome.reviewWindow === "30 days" ? "30일" : outcome.reviewWindow,
  priceChangeNote:
    outcome.priceChangeNote === "Follow up with the next price review."
      ? "다음 가격 점검 때 후속 확인"
      : outcome.priceChangeNote,
  maxRunupNote:
    outcome.maxRunupNote === "Review run-up after the follow-up window."
      ? "후속 점검 시 최대 상승폭 확인"
      : outcome.maxRunupNote,
  maxDrawdownNote:
    outcome.maxDrawdownNote === "Review drawdown after the follow-up window."
      ? "후속 점검 시 최대 하락폭 확인"
      : outcome.maxDrawdownNote,
  lesson:
    outcome.lesson === "Review whether the thesis held and whether timing discipline improved."
      ? "투자 논리가 유지됐는지와 타이밍 규율이 개선됐는지 다시 확인하세요."
      : outcome.lesson,
  recipeSuggestion:
    outcome.recipeSuggestion === "Adjust the recipe only after enough reviewed outcomes accumulate."
      ? "검토된 결과가 충분히 쌓이기 전에는 레시피를 성급히 바꾸지 마세요."
      : outcome.recipeSuggestion,
});

const normalizeAppData = (raw: unknown): AppData => {
  if (!isRecord(raw)) {
    return cloneSeedData();
  }

  const stocks = uniqueById(
    asArray<Stock>(raw.stocks).filter(
      (stock) =>
        isRecord(stock) &&
        typeof stock.id === "string" &&
        typeof stock.symbol === "string" &&
        typeof stock.name === "string",
    ),
  ).map(normalizeSeededStock);
  const stockIds = new Set(stocks.map((stock) => stock.id));

  const recipes = uniqueById(
    asArray<Recipe>(raw.recipes).filter(
      (recipe) => isRecord(recipe) && typeof recipe.id === "string" && typeof recipe.name === "string",
    ),
  ).map(normalizeSeededRecipe);
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));

  const logicSets = uniqueById(
    [
      ...asArray<LogicSet>(raw.logicSets).filter(
        (set) => isRecord(set) && typeof set.id === "string" && typeof set.name === "string",
      ),
      ...recipes.map(logicSetFromRecipe),
    ],
  ).map((set) => ({
    ...(seededLogicSetsById.get(set.id) ?? {}),
    ...set,
  })) as LogicSet[];
  const logicSetIds = new Set(logicSets.map((set) => set.id));

  const logicRules = uniqueById(
    [
      ...asArray<LogicRule>(raw.logicRules).filter(
        (rule) =>
          isRecord(rule) &&
          typeof rule.id === "string" &&
          typeof rule.label === "string" &&
          typeof rule.setId === "string",
      ),
      ...recipes.flatMap((recipe) => recipe.conditions.map((condition) => logicRuleFromCondition(recipe, condition))),
    ],
  ).filter((rule) => logicSetIds.has(rule.setId)).map((rule) => ({
    ...(seededLogicRulesById.get(rule.id) ?? {}),
    ...rule,
  })) as LogicRule[];

  const rawCustomMetrics = asArray<MetricDefinition>(raw.customMetrics).filter(
    (metric) =>
      isRecord(metric) &&
      typeof metric.key === "string" &&
      typeof metric.name === "string" &&
      typeof metric.formulaKey === "string" &&
      Array.isArray(metric.requiredData),
  );

  const customMetrics = uniqueMetricsByKey([
    ...rawCustomMetrics.map((metric) => ({
      ...metric,
      origin: "custom" as const,
    })),
    ...seedData.customMetrics.map((metric) => {
      const existing = rawCustomMetrics.find((item) => item.key === metric.key);
      if (!existing) {
        return {
          ...metric,
          origin: "custom" as const,
        };
      }
      const seeded = seededCustomMetricsByKey.get(metric.key);
      return {
        ...(seeded ?? metric),
        ...existing,
        origin: "custom" as const,
      };
    }),
  ]);

  const eyes = uniqueById(
    asArray<Eye>(raw.eyes).filter(
      (eye) =>
        isRecord(eye) &&
        typeof eye.id === "string" &&
        typeof eye.stockId === "string" &&
        typeof eye.recipeId === "string" &&
        stockIds.has(eye.stockId) &&
        recipeIds.has(eye.recipeId),
    ),
  ).map(normalizeSeededEye);
  const eyeIds = new Set(eyes.map((eye) => eye.id));

  const snapshotsByStock = new Map(
    asArray<MockSnapshot>(raw.snapshots)
      .filter((snapshot) => isRecord(snapshot) && typeof snapshot.stockId === "string" && stockIds.has(snapshot.stockId))
      .map((snapshot) => [snapshot.stockId, snapshot] as const),
  );

  const snapshots = stocks.map((stock) => {
    const seededSnapshot = seededSnapshotsByStockId.get(stock.id);
    const existingSnapshot = snapshotsByStock.get(stock.id);
    return preserveSnapshotFields(buildMockSnapshot(stock), {
      ...existingSnapshot,
      sourceName: seededSnapshot?.sourceName ?? existingSnapshot?.sourceName,
    });
  });

  const alerts = uniqueById(
    [
      ...asArray<Alert>(raw.alerts).filter(
        (alert) =>
          isRecord(alert) &&
          typeof alert.id === "string" &&
          typeof alert.eyeId === "string" &&
          eyeIds.has(alert.eyeId),
      ),
      ...seedData.alerts,
    ],
  )
    .filter((alert) => eyeIds.has(alert.eyeId))
    .map((alert) => ({
      ...(seededAlertsById.get(alert.id) ?? {}),
      ...alert,
    }));
  const alertIds = new Set(alerts.map((alert) => alert.id));

  const decisions = uniqueById(
    [
      ...asArray<Decision>(raw.decisions).filter(
        (decision) =>
          isRecord(decision) &&
          typeof decision.id === "string" &&
          typeof decision.eyeId === "string" &&
          eyeIds.has(decision.eyeId) &&
          (!decision.alertId || alertIds.has(decision.alertId)),
      ),
      ...seedData.decisions,
    ],
  )
    .filter((decision) => eyeIds.has(decision.eyeId) && (!decision.alertId || alertIds.has(decision.alertId)))
    .map((decision) => ({
      ...(seededDecisionsById.get(decision.id) ?? {}),
      ...decision,
    }));
  const decisionIds = new Set(decisions.map((decision) => decision.id));

  const outcomes = uniqueById(
    [
      ...asArray<Outcome>(raw.outcomes).filter(
        (outcome) =>
          isRecord(outcome) &&
          typeof outcome.id === "string" &&
          typeof outcome.decisionId === "string" &&
          decisionIds.has(outcome.decisionId),
      ),
      ...seedData.outcomes,
    ],
  )
    .filter((outcome) => decisionIds.has(outcome.decisionId))
    .map((outcome) => normalizeGeneratedOutcome({
      ...(seededOutcomesById.get(outcome.id) ?? {}),
      ...outcome,
    }));

  return {
    stocks,
    recipes,
    customMetrics,
    logicRules,
    logicSets,
    eyes,
    alerts,
    decisions,
    outcomes,
    snapshots,
    rawBarArchives: asArray<RawBarArchiveBatch>(raw.rawBarArchives).filter(
      (batch) => isRecord(batch) && typeof batch.id === "string",
    ),
    universeSnapshots: asArray<UniverseSnapshot>(raw.universeSnapshots).filter(
      (snapshot) => isRecord(snapshot) && typeof snapshot.id === "string",
    ),
    processedFeatures: asArray<ProcessedFeatureRecord>(raw.processedFeatures).filter(
      (feature) => isRecord(feature) && typeof feature.id === "string",
    ),
    scanRuns: asArray<ScanRun>(raw.scanRuns).filter(
      (run) => isRecord(run) && typeof run.id === "string",
    ),
    scanSignals: asArray<ScanSignal>(raw.scanSignals).filter(
      (signal) => isRecord(signal) && typeof signal.signalId === "string",
    ),
    reviewLogs: asArray<ReviewLog>(raw.reviewLogs).filter(
      (log) => isRecord(log) && typeof log.id === "string",
    ),
    forwardProofLedger: asArray<ForwardProofLedger>(raw.forwardProofLedger).filter(
      (entry) => isRecord(entry) && typeof entry.id === "string",
    ),
    scannerSettings: {
      ...(seedData.scannerSettings as ScannerSettings),
      ...(isRecord(raw.scannerSettings) ? (raw.scannerSettings as Partial<ScannerSettings>) : {}),
    },
  };
};

export const loadAppData = async (): Promise<AppData> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = cloneSeedData();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const normalized = normalizeAppData(JSON.parse(raw));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const seeded = cloneSeedData();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

export const saveAppData = async (data: AppData) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
