import AsyncStorage from "@react-native-async-storage/async-storage";
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  compareAndSetItem(key: string, expected: string | null, next: string, backupKey: string, initialBackup?: string): Promise<void>;
};
/** Test/non-platform fallback. Native and web use database transactions. */
const store: KeyValueStore = {
  ...AsyncStorage,
  async compareAndSetItem(key: string, expected: string | null, next: string, backupKey: string, initialBackup?: string) {
    if (await AsyncStorage.getItem(key) !== expected) throw new Error("Another session saved changes. Reload before editing further.");
    if (expected !== null) await AsyncStorage.setItem(backupKey, expected);
    else if (initialBackup !== undefined && await AsyncStorage.getItem(backupKey) === null) await AsyncStorage.setItem(backupKey, initialBackup);
    await AsyncStorage.setItem(key, next);
  },
};
export default store;
