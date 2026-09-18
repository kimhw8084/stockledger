import type { RawBarRecord } from "../../src/types";
import { runManagedJob, type ManagedWorkerResult } from "./managed";
import { deliverDueNotifications, type NotificationTransport } from "./notificationTransport";
import { WorkerStore } from "./store";

export interface WorkerRunOptions {
  source: string;
  adjustment: "adjusted" | "unadjusted" | "unknown";
  now?: Date;
}

/** Backward-compatible local entry point. Managed execution is the shared engine. */
export async function runWorker(store: WorkerStore, histories: { symbol: string; rows: RawBarRecord[]; error?: string }[], options: WorkerRunOptions): Promise<ManagedWorkerResult> {
  return runManagedJob(store, histories, options);
}

/** Delivery is a separate server-only phase; it never consumes evaluation-job attempts. */
export const runNotificationDelivery = (store: WorkerStore, transport: NotificationTransport | null, options?: Parameters<typeof deliverDueNotifications>[2]) =>
  deliverDueNotifications(store, transport, options);
