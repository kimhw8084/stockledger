import type { LocalHandoffRead } from "./localHandoff";

export const connectWorkerHandoffFolder = async (): Promise<void> => {
  throw new Error("Local worker folder handoff is available in supported web browsers only.");
};
export const readLocalWorkerHandoff = async (): Promise<LocalHandoffRead> => ({ kind: "not-configured" });
export const acknowledgeLocalWorkerHandoff = async (): Promise<void> => {};
export const makeLocalWorkerHandoffAck = (_workspaceId: string, _sequence: number, _batchId: string) => {
  throw new Error("Local worker folder handoff is available in supported web browsers only.");
};
