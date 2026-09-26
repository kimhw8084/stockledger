import { makeWorkerHandoffAck, parseWorkerHandoffManifest, type WorkerHandoffAck, type WorkerHandoffManifest } from "../../domain/workerHandoff";

const DATABASE = "stockledger-local-worker-handoff";
const STORE = "settings";
const DIRECTORY_KEY = "worker-output-folder";

type DirectoryAccess = "granted" | "prompt" | "denied";
type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<DirectoryAccess>;
  requestPermission(options: { mode: "readwrite" }): Promise<DirectoryAccess>;
};
export type LocalHandoffRead =
  | { kind: "not-configured" }
  | { kind: "permission-required" }
  | { kind: "manifest"; directory: FileSystemDirectoryHandle; manifest: WorkerHandoffManifest }
  | { kind: "empty"; directory: FileSystemDirectoryHandle }
  | { kind: "failed"; errorCode: "handoff_unavailable" | "invalid_handoff" };

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  request.onerror = () => reject(request.error ?? new Error("Local handoff settings are unavailable."));
  request.onblocked = () => reject(new Error("Close other StockLedger tabs to update local handoff settings."));
});

const storedDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(DIRECTORY_KEY);
      request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Local handoff settings are unavailable."));
    });
  } finally { db.close(); }
};

const saveDirectory = async (directory: FileSystemDirectoryHandle) => {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(directory, DIRECTORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Could not save the local handoff folder."));
    });
  } finally { db.close(); }
};

const permission = async (directory: FileSystemDirectoryHandle, allowPrompt: boolean): Promise<DirectoryAccess> => {
  const handle = directory as PermissionDirectoryHandle;
  const state = await handle.queryPermission({ mode: "readwrite" });
  return state === "prompt" && allowPrompt ? handle.requestPermission({ mode: "readwrite" }) : state;
};

export const connectWorkerHandoffFolder = async (): Promise<void> => {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!window.isSecureContext || !picker) throw new Error("Choose the local handoff folder in a supported secure browser. The app does not access local files without your permission.");
  const directory = await picker.call(window, { id: "stockledger-worker-handoff", mode: "readwrite" });
  const access = await permission(directory, true);
  if (access !== "granted") throw new Error("Folder access was not granted. The saved app workspace was left unchanged.");
  await saveDirectory(directory);
};

export const readLocalWorkerHandoff = async (requestAccess = false): Promise<LocalHandoffRead> => {
  let directory: FileSystemDirectoryHandle | null;
  try { directory = await storedDirectory(); }
  catch { return { kind: "failed", errorCode: "handoff_unavailable" }; }
  if (!directory) return { kind: "not-configured" };
  try {
    if (await permission(directory, requestAccess) !== "granted") return { kind: "permission-required" };
    const fileHandle = await directory.getFileHandle("pending.json");
    const raw = await (await fileHandle.getFile()).text();
    try { return { kind: "manifest", directory, manifest: parseWorkerHandoffManifest(raw) }; }
    catch { return { kind: "failed", errorCode: "invalid_handoff" }; }
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return { kind: "empty", directory };
    return { kind: "failed", errorCode: "handoff_unavailable" };
  }
};

export const acknowledgeLocalWorkerHandoff = async (directory: FileSystemDirectoryHandle, ack: WorkerHandoffAck) => {
  const file = await directory.getFileHandle("ack.json", { create: true });
  const writable = await file.createWritable({ keepExistingData: false });
  try { await writable.write(JSON.stringify(ack)); await writable.close(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
};

export const makeLocalWorkerHandoffAck = (workspaceId: string, sequence: number, batchId: string) => makeWorkerHandoffAck(workspaceId, sequence, batchId);
