import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Disclosure,
  Divider,
  HStack,
  StatusIndicator,
  StyleSheet,
  Text,
  VStack,
  View,
  Pressable,
} from "../../../ui";
import type { AppLanguage } from "../../../lib/preferences";

export interface StockEntityDetailEvidence {
  id: string;
  family: string;
  title: string;
  status: string;
  tone: "positive" | "warning" | "negative" | "neutral" | "info";
  summary: string;
  value: string;
  context: string;
  pinned: boolean;
}

export interface StockEntityDetailViewModel {
  id: string;
  symbol: string;
  name: string;
  reviewState: string;
  reviewTone: "positive" | "warning" | "negative" | "neutral" | "info";
  freshness: string;
  freshnessTone: "positive" | "warning" | "negative" | "neutral" | "info";
  sourceAndTime: string;
  coverage: string;
  price: string;
  evidenceSummary: string;
  sample: boolean;
  eyesCount: number;
  metricsCount: number;
  evidence: StockEntityDetailEvidence[];
  decisions: Array<{ id: string; action: string; recordedAt: string; stateAtDecision: string; dataQuality: string; note: string; concern: string }>;
}

export interface StockEntityDetailProps {
  language: AppLanguage;
  stock: StockEntityDetailViewModel;
  onManageEyes: () => void;
  onRegisterEye: () => void;
  onEdit: () => void;
  onArchive: () => void | Promise<void>;
  onClear: () => void;
  onOpenMetric: (metricId: string, invoker?: unknown) => void;
  onOpenDecision: (decisionId: string, invoker?: unknown) => void;
}

const copy = (language: AppLanguage) => language === "ko" ? {
  identity: "종목 정체성과 데이터 권한",
  latestPrice: "최근 가격",
  currentEvidence: "현재 근거",
  evidenceDescription: "상태, 값, 맥락을 확인하고 필요한 항목의 상세 정보를 엽니다.",
  history: "과거 결정 기록",
  historyDescription: "기록 당시의 상태와 데이터 품질을 보며 현재 근거와 구분합니다.",
  noHistory: "이 종목에 연결된 과거 결정 기록이 없습니다.",
  noEvidence: "이 선택과 필터에 표시할 근거가 없습니다.",
  management: "종목 관리",
  inspect: "근거 상세",
  pinned: "고정",
  sample: "샘플 데이터입니다. 실제 시장 관측값으로 해석하지 마세요.",
  monitoring: "관찰 맥락",
  monitoringDescription: (count: number) => `${count}개 관찰 항목이 이 종목을 모니터링합니다. 관찰 항목을 열어 상태와 최근 평가를 검토하세요.`,
  openEyes: "관찰 항목 검토",
  registerEye: "관찰 항목 등록",
  evidenceCount: (count: number) => `${count}개 근거 항목`,
  edit: "종목 수정",
  clear: "선택 해제",
  archive: "종목 보관",
} : {
  identity: "Stock identity and data authority",
  latestPrice: "Latest price",
  currentEvidence: "Current evidence",
  evidenceDescription: "Check each status, value, and context before opening a focused detail.",
  history: "Historical decisions",
  historyDescription: "Review the recorded state and data quality separately from current evidence.",
  noHistory: "No historical decisions are linked to this stock.",
  noEvidence: "No evidence matches this selection and filter.",
  management: "Stock management",
  inspect: "Evidence detail",
  pinned: "Pinned",
  sample: "Sample data. Do not treat these values as live market observations.",
  monitoring: "Monitoring context",
  monitoringDescription: (count: number) => `${count} Eyes monitor this stock. Open them to review state and the latest evaluation.`,
  openEyes: "Review Eyes",
  registerEye: "Register Eye",
  evidenceCount: (count: number) => `${count} evidence items`,
  edit: "Edit stock",
  clear: "Clear selection",
  archive: "Archive stock",
};

export function StockEntityDetail({ language, stock, onManageEyes, onRegisterEye, onEdit, onArchive, onClear, onOpenMetric, onOpenDecision }: StockEntityDetailProps) {
  const text = copy(language);
  const [focusedDecisionId, setFocusedDecisionId] = useState<string | null>(null);
  const evidenceGroups = stock.evidence.reduce<Array<{ family: string; items: StockEntityDetailEvidence[] }>>((groups, item) => {
    const group = groups.find((candidate) => candidate.family === item.family);
    if (group) group.items.push(item);
    else groups.push({ family: item.family, items: [item] });
    return groups;
  }, []);
  return (
    <View style={styles.root}>
    <VStack gap="sm">
      <View style={styles.identity}>
        <View style={styles.identityCopy}>
          <Text variant="micro" tone="secondary">{text.identity}</Text>
          <View style={styles.titleLine}>
          <HStack gap="sm" align="center">
            <Text variant="h1" numeric direction="ltr">{stock.symbol}</Text>
            <Badge label={stock.reviewState} tone={stock.reviewTone} />
          </HStack>
          </View>
          <Text variant="bodyLg">{stock.name}</Text>
          <Text tone="secondary">{stock.evidenceSummary}</Text>
        </View>
      </View>

      <Card variant="subtle" padding="compact">
        <VStack gap="sm">
          <View style={styles.facts}>
            <View style={styles.priceFact}>
              <Text variant="micro" tone="secondary">{text.latestPrice}</Text>
              <Text variant="h2" numeric direction="ltr">{stock.price}</Text>
            </View>
            <StatusIndicator label={stock.freshness} description={stock.sourceAndTime} tone={stock.freshnessTone} />
          </View>
          <View style={styles.coverageRow}>
            <Text variant="caption" tone="secondary">{stock.coverage}</Text>
            {stock.sample ? <Badge label={text.sample} tone="warning" /> : null}
          </View>
        </VStack>
      </Card>

      <Card variant="surface" padding="compact">
        <View style={styles.monitoringRow}>
          <View style={styles.monitoringCopy}>
            <Text variant="h3">{text.monitoring}</Text>
            <Text tone="secondary">{copy(language).monitoringDescription(stock.eyesCount)}</Text>
          </View>
          <View style={styles.monitoringActions}>
            <Button label={text.openEyes} iconEnd="arrowRight" variant="secondary" onPress={onManageEyes} responsiveWidth="compact-full" />
            <Button label={text.registerEye} iconStart="eye" variant="ghost" onPress={onRegisterEye} responsiveWidth="compact-full" />
          </View>
        </View>
      </Card>

      <View>
        <View style={styles.evidenceHeader}>
          <Text variant="h3">{text.currentEvidence}</Text>
          <Text variant="caption" tone="secondary">{text.evidenceDescription} · {text.evidenceCount(stock.metricsCount)}</Text>
        </View>
        {stock.evidence.length === 0 ? (
          <Card variant="subtle"><Text tone="secondary">{text.noEvidence}</Text></Card>
        ) : (
          <View style={styles.evidenceGroups}>
            {evidenceGroups.map((group) => (
              <View key={group.family} style={styles.evidenceGroup}>
                <Text variant="label">{group.family}</Text>
                <View style={styles.evidenceList}>
                  {group.items.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {index > 0 ? <Divider inset="start" /> : null}
                      <View style={styles.evidenceRow}>
                        <View style={styles.evidenceCopy}>
                          <View style={styles.titleLine}>
                            <HStack gap="sm" align="center">
                              <Text variant="h3">{item.title}</Text>
                              <Badge label={item.status} tone={item.tone} />
                              {item.pinned ? <Badge label={text.pinned} tone="info" /> : null}
                            </HStack>
                          </View>
                          <Text>{item.summary}</Text>
                          <Text variant="caption" tone="secondary">{item.value} · {item.context}</Text>
                        </View>
                        <RowAction label={text.inspect} onPress={(invoker) => onOpenMetric(item.id, invoker)} />
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Disclosure id="stock-historical-decisions" title={text.history} description={text.historyDescription}>
        <View style={styles.historyList}>
          {stock.decisions.length === 0 ? (
            <Text tone="secondary">{text.noHistory}</Text>
          ) : stock.decisions.map((decision) => (
            <React.Fragment key={decision.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${decision.action} · ${decision.recordedAt}`}
                onPress={(event) => onOpenDecision(decision.id, event)}
                onFocus={() => setFocusedDecisionId(decision.id)}
                onBlur={() => setFocusedDecisionId((current) => current === decision.id ? null : current)}
                style={[styles.historyRow, focusedDecisionId === decision.id ? styles.focusedRow : null]}
              >
                <View style={styles.historyCopy}>
                  <Text variant="label">{decision.action} · {decision.recordedAt}</Text>
                  <Text variant="caption" tone="secondary">{decision.stateAtDecision} · {decision.dataQuality}</Text>
                  <Text numberOfLines={2}>{decision.note}</Text>
                  {decision.concern ? <Text variant="caption" tone="secondary" numberOfLines={2}>{decision.concern}</Text> : null}
                </View>
                <Text variant="label" tone="accent">›</Text>
              </Pressable>
              <Divider />
            </React.Fragment>
          ))}
        </View>
      </Disclosure>

      <Card variant="subtle" padding="compact">
        <VStack gap="sm">
          <Text variant="label">{text.management}</Text>
          <View style={styles.secondaryActions}>
            <Button label={text.edit} variant="outline" onPress={onEdit} responsiveWidth="compact-full" />
            <Button label={text.clear} variant="ghost" onPress={onClear} responsiveWidth="compact-full" />
          </View>
          <Divider />
          <Button label={text.archive} variant="danger" onPress={onArchive} responsiveWidth="compact-full" />
        </VStack>
      </Card>
    </VStack>
    </View>
  );
}

function RowAction({ label, onPress }: { label: string; onPress: (invoker?: unknown) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.rowAction, focused ? styles.focusedRow : null]}>
      <Text variant="label" tone="accent">{label}</Text>
      <Text variant="label" tone="accent">›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  identity: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.lg },
  identityCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  titleLine: { flexWrap: "wrap" },
  secondaryActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  facts: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", alignItems: "flex-start", gap: theme.spacing.md },
  priceFact: { minWidth: 120, gap: theme.spacing.xxs },
  coverageRow: { minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  monitoringRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md },
  monitoringCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  monitoringActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  evidenceHeader: { minWidth: 0, gap: theme.spacing.xs },
  evidenceGroups: { marginTop: theme.spacing.md, gap: theme.spacing.lg },
  evidenceGroup: { minWidth: 0, gap: theme.spacing.xs },
  evidenceList: { minWidth: 0 },
  evidenceRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  evidenceCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  historyList: { minWidth: 0, gap: theme.spacing.sm, paddingTop: theme.spacing.md },
  historyRow: { minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radii.sm },
  historyCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  rowAction: { minWidth: 112, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.sm },
  focusedRow: { borderWidth: 3, borderColor: theme.colors.border.focus },
}));
