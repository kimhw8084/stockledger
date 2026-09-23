import { test, expect, type Page } from "@playwright/test";

const openSampleWorkspace = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
};

const openTab = async (page: Page, label: string) => {
  if (label === "Alerts" || label === "Settings" || label === "알림" || label === "설정") {
    await page.getByRole("button", { name: label, exact: true }).click();
    return;
  }
  const tab = page.getByRole("tab", { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
};

test("Watchlist task: search, identify sample evidence, inspect, and return to the same stock", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Watchlist");
  await expect(page.getByText("Choose a stock to review", { exact: true })).toBeVisible();

  const search = page.getByRole("textbox", { name: "Search or resume a stock" });
  await search.fill("no-such-stock-172");
  await expect(page.getByText("No matching stocks", { exact: true })).toBeVisible();
  await expect(page.getByText("Change the ticker or company name, or add a stock directly.", { exact: true })).toBeVisible();

  await search.fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
  const registerEye = page.getByRole("button", { name: "Register Eye", exact: true });
  const registerBounds = await registerEye.boundingBox();
  expect(registerBounds).not.toBeNull();
  expect(registerBounds!.y).toBeGreaterThanOrEqual(0);
  expect(registerBounds!.y + registerBounds!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  await expect(page.getByText("Sample data. Do not treat these values as live market observations.", { exact: true })).toBeVisible();
  await expect(page.getByText("Latest price", { exact: true })).toBeVisible();
  await expect(page.getByText("Current evidence", { exact: true })).toBeVisible();

  const inspect = page.getByRole("button", { name: "Evidence detail", exact: true }).first();
  await inspect.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(inspect).toBeFocused();
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
});

test("Recipes task: choose a layer, read set purpose/version, open detail, and return with focus", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Recipes");
  const setsLayer = page.getByTestId("recipe-layer-control-Sets");
  await setsLayer.click();
  await expect(setsLayer).toHaveAttribute("aria-checked", "true");
  const selectedLayerAppearance = await setsLayer.evaluate((element) => ({
    text: element.textContent?.trim() ?? "",
    background: getComputedStyle(element).backgroundColor,
    labelColor: getComputedStyle(element.firstElementChild!).color,
  }));
  expect(selectedLayerAppearance.text).toContain("Set");
  expect(selectedLayerAppearance.background).not.toBe("rgb(255, 255, 255)");
  expect(selectedLayerAppearance.labelColor).not.toBe(selectedLayerAppearance.background);
  await expect(page.getByText("Use related rules together with an explicit purpose, scope, and review cadence.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Intended use:", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Review cadence:", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/^v\d+$/).first()).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const openSet = page.getByRole("button", { name: "Open set detail", exact: true }).first();
  const setActionBounds = await openSet.boundingBox();
  const primaryNavigation = await page.getByRole("tablist", { name: "Primary navigation", exact: true }).boundingBox();
  expect(setActionBounds).not.toBeNull();
  expect(primaryNavigation).not.toBeNull();
  expect(setActionBounds!.y).toBeGreaterThanOrEqual(0);
  expect(setActionBounds!.y + setActionBounds!.height).toBeLessThanOrEqual(800);
  expect(setActionBounds!.y + setActionBounds!.height).toBeLessThanOrEqual(primaryNavigation!.y);
  await openSet.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(openSet).toBeFocused();
  await expect(setsLayer).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Version history", exact: true }).first()).toBeVisible();
});

test("Alerts task: inspect the leading current alert, snooze it, and verify its truthful history state", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Alerts");
  const firstAlert = page.getByTestId(/^alerts-alert-/).first();
  await expect(firstAlert.getByText("High", { exact: true })).toBeVisible();
  const alertTitle = await firstAlert.getByRole("heading", { level: 3 }).first().innerText();
  const inspect = firstAlert.getByRole("button", { name: "Inspect evidence", exact: true });
  await expect(inspect).toBeVisible();
  await expect(page.getByText("Source and freshness", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Uncertainty and missing inputs", { exact: false }).first()).toBeVisible();

  await inspect.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText(alertTitle, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(inspect).toBeFocused();

  const snooze = firstAlert.getByRole("button", { name: "Snooze for 24 hours", exact: true });
  const snoozedTitle = alertTitle;
  await snooze.click();
  await page.getByTestId("alerts-view-control-History").click();
  const snoozedHistory = page.getByTestId(/^alerts-history-/).filter({ hasText: snoozedTitle });
  await expect(snoozedHistory.getByText("Snoozed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to current queue", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Reviewed", { exact: true }).first()).toBeVisible();
});

test("Journal task: filter and inspect a past decision, then open and close New without saving", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Journal");
  await page.getByTestId("journal-filter-control-Entered").click();
  const inspect = page.getByRole("button", { name: "Open decision evidence", exact: true }).first();
  await expect(inspect).toBeVisible();
  await expect(page.getByText("Data state:", { exact: false }).first()).toBeVisible();

  await inspect.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Decision context", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(inspect).toBeFocused();

  const newRecord = page.getByRole("button", { name: "New", exact: true });
  await newRecord.click();
  const composer = page.getByRole("dialog");
  await expect(composer).toBeVisible();
  await expect(composer.getByRole("button", { name: "Save Decision", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(composer).toHaveCount(0);
  await expect(newRecord).toBeFocused();
  await expect(inspect).toBeVisible();
});

test("Settings task: inspect local provider state, refresh one stock, and distinguish request result from service health", async ({ page }, testInfo) => {
  const externalRequests: { origin: string; path: string }[] = [];
  const failedRequests: { origin: string; path: string; error: string | null }[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.origin.startsWith("http://127.0.0.1") && url.protocol !== "data:") externalRequests.push({ origin: url.origin, path: url.pathname });
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (!url.origin.startsWith("http://127.0.0.1") && url.protocol !== "data:") failedRequests.push({ origin: url.origin, path: url.pathname, error: request.failure()?.errorText ?? null });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first stock", exact: true }).click();
  await page.getByRole("textbox", { name: "Ticker, e.g. AAPL" }).fill("AAPL");
  await page.getByRole("textbox", { name: "Company name", exact: true }).fill("Apple");
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Not configured · data stays on this device", { exact: true })).toBeVisible();
  await expect(page.getByText("Unconfigured 4", { exact: false })).toBeVisible();
  await expect(page.getByText(/not a live service health check/i)).toBeVisible();

  const refresh = page.getByRole("button", { name: "Refresh snapshots", exact: true });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  const pendingRefresh = page.getByRole("button", { name: "Checking saved snapshots", exact: true });
  const pendingRefreshObserved = await pendingRefresh.isVisible().catch(() => false);
  if (pendingRefreshObserved) await expect(pendingRefresh).toBeDisabled();
  const refreshResult = page.getByText("The refresh request finished. Confirm its result from the source and update times below.", { exact: true });
  const reportedError = page.getByRole("alert");
  await expect.poll(async () => (await refreshResult.isVisible().catch(() => false)) || (await reportedError.count()) > 0, { timeout: 20_000 }).toBe(true);
  const refreshResultObserved = await refreshResult.isVisible().catch(() => false);

  const check = page.getByRole("button", { name: "Check provider configuration", exact: true });
  await check.click();
  const pending = page.getByRole("button", { name: "Checking provider configuration", exact: true });
  const pendingObserved = await pending.isVisible().catch(() => false);
  if (pendingObserved) await expect(pending).toBeDisabled();
  await expect(page.getByText("Stooq", { exact: true })).toBeVisible();
  await expect(page.getByText("Unconfigured", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/not a live service health check/i)).toBeVisible();
  await expect(page.getByText(/configuration check succeeded/i)).toHaveCount(0);
  expect(externalRequests.every((request) => request.origin === "https://stooq.com" && request.path === "/q/d/l/")).toBe(true);
  await testInfo.attach("settings-refresh-diagnostics.json", {
    body: Buffer.from(JSON.stringify({ pendingRefreshObserved, refreshResultObserved, pendingConfigurationObserved: pendingObserved, externalRequests, failedRequests, pageErrors, consoleErrors, reportedError: await reportedError.allInnerTexts() }, null, 2)),
    contentType: "application/json",
  });
});

test("supported empty states remain explicit in a new local workspace", async ({ page }) => {
  await page.goto("/");
  await openTab(page, "Recipes");
  await page.getByTestId("recipe-layer-control-Sets").click();
  await expect(page.getByText("No compatible sets are available.", { exact: false })).toBeVisible();

  await openTab(page, "Alerts");
  await expect(page.getByText("No alerts need review now", { exact: true })).toBeVisible();
  await page.getByTestId("alerts-view-control-History").click();
  await expect(page.getByText("No snoozed or reviewed alerts are recorded.", { exact: true })).toBeVisible();

  await openTab(page, "Journal");
  await expect(page.getByText("No decisions have been recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("Save a decision from alert review or start a deliberate new record", { exact: false })).toBeVisible();

  await openTab(page, "Settings");
  await expect(page.getByRole("button", { name: "Refresh snapshots", exact: true })).toBeDisabled();
  await expect(page.getByText("Add a tracked stock before refreshing snapshots.", { exact: true })).toBeVisible();
});

test("all five primary surfaces fit canonical, stress, and holdout viewports", async ({ page }) => {
  await openSampleWorkspace(page);
  const profiles = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
    { width: 360, height: 800 },
    { width: 412, height: 915 },
  ];
  const surfaces = [
    { tab: "Watchlist", action: () => page.getByRole("textbox", { name: "Search or resume a stock" }) },
    { tab: "Recipes", action: () => page.getByTestId("recipe-layer-control") },
    { tab: "Alerts", action: () => page.getByRole("button", { name: "Inspect evidence", exact: true }).first() },
    { tab: "Journal", action: () => page.getByRole("button", { name: "New", exact: true }) },
    { tab: "Settings", action: () => page.getByRole("button", { name: "Check provider configuration", exact: true }) },
  ];

  for (const profile of profiles) {
    await page.setViewportSize(profile);
    for (const surface of surfaces) {
      await openTab(page, surface.tab);
      await page.evaluate(() => window.scrollTo(0, 0));
      const action = surface.action();
      const bounds = await action.boundingBox();
      expect(bounds, `${surface.tab} action should have measurable bounds at ${profile.width}x${profile.height}`).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(profile.width);
      expect(bounds!.y, `${surface.tab} primary action should be visible without scrolling at ${profile.width}x${profile.height}`).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height, `${surface.tab} primary action should fit the initial viewport at ${profile.width}x${profile.height}`).toBeLessThanOrEqual(profile.height);
      const navigationBounds = await page.getByRole("tablist", { name: "Primary navigation", exact: true }).boundingBox();
      expect(navigationBounds, "primary navigation should expose measurable bounds").not.toBeNull();
      const overlapsNavigation = bounds!.x < navigationBounds!.x + navigationBounds!.width
        && bounds!.x + bounds!.width > navigationBounds!.x
        && bounds!.y < navigationBounds!.y + navigationBounds!.height
        && bounds!.y + bounds!.height > navigationBounds!.y;
      expect(overlapsNavigation, `${surface.tab} primary action should stay unobscured by primary navigation at ${profile.width}x${profile.height}`).toBe(false);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${surface.tab} document should not overflow at ${profile.width}x${profile.height}`).toBeLessThanOrEqual(profile.width);
    }
  }
});

test("critical changed-surface meaning stays visible in Korean", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Settings");
  await page.getByTestId("settings-language-control-ko").click();

  await openTab(page, "관심 종목");
  await expect(page.getByText("종목을 찾고 데이터 상태와 근거를 확인한 뒤 다음 검토를 선택합니다.", { exact: true })).toBeVisible();

  await openTab(page, "레시피");
  const selectedSetLayer = page.getByTestId("recipe-layer-control-Sets");
  await expect(selectedSetLayer).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("여러 규칙을 목적, 사용 범위, 검토 주기에 맞춰 함께 사용합니다.", { exact: true }).first()).toBeVisible();

  await openTab(page, "알림");
  await expect(page.locator("#alerts-primary-surface").getByRole("heading", { name: "현재 검토 대기", exact: true })).toBeVisible();
  await expect(page.getByText("불확실성 및 누락:", { exact: false }).first()).toBeVisible();
  const inspectEvidence = page.getByRole("button", { name: "근거 확인", exact: true }).first();
  await expect(inspectEvidence).toBeVisible();
  const inspectBounds = await inspectEvidence.boundingBox();
  const primaryNavigation = await page.getByRole("tablist", { name: "주요 탐색", exact: true }).boundingBox();
  expect(inspectBounds).not.toBeNull();
  expect(primaryNavigation).not.toBeNull();
  expect(inspectBounds!.y + inspectBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(inspectBounds!.y + inspectBounds!.height).toBeLessThanOrEqual(primaryNavigation!.y);

  await openTab(page, "기록");
  await expect(page.locator("#journal-primary-surface").getByRole("heading", { name: "기록", exact: true })).toBeVisible();
  await expect(page.getByText("날짜와 결정 맥락을 따라 과거 근거와 결과를 되짚습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "새 기록", exact: true })).toBeVisible();

  await openTab(page, "설정");
  await expect(page.locator("#settings-primary-surface").getByRole("heading", { name: "설정", exact: true })).toBeVisible();
  await expect(page.getByText("실시간 서비스 상태 점검은 아닙니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "제공자 설정 확인", exact: true })).toBeVisible();
});

test("keyboard task paths operate segmented choices and restore focus after deep flows", async ({ page }, testInfo) => {
  // This task oracle runs in desktop Chromium, which can model a real keyboard.
  // The mobile project emulates touch input and has no connected hardware keyboard.
  test.skip(testInfo.project.name === "mobile", "Mobile touch emulation does not provide a hardware keyboard profile.");
  await page.goto("/");
  const sample = page.getByRole("button", { name: "Explore sample workspace", exact: true });
  await sample.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Sample data is present/)).toBeVisible();

  const watchlistTab = page.getByRole("tab", { name: "Watchlist", exact: true });
  await watchlistTab.focus();
  await page.keyboard.press("Enter");
  const search = page.getByRole("textbox", { name: "Search or resume a stock" });
  await search.focus();
  await search.pressSequentially("AAPL");
  const apple = page.getByRole("button", { name: "AAPL · Apple", exact: true });
  await apple.press("Enter");
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
  const metric = page.getByRole("button", { name: "Evidence detail", exact: true }).first();
  await metric.focus();
  await page.keyboard.press("Enter");
  const metricDialog = page.getByRole("dialog");
  await expect(metricDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(metric).toBeFocused();
  const boardControls = page.getByRole("button", { name: "Board filters and display", exact: true });
  await boardControls.scrollIntoViewIfNeeded();
  await boardControls.focus();
  await expect(boardControls).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(boardControls).toHaveAttribute("aria-expanded", "true");
  const statusGroup = page.getByRole("radiogroup", { name: "Evidence status" });
  const warningFilter = statusGroup.getByRole("radio").nth(1);
  await warningFilter.focus();
  await page.keyboard.press("Space");
  await expect(warningFilter).toHaveAttribute("aria-checked", "true");

  const recipesTab = page.getByRole("tab", { name: "Recipes", exact: true });
  await recipesTab.focus();
  await page.keyboard.press("Enter");
  const formulas = page.getByTestId("recipe-layer-control-Formulas");
  await formulas.focus();
  await page.keyboard.press("Space");
  await expect(formulas).toHaveAttribute("aria-checked", "true");
  const formula = page.getByRole("button", { name: "Formula detail and edit", exact: true }).first();
  await formula.focus();
  await page.keyboard.press("Enter");
  const formulaDialog = page.getByRole("dialog");
  await expect(formulaDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(formula).toBeFocused();

  const alertsTab = page.getByRole("button", { name: "Alerts", exact: true });
  await alertsTab.scrollIntoViewIfNeeded();
  await alertsTab.focus();
  await expect(alertsTab).toBeFocused();
  await page.keyboard.press("Enter");
  const alertInspect = page.getByRole("button", { name: "Inspect evidence", exact: true }).first();
  await alertInspect.focus();
  await page.keyboard.press("Enter");
  const alertDialog = page.getByRole("dialog");
  await expect(alertDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(alertInspect).toBeFocused();

  const journalTab = page.getByRole("tab", { name: "Journal", exact: true });
  await journalTab.focus();
  await page.keyboard.press("Enter");
  const newRecord = page.getByRole("button", { name: "New", exact: true });
  await newRecord.focus();
  await page.keyboard.press("Enter");
  const composer = page.getByRole("dialog");
  await expect(composer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(newRecord).toBeFocused();

  const settingsTab = page.getByRole("button", { name: "Settings", exact: true });
  await settingsTab.focus();
  await page.keyboard.press("Enter");
  const providerCheck = page.getByRole("button", { name: "Check provider configuration", exact: true });
  await providerCheck.press("Enter");
  await expect(page.getByText("Stooq", { exact: true })).toBeVisible();
  const workspaceSection = page.getByRole("button", { name: "Workspace and data", exact: true });
  await workspaceSection.press("Space");
  await expect(workspaceSection).toHaveAttribute("aria-expanded", "true");
});
