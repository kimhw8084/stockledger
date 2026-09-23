import type { AppLanguage } from "../../lib/preferences";
import { formatLocaleDateTime, localizedAlertPriority, localizedDecisionAction, localizedFreshness } from "../../lib/i18n";
import type { Alert, Decision, Eye, MockSnapshot, Stock } from "../../types";
import type { AlertGroupView, AlertHistoryView } from "./AlertsScreen";

interface AlertQueueGroup {
  stock: Stock;
  snapshot?: MockSnapshot;
  openAlerts: readonly Alert[];
}

interface StockSnapshotEntry {
  stock: Stock;
  snapshot?: MockSnapshot;
}

export interface AlertsModel {
  groups: AlertGroupView[];
  history: AlertHistoryView[];
}

const priorityTone = (priority: Alert["priority"]): AlertGroupView["priorityTone"] =>
  priority === "High" ? "negative" : priority === "Medium" ? "warning" : "neutral";

const uncertaintyText = (language: AppLanguage, alert: Alert) => [
  ...alert.risks,
  ...(alert.evaluationContext?.missingData ?? []),
  ...(alert.evaluationContext?.staleData ?? []),
].join(" · ") || (language === "ko" ? "추가 누락 또는 위험이 기록되지 않았습니다." : "No additional missing inputs or risks are recorded.");

export const buildAlertsModel = ({
  language,
  groups,
  history,
  stockSnapshots,
  eyes,
  decisions,
}: {
  language: AppLanguage;
  groups: readonly AlertQueueGroup[];
  history: readonly Alert[];
  stockSnapshots: readonly StockSnapshotEntry[];
  eyes: readonly Eye[];
  decisions: readonly Decision[];
}): AlertsModel => {
  const groupViews = groups.map((group) => {
    const actualHighestPriority = group.openAlerts.some((alert) => alert.priority === "High")
      ? "High"
      : group.openAlerts.some((alert) => alert.priority === "Medium") ? "Medium" : "Low";
    return {
      stockId: group.stock.id,
      symbol: group.stock.symbol,
      name: group.stock.name,
      freshness: localizedFreshness(language, group.snapshot?.freshness ?? "Unavailable"),
      source: group.snapshot?.sourceName ?? (language === "ko" ? "출처 없음" : "No source recorded"),
      highestPriority: localizedAlertPriority(language, actualHighestPriority),
      priorityTone: priorityTone(actualHighestPriority),
      alerts: group.openAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        whyNow: alert.whyNow,
        priority: localizedAlertPriority(language, alert.priority),
        priorityTone: priorityTone(alert.priority),
        createdAt: formatLocaleDateTime(language, alert.createdAt),
        dataQuality: alert.dataQuality,
        uncertainty: uncertaintyText(language, alert),
        freshness: localizedFreshness(language, group.snapshot?.freshness ?? "Unavailable"),
        source: group.snapshot?.sourceName ?? (language === "ko" ? "출처 없음" : "No source recorded"),
        sample: Boolean(group.snapshot?.isMock),
        reviewLogged: decisions.some((decision) => decision.alertId === alert.id),
      })),
    } satisfies AlertGroupView;
  });
  const historyViews = history.map((alert) => {
    const eye = eyes.find((item) => item.id === alert.eyeId);
    const stock = eye ? stockSnapshots.find((item) => item.stock.id === eye.stockId)?.stock : undefined;
    const snapshot = stockSnapshots.find((item) => item.stock.id === stock?.id)?.snapshot;
    const linkedDecision = decisions.find((decision) => decision.alertId === alert.id);
    const reviewed = alert.reviewed;
    return {
      id: alert.id,
      title: alert.title,
      whyNow: alert.whyNow,
      priority: localizedAlertPriority(language, alert.priority),
      priorityTone: priorityTone(alert.priority),
      createdAt: formatLocaleDateTime(language, alert.createdAt),
      dataQuality: alert.dataQuality,
      uncertainty: uncertaintyText(language, alert),
      freshness: localizedFreshness(language, snapshot?.freshness ?? "Unavailable"),
      source: snapshot?.sourceName ?? (language === "ko" ? "출처 없음" : "No source recorded"),
      sample: Boolean(snapshot?.isMock),
      reviewLogged: reviewed,
      stockId: stock?.id,
      stockLabel: stock ? `${stock.symbol} · ${stock.name}` : language === "ko" ? "종목 정보 없음" : "Stock unavailable",
      state: reviewed
        ? language === "ko" ? "검토 완료" : "Reviewed"
        : language === "ko" ? "다시 보기 예약" : "Snoozed",
      stateTone: reviewed ? "positive" as const : "warning" as const,
      stateDate: alert.snoozedUntil
        ? formatLocaleDateTime(language, alert.snoozedUntil)
        : formatLocaleDateTime(language, alert.createdAt),
      decision: linkedDecision ? localizedDecisionAction(language, linkedDecision.action) : undefined,
    } satisfies AlertHistoryView;
  });
  return { groups: groupViews, history: historyViews };
};
