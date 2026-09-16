import AsyncStorage from "@react-native-async-storage/async-storage";
/** Test/non-platform fallback. Native and web use database transactions. */
export default {
  ...AsyncStorage,
  async compareAndSetItem(key: string, expected: string | null, next: string, backupKey: string) {
    if (await AsyncStorage.getItem(key) !== expected) throw new Error("Another session saved changes. Reload before editing further.");
    if (expected !== null) await AsyncStorage.setItem(backupKey, expected);
    await AsyncStorage.setItem(key, next);
  },
};
