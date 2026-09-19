import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedData } from "../src/lib/seed";
import { STOOQ_RESEARCH_RIGHTS_PROFILE } from "../src/lib/eodDataProvider";
import { parseExport, serializeUserExport } from "../src/domain/backupFormat";
import {
  checkProductionManagedRights,
  checkRights,
  createRightsProvenance,
  createLocalUserRightsProfile,
  makeRightsPermissions,
  normalizeProviderBatch,
  validateDailyBars,
  type MarketDataRightsProfile,
  type RightsUseCategory,
  type ProviderDailyBarsResponse,
} from "../src/lib/marketDataContract";
import { acquireManagedDailyBars, runManagedProviderJob, type MarketDataProviderAdapter } from "../server/worker/marketDataIngestion";
import { WorkerStore } from "../server/worker/store";
import { runManagedJob } from "../server/worker/managed";
import { previousUsTradingDate } from "../src/lib/marketCalendar";
import type { RawBarRecord } from "../src/types";

const now = new Date("2026-09-14T22:00:00.000Z");

const bars = (symbol: string, count: number): RawBarRecord[] => {
  const dates = ["2026-09-14"];
  while (dates.length < count) dates.unshift(previousUsTradingDate(dates[0]));
  return dates.map((date, index) => ({ symbol, date, open: 100 + index, high: 101 + index, low: 99 + index, close: 100 + index, volume: 100 }));
};

const commercialProfile = (providerIdentity = "fixture-provider", providerProductId = "daily-bars"): MarketDataRightsProfile => ({
  contractVersion: "stockledger-market-data-rights-v1",
  revision: 2,
  profileId: `${providerIdentity}:${providerProductId}:operator-profile`,
  providerIdentity,
  providerProductId,
  profileKind: "commercial",
  evidenceRef: "operator-supplied comparison evidence; not an executed agreement",
  authority: { modelVersion: "stockledger-market-data-rights-authority-v1", state: "public-comparison", evidenceRef: "operator-supplied comparison evidence; not an executed agreement", effectiveAtUtc: "2026-01-01T00:00:00.000Z" },
  permissions: makeRightsPermissions("allowed"),
});

const executedCommercialProfile = (providerIdentity = "fixture-provider", providerProductId = "daily-bars", permissions = makeRightsPermissions("allowed")): MarketDataRightsProfile => ({
  ...commercialProfile(providerIdentity, providerProductId),
  profileId: `${providerIdentity}:${providerProductId}:synthetic-test-executed-agreement`,
  evidenceRef: "synthetic-test-only/agreement-fixture-001",
  authority: { modelVersion: "stockledger-market-data-rights-authority-v1", state: "executed-agreement", evidenceRef: "synthetic-test-only/agreement-fixture-001", effectiveAtUtc: "2026-01-01T00:00:00.000Z", expiresAtUtc: "2027-01-01T00:00:00.000Z" },
  permissions,
});

const response = (symbol: string, adjustmentBasis: ProviderDailyBarsResponse["adjustmentBasis"] = "adjusted"): ProviderDailyBarsResponse => ({
  symbol,
  rows: bars(symbol, 4),
  retrievedAtUtc: now.toISOString(),
  adjustmentBasis,
  sourceRequestIdentity: `fixture-request:${symbol}`,
});

const storeForTest = () => {
  const store = new WorkerStore(":memory:");
  store.import(structuredClone(seedData), 0);
  return store;
};

const provenanceFor = (profile: MarketDataRightsProfile) => {
  const expected = { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now };
  const decisions = Object.fromEntries(([
    "internal_computation", "derived_metrics", "end_user_display", "notification", "user_export", "raw_redistribution",
  ] as RightsUseCategory[]).map(use => [use, checkProductionManagedRights(profile, use, expected)]));
  return createRightsProvenance(profile, decisions, now.toISOString());
};

const managedProviderFixture = (profile: MarketDataRightsProfile) => {
  const data = structuredClone(seedData);
  data.scannerSettings = { ...data.scannerSettings, universeMode: "frozen_research_universe", frozenUniverseBySector: { XLK: [data.stocks[0].symbol] } };
  const dates = ["2026-09-14"];
  while (dates.length < 260) dates.unshift(previousUsTradingDate(dates[0]));
  const histories = [...new Set([data.stocks[0].symbol, "SPY", "XLK"])].map(symbol => ({ symbol, rows: dates.map((date, index) => ({ symbol, date, open: 100 + index, close: 100 + index, high: 101 + index, low: 99 + index, volume: 1000 })) }));
  const metadata = normalizeProviderBatch({ providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, datasetCategory: "daily_ohlcv", symbols: histories.map(history => history.symbol), requestedStartDate: "2024-01-01", requestedEndDate: "2026-09-14", responses: [], rightsProfile: profile });
  return { data, histories, metadata };
};

describe("CHG-95 provider-neutral contract and rights gate", () => {
  it("denies missing/unknown production rights while retaining the local-user boundary", () => {
    expect(checkProductionManagedRights(undefined).allowed).toBe(false);
    expect(checkProductionManagedRights(commercialProfile(), "internal_computation", { providerIdentity: "fixture-provider", providerProductId: "daily-bars", now }).allowed).toBe(false);
    expect(checkProductionManagedRights(STOOQ_RESEARCH_RIGHTS_PROFILE, "internal_computation", { providerIdentity: "stooq", providerProductId: "public-daily-csv" }).allowed).toBe(false);
    const local = createLocalUserRightsProfile();
    expect(checkRights(local, "end_user_display").allowed).toBe(true);
  });

  it("allows a synthetic executed agreement only for explicitly allowed use categories", () => {
    const profile = executedCommercialProfile("fixture-provider", "daily-bars", makeRightsPermissions("denied", {
      internal_computation: { state: "allowed" },
      derived_metrics: { state: "allowed" },
      end_user_display: { state: "allowed" },
    }));
    expect(checkProductionManagedRights(profile, "internal_computation", { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now }).allowed).toBe(true);
    expect(checkProductionManagedRights(profile, "derived_metrics", { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now }).allowed).toBe(true);
    expect(checkProductionManagedRights(profile, "end_user_display", { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now }).allowed).toBe(true);
    expect(checkProductionManagedRights(profile, "notification", { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now }).allowed).toBe(false);
    expect(checkProductionManagedRights(profile, "user_export", { providerIdentity: profile.providerIdentity, providerProductId: profile.providerProductId, now }).allowed).toBe(false);
  });

  it("fails closed for missing evidence, non-executed, expired, mismatched, unknown and old rights authority", () => {
    const expected = { providerIdentity: "fixture-provider", providerProductId: "daily-bars", now };
    const cases: MarketDataRightsProfile[] = [
      { ...executedCommercialProfile(), evidenceRef: undefined, authority: { ...executedCommercialProfile().authority!, evidenceRef: undefined } },
      { ...executedCommercialProfile(), authority: { ...executedCommercialProfile().authority!, state: "public-comparison" } },
      { ...executedCommercialProfile(), authority: { ...executedCommercialProfile().authority!, state: "expired", expiresAtUtc: "2026-01-01T00:00:00.000Z" } },
      executedCommercialProfile("other-provider", "daily-bars"),
      { ...executedCommercialProfile(), permissions: makeRightsPermissions("unknown") },
      { ...executedCommercialProfile(), revision: 1 },
    ];
    expect(cases.every(profile => !checkProductionManagedRights(profile, "internal_computation", expected).allowed)).toBe(true);
    expect(checkProductionManagedRights(STOOQ_RESEARCH_RIGHTS_PROFILE, "internal_computation", { providerIdentity: "stooq", providerProductId: "public-daily-csv", now }).allowed).toBe(false);
  });

  it("checks each use category independently", () => {
    const profile = { ...commercialProfile(), permissions: makeRightsPermissions("unknown", { end_user_display: { state: "allowed" } }) };
    expect(checkRights(profile, "end_user_display").allowed).toBe(true);
    expect(checkRights(profile, "notification").allowed).toBe(false);
    expect(checkRights(profile, "user_export").state).toBe("unknown");
    expect(checkRights(profile, "raw_redistribution").allowed).toBe(false);
  });

  it("does not commit provider-derived user-facing state when derived or display rights are denied", async () => {
    const profile = executedCommercialProfile("fixture-provider", "daily-bars", makeRightsPermissions("denied", { internal_computation: { state: "allowed" } }));
    const fixture = managedProviderFixture(profile);
    const store = new WorkerStore(":memory:");
    store.import(fixture.data, 0);
    const result = await runManagedJob(store, fixture.histories, { source: "Synthetic test provider", adjustment: "adjusted", sourceKind: "provider", rightsProfile: profile, ingestionMetadata: fixture.metadata, now });
    expect(result.status).toBe("partial");
    const saved = store.load()!.data;
    expect(saved.snapshots.every(snapshot => snapshot.provenance?.origin !== "provider")).toBe(true);
    expect(saved.scanSignals).toHaveLength(0);
    expect(saved.processedFeatures).toHaveLength(0);
    expect(saved.scanRuns[0].blockedReason).toMatch(/rights_blocked:(derived_metrics|end_user_display)/);
    expect(saved.rawBarArchives[0]?.rightsProvenance?.rightsProfileId).toBe(profile.profileId);
    store.close();
  });

  it("blocks provider notification intents without discarding permitted computation or state", async () => {
    const profile = executedCommercialProfile("fixture-provider", "daily-bars", makeRightsPermissions("allowed", { notification: { state: "denied" } }));
    const fixture = managedProviderFixture(profile);
    fixture.data.alerts = [];
    fixture.data.evaluations = [];
    fixture.data.eyes = fixture.data.eyes.map(eye => eye.id === "eye-nvda-risk" ? { ...eye, manualFlags: ["risk"], lastReviewedAt: "2020-01-01T00:00:00.000Z" } : eye);
    const store = new WorkerStore(":memory:");
    store.import(fixture.data, 0);
    const result = await runManagedJob(store, fixture.histories, { source: "Synthetic test provider", adjustment: "adjusted", sourceKind: "provider", rightsProfile: profile, ingestionMetadata: fixture.metadata, now });
    const notificationJob = store.listJobs({ kind: "notification-outbox-intent" })[0];
    expect(result.status).toBe("partial");
    expect(store.load()!.data.snapshots.some(snapshot => snapshot.provenance?.rightsProvenance?.rightsProfileId === profile.profileId)).toBe(true);
    expect(notificationJob.status).toBe("blocked");
    expect(notificationJob.lastSafeError).toBeNull();
    expect(store.pendingOutbox()).toHaveLength(0);
    expect(store.load()!.data.scanRuns[0].blockedReason).toContain("rights_blocked:notification");
    store.close();
  });

  it("excludes provider exports without user_export and independently requires raw_redistribution", () => {
    const raw = { id: "raw-provider", provider: "Synthetic test provider", downloadedAtUtc: now.toISOString(), symbols: ["ABC"], startDate: "2026-09-09", endDate: "2026-09-14", rowCount: 4, adjustedStatus: "adjusted" as const, validationStatus: "valid" as const, archiveVersion: 1, schemaVersion: "scanner_raw_bar_v1", bars: bars("ABC", 4), providerIdentity: "fixture-provider", providerProductId: "daily-bars", rightsProfileId: "profile", rightsProvenance: provenanceFor(executedCommercialProfile()) };
    const data = structuredClone(seedData);
    data.rawBarArchives = [raw];
    const deniedExport = executedCommercialProfile("fixture-provider", "daily-bars", makeRightsPermissions("allowed", { user_export: { state: "denied" } }));
    const deniedRaw = executedCommercialProfile("fixture-provider", "daily-bars", makeRightsPermissions("allowed", { raw_redistribution: { state: "denied" } }));
    for (const profile of [deniedExport, deniedRaw]) {
      const exportData = parseExport(serializeUserExport({ ...data, rawBarArchives: [{ ...raw, rightsProfileId: profile.profileId, rightsProvenance: provenanceFor(profile) }] }, 0, now));
      expect(exportData.rawBarArchives).toHaveLength(0);
    }
  });

  it("preserves explicit validation and partial benchmark/symbol coverage", () => {
    const invalid = validateDailyBars({ symbol: "ABC", rows: [{ ...bars("ABC", 1)[0], high: 1 }], requestedStartDate: "2026-09-14", requestedEndDate: "2026-09-14", expectedLatestSession: "2026-09-14", adjustmentBasis: "unknown" });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toContain("ohlc_inconsistent:2026-09-14");
    const batch = normalizeProviderBatch({ providerIdentity: "fixture-provider", providerProductId: "daily-bars", datasetCategory: "daily_ohlcv", symbols: ["ABC", "SPY"], requestedStartDate: "2026-09-09", requestedEndDate: "2026-09-14", responses: [response("ABC")], rightsProfile: commercialProfile(), expectedLatestSession: "2026-09-14", minimumSessions: 1 });
    expect(batch.coverageState).toBe("partial");
    expect(batch.failureClass).toBe("missing_symbol");
    expect(batch.items.find(item => item.symbol === "SPY")?.validation.issues).toContain("SPY:missing_symbol_history");
  });

  it("blocks provider ingestion without rights and never calls the adapter", async () => {
    const store = storeForTest();
    let calls = 0;
    const adapter: MarketDataProviderAdapter = { providerIdentity: "fixture-provider", providerProductId: "daily-bars", fetchDailyBars: async () => { calls += 1; return response("ABC"); } };
    const result = await acquireManagedDailyBars(store, adapter, { symbols: ["ABC"], startDate: "2026-09-09", endDate: "2026-09-14", expectedLatestSession: "2026-09-14", rightsProfile: undefined, now });
    expect(result.status).toBe("blocked-rights");
    expect(result.run.status).toBe("blocked-rights");
    expect(result.histories[0].error).toMatch(/rights_blocked/);
    expect(calls).toBe(0);
    store.close();
  });

  it("classifies timeout/rate-limit retry, budget exhaustion and partial symbols durably", async () => {
    const store = storeForTest();
    const attempts = new Map<string, number>();
    const adapter: MarketDataProviderAdapter = {
      providerIdentity: "fixture-provider", providerProductId: "daily-bars",
      fetchDailyBars: async ({ symbol }) => {
        const count = (attempts.get(symbol) ?? 0) + 1;
        attempts.set(symbol, count);
        if (symbol === "ABC" && count === 1) throw new Error("timeout");
        if (symbol === "SPY") return { ...response(symbol), rows: [] };
        return response(symbol);
      },
    };
    const result = await acquireManagedDailyBars(store, adapter, { symbols: ["ABC", "SPY", "XLK"], startDate: "2026-09-09", endDate: "2026-09-14", expectedLatestSession: "2026-09-14", rightsProfile: executedCommercialProfile(), maxRequests: 4, maxAttempts: 2, retryBaseDelayMs: 0, sleep: async () => undefined, now });
    expect(result.status).toBe("partial");
    expect(result.items.find(item => item.symbol === "ABC")?.status).toBe("completed");
    expect(result.items.find(item => item.symbol === "SPY")?.errorClass).toBe("empty_response");
    expect(result.batch.coverageState).toBe("partial");
    expect(result.histories.find(item => item.symbol === "SPY")?.rows).toEqual([]);
    expect(result.run.budgetUsed).toBe(4);
    store.close();

    const budgetStore = storeForTest();
    const budget = await acquireManagedDailyBars(budgetStore, { providerIdentity: "fixture-provider", providerProductId: "daily-bars", fetchDailyBars: async ({ symbol }) => response(symbol) }, { symbols: ["ABC", "SPY"], startDate: "2026-09-09", endDate: "2026-09-14", expectedLatestSession: "2026-09-14", rightsProfile: executedCommercialProfile(), maxRequests: 1, now });
    expect(budget.status).toBe("blocked-budget");
    expect(budget.items.some(item => item.status === "blocked-budget")).toBe(true);
    budgetStore.close();
  });

  it("resumes completed items idempotently and keeps content identity sensitive to provider/product/adjustment", async () => {
    const store = storeForTest();
    let calls = 0;
    const adapter: MarketDataProviderAdapter = { providerIdentity: "fixture-provider", providerProductId: "daily-bars", fetchDailyBars: async ({ symbol }) => { calls += 1; return response(symbol); } };
    const request = { symbols: ["ABC", "SPY"], startDate: "2026-09-09", endDate: "2026-09-14", expectedLatestSession: "2026-09-14", rightsProfile: executedCommercialProfile(), now };
    const first = await acquireManagedDailyBars(store, adapter, request);
    const firstCalls = calls;
    const replay = await acquireManagedDailyBars(store, adapter, request);
    expect(first.status).toBe("completed");
    expect(replay.status).toBe("completed");
    expect(calls).toBe(firstCalls);
    expect(replay.batch.stableContentHash).toBe(first.batch.stableContentHash);
    const unadjusted = normalizeProviderBatch({ providerIdentity: "fixture-provider", providerProductId: "daily-bars", datasetCategory: "daily_ohlcv", symbols: ["ABC"], requestedStartDate: "2026-09-09", requestedEndDate: "2026-09-14", responses: [response("ABC", "unadjusted")], rightsProfile: commercialProfile(), expectedLatestSession: "2026-09-14" });
    const otherProvider = normalizeProviderBatch({ providerIdentity: "other-provider", providerProductId: "daily-bars", datasetCategory: "daily_ohlcv", symbols: ["ABC"], requestedStartDate: "2026-09-09", requestedEndDate: "2026-09-14", responses: [response("ABC")], rightsProfile: commercialProfile("other-provider", "daily-bars"), expectedLatestSession: "2026-09-14" });
    expect(unadjusted.stableContentHash).not.toBe(first.batch.stableContentHash);
    expect(otherProvider.stableContentHash).not.toBe(first.batch.stableContentHash);
    store.close();
  });

  it("preserves workspace and durable ingestion state across SQLite close/reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "stockledger-chg95-"));
    const path = join(directory, "worker.sqlite");
    const store = new WorkerStore(path);
    store.import(structuredClone(seedData), 0);
    const adapter: MarketDataProviderAdapter = { providerIdentity: "fixture-provider", providerProductId: "daily-bars", fetchDailyBars: async ({ symbol }) => response(symbol) };
    const first = await acquireManagedDailyBars(store, adapter, { symbols: ["ABC"], startDate: "2026-09-09", endDate: "2026-09-14", expectedLatestSession: "2026-09-14", rightsProfile: executedCommercialProfile(), now });
    const revision = store.load()?.revision;
    store.close();
    const reopened = new WorkerStore(path);
    expect(reopened.load()?.revision).toBe(revision);
    expect(reopened.getIngestionRun(first.run.id)?.status).toBe("completed");
    expect(reopened.listIngestionItems(first.run.id)[0].result?.stableContentHash).toBe(first.batch.items[0].stableContentHash);
    expect(reopened.integrityCheck()).toBe(true);
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("does not turn a provider result into a managed job without a matching rights-bound contract, while local worker input remains available", async () => {
    const store = storeForTest();
    const blocked = await runManagedJob(store, [{ symbol: "ABC", rows: bars("ABC", 4) }], { source: "Fixture provider", adjustment: "adjusted", sourceKind: "provider", now });
    expect(blocked.status).toBe("blocked-rights");
    const local = await runManagedJob(store, [{ symbol: "ABC", rows: bars("ABC", 4) }], { source: "User CSV import", adjustment: "adjusted", now });
    expect(local.status).not.toBe("blocked-rights");
    store.close();
  });

  it("keeps fundamentals, events/news and intraday outside the ingestion capability", async () => {
    const store = storeForTest();
    await expect(acquireManagedDailyBars(store, { providerIdentity: "fixture-provider", providerProductId: "daily-bars", fetchDailyBars: async ({ symbol }) => response(symbol) }, { symbols: ["ABC"], startDate: "2026-09-09", endDate: "2026-09-14", datasetCategory: "fundamentals", rightsProfile: commercialProfile(), now })).rejects.toThrow(/deferred|unsupported/);
    store.close();
  });
});
