import { validateAppData } from "./appDataSchema";
import type { AppData } from "../types";
import { MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION, MARKET_DATA_RIGHTS_CONTRACT_REVISION, MARKET_DATA_RIGHTS_CONTRACT_VERSION, type MarketDataRightsProvenance, type RightsUseCategory } from "../lib/marketDataContract";
export type StorageEnvelope = { format: "stockledger"; schemaVersion: 2; revision: number; savedAt: string; data: AppData };
export const parseExport = (raw: string): AppData => {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed === "object" && parsed !== null && "schemaVersion" in parsed) {
    const envelope = parsed as StorageEnvelope;
    if (envelope.format !== "stockledger" || envelope.schemaVersion !== 2 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 0) {
      throw new Error("Unsupported StockLedger backup version.");
    }
    return validateAppData(envelope.data);
  }
  return validateAppData(parsed);
};
export const serializeExport = (data: AppData, revision = 0, now = new Date()): string => JSON.stringify({
  format: "stockledger", schemaVersion: 2, revision, savedAt: now.toISOString(), data: validateAppData(data),
} satisfies StorageEnvelope);

const rightsProvenanceAllows = (provenance: MarketDataRightsProvenance | undefined, use: RightsUseCategory, now: Date) => {
  if (!provenance || provenance.rightsContractVersion !== MARKET_DATA_RIGHTS_CONTRACT_VERSION || provenance.rightsContractRevision !== MARKET_DATA_RIGHTS_CONTRACT_REVISION) return false;
  if (provenance.rightsAuthorityModelVersion !== MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION || provenance.rightsAuthorityState !== "executed-agreement" || !provenance.rightsEvidenceRef) return false;
  if (!provenance.rightsAuthorityEffectiveAtUtc || !Number.isFinite(Date.parse(provenance.rightsAuthorityEffectiveAtUtc)) || now < new Date(provenance.rightsAuthorityEffectiveAtUtc)) return false;
  if (provenance.rightsAuthorityExpiresAtUtc && (!Number.isFinite(Date.parse(provenance.rightsAuthorityExpiresAtUtc)) || now >= new Date(provenance.rightsAuthorityExpiresAtUtc))) return false;
  const decision = provenance.rightsDecisions[use];
  if (!decision?.allowed || decision.state !== "allowed") return false;
  if (decision.effectiveAtUtc && (!Number.isFinite(Date.parse(decision.effectiveAtUtc)) || now < new Date(decision.effectiveAtUtc))) return false;
  if (decision.expiresAtUtc && (!Number.isFinite(Date.parse(decision.expiresAtUtc)) || now >= new Date(decision.expiresAtUtc))) return false;
  return true;
};

/** User-facing export fence. Internal worker backups continue to use serializeExport. */
export const serializeUserExport = (data: AppData, revision = 0, now = new Date()): string => {
  const derivedAllowed = (provenance: MarketDataRightsProvenance | undefined) => Boolean(
    rightsProvenanceAllows(provenance, "user_export", now)
    && rightsProvenanceAllows(provenance, "derived_metrics", now)
    && rightsProvenanceAllows(provenance, "end_user_display", now),
  );
  const rawAllowed = (provenance: MarketDataRightsProvenance | undefined) => Boolean(
    rightsProvenanceAllows(provenance, "user_export", now)
    && rightsProvenanceAllows(provenance, "raw_redistribution", now),
  );
  const localArchive = (provider: string) => !provider.trim().toLowerCase().includes("stooq");
  const exportableSignalIds = new Set(data.scanSignals.filter(signal => !signal.rightsProvenance || derivedAllowed(signal.rightsProvenance)).map(signal => signal.signalId));
  const filtered: AppData = {
    ...data,
    rawBarArchives: data.rawBarArchives.filter(batch => batch.rightsProvenance ? rawAllowed(batch.rightsProvenance) : localArchive(batch.provider)),
    snapshots: data.snapshots.filter(snapshot => {
      const providerDerived = snapshot.provenance?.origin === "provider" || Boolean(snapshot.provenance?.rightsProvenance);
      return !providerDerived || derivedAllowed(snapshot.provenance?.rightsProvenance);
    }),
    processedFeatures: data.processedFeatures.filter(feature => !feature.rightsProvenance || derivedAllowed(feature.rightsProvenance)),
    scanSignals: data.scanSignals.filter(signal => !signal.rightsProvenance || derivedAllowed(signal.rightsProvenance)),
    forwardProofLedger: data.forwardProofLedger.filter(proof => {
      const signal = data.scanSignals.find(candidate => candidate.signalId === proof.signalId);
      return !signal?.rightsProvenance || exportableSignalIds.has(proof.signalId);
    }),
    alerts: data.alerts.filter(alert => !alert.rightsProvenance || derivedAllowed(alert.rightsProvenance)),
    workerAppHandoff: data.workerAppHandoff ? {
      ...data.workerAppHandoff,
      evidence: data.workerAppHandoff.evidence.filter(record => {
        const snapshot = record.evidence.snapshot;
        const provenance = snapshot.provenance?.rightsProvenance ?? record.evidence.alert?.rightsProvenance;
        const providerDerived = snapshot.provenance?.origin === "provider" || Boolean(provenance);
        return !providerDerived || derivedAllowed(provenance);
      }),
    } : undefined,
    universeSnapshots: data.universeSnapshots,
  };
  return serializeExport(filtered, revision, now);
};
