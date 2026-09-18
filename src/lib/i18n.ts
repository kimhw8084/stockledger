import { FreshnessStatus, ProviderHealthEntry, VisualEvidenceCard } from "../types";
import { AppLanguage } from "./preferences";

export type { AppLanguage };

type DictValue = string | ((vars?: Record<string, string | number>) => string);

const dict: Record<AppLanguage, Record<string, DictValue>> = {
  en: {
    "nav.Home": "Home",
    "nav.Stocks": "Stocks",
    "nav.Recipes": "Recipes",
    "nav.Eyes": "Eyes",
    "nav.Alerts": "Alerts",
    "nav.Journal": "Journal",
    "nav.Logic Lab": "Logic Lab",
    "nav.Settings": "Settings",

    "subtitle.Home": "Stock-grouped triage.",
    "subtitle.Stocks": "Search, select, inspect.",
    "subtitle.Recipes": "Recipe inventory first.",
    "subtitle.Eyes": "Recipe subscriptions.",
    "subtitle.Alerts": "What changed and why now.",
    "subtitle.Journal": "Decision history first.",
    "subtitle.Logic Lab": "Trace logic from data to outcome.",
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
    "common.all": "All",
    "common.dismiss": "Dismiss",
    "common.edit": "Edit",
    "common.archive": "Archive",
    "common.save": "Save",
    "common.saveChanges": "Save Changes",
    "common.registerEye": "Register Eye",
    "common.saving": "Saving…",
    "common.scanning": "Scanning completed market sessions…",
    "common.notCaptured": "Not captured",
    "common.select": "Select",
    "common.closeOptions": "Close options",
    "common.searchOptions": "Search options...",
    "common.noResultsFor": ({ search }: Record<string, string | number> = {}) => `No results matching "${search ?? ""}"`,
    "common.yes": "Yes",
    "common.no": "No",

    "review.passed": "Passed",
    "review.failed": "Failed",
    "review.warnings": "Warnings",
    "review.blockers": "Blockers",
    "review.support": "Support",
    "review.risks": "Risks",
    "review.state": ({ value }: Record<string, string | number> = {}) => `State: ${value ?? ""}`,
    "review.changed": "Changed",
    "review.stable": "Stable",
    "review.urgency": ({ value }: Record<string, string | number> = {}) => `Urgency: ${value ?? ""}`,
    "review.nextTrigger": ({ value }: Record<string, string | number> = {}) => `Next trigger: ${value ?? ""}`,
    "review.dataIssues": ({ value }: Record<string, string | number> = {}) => `Data issues: ${value ?? ""}`,
    "review.showMatrix": "Show matrix",
    "review.hideMatrix": "Hide matrix",
    "review.condition": "Condition",
    "review.topSupport": "Top support",
    "review.topRisk": "Top risk",
    "review.latestDecision": "Latest decision",
    "review.noStrongChange": "No strong change recorded.",
    "review.noImmediateRisk": "No immediate risk surfaced.",
    "review.setupHigh": "High",
    "review.setupMedium": "Medium",
    "review.setupLow": "Low",

    "logic.scanner.title": "Daily Condition Scanner",
    "logic.scanner.run": "Run Scan",
    "logic.scanner.matched": "Matched",
    "logic.scanner.near": "Near",
    "logic.scanner.blocked": "Blocked",
    "logic.scanner.rules": "Rules",
    "logic.scanner.noRun": "No scan run yet.",
    "logic.scanner.matchedBody": "Condition matched — human review required.",
    "logic.scanner.nearBody": "Near match — watchlist only.",
    "logic.scanner.blockedBody": "Scan blocked because data is incomplete or invalid.",
    "logic.scanner.countPassed": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} passed`,
    "logic.scanner.countFailed": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} failed`,
    "logic.scanner.countMissing": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} missing`,
    "logic.scanner.reviewLogged": "Review logged",
    "logic.scanner.logReview": "Log Review",
    "logic.scanner.reviewTitle": "Signal Review Log",
    "logic.scanner.reviewDecision": "Review decision",
    "logic.scanner.manualReason": "Manual reason",
    "logic.scanner.manualReasonPlaceholder": "Why are you logging this review?",
    "logic.scanner.notes": "Notes",
    "logic.scanner.notesPlaceholder": "Additional review notes",
    "logic.scanner.conviction": "Conviction (optional)",
    "logic.scanner.entryPrice": "Entry price (optional)",
    "logic.scanner.exitPrice": "Exit price (optional)",
    "logic.scanner.resultNotes": "Result notes",
    "logic.scanner.resultNotesPlaceholder": "Follow-up result note",
    "logic.scanner.saveLog": "Save Log",
    "logic.scanner.incompleteBody": "Data is incomplete or failed validation.",
    "logic.scanner.runStatus.completed": "Completed",
    "logic.scanner.runStatus.blocked": "Blocked",
    "logic.scanner.runStatus.partial": "Partial",

    "workspace.recovery.title": "Your saved data needs attention",
    "workspace.recovery.body": "The original data has been kept. Export a recovery copy before restoring a backup.",
    "workspace.recovery.export": "Export recovery copy",
    "workspace.recovery.restore": "Restore previous saved copy",
    "workspace.recovery.retry": "Retry loading",
    "workspace.title": "Your workspace",
    "workspace.body": "Stored on this device. Export regular backups to keep your investment notes safe.",
    "workspace.export": "Export complete backup",
    "workspace.exportReport": "Export weekly review report",
    "workspace.reEvaluate": "Re-evaluate saved data",
    "workspace.exportSample": "Export sample notes and start a clean personal workspace",
    "workspace.restore.title": "Restore a backup",
    "workspace.chooseBackup": "Choose backup file",
    "workspace.backupPlaceholder": "Paste StockLedger backup JSON",
    "workspace.validate": "Validate backup",
    "workspace.validateSuccess": "Backup validated. Review the contents below before restoring.",
    "workspace.restoreSummary": ({ stocks, recipes, decisions }: Record<string, string | number> = {}) => `${stocks ?? 0} stocks · ${recipes ?? 0} recipes · ${decisions ?? 0} decisions. Restore replaces the active workspace. A copy of the current workspace will be exported first.`,
    "workspace.restoreCurrent": "Export current data and restore this backup",
    "workspace.restoreSuccess": "Backup restored.",
    "workspace.prices.title": "Import daily prices",
    "workspace.prices.body": "CSV columns: Date,Open,High,Low,Close,Volume. Supply provider OHLCV observations, not normalized chart values. History must contain consecutive NYSE sessions. Automated alerts require provider-declared adjusted history; unadjusted or unknown data stays marked partial. Long-window metrics need at least 252 sessions.",
    "workspace.prices.addStock": "Add a stock to your watchlist first.",
    "workspace.prices.placeholder": "Paste daily price CSV",
    "workspace.prices.choose": "Choose daily price CSV",
    "workspace.prices.benchmarkPlaceholder": "Optional SPY CSV for matching dates",
    "workspace.prices.chooseBenchmark": "Choose SPY CSV",
    "workspace.prices.adjustment": "Provider-declared adjustment",
    "workspace.prices.adjustment.unknown": "Unknown",
    "workspace.prices.adjustment.adjusted": "Adjusted",
    "workspace.prices.adjustment.unadjusted": "Unadjusted",
    "workspace.prices.validate": "Validate and import prices",
    "workspace.prices.importSuccess": "Prices imported with source and session dates.",
    "workspace.addRecipes": "Add starter recipes",
    "workspace.addRecipesSuccess": "Starter recipes added without changing existing recipes.",
    "workspace.restoreStock": ({ symbol }: Record<string, string | number> = {}) => `Restore ${symbol ?? "stock"}`,
    "workspace.restoreEye": ({ symbol }: Record<string, string | number> = {}) => `Restore monitoring: ${symbol ?? "stock"}`,
    "workspace.restoreDecision": ({ date, action }: Record<string, string | number> = {}) => `Restore decision: ${date ?? ""} ${action ?? ""}`,
    "workspace.operationFailed": "Operation failed.",
    "workspace.saveFailed": "Save failed.",
    "workspace.watchlist.title": "Import a watchlist",
    "workspace.watchlist.body": "CSV needs Symbol or Ticker; Name and Thesis are optional. Existing stocks and their notes are preserved.",
    "workspace.watchlist.choose": "Choose watchlist CSV",
    "workspace.watchlist.placeholder": "Symbol,Name,Thesis",
    "workspace.watchlist.preview": "Preview watchlist import",
    "workspace.watchlist.summary": ({ added, existing }: Record<string, string | number> = {}) => `${added ?? 0} new stocks; ${existing ?? 0} existing stocks will be kept as they are.`,
    "workspace.watchlist.import": "Import new stocks",
    "workspace.watchlist.success": "Watchlist imported. Add recipes and price history when ready.",

    "route.unavailableTitle": "This link is no longer available",
    "route.entityUnavailable": "The requested item is missing, archived, stale, or unavailable. Nothing was changed.",
    "route.metricUnavailable": "That metric is not available for this stock. The stock view is still safe to use.",
    "route.returnToDestination": "Return to this section",

    "home.onboarding.title": "Build your investment memory",
    "home.onboarding.body": "Add a stock, capture why you are watching it, then attach a recipe. Import daily prices in Settings to evaluate your evidence.",
    "home.onboarding.addStock": "Add your first stock",
    "home.onboarding.addRecipes": "Add starter recipes",
    "home.onboarding.exploreSample": "Explore sample workspace",
    "home.sampleNotice": "Sample data is present. Mock prices and outcomes are for exploring the app.",

    "settings.language.title": "Language",
    "settings.language.note": "Choose the app language.",
    "settings.language.english": "English",
    "settings.language.korean": "한국어",
    "cloud.title": "Optional personal cloud sync",
    "cloud.notConfigured": "Cloud sync is not configured for this build. Your complete local workspace and backups work without an account.",
    "cloud.signedInAs": ({ account }: Record<string, string | number> = {}) => `Signed in as ${account ?? "private account"}.`,
    "cloud.accountPrivate": "private account",
    "cloud.deviceSessionActive": "This device session is active.",
    "cloud.sessionExpires": ({ date }: Record<string, string | number> = {}) => `Session refresh is expected before ${date ?? "the displayed time"}`,
    "cloud.sessionRestoreFailed": "Could not restore your sign-in session.",
    "cloud.syncIncludes": "Sync includes personal notes, recipes, decisions and review history. Price archives, universe snapshots and scanner archives stay on this device.",
    "cloud.confirmAdoption": "Confirm this workspace belongs to my account",
    "cloud.adoptionConfirmed": "Confirmed: this workspace belongs to this account",
    "cloud.syncNow": "Sync now",
    "cloud.working": "Working…",
    "cloud.backupAndApply": "Back up and apply selected resolutions",
    "cloud.cursorExpired": "The cloud change history is compacted. No history was skipped.",
    "cloud.rebootstrapBody": "Confirm a bounded re-bootstrap to compare the current cloud records with this device before applying anything.",
    "cloud.rebootstrap": "Confirm bounded re-bootstrap",
    "cloud.syncComplete": ({ records, uploaded }: Record<string, string | number> = {}) => `Synced ${records ?? 0} cloud records; uploaded ${uploaded ?? 0} changes.`,
    "cloud.localVersion": ({ state }: Record<string, string | number> = {}) => `This device: ${state ?? "saved version"}.`,
    "cloud.remoteVersion": ({ state, revision, cursor }: Record<string, string | number> = {}) => `Cloud: ${state ?? "saved version"}; revision ${revision ?? 0}, cursor ${cursor ?? 0}.`,
    "cloud.edited": "edited",
    "cloud.deleted": "deleted",
    "cloud.keepLocal": "Keep this device's version",
    "cloud.keepRemote": "Keep the cloud version",
    "cloud.selectedLocal": "Selected: keep this device",
    "cloud.selectedRemote": "Selected: keep cloud",
    "cloud.requestFailed": "Cloud request failed. Local data is preserved.",
    "cloud.exportCloud": "Export complete cloud data",
    "cloud.exported": "Cloud data exported. Local workspace and backups were not changed.",
    "cloud.signOutLocal": "Sign out this device only",
    "cloud.signOutGlobal": "Sign out all devices",
    "cloud.signedOutLocal": "Signed out on this device. Local workspace data remains here.",
    "cloud.signedOutGlobal": "Global sign-out requested. Local workspace data remains here.",
    "cloud.newPassword": "New password",
    "cloud.confirmPassword": "Confirm new password",
    "cloud.updatePassword": "Update password",
    "cloud.passwordUpdated": "Password updated.",
    "cloud.externalBackupLimit": "StockLedger does not control Supabase provider backups or email retention. Those limits remain an external deployment gate.",
    "cloud.deleteTitle": "Delete cloud account data",
    "cloud.deleteBody": "This request invalidates cloud sync and erases StockLedger-owned cloud records. It does not erase this device, local backups, or uninstalled provider backups. Auth-user deletion still needs the supported server-controlled Auth process.",
    "cloud.requestDelete": "Request cloud deletion",
    "cloud.confirmDelete": "Confirm cloud deletion request",
    "cloud.deleteRequested": "Deletion requested. Cloud sync is now disabled for this account.",
    "cloud.deletionStatus": ({ status }: Record<string, string | number> = {}) => `Deletion status: ${status ?? "unknown"}`,
    "cloud.deletion.requested": "requested",
    "cloud.deletion.in_progress": "in progress",
    "cloud.deletion.completed": "completed",
    "cloud.deletion.failed": "failed",
    "cloud.authDeletionUnproven": "Full Auth-user deletion is not proven by this client boundary.",
    "cloud.authDeletionCompleted": "Auth-user deletion was confirmed by the supported server process.",
    "cloud.signInBody": "Sign in to an existing account or create one. Local data is uploaded only when you choose Sync now.",
    "cloud.emailPlaceholder": "Email address",
    "cloud.passwordPlaceholder": "Password",
    "cloud.signIn": "Sign in",
    "cloud.createAccount": "Create account",
    "cloud.accountSubmitted": "Account request submitted. Check your email if confirmation is required, then sign in.",
    "cloud.sendRecovery": "Send password recovery email",
    "cloud.recoverySent": "Recovery email requested. Follow the supported Auth link to set a new password.",
    "cloud.passwordRule": "New passwords need at least 12 characters.",
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

    "home.bucket.reviewNow": "Review Now",
    "home.bucket.forming": "Forming",
    "home.bucket.reviewSoon": "Review Soon",

    "alerts.summary.open": "Open",
    "alerts.summary.groupedStocks": "Grouped Stocks",
    "alerts.summary.snoozed": "Snoozed",
    "alerts.summary.reviewed": "Reviewed",
    "alerts.tab.current": "Current",
    "alerts.tab.history": "History",
    "alerts.current.title": ({ count }: Record<string, string | number> = {}) => `Current Alerts · ${count ?? 0}`,
    "alerts.current.note": "Alerts are grouped by stock first so related signals stay together.",
    "alerts.current.empty": "No open alerts right now.",
    "alerts.cluster.next": "Next",
    "alerts.cluster.groupHint": "Review grouped signals on this stock.",
    "alerts.history.title": ({ count }: Record<string, string | number> = {}) => `Alert History · ${count ?? 0}`,
    "alerts.history.note": "Review acknowledged and snoozed alerts, and jump into linked journals when they exist.",
    "alerts.history.empty": "No alert history yet.",
    "alerts.history.acknowledged": "Acknowledged",
    "alerts.history.snoozedUntil": ({ date }: Record<string, string | number> = {}) => `Snoozed until ${date ?? "unknown"}`,
    "alerts.history.snoozedUnknown": "unknown",
    "alerts.history.journalAction": ({ action }: Record<string, string | number> = {}) => `Journal · ${action ?? ""}`,
    "alerts.action.entered": "Entered",
    "alerts.action.skip": "Skip",
    "alerts.action.snooze": "Snooze",
    "alerts.action.acknowledge": "Acknowledge",
    "alerts.action.unsnooze": "Unsnooze",
    "alerts.action.acknowledgeAll": "Acknowledge All",
    "alerts.action.snooze24h": "Snooze 24H",
    "alerts.action.useful": "Useful",
    "alerts.action.notUseful": "Not Useful",
    "alerts.detail.whatHappened": "What happened",
    "alerts.detail.priority": "Priority",
    "alerts.detail.state": "State",
    "alerts.detail.urgency": "Urgency",
    "alerts.detail.data": "Data",
    "alerts.detail.biggestSupport": "Biggest support",
    "alerts.detail.biggestRisk": "Biggest risk",
    "alerts.detail.noStrongSupport": "No strong support recorded.",
    "alerts.detail.noMajorRisk": "No major risk recorded.",
    "alerts.detail.reviewFast": "Review in 5 seconds",
    "alerts.detail.item.priority": ({ value }: Record<string, string | number> = {}) => `Priority is ${value ?? ""}.`,
    "alerts.detail.item.stateChange": ({ value }: Record<string, string | number> = {}) => `State change: ${value ?? ""}.`,
    "alerts.detail.open": "Open",

    "eyes.summary.active": "Active",
    "eyes.summary.inactive": "Inactive",
    "eyes.summary.attention": "Attention",
    "eyes.summary.broken": "Broken",
    "eyes.filter.all": "All",
    "eyes.filter.needsReview": "Needs Review",
    "eyes.filter.quiet": "Quiet",
    "eyes.active.title": ({ count }: Record<string, string | number> = {}) => `Active Eyes · ${count ?? 0}`,
    "eyes.active.note": "These are the recipe subscriptions currently worth monitoring.",
    "eyes.active.empty": "No active Eyes yet.",
    "eyes.inactive.title": ({ count }: Record<string, string | number> = {}) => `Inactive Eyes · ${count ?? 0}`,
    "eyes.inactive.note": "Subscriptions that are quiet or thesis-broken remain here for reference.",
    "eyes.inactive.empty": "No inactive Eyes yet.",
    "eyes.notEvaluated": "Not Evaluated",
    "eyes.waiting": "Waiting for the next meaningful change.",
    "eyes.meta.wait": "Wait",
    "eyes.meta.reviewDue": "Review due",
    "eyes.action.stock": "Stock",
    "eyes.action.review": "Review",
    "eyes.action.detail": "Detail",
    "eyes.detail.currentState": "Current Eye state",
    "eyes.detail.noSummary": "This Eye has not produced a meaningful review summary yet.",
    "eyes.detail.unknownRecipe": "Unknown Recipe",
    "eyes.detail.urgency": "Urgency",
    "eyes.detail.review": "Review",
    "eyes.detail.entryLow": "Entry Low",
    "eyes.detail.entryHigh": "Entry High",
    "eyes.detail.alerts": "Alerts",
    "eyes.detail.journal": "Journal",
    "eyes.detail.unset": "Unset",
    "eyes.detail.due": "Due",
    "eyes.detail.thesisSnapshot": "Thesis snapshot",
    "eyes.detail.invalidationRule": "Invalidation rule",
    "eyes.detail.noInvalidation": "No invalidation rule recorded yet.",
    "eyes.detail.lastDecision": "Last logged decision",
    "eyes.action.markReviewed": "Mark Reviewed",
    "eyes.action.addJournal": "Add Journal",
    "eyes.action.delete": "Delete",
    "eyes.detail.unsetHorizon": "Unset horizon",
    "eyes.create.title": "Create Eye",
    "eyes.create.editTitle": "Edit Eye",
    "eyes.create.editSubtitle": "Update the stock, recipe, and thesis snapshot for this Eye.",
    "eyes.create.subtitle": "Subscribe a selected stock to a selected recipe with your thesis snapshot.",
    "eyes.create.stock": "Stock",
    "eyes.create.recipe": "Recipe",
    "eyes.create.selectStock": "Select a stock.",
    "eyes.create.selectRecipe": "Select a recipe.",
    "eyes.create.thesis": "Specific thesis snapshot",
    "eyes.create.thesisPlaceholder": "Why does this stock under this recipe deserve repeated attention?",
    "eyes.create.thesisRequired": "Thesis snapshot is required.",
    "eyes.create.entryLow": "Planned entry low",
    "eyes.create.entryHigh": "Planned entry high",
    "eyes.create.entryLowPlaceholder": "Entry low (optional)",
    "eyes.create.entryHighPlaceholder": "Entry high (optional)",
    "eyes.create.lastReview": "Last thesis review",
    "eyes.create.invalidation": "Invalidation rule",
    "eyes.create.invalidationPlaceholder": "What would break the thesis fast?",
    "eyes.create.submit": "Create Eye",

    "journal.summary.entries": "Entries",
    "journal.summary.entered": "Entered",
    "journal.summary.skipped": "Skipped",
    "journal.summary.pendingOutcomes": "Pending Outcomes",
    "journal.filter.all": "All",
    "journal.filter.entered": "Entered",
    "journal.filter.skipped": "Skipped",
    "journal.filter.risky": "Risky",
    "journal.empty": "No journal entries in this filter yet.",
    "journal.meta.noState": "No state snapshot",
    "journal.meta.noData": "No data note",
    "journal.meta.thesis": ({ value }: Record<string, string | number> = {}) => `Thesis ${value ?? ""}`,
    "journal.meta.concern": ({ value }: Record<string, string | number> = {}) => `Concern: ${value ?? "Not captured"}`,
    "journal.meta.notCaptured": "Not captured",
    "journal.action.save": "Save Decision",
    "journal.action.edit": "Edit",
    "journal.action.archive": "Archive decision",
    "journal.action.open": "Open",
    "journal.action.alert": "Alert",
    "journal.action.markOutcome": "Mark Outcome",
    "journal.action.outcomeDone": "Outcome Done",
    "journal.composer.title": "New Journal Entry",
    "journal.composer.subtitle": "Capture the decision only when you choose to add one.",
    "journal.composer.eye": "Eye",
    "journal.composer.selectEye": "Select an Eye.",
    "journal.composer.action": "Action",
    "journal.composer.why": "Why did you act this way?",
    "journal.composer.notePlaceholder": "Why did you enter, skip, or revise?",
    "journal.composer.noteRequired": "A decision note is required.",
    "journal.composer.concern": "Main concern",
    "journal.composer.concernPlaceholder": "What risk mattered most?",
    "journal.composer.thesisValidity": "Thesis validity",
    "journal.composer.timing": "Timing",
    "journal.composer.searchPlaceholder": "Search monitored stock...",
    "journal.validation.thesisRequired": "Choose your thesis assessment.",
    "journal.validation.timingRequired": "Choose your timing assessment.",
    "journal.outcome.title": "Review this outcome",
    "journal.outcome.body": "Record your observations and their sources. These notes are separate from the original decision evidence.",
    "journal.outcome.reviewWindow": "Review window",
    "journal.outcome.priceChange": "Price change and source",
    "journal.outcome.maxRunup": "Maximum run-up and source",
    "journal.outcome.maxDrawdown": "Maximum drawdown and source",
    "journal.outcome.lesson": "What did you learn?",
    "journal.outcome.recipeSuggestion": "What should change next time?",
    "journal.outcome.save": "Save outcome review",
    "journal.outcome.saved": "Outcome review saved.",
    "journal.detail.context": "Decision context",
    "journal.detail.noState": "State snapshot unavailable",
    "journal.detail.noData": "Data-quality note unavailable",
    "journal.detail.thesisTiming": ({ thesis, timing }: Record<string, string | number> = {}) => `Thesis ${thesis ?? ""} · Timing ${timing ?? ""}`,
    "journal.detail.note": "Decision note",
    "journal.detail.noNote": "No decision note recorded.",
    "journal.detail.concern": "Concern",
    "journal.detail.noConcern": "No primary concern recorded.",
    "journal.detail.outcome": ({ status }: Record<string, string | number> = {}) => `Outcome · ${status ?? "Pending"}`,
    "journal.detail.previousVersions": "Previous authored versions",

    "recipes.summary.recipes": "Recipes",
    "recipes.summary.starter": "Starter",
    "recipes.summary.custom": "Custom",
    "recipes.summary.activeEyes": "Active Eyes",
    "recipes.filter.all": "All",
    "recipes.filter.starter": "Starter",
    "recipes.filter.custom": "Custom",
    "recipes.filter.recent": "Recent",
    "recipes.card.version": ({ version }: Record<string, string | number> = {}) => `Version ${version ?? ""}`,
    "recipes.card.eyes": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} Eyes`,
    "recipes.card.type": "Type",
    "recipes.card.horizon": "Horizon",
    "recipes.card.cadence": "Cadence",
    "recipes.card.conditions": "Conditions",
    "recipes.card.useCasePending": "Use case pending",
    "recipes.card.open": "Open",
    "recipes.card.useForEye": "Use for Eye",
    "recipes.builder.title": "Recipe Builder",
    "recipes.builder.subtitle": "Guided pages. Fill the required fields, move step by step, and preview before saving.",
    "recipes.builder.step.Purpose": "Purpose",
    "recipes.builder.step.Logic": "Logic",
    "recipes.builder.step.Risk & Alerts": "Risk & Alerts",
    "recipes.builder.step.Review & Outcome": "Review & Outcome",
    "recipes.builder.prompt.Purpose": "Define what opportunity this recipe is trying to surface.",
    "recipes.builder.prompt.Logic": "Translate the investment logic into concrete conditions.",
    "recipes.builder.prompt.Risk & Alerts": "Set downgrade logic and alert behavior.",
    "recipes.builder.prompt.Review & Outcome": "Choose cadence and preview the recipe on a stock.",
    "recipes.builder.stat.conditions": "Conditions",
    "recipes.builder.stat.riskRules": "Risk Rules",
    "recipes.builder.stat.cadence": "Cadence",
    "recipes.builder.stat.cooldown": "Cooldown",
    "recipes.builder.ready": "Ready",
    "recipes.builder.needsInput": "Needs input",
    "recipes.builder.field.recipeName": "Recipe name",
    "recipes.builder.field.opportunityType": "Opportunity type",
    "recipes.builder.field.timeHorizon": "Time horizon",
    "recipes.builder.field.primaryUseCase": "Primary use case",
    "recipes.builder.field.purpose": "Purpose",
    "recipes.builder.field.category": "Category",
    "recipes.builder.field.template": "Template",
    "recipes.builder.field.conditionRole": "Condition role",
    "recipes.builder.field.operator": "Operator",
    "recipes.builder.field.threshold": "Threshold / parameter",
    "recipes.builder.field.whyMatters": "Why this matters",
    "recipes.builder.field.alertCooldown": "Alert cooldown",
    "recipes.builder.field.notes": "Notes",
    "recipes.builder.field.reviewCadence": "Review cadence",
    "recipes.builder.field.previewStock": "Preview stock",
    "recipes.builder.placeholder.recipeName": "Temporary Bargain Sale",
    "recipes.builder.placeholder.purpose": "What opportunity should this logic surface?",
    "recipes.builder.placeholder.notes": "Downgrade rules, blockers, and alert expectations",
    "recipes.builder.placeholder.whyMatters": "Optional context for future you",
    "recipes.builder.preview.condition": "Condition preview",
    "recipes.builder.preview.result": "Draft result",
    "recipes.builder.preview.disclosure": "Preview uses adapter-style sample data and stays clearly labeled.",
    "recipes.builder.preview.locked": "Add draft conditions first to unlock preview.",
    "recipes.builder.summary.title": "Ready to save",
    "recipes.builder.summary.body":
      ({ name, opportunityType, count, cadence, cooldown }: Record<string, string | number> = {}) =>
        `${name ?? "Untitled Recipe"} is set up for ${opportunityType ?? "this use"} with ${count ?? 0} conditions, a ${cadence ?? 0}-day review cadence, and a ${cooldown ?? 0}-hour alert cooldown.`,
    "recipes.builder.summary.meta":
      "Save only when the draft logic reads like a clear investing rule, not a checklist of indicators.",
    "recipes.builder.action.addCondition": "Add Condition",
    "recipes.builder.action.clearDraft": "Clear Draft",
    "recipes.builder.action.remove": "Remove",
    "recipes.builder.action.back": "Back",
    "recipes.builder.action.next": "Next",
    "recipes.builder.action.save": "Save Recipe",
    "recipes.builder.validation.recipeNameRequired": "Recipe name is required.",
    "recipes.builder.validation.purposeRequired": "Purpose is required.",
    "recipes.builder.validation.conditionRequired": "Add at least one condition.",
    "recipes.detail.type": "Type",
    "recipes.detail.useCase": "Use case",
    "recipes.detail.cadence": "Cadence",
    "recipes.detail.cooldown": "Cooldown",
    "recipes.detail.eyes": "Eyes",
    "recipes.detail.stocks": "Stocks",
    "recipes.detail.unset": "Unset",
    "recipes.detail.general": "General",
    "recipes.detail.starter": "Starter",
    "recipes.detail.custom": "Custom",
    "recipes.detail.conditions": ({ count }: Record<string, string | number> = {}) => `${count ?? 0} conditions`,
    "recipes.detail.hasNotes": "Has notes",
    "recipes.detail.trackedStocks": "Tracked stocks",
    "recipes.detail.useForEye": "Use for Eye",
    "recipes.detail.openBuilder": "Open Builder",
    "recipes.detail.builderNotes": "Builder notes",

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
    "stocks.search.openStock": ({ symbol, name }: Record<string, string | number> = {}) => `Open ${symbol ?? "stock"} ${name ?? ""}`,
    "stocks.search.showMore": ({ count }: Record<string, string | number> = {}) => `Show more stocks (${count ?? 0} remaining)`,
    "stocks.action.add": "Add stock",
    "stocks.action.manageEyes": "Manage monitoring Eyes",
    "stocks.editor.addTitle": "Add to watchlist",
    "stocks.editor.editTitle": "Edit stock",
    "stocks.editor.ticker": "Ticker",
    "stocks.editor.tickerPlaceholder": "Ticker, e.g. AAPL",
    "stocks.editor.companyName": "Company name",
    "stocks.editor.companyNamePlaceholder": "Company name",
    "stocks.editor.thesis": "Why you are watching",
    "stocks.editor.thesisPlaceholder": "Your thesis and what would change your mind",
    "stocks.editor.save": "Save stock",

    "stocks.data.dummyBacked": "Dummy-backed",
    "stocks.data.providerBacked": "Provider-backed",
    "stocks.data.dummy": "Dummy",
    "stocks.data.provider": "Provider",
    "stocks.data.manual": "Manual",
    "stocks.data.noData": "No Data",

    "stocks.hero.vs": ({ benchmark }: Record<string, string | number> = {}) => `Vs ${benchmark ?? "benchmark"}`,
    "stocks.hero.drawdown": ({ value }: Record<string, string | number> = {}) => `Drawdown ${value ?? "N/A"}`,
    "stocks.hero.selectObservation": ({ index }: Record<string, string | number> = {}) => `Select chart observation ${index ?? ""}`,
    "stocks.hero.noCompletedHistory": "No completed price history",
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
    "stocks.detail.selectPoint": ({ index }: Record<string, string | number> = {}) => `Select chart point ${index ?? ""}`,
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
    "stocks.visual.active": "Active now",
    "stocks.visual.inactive": "Inactive now",
    "stocks.visual.eventTiming": "Event timing",
    "stocks.visual.eventRiskClose": "Event risk is close enough to demand a fresh review.",
    "stocks.visual.noEventPressure": "No major event pressure inside the near window.",
    "stocks.visual.trend": "Trend",
    "stocks.visual.need": "Need",
    "stocks.visual.context": "context",
    "stocks.evidence.noInputs": "No explicit inputs recorded",
    "alerts.detail.evidenceRecorded": "Evidence recorded with this alert",
    "alerts.detail.olderEvidence": "Detailed evidence was not captured by the older app version. The original alert summary is preserved above.",
  },
  ko: {
    "nav.Home": "홈",
    "nav.Stocks": "종목",
    "nav.Recipes": "레시피",
    "nav.Eyes": "모니터",
    "nav.Alerts": "알림",
    "nav.Journal": "기록",
    "nav.Logic Lab": "로직 랩",
    "nav.Settings": "설정",

    "subtitle.Home": "종목별로 묶인 핵심 현황.",
    "subtitle.Stocks": "검색하고, 선택하고, 바로 확인하세요.",
    "subtitle.Recipes": "레시피 목록부터 보여줍니다.",
    "subtitle.Eyes": "레시피 구독 현황.",
    "subtitle.Alerts": "무엇이 바뀌었는지 바로 확인.",
    "subtitle.Journal": "결정 기록을 먼저 보여줍니다.",
    "subtitle.Logic Lab": "데이터부터 결과까지 논리 추적.",
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
    "common.all": "전체",
    "common.dismiss": "닫기",
    "common.edit": "수정",
    "common.archive": "보관",
    "common.save": "저장",
    "common.saveChanges": "수정 저장",
    "common.registerEye": "모니터 등록",
    "common.saving": "저장 중…",
    "common.scanning": "완료된 시장 세션을 스캔하는 중…",
    "common.notCaptured": "기록 없음",
    "common.select": "선택",
    "common.closeOptions": "선택지 닫기",
    "common.searchOptions": "선택지 검색...",
    "common.noResultsFor": ({ search }: Record<string, string | number> = {}) => `"${search ?? ""}" 검색 결과가 없습니다.`,
    "common.yes": "예",
    "common.no": "아니오",

    "review.passed": "충족",
    "review.failed": "미충족",
    "review.warnings": "경고",
    "review.blockers": "차단",
    "review.support": "근거",
    "review.risks": "위험",
    "review.state": ({ value }: Record<string, string | number> = {}) => `상태: ${value ?? ""}`,
    "review.changed": "변경됨",
    "review.stable": "안정",
    "review.urgency": ({ value }: Record<string, string | number> = {}) => `긴급도: ${value ?? ""}`,
    "review.nextTrigger": ({ value }: Record<string, string | number> = {}) => `다음 트리거: ${value ?? ""}`,
    "review.dataIssues": ({ value }: Record<string, string | number> = {}) => `데이터 이슈: ${value ?? ""}`,
    "review.showMatrix": "매트릭스 보기",
    "review.hideMatrix": "매트릭스 숨기기",
    "review.condition": "조건",
    "review.topSupport": "가장 큰 근거",
    "review.topRisk": "가장 큰 위험",
    "review.latestDecision": "최근 결정",
    "review.noStrongChange": "뚜렷한 변화는 아직 없습니다.",
    "review.noImmediateRisk": "즉시 확인할 큰 위험은 아직 없습니다.",
    "review.setupHigh": "높음",
    "review.setupMedium": "보통",
    "review.setupLow": "낮음",

    "logic.scanner.title": "일일 조건 스캐너",
    "logic.scanner.run": "스캔 실행",
    "logic.scanner.matched": "일치",
    "logic.scanner.near": "근접",
    "logic.scanner.blocked": "차단",
    "logic.scanner.rules": "규칙",
    "logic.scanner.noRun": "아직 스캔 기록이 없습니다.",
    "logic.scanner.matchedBody": "조건이 일치했습니다 — 사람의 검토가 필요합니다.",
    "logic.scanner.nearBody": "근접 일치입니다 — 관심 목록에서만 확인하세요.",
    "logic.scanner.blockedBody": "데이터가 부족하거나 유효하지 않아 스캔이 차단되었습니다.",
    "logic.scanner.countPassed": ({ count }: Record<string, string | number> = {}) => `${count ?? 0}개 통과`,
    "logic.scanner.countFailed": ({ count }: Record<string, string | number> = {}) => `${count ?? 0}개 실패`,
    "logic.scanner.countMissing": ({ count }: Record<string, string | number> = {}) => `${count ?? 0}개 누락`,
    "logic.scanner.reviewLogged": "검토 기록 있음",
    "logic.scanner.logReview": "검토 기록",
    "logic.scanner.reviewTitle": "신호 검토 기록",
    "logic.scanner.reviewDecision": "검토 결정",
    "logic.scanner.manualReason": "수동 사유",
    "logic.scanner.manualReasonPlaceholder": "왜 이 결정을 남기는지 적으세요",
    "logic.scanner.notes": "메모",
    "logic.scanner.notesPlaceholder": "추가 관찰 메모",
    "logic.scanner.conviction": "확신도(선택)",
    "logic.scanner.entryPrice": "진입가(선택)",
    "logic.scanner.exitPrice": "청산가(선택)",
    "logic.scanner.resultNotes": "결과 메모",
    "logic.scanner.resultNotesPlaceholder": "후속 관찰",
    "logic.scanner.saveLog": "저장",
    "logic.scanner.incompleteBody": "데이터가 부족하거나 검증에 실패했습니다.",
    "logic.scanner.runStatus.completed": "완료",
    "logic.scanner.runStatus.blocked": "차단",
    "logic.scanner.runStatus.partial": "일부만",

    "workspace.recovery.title": "저장된 데이터 확인이 필요합니다",
    "workspace.recovery.body": "원본 데이터는 보존되어 있습니다. 백업을 복원하기 전에 복구 사본을 내보내세요.",
    "workspace.recovery.export": "복구 사본 내보내기",
    "workspace.recovery.restore": "이전 저장 사본 복원",
    "workspace.recovery.retry": "다시 불러오기",
    "workspace.title": "내 워크스페이스",
    "workspace.body": "이 기기에 저장됩니다. 투자 메모를 안전하게 보관하려면 정기적으로 백업하세요.",
    "workspace.export": "전체 백업 내보내기",
    "workspace.exportReport": "주간 검토 보고서 내보내기",
    "workspace.reEvaluate": "저장 데이터 다시 평가",
    "workspace.exportSample": "샘플 메모를 내보내고 깨끗한 개인 워크스페이스 시작",
    "workspace.restore.title": "백업 복원",
    "workspace.chooseBackup": "백업 파일 선택",
    "workspace.backupPlaceholder": "StockLedger 백업 JSON 붙여넣기",
    "workspace.validate": "백업 검증",
    "workspace.validateSuccess": "백업을 검증했습니다. 복원 전에 아래 내용을 확인하세요.",
    "workspace.restoreSummary": ({ stocks, recipes, decisions }: Record<string, string | number> = {}) => `종목 ${stocks ?? 0}개 · 레시피 ${recipes ?? 0}개 · 결정 ${decisions ?? 0}개입니다. 복원하면 현재 워크스페이스가 교체됩니다. 먼저 현재 워크스페이스 사본을 내보냅니다.`,
    "workspace.restoreCurrent": "현재 데이터를 내보내고 이 백업 복원",
    "workspace.restoreSuccess": "백업을 복원했습니다.",
    "workspace.prices.title": "일별 가격 가져오기",
    "workspace.prices.body": "CSV 열: Date,Open,High,Low,Close,Volume. 정규화된 차트 값이 아니라 제공자 OHLCV 관측값을 넣으세요. 이력에는 연속된 NYSE 세션이 있어야 합니다. 자동 알림에는 제공자가 조정 여부를 선언한 조정 이력이 필요하며, 미조정 또는 알 수 없는 데이터는 일부 데이터로 표시됩니다. 긴 기간 지표에는 최소 252개 세션이 필요합니다.",
    "workspace.prices.addStock": "관심 종목을 먼저 추가하세요.",
    "workspace.prices.placeholder": "일별 가격 CSV 붙여넣기",
    "workspace.prices.choose": "일별 가격 CSV 선택",
    "workspace.prices.benchmarkPlaceholder": "날짜 매칭용 SPY CSV (선택)",
    "workspace.prices.chooseBenchmark": "SPY CSV 선택",
    "workspace.prices.adjustment": "제공자 조정 여부",
    "workspace.prices.validate": "가격 검증 및 가져오기",
    "workspace.prices.importSuccess": "소스와 세션 날짜를 포함해 가격을 가져왔습니다.",
    "workspace.addRecipes": "스타터 레시피 추가",
    "workspace.addRecipesSuccess": "기존 레시피를 변경하지 않고 스타터 레시피를 추가했습니다.",
    "workspace.restoreStock": ({ symbol }: Record<string, string | number> = {}) => `${symbol ?? "종목"} 복원`,
    "workspace.restoreEye": ({ symbol }: Record<string, string | number> = {}) => `모니터링 복원: ${symbol ?? "종목"}`,
    "workspace.restoreDecision": ({ date, action }: Record<string, string | number> = {}) => `결정 복원: ${date ?? ""} ${action ?? ""}`,
    "workspace.prices.adjustment.unknown": "알 수 없음",
    "workspace.prices.adjustment.adjusted": "조정됨",
    "workspace.prices.adjustment.unadjusted": "미조정",
    "workspace.operationFailed": "작업에 실패했습니다.",
    "workspace.saveFailed": "저장에 실패했습니다.",
    "workspace.watchlist.title": "관심 종목 가져오기",
    "workspace.watchlist.body": "CSV에는 Symbol 또는 Ticker가 필요합니다. Name과 Thesis는 선택 사항입니다. 기존 종목과 메모는 보존됩니다.",
    "workspace.watchlist.choose": "관심 종목 CSV 선택",
    "workspace.watchlist.placeholder": "Symbol,Name,Thesis",
    "workspace.watchlist.preview": "관심 종목 가져오기 미리보기",
    "workspace.watchlist.summary": ({ added, existing }: Record<string, string | number> = {}) => `새 종목 ${added ?? 0}개, 기존 종목 ${existing ?? 0}개는 현재 상태로 유지됩니다.`,
    "workspace.watchlist.import": "새 종목 가져오기",
    "workspace.watchlist.success": "관심 종목을 가져왔습니다. 준비되면 레시피와 가격 이력을 추가하세요.",

    "route.unavailableTitle": "이 링크는 더 이상 사용할 수 없습니다",
    "route.entityUnavailable": "요청한 항목이 없거나, 보관되었거나, 오래되었거나, 현재 사용할 수 없습니다. 아무것도 변경하지 않았습니다.",
    "route.metricUnavailable": "이 종목에서는 해당 지표를 사용할 수 없습니다. 종목 화면은 안전하게 유지됩니다.",
    "route.returnToDestination": "이 섹션으로 돌아가기",

    "home.onboarding.title": "투자 기억 만들기",
    "home.onboarding.body": "종목을 추가하고, 지켜보는 이유를 적은 뒤 레시피를 연결하세요. 근거를 평가하려면 설정에서 일별 가격을 가져오세요.",
    "home.onboarding.addStock": "첫 종목 추가",
    "home.onboarding.addRecipes": "스타터 레시피 추가",
    "home.onboarding.exploreSample": "샘플 워크스페이스 보기",
    "home.sampleNotice": "샘플 데이터가 있습니다. 더미 가격과 결과는 앱을 둘러보기 위한 것입니다.",

    "settings.language.title": "언어",
    "settings.language.note": "앱에서 사용할 언어를 선택하세요.",
    "settings.language.english": "English",
    "settings.language.korean": "한국어",
    "cloud.title": "선택적 개인 클라우드 동기화",
    "cloud.notConfigured": "이 빌드에는 클라우드 동기화가 설정되지 않았습니다. 계정 없이도 전체 로컬 워크스페이스와 백업을 사용할 수 있습니다.",
    "cloud.signedInAs": ({ account }: Record<string, string | number> = {}) => `${account ?? "비공개 계정"}으로 로그인했습니다.`,
    "cloud.accountPrivate": "비공개 계정",
    "cloud.deviceSessionActive": "이 기기의 세션이 활성 상태입니다.",
    "cloud.sessionExpires": ({ date }: Record<string, string | number> = {}) => `세션 갱신 예정: ${date ?? "표시된 시간"}`,
    "cloud.sessionRestoreFailed": "로그인 세션을 복원하지 못했습니다.",
    "cloud.syncIncludes": "개인 메모, 레시피, 결정 및 검토 기록을 동기화합니다. 가격 아카이브, 유니버스 스냅샷과 스캐너 아카이브는 이 기기에 남습니다.",
    "cloud.confirmAdoption": "이 워크스페이스가 내 계정에 속함을 확인",
    "cloud.adoptionConfirmed": "확인됨: 이 워크스페이스는 이 계정에 속합니다",
    "cloud.syncNow": "지금 동기화",
    "cloud.working": "처리 중…",
    "cloud.backupAndApply": "백업 후 선택한 해결 적용",
    "cloud.cursorExpired": "클라우드 변경 이력이 압축되었습니다. 이력을 건너뛰지 않았습니다.",
    "cloud.rebootstrapBody": "현재 클라우드 기록과 이 기기의 기록을 비교한 뒤 적용하도록 제한된 재부트스트랩을 확인하세요.",
    "cloud.rebootstrap": "제한된 재부트스트랩 확인",
    "cloud.syncComplete": ({ records, uploaded }: Record<string, string | number> = {}) => `클라우드 기록 ${records ?? 0}개를 동기화했고 ${uploaded ?? 0}개 변경을 업로드했습니다.`,
    "cloud.localVersion": ({ state }: Record<string, string | number> = {}) => `이 기기: ${state ?? "저장된 버전"}.`,
    "cloud.remoteVersion": ({ state, revision, cursor }: Record<string, string | number> = {}) => `클라우드: ${state ?? "저장된 버전"}; 리비전 ${revision ?? 0}, 커서 ${cursor ?? 0}.`,
    "cloud.edited": "편집됨",
    "cloud.deleted": "삭제됨",
    "cloud.keepLocal": "이 기기 버전 유지",
    "cloud.keepRemote": "클라우드 버전 유지",
    "cloud.selectedLocal": "선택됨: 이 기기 유지",
    "cloud.selectedRemote": "선택됨: 클라우드 유지",
    "cloud.requestFailed": "클라우드 요청에 실패했습니다. 로컬 데이터는 보존됩니다.",
    "cloud.exportCloud": "전체 클라우드 데이터 내보내기",
    "cloud.exported": "클라우드 데이터를 내보냈습니다. 로컬 워크스페이스와 백업은 변경하지 않았습니다.",
    "cloud.signOutLocal": "이 기기에서만 로그아웃",
    "cloud.signOutGlobal": "모든 기기에서 로그아웃",
    "cloud.signedOutLocal": "이 기기에서 로그아웃했습니다. 로컬 워크스페이스는 남아 있습니다.",
    "cloud.signedOutGlobal": "전체 로그아웃을 요청했습니다. 로컬 워크스페이스는 남아 있습니다.",
    "cloud.newPassword": "새 비밀번호",
    "cloud.confirmPassword": "새 비밀번호 확인",
    "cloud.updatePassword": "비밀번호 변경",
    "cloud.passwordUpdated": "비밀번호를 변경했습니다.",
    "cloud.externalBackupLimit": "StockLedger는 Supabase 제공자 백업이나 이메일 보존을 제어하지 않습니다. 해당 제한은 외부 배포 게이트로 남습니다.",
    "cloud.deleteTitle": "클라우드 계정 데이터 삭제",
    "cloud.deleteBody": "이 요청은 클라우드 동기화를 무효화하고 StockLedger가 소유한 클라우드 기록을 삭제합니다. 이 기기, 로컬 백업 또는 이미 제거할 수 없는 제공자 백업은 지우지 않습니다. Auth 사용자 삭제는 지원되는 서버 제어 Auth 절차가 필요합니다.",
    "cloud.requestDelete": "클라우드 삭제 요청",
    "cloud.confirmDelete": "클라우드 삭제 요청 확인",
    "cloud.deleteRequested": "삭제를 요청했습니다. 이 계정의 클라우드 동기화가 비활성화되었습니다.",
    "cloud.deletionStatus": ({ status }: Record<string, string | number> = {}) => `삭제 상태: ${status ?? "알 수 없음"}`,
    "cloud.deletion.requested": "요청됨",
    "cloud.deletion.in_progress": "진행 중",
    "cloud.deletion.completed": "완료됨",
    "cloud.deletion.failed": "실패함",
    "cloud.authDeletionUnproven": "이 클라이언트 경계에서는 전체 Auth 사용자 삭제를 입증하지 못했습니다.",
    "cloud.authDeletionCompleted": "지원되는 서버 절차에서 Auth 사용자 삭제를 확인했습니다.",
    "cloud.signInBody": "기존 계정에 로그인하거나 새 계정을 만드세요. 지금 동기화를 선택할 때만 로컬 데이터가 업로드됩니다.",
    "cloud.emailPlaceholder": "이메일 주소",
    "cloud.passwordPlaceholder": "비밀번호",
    "cloud.signIn": "로그인",
    "cloud.createAccount": "계정 만들기",
    "cloud.accountSubmitted": "계정 요청을 보냈습니다. 확인이 필요하면 이메일을 확인한 뒤 로그인하세요.",
    "cloud.sendRecovery": "비밀번호 복구 이메일 보내기",
    "cloud.recoverySent": "복구 이메일을 요청했습니다. 지원되는 Auth 링크에서 새 비밀번호를 설정하세요.",
    "cloud.passwordRule": "새 비밀번호는 12자 이상이어야 합니다.",
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

    "home.bucket.reviewNow": "지금 검토",
    "home.bucket.forming": "형성 중",
    "home.bucket.reviewSoon": "곧 검토",

    "alerts.summary.open": "열림",
    "alerts.summary.groupedStocks": "묶인 종목",
    "alerts.summary.snoozed": "미루기",
    "alerts.summary.reviewed": "확인됨",
    "alerts.tab.current": "현재",
    "alerts.tab.history": "기록",
    "alerts.current.title": ({ count }: Record<string, string | number> = {}) => `현재 알림 · ${count ?? 0}`,
    "alerts.current.note": "같은 종목의 신호를 함께 볼 수 있도록 종목 기준으로 묶었습니다.",
    "alerts.current.empty": "지금 열려 있는 알림이 없습니다.",
    "alerts.cluster.next": "다음",
    "alerts.cluster.groupHint": "이 종목에 묶인 신호를 함께 검토하세요.",
    "alerts.history.title": ({ count }: Record<string, string | number> = {}) => `알림 기록 · ${count ?? 0}`,
    "alerts.history.note": "확인했거나 미뤄둔 알림을 다시 보고, 연결된 기록이 있으면 바로 열 수 있습니다.",
    "alerts.history.empty": "아직 알림 기록이 없습니다.",
    "alerts.history.acknowledged": "확인됨",
    "alerts.history.snoozedUntil": ({ date }: Record<string, string | number> = {}) => `${date ?? "알 수 없음"}까지 미룸`,
    "alerts.history.snoozedUnknown": "알 수 없음",
    "alerts.history.journalAction": ({ action }: Record<string, string | number> = {}) => `기록 · ${action ?? ""}`,
    "alerts.action.entered": "진입",
    "alerts.action.skip": "보류",
    "alerts.action.snooze": "미루기",
    "alerts.action.acknowledge": "확인",
    "alerts.action.unsnooze": "미루기 해제",
    "alerts.action.acknowledgeAll": "전체 확인",
    "alerts.action.snooze24h": "24시간 미루기",
    "alerts.action.useful": "유용함",
    "alerts.action.notUseful": "별도움 안 됨",
    "alerts.detail.whatHappened": "무슨 일이 있었나",
    "alerts.detail.priority": "우선순위",
    "alerts.detail.state": "상태",
    "alerts.detail.urgency": "긴급도",
    "alerts.detail.data": "데이터",
    "alerts.detail.biggestSupport": "가장 큰 근거",
    "alerts.detail.biggestRisk": "가장 큰 위험",
    "alerts.detail.noStrongSupport": "강한 근거는 아직 기록되지 않았습니다.",
    "alerts.detail.noMajorRisk": "큰 위험은 아직 기록되지 않았습니다.",
    "alerts.detail.reviewFast": "5초 요약",
    "alerts.detail.item.priority": ({ value }: Record<string, string | number> = {}) => `우선순위: ${value ?? ""}`,
    "alerts.detail.item.stateChange": ({ value }: Record<string, string | number> = {}) => `상태 변화: ${value ?? ""}`,
    "alerts.detail.open": "열림",

    "eyes.summary.active": "활성",
    "eyes.summary.inactive": "비활성",
    "eyes.summary.attention": "주의",
    "eyes.summary.broken": "논리 훼손",
    "eyes.filter.all": "전체",
    "eyes.filter.needsReview": "검토 필요",
    "eyes.filter.quiet": "조용함",
    "eyes.active.title": ({ count }: Record<string, string | number> = {}) => `활성 모니터 · ${count ?? 0}`,
    "eyes.active.note": "지금 계속 추적할 가치가 있는 레시피 구독입니다.",
    "eyes.active.empty": "아직 활성 모니터가 없습니다.",
    "eyes.inactive.title": ({ count }: Record<string, string | number> = {}) => `비활성 모니터 · ${count ?? 0}`,
    "eyes.inactive.note": "조용하거나 논리가 깨진 구독도 참고용으로 남겨 둡니다.",
    "eyes.inactive.empty": "아직 비활성 모니터가 없습니다.",
    "eyes.notEvaluated": "평가 전",
    "eyes.waiting": "다음 의미 있는 변화를 기다리는 중입니다.",
    "eyes.meta.wait": "대기",
    "eyes.meta.reviewDue": "검토 필요",
    "eyes.action.stock": "종목",
    "eyes.action.review": "검토",
    "eyes.action.detail": "상세",
    "eyes.detail.currentState": "현재 모니터 상태",
    "eyes.detail.noSummary": "이 모니터에는 아직 의미 있는 검토 요약이 없습니다.",
    "eyes.detail.unknownRecipe": "알 수 없는 레시피",
    "eyes.detail.urgency": "긴급도",
    "eyes.detail.review": "검토",
    "eyes.detail.entryLow": "계획 진입 하단",
    "eyes.detail.entryHigh": "계획 진입 상단",
    "eyes.detail.alerts": "알림",
    "eyes.detail.journal": "기록",
    "eyes.detail.unset": "미설정",
    "eyes.detail.due": "확인 필요",
    "eyes.detail.thesisSnapshot": "투자 논리 스냅샷",
    "eyes.detail.invalidationRule": "무효화 규칙",
    "eyes.detail.noInvalidation": "아직 기록된 무효화 규칙이 없습니다.",
    "eyes.detail.lastDecision": "최근 기록된 결정",
    "eyes.action.markReviewed": "검토 완료",
    "eyes.action.addJournal": "기록 추가",
    "eyes.action.delete": "삭제",
    "eyes.detail.unsetHorizon": "기간 미설정",
    "eyes.create.title": "모니터 만들기",
    "eyes.create.editTitle": "모니터 수정",
    "eyes.create.editSubtitle": "이 모니터의 종목, 레시피, 논리 스냅샷을 수정합니다.",
    "eyes.create.subtitle": "선택한 종목과 레시피를 연결하고 현재 투자 논리를 남기세요.",
    "eyes.create.stock": "종목",
    "eyes.create.recipe": "레시피",
    "eyes.create.selectStock": "종목을 선택하세요.",
    "eyes.create.selectRecipe": "레시피를 선택하세요.",
    "eyes.create.thesis": "구체적인 투자 논리 스냅샷",
    "eyes.create.thesisPlaceholder": "왜 이 종목이 이 레시피 아래에서 계속 볼 가치가 있는지 적어두세요.",
    "eyes.create.thesisRequired": "투자 논리 스냅샷은 반드시 입력해야 합니다.",
    "eyes.create.entryLow": "계획 진입 하단",
    "eyes.create.entryHigh": "계획 진입 상단",
    "eyes.create.entryLowPlaceholder": "진입 하단 (선택)",
    "eyes.create.entryHighPlaceholder": "진입 상단 (선택)",
    "eyes.create.lastReview": "최근 논리 검토 시점",
    "eyes.create.invalidation": "무효화 규칙",
    "eyes.create.invalidationPlaceholder": "무엇이 이 논리를 빠르게 깨뜨릴까요?",
    "eyes.create.submit": "모니터 만들기",

    "journal.summary.entries": "기록 수",
    "journal.summary.entered": "진입",
    "journal.summary.skipped": "보류",
    "journal.summary.pendingOutcomes": "결과 대기",
    "journal.filter.all": "전체",
    "journal.filter.entered": "진입",
    "journal.filter.skipped": "보류",
    "journal.filter.risky": "위험",
    "journal.empty": "이 필터에는 아직 기록이 없습니다.",
    "journal.meta.noState": "상태 스냅샷 없음",
    "journal.meta.noData": "데이터 품질 메모 없음",
    "journal.meta.thesis": ({ value }: Record<string, string | number> = {}) => `논리 ${value ?? ""}`,
    "journal.meta.concern": ({ value }: Record<string, string | number> = {}) => `우려: ${value ?? "기록 없음"}`,
    "journal.meta.notCaptured": "기록 없음",
    "journal.action.save": "결정 저장",
    "journal.action.edit": "수정",
    "journal.action.archive": "결정 보관",
    "journal.action.open": "열기",
    "journal.action.alert": "알림",
    "journal.action.markOutcome": "결과 표시",
    "journal.action.outcomeDone": "결과 확인 완료",
    "journal.composer.title": "새 기록 추가",
    "journal.composer.subtitle": "원할 때만 직접 결정 기록을 남기세요.",
    "journal.composer.eye": "모니터",
    "journal.composer.selectEye": "모니터를 선택하세요.",
    "journal.composer.action": "행동",
    "journal.composer.why": "왜 이렇게 행동했나요?",
    "journal.composer.notePlaceholder": "왜 진입했고, 보류했고, 수정했는지 적어두세요.",
    "journal.composer.noteRequired": "결정 메모는 반드시 입력해야 합니다.",
    "journal.composer.concern": "주요 우려",
    "journal.composer.concernPlaceholder": "가장 크게 본 위험은 무엇이었나요?",
    "journal.composer.thesisValidity": "논리 유효성",
    "journal.composer.timing": "타이밍",
    "journal.composer.searchPlaceholder": "모니터 중인 종목 검색...",
    "journal.validation.thesisRequired": "투자 논리 평가를 선택하세요.",
    "journal.validation.timingRequired": "타이밍 평가를 선택하세요.",
    "journal.outcome.title": "결과 검토",
    "journal.outcome.body": "관찰한 내용과 출처를 기록하세요. 이 메모는 원래 결정 근거와 별도로 보존됩니다.",
    "journal.outcome.reviewWindow": "검토 기간",
    "journal.outcome.priceChange": "가격 변화와 출처",
    "journal.outcome.maxRunup": "최대 상승폭과 출처",
    "journal.outcome.maxDrawdown": "최대 하락폭과 출처",
    "journal.outcome.lesson": "무엇을 배웠나요?",
    "journal.outcome.recipeSuggestion": "다음에는 무엇을 바꿀까요?",
    "journal.outcome.save": "결과 검토 저장",
    "journal.outcome.saved": "결과 검토가 저장되었습니다.",
    "journal.detail.context": "결정 맥락",
    "journal.detail.noState": "상태 스냅샷이 없습니다",
    "journal.detail.noData": "데이터 품질 메모가 없습니다",
    "journal.detail.thesisTiming": ({ thesis, timing }: Record<string, string | number> = {}) => `논리 ${thesis ?? ""} · 타이밍 ${timing ?? ""}`,
    "journal.detail.note": "결정 메모",
    "journal.detail.noNote": "기록된 결정 메모가 없습니다.",
    "journal.detail.concern": "우려 사항",
    "journal.detail.noConcern": "기록된 핵심 우려가 없습니다.",
    "journal.detail.outcome": ({ status }: Record<string, string | number> = {}) => `결과 · ${status ?? "Pending"}`,
    "journal.detail.previousVersions": "이전에 작성한 버전",

    "recipes.summary.recipes": "레시피",
    "recipes.summary.starter": "스타터",
    "recipes.summary.custom": "사용자",
    "recipes.summary.activeEyes": "활성 모니터",
    "recipes.filter.all": "전체",
    "recipes.filter.starter": "스타터",
    "recipes.filter.custom": "사용자",
    "recipes.filter.recent": "최근",
    "recipes.card.version": ({ version }: Record<string, string | number> = {}) => `버전 ${version ?? ""}`,
    "recipes.card.eyes": ({ count }: Record<string, string | number> = {}) => `${count ?? 0}개 모니터`,
    "recipes.card.type": "유형",
    "recipes.card.horizon": "기간",
    "recipes.card.cadence": "검토 주기",
    "recipes.card.conditions": "조건 수",
    "recipes.card.useCasePending": "활용 목적 미정",
    "recipes.card.open": "열기",
    "recipes.card.useForEye": "모니터에 적용",
    "recipes.builder.title": "레시피 만들기",
    "recipes.builder.subtitle": "필수 항목을 채우고 단계별로 이동한 뒤 저장 전에 미리 확인하세요.",
    "recipes.builder.step.Purpose": "목적",
    "recipes.builder.step.Logic": "논리",
    "recipes.builder.step.Risk & Alerts": "위험 · 알림",
    "recipes.builder.step.Review & Outcome": "검토 · 결과",
    "recipes.builder.prompt.Purpose": "이 레시피가 어떤 기회를 포착하려는지 먼저 정하세요.",
    "recipes.builder.prompt.Logic": "투자 논리를 실제 조건으로 구체화하세요.",
    "recipes.builder.prompt.Risk & Alerts": "강등 규칙과 알림 방식을 정리하세요.",
    "recipes.builder.prompt.Review & Outcome": "검토 주기를 정하고 종목에 미리 적용해 보세요.",
    "recipes.builder.stat.conditions": "조건",
    "recipes.builder.stat.riskRules": "위험 규칙",
    "recipes.builder.stat.cadence": "검토 주기",
    "recipes.builder.stat.cooldown": "알림 간격",
    "recipes.builder.ready": "준비됨",
    "recipes.builder.needsInput": "입력 필요",
    "recipes.builder.field.recipeName": "레시피 이름",
    "recipes.builder.field.opportunityType": "기회 유형",
    "recipes.builder.field.timeHorizon": "시간 범위",
    "recipes.builder.field.primaryUseCase": "주요 활용 방식",
    "recipes.builder.field.purpose": "목적",
    "recipes.builder.field.category": "범주",
    "recipes.builder.field.template": "템플릿",
    "recipes.builder.field.conditionRole": "조건 역할",
    "recipes.builder.field.operator": "비교 방식",
    "recipes.builder.field.threshold": "기준값 / 파라미터",
    "recipes.builder.field.whyMatters": "왜 중요한가",
    "recipes.builder.field.alertCooldown": "알림 간격",
    "recipes.builder.field.notes": "메모",
    "recipes.builder.field.reviewCadence": "검토 주기",
    "recipes.builder.field.previewStock": "미리 볼 종목",
    "recipes.builder.placeholder.recipeName": "일시적 과매도 기회",
    "recipes.builder.placeholder.purpose": "이 논리가 어떤 기회를 찾아야 하나요?",
    "recipes.builder.placeholder.notes": "강등 규칙, 차단 조건, 알림 기준을 적어두세요",
    "recipes.builder.placeholder.whyMatters": "미래의 나를 위한 선택 메모",
    "recipes.builder.preview.condition": "조건 미리보기",
    "recipes.builder.preview.result": "초안 결과",
    "recipes.builder.preview.disclosure": "미리보기는 어댑터 방식의 샘플 데이터를 사용하며, 더미 여부를 명확히 표시합니다.",
    "recipes.builder.preview.locked": "미리보기를 보려면 먼저 초안 조건을 추가하세요.",
    "recipes.builder.summary.title": "저장 준비 완료",
    "recipes.builder.summary.body":
      ({ name, opportunityType, count, cadence, cooldown }: Record<string, string | number> = {}) =>
        `${name ?? "이름 없는 레시피"}는 ${opportunityType ?? "이 기회"}용으로 설정되어 있으며, 조건 ${count ?? 0}개, ${cadence ?? 0}일 검토 주기, ${cooldown ?? 0}시간 알림 간격을 사용합니다.`,
    "recipes.builder.summary.meta":
      "지표 나열이 아니라 분명한 투자 규칙처럼 읽힐 때만 저장하세요.",
    "recipes.builder.action.addCondition": "조건 추가",
    "recipes.builder.action.clearDraft": "초안 비우기",
    "recipes.builder.action.remove": "삭제",
    "recipes.builder.action.back": "이전",
    "recipes.builder.action.next": "다음",
    "recipes.builder.action.save": "레시피 저장",
    "recipes.builder.validation.recipeNameRequired": "레시피 이름은 반드시 입력해야 합니다.",
    "recipes.builder.validation.purposeRequired": "목적은 반드시 입력해야 합니다.",
    "recipes.builder.validation.conditionRequired": "조건을 최소 1개 추가하세요.",
    "recipes.detail.type": "유형",
    "recipes.detail.useCase": "활용 방식",
    "recipes.detail.cadence": "검토 주기",
    "recipes.detail.cooldown": "알림 간격",
    "recipes.detail.eyes": "모니터",
    "recipes.detail.stocks": "종목",
    "recipes.detail.unset": "미설정",
    "recipes.detail.general": "일반",
    "recipes.detail.starter": "스타터",
    "recipes.detail.custom": "사용자",
    "recipes.detail.conditions": ({ count }: Record<string, string | number> = {}) => `조건 ${count ?? 0}개`,
    "recipes.detail.hasNotes": "메모 있음",
    "recipes.detail.trackedStocks": "추적 중인 종목",
    "recipes.detail.useForEye": "모니터에 적용",
    "recipes.detail.openBuilder": "빌더 열기",
    "recipes.detail.builderNotes": "빌더 메모",

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
    "stocks.search.openStock": ({ symbol, name }: Record<string, string | number> = {}) => `${symbol ?? "종목"} ${name ?? ""} 열기`,
    "stocks.search.showMore": ({ count }: Record<string, string | number> = {}) => `종목 더 보기 (${count ?? 0}개 남음)`,
    "stocks.action.add": "종목 추가",
    "stocks.action.manageEyes": "모니터 관리",
    "stocks.editor.addTitle": "관심 종목에 추가",
    "stocks.editor.editTitle": "종목 수정",
    "stocks.editor.ticker": "티커",
    "stocks.editor.tickerPlaceholder": "티커, 예: AAPL",
    "stocks.editor.companyName": "회사명",
    "stocks.editor.companyNamePlaceholder": "회사명",
    "stocks.editor.thesis": "지켜보는 이유",
    "stocks.editor.thesisPlaceholder": "투자 논리와 생각이 바뀌는 조건",
    "stocks.editor.save": "종목 저장",

    "stocks.data.dummyBacked": "더미 데이터",
    "stocks.data.providerBacked": "실데이터 연동",
    "stocks.data.dummy": "더미",
    "stocks.data.provider": "실데이터",
    "stocks.data.manual": "수동 입력",
    "stocks.data.noData": "데이터 없음",

    "stocks.hero.vs": ({ benchmark }: Record<string, string | number> = {}) => `${benchmark ?? "벤치마크"} 대비`,
    "stocks.hero.drawdown": ({ value }: Record<string, string | number> = {}) => `고점 대비 ${value ?? "N/A"}`,
    "stocks.hero.selectObservation": ({ index }: Record<string, string | number> = {}) => `${index ?? ""}번째 차트 관찰값 선택`,
    "stocks.hero.noCompletedHistory": "완료된 가격 이력이 없습니다",
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
    "stocks.detail.selectPoint": ({ index }: Record<string, string | number> = {}) => `${index ?? ""}번째 차트 지점 선택`,
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
    "stocks.visual.active": "현재 활성",
    "stocks.visual.inactive": "현재 비활성",
    "stocks.visual.eventTiming": "이벤트 시점",
    "stocks.visual.eventRiskClose": "이벤트 위험이 가까워 새 검토가 필요합니다.",
    "stocks.visual.noEventPressure": "가까운 기간에는 큰 이벤트 압박이 없습니다.",
    "stocks.visual.trend": "추세",
    "stocks.visual.need": "기준",
    "stocks.visual.context": "참고값",
    "stocks.evidence.noInputs": "기록된 입력값 없음",
    "alerts.detail.evidenceRecorded": "이 알림에 기록된 근거",
    "alerts.detail.olderEvidence": "이전 앱 버전에서는 상세 근거가 기록되지 않았습니다. 원래 알림 요약은 위에 보존되어 있습니다.",
  },
};

export const getMissingTranslationKeys = () => ({
  en: Object.keys(dict.ko).filter((key) => !(key in dict.en)),
  ko: Object.keys(dict.en).filter((key) => !(key in dict.ko)),
});

export const hasTranslation = (language: AppLanguage, key: string) => key in dict[language] || key in dict.en;

export const t = (
  language: AppLanguage,
  key: string,
  vars?: Record<string, string | number>,
) => {
  const entry = dict[language]?.[key] ?? dict.en[key] ?? key;
  return typeof entry === "function" ? entry(vars) : entry;
};

export const formatLocaleNumber = (
  language: AppLanguage,
  value: number,
  options: Intl.NumberFormatOptions = {},
) => new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US", options).format(value);

export const formatLocaleDate = (language: AppLanguage, value: string) => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const formatLocaleDateTime = (language: AppLanguage, value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

export const localizedEyeState = (language: AppLanguage, state?: string | null) => {
  if (!state) return language === "ko" ? "미추적" : "Unwatched";
  if (language === "en") return state;
  switch (state) {
    case "Not Relevant":
      return "해당 없음";
    case "Becoming Interesting":
      return "관심 증가";
    case "Watch Closely":
      return "가까이 보기";
    case "Opportunity Zone Forming":
      return "기회 구간 형성";
    case "Attention Needed":
      return "즉시 검토";
    case "Thesis Risk Rising":
      return "논리 위험 상승";
    case "Thesis Broken":
      return "논리 훼손";
    default:
      return state;
  }
};

export const localizedMetricAvailability = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "automated":
      return language === "ko" ? "자동" : "Automated";
    case "manual":
      return language === "ko" ? "수동" : "Manual";
    case "future":
      return language === "ko" ? "보류" : "Future";
    default:
      return value;
  }
};

export const localizedConditionRole = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Eligibility Filter":
      return language === "ko" ? "적격 필터" : "Eligibility Filter";
    case "Supporting Evidence":
      return language === "ko" ? "보강 근거" : "Supporting Evidence";
    case "Timing Trigger":
      return language === "ko" ? "타이밍 트리거" : "Timing Trigger";
    case "Risk Warning":
      return language === "ko" ? "위험 경고" : "Risk Warning";
    case "Hard Disqualifier":
      return language === "ko" ? "강한 제외 조건" : "Hard Disqualifier";
    case "Review Trigger":
      return language === "ko" ? "검토 트리거" : "Review Trigger";
    case "Outcome Learning Tag":
      return language === "ko" ? "성과 학습 태그" : "Outcome Learning Tag";
    default:
      return value;
  }
};

export const localizedDecisionAction = (language: AppLanguage, action?: string | null) => {
  if (!action) return language === "ko" ? "기록 없음" : "Not recorded";
  if (language === "en") return action;
  switch (action) {
    case "Entered":
      return "진입";
    case "Skipped":
      return "보류";
    case "Snoozed":
      return "미루기";
    case "Revised":
      return "수정";
    case "Rejected":
      return "기각";
    case "Marked Thesis Broken":
      return "논리 훼손 표시";
    default:
      return action;
  }
};

export const localizedRecipeShelfFilter = (language: AppLanguage, filter: string) =>
  t(language, `recipes.filter.${filter}`);

export const localizedRecipeBuilderStep = (language: AppLanguage, step: string) =>
  t(language, `recipes.builder.step.${step}`);

export const localizedRecipeBuilderPrompt = (language: AppLanguage, step: string) =>
  t(language, `recipes.builder.prompt.${step}`);

export const localizedOpportunityType = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Temporary Mispricing":
      return "일시적 가격 왜곡";
    case "Leader Pullback":
      return "주도주 눌림";
    case "Recovery Setup":
      return "회복 구도";
    case "Event Reset":
      return "이벤트 리셋";
    case "Risk Monitoring":
      return "위험 모니터링";
    default:
      return value;
  }
};

export const localizedTimeHorizon = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "1 to 2 weeks":
      return "1~2주";
    case "1 to 3 months":
      return "1~3개월";
    case "3 to 12 months":
      return "3~12개월";
    case "Multi-year":
      return "장기";
    default:
      return value;
  }
};

export const localizedUseCase = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Watchlist Triage":
      return "관심 종목 분류";
    case "Position Building":
      return "비중 구축";
    case "Post-Earnings Review":
      return "실적 후 재검토";
    case "Thesis Protection":
      return "투자 논리 방어";
    default:
      return value;
  }
};

export const localizedConditionKind = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "required":
      return "필수";
    case "supporting":
      return "보강";
    case "negative":
      return "위험";
    case "disqualifier":
      return "차단";
    default:
      return value;
  }
};

export const localizedConditionCategory = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Technical":
      return "기술적";
    case "Valuation":
      return "밸류에이션";
    case "Business Quality":
      return "사업 퀄리티";
    case "News":
      return "뉴스";
    case "Macro":
      return "거시환경";
    case "Risk":
      return "위험";
    case "Sentiment":
      return "심리";
    default:
      return value;
  }
};

export const localizedTemplateComplexity = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Simple":
      return "기본";
    case "Layered":
      return "중간";
    case "Advanced":
      return "고급";
    default:
      return value;
  }
};

export const localizedTemplateTitle = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Price drawdown from high":
      return "고점 대비 하락폭";
    case "Prior support is holding":
      return "이전 지지선 유지";
    case "Moving average recovery":
      return "이동평균 회복";
    case "Valuation discount vs history":
      return "과거 대비 밸류 할인";
    case "Revenue stability":
      return "매출 안정성";
    case "Margin deterioration":
      return "마진 악화";
    case "Negative news cluster":
      return "부정 뉴스 군집";
    case "Earnings proximity":
      return "실적 발표 임박";
    case "Broad market stress":
      return "시장 전반 스트레스";
    case "Debt stress":
      return "부채 부담";
    case "Management credibility damage":
      return "경영진 신뢰 훼손";
    case "Analyst revision trend":
      return "애널리스트 추정치 흐름";
    default:
      return value;
  }
};

export const localizedTemplateDescription = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Require a meaningful discount from the recent high before attention rises.":
      return "최근 고점에서 충분히 밀렸을 때만 관심이 높아지도록 설정합니다.";
    case "Look for price behavior that is stabilizing around a prior support zone.":
      return "이전 지지 구간 부근에서 가격이 안정되는지 확인합니다.";
    case "Capture a reclaim or hold above an important moving average.":
      return "중요한 이동평균선을 다시 회복하거나 지키는 흐름을 포착합니다.";
    case "Express when the stock looks attractively priced versus its own recent baseline.":
      return "최근 자기 기준 대비 가격 매력이 생겼는지 표현합니다.";
    case "Avoid bargain setups where the business is already deteriorating.":
      return "사업 자체가 이미 나빠지는 종목은 바겐형 기회에서 제외합니다.";
    case "Track when profitability weakens enough to matter to the thesis.":
      return "수익성이 투자 논리에 영향을 줄 정도로 약해지는지 추적합니다.";
    case "Group repeated headlines around legal, product, or demand issues.":
      return "법적, 제품, 수요 이슈처럼 반복되는 부정 헤드라인을 묶어 봅니다.";
    case "Account for the added uncertainty of an upcoming earnings event.":
      return "다가오는 실적 발표가 만드는 추가 불확실성을 반영합니다.";
    case "Adapt recipe behavior when the wider market is under pressure.":
      return "시장 전반이 약할 때 레시피의 판단을 조정합니다.";
    case "Hard-stop the setup if leverage or refinancing risk becomes too severe.":
      return "레버리지나 차환 위험이 심해지면 구도를 바로 차단합니다.";
    case "Represent when trust in management falls enough to break the thesis.":
      return "경영진 신뢰가 논리를 깨뜨릴 만큼 훼손됐는지 반영합니다.";
    case "Track whether revisions are improving, flat, or weakening.":
      return "추정치 수정 흐름이 개선인지, 보합인지, 악화인지 추적합니다.";
    default:
      return value;
  }
};

export const localizedTemplateMetricLabel = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "drawdown %":
      return "하락폭 %";
    case "support zone":
      return "지지 구간";
    case "moving average":
      return "이동평균";
    case "valuation gap":
      return "밸류 차이";
    case "revenue trend":
      return "매출 흐름";
    case "margin trend":
      return "마진 흐름";
    case "headline cluster":
      return "헤드라인 군집";
    case "days to earnings":
      return "실적까지 남은 일수";
    case "market regime":
      return "시장 환경";
    case "debt coverage":
      return "부채 부담";
    case "credibility event":
      return "신뢰 훼손 이벤트";
    case "revision trend":
      return "추정치 흐름";
    default:
      return value;
  }
};

export const localizedRecipeOptionValue = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "true":
      return "예";
    case "false":
      return "아니오";
    case "low":
      return "낮음";
    case "medium":
      return "보통";
    case "high":
      return "높음";
    case "improving":
      return "개선";
    case "flat":
      return "보합";
    case "weak":
      return "약화";
    case "accounting issue":
      return "회계 이슈";
    case "regulatory risk":
      return "규제 리스크";
    case "guidance cut":
      return "가이던스 하향";
    case "management credibility damage":
      return "경영진 신뢰 훼손";
    case "severe dilution risk":
      return "심한 희석 위험";
    default:
      return value;
  }
};

export const localizedAlertPriority = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "High":
      return "높음";
    case "Medium":
      return "보통";
    case "Low":
      return "낮음";
    default:
      return value;
  }
};

export const localizedAlertUsefulness = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Useful":
      return "유용함";
    case "Not Useful":
      return "별도움 안 됨";
    default:
      return value;
  }
};

export const localizedEyesShelfFilter = (language: AppLanguage, filter: string) => {
  switch (filter) {
    case "All":
      return t(language, "eyes.filter.all");
    case "Needs Review":
      return t(language, "eyes.filter.needsReview");
    case "Quiet":
      return t(language, "eyes.filter.quiet");
    default:
      return filter;
  }
};

export const localizedActionUrgency = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Wait":
      return "대기";
    case "Watch":
      return "관찰";
    case "Review Soon":
      return "곧 검토";
    case "Attention Needed":
      return "즉시 확인";
    default:
      return value;
  }
};

export const localizedReviewDateOption = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Today":
      return "오늘";
    default:
      return value;
  }
};

export const localizedJournalFilter = (language: AppLanguage, filter: string) => {
  switch (filter) {
    case "All":
      return t(language, "journal.filter.all");
    case "Entered":
      return t(language, "journal.filter.entered");
    case "Skipped":
      return t(language, "journal.filter.skipped");
    case "Risky":
      return t(language, "journal.filter.risky");
    default:
      return filter;
  }
};

export const localizedThesisValidity = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Yes":
      return "유지";
    case "Partly":
      return "일부만 유지";
    case "No":
      return "훼손";
    default:
      return value;
  }
};

export const localizedTiming = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Early":
      return "이른 편";
    case "On Time":
      return "적절";
    case "Late":
      return "늦음";
    default:
      return value;
  }
};

export const localizedOutcomeStatus = (language: AppLanguage, value?: string | null) => {
  if (!value || language === "en") return value ?? "";
  switch (value) {
    case "Pending":
      return "대기";
    case "Reviewed":
      return "검토 완료";
    default:
      return value;
  }
};

export const localizedSetupStrength = (language: AppLanguage, value?: string | null) => {
  if (!value) return "";
  if (language === "en") return value;
  switch (value) {
    case "High":
      return t(language, "review.setupHigh");
    case "Medium":
      return t(language, "review.setupMedium");
    case "Low":
      return t(language, "review.setupLow");
    default:
      return value;
  }
};

export const localizedScannerStatus = (language: AppLanguage, status?: string | null) => {
  switch (status) {
    case "MATCHED":
      return t(language, "logic.scanner.matched");
    case "NEAR_MATCH":
      return t(language, "logic.scanner.near");
    case "BLOCKED":
    case "BLOCKED_OR_INCOMPLETE_DATA":
      return t(language, "logic.scanner.blocked");
    case "FAILED":
      return t(language, "review.failed");
    default:
      return status ?? "";
  }
};

export const localizedScanRunStatus = (language: AppLanguage, status?: string | null) => {
  switch (status) {
    case "completed":
      return t(language, "logic.scanner.runStatus.completed");
    case "blocked":
      return t(language, "logic.scanner.runStatus.blocked");
    case "partial":
      return t(language, "logic.scanner.runStatus.partial");
    default:
      return status ?? "";
  }
};

export const localizedScannerDescription = (language: AppLanguage, status?: string | null) => {
  switch (status) {
    case "MATCHED":
      return t(language, "logic.scanner.matchedBody");
    case "NEAR_MATCH":
      return t(language, "logic.scanner.nearBody");
    case "BLOCKED":
    case "BLOCKED_OR_INCOMPLETE_DATA":
      return t(language, "logic.scanner.blockedBody");
    default:
      return "";
  }
};

export const recipeConditionMapCopy = (language: AppLanguage) => ({
  passed: t(language, "review.passed"),
  failed: t(language, "review.failed"),
  warnings: t(language, "review.warnings"),
  blockers: t(language, "review.blockers"),
  support: t(language, "review.support"),
  risks: t(language, "review.risks"),
  state: (value: string) => t(language, "review.state", { value }),
  stateChanged: t(language, "review.changed"),
  stateStable: t(language, "review.stable"),
  urgency: (value: string) => t(language, "review.urgency", { value: localizedActionUrgency(language, value) }),
  nextTrigger: (value: string) => t(language, "review.nextTrigger", { value }),
  dataIssues: (value: string) => t(language, "review.dataIssues", { value }),
  showMatrix: t(language, "review.showMatrix"),
  hideMatrix: t(language, "review.hideMatrix"),
  condition: t(language, "review.condition"),
});
