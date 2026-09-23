import React, { useState } from "react";
import type { AppLanguage } from "../../lib/preferences";
import { AlertBanner, Button, Card, Text, VStack } from "../../ui";
import type { useAppModel } from "../../hooks/useAppModel";
import { parseWatchlistCsv, type WatchlistRow } from "../../domain/watchlistImport";
import { pickTextFile } from "../../platform/fileAccess";
import type { AppData } from "../../types";
import { t } from "../../lib/i18n";
import { FormField } from "./FormField";

type ImportActions = Pick<ReturnType<typeof useAppModel>["actions"], "importWatchlist">;

export function WatchlistImportPanel({
  data,
  actions,
  language,
}: {
  data: Pick<AppData, "stocks">;
  actions: ImportActions;
  language: AppLanguage;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<WatchlistRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const existing = preview?.filter((row) => data.stocks.some((stock) => stock.symbol === row.symbol)).length ?? 0;
  const validate = () => {
    setError("");
    try {
      setPreview(parseWatchlistCsv(csv));
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : language === "ko" ? "CSV를 읽지 못했습니다." : "The CSV could not be read.");
    }
  };
  const importRows = async () => {
    setError("");
    setMessage("");
    try {
      await actions.importWatchlist(csv);
      setCsv("");
      setPreview(null);
      setMessage(t(language, "workspace.watchlist.success"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : language === "ko" ? "가져오기를 완료하지 못했습니다." : "The import could not be completed.");
    }
  };
  return (
    <Card variant="subtle" padding="compact">
      <VStack gap="md">
        <Text variant="h3">{t(language, "workspace.watchlist.title")}</Text>
        <Text tone="secondary">{t(language, "workspace.watchlist.body")}</Text>
        <Button
          label={t(language, "workspace.watchlist.choose")}
          variant="secondary"
          onPress={async () => {
            const text = await pickTextFile("csv");
            if (text !== null) { setCsv(text); setPreview(null); setError(""); }
          }}
          responsiveWidth="compact-full"
        />
        <FormField
          label={t(language, "workspace.watchlist.title")}
          placeholder={t(language, "workspace.watchlist.placeholder")}
          value={csv}
          onChangeText={(value) => { setCsv(value); setPreview(null); setMessage(""); setError(""); }}
          multiline
        />
        <Button
          label={t(language, "workspace.watchlist.preview")}
          variant="secondary"
          disabled={!csv.trim()}
          onPress={validate}
          responsiveWidth="compact-full"
        />
        {preview ? (
          <VStack gap="sm">
            <Text>{t(language, "workspace.watchlist.summary", { added: preview.length - existing, existing })}</Text>
            <Text variant="caption" tone="secondary" selectable>{preview.map((row) => row.symbol).join(", ")}</Text>
            <Button label={t(language, "workspace.watchlist.import")} onPress={() => { void importRows(); }} responsiveWidth="compact-full" />
          </VStack>
        ) : null}
        {error ? <AlertBanner tone="negative" title={error} /> : null}
        {message ? <AlertBanner tone="positive" title={message} /> : null}
      </VStack>
    </Card>
  );
}
