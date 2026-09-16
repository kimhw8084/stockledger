import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
export const contentHash = (value: unknown) => bytesToHex(sha256(utf8ToBytes(JSON.stringify(canonical(value)))));
