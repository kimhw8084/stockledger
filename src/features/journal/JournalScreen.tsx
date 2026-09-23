import React from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  HStack,
  PageHeader,
  SegmentedControl,
  StyleSheet,
  Text,
  VStack,
  View,
} from "../../ui";
import type { AppLanguage } from "../../lib/preferences";

export type JournalFilter = "All" | "Entered" | "Skipped" | "Risky";

export interface JournalFilterChoice {
  value: JournalFilter;
  label: string;
}

export interface JournalEntryView {
  id: string;
  date: string;
  decision: string;
  instrument: string;
  context: string;
  note: string;
  state: string;
  dataQuality: string;
  thesis: string;
  timing: string;
  concern: string;
  outcome?: {
    status: string;
    lesson: string;
    suggestion: string;
  };
  stockId?: string;
  eyeId?: string;
  alertId?: string;
}

export interface JournalScreenProps {
  language: AppLanguage;
  entries: readonly JournalEntryView[];
  totalCount: number;
  pendingOutcomeCount: number;
  filter: JournalFilter;
  filterChoices: readonly JournalFilterChoice[];
  onFilterChange: (filter: JournalFilter) => void;
  onOpenDecision: (id: string) => void;
  onOpenStock: (stockId: string, eyeId: string) => void;
  onOpenAlert: (alertId: string) => void;
  onNew: () => void;
}

const text = (language: AppLanguage) => language === "ko" ? {
  description: "날짜와 결정 맥락을 따라 과거 근거와 결과를 되짚습니다.",
  history: "결정 기록",
  outcomesPending: "결과 검토 대기",
  new: "새 기록",
  newNote: "새 기록은 의도적으로 작성할 때만 저장됩니다.",
  emptyTitle: "아직 결정 기록이 없습니다",
  empty: "알림 검토나 새 기록에서 결정을 저장하면 근거와 결과를 시간순으로 확인할 수 있습니다.",
  open: "결정 근거 보기",
  outcome: "결과와 학습",
  pending: "결과 검토 대기",
  completed: "검토 완료",
  state: "결정 당시 상태",
  quality: "데이터 상태",
  thesis: "논리 유효성",
  timing: "시점",
  concern: "우려 사항",
  notCaptured: "기록되지 않음",
  stock: "종목 보기",
  alert: "연결 알림 보기",
  noNote: "결정 메모가 없습니다.",
  noOutcome: "결과 기록이 아직 없습니다.",
} : {
  description: "Follow decisions by date and context to recover the evidence and outcomes that informed them.",
  history: "Decision history",
  outcomesPending: "outcomes awaiting review",
  new: "New",
  newNote: "A new record is saved only when you deliberately complete it.",
  emptyTitle: "No decisions have been recorded",
  empty: "Save a decision from alert review or start a deliberate new record to build a timeline of evidence and outcomes.",
  open: "Open decision evidence",
  outcome: "Outcome and learning",
  pending: "Review pending",
  completed: "Reviewed",
  state: "State at decision",
  quality: "Data state",
  thesis: "Thesis validity",
  timing: "Timing",
  concern: "Concern",
  notCaptured: "Not recorded",
  stock: "Open stock",
  alert: "Open linked alert",
  noNote: "No decision note was recorded.",
  noOutcome: "No outcome has been recorded yet.",
};

export function JournalScreen(props: JournalScreenProps) {
  const copy = text(props.language);
  return (
    <View style={styles.root} nativeID="journal-primary-surface">
      <PageHeader title={props.language === "ko" ? "기록" : "Journal"} description={copy.description} />

      <View style={styles.historyHeader}>
        <View style={styles.headerCopy}>
          <Text variant="h2">{copy.history}</Text>
          <Text variant="caption" tone="secondary">{props.totalCount} {props.language === "ko" ? "개 기록 ·" : "entries ·"} {props.pendingOutcomeCount} {copy.outcomesPending}</Text>
        </View>
        <Button label={copy.new} variant="secondary" iconStart="plus" onPress={props.onNew} responsiveWidth="compact-full" />
      </View>

      <SegmentedControl
        label={props.language === "ko" ? "저널 필터" : "Journal filter"}
        value={props.filter}
        options={props.filterChoices}
        onChange={(value) => props.onFilterChange(value as JournalFilter)}
        testID="journal-filter-control"
      />
      <Text variant="caption" tone="secondary">{copy.newNote}</Text>

      {props.entries.length === 0 ? (
        <Card variant="subtle">
          <VStack gap="sm">
            <Text variant="h3">{copy.emptyTitle}</Text>
            <Text tone="secondary">{copy.empty}</Text>
          </VStack>
        </Card>
      ) : (
        <View style={styles.timeline}>
          {props.entries.map((entry, index) => (
            <React.Fragment key={entry.id}>
              {index > 0 ? <Divider inset="start" /> : null}
              <View style={styles.entry}>
                <View style={styles.entryMain}>
                  <Text variant="micro" tone="secondary">{entry.date}</Text>
                  <HStack gap="sm" align="center">
                    <Text variant="h3">{entry.decision} · {entry.instrument}</Text>
                    <Badge label={entry.state} tone="neutral" />
                  </HStack>
                  <Text variant="caption" tone="secondary">{entry.context}</Text>
                  <Text>{entry.note || copy.noNote}</Text>
                  <View style={styles.metadata}>
                    <Text variant="caption" tone="secondary">{copy.quality}: {entry.dataQuality}</Text>
                    <Text variant="caption" tone="secondary">{copy.thesis}: {entry.thesis}</Text>
                    <Text variant="caption" tone="secondary">{copy.timing}: {entry.timing}</Text>
                    <Text variant="caption" tone="secondary">{copy.concern}: {entry.concern || copy.notCaptured}</Text>
                  </View>
                  {entry.outcome ? (
                    <View style={styles.outcome}>
                      <HStack gap="sm" align="center">
                        <Text variant="label">{copy.outcome}</Text>
                        <Badge label={entry.outcome.status} tone={entry.outcome.status === copy.completed ? "positive" : "warning"} />
                      </HStack>
                      <Text>{entry.outcome.lesson}</Text>
                      <Text variant="caption" tone="secondary">{entry.outcome.suggestion}</Text>
                    </View>
                  ) : <Text variant="caption" tone="secondary">{copy.noOutcome}</Text>}
                </View>
                <View style={styles.entryActions}>
                  <Button label={copy.open} onPress={() => props.onOpenDecision(entry.id)} responsiveWidth="compact-full" />
                  {entry.stockId ? <Button label={copy.stock} variant="secondary" size="sm" onPress={() => props.onOpenStock(entry.stockId ?? "", entry.eyeId ?? "")} responsiveWidth="compact-full" /> : null}
                  {entry.alertId ? <Button label={copy.alert} variant="ghost" size="sm" onPress={() => props.onOpenAlert(entry.alertId ?? "")} responsiveWidth="compact-full" /> : null}
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.lg },
  historyHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md },
  headerCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  timeline: { minWidth: 0 },
  entry: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.lg, paddingVertical: theme.spacing.lg },
  entryMain: { minWidth: 0, flex: 1, gap: theme.spacing.sm },
  metadata: { minWidth: 0, gap: theme.spacing.xs, paddingVertical: theme.spacing.sm, borderTopWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.subtle },
  outcome: { minWidth: 0, gap: theme.spacing.xs, padding: theme.spacing.md, borderStartWidth: theme.strokeWidths.emphasis, borderStartColor: theme.colors.border.strong, backgroundColor: theme.colors.background.subtle },
  entryActions: { minWidth: 0, width: { compact: "100%", medium: 216 }, flexShrink: 0, gap: theme.spacing.xs },
}));
