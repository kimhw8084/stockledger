import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import type { KeyValueStore } from "./keyValueStore";
let connection: Promise<SQLiteDatabase> | undefined;
const database = () => connection ??= (async () => {
  const db = await openDatabaseAsync("stockledger.sqlite");
  await db.execAsync("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  return db;
})().catch(error => { connection = undefined; throw error; });
const store: KeyValueStore = {
  async getItem(key: string): Promise<string | null> {
    const db = await database();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM documents WHERE key=?", key);
    if (row) return row.value;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;
    await db.runAsync("INSERT OR IGNORE INTO documents VALUES (?,?)", key, legacy);
    return (await db.getFirstAsync<{ value: string }>("SELECT value FROM documents WHERE key=?", key))!.value;
  },
  async setItem(key: string, value: string) { const db = await database(); await db.runAsync("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value); },
  async removeItem(key: string) { const db = await database(); await db.runAsync("DELETE FROM documents WHERE key=?", key); await AsyncStorage.removeItem(key); },
  async compareAndSetItem(key: string, expected: string | null, next: string, backupKey: string, initialBackup?: string) {
    const db = await database();
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ value: string }>("SELECT value FROM documents WHERE key=?", key);
      if ((row?.value ?? null) !== expected) throw new Error("Another session saved changes. Reload before editing further.");
      if (expected !== null) await tx.runAsync("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", backupKey, expected);
      else if (initialBackup !== undefined) {
        const backup = await tx.getFirstAsync<{ value: string }>("SELECT value FROM documents WHERE key=?", backupKey);
        if (!backup) await tx.runAsync("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", backupKey, initialBackup);
      }
      await tx.runAsync("INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, next);
    });
  },
};
export default store;
