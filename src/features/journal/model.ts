import type { AppLanguage } from "../../lib/preferences";
import {
  formatLocaleDateTime,
  localizedDecisionAction,
  localizedEyeState,
  localizedOutcomeStatus,
  localizedThesisValidity,
  localizedTiming,
  t,
} from "../../lib/i18n";
import type { Decision, Eye, Outcome, Recipe, Stock } from "../../types";
import type { JournalEntryView } from "./JournalScreen";

export const buildJournalEntries = ({
  language,
  decisions,
  eyes,
  outcomes,
  stocks,
  recipes,
  instrumentLabel,
}: {
  language: AppLanguage;
  decisions: readonly Decision[];
  eyes: readonly Eye[];
  outcomes: readonly Outcome[];
  stocks: readonly Stock[];
  recipes: readonly Recipe[];
  instrumentLabel: (eyeId: string) => string;
}): JournalEntryView[] => decisions.map((decision) => {
  const eye = eyes.find((item) => item.id === decision.eyeId);
  const linkedOutcome = outcomes.find((outcome) => outcome.decisionId === decision.id);
  const stock = eye ? stocks.find((item) => item.id === eye.stockId) : undefined;
  const recipe = recipes.find((item) => item.id === (decision.recipeId ?? eye?.recipeId));
  return {
    id: decision.id,
    date: formatLocaleDateTime(language, decision.createdAt),
    decision: localizedDecisionAction(language, decision.action),
    instrument: instrumentLabel(decision.eyeId),
    context: [
      stock ? `${stock.symbol} · ${stock.name}` : "",
      recipe ? `${recipe.name} · v${decision.recipeVersion ?? recipe.version}` : "",
      eye?.lastEvaluation ? localizedEyeState(language, eye.lastEvaluation.currentState) : "",
    ].filter(Boolean).join(" · "),
    note: decision.note,
    state: decision.stateAtDecision ? localizedEyeState(language, decision.stateAtDecision) : t(language, "journal.meta.noState"),
    dataQuality: decision.dataQuality ?? t(language, "journal.meta.noData"),
    thesis: localizedThesisValidity(language, decision.thesisValid),
    timing: localizedTiming(language, decision.timing),
    concern: decision.concern,
    outcome: linkedOutcome ? {
      status: localizedOutcomeStatus(language, linkedOutcome.status ?? "Pending"),
      lesson: linkedOutcome.lesson || (language === "ko" ? "학습 메모가 아직 없습니다." : "No learning note has been recorded."),
      suggestion: linkedOutcome.recipeSuggestion,
    } : undefined,
    stockId: stock?.id,
    eyeId: eye?.id,
    alertId: decision.alertId,
  };
});
