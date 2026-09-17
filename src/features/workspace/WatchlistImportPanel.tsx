import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Input } from "../../components/common";
import { parseWatchlistCsv, type WatchlistRow } from "../../domain/watchlistImport";
import { pickTextFile } from "../../platform/fileAccess";
import type { AppData } from "../../types";
import type { useAppModel } from "../../hooks/useAppModel";
import { t, type AppLanguage } from "../../lib/i18n";
export function WatchlistImportPanel({ data, actions, language }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"]; language: AppLanguage }) {
  const [csv, setCsv] = useState(""); const [preview, setPreview] = useState<WatchlistRow[] | null>(null); const [message, setMessage] = useState("");
  const existing = preview?.filter(row => data.stocks.some(stock => stock.symbol === row.symbol)).length ?? 0;
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: "#15283b" }}>{t(language, "workspace.watchlist.title")}</Text>
    <Text style={{ color: "#334b62", lineHeight: 22 }}>{t(language, "workspace.watchlist.body")}</Text>
    <Button label={t(language, "workspace.watchlist.choose")} tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) { setCsv(text); setPreview(null); } }} />
    <Input placeholder={t(language, "workspace.watchlist.placeholder")} value={csv} onChangeText={text => { setCsv(text); setPreview(null); }} multiline />
    <Button label={t(language, "workspace.watchlist.preview")} disabled={!csv.trim()} tone="secondary" onPress={() => setPreview(parseWatchlistCsv(csv))} />
    {preview ? <><Text>{t(language, "workspace.watchlist.summary", { added: preview.length - existing, existing })}</Text><Text selectable>{preview.map(row => row.symbol).join(", ")}</Text><Button label={t(language, "workspace.watchlist.import")} onPress={async () => { await actions.importWatchlist(csv); setCsv(""); setPreview(null); setMessage(t(language, "workspace.watchlist.success")); }} /></> : null}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}
