import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "./keyValueStore";
let connection: Promise<IDBDatabase> | undefined;
const database = () => connection ??= new Promise((resolve, reject) => {
  const request = indexedDB.open("stockledger", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("documents");
  request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
  request.onerror = () => { connection = undefined; reject(request.error ?? new Error("Cannot open device storage.")); };
  request.onblocked = () => { connection = undefined; reject(new Error("Close other StockLedger tabs to upgrade local storage.")); };
});
const read = async (key: string): Promise<string | null> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readonly");
    const request = tx.objectStore("documents").get(key);
    tx.oncomplete = () => resolve(request.result ?? null);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Local read failed."));
  });
};
const store: KeyValueStore = {
  async getItem(key: string): Promise<string | null> {
    // The prototype used localStorage. Read it only until this key is migrated.
    const current = await read(key);
    if (current !== null) return current;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite"); const collection = tx.objectStore("documents");
      const existing = collection.get(key); existing.onsuccess = () => { if (existing.result === undefined) collection.put(legacy, key); };
      tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error);
    });
    return read(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Local write failed. Export a backup and free device space."));
    });
  },
  async compareAndSetItem(key: string, expected: string | null, next: string, backupKey: string): Promise<void> {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite"); const collection = tx.objectStore("documents");
      const current = collection.get(key);
      current.onsuccess = () => {
        if ((current.result ?? null) !== expected) { tx.abort(); reject(new Error("Another tab saved changes. Reload before editing further.")); return; }
        if (expected !== null) collection.put(expected, backupKey);
        collection.put(next, key);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Local transaction failed."));
    });
  },
  async removeItem(key: string): Promise<void> {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite"); tx.objectStore("documents").delete(key);
      tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error);
    });
    await AsyncStorage.removeItem(key);
  },
};
export default store;
