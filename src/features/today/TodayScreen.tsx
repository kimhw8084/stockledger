import React, { useMemo, useState } from "react";
import { WindowPanel } from "../../components/WindowPanel";
import { useWindowPanelFocus } from "../../hooks/useWindowPanelFocus";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Divider,
  HStack,
  Icon,
  Page,
  PageHeader,
  Pressable,
  Section,
  SectionHeader,
  StateView,
  StatusIndicator,
  StyleSheet,
  Text,
  VStack,
  View,
} from "../../ui";
import {
  formatLocaleDate,
  formatLocaleDateTime,
  localizedEyeState,
  localizedFreshness,
  localizedProviderStatus,
} from "../../lib/i18n";
import type { AppLanguage } from "../../lib/preferences";
import type { Decision, Evaluation, Outcome } from "../../types";
import type { TodayScreenProps, TodayStockItem } from "./types";

const reviewStates = new Set(["Attention Needed", "Thesis Risk Rising", "Thesis Broken", "Opportunity Zone Forming"]);

const daysSince = (value?: string) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
};

const reviewAgeLabel = (language: AppLanguage, value?: string) => {
  const days = daysSince(value);
  if (days === null) return language === "ko" ? "검토 기록 없음" : "No review recorded";
  if (days === 0) return language === "ko" ? "오늘 검토" : "Reviewed today";
  return language === "ko" ? `${days}일 전 검토` : `Reviewed ${days}d ago`;
};

const latestWhyNow = (item: TodayStockItem, language: AppLanguage) =>
  item.dominantEye?.lastEvaluation?.whyNow ??
  (language === "ko" ? "새로운 변화가 아직 기록되지 않았습니다." : "No leading change has been recorded yet.");

const latestRisk = (evaluation: Evaluation | undefined, language: AppLanguage) => {
  const risk = evaluation?.riskWarnings?.[0] ?? evaluation?.hardDisqualifiers?.[0];
  return risk ?? (language === "ko" ? "현재 기록된 위험 경고 없음" : "No recorded risk warning");
};

const freshnessTone = (freshness?: TodayStockItem["snapshot"] extends infer Snapshot
  ? Snapshot extends { freshness: infer Freshness }
    ? Freshness
    : never
  : never) => {
  if (freshness === "Fresh") return "positive" as const;
  if (freshness === "Delayed" || freshness === "Partial") return "warning" as const;
  if (freshness === "Stale" || freshness === "Unavailable" || freshness === "Mock Data") return "negative" as const;
  return "neutral" as const;
};

const stateTone = (state?: string) => {
  if (state === "Attention Needed" || state === "Thesis Broken") return "negative" as const;
  if (state === "Thesis Risk Rising") return "warning" as const;
  if (state === "Opportunity Zone Forming") return "positive" as const;
  if (state === "Watch Closely") return "info" as const;
  return "neutral" as const;
};

const decisionLabel = (language: AppLanguage, decision?: Decision) => {
  if (!decision) return language === "ko" ? "기록 없음" : "No decision recorded";
  const map: Record<Decision["action"], string> = {
    Entered: language === "ko" ? "진입" : "Entered",
    Skipped: language === "ko" ? "건너뜀" : "Skipped",
    Snoozed: language === "ko" ? "다시 보기 예약" : "Snoozed",
    Revised: language === "ko" ? "수정" : "Revised",
    Rejected: language === "ko" ? "거절" : "Rejected",
    "Marked Thesis Broken": language === "ko" ? "논리 훼손 표시" : "Thesis broken",
  };
  return map[decision.action];
};

const actionLabel = (language: AppLanguage, item: TodayStockItem) => {
  if (item.dominantEye?.lastEvaluation?.currentState === "Thesis Broken") {
    return language === "ko" ? "논리 검토" : "Review thesis";
  }
  return language === "ko" ? "검토 열기" : "Open review";
};

const reviewPriority = (item: TodayStockItem) => {
  const evaluation = item.dominantEye?.lastEvaluation;
  const stateScore = evaluation?.currentState === "Thesis Broken"
    ? 100
    : evaluation?.currentState === "Attention Needed"
      ? 96
      : evaluation?.currentState === "Thesis Risk Rising"
        ? 88
        : evaluation?.actionUrgency === "Actively Review"
          ? 84
          : evaluation?.currentState === "Opportunity Zone Forming"
            ? 72
            : evaluation?.actionUrgency === "Review Soon"
              ? 64
              : 40;
  const freshnessScore = item.snapshot?.freshness === "Stale" || item.snapshot?.freshness === "Unavailable" ? 10 : 0;
  return stateScore + item.openAlerts.length * 6 + freshnessScore;
};

const primaryReviewItems = (props: TodayScreenProps) => {
  const candidates = new Map<string, TodayStockItem>();
  for (const item of props.stockDirectory) {
    const state = item.dominantEye?.lastEvaluation?.currentState;
    const urgency = item.dominantEye?.lastEvaluation?.actionUrgency;
    const reviewAge = daysSince(item.dominantEye?.lastReviewedAt);
    if (
      item.openAlerts.length > 0 ||
      reviewStates.has(state ?? "") ||
      urgency === "Actively Review" ||
      urgency === "Review Soon" ||
      reviewAge === null ||
      reviewAge > 14
    ) {
      candidates.set(item.stock.id, item);
    }
  }
  return [...candidates.values()].sort((left, right) => reviewPriority(right) - reviewPriority(left));
};

interface ReviewRowProps {
  item: TodayStockItem;
  language: AppLanguage;
  onOpen: (item: TodayStockItem) => void;
}

function ReviewRow({ item, language, onOpen }: ReviewRowProps) {
  const evaluation = item.dominantEye?.lastEvaluation;
  const state = evaluation?.currentState;
  const snapshot = item.snapshot;
  return (
    <Card variant="elevated" padding="compact" testID={`today-review-${item.stock.symbol}`}>
      <View style={styles.reviewRow}>
        <View style={styles.reviewCopy}>
          <HStack gap="sm" align="center">
            <Text variant="h3" numeric direction="ltr">{item.stock.symbol}</Text>
            <Badge label={localizedEyeState(language, state)} tone={stateTone(state)} />
            {item.openAlerts.length > 0 ? (
              <Badge
                label={language === "ko" ? `열린 알림 ${item.openAlerts.length}개` : `${item.openAlerts.length} open alert${item.openAlerts.length === 1 ? "" : "s"}`}
                tone="negative"
              />
            ) : null}
          </HStack>
          <Text variant="label" numberOfLines={0}>{item.stock.name}</Text>
          <Text tone="secondary">{latestWhyNow(item, language)}</Text>
          <HStack gap="sm" align="start">
            <StatusIndicator
              label={snapshot ? localizedFreshness(language, snapshot.freshness) : language === "ko" ? "데이터 없음" : "No data"}
              description={snapshot ? `${snapshot.sourceName} · ${formatLocaleDateTime(language, snapshot.updatedAt)}` : language === "ko" ? "확인할 원천값 없음" : "No source observation available"}
              tone={freshnessTone(snapshot?.freshness)}
            />
            <View style={styles.reviewAge}>
              <Text variant="micro" tone="secondary">{language === "ko" ? "검토 신선도" : "Review freshness"}</Text>
              <Text variant="caption">{reviewAgeLabel(language, item.dominantEye?.lastReviewedAt)}</Text>
            </View>
          </HStack>
        </View>
        <View style={styles.reviewAction}>
          <Button
            label={`${actionLabel(language, item)} · ${item.stock.symbol}`}
            iconEnd="arrowRight"
            responsiveWidth="compact-full"
            onPress={() => onOpen(item)}
          />
        </View>
      </View>
    </Card>
  );
}

interface ReviewDetailProps {
  item: TodayStockItem;
  language: AppLanguage;
  onClose: () => void;
  onOpenEvidence: () => void;
  onOpenJournal: () => void;
  onOpenAlerts: () => void;
  focus: ReturnType<typeof useWindowPanelFocus>;
}

function ReviewDetail({ item, language, onClose, onOpenEvidence, onOpenJournal, onOpenAlerts, focus }: ReviewDetailProps) {
  const evaluation = item.dominantEye?.lastEvaluation;
  const snapshot = item.snapshot;
  const evidence = evaluation?.supportingEvidence ?? [];
  const risks = [...(evaluation?.riskWarnings ?? []), ...(evaluation?.hardDisqualifiers ?? [])];
  const missing = [...(evaluation?.missingData ?? []), ...(evaluation?.staleData ?? [])];
  return (
    <WindowPanel
      title={`${item.stock.symbol} · ${language === "ko" ? "검토 근거" : "Review evidence"}`}
      subtitle={`${item.stock.name} · ${localizedEyeState(language, evaluation?.currentState)} · ${localizedFreshness(language, snapshot?.freshness ?? "Unavailable")}`}
      onClose={onClose}
      closeLabel={language === "ko" ? "닫기" : "Done"}
      returnFocusRef={focus.returnFocusRef}
      fallbackFocusRef={focus.fallbackFocusRef}
    >
      <VStack gap="lg">
        <Card variant="subtle">
          <VStack gap="sm">
            <Text variant="micro" tone="secondary">{language === "ko" ? "왜 지금인가" : "Why now"}</Text>
            <Text variant="h3">{latestWhyNow(item, language)}</Text>
            <Text tone="secondary">{evaluation?.recommendedAction ?? (language === "ko" ? "근거를 확인하고 의도적인 검토 행동을 기록하세요." : "Inspect the evidence, then record a deliberate review action.")}</Text>
          </VStack>
        </Card>

        <View style={styles.detailGrid}>
          <Card padding="compact">
            <VStack gap="sm">
              <Text variant="label">{language === "ko" ? "위험 맥락" : "Risk context"}</Text>
              <Text tone={risks.length > 0 ? "negative" : "secondary"}>{risks.length > 0 ? risks.join(" · ") : latestRisk(evaluation, language)}</Text>
            </VStack>
          </Card>
          <Card padding="compact">
            <VStack gap="sm">
              <Text variant="label">{language === "ko" ? "데이터 신선도" : "Data freshness"}</Text>
              <Text>{snapshot ? localizedFreshness(language, snapshot.freshness) : language === "ko" ? "없음" : "Unavailable"}</Text>
              <Text variant="caption" tone="secondary">
                {snapshot ? `${snapshot.sourceName} · ${formatLocaleDateTime(language, snapshot.updatedAt)}` : language === "ko" ? "원천 관측값이 없습니다." : "No source observation is available."}
              </Text>
            </VStack>
          </Card>
        </View>

        <View style={styles.detailSection}>
          <Text variant="label">{language === "ko" ? "확인할 근거" : "Evidence to inspect"}</Text>
          {evidence.length > 0 ? evidence.map((entry, index) => <Text key={`${entry}-${index}`} tone="secondary">• {entry}</Text>) : <Text tone="secondary">{language === "ko" ? "평가 근거가 아직 없습니다." : "No supporting evidence is recorded."}</Text>}
        </View>
        {missing.length > 0 ? (
          <AlertBanner
            tone="warning"
            title={language === "ko" ? "데이터 공백을 확인하세요" : "Data coverage needs attention"}
            message={missing.join(" · ")}
          />
        ) : null}
        <Divider />
        <HStack gap="sm" align="stretch">
          <Button label={language === "ko" ? "Watchlist 근거 열기" : "Open watchlist evidence"} iconEnd="arrowRight" onPress={onOpenEvidence} responsiveWidth="compact-full" />
          <Button label={language === "ko" ? "검토·저널 기록" : "Record review"} variant="secondary" iconStart="receipt" onPress={onOpenJournal} responsiveWidth="compact-full" />
          {item.openAlerts.length > 0 ? <Button label={language === "ko" ? "알림 보기" : "View alerts"} variant="ghost" iconStart="bell" onPress={onOpenAlerts} responsiveWidth="compact-full" /> : null}
        </HStack>
      </VStack>
    </WindowPanel>
  );
}

export function TodayScreen(props: TodayScreenProps) {
  const { language } = props;
  const [selectedReview, setSelectedReview] = useState<TodayStockItem | null>(null);
  const [summaryHelpOpen, setSummaryHelpOpen] = useState(false);
  const reviewFocus = useWindowPanelFocus(props.fallbackFocusRef);
  const summaryHelpFocus = useWindowPanelFocus(props.fallbackFocusRef);
  const reviewItems = useMemo(() => primaryReviewItems(props), [props]);
  const changedItems = useMemo(
    () => props.stockDirectory.filter((item) => item.dominantEye?.lastEvaluation?.stateChanged).slice(0, 4),
    [props.stockDirectory],
  );
  const reviewedOutcomes = props.outcomes.filter((outcome) => outcome.status === "Reviewed").length;
  const pendingOutcomes = props.outcomes.length - reviewedOutcomes;
  const freshSnapshots = props.stockDirectory.filter((item) => item.snapshot?.freshness === "Fresh").length;
  const healthyProviders = props.providerHealth.filter((entry) => entry.status === "Healthy").length;
  const reviewNowCount = props.urgentStocks.length;

  const openReview = (item: TodayStockItem, invoker?: unknown) => {
    reviewFocus.captureInvoker(invoker);
    setSelectedReview(item);
  };

  return (
    <Page width="dashboard">
      <PageHeader
        compactActionsInline
        eyebrow={language === "ko" ? "StockLedger · 현재 검토 맥락" : "StockLedger · Current review context"}
        title={language === "ko" ? "오늘" : "Today"}
        description={language === "ko" ? "무엇이 바뀌었는지 이해하고, 검토할 근거를 열고, 의도적인 다음 행동을 기록하세요." : "Understand what changed, inspect the evidence that deserves review, and record a deliberate next action."}
        actions={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={language === "ko" ? "요약 설명" : "Summary help"}
            accessibilityHint={language === "ko" ? "이 페이지의 요약과 읽는 방법을 엽니다" : "Opens an explanation of this page's summary"}
            onPress={(event) => {
              summaryHelpFocus.captureInvoker(event);
              setSummaryHelpOpen(true);
            }}
            style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}
          >
            <Icon name="info" size="sm" tone="secondary" />
            <Text variant="label" tone="secondary">{language === "ko" ? "요약 설명" : "Summary help"}</Text>
          </Pressable>
        )}
        metadata={
          <HStack gap="sm">
            <Badge label={language === "ko" ? `검토 대기 ${reviewItems.length}개` : `${reviewItems.length} reviews in queue`} tone={reviewItems.length > 0 ? "warning" : "positive"} />
            <Text variant="caption" tone="secondary">{language === "ko" ? "자동 매매 없음 · 결과 보장 없음" : "No auto-trading · no outcome guarantee"}</Text>
          </HStack>
        }
      />

      {props.stockDirectory.some((item) => item.snapshot?.isMock || item.snapshot?.freshness === "Unavailable") ? (
        <AlertBanner
          tone="warning"
          title={language === "ko" ? "일부 검토 근거가 제한되어 있습니다" : "Some review evidence is limited"}
          message={language === "ko" ? "더미·미사용·부분 데이터는 사실처럼 확정하지 않습니다. 각 검토 단위의 원천과 신선도를 확인하세요." : "Mock, unavailable, or partial observations are not treated as confirmed facts. Check source and freshness for each review unit."}
        />
      ) : null}

      <Section>
        <SectionHeader
          compactAccessoryInline
          eyebrow={language === "ko" ? "우선순위 1" : "Priority 1"}
          title={language === "ko" ? "검토 필요" : "Needs review"}
          description={language === "ko" ? "왜 지금인지가 보이는 항목부터 확인하세요." : "Start with the items whose visible evidence explains why now."}
          accessory={<Badge label={language === "ko" ? `${reviewItems.length}개` : `${reviewItems.length} items`} tone={reviewItems.length > 0 ? "warning" : "neutral"} />}
        />
        {reviewItems.length === 0 ? (
          <StateView
            kind="empty"
            title={language === "ko" ? "지금 검토할 항목이 없습니다" : "No review items right now"}
            message={language === "ko" ? "새로운 변화가 기록되면 이 큐에 근거와 함께 나타납니다." : "New changes will appear here with their supporting context."}
            actionLabel={language === "ko" ? "알림 큐 열기" : "Open alert queue"}
            onAction={props.onOpenAlerts}
          />
        ) : (
          <VStack gap="sm">
            {reviewItems.slice(0, 6).map((item) => <ReviewRow key={item.stock.id} item={item} language={language} onOpen={(next) => openReview(next)} />)}
          </VStack>
        )}
      </Section>

      <Section>
        <SectionHeader
          eyebrow={language === "ko" ? "시각 트리아지" : "Visual triage"}
          title={language === "ko" ? "리서치 요약" : "Research summary"}
          description={language === "ko" ? "우선순위 2 · 현재 작업 공간의 범위와 확인 가능한 원천을 짧게 확인합니다." : "Priority 2 · a compact read on workspace coverage and the evidence currently available."}
        />
        <View style={styles.summaryGrid}>
          <Card padding="compact"><Text variant="micro" tone="secondary">{language === "ko" ? "관심 종목" : "Watched stocks"}</Text><Text variant="h2" numeric>{props.stockDirectory.length}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "현재 작업 공간" : "Current workspace"}</Text></Card>
          <Card padding="compact"><Text variant="micro" tone="secondary">{language === "ko" ? "즉시 검토" : "Review now"}</Text><Text variant="h2" numeric tone={reviewNowCount > 0 ? "warning" : "primary"}>{reviewNowCount}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "평가된 위험·변화" : "Evaluated risk or change"}</Text></Card>
          <Card padding="compact"><Text variant="micro" tone="secondary">{language === "ko" ? "기회 형성" : "Opportunity forming"}</Text><Text variant="h2" numeric tone="positive">{props.opportunityStocks.length}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "추가 근거 확인 필요" : "Still needs evidence review"}</Text></Card>
          <Card padding="compact"><Text variant="micro" tone="secondary">{language === "ko" ? "열린 알림" : "Open alerts"}</Text><Text variant="h2" numeric tone={props.openAlertsCount > 0 ? "negative" : "primary"}>{props.openAlertsCount}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "검토되지 않은 알림" : "Not yet reviewed"}</Text></Card>
        </View>
        <HStack gap="sm">
          <Button label={language === "ko" ? "Watchlist에서 더 보기" : "See more in watchlist"} variant="secondary" iconEnd="arrowRight" onPress={() => props.onSelectStock(props.stockDirectory[0]?.stock.id ?? "")} disabled={props.stockDirectory.length === 0} />
          <Button label={language === "ko" ? "알림 큐 열기" : "Open alert queue"} variant="ghost" iconStart="bell" onPress={props.onOpenAlerts} />
        </HStack>
      </Section>

      <Section>
        <SectionHeader
          eyebrow={language === "ko" ? "우선순위 3" : "Priority 3"}
          title={language === "ko" ? "모니터링 보드" : "Monitoring Board"}
          description={language === "ko" ? "변화의 출처와 데이터 제공 상태를 함께 표시합니다." : "Keep change signals and monitoring health visible together."}
        />
        <View style={styles.monitoringGrid}>
          <Card padding="compact">
            <VStack gap="sm">
              <Text variant="label">{language === "ko" ? "최근 변화" : "Recent changes"}</Text>
              {changedItems.length > 0 ? changedItems.map((item) => (
                <Pressable key={item.stock.id} accessibilityRole="button" accessibilityLabel={`${language === "ko" ? "변화 열기" : "Open change"} ${item.stock.symbol}`} onPress={(event) => openReview(item, event)} style={({ pressed }) => [styles.changeRow, pressed && styles.pressed]}>
                  <View style={styles.changeCopy}><Text variant="label" numeric direction="ltr">{item.stock.symbol}</Text><Text variant="caption" tone="secondary">{latestWhyNow(item, language)}</Text></View><Icon name="arrowRight" size="sm" tone="secondary" />
                </Pressable>
              )) : <Text tone="secondary">{language === "ko" ? "최근 상태 변화가 없습니다." : "No state changes are recorded yet."}</Text>}
            </VStack>
          </Card>
          <Card padding="compact">
            <VStack gap="sm">
              <Text variant="label">{language === "ko" ? "모니터링 건강" : "Monitoring health"}</Text>
              <StatusIndicator label={props.providerHealthLoading ? (language === "ko" ? "제공자 확인 중" : "Checking providers") : `${healthyProviders}/${props.providerHealth.length} ${language === "ko" ? "제공자 정상" : "providers healthy"}`} description={props.providerHealth.length > 0 ? props.providerHealth.map((entry) => `${entry.provider}: ${localizedProviderStatus(language, entry.status)}`).join(" · ") : language === "ko" ? "제공자 상태 없음" : "No provider health report"} tone={props.providerHealthLoading ? "info" : healthyProviders === props.providerHealth.length ? "positive" : "warning"} />
              <Divider />
              <Text variant="caption" tone="secondary">{props.latestScanRun ? `${language === "ko" ? "최근 스캔" : "Latest scan"}: ${formatLocaleDate(language, props.latestScanRun.scanDate)} · ${props.latestScanRun.status}` : language === "ko" ? "최근 스캔 기록 없음" : "No scan run recorded"}</Text>
              <Text variant="caption" tone="secondary">{language === "ko" ? `최신 확인 가능한 스냅샷 ${freshSnapshots}개` : `${freshSnapshots} snapshots currently marked fresh`}</Text>
              <Button label={language === "ko" ? "레시피와 규칙 열기" : "Open recipes & rules"} variant="secondary" iconEnd="arrowRight" onPress={props.onOpenRecipes} />
            </VStack>
          </Card>
        </View>
      </Section>

      <Section>
        <SectionHeader
          eyebrow={language === "ko" ? "결정 루프" : "Decision loop"}
          title={language === "ko" ? "결정과 학습" : "Decision & learning"}
          description={language === "ko" ? "우선순위 4 · 검토가 실제 판단과 결과 학습으로 닫혔는지 확인합니다." : "Priority 4 · see whether review actions are closing into decisions and outcome learning."}
          accessory={<Badge label={language === "ko" ? `학습 ${reviewedOutcomes}/${props.outcomes.length}` : `Lessons ${reviewedOutcomes}/${props.outcomes.length}`} tone={pendingOutcomes > 0 ? "warning" : "positive"} />}
        />
        <Card padding="compact">
          <VStack gap="md">
            <HStack gap="lg" align="start">
              <View style={styles.loopStep}><Text variant="h3" numeric>{reviewItems.length}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "검토 큐" : "Review queue"}</Text></View>
              <Icon name="arrowRight" size="sm" tone="tertiary" />
              <View style={styles.loopStep}><Text variant="h3" numeric>{props.outcomes.length}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "결정 기록" : "Decisions"}</Text></View>
              <Icon name="arrowRight" size="sm" tone="tertiary" />
              <View style={styles.loopStep}><Text variant="h3" numeric tone={pendingOutcomes > 0 ? "warning" : "positive"}>{reviewedOutcomes}</Text><Text variant="caption" tone="secondary">{language === "ko" ? "학습 완료" : "Lessons reviewed"}</Text></View>
            </HStack>
            <Divider />
            {props.outcomes.slice(0, 3).map((outcome: Outcome) => <View key={outcome.id} style={styles.outcomeRow}><Text variant="label">{outcome.status === "Reviewed" ? (language === "ko" ? "학습 완료" : "Lesson reviewed") : (language === "ko" ? "후속 검토 필요" : "Follow-up needed")}</Text><Text variant="caption" tone="secondary">{outcome.lesson || (language === "ko" ? "학습 메모 없음" : "No lesson recorded")}</Text></View>)}
            {props.outcomes.length === 0 ? <Text tone="secondary">{language === "ko" ? "아직 결정 기록이 없습니다. 근거를 확인한 뒤 저널에 의도적인 행동을 남기세요." : "No decisions are recorded yet. Inspect evidence, then record a deliberate action in Journal."}</Text> : null}
            <Button label={language === "ko" ? "저널에서 기록 계속하기" : "Continue in Journal"} iconEnd="arrowRight" onPress={() => props.onOpenJournal(selectedReview?.dominantEye?.id, selectedReview?.openAlerts[0]?.id)} />
          </VStack>
        </Card>
      </Section>

      {selectedReview ? (
        <ReviewDetail
          item={selectedReview}
          language={language}
          onClose={() => setSelectedReview(null)}
          onOpenEvidence={() => { setSelectedReview(null); props.onSelectStock(selectedReview.stock.id, selectedReview.dominantEye?.id); }}
          onOpenJournal={() => { setSelectedReview(null); props.onOpenJournal(selectedReview.dominantEye?.id, selectedReview.openAlerts[0]?.id); }}
          onOpenAlerts={() => { setSelectedReview(null); props.onOpenAlerts(); }}
          focus={reviewFocus}
        />
      ) : null}
      {summaryHelpOpen ? (
        <WindowPanel
          title={language === "ko" ? "모니터링 보드" : "Monitoring Board"}
          subtitle={language === "ko" ? "이 페이지가 무엇을 보여주고 어떻게 읽어야 하는지 설명합니다." : "This explains what the page shows and how to read it."}
          onClose={() => setSummaryHelpOpen(false)}
          closeLabel={language === "ko" ? "완료" : "Done"}
          returnFocusRef={summaryHelpFocus.returnFocusRef}
          fallbackFocusRef={summaryHelpFocus.fallbackFocusRef}
        >
          <Card variant="subtle">
            <VStack gap="sm">
              <Text variant="h3">{language === "ko" ? "검토 우선순위부터 읽으세요" : "Read from review priority first"}</Text>
              <Text tone="secondary">
                {language === "ko"
                  ? "검토 필요 큐는 왜 지금 확인해야 하는지, 데이터 출처와 신선도, 그리고 다음 행동을 함께 보여줍니다. 아래 모니터링 보드는 최근 변화와 제공자 상태를 보조합니다."
                  : "The needs-review queue explains why now, shows source and freshness, and offers one clear next action. The monitoring board below provides recent changes and provider health as supporting context."}
              </Text>
            </VStack>
          </Card>
        </WindowPanel>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create((theme) => ({
  reviewRow: {
    minWidth: 0,
    flexDirection: { compact: "column", expanded: "row" },
    gap: { compact: theme.spacing.lg, expanded: theme.spacing.xl },
    alignItems: { compact: "stretch", expanded: "flex-start" },
  },
  reviewCopy: { minWidth: 0, flex: 1, gap: theme.spacing.sm },
  // On compact screens the next action leads each review unit so it remains usable
  // in the first queue viewport; expanded screens keep evidence first and action right.
  reviewAction: { minWidth: 0, width: { compact: "100%", expanded: 220 }, alignItems: { compact: "stretch", expanded: "flex-end" }, order: { compact: -1, expanded: 0 } },
  reviewAge: { minWidth: 120, flexShrink: 1 },
  summaryGrid: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  monitoringGrid: { minWidth: 0, flexDirection: { compact: "column", expanded: "row" }, gap: { compact: theme.spacing.md, expanded: theme.spacing.xl } },
  changeRow: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: theme.strokeWidths.standard, borderBottomColor: theme.colors.border.subtle },
  changeCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  detailGrid: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, gap: theme.spacing.md },
  detailSection: { minWidth: 0, gap: theme.spacing.sm },
  loopStep: { minWidth: 72, flex: 1, gap: theme.spacing.xs },
  outcomeRow: { minWidth: 0, gap: theme.spacing.xs, paddingVertical: theme.spacing.sm, borderBottomWidth: theme.strokeWidths.standard, borderBottomColor: theme.colors.border.subtle },
  helpButton: { minWidth: 0, minHeight: theme.controlHeights.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.sm, backgroundColor: theme.colors.background.surface, alignSelf: { compact: "stretch", expanded: "flex-start" } },
}));
