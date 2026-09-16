import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
export async function downloadText(name: string, text: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  const file = new File(Paths.cache, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  file.create({ overwrite: true }); file.write(text);
  try { await Sharing.shareAsync(file.uri, { mimeType: name.endsWith(".json") ? "application/json" : "text/plain", UTI: name.endsWith(".json") ? "public.json" : "public.plain-text", dialogTitle: "Save your StockLedger export" }); }
  finally { if (file.exists) file.delete(); }
}
export async function pickTextFile(kind: "json" | "csv"): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: kind === "json" ? "application/json" : ["text/csv", "text/comma-separated-values", "text/plain"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    const limitMb = kind === "json" ? 100 : 20;
    if (file.size > limitMb * 1_000_000) throw new Error(`Choose a ${kind.toUpperCase()} file smaller than ${limitMb} MB.`);
    return await file.text();
  } finally { if (file.exists) file.delete(); }
}
