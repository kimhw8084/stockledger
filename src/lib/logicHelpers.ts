import { AppLanguage } from "./preferences";
import { 
  Evaluation, 
  RecipeCondition, 
  MockSnapshot, 
  FreshnessStatus 
} from "../types";
import { localizedFreshness } from "./i18n";

export const buildLogicLabScorecard = (evaluation?: Evaluation) => {
  if (!evaluation) {
    return {
      total: 0,
      eligibility: 0,
      evidence: 0,
      timing: 0,
      review: 0,
      dataQuality: 0,
      riskPenalty: 0,
      blockerCount: 0,
    };
  }

  const percentFromResults = (results: any[]) => {
    if (results.length === 0) return 0;
    return Math.round((results.filter((r) => r.passed).length / results.length) * 100);
  };

  const conditionResults = evaluation.conditionResults ?? [];
  const eligibilityResults = conditionResults.filter((result) => result.role === "Eligibility Filter");
  const evidenceResults = conditionResults.filter((result) => result.role === "Supporting Evidence");
  const timingResults = conditionResults.filter(
    (result) => result.role === "Timing Trigger" || result.role === "Review Trigger",
  );
  const blockerResults = conditionResults.filter(
    (result) => result.role === "Hard Disqualifier" && !result.passed,
  );
  const riskPenalty =
    conditionResults.filter((result) => result.role === "Risk Warning" && !result.passed).length * 12;
  const dataIssues = evaluation.missingData.length + evaluation.staleData.length;
  const dataQuality = Math.max(0, 100 - dataIssues * 15);
  const eligibility = percentFromResults(eligibilityResults);
  const evidence = percentFromResults(evidenceResults);
  const timing = percentFromResults(timingResults);
  const review = evaluation.alertSuggested ? 100 : timingResults.length > 0 ? timing : 60;
  const blockerCount = blockerResults.length;
  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        eligibility * 0.25 +
          evidence * 0.3 +
          timing * 0.2 +
          review * 0.1 +
          dataQuality * 0.15 -
          riskPenalty -
          blockerCount * 20,
      ),
    ),
  );

  return {
    total,
    eligibility,
    evidence,
    timing,
    review,
    dataQuality,
    riskPenalty,
    blockerCount,
  };
};

export const logicRoleWeight = (role?: RecipeCondition["role"]) => {
  switch (role) {
    case "Eligibility Filter":
      return "0.90";
    case "Supporting Evidence":
      return "0.75";
    case "Timing Trigger":
      return "0.80";
    case "Risk Warning":
      return "0.60 penalty";
    case "Hard Disqualifier":
      return "Override";
    case "Review Trigger":
      return "0.40";
    case "Outcome Learning Tag":
      return "Trace";
    default:
      return "--";
  }
};

export const logicRoleStateEffect = (language: AppLanguage, role?: RecipeCondition["role"]) => {
  switch (role) {
    case "Eligibility Filter":
      return language === "ko" ? "기본 적격 여부를 결정합니다." : "Sets baseline eligibility.";
    case "Supporting Evidence":
      return language === "ko" ? "관심 구간과 기회 점수를 끌어올립니다." : "Lifts opportunity evidence and state.";
    case "Timing Trigger":
      return language === "ko" ? "검토 타이밍을 앞당깁니다." : "Pulls the state toward timing review.";
    case "Risk Warning":
      return language === "ko" ? "위험 점수를 높이고 경고 상태를 만듭니다." : "Adds penalty and risk pressure.";
    case "Hard Disqualifier":
      return language === "ko" ? "논리 위험 상승 또는 논리 훼손으로 강제 이동할 수 있습니다." : "Can override the score and force thesis risk/broken.";
    case "Review Trigger":
      return language === "ko" ? "즉시 검토나 재검토를 유도합니다." : "Prompts explicit review behavior.";
    case "Outcome Learning Tag":
      return language === "ko" ? "후속 성과 학습에 태그로 남습니다." : "Tags the setup for later learning.";
    default:
      return language === "ko" ? "기본 논리 설명 없음." : "No explicit state effect.";
  }
};

export const logicRoleAlertEffect = (language: AppLanguage, role?: RecipeCondition["role"]) => {
  switch (role) {
    case "Eligibility Filter":
      return language === "ko" ? "단독 알림보다는 진입 자격 확인에 가깝습니다." : "Mostly gates eligibility rather than alerting.";
    case "Supporting Evidence":
      return language === "ko" ? "다른 조건과 함께 알림 문구를 강화합니다." : "Strengthens alert wording when combined with others.";
    case "Timing Trigger":
      return language === "ko" ? "즉시 확인 알림을 유도할 수 있습니다." : "Can trigger review-now style alerts.";
    case "Risk Warning":
      return language === "ko" ? "위험 감지 시 즉시 경고 알림을 보냅니다." : "Triggers risk-alert logic when failed.";
    case "Hard Disqualifier":
      return language === "ko" ? "조건 실패 시 즉시 논리 훼손 알림을 보냅니다." : "Triggers thesis-broken alert when failed.";
    case "Review Trigger":
      return language === "ko" ? "검토 필요 시 알림 리스트에 올립니다." : "Adds to review queue when triggered.";
    default:
      return language === "ko" ? "알림 효과 정의 없음." : "No explicit alert effect.";
  }
};

export const logicDataQualityLabel = (
  language: AppLanguage,
  evaluation: Evaluation,
  snapshot?: MockSnapshot,
) => {
  const issues = evaluation.missingData.length + evaluation.staleData.length;
  if (issues === 0) return language === "ko" ? "정상" : "Ready";
  if (issues < 2) return language === "ko" ? "부분 확인 필요" : "Partial";
  return language === "ko" ? `검토 필요 (${issues}건)` : `Review (${issues})`;
};

export const logicThesisRiskLabel = (language: AppLanguage, evaluation: Evaluation) => {
  const penalty = (evaluation.conditionResults ?? []).filter(
    (r) => r.role === "Risk Warning" && !r.passed,
  ).length;
  const blockers = (evaluation.conditionResults ?? []).filter(
    (r) => r.role === "Hard Disqualifier" && !r.passed,
  ).length;

  if (blockers > 0) return language === "ko" ? "논리 훼손 (차단됨)" : "Thesis Broken (Blocked)";
  if (penalty > 1) return language === "ko" ? "위험 높음" : "High Risk";
  if (penalty > 0) return language === "ko" ? "주의 요망" : "Elevated Risk";
  return language === "ko" ? "정상" : "Stable";
};

export const logicActionUrgencyLabel = (language: AppLanguage, urgency: string) => {
  switch (urgency) {
    case "Actively Review":
      return language === "ko" ? "적극 검토" : "Active Review";
    case "Review Soon":
      return language === "ko" ? "곧 검토" : "Review Soon";
    default:
      return language === "ko" ? "대기/관찰" : "Wait/Observe";
  }
};
