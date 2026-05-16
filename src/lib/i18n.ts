import { FreshnessStatus, ProviderHealthEntry, VisualEvidenceCard } from "../types";
import { AppLanguage } from "./preferences";

type DictValue = string | ((vars?: Record<string, string | number>) => string);

const dict: Record<AppLanguage, Record<string, DictValue>> = {
  en: {
    "nav.Home": "Home",
    "nav.Stocks": "Stocks",
    "nav.Recipes": "Recipes",
    "nav.Eyes": "Eyes",
    "nav.Alerts": "Alerts",
    "nav.Journal": "Journal",
    "nav.Settings": "Settings",

    "subtitle.Home": "Stock-grouped triage.",
    "subtitle.Stocks": "Search, select, inspect.",
    "subtitle.Recipes": "Recipe inventory first.",
    "subtitle.Eyes": "Recipe subscriptions.",
    "subtitle.Alerts": "What changed and why now.",
    "subtitle.Journal": "Decision history first.",
    "subtitle.Settings": "Provider health and controls.",

    "common.done": "Done",
    "common.close": "Close",
    "common.clear": "Clear",
    "common.new": "New",
    "common.add": "Add",
    "common.remove": "Remove",
    "common.reset": "Reset",
    "common.source": "Source",
    "common.freshness": "Freshness",
    "common.current": "Current",
    "common.threshold": "Threshold",
    "common.previous": "Previous",
    "common.prev": "Prev",
    "common.next": "Next",
    "common.pin": "Pin",
    "common.unpin": "Unpin",
    "common.range": "Range",
    "common.metrics": "metrics",
    "common.eyes": "eyes",
    "common.pinned": "pinned",
    "common.show": "Show",
    "common.hide": "Hide",
    "common.open": "Open",
    "common.expand": "Expand",
    "common.collapse": "Collapse",
    "common.review": "Review",
    "common.alerts": "Alerts",
    "common.journal": "Journal",
    "common.stock": "Stock",
    "common.detail": "Detail",
    "common.loading": "Loading StockLedger...",

    "settings.language.title": "Language",
    "settings.language.note": "Choose the app language.",
    "settings.language.english": "English",
    "settings.language.korean": "한국어",
    "settings.providers.title": "Data providers",
    "settings.providers.note":
      "The app is staying dummy-backed for daily use right now. These providers are configured and health-checked here, but they are parked until you explicitly switch real data back on.",
    "settings.providers.check": "Check API Health",
    "settings.providers.checking": "Checking...",
    "settings.providers.refresh": "Refresh Snapshots",
    "settings.providers.summaryHealthy": "Healthy",
    "settings.providers.summaryLimited": "Limited",
    "settings.providers.summaryUnconfigured": "Missing",
    "settings.providers.summaryTrackedStocks": "Tracked Stocks",
    "settings.providers.configured": "Configured",
    "settings.providers.missingKey": "Missing key",
    "settings.providers.modeBackground": "Background",
    "settings.providers.modeOnDemand": "On Demand",
    "settings.providers.modeDisabled": "Disabled",

    "stocks.search.placeholder": "Search ticker or company",
    "stocks.search.suggestions": "Suggestions",
    "stocks.search.recent": "Recent search",
    "stocks.search.clearRecent": "Clear recent",
    "stocks.search.assist": "Press return to open the top match immediately.",
    "stocks.search.topMatch": "Top match",
    "stocks.search.exact": "Exact",
    "stocks.search.recentBadge": "Recent",
    "stocks.search.noMatchTitle": "No matching stocks",
    "stocks.search.noRecentTitle": "No recent searches",
    "stocks.search.noMatchBody": "Try another ticker or company name, or clear the search to return to recent stocks.",
    "stocks.search.noRecentBody": "Search a stock to open its visual analysis board.",
    "stocks.search.clearSearch": "Clear Search",
    "stocks.search.resultCount": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} shown`,
    "stocks.search.resultNone": "None",

    "stocks.data.dummyBacked": "Dummy-backed",
    "stocks.data.providerBacked": "Provider-backed",
    "stocks.data.dummy": "Dummy",
    "stocks.data.provider": "Provider",
    "stocks.data.manual": "Manual",
    "stocks.data.noData": "No Data",

    "stocks.hero.vs": ({ benchmark }: Record<string, string | number> = {}) => `Vs ${benchmark ?? "benchmark"}`,
    "stocks.hero.drawdown": ({ value }: Record<string, string | number> = {}) => `Drawdown ${value ?? "N/A"}`,
    "stocks.hero.boardControls": "Board controls",
    "stocks.hero.showing": ({ shown, total }: Record<string, string | number> = {}) =>
      `Showing ${shown ?? 0} of ${total ?? 0} metrics`,
    "stocks.hero.lookback": "Lookback",
    "stocks.hero.benchmark": "Benchmark",
    "stocks.hero.status": "Status",
    "stocks.hero.board": "Board",
    "stocks.hero.clear": "Clear",
    "stocks.hero.noStockTitle": "No stock selected",
    "stocks.hero.noStockBody": "Search a ticker or company name, choose a suggestion, and the visual analysis board will open here.",
    "stocks.hero.noParameters": "No parameters match the current filters.",

    "stocks.detail.whatStandsOut": "What stands out now",
    "stocks.detail.effect": "Effect",
    "stocks.detail.whyItMatters": "Why it matters",
    "stocks.detail.recipeLink": ({ label }: Record<string, string | number> = {}) => `Recipe: ${label ?? ""}`,
    "stocks.detail.browseMore": "Browse more metrics",
    "stocks.detail.showFormula": "Show formula detail",
    "stocks.detail.hideFormula": "Hide formula detail",
    "stocks.detail.formulaFallback": "How this metric is calculated",
    "stocks.detail.formulaDetail": "Formula detail",
    "stocks.detail.formulaMissing": "No extra formula detail available.",
    "stocks.detail.inputs": ({ inputs }: Record<string, string | number> = {}) => `Inputs: ${inputs ?? "No explicit inputs recorded"}`,
    "stocks.detail.context": "Context",
    "stocks.detail.plannedZone": "Planned zone",
    "stocks.detail.latest": "Latest",
    "stocks.detail.lowerRisk": "Lower risk",
    "stocks.detail.higherRisk": "Higher risk",
    "stocks.detail.threshold": "Threshold",
    "stocks.detail.series": "Series",
    "stocks.detail.days": "days",
    "stocks.detail.tapChart": "Tap the chart bars to inspect earlier points without leaving the stock metric sheet.",
    "stocks.evidence.pinned": "Pinned",
    "stocks.evidence.current": "Current",
    "stocks.evidence.threshold": "Threshold",
    "stocks.evidence.contextOnly": "Context only",
    "stocks.evidence.recipeLink": ({ label }: Record<string, string | number> = {}) => `Recipe link: ${label ?? ""}`,
    "stocks.evidence.effect": ({ label }: Record<string, string | number> = {}) => `Effect: ${label ?? ""}`,
    "stocks.evidence.why": ({ label }: Record<string, string | number> = {}) => `Why it matters: ${label ?? ""}`,
    "stocks.evidence.showDetails": "Show formula details",
    "stocks.evidence.hideDetails": "Hide details",
    "stocks.evidence.formulaDetail": "Formula detail",
    "stocks.evidence.formulaMissing": "No extra formula detail available.",
    "stocks.evidence.inputs": ({ inputs }: Record<string, string | number> = {}) => `Inputs: ${inputs ?? "No explicit inputs recorded"}`,
  },
  ko: {
    "nav.Home": "홈",
    "nav.Stocks": "종목",
    "nav.Recipes": "레시피",
    "nav.Eyes": "모니터",
    "nav.Alerts": "알림",
    "nav.Journal": "기록",
    "nav.Settings": "설정",

    "subtitle.Home": "종목별로 묶인 핵심 현황.",
    "subtitle.Stocks": "검색하고, 선택하고, 바로 확인하세요.",
    "subtitle.Recipes": "레시피 목록부터 보여줍니다.",
    "subtitle.Eyes": "레시피 구독 현황.",
    "subtitle.Alerts": "무엇이 바뀌었는지 바로 확인.",
    "subtitle.Journal": "결정 기록을 먼저 보여줍니다.",
    "subtitle.Settings": "데이터 상태와 앱 설정.",

    "common.done": "닫기",
    "common.close": "닫기",
    "common.clear": "지우기",
    "common.new": "새로",
    "common.add": "추가",
    "common.remove": "삭제",
    "common.reset": "초기화",
    "common.source": "출처",
    "common.freshness": "최신성",
    "common.current": "현재값",
    "common.threshold": "기준값",
    "common.previous": "이전",
    "common.prev": "이전",
    "common.next": "다음",
    "common.pin": "고정",
    "common.unpin": "고정 해제",
    "common.range": "범위",
    "common.metrics": "지표",
    "common.eyes": "모니터",
    "common.pinned": "고정",
    "common.show": "보기",
    "common.hide": "숨기기",
    "common.open": "열기",
    "common.expand": "펼치기",
    "common.collapse": "접기",
    "common.review": "검토",
    "common.alerts": "알림",
    "common.journal": "기록",
    "common.stock": "종목",
    "common.detail": "상세",
    "common.loading": "StockLedger 불러오는 중...",

    "settings.language.title": "언어",
    "settings.language.note": "앱에서 사용할 언어를 선택하세요.",
    "settings.language.english": "English",
    "settings.language.korean": "한국어",
    "settings.providers.title": "데이터 제공 상태",
    "settings.providers.note":
      "현재 앱은 일상 사용 기준으로 더미 데이터 모드로 동작합니다. 아래 제공자는 설정과 상태 확인만 해두었고, 실데이터 모드는 나중에 직접 켜기 전까지 사용하지 않습니다.",
    "settings.providers.check": "API 상태 확인",
    "settings.providers.checking": "확인 중...",
    "settings.providers.refresh": "스냅샷 새로고침",
    "settings.providers.summaryHealthy": "정상",
    "settings.providers.summaryLimited": "제한",
    "settings.providers.summaryUnconfigured": "미설정",
    "settings.providers.summaryTrackedStocks": "추적 종목",
    "settings.providers.configured": "설정됨",
    "settings.providers.missingKey": "키 없음",
    "settings.providers.modeBackground": "백그라운드",
    "settings.providers.modeOnDemand": "필요 시",
    "settings.providers.modeDisabled": "사용 안 함",

    "stocks.search.placeholder": "티커 또는 회사명 검색",
    "stocks.search.suggestions": "추천 결과",
    "stocks.search.recent": "최근 검색",
    "stocks.search.clearRecent": "최근 기록 지우기",
    "stocks.search.assist": "엔터를 누르면 최상단 종목이 바로 열립니다.",
    "stocks.search.topMatch": "최상단",
    "stocks.search.exact": "정확히 일치",
    "stocks.search.recentBadge": "최근",
    "stocks.search.noMatchTitle": "일치하는 종목이 없어요",
    "stocks.search.noRecentTitle": "최근 검색한 종목이 없어요",
    "stocks.search.noMatchBody": "다른 티커나 회사명을 입력하거나 검색어를 지워 최근 검색 목록으로 돌아가세요.",
    "stocks.search.noRecentBody": "종목을 검색하면 시각 분석 보드가 여기에 열립니다.",
    "stocks.search.clearSearch": "검색 지우기",
    "stocks.search.resultCount": ({ count }: Record<string, string | number> = {}) => `${count ?? 0}개 표시`,
    "stocks.search.resultNone": "없음",

    "stocks.data.dummyBacked": "더미 데이터",
    "stocks.data.providerBacked": "실데이터 연동",
    "stocks.data.dummy": "더미",
    "stocks.data.provider": "실데이터",
    "stocks.data.manual": "수동 입력",
    "stocks.data.noData": "데이터 없음",

    "stocks.hero.vs": ({ benchmark }: Record<string, string | number> = {}) => `${benchmark ?? "벤치마크"} 대비`,
    "stocks.hero.drawdown": ({ value }: Record<string, string | number> = {}) => `고점 대비 ${value ?? "N/A"}`,
    "stocks.hero.boardControls": "보드 설정",
    "stocks.hero.showing": ({ shown, total }: Record<string, string | number> = {}) =>
      `${total ?? 0}개 중 ${shown ?? 0}개 표시`,
    "stocks.hero.lookback": "기간",
    "stocks.hero.benchmark": "비교 기준",
    "stocks.hero.status": "상태",
    "stocks.hero.board": "정렬",
    "stocks.hero.clear": "해제",
    "stocks.hero.noStockTitle": "선택된 종목이 없어요",
    "stocks.hero.noStockBody": "티커나 회사명을 검색해 선택하면 시각 분석 보드가 여기에 열립니다.",
    "stocks.hero.noParameters": "현재 필터에 맞는 지표가 없습니다.",

    "stocks.detail.whatStandsOut": "지금 눈에 띄는 점",
    "stocks.detail.effect": "영향",
    "stocks.detail.whyItMatters": "왜 중요한가",
    "stocks.detail.recipeLink": ({ label }: Record<string, string | number> = {}) => `연결 레시피: ${label ?? ""}`,
    "stocks.detail.browseMore": "다른 지표 보기",
    "stocks.detail.showFormula": "계산 방식 보기",
    "stocks.detail.hideFormula": "계산 방식 숨기기",
    "stocks.detail.formulaFallback": "이 지표가 계산되는 방식",
    "stocks.detail.formulaDetail": "계산 방식",
    "stocks.detail.formulaMissing": "추가 계산 설명이 아직 없습니다.",
    "stocks.detail.inputs": ({ inputs }: Record<string, string | number> = {}) => `입력값: ${inputs ?? "기록된 입력값 없음"}`,
    "stocks.detail.context": "맥락",
    "stocks.detail.plannedZone": "계획 구간",
    "stocks.detail.latest": "최신",
    "stocks.detail.lowerRisk": "낮은 위험",
    "stocks.detail.higherRisk": "높은 위험",
    "stocks.detail.threshold": "기준선",
    "stocks.detail.series": "흐름",
    "stocks.detail.days": "일",
    "stocks.detail.tapChart": "막대를 눌러 과거 시점을 바로 확인할 수 있습니다.",
    "stocks.evidence.pinned": "고정",
    "stocks.evidence.current": "현재값",
    "stocks.evidence.threshold": "기준값",
    "stocks.evidence.contextOnly": "참고용",
    "stocks.evidence.recipeLink": ({ label }: Record<string, string | number> = {}) => `연결 레시피: ${label ?? ""}`,
    "stocks.evidence.effect": ({ label }: Record<string, string | number> = {}) => `영향: ${label ?? ""}`,
    "stocks.evidence.why": ({ label }: Record<string, string | number> = {}) => `왜 중요한가: ${label ?? ""}`,
    "stocks.evidence.showDetails": "계산 방식 보기",
    "stocks.evidence.hideDetails": "세부 내용 숨기기",
    "stocks.evidence.formulaDetail": "계산 방식",
    "stocks.evidence.formulaMissing": "추가 계산 설명이 아직 없습니다.",
    "stocks.evidence.inputs": ({ inputs }: Record<string, string | number> = {}) => `입력값: ${inputs ?? "기록된 입력값 없음"}`,
  },
};

export const t = (
  language: AppLanguage,
  key: string,
  vars?: Record<string, string | number>,
) => {
  const entry = dict[language][key] ?? dict.en[key] ?? key;
  return typeof entry === "function" ? entry(vars) : entry;
};

export const tabLabel = (language: AppLanguage, tab: string) => t(language, `nav.${tab}`);
export const subtitleLabel = (language: AppLanguage, tab: string) => t(language, `subtitle.${tab}`);

export const localizedFreshness = (language: AppLanguage, freshness: FreshnessStatus) => {
  switch (freshness) {
    case "Fresh":
      return language === "ko" ? "최신" : "Fresh";
    case "Delayed":
      return language === "ko" ? "지연" : "Delayed";
    case "Stale":
      return language === "ko" ? "오래됨" : "Stale";
    case "Partial":
      return language === "ko" ? "일부만" : "Partial";
    case "Unavailable":
      return language === "ko" ? "없음" : "Unavailable";
    default:
      return language === "ko" ? "더미" : "Mock Data";
  }
};

export const localizedSourceType = (
  language: AppLanguage,
  sourceType: VisualEvidenceCard["sourceType"],
) => {
  if (sourceType === "Mock Adapter") return t(language, "stocks.data.dummy");
  if (sourceType === "Provider Adapter") return t(language, "stocks.data.provider");
  return t(language, "stocks.data.manual");
};

export const localizedSnapshotMode = (language: AppLanguage, isMock?: boolean | null) =>
  isMock ? t(language, "stocks.data.dummyBacked") : t(language, "stocks.data.providerBacked");

export const localizedSuggestionTrust = (
  language: AppLanguage,
  snapshot?: { isMock: boolean; freshness: FreshnessStatus } | null,
) => {
  if (!snapshot) return t(language, "stocks.data.noData");
  return snapshot.isMock ? t(language, "stocks.data.dummyBacked") : localizedFreshness(language, snapshot.freshness);
};

export const localizedStatus = (
  language: AppLanguage,
  status: VisualEvidenceCard["status"],
) => {
  const koMap: Record<VisualEvidenceCard["status"], string> = {
    Passed: "충족",
    Failed: "미충족",
    Warning: "경고",
    Blocked: "차단",
    "Near Trigger": "근접",
    Partial: "일부만",
    Unavailable: "없음",
    Stale: "오래됨",
    Mock: "더미",
  };
  return language === "ko" ? koMap[status] : status;
};

export const localizedProviderStatus = (language: AppLanguage, status: ProviderHealthEntry["status"]) => {
  if (language === "en") return status;
  switch (status) {
    case "Healthy":
      return "정상";
    case "Plan Limited":
      return "요금제 제한";
    case "Unconfigured":
      return "미설정";
    case "Error":
      return "오류";
    default:
      return status;
  }
};
