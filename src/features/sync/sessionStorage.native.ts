import * as SecureStore from "expo-secure-store";
// Store sessions in the OS keychain. Chunking supports providers with large JWTs;
// write the manifest last so interrupted refreshes retain the previous session.
const safeKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, "_");
type Manifest = { generation: string; count: number };
const manifest = async (key: string): Promise<Manifest | null> => {
  const raw = await SecureStore.getItemAsync(safeKey(key));
  if (!raw) return null;
  let value: Manifest;
  try { value = JSON.parse(raw) as Manifest; } catch { throw new Error("Saved sign-in session needs to be cleared before signing in again."); }
  if (!value || !/^[a-zA-Z0-9-]{1,100}$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > 64) throw new Error("Saved sign-in session needs to be cleared before signing in again.");
  return value;
};
export default {
  async getItem(key: string) {
    const entry = await manifest(key); if (!entry) return null;
    const pieces = await Promise.all(Array.from({ length: entry.count }, (_, i) => SecureStore.getItemAsync(`${safeKey(key)}.${entry.generation}.${i}`)));
    return pieces.some(piece => piece === null) ? null : pieces.join("");
  },
  async setItem(key: string, value: string) {
    const old = await manifest(key);
    const generation = `${Date.now()}-${globalThis.crypto.randomUUID()}`;
    const chunks = value.match(/[\s\S]{1,1000}/g) ?? [""];
    if (chunks.length > 64) throw new Error("Sign-in session exceeds secure storage limits.");
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${safeKey(key)}.${generation}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(safeKey(key), JSON.stringify({ generation, count: chunks.length }));
    if (old) await Promise.all(Array.from({ length: old.count }, (_, i) => SecureStore.deleteItemAsync(`${safeKey(key)}.${old.generation}.${i}`)));
  },
  async removeItem(key: string) {
    const old = await manifest(key); await SecureStore.deleteItemAsync(safeKey(key));
    if (old) await Promise.all(Array.from({ length: old.count }, (_, i) => SecureStore.deleteItemAsync(`${safeKey(key)}.${old.generation}.${i}`)));
  },
};
