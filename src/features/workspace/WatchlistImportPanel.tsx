import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Input } from "../../components/common";
import { parseWatchlistCsv, type WatchlistRow } from "../../domain/watchlistImport";
import { pickTextFile } from "../../platform/fileAccess";
import type { AppData } from "../../types";
import type { useAppModel } from "../../hooks/useAppModel";
export function WatchlistImportPanel({ data, actions }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"] }) {
  const [csv, setCsv] = useState(""); const [preview, setPreview] = useState<WatchlistRow[] | null>(null); const [message, setMessage] = useState("");
  const existing = preview?.filter(row => data.stocks.some(stock => stock.symbol === row.symbol)).length ?? 0;
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: "#15283b" }}>Import a watchlist</Text>
    <Text style={{ color: "#334b62", lineHeight: 22 }}>CSV needs Symbol or Ticker; Name and Thesis are optional. Existing stocks and their notes are preserved.</Text>
    <Button label="Choose watchlist CSV" tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) { setCsv(text); setPreview(null); } }} />
    <Input placeholder="Symbol,Name,Thesis" value={csv} onChangeText={text => { setCsv(text); setPreview(null); }} multiline />
    <Button label="Preview watchlist import" disabled={!csv.trim()} tone="secondary" onPress={() => setPreview(parseWatchlistCsv(csv))} />
    {preview ? <><Text>{preview.length - existing} new stocks; {existing} existing stocks will be kept as they are.</Text><Text selectable>{preview.map(row => row.symbol).join(", ")}</Text><Button label="Import new stocks" onPress={async () => { await actions.importWatchlist(csv); setCsv(""); setPreview(null); setMessage("Watchlist imported. Add recipes and price history when ready."); }} /></> : null}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}
