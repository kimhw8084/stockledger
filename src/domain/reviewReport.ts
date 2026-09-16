import type { AppData } from "../types";
export function reviewReport(data: AppData, now = new Date()): string {
  const end = now.getTime(), start = end - 7 * 86_400_000;
  const inWindow = (value: string) => Date.parse(value) >= start && Date.parse(value) <= end;
  const decisions = data.decisions.filter(row => !row.archivedAt && inWindow(row.createdAt));
  const activeEyes = data.eyes.filter(eye => !eye.archivedAt && !data.stocks.find(stock => stock.id === eye.stockId)?.archivedAt);
  const stockFor = (eyeId: string) => { const eye = data.eyes.find(row => row.id === eyeId); return data.stocks.find(stock => stock.id === eye?.stockId)?.symbol ?? "Unknown stock"; };
  const line = (value: string) => value.replace(/\r?\n/g, " ");
  const alerts = data.alerts.filter(alert => !alert.reviewed && activeEyes.some(eye => eye.id === alert.eyeId) && (!alert.snoozedUntil || Date.parse(alert.snoozedUntil) <= end));
  const pending = data.outcomes.filter(outcome => outcome.status !== "Reviewed" && data.decisions.some(decision => decision.id === outcome.decisionId && !decision.archivedAt));
  return [
    "# StockLedger weekly review", "", `Generated ${now.toISOString()}. Window: ${new Date(start).toISOString().slice(0,10)} through ${now.toISOString().slice(0,10)}.`, "",
    `${data.stocks.filter(stock => !stock.archivedAt).length} watched stocks; ${activeEyes.length} active monitors; ${decisions.length} decisions in this window.`,
    data.snapshots.some(snapshot => snapshot.isMock) ? "Sample data is present. This report includes demonstration content." : "Personal observations and decisions; no return or time-saving claims are inferred.", "",
    "## Next reviews", "", ...(alerts.length ? alerts.map(alert => `- ${stockFor(alert.eyeId)} · ${alert.priority} · ${line(alert.whyNow)} (${alert.createdAt})`) : ["No unsnoozed, unreviewed alerts."]), "",
    "## Decisions this week", "", ...(decisions.length ? decisions.map(decision => `- ${stockFor(decision.eyeId)} · ${decision.action} · ${line(decision.note)} — ${decision.createdAt}; evidence: ${decision.dataQuality ?? "unavailable"}.`) : ["No decisions recorded in this window."]), "",
    "## Outcomes awaiting review", "", ...(pending.length ? pending.map(outcome => `- ${stockFor(data.decisions.find(decision => decision.id === outcome.decisionId)!.eyeId)} · ${line(outcome.reviewWindow)} · recorded ${outcome.createdAt}.`) : ["No pending outcomes."]), "",
    "## Lessons", "", ...data.outcomes.filter(outcome => outcome.status === "Reviewed").slice(0,20).map(outcome => `- ${line(outcome.lesson)} Next step: ${line(outcome.recipeSuggestion)}`), "",
    "## Data coverage", "", ...data.stocks.filter(stock => !stock.archivedAt).map(stock => { const snapshot = data.snapshots.find(row => row.stockId === stock.id); return `- ${stock.symbol}: ${snapshot?.freshness ?? "Unavailable"}; observed ${snapshot?.provenance?.observedDate ?? "not verified"}; source ${line(snapshot?.sourceName ?? "none")}.`; }), "",
    "Prices require a verified source and adjustment basis. Review notes describe observations, not realized portfolio returns. Unavailable inputs must be resolved before interpreting a monitor.", "",
  ].join("\n");
}
