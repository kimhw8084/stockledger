import React from "react";
import { useWindowDimensions } from "react-native";
import {
  Badge,
  Button,
  Card,
  Divider,
  HStack,
  PageHeader,
  SegmentedControl,
  StatusIndicator,
  StyleSheet,
  Text,
  VStack,
  View,
} from "../../ui";
import type { AppLanguage } from "../../lib/preferences";

export type AlertsView = "Current" | "History";

export interface AlertItemView {
  id: string;
  title: string;
  whyNow: string;
  priority: string;
  priorityTone: "negative" | "warning" | "neutral";
  createdAt: string;
  dataQuality: string;
  uncertainty: string;
  freshness: string;
  source: string;
  sample: boolean;
  reviewLogged: boolean;
}

export interface AlertGroupView {
  stockId: string;
  symbol: string;
  name: string;
  freshness: string;
  source: string;
  highestPriority: string;
  priorityTone: "negative" | "warning" | "neutral";
  alerts: readonly AlertItemView[];
}

export interface AlertHistoryView extends AlertItemView {
  stockId?: string;
  stockLabel: string;
  state: string;
  stateTone: "positive" | "warning" | "neutral";
  stateDate: string;
  decision?: string;
}

export interface AlertsScreenProps {
  language: AppLanguage;
  view: AlertsView;
  onViewChange: (view: AlertsView) => void;
  groups: readonly AlertGroupView[];
  history: readonly AlertHistoryView[];
  snoozedCount: number;
  reviewedCount: number;
  onOpenDetail: (alertId: string) => void;
  onOpenStock: (stockId: string, alertId: string) => void;
  onQuickDecision: (alertId: string, action: "Entered" | "Skipped") => void;
  onSnooze: (alertId: string) => void;
  onUnsnooze: (alertId: string) => void;
  onReviewed: (alertId: string) => void;
  onAcknowledgeGroup: (stockId: string) => void;
}

const labels = (language: AppLanguage) => language === "ko" ? {
  current: "현재",
  history: "기록",
  currentQueue: "현재 검토 대기",
  historyQueue: "다시 보기 및 검토 완료",
  currentEmptyTitle: "현재 검토 대기 알림이 없습니다",
  currentEmpty: "다시 보기 예약 알림은 기록 탭에서 확인할 수 있습니다.",
  historyEmpty: "다시 보기 또는 검토 완료된 알림이 아직 없습니다.",
  stock: "종목",
  priority: "우선순위",
  inspect: "근거 확인",
  recordEntered: "진입 결정 기록",
  recordSkipped: "건너뛴 결정 기록",
  snooze: "24시간 다시 보기",
  reviewed: "검토 완료",
  acknowledge: "그룹 전체 검토 완료",
  opened: "열림",
  snoozed: "다시 보기 예약",
  reviewedState: "검토 완료",
  source: "출처 및 최신성",
  quality: "데이터 상태",
  uncertainty: "불확실성 및 누락",
  sample: "샘플 데이터",
  historyDate: "예약/검토 시점",
  decision: "연결된 결정",
  viewStock: "종목 보기",
  unsnooze: "현재 대기로 되돌리기",
  reviewRecorded: "검토 기록 있음",
  notReviewed: "검토 기록 없음",
  high: "높음",
  medium: "보통",
  low: "낮음",
} : {
  current: "Current",
  history: "History",
  currentQueue: "Actionable now",
  historyQueue: "Snoozed and reviewed",
  currentEmptyTitle: "No alerts need review now",
  currentEmpty: "Alerts scheduled to return appear in History.",
  historyEmpty: "No snoozed or reviewed alerts are recorded.",
  stock: "Stock",
  priority: "Priority",
  inspect: "Inspect evidence",
  recordEntered: "Record entered decision",
  recordSkipped: "Record skipped decision",
  snooze: "Snooze for 24 hours",
  reviewed: "Mark reviewed",
  acknowledge: "Mark group reviewed",
  opened: "Open",
  snoozed: "Snoozed",
  reviewedState: "Reviewed",
  source: "Source and freshness",
  quality: "Data state",
  uncertainty: "Uncertainty and missing inputs",
  sample: "Sample data",
  historyDate: "Snooze/review time",
  decision: "Linked decision",
  viewStock: "Open stock",
  unsnooze: "Return to current queue",
  reviewRecorded: "Review recorded",
  notReviewed: "No review recorded",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function AlertsScreen(props: AlertsScreenProps) {
  const text = labels(props.language);
  const compactActions = useWindowDimensions().width < 600;
  const currentCount = props.groups.reduce((total, group) => total + group.alerts.length, 0);
  return (
    <View style={styles.root} nativeID="alerts-primary-surface">
      <SegmentedControl
        label={props.language === "ko" ? "알림 보기" : "Alert view"}
        value={props.view}
        onChange={(value) => props.onViewChange(value as AlertsView)}
        options={[
          { value: "Current", label: `${text.current} · ${currentCount}` },
          { value: "History", label: `${text.history} · ${props.history.length}` },
        ]}
        testID="alerts-view-control"
      />

      {props.view === "Current" ? (
        <VStack gap="lg">
          <PageHeader
            title={text.currentQueue}
            description={`${currentCount} ${props.language === "ko" ? "개 알림 ·" : "alerts ·"} ${props.snoozedCount} ${text.snoozed.toLowerCase()} · ${props.reviewedCount} ${text.reviewedState.toLowerCase()}`}
          />
          {props.groups.length === 0 ? (
            <Card variant="subtle">
              <VStack gap="sm">
                <Text variant="h3">{text.currentEmptyTitle}</Text>
                <Text tone="secondary">{text.currentEmpty}</Text>
              </VStack>
            </Card>
          ) : props.groups.map((group) => (
            <Card key={group.stockId} variant="subtle" padding="compact">
              <VStack gap="md">
                <View style={styles.groupHeader}>
                  <View style={styles.stockIdentity}>
                    <Text variant="h3" numeric direction="ltr">{group.symbol}</Text>
                    <Text>{group.name}</Text>
                    <StatusIndicator label={group.freshness} description={`${group.source} · ${text.source}`} tone="neutral" />
                  </View>
                  <View style={styles.groupPriority}>
                    <Text variant="micro" tone="secondary">{text.priority}</Text>
                    <Badge label={group.highestPriority} tone={group.priorityTone} />
                  </View>
                </View>
                <View>
                  {group.alerts.map((alert, index) => (
                    <React.Fragment key={alert.id}>
                      {index > 0 ? <Divider inset="start" /> : null}
                      <View style={styles.alertRow} testID={`alerts-alert-${alert.id}`}>
                        <View style={styles.alertCopy}>
                          <HStack gap="sm" align="center">
                            <Text variant="h3">{alert.title}</Text>
                            <Badge label={alert.priority} tone={alert.priorityTone} />
                            {alert.reviewLogged ? <Badge label={text.reviewRecorded} tone="info" /> : null}
                            {alert.sample ? <Badge label={text.sample} tone="warning" /> : null}
                          </HStack>
                          <Text>{alert.whyNow}</Text>
                          {compactActions ? <Button label={text.inspect} iconEnd="arrowRight" onPress={() => props.onOpenDetail(alert.id)} responsiveWidth="compact-full" /> : null}
                          <Text variant="caption" tone="secondary">{alert.createdAt} · {text.quality}: {alert.dataQuality}</Text>
                          <Text variant="caption" tone="secondary">{text.source}: {alert.freshness} · {alert.source}</Text>
                          <Text variant="caption" tone="secondary">{text.uncertainty}: {alert.uncertainty}</Text>
                        </View>
                        <View style={styles.actions}>
                          {!compactActions ? <Button label={text.inspect} iconEnd="arrowRight" onPress={() => props.onOpenDetail(alert.id)} responsiveWidth="compact-full" /> : null}
                          <Button label={text.recordEntered} variant="secondary" size="sm" onPress={() => props.onQuickDecision(alert.id, "Entered")} responsiveWidth="compact-full" />
                          <Button label={text.recordSkipped} variant="secondary" size="sm" onPress={() => props.onQuickDecision(alert.id, "Skipped")} responsiveWidth="compact-full" />
                          <Button label={text.snooze} variant="ghost" size="sm" onPress={() => props.onSnooze(alert.id)} responsiveWidth="compact-full" />
                          <Button label={text.reviewed} variant="ghost" size="sm" onPress={() => props.onReviewed(alert.id)} responsiveWidth="compact-full" />
                        </View>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={styles.groupFooter}>
                  <Button label={`${text.viewStock} · ${group.symbol}`} variant="secondary" size="sm" onPress={() => props.onOpenStock(group.stockId, group.alerts[0]?.id ?? "")} responsiveWidth="compact-full" />
                  <Button label={text.acknowledge} variant="ghost" size="sm" onPress={() => props.onAcknowledgeGroup(group.stockId)} responsiveWidth="compact-full" />
                </View>
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : (
        <VStack gap="md">
          <PageHeader title={text.historyQueue} description={text.historyDate} />
          {props.history.length === 0 ? (
            <Card variant="subtle"><Text tone="secondary">{text.historyEmpty}</Text></Card>
          ) : props.history.map((alert, index) => (
            <React.Fragment key={alert.id}>
              {index > 0 ? <Divider inset="start" /> : null}
              <View style={styles.alertRow} testID={`alerts-history-${alert.id}`}>
                <View style={styles.alertCopy}>
                  <HStack gap="sm" align="center">
                    <Text variant="h3">{alert.stockLabel} · {alert.title}</Text>
                    <Badge label={alert.state} tone={alert.stateTone} />
                    <Badge label={alert.priority} tone={alert.priorityTone} />
                  </HStack>
                  <Text>{alert.whyNow}</Text>
                  <Text variant="caption" tone="secondary">{alert.createdAt} · {text.historyDate}: {alert.stateDate}</Text>
                  <Text variant="caption" tone="secondary">{text.quality}: {alert.dataQuality} · {text.source}: {alert.freshness} · {alert.source}</Text>
                  <Text variant="caption" tone="secondary">{text.uncertainty}: {alert.uncertainty}</Text>
                  {alert.decision ? <Text variant="caption" tone="secondary">{text.decision}: {alert.decision}</Text> : null}
                </View>
                <View style={styles.actions}>
                  <Button label={text.inspect} variant="secondary" onPress={() => props.onOpenDetail(alert.id)} responsiveWidth="compact-full" />
                  {alert.stockId ? <Button label={text.viewStock} variant="ghost" onPress={() => props.onOpenStock(alert.stockId ?? "", alert.id)} responsiveWidth="compact-full" /> : null}
                  {alert.stateTone === "warning" ? <Button label={text.unsnooze} variant="ghost" onPress={() => props.onUnsnooze(alert.id)} responsiveWidth="compact-full" /> : null}
                </View>
              </View>
            </React.Fragment>
          ))}
        </VStack>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.xl },
  groupHeader: { minWidth: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  stockIdentity: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  groupPriority: { alignItems: "flex-end", gap: theme.spacing.xs },
  alertRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.lg, paddingVertical: theme.spacing.lg },
  alertCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  actions: { minWidth: 0, width: { compact: "100%", medium: 236 }, flexShrink: 0, gap: theme.spacing.xs },
  groupFooter: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs, borderTopWidth: theme.strokeWidths.standard, borderTopColor: theme.colors.border.subtle, paddingTop: theme.spacing.md },
}));
