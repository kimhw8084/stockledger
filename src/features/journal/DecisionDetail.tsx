import React from "react";
import { Badge, Button, Card, Disclosure, Divider, StyleSheet, Text, View, VStack } from "../../ui";
import { t } from "../../lib/i18n";
import type { AppLanguage } from "../../lib/preferences";

export interface DecisionDetailViewModel {
  action: string;
  linkedContext: string;
  recordedAt: string;
  recordedState: string;
  dataQuality: string;
  thesisTiming: string;
  note: string;
  concern: string;
  outcome?: {
    status: string;
    lesson: string;
    recipeSuggestion: string;
    reviewWindow: string;
    priceChangeNote: string;
    isReviewed: boolean;
  };
  amendments: Array<{ amendedAt: string; action: string; note: string }>;
}

interface DecisionDetailProps {
  language: AppLanguage;
  decision: DecisionDetailViewModel;
  outcomeEditor?: React.ReactNode;
  onOpenStock?: () => void;
  onOpenAlert?: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onToggleOutcome?: () => void;
}

export function DecisionDetail({ language, decision, outcomeEditor, onOpenStock, onOpenAlert, onEdit, onArchive, onToggleOutcome }: DecisionDetailProps) {
  const ko = language === "ko";
  return (
    <View style={styles.root}>
    <VStack gap="md">
      <Card variant="elevated" padding="compact">
        <VStack gap="sm">
          <View style={styles.contextHeader}>
            <View style={styles.flexOne}>
              <Text variant="micro" tone="secondary">{ko ? "과거 기록" : "Historical record"}</Text>
              <Text variant="h3">{decision.action}</Text>
              <Text tone="secondary">{decision.linkedContext}</Text>
            </View>
            <Badge label={decision.recordedState} tone="info" />
          </View>
          <Text variant="caption" tone="secondary">{ko ? "기록 시점" : "Recorded"}: {decision.recordedAt}</Text>
          <Divider />
          <View style={styles.contextRows}>
            <Text variant="label">{t(language, "journal.detail.context")}</Text>
            <Fact label={ko ? "결정 당시 상태" : "State at decision"} value={decision.recordedState} />
            <Fact label={ko ? "데이터 품질" : "Data quality"} value={decision.dataQuality} />
            <Fact label={ko ? "논리와 시점" : "Thesis and timing"} value={decision.thesisTiming} />
          </View>
        </VStack>
      </Card>

      <Narrative label={t(language, "journal.detail.note")} value={decision.note} />
      <Narrative label={t(language, "journal.detail.concern")} value={decision.concern} subdued />

      <View style={styles.linkActions}>
        {onOpenStock ? <Button label={t(language, "common.stock")} iconEnd="arrowRight" variant="secondary" onPress={onOpenStock} responsiveWidth="compact-full" /> : null}
        {onOpenAlert ? <Button label={t(language, "journal.action.alert")} variant="outline" onPress={onOpenAlert} responsiveWidth="compact-full" /> : null}
      </View>

      {decision.outcome ? (
        <Card variant="surface" padding="compact">
          <VStack gap="sm">
            <View style={styles.outcomeHeader}>
              <Text variant="h3">{t(language, "journal.detail.outcome", { status: decision.outcome.status })}</Text>
              {onToggleOutcome ? <Button label={decision.outcome.isReviewed ? t(language, "journal.action.outcomeDone") : t(language, "journal.action.markOutcome")} variant="outline" onPress={onToggleOutcome} responsiveWidth="compact-full" /> : null}
            </View>
            <Narrative label={ko ? "학습 메모" : "Learning note"} value={decision.outcome.lesson} subdued />
            <Text tone="secondary">{decision.outcome.recipeSuggestion}</Text>
            <View style={styles.outcomeMeta}>
              <Badge label={decision.outcome.reviewWindow} tone="neutral" />
              <Badge label={decision.outcome.priceChangeNote} tone="neutral" />
            </View>
            {outcomeEditor}
          </VStack>
        </Card>
      ) : null}

      {decision.amendments.length > 0 ? (
        <Disclosure
          id="decision-detail-history"
          title={t(language, "journal.detail.previousVersions")}
          description={ko ? "이 결정 메모의 이전 기록을 펼쳐 확인합니다." : "Expand to inspect earlier authored versions of this decision."}
        >
          <View style={styles.history}>
          <VStack gap="sm">
            {decision.amendments.map((amendment, index) => (
              <Card key={`${amendment.amendedAt}-${index}`} variant="subtle" padding="compact">
                <VStack gap="xs">
                  <Text variant="micro" tone="secondary">{amendment.amendedAt} · {amendment.action}</Text>
                  <Text selectable>{amendment.note}</Text>
                </VStack>
              </Card>
            ))}
          </VStack>
          </View>
        </Disclosure>
      ) : null}

      <Divider />
      <View style={styles.secondaryActions}>
        <Button label={t(language, "journal.action.edit")} variant="ghost" onPress={onEdit} responsiveWidth="compact-full" />
        <Button label={t(language, "journal.action.archive")} variant="danger" onPress={onArchive} responsiveWidth="compact-full" />
      </View>
    </VStack>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Narrative({ label, value, subdued = false }: { label: string; value: string; subdued?: boolean }) {
  return (
    <Card variant={subdued ? "subtle" : "surface"} padding="compact">
      <VStack gap="xs">
        <Text variant="label">{label}</Text>
        <Text selectable>{value}</Text>
      </VStack>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  contextHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, gap: theme.spacing.md },
  flexOne: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  contextRows: { minWidth: 0, gap: theme.spacing.sm },
  fact: { minWidth: 0, gap: theme.spacing.xxs },
  linkActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  outcomeHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.sm },
  outcomeMeta: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  history: { paddingTop: theme.spacing.sm },
  secondaryActions: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: theme.spacing.xs },
}));
