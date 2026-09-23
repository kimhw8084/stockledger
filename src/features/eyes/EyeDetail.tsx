import React, { useState } from "react";
import { Badge, Button, Card, Divider, Pressable, StyleSheet, Text, View, VStack } from "../../ui";
import { t } from "../../lib/i18n";
import type { AppLanguage } from "../../lib/preferences";

export interface EyeDetailViewModel {
  stockLabel: string;
  stockSymbol?: string;
  recipeLabel: string;
  recipeVersion: string;
  state: string;
  stateTone: "positive" | "warning" | "negative" | "neutral" | "info";
  whyNow: string;
  urgency: string;
  evaluatedAt: string;
  dataQuality: string;
  staleInputs: string[];
  missingInputs: string[];
  lastReviewed: string;
  thesisSnapshot: string;
  invalidationRule: string;
  entryLow: string;
  entryHigh: string;
  alertCount: string;
  decisionCount: string;
  lastDecision?: string;
}

interface EyeDetailProps {
  language: AppLanguage;
  eye: EyeDetailViewModel;
  onOpenStock: () => void;
  onMarkReviewed: () => void;
  onAddJournal: () => void;
  onEdit: () => void;
  onOpenDecision?: (invoker?: unknown) => void;
  onArchive: () => void;
}

export function EyeDetail({ language, eye, onOpenStock, onMarkReviewed, onAddJournal, onEdit, onOpenDecision, onArchive }: EyeDetailProps) {
  const korean = language === "ko";
  const [decisionLinkFocused, setDecisionLinkFocused] = useState(false);
  return (
    <View style={styles.root}>
    <VStack gap="md">
      <Card variant="elevated" padding="compact">
        <VStack gap="sm">
          <View style={styles.heroHeader}>
            <View style={styles.flexOne}>
              <Text variant="micro" tone="secondary">{t(language, "eyes.detail.currentState")}</Text>
              <Text variant="h3">{eye.whyNow}</Text>
            </View>
            <Badge label={eye.state} tone={eye.stateTone} />
          </View>
          <View style={styles.metaLine}>
            <Text variant="caption" tone="secondary">{eye.recipeLabel} · {eye.recipeVersion}</Text>
            <Text variant="caption" tone="secondary">{eye.urgency}</Text>
          </View>
          <Divider />
          <View style={styles.qualityBlock}>
            <Text variant="label">{korean ? "최근 평가 데이터 품질" : "Latest evaluation data quality"}</Text>
            <Text>{eye.dataQuality}</Text>
            <Text variant="caption" tone="secondary">{korean ? "평가 시점" : "Evaluated"}: {eye.evaluatedAt}</Text>
            {eye.staleInputs.length > 0 ? <Text variant="caption" tone="warning">{korean ? "오래된 입력" : "Stale inputs"}: {eye.staleInputs.join(", ")}</Text> : null}
            {eye.missingInputs.length > 0 ? <Text variant="caption" tone="warning">{korean ? "누락된 입력" : "Missing inputs"}: {eye.missingInputs.join(", ")}</Text> : null}
          </View>
        </VStack>
      </Card>

      <View style={styles.factGrid}>
        <Fact label={t(language, "eyes.detail.review")} value={eye.lastReviewed} />
        <Fact label={t(language, "eyes.detail.entryLow")} value={eye.entryLow} />
        <Fact label={t(language, "eyes.detail.entryHigh")} value={eye.entryHigh} />
        <Fact label={t(language, "eyes.detail.alerts")} value={eye.alertCount} />
        <Fact label={t(language, "eyes.detail.journal")} value={eye.decisionCount} />
      </View>

      <Card variant="surface" padding="compact">
        <VStack gap="xs">
          <Text variant="label">{t(language, "eyes.detail.thesisSnapshot")}</Text>
          <Text selectable>{eye.thesisSnapshot}</Text>
        </VStack>
      </Card>
      <Card variant="subtle" padding="compact">
        <VStack gap="xs">
          <Text variant="label">{t(language, "eyes.detail.invalidationRule")}</Text>
          <Text selectable>{eye.invalidationRule}</Text>
        </VStack>
      </Card>
      {eye.lastDecision ? (
        <Card variant="surface" padding="compact">
          <VStack gap="xs">
            <Text variant="label">{t(language, "eyes.detail.lastDecision")}</Text>
            <Text>{eye.lastDecision}</Text>
            {onOpenDecision ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, "common.journal")}
                onPress={(event) => onOpenDecision(event)}
                onFocus={() => setDecisionLinkFocused(true)}
                onBlur={() => setDecisionLinkFocused(false)}
                style={[styles.decisionLink, decisionLinkFocused ? styles.focused : null]}
              >
                <Text variant="label" tone="accent">{t(language, "common.journal")}</Text>
              </Pressable>
            ) : null}
          </VStack>
        </Card>
      ) : null}

      <View style={styles.actionGroup}>
        <Button label={t(language, "eyes.action.markReviewed")} iconStart="check" variant="primary" onPress={onMarkReviewed} responsiveWidth="compact-full" />
        <Button label={t(language, "eyes.action.addJournal")} variant="secondary" onPress={onAddJournal} responsiveWidth="compact-full" />
        <Button label={eye.stockSymbol ? `${t(language, "eyes.action.stock")} · ${eye.stockSymbol}` : t(language, "eyes.action.stock")} variant="outline" onPress={onOpenStock} responsiveWidth="compact-full" />
      </View>
      <Divider />
      <View style={styles.secondaryActions}>
        <Button label={korean ? "수정" : "Edit"} variant="ghost" onPress={onEdit} responsiveWidth="compact-full" />
        <Button label={korean ? "보관" : "Archive Eye"} variant="danger" onPress={onArchive} responsiveWidth="compact-full" />
      </View>
    </VStack>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="subtle" padding="compact">
      <View style={styles.fact}>
        <Text variant="micro" tone="secondary">{label}</Text>
        <Text variant="label">{value}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  flexOne: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  heroHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, gap: theme.spacing.md },
  metaLine: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: theme.spacing.xs },
  qualityBlock: { gap: theme.spacing.xs },
  factGrid: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  fact: { minWidth: 104, flex: 1, gap: theme.spacing.xs },
  actionGroup: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  secondaryActions: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: theme.spacing.xs },
  decisionLink: { minWidth: 0, minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.sm },
  focused: { borderWidth: 3, borderColor: theme.colors.border.focus },
}));
