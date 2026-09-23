import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = "/Users/haewonkim/.codex-fabric/runs/stockledger/stockledger-prod-c16-authoring-config-lawbook-v1/visual-atlas";
const repo = "/Users/haewonkim/.codex-fabric/worktrees/CF-bcf7ed56e73e87dc270f0ddf";
const diagnostics = join(root, "diagnostics");
const captureScripts = join(diagnostics, "capture-scripts");
const candidate = "48aef5d8be21e83a95d299a78da7ab61557006ec";
const tree = "3c71b82219068c3aec4e620e19f786ae50a580f2";
const base = "40e035da9940805a2971b1006488007dcef665e0";
const baseURL = "http://127.0.0.1:43187";
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJSON = async (name, value) => writeFile(join(root, name), `${JSON.stringify(value, null, 2)}\n`);
const writeDiagnostic = async (name, value) => writeFile(join(diagnostics, name), `${JSON.stringify(value, null, 2)}\n`);

await mkdir(diagnostics, { recursive: true });
await mkdir(captureScripts, { recursive: true });
for (const file of ["capture-canonical.mjs", "capture-state-evidence.mjs"]) {
  const from = join(root, file);
  const to = join(captureScripts, file);
  try { await rename(from, to); } catch (cause) { if (cause.code !== "ENOENT") throw cause; }
}
for (const file of ["capture-metrics.json", "state-evidence.json"]) {
  const from = join(root, file);
  const to = join(diagnostics, file);
  try { await rename(from, to); } catch (cause) { if (cause.code !== "ENOENT") throw cause; }
}

const metrics = await readJSON(join(diagnostics, "capture-metrics.json"));
const stateEvidence = await readJSON(join(diagnostics, "state-evidence.json"));
if (metrics.candidate !== candidate || metrics.tree !== tree || stateEvidence.candidate !== candidate || stateEvidence.tree !== tree) throw new Error("Capture candidate identity does not match the final Product candidate.");
if (metrics.captures.length !== 50 || stateEvidence.states.length !== 16) throw new Error(`Unexpected capture count: ${metrics.captures.length} responsive, ${stateEvidence.states.length} state.`);

const surfaceTasks = {
  "eye-composer": { state: "open", task: "Choose a stock, recipe, and thesis; optionally record range, invalidation, and last-review context; save or amend monitoring intent deliberately." },
  "journal-composer": { state: "open", task: "Link an Eye, choose the recorded action, explain why, assess thesis validity and timing, then save or amend the human decision." },
  "recipe-builder": { state: "open", task: "Define monitoring purpose, supported logic, risk and review rules, inspect the result, then save a version deliberately." },
  "logic-registry": { state: "ready", task: "Inspect raw field identifiers, human meaning, importance, declared source and coverage, and downstream processing." },
  "notification-confirmation": { state: "confirmation", task: "Understand the saved preference change, then cancel or confirm disabling notification delivery." },
};
const viewportDefs = {
  "desktop-1440x900": { width: 1440, height: 900, view: "desktop", profile: "canonical" },
  "mobile-390x844": { width: 390, height: 844, view: "mobile", profile: "canonical" },
  "desktop-1366x768": { width: 1366, height: 768, view: "desktop", profile: "stress" },
  "mobile-360x800": { width: 360, height: 800, view: "mobile", profile: "stress" },
  "mobile-412x915": { width: 412, height: 915, view: "mobile", profile: "holdout" },
};
const canonicalKey = (surface, state, viewport) => `stockledger|surface:${surface}|canonical|${state}|reference-user|light|${viewport}`;
const canonicalCaptures = [];
const localeVariants = [];
const responsiveCaptures = [];
for (const capture of metrics.captures) {
  const viewportInfo = viewportDefs[capture.viewport];
  if (!viewportInfo) throw new Error(`Unrecognized viewport ${capture.viewport}`);
  const filePath = join(root, capture.path);
  const bytes = await readFile(filePath);
  if (bytes.length !== capture.bytes || sha256(bytes) !== capture.sha256) throw new Error(`Capture digest mismatch: ${capture.path}`);
  if (capture.metrics.horizontalOverflowPx !== 0) throw new Error(`Horizontal overflow in capture ${capture.path}`);
  const common = { surface: capture.surface, locale: capture.locale, viewport: capture.viewport, width: viewportInfo.width, height: viewportInfo.height, path: capture.path, sha256: capture.sha256, bytes: capture.bytes, metrics: capture.metrics };
  if (viewportInfo.profile === "canonical") {
    const state = surfaceTasks[capture.surface].state;
    const key = canonicalKey(capture.surface, state, capture.viewport);
    const record = { ...common, key, state, classification: "canonical" };
    if (capture.locale === "en") canonicalCaptures.push(record);
    else localeVariants.push({ ...record, canonicalKey: key });
  } else {
    responsiveCaptures.push({ ...common, state: surfaceTasks[capture.surface].state, classification: viewportInfo.profile });
  }
}
if (canonicalCaptures.length !== 10 || localeVariants.length !== 10 || responsiveCaptures.length !== 30) throw new Error("Canonical/localized/stress capture counts do not match the scope.");

const logicalSurfaces = Object.entries(surfaceTasks).map(([name, spec]) => ({
  name,
  canonicalState: spec.state,
  primaryTask: spec.task,
  canonicalAnchors: ["desktop-1440x900", "mobile-390x844"].map(viewport => canonicalKey(name, spec.state, viewport)),
}));
const manifest = {
  project: "stockledger",
  change: "CHG-199",
  request: "stockledger-prod-c16-authoring-config-lawbook-v1",
  operation: "BUILD",
  candidate: { commit: candidate, tree, base },
  visualAuthority: {
    primaryUi: "CHG-143 shell + Today; CHG-172 primary surfaces; CHG-184 deep review/detail surfaces; AR-61 primary atlas + AR-64 deep review/detail atlas",
    lawbook: "Project OS Golden UI Engineering Lawbook v2 + Human-Centered UI Excellence Pillar + StockLedger Product Contract",
  },
  logicalSurfaces,
  canonicalAnchors: canonicalCaptures.map(record => ({ key: record.key, surface: record.surface, state: record.state, viewport: record.viewport, locale: "en", theme: "light", path: record.path, sha256: record.sha256 })),
  localizedCanonicalVariants: localeVariants.map(record => ({ key: record.canonicalKey, surface: record.surface, state: record.state, viewport: record.viewport, locale: "ko", theme: "light", path: record.path, sha256: record.sha256 })),
  responsiveProfiles: { canonical: ["desktop-1440x900", "mobile-390x844"], stress: ["desktop-1366x768", "mobile-360x800"], holdout: ["mobile-412x915"] },
  visualDecision: "AWAITING_INDEPENDENT_PIXEL_AUDIT",
  independentAcceptance: false,
  zoom200Evidence: "SEPARATE_GATE_NOT_PART_OF_THIS_BUILD",
};
await writeJSON("surface-manifest.json", manifest);

const report = {
  contractVersion: "stockledger-golden-ui-v2-capture-report-v1",
  candidate: { commit: candidate, tree, base, workingTree: "clean" },
  result: "PASS_OBJECTIVE_CAPTURE_CHECKS",
  visualDecision: "AWAITING_INDEPENDENT_PIXEL_AUDIT",
  counts: { canonicalEn: canonicalCaptures.length, canonicalKo: localeVariants.length, stressAndHoldout: responsiveCaptures.length, stateEvidence: stateEvidence.states.length },
  runtime: { source: "static dist exported from the exact candidate", browser: "Playwright Chromium", colorScheme: "light", reducedMotion: "reduce", screenshotFormat: "lossless PNG", deviceScaleFactor: 1 },
  profiles: Object.entries(viewportDefs).map(([name, value]) => ({ name, ...value })),
  objectiveChecks: {
    exactCandidate: true,
    candidateTreeMatch: true,
    horizontalOverflow: "none across 50 canonical/responsive captures or 16 state captures",
    dialogViewportBounds: "all captured surface dialogs remain inside the configured viewport",
    exactUserAuthoredText: "covered by Eye and Journal create/edit task oracles",
    keyboardPaths: "full Playwright suite; mobile hardware-keyboard project is intentionally skipped by existing device profile",
    reducedMotion: "reduced-motion preference enabled for Playwright and atlas captures",
    screenReaderCertification: "not claimed",
    zoom200: "not evaluated; separate evidence gate",
  },
  captures: [...canonicalCaptures, ...localeVariants, ...responsiveCaptures],
  stateEvidence: stateEvidence.states,
  sharedImpact: "WindowPanel adds closeDisabled and closeAfterCommit controls for persistence-in-flight confirmation; focus, Escape, return focus, inertness, safe area, and reduced motion regression suite passed.",
  independentPixelAudit: "required; Fabric did not self-accept visual craft",
};
await writeJSON("capture-report.json", report);

const readerIndex = {
  project: "stockledger",
  change: "CHG-199",
  candidate,
  status: "AWAITING_INDEPENDENT_PIXEL_AUDIT",
  surfaces: logicalSurfaces.map(surface => ({
    ...surface,
    canonicalEn: canonicalCaptures.filter(capture => capture.surface === surface.name).map(capture => capture.path),
    canonicalKo: localeVariants.filter(capture => capture.surface === surface.name).map(capture => capture.path),
    responsive: responsiveCaptures.filter(capture => capture.surface === surface.name).map(capture => capture.path),
  })),
  stateEvidence: stateEvidence.states.map(state => ({ name: state.name, path: state.path, note: state.note })),
  diagnostics: ["diagnostics/release-qualification.json", "diagnostics/release-evidence.json", "diagnostics/release-verify.json", "diagnostics/task-oracle-state-coverage.json", "diagnostics/source-impact-analysis.json", "diagnostics/primary-route-regression.json", "diagnostics/deep-review-regression.json", "diagnostics/operations-qualification.json", "diagnostics/operations-status.json", "diagnostics/recovery-drill.json", "diagnostics/frozen-research-status.json", "diagnostics/cloud-contract-status.json"],
  reviews: ["review-desktop.pdf", "review-mobile.pdf"],
};
await writeJSON("reader-index.json", readerIndex);

const productChangedFiles = execFileSync("git", ["diff", "--name-only", `${base}...${candidate}`], { cwd: repo, encoding: "utf8" }).trim().split("\n").filter(Boolean);
if (productChangedFiles.length !== 14) throw new Error(`Unexpected Product changed-file count: ${productChangedFiles.length}`);
const sourceImpact = {
  candidate: { commit: candidate, tree, base },
  productCommitCount: 1,
  productChangedFiles: productChangedFiles.length,
  changedPaths: productChangedFiles,
  featureOwnership: {
    eyeComposer: "moved to src/features/eyes/EyeComposer.tsx; StockLedgerApp now retains draft/action orchestration",
    journalComposer: "moved to src/features/journal/JournalComposer.tsx; authored amendment/history semantics remain in domain orchestration",
    recipeBuilder: "moved to src/features/recipes/builder/RecipeBuilder.tsx; current Recipe/Condition model and version semantics remain unchanged",
    logicRegistry: "migrated from src/components/logic/L0DataLayer.tsx to src/features/recipes/logic/RawDataRegistry.tsx; no injected legacy component props",
    notificationConfirmation: "retained in NotificationSettingsPanel; only pending/success/error retry presentation and success-only close are refined",
  },
  architectureChecks: {
    newFeatureModulesImportLegacyStyles: false,
    newFeatureModulesImportComponentsCommon: false,
    rawDataRegistryAcceptsInjectedLegacyComponents: false,
    stockLedgerAppOwnsAuthoringOrchestration: true,
    financialCalculationsOrDomainTransitionsChanged: false,
    persistenceSchemaOrProviderWorkerContractChanged: false,
  },
  sharedPrimitiveImpact: {
    windowPanel: "bounded closeDisabled and closeAfterCommit support for a confirmation whose save is in flight; existing focus/Escape/inert/safe-area/reduced-motion behavior exercised by release browser suite",
    primaryRouteRegression: "PASS",
    deepReviewDetailRegression: "PASS, including metric layout and Korean generated-system localization",
  },
};
await writeDiagnostic("source-impact-analysis.json", sourceImpact);

const stateByName = Object.fromEntries(stateEvidence.states.map(state => [state.name, state.path]));
const taskCoverage = {
  contractVersion: "stockledger-chg199-authoring-task-oracle-v1",
  candidate: { commit: candidate, tree, base },
  status: "PASS_SUPPORTED_STATES; UNPROVEN_AND_NOT_APPLICABLE_STATES_RECORDED",
  surfaces: [
    { surface: "eye-composer", oracle: "Open; blank validation; select stock/recipe/thesis; invalid range and recovery with values retained; optional fields; save; reopen edit; preserve exact authored text; Escape and invoker focus.", verifiedBy: "tests/e2e/chg199-authoring-config.spec.ts", states: ["blank-validation", "invalid-range", "create", "edit", "reopen", "escape-focus"], screenshots: [stateByName["eye-blank-validation"], stateByName["eye-invalid-range"], stateByName["eye-edit"]] },
    { surface: "journal-composer", oracle: "New; blank required validation; Eye/action/note/thesis/timing and optional concern; save; amend; previous history; Escape/cancel and invoker focus.", verifiedBy: "tests/e2e/chg199-authoring-config.spec.ts + tests/e2e/workspace.spec.ts", states: ["new", "required-validation", "create", "edit-amend", "history", "escape-focus"], screenshots: [stateByName["journal-required-validation"], stateByName["journal-amend"]] },
    { surface: "recipe-builder", oracle: "Create; each step forward/back with draft persistence; step-aware errors; supported condition; risk/review cadence; final review; save; reopen version context.", verifiedBy: "tests/e2e/chg199-authoring-config.spec.ts", states: ["incomplete-purpose", "incomplete-logic", "draft-back-forward", "final-review", "save", "version-1", "save-version-2"], screenshots: [stateByName["recipe-purpose-validation"], stateByName["recipe-logic-validation"], stateByName["recipe-final-review"], stateByName["recipe-version-context"]] },
    { surface: "logic-registry", oracle: "Open; inspect priceHistorySeries identifier/meaning/importance/source/coverage/downstream processing; supported help; close and exact focus return.", verifiedBy: "tests/e2e/chg199-authoring-config.spec.ts", states: ["ready", "field-detail", "help", "escape-focus"], screenshots: [stateByName["registry-field-detail"], stateByName["registry-help"]] },
    { surface: "notification-confirmation", oracle: "Disable; cancel without mutation and restore focus; reopen; pending state; successful persistence; induced IndexedDB persistence failure retains actionable error and retry/cancel.", verifiedBy: "tests/e2e/chg199-authoring-config.spec.ts + tests/e2e/workspace.spec.ts + state capture fixture", states: ["cancel", "pending-local-persistence-ack", "success", "error-retry", "escape-focus"], screenshots: [stateByName["notification-confirmation-cancel"], stateByName["notification-canceled"], stateByName["notification-pending"], stateByName["notification-save-error"], stateByName["notification-save-success"]] },
  ],
  loadingDeniedConflict: "NOT_APPLICABLE_OR_UNPROVEN_WHERE_NO_SAFE_SUPPORTED_FIXTURE_EXISTS",
  noMatchRegistry: "NOT_APPLICABLE; registry no-match state is not in the implemented path",
  zoom200: "SEPARATE_EVIDENCE_GATE",
  screenReaderCertification: "NOT_CLAIMED",
};
await writeDiagnostic("task-oracle-state-coverage.json", taskCoverage);

await writeDiagnostic("primary-route-regression.json", {
  suite: "tests/e2e/chg172-primary-surfaces.spec.ts + tests/e2e/r11-today.spec.ts",
  result: "PASS",
  candidate,
  fullPlaywright: { passed: 75, skipped: 1, failed: 0 },
  facts: ["primary route tasks", "responsive stress and holdout profiles", "Korean critical copy", "keyboard navigation and exact focus restoration", "today task flow"],
});
await writeDiagnostic("deep-review-regression.json", {
  suite: "tests/e2e/chg184-deep-review-details.spec.ts",
  result: "PASS",
  candidate,
  fullPlaywright: { passed: 75, skipped: 1, failed: 0 },
  facts: ["stock and metric detail hierarchy", "Eyes review filter and focus return", "Journal history detail", "scanner limitation", "stress/holdout layouts", "metric 360/390/412 hierarchy", "Korean generated-system localization"],
});

const qualification = {
  candidate,
  tree,
  base,
  release_verify: "PENDING",
  qualification: {
    npm_ci: "PASS; 639 packages installed; zero vulnerabilities at install",
    typecheck: "PASS",
    unit: "PASS; 24 files / 196 tests",
    boundary_check: "PASS",
    release_base: "PASS; exact protected base is ancestor of candidate",
    release_workflow: "PASS",
    npm_audit_high_critical: "PASS; zero vulnerabilities",
    export_all: "PASS; web/iOS/Android",
    playwright_e2e: "PASS; 75 passed, 1 existing mobile hardware-keyboard skip, 0 failed",
    recovery_drill: "PASS; synthetic restore, integrity, history, and source-not-mutated checks; no failure classification",
    operations_qualification: "PASS; synthetic workload within bounded engineering budgets; not an SLA or production capacity claim",
    operations_status: "UNCONFIGURED; release identity unavailable, scheduler stopped, workspace missing; external services unavailable",
    frozen_research: "BLOCKED_UNVERIFIED; six rules checked; numeric golden outputs absent, current constituents survivorship-biased, point-in-time membership unavailable, forward proof required",
    cloud_contract: "UNAVAILABLE; local Supabase check could not connect to missing OrbStack Docker API socket",
  },
  regressions: { primaryRoute: "PASS", deepReviewDetail: "PASS" },
  captures: { candidateExact: true, canonicalEn: 10, canonicalKo: 10, stressAndHoldout: 30, stateEvidence: 16 },
  outOfScope: ["authentic browser 200% zoom/reflow evidence remains a separate gate"],
  visualDecision: "AWAITING_INDEPENDENT_PIXEL_AUDIT",
};
await writeDiagnostic("release-qualification.json", qualification);
await writeDiagnostic("cloud-contract-status.json", {
  result: "UNAVAILABLE",
  gate: "Local Supabase/cloud contract is conditional on local cloud service availability.",
  detail: "supabase status -o json failed because the Docker API socket /Users/haewonkim/.orbstack/run/docker.sock is absent.",
  externalCredentialsOrHostedCloudWereNotAvailable: true,
});
await writeDiagnostic("artifact-capture-runtime.json", {
  candidate,
  tree,
  source: "dist generated by npm run export:all after the final clean candidate was selected",
  staticPreview: baseURL,
  browser: "Playwright Chromium headless",
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
  screenshots: "lossless PNG",
  noGeneratedEvidenceOnProductBranch: true,
  independentPixelAudit: "not performed by Fabric",
});

process.stdout.write(`prepared manifest=${manifest.canonicalAnchors.length} EN+${manifest.localizedCanonicalVariants.length} KO responsive=${responsiveCaptures.length} state=${stateEvidence.states.length} changedFiles=${productChangedFiles.length}\n`);
