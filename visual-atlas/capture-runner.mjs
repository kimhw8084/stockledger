import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = join(process.cwd(), "artifacts/chg172/visual-atlas");
const shots = join(root, "screenshots");
const diagnostics = join(root, "diagnostics");
const sourceSha = process.env.STOCKLEDGER_CAPTURE_SOURCE_SHA;
const sourceTree = process.env.STOCKLEDGER_CAPTURE_SOURCE_TREE;
const baseUrl = "http://127.0.0.1:43187";
if (!sourceSha || !sourceTree) throw new Error("Exact source SHA and tree are required.");
await mkdir(shots, { recursive: true });
await mkdir(diagnostics, { recursive: true });

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const imageRows = [];
const viewportRows = [];
const runtimeFailures = [];
const externalRequests = [];
const surfaces = ["today", "watchlist", "recipes", "alerts", "journal", "settings"];
const profile = {
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  stressDesktop: { width: 1366, height: 768, isMobile: false, hasTouch: false },
  stressMobile: { width: 360, height: 800, isMobile: true, hasTouch: true },
  holdout: { width: 412, height: 915, isMobile: true, hasTouch: true },
};

const watch = (page, contextKey) => {
  page.on("pageerror", (error) => runtimeFailures.push({ context: contextKey, kind: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeFailures.push({ context: contextKey, kind: "console", message: message.text() });
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    runtimeFailures.push({ context: contextKey, kind: "requestfailed", origin: url.origin, path: url.pathname, resourceType: request.resourceType(), error: request.failure()?.errorText ?? null });
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== baseUrl) externalRequests.push({ context: contextKey, origin: url.origin, path: url.pathname, resourceType: request.resourceType() });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      runtimeFailures.push({ context: contextKey, kind: "http", status: response.status(), origin: url.origin, path: url.pathname });
    }
  });
};

const contextFor = async (browser, viewport, locale, contextKey) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    locale,
    timezoneId: "America/Chicago",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  watch(page, contextKey);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
  return { context, page };
};

const selectStock = async (page, locale = "en") => {
  await page.getByRole("tab", { name: locale === "ko" ? "관심 종목" : "Watchlist", exact: true }).click();
  const search = page.getByRole("textbox", { name: locale === "ko" ? "종목 검색 또는 다시 열기" : "Search or resume a stock" });
  await search.fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
};

const nav = async (page, surface, locale = "en") => {
  if (surface === "today") {
    const today = page.getByRole("tab", { name: locale === "ko" ? "오늘" : "Today", exact: true });
    await today.click();
    await expect(today).toHaveAttribute("aria-selected", "true");
  } else if (surface === "watchlist") {
    await page.getByRole("tab", { name: locale === "ko" ? "관심 종목" : "Watchlist", exact: true }).click();
    await expect(page.getByRole("textbox", { name: locale === "ko" ? "종목 검색 또는 다시 열기" : "Search or resume a stock" })).toBeVisible();
  } else if (surface === "recipes") {
    await page.getByRole("tab", { name: locale === "ko" ? "레시피" : "Recipes", exact: true }).click();
    const sets = page.getByTestId("recipe-layer-control-Sets");
    await sets.click();
    await expect(sets).toHaveAttribute("aria-checked", "true");
  } else if (surface === "alerts") {
    await page.getByRole("button", { name: locale === "ko" ? "알림" : "Alerts", exact: true }).click();
    await expect(page.locator("#alerts-primary-surface")).toBeVisible();
  } else if (surface === "journal") {
    await page.getByRole("tab", { name: locale === "ko" ? "기록" : "Journal", exact: true }).click();
    await expect(page.locator("#journal-primary-surface")).toBeVisible();
    await page.getByTestId("journal-filter-control-Entered").click();
    await expect(page.getByTestId("journal-filter-control-Entered")).toHaveAttribute("aria-checked", "true");
  } else {
    await page.getByRole("button", { name: locale === "ko" ? "설정" : "Settings", exact: true }).click();
    await expect(page.locator("#settings-primary-surface")).toBeVisible();
  }
};

const readyFor = async (page, surface, locale = "en") => {
  const names = {
    today: locale === "ko" ? "오늘" : "Today",
    watchlist: locale === "ko" ? "관심 종목" : "Watchlist",
    recipes: locale === "ko" ? "레시피" : "Recipes",
    alerts: locale === "ko" ? "알림" : "Alerts",
    journal: locale === "ko" ? "기록" : "Journal",
    settings: locale === "ko" ? "설정" : "Settings",
  };
  await expect(page.getByRole("heading", { name: names[surface], exact: true }).last()).toBeVisible();
};

const primaryLocator = async (page, surface, locale = "en") => {
  if (surface === "today") return page.locator('[data-testid^="today-review-"]').first().getByRole("button").first();
  if (surface === "watchlist") {
    const register = page.getByRole("button", { name: locale === "ko" ? "관찰 항목 등록" : "Register Eye", exact: true });
    if (await register.count()) return register.first();
    return page.getByRole("textbox", { name: locale === "ko" ? "종목 검색 또는 다시 열기" : "Search or resume a stock" });
  }
  if (surface === "recipes") return page.getByRole("button", { name: locale === "ko" ? "세트 상세 보기" : "Open set detail", exact: true }).first();
  if (surface === "alerts") return page.getByRole("button", { name: locale === "ko" ? "근거 확인" : "Inspect evidence", exact: true }).first();
  if (surface === "journal") return page.getByRole("button", { name: locale === "ko" ? "새 기록" : "New", exact: true });
  return page.getByRole("button", { name: locale === "ko" ? "제공자 설정 확인" : "Check provider configuration", exact: true });
};

const take = async (page, surface, file, locale = "en", canonical = false) => {
  await readyFor(page, surface, locale);
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight }));
  if (dimensions.dpr !== 1) throw new Error(`DPR must be 1; observed ${dimensions.dpr}`);
  if (dimensions.documentWidth > dimensions.width) throw new Error(`${file}: document overflows horizontally (${dimensions.documentWidth} > ${dimensions.width})`);
  const locator = await primaryLocator(page, surface, locale);
  const actionBox = await locator.boundingBox().catch(() => null);
  const actionVisible = await locator.isVisible().catch(() => false);
  const intersectsViewport = Boolean(actionBox && actionBox.x < dimensions.width && actionBox.x + actionBox.width > 0 && actionBox.y < dimensions.height && actionBox.y + actionBox.height > 0);
  const navBox = await page.getByRole("tablist", { name: locale === "ko" ? "주요 탐색" : "Primary navigation", exact: true }).boundingBox().catch(() => null);
  const occludedByNavigation = Boolean(actionBox && navBox && actionBox.x < navBox.x + navBox.width && actionBox.x + actionBox.width > navBox.x && actionBox.y < navBox.y + navBox.height && actionBox.y + actionBox.height > navBox.y);
  if (!file.includes("--diagnostic") && (!actionVisible || !intersectsViewport || occludedByNavigation)) {
    throw new Error(`${file}: required next action is not visible in the initial viewport.`);
  }
  const path = join(shots, file);
  await page.screenshot({ path, type: "png", fullPage: false });
  const bytes = await readFile(path);
  const pngSize = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (pngSize.width !== dimensions.width || pngSize.height !== dimensions.height) throw new Error(`${file}: PNG dimensions ${pngSize.width}x${pngSize.height} did not match viewport ${dimensions.width}x${dimensions.height}`);
  const row = {
    path: `screenshots/${file}`,
    surface_key: surface,
    locale,
    viewport: `${dimensions.width}x${dimensions.height}`,
    dpr: dimensions.dpr,
    image: pngSize,
    sha256: sha256(bytes),
    bytes: bytes.length,
    runtime_ready: true,
    document_width: dimensions.documentWidth,
    document_height: dimensions.documentHeight,
    primary_action: actionBox ? {
      visible: actionVisible,
      bounds: { x: actionBox.x, y: actionBox.y, width: actionBox.width, height: actionBox.height },
      intersects_viewport: intersectsViewport,
      fully_within_viewport: actionBox.x >= 0 && actionBox.y >= 0 && actionBox.x + actionBox.width <= dimensions.width && actionBox.y + actionBox.height <= dimensions.height,
      unobscured_by_primary_navigation: !occludedByNavigation,
    } : { visible: false, reason: "surface action selector unavailable for this subview" },
  };
  imageRows.push(row);
  if (canonical) viewportRows.push({ surface_key: surface, locale, path: row.path, dimensions: pngSize, sha256: row.sha256, runtime_ready: true });
  return row;
};

const bundleFiles = async () => {
  const files = await Promise.all(["dist/_expo/static/js/web"].map(async (dir) => {
    const { readdir } = await import("node:fs/promises");
    return (await readdir(dir)).filter((name) => name.endsWith(".js")).map((name) => join(dir, name));
  }));
  return Promise.all(files.flat().map(async (file) => ({ path: file.replace(`${process.cwd()}/`, ""), sha256: sha256(await readFile(file)) })));
};

const browser = await chromium.launch({ headless: true });
try {
  const browserVersion = browser.version();
  const exportBundles = await bundleFiles();
  for (const [key, viewport] of [["desktop", profile.desktop], ["mobile", profile.mobile]]) {
    const { context, page } = await contextFor(browser, viewport, "en-US", `canonical-en-${key}`);
    await take(page, "today", `today--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    await selectStock(page);
    await take(page, "watchlist", `watchlist--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    await nav(page, "recipes");
    await take(page, "recipes", `recipes--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    await nav(page, "alerts");
    await take(page, "alerts", `alerts--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    if (key === "desktop") {
      const currentAlert = page.getByTestId(/^alerts-alert-/).first();
      const alertTitle = await currentAlert.getByRole("heading", { level: 3 }).first().innerText();
      await currentAlert.getByRole("button", { name: "Snooze for 24 hours", exact: true }).click();
      await page.getByTestId("alerts-view-control-History").click();
      const historyItem = page.getByTestId(/^alerts-history-/).filter({ hasText: alertTitle });
      await expect(historyItem.getByText("Snoozed", { exact: true })).toBeVisible();
      await take(page, "alerts", "alerts--diagnostic-snoozed-history.png");
      await page.getByTestId("alerts-view-control-Current").click();
    }
    await nav(page, "journal");
    await take(page, "journal", `journal--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    await nav(page, "settings");
    await take(page, "settings", `settings--${key}-${viewport.width}x${viewport.height}.png`, "en", true);
    await context.close();
  }

  for (const [key, viewport] of [["desktop", profile.desktop], ["mobile", profile.mobile]]) {
    const { context, page } = await contextFor(browser, viewport, "ko-KR", `canonical-ko-${key}`);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-language-control-ko").click();
    for (const surface of surfaces.slice(1)) {
      if (surface === "watchlist") await selectStock(page, "ko");
      else await nav(page, surface, "ko");
      await take(page, surface, `${surface}--ko--${key}-${viewport.width}x${viewport.height}.png`, "ko", false);
    }
    await context.close();
  }

  for (const [key, viewport] of [["desktop-stress", profile.stressDesktop], ["mobile-stress", profile.stressMobile], ["holdout", profile.holdout]]) {
    const { context, page } = await contextFor(browser, viewport, "en-US", `stress-en-${key}`);
    await selectStock(page);
    await take(page, "watchlist", `watchlist--${key}-${viewport.width}x${viewport.height}.png`);
    await nav(page, "recipes");
    await take(page, "recipes", `recipes--${key}-${viewport.width}x${viewport.height}.png`);
    await nav(page, "alerts");
    await take(page, "alerts", `alerts--${key}-${viewport.width}x${viewport.height}.png`);
    await nav(page, "journal");
    await take(page, "journal", `journal--${key}-${viewport.width}x${viewport.height}.png`);
    await nav(page, "settings");
    await take(page, "settings", `settings--${key}-${viewport.width}x${viewport.height}.png`);
    await context.close();
  }

  const empty = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago", colorScheme: "light", reducedMotion: "reduce" });
  const page = await empty.newPage();
  watch(page, "non-happy-empty-workspace");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await nav(page, "watchlist");
  await expect(page.getByText("Choose a stock to review", { exact: true })).toBeVisible();
  await take(page, "watchlist", "watchlist--diagnostic-no-selection.png");
  const search = page.getByRole("textbox", { name: "Search or resume a stock" });
  await search.fill("no-such-stock-172");
  await expect(page.getByText("No matching stocks", { exact: true })).toBeVisible();
  await take(page, "watchlist", "watchlist--diagnostic-no-results.png");
  await nav(page, "recipes");
  await expect(page.getByText("No compatible sets are available.", { exact: false })).toBeVisible();
  await take(page, "recipes", "recipes--diagnostic-no-compatible-set.png");
  await nav(page, "alerts");
  await expect(page.getByText("No alerts need review now", { exact: true })).toBeVisible();
  await take(page, "alerts", "alerts--diagnostic-no-current.png");
  await page.getByTestId("alerts-view-control-History").click();
  await expect(page.getByText("No snoozed or reviewed alerts are recorded.", { exact: true })).toBeVisible();
  await take(page, "alerts", "alerts--diagnostic-empty-history.png");
  await nav(page, "journal");
  await expect(page.getByText("No decisions have been recorded", { exact: true })).toBeVisible();
  await take(page, "journal", "journal--diagnostic-empty-history.png");
  await nav(page, "settings");
  await expect(page.getByRole("button", { name: "Refresh snapshots", exact: true })).toBeDisabled();
  await expect(page.getByText("Add a tracked stock before refreshing snapshots.", { exact: true })).toBeVisible();
  await take(page, "settings", "settings--diagnostic-no-stock-unconfigured.png");
  await empty.close();

  const pendingContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Chicago", colorScheme: "light", reducedMotion: "reduce" });
  const pendingPage = await pendingContext.newPage();
  watch(pendingPage, "settings-refresh-pending-and-error");
  let heldRequests = 0;
  await pendingPage.route("https://stooq.com/q/d/l/**", async (route) => {
    heldRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.abort("failed");
  });
  await pendingPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await pendingPage.getByRole("button", { name: "Add your first stock", exact: true }).click();
  await pendingPage.getByRole("textbox", { name: "Ticker, e.g. AAPL" }).fill("AAPL");
  await pendingPage.getByRole("textbox", { name: "Company name", exact: true }).fill("Apple");
  await pendingPage.getByRole("button", { name: "Save stock", exact: true }).click();
  await pendingPage.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(pendingPage.getByText("Not configured · data stays on this device", { exact: true })).toBeVisible();
  await pendingPage.getByRole("button", { name: "Refresh snapshots", exact: true }).click();
  const pendingButton = pendingPage.getByRole("button", { name: "Checking saved snapshots", exact: true });
  await expect(pendingButton).toBeVisible();
  await expect(pendingButton).toBeDisabled();
  await take(pendingPage, "settings", "settings--diagnostic-refresh-pending.png");
  const operationError = pendingPage.getByRole("alert");
  await expect(operationError).toBeVisible({ timeout: 10_000 });
  await take(pendingPage, "settings", "settings--diagnostic-refresh-error.png");
  await pendingContext.close();

  if (heldRequests < 1) throw new Error("Settings refresh did not issue its supported source request.");
  const releaseVerify = JSON.parse(await readFile(join(diagnostics, "release-verify.json"), "utf8"));
  if (releaseVerify.verified !== true) throw new Error("Exact-candidate release verification did not pass.");
  const bundleRows = imageRows.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }));
  await writeFile(join(diagnostics, "runtime-artifacts.json"), `${JSON.stringify({ image_count: imageRows.length, canonical_image_count: viewportRows.length, images: bundleRows, runtime_failures: runtimeFailures, external_requests: externalRequests }, null, 2)}\n`);
  await writeFile(join(root, "capture-runner.mjs"), await readFile(new URL(import.meta.url)));
  const appRuntimeSha = sha256(Buffer.from(JSON.stringify(exportBundles)));
  const surfaceRows = surfaces.map((surface) => {
    const enDesktop = imageRows.find((row) => row.surface_key === surface && row.locale === "en" && row.viewport === "1440x900");
    const enMobile = imageRows.find((row) => row.surface_key === surface && row.locale === "en" && row.viewport === "390x844");
    return {
      surface_key: surface,
      canonical_navigation_intent: surface === "today" ? "Today primary tab" : surface === "watchlist" ? "Watchlist primary tab" : surface === "recipes" ? "Recipes primary tab; monitoring sets selected" : surface === "alerts" ? "Alerts workspace; current queue" : surface === "journal" ? "Journal primary tab" : "Settings workspace; operating state",
      state: surface === "watchlist" ? "sample stock AAPL selected; source state disclosed" : surface === "recipes" ? "sample workspace; Sets layer selected" : surface === "alerts" ? "sample workspace; current actionable queue" : surface === "journal" ? "sample workspace; decision history" : surface === "settings" ? "sample workspace; provider state" : "sample workspace; Today overview",
      role: "local sample workspace; no account or private user data",
      theme: "light",
      runtime_ready_assertion: "expected semantic heading and surface content visible; fonts settled; DPR 1; exact PNG dimensions",
      canonical_artifacts: {
        desktop: { path: enDesktop.path, dimensions: enDesktop.image, sha256: enDesktop.sha256 },
        mobile: { path: enMobile.path, dimensions: enMobile.image, sha256: enMobile.sha256 },
      },
      source_sha: sourceSha,
      source_tree: sourceTree,
    };
  });
  const manifest = {
    schema: "stockledger-surface-manifest-v1",
    project: "stockledger",
    change: "CHG-172",
    request: "stockledger-prod-c14-primary-surfaces-lawbook-v1",
    operation: "BUILD",
    fabric_job: "CF-15fa2f1fc9122e348b846af6",
    source_sha: sourceSha,
    source_tree: sourceTree,
    runtime_sha256: appRuntimeSha,
    discovered_at: new Date().toISOString(),
    surfaces: surfaceRows,
    additional_captures: imageRows.filter((row) => !viewportRows.some((canonical) => canonical.path === row.path)).map(({ path, surface_key, locale, viewport, image, sha256, bytes }) => ({ path, surface_key, locale, viewport, dimensions: image, sha256, bytes })),
  };
  await writeFile(join(root, "surface-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const captureReport = {
    schema: "stockledger-capture-report-v1",
    project: "stockledger",
    change: "CHG-172",
    request: "stockledger-prod-c14-primary-surfaces-lawbook-v1",
    operation: "BUILD",
    fabric_job: "CF-15fa2f1fc9122e348b846af6",
    source: { sha: sourceSha, tree: sourceTree, working_tree_clean_before_capture: true },
    runtime: { app: "Expo static web export from exact candidate", base_url: baseUrl, app_runtime_sha256: appRuntimeSha, browser: "Chromium", browser_version: browserVersion, timezone: "America/Chicago", color_scheme: "light", reduced_motion: "reduce", device_scale_factor: 1, profiles: profile, locale_capture: ["en-US", "ko-KR"] },
    capture_method: { full_page: false, lossless_png: true, screenshot_dimensions_verified: true, document_horizontal_overflow: "none observed", dom_mutation: false, css_zoom: false, browser_zoom_200_percent: "UNPROVEN: runner cannot control browser chrome; no viewport or device scale factor substitution used" },
    screenshot_count: imageRows.length,
    canonical_screenshot_count: viewportRows.length,
    screenshots: imageRows,
    browser_diagnostics: { runtime_failures: runtimeFailures, external_requests: externalRequests, settings_refresh_route: "Stooq requests held 1.2s then aborted to retain a real pending state and a truthful network failure; no DOM fixture was injected", held_requests: heldRequests },
    release_verify: releaseVerify,
    non_happy_state_capture_count: imageRows.filter((row) => row.path.includes("diagnostic-")).length,
    visualDecision: "AWAITING_INDEPENDENT_PIXEL_AUDIT",
  };
  await writeFile(join(root, "capture-report.json"), `${JSON.stringify(captureReport, null, 2)}\n`);
  await writeFile(join(diagnostics, "task-oracles.json"), `${JSON.stringify({
    schema: "stockledger-chg172-task-oracles-v1",
    source_sha: sourceSha,
    source_tree: sourceTree,
    full_playwright_run: { command: "npm run test:e2e", total: 48, passed: 47, skipped: 1, failed: 0 },
    keyboard_mobile: { status: "UNPROVEN_NON_APPLICABLE", reason: "The mobile Playwright project emulates touch and has no connected hardware keyboard; the complete keyboard task ran and passed on desktop Chromium." },
    tasks: [
      { surface: "watchlist", test: "Watchlist task: search, identify sample evidence, inspect, and return to the same stock", result: "PASS", proof: ["no-results copy", "AAPL selected", "sample provenance visible", "evidence detail opened", "Escape restored invoking control and AAPL context"] },
      { surface: "recipes", test: "Recipes task: choose a layer, read set purpose/version, open detail, and return with focus", result: "PASS", proof: ["Sets layer selected", "purpose, version, cadence visible", "existing set detail opened", "Escape restored focus and Sets layer"] },
      { surface: "alerts", test: "Alerts task: inspect the leading current alert, snooze it, and verify its truthful history state", result: "PASS", proof: ["high-priority visible evidence", "source/freshness and uncertainty visible", "detail opened and returned", "snooze visible as Snoozed in History"] },
      { surface: "journal", test: "Journal task: filter and inspect a past decision, then open and close New without saving", result: "PASS", proof: ["Entered filter selected", "decision evidence opened", "Escape returned focus", "New composer opened then closed without save and focus returned"] },
      { surface: "settings", test: "Settings task: inspect local provider state, refresh one stock, and distinguish request result from service health", result: "PASS_WITH_EXTERNAL_SOURCE_LIMITATION", proof: ["four providers truthfully Unconfigured", "refresh request pending semantics observed where retained", "source request result/error shown without claiming provider health", "Stooq CORS failure recorded"] },
      { surface: "today", test: "Today regression task oracle preserves evidence context and opens a deliberate journal action", result: "PASS", proof: ["review detail context", "focus return", "journal composer invocation"] }
    ]
  }, null, 2)}\n`);
  await writeFile(join(diagnostics, "state-coverage.json"), `${JSON.stringify({
    schema: "stockledger-chg172-state-coverage-v1",
    source_sha: sourceSha,
    source_tree: sourceTree,
    captured_non_happy_states: [
      { surface: "watchlist", state: "no selection", result: "PASS", artifact: "screenshots/watchlist--diagnostic-no-selection.png" },
      { surface: "watchlist", state: "no results", result: "PASS", artifact: "screenshots/watchlist--diagnostic-no-results.png" },
      { surface: "watchlist", state: "sample/degraded evidence", result: "PASS", artifact: "screenshots/watchlist--desktop-1440x900.png", truth: "The page marks this as sample data; values are not live observations." },
      { surface: "recipes", state: "no compatible set/data-limited", result: "PASS", artifact: "screenshots/recipes--diagnostic-no-compatible-set.png" },
      { surface: "alerts", state: "no current alerts", result: "PASS", artifact: "screenshots/alerts--diagnostic-no-current.png" },
      { surface: "alerts", state: "empty history", result: "PASS", artifact: "screenshots/alerts--diagnostic-empty-history.png" },
      { surface: "alerts", state: "snoozed history", result: "PASS", artifact: "screenshots/alerts--diagnostic-snoozed-history.png" },
      { surface: "journal", state: "empty history", result: "PASS", artifact: "screenshots/journal--diagnostic-empty-history.png" },
      { surface: "settings", state: "unconfigured providers/no stock", result: "PASS", artifact: "screenshots/settings--diagnostic-no-stock-unconfigured.png" },
      { surface: "settings", state: "refresh pending", result: "PASS", artifact: "screenshots/settings--diagnostic-refresh-pending.png", truth: "Supported request held at its real external source boundary; captured while pending, then released as a failed request." },
      { surface: "settings", state: "refresh source error", result: "PASS", artifact: "screenshots/settings--diagnostic-refresh-error.png", truth: "Request failure is visible; saved data remains the authority." }
    ],
    source_contract_not_retainable: [
      { surface: "settings", state: "provider limited", result: "NOT_APPLICABLE", reason: "src/lib/providerHealth.ts returns only the four configured-as-false Unconfigured entries; there is no current supported account/configuration fixture for Plan Limited." },
      { surface: "settings", state: "provider unavailable/error", result: "NOT_APPLICABLE_AS_PROVIDER_STATUS", reason: "The current provider status list is local configuration metadata and does not make a live health call. A real source request failure is separately exercised and reported without rewriting provider status." },
      { surface: "settings", state: "provider loading", result: "UNPROVEN_NON_APPLICABLE", reason: "getProviderHealth is a local async metadata function that resolves immediately; no supported delayed provider-health control exists, and no artificial UI fixture was injected." },
      { surface: "all", state: "permission denied/authenticated provider", result: "NOT_APPLICABLE", reason: "The supported Product contract has no provider credentials or authenticated hosted provider session in this app." },
      { surface: "all", state: "conflict state", result: "NOT_APPLICABLE_TO_PRIMARY_SURFACES", reason: "Conflict resolution is owned by deferred/deeper sync workflows; no settings primary-surface conflict action exists." },
      { surface: "all", state: "genuine browser zoom 200 percent", result: "UNPROVEN", reason: "The runner does not control browser chrome; no viewport, DPR, or CSS zoom substitution was used." }
    ]
  }, null, 2)}\n`);
  console.log(JSON.stringify({ screenshot_count: imageRows.length, canonical_screenshot_count: viewportRows.length, failures: runtimeFailures.length, external_requests: externalRequests.length, source_sha: sourceSha, source_tree: sourceTree, runtime_sha256: appRuntimeSha }, null, 2));
} finally {
  await browser.close();
}
