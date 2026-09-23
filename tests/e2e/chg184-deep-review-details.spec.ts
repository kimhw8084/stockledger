import { test, expect, type Page, type TestInfo } from "@playwright/test";

const openSampleWorkspace = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
};

const openTab = async (page: Page, label: string) => {
  if (label === "Alerts" || label === "Settings") {
    await page.getByRole("button", { name: label, exact: true }).click();
    return;
  }
  const tab = page.getByRole("tab", { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
};

const selectApple = async (page: Page) => {
  const search = page.getByRole("textbox", { name: "Search or resume a stock" });
  await search.fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
};

const captureSurface = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, animations: "disabled", scale: "css" });
  await testInfo.attach(name, { path, contentType: "image/png" });
};

test("Stock and metric detail retain evidence hierarchy, pinning, and invoker focus", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await openSampleWorkspace(page);
  await openTab(page, "Watchlist");
  await selectApple(page);

  await expect(page.getByText("Stock identity and data authority", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample data. Do not treat these values as live market observations.", { exact: true })).toBeVisible();
  await expect(page.getByText("Monitoring context", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `stock-entity-detail-${testInfo.project.name}.png`);
  const inspect = page.getByRole("button", { name: "Evidence detail", exact: true }).first();
  await inspect.scrollIntoViewIfNeeded();
  await inspect.click();

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText("What stands out now", { exact: true })).toBeVisible();
  await expect(detail.getByText("Current", { exact: true })).toBeVisible();
  await expect(detail.getByText("Threshold", { exact: true })).toBeVisible();
  await expect(detail.getByText("Freshness", { exact: true })).toBeVisible();
  await expect(detail.getByText("Source", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `metric-detail-sheet-${testInfo.project.name}.png`);
  const pin = detail.getByRole("button", { name: "Pin", exact: true });
  await pin.scrollIntoViewIfNeeded();
  await pin.click();
  await expect(detail.getByRole("button", { name: "Unpin", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(inspect).toBeFocused();
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
});

test("Eyes review filter and selected Eye return to the same row and context", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await openSampleWorkspace(page);
  await openTab(page, "Watchlist");
  await selectApple(page);
  const reviewEyes = page.getByRole("button", { name: "Review Eyes", exact: true });
  await reviewEyes.scrollIntoViewIfNeeded();
  await reviewEyes.click();

  const quiet = page.getByRole("radio", { name: "Quiet", exact: true });
  await quiet.click();
  await expect(quiet).toHaveAttribute("aria-checked", "true");
  const quietRow = page.getByRole("button", { name: / · .* · / }).first();
  await expect(quietRow).toBeVisible();
  const needsReview = page.getByRole("radio", { name: "Needs Review", exact: true });
  await needsReview.click();
  await expect(needsReview).toHaveAttribute("aria-checked", "true");
  const eyeRow = page.getByRole("button", { name: / · .* · / }).first();
  await expect(eyeRow).toBeVisible();
  await captureSurface(page, testInfo, `eye-flows-${testInfo.project.name}.png`);
  const eyeContext = await eyeRow.getAttribute("aria-label");
  await eyeRow.click();

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Current Eye state", { exact: true })).toBeVisible();
  await expect(detail.getByText("Latest evaluation data quality", { exact: true })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Mark Reviewed", exact: true })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Archive Eye", exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `eye-detail-${testInfo.project.name}.png`);

  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(eyeRow).toBeFocused();
  await expect(eyeRow).toHaveAttribute("aria-label", eyeContext ?? "");
  await expect(needsReview).toHaveAttribute("aria-checked", "true");
});

test("Mark Reviewed keeps the Eye row and Watchlist context available on return", async ({ page }) => {
  await openSampleWorkspace(page);
  await openTab(page, "Watchlist");
  await selectApple(page);
  const reviewEyes = page.getByRole("button", { name: "Review Eyes", exact: true });
  await reviewEyes.scrollIntoViewIfNeeded();
  await reviewEyes.click();

  const all = page.getByRole("radio", { name: "All", exact: true });
  await all.click();
  const eyeRow = page.getByRole("button", { name: / · .* · / }).first();
  await expect(eyeRow).toBeVisible();
  const eyeContext = await eyeRow.getAttribute("aria-label");
  const invoker = page.getByRole("button", { name: eyeContext ?? "", exact: true });
  await eyeRow.click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("button", { name: "Mark Reviewed", exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Mark Reviewed", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(invoker).toBeFocused();
  await expect(all).toHaveAttribute("aria-checked", "true");
});

test("Journal decision detail preserves historical evidence and exact row focus", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await openSampleWorkspace(page);
  await openTab(page, "Journal");
  await page.getByTestId("journal-filter-control-Entered").click();
  const inspect = page.getByRole("button", { name: "Open decision evidence", exact: true }).first();
  await expect(inspect).toBeVisible();
  await inspect.scrollIntoViewIfNeeded();
  await inspect.click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("Historical record", { exact: true })).toBeVisible();
  await expect(detail.getByText("State at decision", { exact: true })).toBeVisible();
  await expect(detail.getByText("Data quality", { exact: true })).toBeVisible();
  await expect(detail.getByText("Thesis and timing", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `decision-detail-${testInfo.project.name}.png`);
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(inspect).toBeFocused();
  await expect(page.getByTestId("journal-filter-control-Entered")).toHaveAttribute("aria-checked", "true");
});

test("Scanner review uses supported scan output and records its evidence limitation honestly", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  let interceptedMarketDataRequests = 0;
  let universeFetchStatus: number | null = null;
  let universeByteLength = 0;
  const universeFixtureRows = [
    ["AAPL", "Apple Inc.", "Information Technology"],
    ["AMZN", "Amazon.com", "Consumer Discretionary"],
    ["CAT", "Caterpillar Inc.", "Industrials"],
    ...Array.from({ length: 397 }, (_, index) => [`HOLD${String(index + 1).padStart(4, "0")}`, `Ignored constituent ${index + 1}`, "Outside scanner sectors"]),
  ];
  const universeFixture = ["Symbol,Name,Sector", ...universeFixtureRows.map((row) => row.join(","))].join("\n");
  await page.route(/^https:\/\/raw\.githubusercontent\.com\/datasets\/s-and-p-500-companies\/master\/data\/constituents\.csv$/, async (route) => {
    universeFetchStatus = 200;
    universeByteLength = Buffer.byteLength(universeFixture, "utf8");
    await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "text/csv" }, body: universeFixture });
  });
  await page.route(/^https:\/\/stooq\.com\/q\/d\/l\//, async (route) => {
    interceptedMarketDataRequests += 1;
    await route.fulfill({ status: 503, headers: { "access-control-allow-origin": "*" }, body: "temporarily unavailable" });
  });

  await openSampleWorkspace(page);
  await openTab(page, "Recipes");
  const runScan = page.getByRole("button", { name: "Run supported daily scan", exact: true });
  await runScan.click();
  const reviewSignal = page.getByRole("button", { name: "Open review record", exact: true }).first();
  await expect(reviewSignal).toBeVisible({ timeout: 45_000 });
  expect(universeFetchStatus).toBe(200);
  expect(interceptedMarketDataRequests).toBeGreaterThan(0);
  const scannerEvidence = {
    source: "supported daily scan action",
    deterministicFixtureProvenance: {
      universeSource: "deterministic test-only CSV served to the supported scanner universe fetch path",
      universeFixtureRowCount: universeFixtureRows.length,
      universeFixtureSymbols: ["AAPL", "AMZN", "CAT"],
      unmappedRowsIgnored: universeFixtureRows.length - 3,
      marketDataProvider: "Stooq",
      marketDataFixtureStatus: 503,
      signalState: "generated by the production scanner from missing market bars; no signal records injected",
    },
    universeFetchStatus,
    universeByteLength,
    interceptedMarketDataRequests,
    configuredStooqResponseStatus: 503,
    status: "BLOCKED_SIGNAL_RETAINED",
    explanation: "The supported scan retained an incomplete-data signal from deterministic provider-failure input. The scanner generated the signal; the test did not inject one.",
  };
  await testInfo.attach("scanner-provider-limitation.json", {
    body: Buffer.from(JSON.stringify(scannerEvidence, null, 2)),
    contentType: "application/json",
  });
  await reviewSignal.click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("Signal state and limitation", { exact: true })).toBeVisible();
  await expect(detail.getByText(/blocked/i).first()).toBeVisible();
  await expect(detail.getByText(/does not place an order, record a fill, or imply a return/i)).toBeVisible();
  await captureSurface(page, testInfo, `scanner-review-${testInfo.project.name}.png`);
  const save = detail.getByRole("button", { name: "Save Log", exact: true });
  await expect(save).toBeDisabled();
  await detail.getByRole("radio", { name: "Watch", exact: true }).click();
  await expect(save).toBeDisabled();
  await detail.getByRole("textbox", { name: "Manual reason, required", exact: true }).fill("Manual review of incomplete source coverage.");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(detail).toHaveCount(0);
  await expect(reviewSignal).toBeFocused();
  await expect(page.getByText("Review recorded", { exact: true })).toBeVisible();

  await openTab(page, "Settings");
  await page.getByTestId("settings-language-control-ko").click();
  const recipesTab = page.getByRole("tab", { name: "레시피", exact: true });
  await recipesTab.click();
  await expect(recipesTab).toHaveAttribute("aria-selected", "true");
  const koreanReviewSignal = page.getByRole("button", { name: "검토 기록 열기", exact: true }).first();
  await expect(koreanReviewSignal).toBeVisible();
  await koreanReviewSignal.click();
  const koreanDetail = page.getByRole("dialog");
  await expect(koreanDetail.getByText("사람의 검토 분류", { exact: true })).toBeVisible();
  await expect(koreanDetail.getByText(/주문, 체결 또는 수익을 만들지 않습니다/)).toBeVisible();
  await captureSurface(page, testInfo, `scanner-review-${testInfo.project.name}-ko.png`);
  await page.keyboard.press("Escape");
  await expect(koreanDetail).toHaveCount(0);
  await expect(koreanReviewSignal).toBeFocused();

  const scannerProfiles = [
    { name: "desktop-stress", width: 1366, height: 768 },
    { name: "mobile-stress", width: 360, height: 800 },
    { name: "mobile-holdout", width: 412, height: 915 },
  ] as const;
  for (const profile of scannerProfiles) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await koreanReviewSignal.click();
    const responsiveDetail = page.getByRole("dialog");
    await expect(responsiveDetail.getByText("사람의 검토 분류", { exact: true })).toBeVisible();
    const detailBounds = await responsiveDetail.boundingBox();
    expect(detailBounds).not.toBeNull();
    expect(detailBounds!.x).toBeGreaterThanOrEqual(0);
    expect(detailBounds!.x + detailBounds!.width).toBeLessThanOrEqual(profile.width);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(profile.width);
    await captureSurface(page, testInfo, `scanner-review-${profile.name}-${testInfo.project.name}-ko.png`);
    const saveLog = responsiveDetail.getByRole("button", { name: "저장", exact: true });
    await saveLog.scrollIntoViewIfNeeded();
    if (profile.width <= 600) {
      const saveBounds = await saveLog.boundingBox();
      const navigationBounds = await page.getByRole("tablist", { name: "주요 탐색", exact: true }).boundingBox();
      expect(saveBounds).not.toBeNull();
      expect(navigationBounds).not.toBeNull();
      expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(navigationBounds!.y);
    }
    await page.keyboard.press("Escape");
    await expect(responsiveDetail).toHaveCount(0);
    await expect(koreanReviewSignal).toBeFocused();
  }
});

test("Deep review surfaces recompose at stress and holdout viewport sizes", async ({ page }, testInfo) => {
  const profiles = [
    { name: "desktop-stress", width: 1366, height: 768 },
    { name: "mobile-stress", width: 360, height: 800 },
    { name: "mobile-holdout", width: 412, height: 915 },
  ] as const;
  await openSampleWorkspace(page);

  for (const profile of profiles) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await openTab(page, "Watchlist");
    if (!(await page.getByRole("heading", { name: "AAPL", exact: true }).isVisible().catch(() => false))) await selectApple(page);
    const selectedStock = page.locator("#watchlist-selected-stock-detail");
    await selectedStock.scrollIntoViewIfNeeded();
    await expect(page.getByText("Stock identity and data authority", { exact: true })).toBeVisible();
    const register = page.getByRole("button", { name: "Register Eye", exact: true });
    const registerBounds = await register.boundingBox();
    const navigationBounds = await page.getByRole("tablist", { name: "Primary navigation", exact: true }).boundingBox();
    expect(registerBounds).not.toBeNull();
    expect(navigationBounds).not.toBeNull();
    if (profile.width <= 600) {
      expect(registerBounds!.y + registerBounds!.height).toBeLessThanOrEqual(navigationBounds!.y);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(profile.width);
    await captureSurface(page, testInfo, `stock-entity-detail-${profile.name}-${testInfo.project.name}.png`);

    const metricInvoker = page.getByRole("button", { name: "Evidence detail", exact: true }).first();
    await metricInvoker.scrollIntoViewIfNeeded();
    await metricInvoker.click();
    const metricDetail = page.getByRole("dialog");
    await expect(metricDetail.getByText("Freshness", { exact: true })).toBeVisible();
    const metricBounds = await metricDetail.boundingBox();
    expect(metricBounds).not.toBeNull();
    expect(metricBounds!.x).toBeGreaterThanOrEqual(0);
    expect(metricBounds!.x + metricBounds!.width).toBeLessThanOrEqual(profile.width);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(profile.width);
    await captureSurface(page, testInfo, `metric-detail-sheet-${profile.name}-${testInfo.project.name}.png`);
    await page.keyboard.press("Escape");
    await expect(metricDetail).toHaveCount(0);
    await expect(metricInvoker).toBeFocused();

    const reviewEyes = page.getByRole("button", { name: "Review Eyes", exact: true });
    await reviewEyes.scrollIntoViewIfNeeded();
    await reviewEyes.click();
    const needsReview = page.getByRole("radio", { name: "Needs Review", exact: true });
    await needsReview.click();
    const eyeInvoker = page.getByRole("button", { name: / · .* · / }).first();
    await expect(eyeInvoker).toBeVisible();
    await captureSurface(page, testInfo, `eye-flows-${profile.name}-${testInfo.project.name}.png`);
    const eyeContext = await eyeInvoker.getAttribute("aria-label");
    await eyeInvoker.click();
    const eyeDetail = page.getByRole("dialog");
    const eyeBounds = await eyeDetail.boundingBox();
    expect(eyeBounds).not.toBeNull();
    expect(eyeBounds!.x).toBeGreaterThanOrEqual(0);
    expect(eyeBounds!.x + eyeBounds!.width).toBeLessThanOrEqual(profile.width);
    await expect(eyeDetail.getByText("Latest evaluation data quality", { exact: true })).toBeVisible();
    await captureSurface(page, testInfo, `eye-detail-${profile.name}-${testInfo.project.name}.png`);
    await page.keyboard.press("Escape");
    await expect(eyeDetail).toHaveCount(0);
    await expect(page.getByRole("button", { name: eyeContext ?? "", exact: true })).toBeFocused();

    await openTab(page, "Journal");
    await page.getByTestId("journal-filter-control-Entered").click();
    const decisionInvoker = page.getByRole("button", { name: "Open decision evidence", exact: true }).first();
    await expect(decisionInvoker).toBeVisible();
    await decisionInvoker.scrollIntoViewIfNeeded();
    await decisionInvoker.click();
    const decisionDetail = page.getByRole("dialog");
    const decisionBounds = await decisionDetail.boundingBox();
    expect(decisionBounds).not.toBeNull();
    expect(decisionBounds!.x).toBeGreaterThanOrEqual(0);
    expect(decisionBounds!.x + decisionBounds!.width).toBeLessThanOrEqual(profile.width);
    await expect(decisionDetail.getByText("Data quality", { exact: true })).toBeVisible();
    await captureSurface(page, testInfo, `decision-detail-${profile.name}-${testInfo.project.name}.png`);
    await page.keyboard.press("Escape");
    await expect(decisionDetail).toHaveCount(0);
    await expect(decisionInvoker).toBeFocused();
  }
});

test("Korean copy preserves critical meaning across deep review surfaces", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await openSampleWorkspace(page);
  await openTab(page, "Settings");
  await page.getByTestId("settings-language-control-ko").click();

  await openTab(page, "관심 종목");
  await page.getByRole("textbox", { name: "종목 검색 또는 다시 열기" }).fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
  await expect(page.getByText("종목 정체성과 데이터 권한", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `stock-entity-detail-${testInfo.project.name}-ko.png`);
  const metricInvoker = page.getByRole("button", { name: "근거 상세", exact: true }).first();
  await metricInvoker.scrollIntoViewIfNeeded();
  await metricInvoker.click();
  const metricDetail = page.getByRole("dialog");
  await expect(metricDetail.getByText("지금 눈에 띄는 점", { exact: true })).toBeVisible();
  await expect(metricDetail.getByText("최신성", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `metric-detail-sheet-${testInfo.project.name}-ko.png`);
  await page.keyboard.press("Escape");
  await expect(metricDetail).toHaveCount(0);
  await expect(metricInvoker).toBeFocused();

  const reviewEyes = page.getByRole("button", { name: "관찰 항목 검토", exact: true });
  await reviewEyes.scrollIntoViewIfNeeded();
  await reviewEyes.click();
  const needsReview = page.getByRole("radio", { name: "검토 필요", exact: true });
  await needsReview.click();
  const eyeInvoker = page.getByRole("button", { name: / · .* · / }).first();
  await expect(eyeInvoker).toBeVisible();
  await captureSurface(page, testInfo, `eye-flows-${testInfo.project.name}-ko.png`);
  const eyeContext = await eyeInvoker.getAttribute("aria-label");
  await eyeInvoker.click();
  const eyeDetail = page.getByRole("dialog");
  await expect(eyeDetail.getByText("현재 모니터 상태", { exact: true })).toBeVisible();
  await expect(eyeDetail.getByText("최근 평가 데이터 품질", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `eye-detail-${testInfo.project.name}-ko.png`);
  await page.keyboard.press("Escape");
  await expect(eyeDetail).toHaveCount(0);
  await expect(page.getByRole("button", { name: eyeContext ?? "", exact: true })).toBeFocused();

  await openTab(page, "기록");
  await page.getByTestId("journal-filter-control-Entered").click();
  const decisionInvoker = page.getByRole("button", { name: "결정 근거 보기", exact: true }).first();
  await expect(decisionInvoker).toBeVisible();
  await decisionInvoker.scrollIntoViewIfNeeded();
  await decisionInvoker.click();
  const decisionDetail = page.getByRole("dialog");
  await expect(decisionDetail.getByText("과거 기록", { exact: true })).toBeVisible();
  await expect(decisionDetail.getByText("결정 맥락", { exact: true })).toBeVisible();
  await captureSurface(page, testInfo, `decision-detail-${testInfo.project.name}-ko.png`);
  await page.keyboard.press("Escape");
  await expect(decisionDetail).toHaveCount(0);
  await expect(decisionInvoker).toBeFocused();
});
