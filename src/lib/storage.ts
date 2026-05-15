import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildMockSnapshot } from "./mockSnapshot";
import { seedData } from "./seed";
import { Alert, AppData, Decision, Eye, MockSnapshot, Outcome, Recipe, Stock } from "../types";

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

const preserveSnapshotFields = (generated: MockSnapshot, existing?: Partial<MockSnapshot>): MockSnapshot => ({
  ...generated,
  plannedEntryLow: existing?.plannedEntryLow ?? generated.plannedEntryLow,
  plannedEntryHigh: existing?.plannedEntryHigh ?? generated.plannedEntryHigh,
  lastThesisReviewAt: existing?.lastThesisReviewAt ?? generated.lastThesisReviewAt,
  riskFlags: existing?.riskFlags ?? generated.riskFlags,
  sourceName: existing?.sourceName ?? generated.sourceName,
  freshness: existing?.freshness ?? generated.freshness,
  isMock: typeof existing?.isMock === "boolean" ? existing.isMock : generated.isMock,
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
  );
  const stockIds = new Set(stocks.map((stock) => stock.id));

  const recipes = uniqueById(
    asArray<Recipe>(raw.recipes).filter(
      (recipe) => isRecord(recipe) && typeof recipe.id === "string" && typeof recipe.name === "string",
    ),
  );
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));

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
  );
  const eyeIds = new Set(eyes.map((eye) => eye.id));

  const snapshotsByStock = new Map(
    asArray<MockSnapshot>(raw.snapshots)
      .filter((snapshot) => isRecord(snapshot) && typeof snapshot.stockId === "string" && stockIds.has(snapshot.stockId))
      .map((snapshot) => [snapshot.stockId, snapshot] as const),
  );

  const snapshots = stocks.map((stock) =>
    preserveSnapshotFields(buildMockSnapshot(stock), snapshotsByStock.get(stock.id)),
  );

  const alerts = uniqueById(
    asArray<Alert>(raw.alerts).filter(
      (alert) =>
        isRecord(alert) &&
        typeof alert.id === "string" &&
        typeof alert.eyeId === "string" &&
        eyeIds.has(alert.eyeId),
    ),
  );
  const alertIds = new Set(alerts.map((alert) => alert.id));

  const decisions = uniqueById(
    asArray<Decision>(raw.decisions).filter(
      (decision) =>
        isRecord(decision) &&
        typeof decision.id === "string" &&
        typeof decision.eyeId === "string" &&
        eyeIds.has(decision.eyeId) &&
        (!decision.alertId || alertIds.has(decision.alertId)),
    ),
  );
  const decisionIds = new Set(decisions.map((decision) => decision.id));

  const outcomes = uniqueById(
    asArray<Outcome>(raw.outcomes).filter(
      (outcome) =>
        isRecord(outcome) &&
        typeof outcome.id === "string" &&
        typeof outcome.decisionId === "string" &&
        decisionIds.has(outcome.decisionId),
    ),
  );

  return {
    stocks,
    recipes,
    eyes,
    alerts,
    decisions,
    outcomes,
    snapshots,
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
