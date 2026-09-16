import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { AppLanguage } from "../lib/preferences";
import {
  localizedDecisionAction,
  localizedEyeState,
  localizedFreshness,
} from "../lib/i18n";
import { buildLogicLabScorecard, logicThesisRiskLabel } from "../lib/logicHelpers";
import { Alert, Decision, Eye, Evaluation, MockSnapshot, Outcome, Stock } from "../types";
import { Card, Reveal } from "./common";
import { WindowPanel } from "./WindowPanel";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HomeBucket = "Review Now" | "Forming" | "Risk Rising" | "Review Soon" | "All";
type HomeHelpTarget =
  | "summary"
  | "visualTriagem"
  | "decisionLoop"
  | "monitoringBoard";

interface StockDirectoryItem {
  stock: Stock;
  eyes: Eye[];
  snapshot?: MockSnapshot;
  openAlerts: Alert[];
  dominantEye?: Eye;
  decisions: Decision[];
}

interface HomeVisualDashboardProps {
  language: AppLanguage;
  stockDirectory: StockDirectoryItem[];
  urgentStocks: StockDirectoryItem[];
  opportunityStocks: StockDirectoryItem[];
  staleReviewStocks: StockDirectoryItem[];
  openAlertsCount: number;
  outcomes: Outcome[];
  onSelectStock: (stockId: string, eyeId: string) => void;
  onOpenAlerts: () => void;
  onOpenLogicLab: () => void;
  onOpenJournal: (eyeId: string, alertId?: string) => void;
}

const HOME_BUCKETS: HomeBucket[] = [
  "Review Now",
  "Forming",
  "Risk Rising",
  "Review Soon",
  "All",
];

const STATE_TIMELINE = [
  "Not Relevant",
  "Becoming Interesting",
  "Watch Closely",
  "Opportunity Zone Forming",
  "Attention Needed",
  "Thesis Risk Rising",
  "Thesis Broken",
];

const bucketLabel = (language: AppLanguage, bucket: HomeBucket) => {
  if (language === "en") return bucket;
  switch (bucket) {
    case "Review Now":
      return "지금 검토";
    case "Forming":
      return "형성 중";
    case "Risk Rising":
      return "위험 상승";
    case "Review Soon":
      return "곧 검토";
    default:
      return "전체";
  }
};

const stateColor = (state?: string | null) => {
  switch (state) {
    case "Attention Needed":
      return "#ef4444";
    case "Opportunity Zone Forming":
      return "#0f9f6e";
    case "Watch Closely":
      return "#2563eb";
    case "Becoming Interesting":
      return "#7c3aed";
    case "Thesis Risk Rising":
      return "#f59e0b";
    case "Thesis Broken":
      return "#475569";
    default:
      return "#94a3b8";
  }
};

const urgencyWeight = (urgency?: string | null) => {
  switch (urgency) {
    case "Actively Review":
      return 100;
    case "Review Soon":
      return 72;
    default:
      return 40;
  }
};

const riskWeight = (evaluation?: Evaluation) => {
  if (!evaluation) return 18;
  const label = logicThesisRiskLabel("en", evaluation);
  if (label.includes("Broken")) return 96;
  if (label.includes("High")) return 82;
  if (label.includes("Elevated")) return 58;
  return 26;
};

const setupWeight = (evaluation?: Evaluation) => {
  switch (evaluation?.setupStrength) {
    case "High":
      return 88;
    case "Medium":
      return 60;
    default:
      return 32;
  }
};

const localizedUrgency = (language: AppLanguage, urgency?: string | null) => {
  if (language === "en") {
    if (urgency === "Actively Review") return "Attention Needed";
    if (urgency === "Review Soon") return "Review Soon";
    return "Watch";
  }
  if (urgency === "Actively Review") return "즉시 검토";
  if (urgency === "Review Soon") return "곧 검토";
  return "관찰";
};

const daysSince = (date?: string) => {
  if (!date) return 999;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));
};

const reviewTone = (days: number) => {
  if (days <= 7) return "#0f9f6e";
  if (days <= 14) return "#f59e0b";
  return "#ef4444";
};

const latestDecision = (item: StockDirectoryItem) =>
  [...item.decisions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

const latestWhyNow = (item: StockDirectoryItem, language: AppLanguage) =>
  item.dominantEye?.lastEvaluation?.whyNow ??
  (language === "ko" ? "새로운 변화는 아직 없습니다." : "No new change is leading yet.");

const latestTrigger = (item: StockDirectoryItem, language: AppLanguage) => {
  const evaluation = item.dominantEye?.lastEvaluation;
  if (!evaluation) return language === "ko" ? "다음 트리거 없음" : "No next trigger";
  const topWarning =
    evaluation.riskWarnings?.[0] ??
    evaluation.hardDisqualifiers?.[0] ??
    evaluation.supportingEvidence?.[0] ??
    evaluation.contradictingEvidence?.[0];
  return topWarning ?? (language === "ko" ? "추가 확인 대기" : "Waiting for next signal");
};

const buildHeatbars = (evaluation?: Evaluation) => {
  const scorecard = buildLogicLabScorecard(evaluation);
  return [
    { key: "eligibility", value: scorecard.eligibility, color: "#2563eb" },
    { key: "evidence", value: scorecard.evidence, color: "#0f9f6e" },
    { key: "timing", value: scorecard.timing, color: "#8b5cf6" },
    { key: "risk", value: Math.max(0, 100 - scorecard.riskPenalty * 5), color: "#f59e0b" },
    { key: "review", value: scorecard.review, color: "#ef4444" },
  ];
};

const localizedHeatbar = (language: AppLanguage, key: string) => {
  if (language === "en") return key;
  switch (key) {
    case "eligibility":
      return "적격";
    case "evidence":
      return "근거";
    case "timing":
      return "타이밍";
    case "risk":
      return "위험";
    default:
      return "검토";
  }
};

const homeHelpContent = (language: AppLanguage, target: HomeHelpTarget) => {
  const content = {
    summary: {
      title: language === "ko" ? "요약" : "Summary",
      body:
        language === "ko"
          ? "홈 전체에서 가장 먼저 봐야 하는 숫자만 압축해 보여줍니다. 즉시 검토, 위험 상승, 검토 지연, 열린 알림 수를 통해 오늘 무엇이 급한지 빠르게 판단합니다."
          : "This compresses the few global figures that matter first: urgent reviews, rising risk, stale reviews, and open alerts.",
    },
    visualTriagem: {
      title: language === "ko" ? "시각 트리아지" : "Visual Triage",
      body:
        language === "ko"
          ? "읽기 전에 감으로 우선순위를 잡는 구역입니다. 중심 영웅 영역과 레이더 스트립을 통해 어떤 종목이 지금 가장 주목할 만한지 빠르게 훑습니다."
          : "This is the glance-first triage zone. The constellation and radar strip help you spot which stocks deserve attention before reading rows.",
    },
    decisionLoop: {
      title: language === "ko" ? "결정 루프" : "Decision Loop",
      body:
        language === "ko"
          ? "신호가 실제 판단과 성과 검토까지 이어졌는지 보여줍니다. 신호만 많고 학습이 닫히지 않는 종목을 구분하는 데 중요합니다."
          : "This shows whether signals actually turned into decisions and reviewed outcomes, not just noise.",
    },
    monitoringBoard: {
      title: language === "ko" ? "모니터링 보드" : "Monitoring Board",
      body:
        language === "ko"
          ? "실제 행동이 일어나는 메인 보드입니다. 각 종목을 접고 펼치며 신호, 위험, 다음 트리거, 액션을 바로 확인하고 실행합니다."
          : "This is the main action board where each stock can be expanded to inspect signals, risks, next triggers, and actions.",
    },
  } as const;
  return content[target];
};

const MiniSparkline = ({ series, tone }: { series?: number[]; tone: string }) => {
  const values = series?.slice(-18) ?? [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return (
    <View style={styles.sparklineRow}>
      {values.map((value, index) => {
        const normalized = max === min ? 0.55 : (value - min) / (max - min);
        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.sparkBar,
              {
                height: 12 + normalized * 26,
                backgroundColor: tone,
                opacity: 0.35 + normalized * 0.65,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const RingGauge = ({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) => (
  <View style={styles.ringGaugeWrap}>
    <View style={[styles.ringGauge, { borderColor: `${color}33` }]}>
      <View
        style={[
          styles.ringGaugeFill,
          {
            borderColor: color,
            opacity: 0.45 + value / 180,
            transform: [{ rotate: `${Math.max(-130, Math.min(130, value * 1.8 - 90))}deg` }],
          },
        ]}
      />
      <Text style={styles.ringGaugeValue}>{Math.round(value)}</Text>
    </View>
    <Text style={styles.ringGaugeLabel}>{label}</Text>
  </View>
);

const FreshnessClock = ({ days, language }: { days: number; language: AppLanguage }) => (
  <View style={styles.freshnessClock}>
    <View style={[styles.freshnessClockRing, { borderColor: reviewTone(days) }]}>
      <Text style={styles.freshnessClockValue}>{days > 99 ? "99+" : days}</Text>
    </View>
    <Text style={styles.freshnessClockLabel}>{language === "ko" ? "검토 경과" : "Review age"}</Text>
  </View>
);

const HomeVisualDashboard: React.FC<HomeVisualDashboardProps> = ({
  language,
  stockDirectory,
  urgentStocks,
  opportunityStocks,
  staleReviewStocks,
  openAlertsCount,
  outcomes,
  onSelectStock,
  onOpenAlerts,
  onOpenLogicLab,
  onOpenJournal,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [bucket, setBucket] = useState<HomeBucket>("Review Now");
  const [expandedStockIds, setExpandedStockIds] = useState<string[]>([]);
  const [helpTarget, setHelpTarget] = useState<HomeHelpTarget | "">("");

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatAnim, pulseAnim]);

  const riskRisingStocks = useMemo(
    () =>
      stockDirectory.filter((item) =>
        ["Thesis Risk Rising", "Thesis Broken"].includes(
          item.dominantEye?.lastEvaluation?.currentState ?? "",
        ),
      ),
    [stockDirectory],
  );

  const bucketMap = useMemo(
    () => ({
      "Review Now": urgentStocks,
      Forming: opportunityStocks,
      "Risk Rising": riskRisingStocks,
      "Review Soon": staleReviewStocks,
      All: stockDirectory,
    }),
    [opportunityStocks, riskRisingStocks, staleReviewStocks, stockDirectory, urgentStocks],
  );

  const currentBucketItems = bucketMap[bucket];

  const spotlightStocks = useMemo(() => {
    const withPriority = [...stockDirectory].sort((left, right) => {
      const leftEval = left.dominantEye?.lastEvaluation;
      const rightEval = right.dominantEye?.lastEvaluation;
      const leftScore =
        urgencyWeight(leftEval?.actionUrgency) * 0.5 +
        buildLogicLabScorecard(leftEval).total * 0.3 +
        left.openAlerts.length * 8 +
        riskWeight(leftEval) * 0.2;
      const rightScore =
        urgencyWeight(rightEval?.actionUrgency) * 0.5 +
        buildLogicLabScorecard(rightEval).total * 0.3 +
        right.openAlerts.length * 8 +
        riskWeight(rightEval) * 0.2;
      return rightScore - leftScore;
    });
    return withPriority.slice(0, 12);
  }, [stockDirectory]);

  const decisionLoopItems = stockDirectory
    .map((item) => {
      const decision = latestDecision(item);
      const outcome = decision ? outcomes.find((entry) => entry.decisionId === decision.id) : undefined;
      return decision ? { item, decision, outcome } : null;
    })
    .filter(
      (entry): entry is { item: StockDirectoryItem; decision: Decision; outcome: Outcome | undefined } =>
        entry !== null,
    )
    .slice(0, 6);
  const summaryFigures = [
    { key: "urgent", label: language === "ko" ? "즉시 검토" : "Urgent", value: urgentStocks.length, tone: "#ef4444" },
    { key: "risk", label: language === "ko" ? "위험 상승" : "Risk", value: riskRisingStocks.length, tone: "#f59e0b" },
    { key: "stale", label: language === "ko" ? "검토 지연" : "Stale", value: staleReviewStocks.length, tone: "#2563eb" },
    { key: "alerts", label: language === "ko" ? "열린 알림" : "Alerts", value: openAlertsCount, tone: "#7c3aed" },
  ];

  const toggleExpand = (stockId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedStockIds((current) =>
      current.includes(stockId) ? current.filter((id) => id !== stockId) : [...current, stockId],
    );
  };

  const openStock = (item: StockDirectoryItem) => {
    const eyeId = item.dominantEye?.id ?? item.eyes[0]?.id;
    if (!eyeId) return;
    onSelectStock(item.stock.id, eyeId);
  };

  const bucketCounts: Record<HomeBucket, number> = {
    "Review Now": urgentStocks.length,
    Forming: opportunityStocks.length,
    "Risk Rising": riskRisingStocks.length,
    "Review Soon": staleReviewStocks.length,
    All: stockDirectory.length,
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });
  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const renderSectionTitle = (label: string, target: HomeHelpTarget) => (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionEyebrow}>{label}</Text>
      <Pressable onPress={() => setHelpTarget(target)} style={styles.sectionHelpButton}>
        <Text style={styles.sectionHelpButtonText}>?</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Reveal>
        <View style={styles.sectionBlock}>
          {renderSectionTitle(language === "ko" ? "요약" : "Summary", "summary")}
        <View style={styles.summaryStrip}>
          {summaryFigures.map((figure) => (
            <Pressable
              key={figure.key}
              onPress={figure.key === "alerts" ? onOpenAlerts : undefined}
              style={styles.summaryMiniCard}
            >
              <View style={[styles.summaryMiniDot, { backgroundColor: figure.tone }]} />
              <Text style={styles.summaryMiniLabel}>{figure.label}</Text>
              <Text style={styles.summaryMiniValue}>{figure.value}</Text>
            </Pressable>
          ))}
        </View>
        </View>
      </Reveal>

      <Reveal delay={80}>
        <View style={styles.sectionBlock}>
          {renderSectionTitle(language === "ko" ? "시각 트리아지" : "Visual Triage", "visualTriagem")}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>{language === "ko" ? "오늘의 흐름" : "Today pulse"}</Text>
              <Text style={styles.heroTitle}>{language === "ko" ? "긴급도 성운" : "Urgency constellation"}</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable style={styles.heroActionChip} onPress={onOpenAlerts}>
                <Text style={styles.heroActionText}>{language === "ko" ? "알림" : "Alerts"}</Text>
              </Pressable>
              <Pressable style={styles.heroActionChip} onPress={onOpenLogicLab}>
                <Text style={styles.heroActionText}>{language === "ko" ? "로직" : "Logic"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.constellationStage}>
            <Animated.View
              style={[
                styles.constellationHalo,
                { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            />
            {spotlightStocks.map((item, index) => {
              const evaluation = item.dominantEye?.lastEvaluation;
              const angle = (index / Math.max(1, spotlightStocks.length)) * Math.PI * 2;
              const radius = 72 + (index % 4) * 18;
              const left = 150 + Math.cos(angle) * radius;
              const top = 104 + Math.sin(angle) * radius * 0.66;
              const size = 48 + Math.round(buildLogicLabScorecard(evaluation).total / 9);
              const color = stateColor(evaluation?.currentState);
              const hasAlerts = item.openAlerts.length > 0;
              return (
                <Animated.View
                  key={item.stock.id}
                  style={[
                    styles.nodeWrap,
                    {
                      left,
                      top,
                      transform: [{ translateY: floatY }],
                    },
                  ]}
                >
                  {hasAlerts ? (
                    <Animated.View
                      style={[
                        styles.nodeShockwave,
                        {
                          width: size + 18,
                          height: size + 18,
                          borderRadius: (size + 18) / 2,
                          borderColor: color,
                          opacity: pulseOpacity,
                          transform: [{ scale: pulseScale }],
                        },
                      ]}
                    />
                  ) : null}
                  <Pressable
                    onPress={() => toggleExpand(item.stock.id)}
                    style={[
                      styles.nodeCore,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: color,
                      },
                    ]}
                  >
                    <Text style={styles.nodeSymbol}>{item.stock.symbol}</Text>
                    <Text style={styles.nodeMeta}>{item.openAlerts.length || buildLogicLabScorecard(evaluation).blockerCount}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.radarStrip}
          >
            {spotlightStocks.map((item) => {
              const evaluation = item.dominantEye?.lastEvaluation;
              const reviewAge = daysSince(item.dominantEye?.lastReviewedAt);
              return (
                <Pressable
                  key={`radar-${item.stock.id}`}
                  onPress={() => toggleExpand(item.stock.id)}
                  style={[
                    styles.radarChip,
                    expandedStockIds.includes(item.stock.id) ? styles.radarChipActive : null,
                  ]}
                >
                  <View style={[styles.radarChipDot, { backgroundColor: stateColor(evaluation?.currentState) }]} />
                  <Text style={styles.radarChipSymbol}>{item.stock.symbol}</Text>
                  <View style={styles.radarChipMini}>
                    <Text style={styles.radarChipMiniText}>{localizedUrgency(language, evaluation?.actionUrgency)}</Text>
                    <Text style={styles.radarChipMiniText}>{reviewAge}d</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        </View>
      </Reveal>

      <Reveal delay={220}>
        <View style={styles.sectionBlock}>
          {renderSectionTitle(language === "ko" ? "결정 루프" : "Decision Loop", "decisionLoop")}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalVisualRow}>
            {decisionLoopItems.map(({ item, decision, outcome }) => (
              <Pressable
                key={`loop-${decision.id}`}
                onPress={() => onOpenJournal(item.dominantEye?.id ?? decision.eyeId, decision.alertId)}
                style={styles.loopCard}
              >
                <Text style={styles.loopSymbol}>{item.stock.symbol}</Text>
                <View style={styles.loopOrbit}>
                  <View style={styles.loopOrbitRing} />
                  <View style={[styles.loopOrbitNode, styles.loopOrbitNodeTop, styles.loopDotOn]} />
                  <View style={[styles.loopOrbitNode, styles.loopOrbitNodeRight, styles.loopDotOn]} />
                  <View style={[styles.loopOrbitNode, styles.loopOrbitNodeBottom, outcome ? styles.loopDotOn : styles.loopDotOff]} />
                  <View style={[styles.loopOrbitNode, styles.loopOrbitNodeLeft, outcome?.status === "Reviewed" ? styles.loopDotOn : styles.loopDotOff]} />
                  <Text style={styles.loopCenterText}>
                    {outcome?.status === "Reviewed" ? (language === "ko" ? "완료" : "Closed") : language === "ko" ? "진행" : "Live"}
                  </Text>
                </View>
                <View style={styles.loopRow}>
                  {[
                    { key: "signal", on: true },
                    { key: "decision", on: true },
                    { key: "outcome", on: Boolean(outcome) },
                    { key: "learn", on: outcome?.status === "Reviewed" },
                  ].map((step, index) => (
                    <React.Fragment key={`${decision.id}-${step.key}`}>
                      <View style={[styles.loopDot, step.on ? styles.loopDotOn : styles.loopDotOff]} />
                      {index < 3 ? <View style={[styles.loopConnector, step.on ? styles.loopConnectorOn : null]} /> : null}
                    </React.Fragment>
                  ))}
                </View>
                <Text style={styles.loopAction}>{localizedDecisionAction(language, decision.action)}</Text>
                <Text style={styles.loopOutcomeText} numberOfLines={2}>
                  {outcome?.lesson ?? (language === "ko" ? "성과 학습 대기" : "Outcome review pending")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Reveal>

      <View style={styles.sectionBlock}>
        {renderSectionTitle(language === "ko" ? "모니터링 보드" : "Monitoring Board", "monitoringBoard")}
      <View style={styles.bucketRail}>
        {HOME_BUCKETS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setBucket(item)}
            style={[styles.bucketChip, bucket === item ? styles.bucketChipActive : null]}
          >
            <Text style={[styles.bucketCount, bucket === item ? styles.bucketCountActive : null]}>
              {bucketCounts[item]}
            </Text>
            <Text style={[styles.bucketLabel, bucket === item ? styles.bucketLabelActive : null]}>
              {bucketLabel(language, item)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.stockList}>
        {currentBucketItems.map((item, index) => {
          const evaluation = item.dominantEye?.lastEvaluation;
          const scorecard = buildLogicLabScorecard(evaluation);
          const expanded = expandedStockIds.includes(item.stock.id);
          const reviewAge = daysSince(item.dominantEye?.lastReviewedAt);
          const decision = latestDecision(item);
          const heatbars = buildHeatbars(evaluation);
          const timelineIndex = STATE_TIMELINE.indexOf(evaluation?.currentState ?? "Not Relevant");

          return (
            <Reveal key={item.stock.id} delay={260 + index * 24}>
              <Pressable onPress={() => toggleExpand(item.stock.id)} style={styles.stockCard}>
                <View style={styles.stockCardTop}>
                  <View style={styles.stockCardIdentity}>
                    <View style={[styles.stateDot, { backgroundColor: stateColor(evaluation?.currentState) }]} />
                    <View>
                      <Text style={styles.stockSymbol}>{item.stock.symbol}</Text>
                      <Text style={styles.stockName} numberOfLines={1}>
                        {item.stock.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stockHeaderPills}>
                    <View style={styles.compactPill}>
                      <Text style={styles.compactPillText}>{localizedEyeState(language, evaluation?.currentState)}</Text>
                    </View>
                    <View style={styles.compactPill}>
                      <Text style={styles.compactPillText}>{localizedUrgency(language, evaluation?.actionUrgency)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.stockCardBody}>
                  <View style={styles.leftVisualStack}>
                    <MiniSparkline series={item.snapshot?.priceHistorySeries} tone={stateColor(evaluation?.currentState)} />
                    <View style={styles.microStats}>
                      <Text style={styles.microStat}>{scorecard.total}</Text>
                      <Text style={styles.microStat}>{item.openAlerts.length}A</Text>
                      <Text style={styles.microStat}>{localizedFreshness(language, item.snapshot?.freshness ?? "Fresh")}</Text>
                    </View>
                  </View>

                  <View style={styles.rightVisualStack}>
                    <RingGauge
                      value={riskWeight(evaluation)}
                      color={evaluation?.currentState === "Thesis Broken" ? "#ef4444" : "#f59e0b"}
                      label={language === "ko" ? "논리 위험" : "Thesis risk"}
                    />
                    <FreshnessClock days={reviewAge} language={language} />
                  </View>
                </View>

                <View style={styles.stockBottomLine}>
                  <Text style={styles.stockWhyNow} numberOfLines={1}>
                    {latestWhyNow(item, language)}
                  </Text>
                  <View style={styles.alertWaveRow}>
                    {Array.from({ length: Math.max(1, Math.min(3, item.openAlerts.length || 1)) }).map((_, ringIndex) => (
                      <Animated.View
                        key={`${item.stock.id}-ring-${ringIndex}`}
                        style={[
                          styles.alertWave,
                          {
                            backgroundColor: item.openAlerts.length > 0 ? "#ef4444" : "#cbd5e1",
                            opacity: item.openAlerts.length > 0 ? pulseOpacity : 0.22,
                            transform: [
                              {
                                scale:
                                  item.openAlerts.length > 0
                                    ? pulseAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1 + ringIndex * 0.1, 1.16 + ringIndex * 0.1],
                                      })
                                    : 1,
                              },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {expanded ? (
                  <View style={styles.expandedZone}>
                    <View style={styles.timelineRibbon}>
                      {STATE_TIMELINE.map((state, stateIndex) => {
                        const active = stateIndex <= timelineIndex;
                        const current = state === (evaluation?.currentState ?? "Not Relevant");
                        return (
                          <View
                            key={`${item.stock.id}-${state}`}
                            style={[
                              styles.timelineStep,
                              active ? styles.timelineStepActive : null,
                              current ? { backgroundColor: stateColor(state) } : null,
                            ]}
                          />
                        );
                      })}
                    </View>

                    <View style={styles.heatbarList}>
                      {heatbars.map((bar) => (
                        <View key={`${item.stock.id}-${bar.key}`} style={styles.heatbarRow}>
                          <Text style={styles.heatbarLabel}>{localizedHeatbar(language, bar.key)}</Text>
                          <View style={styles.heatbarTrack}>
                            <Animated.View
                              style={[
                                styles.heatbarFill,
                                {
                                  width: `${Math.max(8, bar.value)}%`,
                                  backgroundColor: bar.color,
                                  transform: [{ scaleX: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) }],
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={styles.ladderRow}>
                      {[
                        { key: "discount", on: scorecard.eligibility >= 50 },
                        { key: "evidence", on: scorecard.evidence >= 50 },
                        { key: "timing", on: scorecard.timing >= 50 },
                        { key: "clean", on: scorecard.blockerCount === 0 },
                      ].map((step) => (
                        <View key={`${item.stock.id}-${step.key}`} style={styles.ladderStepWrap}>
                          <View
                            style={[
                              styles.ladderStep,
                              step.on ? styles.ladderStepOn : styles.ladderStepOff,
                            ]}
                          />
                          <Text style={styles.ladderLabel}>
                            {language === "ko"
                              ? step.key === "discount"
                                ? "가격"
                                : step.key === "evidence"
                                  ? "근거"
                                  : step.key === "timing"
                                    ? "타이밍"
                                    : "차단 없음"
                              : step.key}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.expandedInfoGrid}>
                      <View style={styles.expandedInfoCard}>
                        <Text style={styles.expandedInfoTitle}>{language === "ko" ? "다음 트리거" : "Next trigger"}</Text>
                        <Text style={styles.expandedInfoText} numberOfLines={2}>
                          {latestTrigger(item, language)}
                        </Text>
                      </View>
                      <View style={styles.expandedInfoCard}>
                        <Text style={styles.expandedInfoTitle}>{language === "ko" ? "최근 판단" : "Latest decision"}</Text>
                        <Text style={styles.expandedInfoText} numberOfLines={2}>
                          {decision ? localizedDecisionAction(language, decision.action) : language === "ko" ? "없음" : "None"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.quickActionRow}>
                      <Pressable style={styles.quickAction} onPress={() => openStock(item)}>
                        <Text style={styles.quickActionText}>{language === "ko" ? "종목" : "Stock"}</Text>
                      </Pressable>
                      <Pressable style={styles.quickAction} onPress={() => openStock(item)}>
                        <Text style={styles.quickActionText}>{language === "ko" ? "검토" : "Review"}</Text>
                      </Pressable>
                      <Pressable style={styles.quickAction} onPress={onOpenAlerts}>
                        <Text style={styles.quickActionText}>{language === "ko" ? "알림" : "Alerts"}</Text>
                      </Pressable>
                      {item.dominantEye ? (
                        <Pressable
                          style={styles.quickAction}
                          onPress={() => onOpenJournal(item.dominantEye!.id, item.openAlerts[0]?.id)}
                        >
                          <Text style={styles.quickActionText}>{language === "ko" ? "저널" : "Journal"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </Pressable>
            </Reveal>
          );
        })}
      </View>
      </View>

      {helpTarget ? (
        <WindowPanel
          title={homeHelpContent(language, helpTarget).title}
          subtitle={
            language === "ko"
              ? "이 구역이 무엇을 보여주고 어떻게 읽어야 하는지 설명합니다."
              : "This explains what the section shows and how to read it."
          }
          onClose={() => setHelpTarget("")}
        >
          <Card style={styles.helpCard}>
            <Text style={styles.helpBody}>{homeHelpContent(language, helpTarget).body}</Text>
          </Card>
        </WindowPanel>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitleRow: {
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionHelpButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHelpButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 6,
  },
  summaryMiniCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  summaryMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryMiniLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryMiniValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 14,
    gap: 10,
    overflow: "hidden",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
  },
  heroActionChip: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dbe5f0",
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  constellationStage: {
    height: 246,
    borderRadius: 26,
    backgroundColor: "#0f172a",
    overflow: "hidden",
    position: "relative",
  },
  constellationHalo: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 160,
    height: 160,
    marginLeft: -80,
    marginTop: -80,
    borderRadius: 80,
    backgroundColor: "#1d4ed8",
  },
  nodeWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeShockwave: {
    position: "absolute",
    borderWidth: 1.2,
  },
  nodeCore: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  nodeSymbol: {
    fontSize: 11,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  nodeMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)",
  },
  radarStrip: {
    gap: 8,
    paddingRight: 4,
  },
  radarChip: {
    minWidth: 126,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dbe5f0",
    gap: 4,
  },
  radarChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#eff6ff",
  },
  radarChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radarChipSymbol: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  radarChipMini: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  radarChipMiniText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  bucketRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  bucketChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bucketChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  bucketCount: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },
  bucketCountActive: {
    color: "#ffffff",
  },
  bucketLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
  },
  bucketLabelActive: {
    color: "#ffffff",
  },
  changeFeed: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  changeCard: {
    width: "48.5%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  changeAccent: {
    width: 24,
    height: 4,
    borderRadius: 999,
  },
  changeTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  changeSymbol: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  changeValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  compareLane: {
    gap: 10,
  },
  compareHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  compareTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  compareSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  compareScroll: {
    gap: 8,
    paddingRight: 4,
  },
  horizontalVisualRow: {
    gap: 8,
    paddingRight: 4,
  },
  stateRiverCard: {
    width: 188,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 8,
  },
  stateRiverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  stateRiverSymbol: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0f172a",
  },
  stateRiverMeta: {
    flex: 1,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  stateRiverTrack: {
    flexDirection: "row",
    gap: 3,
    height: 18,
    alignItems: "stretch",
  },
  stateRiverSegment: {
    borderRadius: 999,
  },
  stateRiverUndercurrent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 26,
  },
  stateRiverUndercurrentBar: {
    flex: 1,
    borderRadius: 999,
  },
  triggerCard: {
    width: 132,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 8,
    alignItems: "center",
  },
  triggerSymbol: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0f172a",
  },
  triggerDial: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerDialTrack: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderColor: "#e2e8f0",
  },
  triggerDialTrackInner: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#dbe5f0",
  },
  triggerDialFill: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  triggerDialNeedleWrap: {
    position: "absolute",
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerDialNeedle: {
    width: 3,
    height: 26,
    borderRadius: 999,
    position: "absolute",
    top: 10,
  },
  triggerDialValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  triggerTickRow: {
    width: "100%",
    gap: 4,
  },
  triggerTickTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
    overflow: "hidden",
  },
  triggerTickFill: {
    height: "100%",
    borderRadius: 999,
  },
  triggerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
  },
  weatherBoard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 8,
    minHeight: 190,
  },
  weatherMap: {
    height: 140,
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    overflow: "hidden",
    position: "relative",
  },
  weatherBubbleWrap: {
    position: "absolute",
  },
  weatherBubble: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  weatherBubbleSymbol: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0f172a",
  },
  weatherBubbleValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
  },
  weatherLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  weatherLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  weatherLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weatherLegendText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  loopCard: {
    width: 160,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 10,
  },
  loopSymbol: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0f172a",
  },
  loopOrbit: {
    width: 88,
    height: 88,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  loopOrbitRing: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "#dbe5f0",
  },
  loopOrbitNode: {
    position: "absolute",
  },
  loopOrbitNodeTop: {
    top: 4,
    left: 38,
  },
  loopOrbitNodeRight: {
    top: 38,
    right: 4,
  },
  loopOrbitNodeBottom: {
    bottom: 4,
    left: 38,
  },
  loopOrbitNodeLeft: {
    top: 38,
    left: 4,
  },
  loopCenterText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0f172a",
  },
  loopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  loopDotOn: {
    backgroundColor: "#0f172a",
  },
  loopDotOff: {
    backgroundColor: "#cbd5e1",
  },
  loopConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#e2e8f0",
  },
  loopConnectorOn: {
    backgroundColor: "#0f172a",
  },
  loopAction: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  loopOutcomeText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: "#64748b",
  },
  vectorBoard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 8,
  },
  vectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  vectorSymbol: {
    width: 46,
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },
  vectorCells: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  vectorCell: {
    width: 42,
    alignItems: "center",
  },
  vectorMiniTrack: {
    width: 30,
    height: 18,
    justifyContent: "center",
  },
  vectorMiniSlope: {
    width: 22,
    height: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
    alignSelf: "center",
  },
  vectorMiniSlopeUp: {
    transform: [{ rotate: "-25deg" }],
  },
  vectorMiniSlopeFlat: {
    transform: [{ rotate: "0deg" }],
  },
  emptySectionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  helpCard: {
    gap: 10,
  },
  helpBody: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  compareCard: {
    width: 132,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 10,
    gap: 8,
  },
  compareTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compareSymbol: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  compareStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compareStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareStatText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  stockList: {
    gap: 8,
  },
  stockCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe5f0",
    padding: 12,
    gap: 10,
  },
  stockCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  stockCardIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stockSymbol: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  stockName: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  stockHeaderPills: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 1,
  },
  compactPill: {
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  compactPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
  },
  stockCardBody: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  leftVisualStack: {
    flex: 1,
    gap: 10,
  },
  rightVisualStack: {
    width: 132,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  sparklineRow: {
    height: 42,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 999,
  },
  microStats: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  microStat: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  ringGaugeWrap: {
    alignItems: "center",
    gap: 5,
  },
  ringGauge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ringGaugeFill: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 5,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  ringGaugeValue: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },
  ringGaugeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  freshnessClock: {
    alignItems: "center",
    gap: 5,
  },
  freshnessClockRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  freshnessClockValue: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },
  freshnessClockLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  stockBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stockWhyNow: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  alertWaveRow: {
    width: 34,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  alertWave: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expandedZone: {
    gap: 12,
    paddingTop: 6,
  },
  timelineRibbon: {
    flexDirection: "row",
    gap: 4,
  },
  timelineStep: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  timelineStepActive: {
    backgroundColor: "#cbd5e1",
  },
  heatbarList: {
    gap: 8,
  },
  heatbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heatbarLabel: {
    width: 52,
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  heatbarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#eff3f8",
    overflow: "hidden",
  },
  heatbarFill: {
    height: "100%",
    borderRadius: 999,
  },
  ladderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  ladderStepWrap: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  ladderStep: {
    width: "100%",
    height: 10,
    borderRadius: 999,
  },
  ladderStepOn: {
    backgroundColor: "#0f172a",
  },
  ladderStepOff: {
    backgroundColor: "#e2e8f0",
  },
  ladderLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  expandedInfoGrid: {
    flexDirection: "row",
    gap: 8,
  },
  expandedInfoCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    gap: 6,
  },
  expandedInfoTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
  },
  expandedInfoText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
  },
});

export { HomeVisualDashboard };
