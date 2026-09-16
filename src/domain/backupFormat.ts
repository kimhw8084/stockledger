import { validateAppData } from "./appDataSchema";
import type { AppData } from "../types";
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
