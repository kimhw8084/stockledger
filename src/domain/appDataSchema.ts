import { z } from "zod";
import type { AppData } from "../types";
import { defaultNotificationPreferences, NOTIFICATION_PREFERENCES_CONTRACT_VERSION, validClockTime } from "./notificationPreferences";
// Loose objects retain future fields. Known fields are validated recursively; no
// filter, seed merge or catch-and-reset is allowed at the persistence boundary.
const text = z.string();
const id = text.min(1).max(200);
const num = z.number().finite();
const bool = z.boolean();
const strings = z.array(text);
const timestamp = text.refine(value => Number.isFinite(Date.parse(value)), "Invalid timestamp");
const opt = <T extends z.ZodType>(schema: T) => schema.optional();
const rightsProvenance = opt(z.looseObject({}));
const state = z.enum(["Not Relevant", "Becoming Interesting", "Watch Closely", "Opportunity Zone Forming", "Attention Needed", "Thesis Risk Rising", "Thesis Broken"]);
const freshness = z.enum(["Fresh", "Delayed", "Stale", "Partial", "Unavailable", "Mock Data"]);
const role = z.enum(["Eligibility Filter", "Supporting Evidence", "Timing Trigger", "Risk Warning", "Hard Disqualifier", "Review Trigger", "Outcome Learning Tag"]);
const kind = z.enum(["required", "supporting", "negative", "disqualifier"]);
const operator = z.enum(["<=", ">=", "<", ">", "=", "is", "contains", "between", "crosses", "within"]);
const availability = z.enum(["automated", "manual", "future"]);
const expected = z.union([text, num, bool, z.tuple([num, num])]);
const conditionFields = { id, label: text, kind, role: opt(role), metricKey: opt(text), formulaKey: opt(text), operator: opt(operator), value: opt(expected), unit: opt(text), humanDescription: opt(text), notes: opt(text), availability: opt(availability), lineageId: opt(id) };
export const conditionSchema = z.looseObject(conditionFields);
const resultSchema = z.looseObject({ conditionId: id, role, passed: bool, truth: opt(z.enum(["true", "false", "unknown"])), metricKey: opt(text), formulaKey: opt(text), operator: opt(operator), expectedValue: opt(expected), actualValue: opt(z.union([text, num, bool])), explanation: text, missingData: opt(bool) });
const results = z.array(resultSchema);
const evaluationSchema = z.looseObject({ id: opt(id), inputHash: opt(text.regex(/^[a-f0-9]{64}$/)), eyeId: id, recipeId: opt(id), recipeVersion: opt(num), previousState: state, currentState: state, stateChanged: bool, whyNow: text, supportingEvidence: strings, contradictingEvidence: strings, riskWarnings: opt(strings), hardDisqualifiers: opt(strings), missingData: strings, staleData: strings, dataQuality: text, setupStrength: z.enum(["Low", "Medium", "High"]), actionUrgency: z.enum(["Wait", "Review Soon", "Actively Review"]), recommendedAction: opt(text), conditionResults: opt(results), alertSuggested: bool, alertReason: opt(text), alertSuppressedReason: opt(text), evaluatedAt: timestamp, engineVersion: opt(text), metricContractVersion: opt(text), eligibilityMet: opt(bool), qualityBlocked: opt(bool) });
const priority = z.enum(["High", "Medium", "Low"]);
const recipeFields = { id, lineageId: opt(id), version: num.int().positive(), name: text, purpose: text, opportunityType: opt(text), timeHorizon: text, intendedUseCase: text, notes: text, createdAt: timestamp, retiredAt: opt(timestamp),
  stateConfig: opt(z.looseObject({ attentionNeededMinScore: num, opportunityMinScore: num, watchMinScore: num, becomingInterestingMinScore: num, riskWarningThreshold: num.positive() })),
  reviewConfig: opt(z.looseObject({ cadenceDays: num.positive(), reviewTriggers: strings })),
  alertConfig: opt(z.looseObject({ cooldownHours: num.nonnegative(), dedupeKey: z.enum(["state_change", "current_state"]), priorityOnAttention: priority, priorityOnRisk: priority })),
  outcomeConfig: opt(z.looseObject({ trackedTags: strings })) };
export const recipeSchema = z.looseObject({ ...recipeFields, conditions: z.array(conditionSchema) });
const stockSchema = z.looseObject({ id, symbol: text.min(1).max(32), name: text, thesis: text, createdAt: timestamp, archivedAt: opt(timestamp) });
const snapshotSchema = z.looseObject({
  provenance: opt(z.looseObject({ schemaVersion: z.literal(2), origin: z.enum(["provider", "import", "demo"]), observedDate: text, retrievedAt: timestamp, currency: z.literal("USD"), adjustment: z.enum(["adjusted", "unadjusted", "unknown"]), datasetId: id,
    providerIdentity: opt(text), providerProductId: opt(text), datasetCategory: opt(text), sourceRequestIdentity: opt(text), freshnessState: opt(text), coverageState: opt(text), contentHash: opt(text), rightsProfileId: opt(text), rightsProvenance, validationIssues: opt(strings), failureClass: opt(text) })),
  historyDates: opt(strings), benchmarkDates: opt(strings), benchmarkSymbol: opt(text), stockId: id, price: num.nonnegative(), drawdownPct: num, stabilizationScore: num, riskFlags: strings, updatedAt: timestamp, sourceName: text, freshness, isMock: bool,
  ...Object.fromEntries(["movingAverage20DistancePct", "movingAverage50DistancePct", "movingAverage200DistancePct", "daysUntilEarnings", "relativeStrengthVsSpyPct", "priceReturn20dPct", "priceReturn60dPct", "averageRangePct", "revenueGrowthYoY", "marginChangePct", "plannedEntryLow", "plannedEntryHigh"].map(key => [key, opt(num)])),
  ...Object.fromEntries(["nearSupport", "valuationDiscount", "earningsSoon", "volumeSpike", "volatilityCompression"].map(key => [key, opt(bool)])),
  ...Object.fromEntries(["priceHistorySeries", "benchmarkHistorySeries", "volumeHistorySeries", "volatilityHistorySeries"].map(key => [key, opt(z.array(num))])),
  debtRiskLevel: opt(z.enum(["low", "medium", "high"])), lastThesisReviewAt: opt(timestamp),
});
const metricSchema = z.looseObject({ key: id, name: text, humanMeaning: text, formulaKey: text, requiredData: strings, expression: opt(text), parameterKeys: opt(strings), freshnessExpectation: z.union([freshness, z.enum(["Near Real Time", "Daily", "Review Cadence"])]), availability, exampleConditions: strings, exampleDisplayText: text, missingDataBehavior: text, origin: opt(z.enum(["starter", "custom"])), createdAt: opt(timestamp) });
const eyeSchema = z.looseObject({ id, stockId: id, recipeId: id, createdAt: timestamp, thesisSnapshot: text, recipeVersionAtCreation: opt(num), plannedEntryLow: opt(num), plannedEntryHigh: opt(num), invalidationRule: opt(text), manualFlags: opt(strings), lastReviewedAt: opt(timestamp), lastEvaluation: opt(evaluationSchema), archivedAt: opt(timestamp) });
const alertSchema = z.looseObject({ id, evaluationId: opt(id), eyeId: id, recipeId: opt(id), recipeVersion: opt(num), title: text, stateChange: text, whyNow: text, supportingEvidence: strings, risks: strings, dataQuality: text, evaluationContext: opt(z.looseObject({ currentState: state, conditionResults: opt(results), staleData: opt(strings), missingData: opt(strings) })), priority, createdAt: timestamp, reviewed: bool, snoozedUntil: opt(timestamp), usefulness: opt(z.enum(["Useful", "Not Useful"])), rightsProvenance });
const decisionSchema = z.looseObject({ id, archivedAt: opt(timestamp), amendments: opt(z.array(z.looseObject({ amendedAt: timestamp, action: z.enum(["Entered", "Skipped", "Snoozed", "Revised", "Rejected", "Marked Thesis Broken"]), note: text, concern: text, thesisValid: z.enum(["Yes", "Partly", "No"]), timing: z.enum(["Early", "On Time", "Late"]) }))), eyeId: id, alertId: opt(id), recipeId: opt(id), recipeVersion: opt(num), stateAtDecision: opt(state), conditionResults: opt(results), dataQuality: opt(text), action: z.enum(["Entered", "Skipped", "Snoozed", "Revised", "Rejected", "Marked Thesis Broken"]), note: text, concern: text, thesisValid: z.enum(["Yes", "Partly", "No"]), timing: z.enum(["Early", "On Time", "Late"]), createdAt: timestamp });
const outcomeSchema = z.looseObject({ id, decisionId: id, recipeId: opt(id), recipeVersion: opt(num), reviewWindow: text, status: opt(z.enum(["Pending", "Reviewed"])), priceChangeNote: text, maxRunupNote: text, maxDrawdownNote: text, lesson: text, recipeSuggestion: text, createdAt: timestamp });
export const rawBarSchema = z.looseObject({ symbol: id, date: text.regex(/^\d{4}-\d{2}-\d{2}$/), open: num.positive(), high: num.positive(), low: num.positive(), close: num.positive(), volume: num.nonnegative() });
const universeMode = z.enum(["dynamic_current_universe", "frozen_research_universe"]);
const sourceStatus = z.enum(["dynamic_current_universe", "frozen_import_fallback", "current_universe_unavailable"]);
const featureValues = z.record(text, z.union([num, bool, text, z.null()]));
const universeSchema = z.looseObject({ id, universeMode, universeSource: text, universeSourceStatus: sourceStatus, snapshotDate: text, snapshotHash: text, fetchedAtUtc: timestamp, sectorSnapshots: z.array(z.looseObject({ sector: text, tickers: strings })), addedTickers: opt(strings), removedTickers: opt(strings), warning: opt(text) });
const proofSchema = z.looseObject({ discoveryMedian30: num, holdoutMedian30: num, lockboxMedian30: num, latestEraStatus: z.enum(["pass", "fail", "unknown"]) });
const signalSchema = z.looseObject({ signalId: id, scanRunId: id, scanDate: text, signalDate: text, ticker: text, sector: text, ruleId: id, ruleSignatureHash: text, family: text, classificationAtSignal: text, appPriority: text, status: z.enum(["MATCHED", "NEAR_MATCH", "FAILED", "BLOCKED_OR_INCOMPLETE_DATA"]), matchedConditionsJson: strings, failedConditionsJson: strings, missingConditionsJson: strings, featureValuesJson: featureValues, closePriceAtSignal: opt(num), spyClose: opt(num), sectorEtf: text, sectorEtfClose: opt(num), proofSummarySnapshot: proofSchema, riskWarningsSnapshot: strings, survivorshipBiasLabel: text, forwardProofRequired: bool, universeMode, universeSource: text, universeSnapshotDate: opt(text), universeSnapshotHash: opt(text), sectorMemberCount: num.int().nonnegative(), createdAtUtc: timestamp, rightsProvenance });
const forwardSchema = z.looseObject({ id, signalId: id, completed5d: bool, completed10d: bool, completed20d: bool, completed30d: bool, lastUpdatedAtUtc: timestamp,
  ...Object.fromEntries(["ret5", "ret10", "ret20", "ret30", "spyRet5", "spyRet10", "spyRet20", "spyRet30", "sectorRet5", "sectorRet10", "sectorRet20", "sectorRet30", "mfe30", "mae30"].map(key => [key, opt(num)])),
  ...Object.fromEntries(["beatSpy5", "beatSpy10", "beatSpy20", "beatSpy30", "beatSector5", "beatSector10", "beatSector20", "beatSector30"].map(key => [key, opt(bool)])) });
export const scannerSettingsSchema = z.looseObject({ universeMode, fallbackToFrozenUniverse: bool, providerDelayMinutesAfterClose: num.min(0).max(360), notifyNearMatches: bool, frozenUniverseBySector: opt(z.record(text, strings)) });
const notificationPreferencesSchema = z.looseObject({
  contractVersion: z.literal(NOTIFICATION_PREFERENCES_CONTRACT_VERSION), revision: z.literal(1), explicitConsent: bool, enabled: bool,
  allowedChannels: z.array(z.literal("email")), destinations: z.looseObject({ email: opt(z.looseObject({ address: text.email() })) }),
  timezone: text.min(1).max(100), quietHours: z.looseObject({ enabled: bool, start: text.refine(validClockTime, "Invalid quiet-hours start"), end: text.refine(validClockTime, "Invalid quiet-hours end") }),
  deliveryMode: z.enum(["immediate", "digest"]), digestTime: text.refine(validClockTime, "Invalid digest time"), minimumPriority: priority,
  privacyMode: z.enum(["minimal", "rich"]), accountScope: z.literal("device-local"), updatedAt: timestamp,
});
const lastKnownNotificationDeliveryStatusSchema = z.looseObject({
  contractVersion: z.literal("stockledger-notification-status-v1"), revision: z.literal(1), generatedAt: timestamp,
  channel: z.literal("email"), lastIntentId: z.union([id, z.null()]),
  lastState: z.union([z.enum(["pending", "held", "claimed", "delivered", "failed", "retry-wait", "canceled", "blocked-unconfigured", "ambiguous"]), z.null()]),
  attemptCount: num.int().nonnegative().max(5), lastConfirmedAt: opt(timestamp), lastProviderAcceptedAt: opt(timestamp), lastFailureAt: opt(timestamp),
  errorClass: opt(text.max(120)), preferenceUpdatedAt: timestamp, preferenceHash: text.regex(/^[a-f0-9]{64}$/),
});
const appDataSchema = z.looseObject({
  workspaceId: opt(id),
  evaluations: opt(z.array(evaluationSchema)),
  stocks: z.array(stockSchema), recipes: z.array(recipeSchema), customMetrics: z.array(metricSchema),
  logicSets: z.array(z.looseObject(recipeFields)), logicRules: z.array(z.looseObject({ ...conditionFields, setId: id, setVersion: num, createdAt: timestamp, updatedAt: opt(timestamp) })),
  eyes: z.array(eyeSchema), snapshots: z.array(snapshotSchema), alerts: z.array(alertSchema), decisions: z.array(decisionSchema), outcomes: z.array(outcomeSchema),
  rawBarArchives: z.array(z.looseObject({ id, provider: text, downloadedAtUtc: timestamp, symbols: strings, startDate: text, endDate: text, rowCount: num.int().nonnegative(), adjustedStatus: opt(z.enum(["adjusted", "unadjusted", "unknown"])), validationStatus: z.enum(["valid", "invalid", "partial"]), archiveVersion: num, schemaVersion: text, bars: z.array(rawBarSchema), supersededByBatchId: opt(id),
    contractVersion: opt(text), contractRevision: opt(num.int()), providerIdentity: opt(text), providerProductId: opt(text), datasetCategory: opt(text), requestedStartDate: opt(text), requestedEndDate: opt(text), observedStartDate: opt(text), observedEndDate: opt(text), retrievalTimestampUtc: opt(timestamp), sourceRequestIdentity: opt(text), freshnessState: opt(text), coverageState: opt(text), contentHash: opt(text), datasetIdentity: opt(text), validationIssues: opt(strings), failureClass: opt(text), rightsProfileId: opt(text), rightsProvenance })),
  universeSnapshots: z.array(universeSchema),
  processedFeatures: z.array(z.looseObject({ id, symbol: text, asOfDate: text, sector: text, sectorEtf: text, featureSemanticsVersion: text, computedAtUtc: timestamp, featureValues, featureMeta: z.record(text, z.looseObject({ formula: text, rawInputs: strings, lookbackDays: num, warmupDays: num, pointInTimeSafe: bool, computedAfterCloseOnly: bool, featureVersion: text })), rightsProvenance })),
  scanRuns: z.array(z.looseObject({ id, scanDate: text, latestExpectedTradingDate: text, startedAtUtc: timestamp, completedAtUtc: opt(timestamp), universeMode, universeSource: text, universeSnapshotDate: opt(text), universeSnapshotHash: opt(text), providerName: text, sourceStatus, status: z.enum(["completed", "blocked", "partial"]), warnings: strings, blockedReason: opt(text), rightsProvenance })),
  scanSignals: z.array(signalSchema),
  reviewLogs: z.array(z.looseObject({ id, signalId: id, reviewedAt: timestamp, userDecision: z.enum(["watch", "ignore", "bought", "skipped", "sold", "other"]), manualReason: text, convictionScoreOptional: opt(num.min(0).max(100)), notes: opt(text), entryPriceOptional: opt(num.positive()), exitPriceOptional: opt(num.positive()), resultNotes: opt(text) })),
  forwardProofLedger: z.array(forwardSchema), scannerSettings: scannerSettingsSchema, notificationPreferences: opt(notificationPreferencesSchema),
  lastKnownNotificationDeliveryStatus: opt(lastKnownNotificationDeliveryStatusSchema),
});

export function validateAppData(raw: unknown): AppData {
  const parsed = appDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.slice(0, 5).map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  }
  // Parsed output is structurally checked above, including all nested collections.
  const data = {
    ...parsed.data,
    notificationPreferences: parsed.data.notificationPreferences ?? defaultNotificationPreferences(),
  } as unknown as AppData;
  const keys: Partial<Record<keyof AppData, string>> = { stocks: "id", recipes: "id", customMetrics: "key", logicRules: "id", logicSets: "id", eyes: "id", alerts: "id", decisions: "id", outcomes: "id", snapshots: "stockId", scanSignals: "signalId", scanRuns: "id", reviewLogs: "id", forwardProofLedger: "id", rawBarArchives: "id", universeSnapshots: "id", processedFeatures: "id" };
  for (const [collection, key] of Object.entries(keys)) {
    const rows = parsed.data[collection] as Record<string, unknown>[];
    const values = rows.map(row => row[key]);
    if (new Set(values).size !== values.length) throw new Error(`${collection}: duplicate ${key}`);
  }
  const stockIds = new Set(data.stocks.map(row => row.id)), recipeIds = new Set(data.recipes.map(row => row.id));
  const eyeIds = new Set(data.eyes.map(row => row.id)), decisionIds = new Set(data.decisions.map(row => row.id));
  if (data.eyes.some(row => !stockIds.has(row.stockId) || !recipeIds.has(row.recipeId))) throw new Error("An Eye references a missing stock or recipe.");
  if (data.snapshots.some(row => !stockIds.has(row.stockId))) throw new Error("A snapshot references a missing stock.");
  if ([...data.alerts, ...data.decisions].some(row => !eyeIds.has(row.eyeId))) throw new Error("History references a missing Eye.");
  if (data.outcomes.some(row => !decisionIds.has(row.decisionId))) throw new Error("An outcome references a missing decision.");
  return data;
}
