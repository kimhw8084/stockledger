import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const openSettingsSection = async (page: import("@playwright/test").Page, title: string) => {
  const section = page.getByRole("button", { name: title, exact: true });
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
  await expect(section).toHaveAttribute("aria-expanded", "true");
};
test("create a real watchlist, reload it, and restore a validated file backup", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const external: string[] = [];
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1") && !request.url().startsWith("data:")) external.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add your first stock" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("first-run.png"), fullPage: true });
  await page.getByRole("button", { name: "Add your first stock" }).click();
  await page.getByRole("textbox", { name: "Ticker, e.g. AAPL" }).fill("AAPL");
  await page.getByRole("textbox", { name: "Company name", exact: true }).fill("Apple");
  await page.getByRole("textbox", { name: "Your thesis and what would change your mind" }).fill("Watch recurring revenue; review the next published results.");
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save stock", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Add your first stock" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Watchlist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AAPL", exact: true })).toBeVisible();
  await expect(page.getByText("Apple", { exact: true })).toBeVisible();
  // Header actions must stay inside the viewport, including with Linux fonts.
  const settingsBounds = await page.getByRole("button", { name: "Settings", exact: true }).boundingBox();
  expect(settingsBounds).not.toBeNull();
  expect(settingsBounds!.x + settingsBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await openSettingsSection(page, "Workspace and data");
  await expect(page.getByText("Your workspace", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.data.stocks).toHaveLength(1);
  expect(exported.data.stocks[0].symbol).toBe("AAPL");
  expect(exported.data.snapshots[0].isMock).toBe(false);
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose backup file" }).click();
  await (await fileChooser).setFiles(path!);
  await page.getByRole("button", { name: "Validate backup", exact: true }).click();
  await expect(page.getByText(/Backup validated/)).toBeVisible();
  const beforeRestore = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current data and restore this backup" }).click();
  await beforeRestore;
  await expect(page.getByText("Backup restored.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("sample data requires a deliberate action and all main sections render", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
  for (const name of ["Watchlist", "Recipes", "Journal", "Today"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Journal", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Journal", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("sample-today.png"), fullPage: true });
});
test("keeps a damaged workspace available for export and restores its previous saved copy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("stockledger", 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction("documents", "readwrite"); tx.objectStore("documents").put("damaged fixture", "stockledger.appData.v2"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Export recovery copy" })).toBeVisible();
  const recoveryPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export recovery copy" }).click();
  const recovery = JSON.parse(await readFile((await (await recoveryPromise).path())!, "utf8"));
  expect(recovery.current).toBe("damaged fixture");
  await page.getByRole("button", { name: "Restore previous saved copy" }).click();
  await expect(page.getByRole("button", { name: "Add your first stock" })).toBeVisible();
});
test("records a deliberate decision, reviews its outcome, and preserves an amendment", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("tab", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("combobox", { name: "Eye", exact: true }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "AMD", exact: true }).click();
  await page.getByRole("textbox", { name: "Why did you enter, skip, or revise?" }).fill("Regression review: wait for confirmed evidence.");
  await page.getByRole("button", { name: "Save Decision", exact: true }).click();
  await expect(page.getByText("Choose your thesis assessment.")).toBeVisible();
  await page.getByRole("button", { name: "Partly", exact: true }).click();
  await page.getByRole("button", { name: "Early", exact: true }).click();
  await page.getByRole("button", { name: "Save Decision", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "What did you learn?" })).toBeVisible();
  await page.getByRole("textbox", { name: "What did you learn?" }).fill("Verify coverage before drawing conclusions.");
  await page.getByRole("button", { name: "Save outcome review", exact: true }).click();
  await expect(page.getByText("Outcome review saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Why did you enter, skip, or revise?" }).fill("Regression amendment: reviewed the source.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("Previous authored versions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous authored versions", exact: true }).click();
  await expect(page.getByText(/Regression review: wait for confirmed evidence/)).toBeVisible();
});

test("keeps cloud optional and exposes the localized local-first account boundary", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await openSettingsSection(page, "Sync and account state");
  await expect(page.getByRole("heading", { name: "Optional personal cloud sync" })).toBeVisible();
  await expect(page.getByText("Cloud sync is not configured for this build.", { exact: false })).toBeVisible();
  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  await openSettingsSection(page, "동기화 및 계정 상태");
  await expect(page.getByText("선택적 개인 클라우드 동기화", { exact: true })).toBeVisible();
  await expect(page.getByText("이 빌드에는 클라우드 동기화가 설정되지 않았습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 클라우드 데이터 내보내기", exact: true })).toHaveCount(0);
});

test("keeps notification consent explicit and exposes device-local delivery status", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await openSettingsSection(page, "Notification settings and delivery state");
  await expect(page.getByRole("heading", { name: "Notification delivery", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email destination", exact: true }).fill("local@example.test");
  await page.getByRole("button", { name: "Enable email delivery", exact: true }).click();
  await page.getByRole("button", { name: "Save notification preferences", exact: true }).click();
  await expect(page.getByText("Email destination saved", { exact: true })).toBeVisible();
  await expect(page.getByText(/server-only local worker/)).toBeVisible();
  await openSettingsSection(page, "Workspace and data");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete backup", exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.data.notificationPreferences.enabled).toBe(true);
  expect(exported.data.notificationPreferences.accountScope).toBe("device-local");
  const disable = page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true });
  await disable.click();
  const confirmation = page.getByRole("dialog");
  await expect(confirmation.getByRole("heading", { name: "Turn off notification delivery?", exact: true })).toBeVisible();
  await expect(confirmation.getByText(/withdraws your consent.*clears allowed channels/)).toBeVisible();
  await expect(page.getByText("Off", { exact: true })).toHaveCount(0);
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(disable).toBeFocused();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
  const canceledDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete backup", exact: true }).click();
  const canceledDownload = await canceledDownloadPromise;
  const canceledExported = JSON.parse(await readFile((await canceledDownload.path())!, "utf8"));
  expect(canceledExported.data.notificationPreferences).toEqual(exported.data.notificationPreferences);

  await disable.click();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(disable).toBeFocused();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  const koreanDisable = page.getByRole("button", { name: "옵트아웃하고 이후 전달 취소", exact: true });
  await koreanDisable.click();
  const koreanConfirmation = page.getByRole("dialog");
  await expect(koreanConfirmation.getByRole("heading", { name: "알림 전달을 끌까요?", exact: true })).toBeVisible();
  await expect(koreanConfirmation.getByRole("button", { name: "취소", exact: true })).toBeVisible();
  await expect(koreanConfirmation.getByRole("button", { name: "알림 끄기", exact: true })).toBeVisible();
  await koreanConfirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(koreanConfirmation).toHaveCount(0);
  await expect(koreanDisable).toBeFocused();
  await page.getByRole("radio", { name: "English", exact: true }).click();

  const englishDisable = page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true });
  await englishDisable.click();
  await page.getByRole("dialog").getByRole("button", { name: "Turn off notifications", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const enable = page.getByRole("button", { name: "Enable email delivery", exact: true });
  await expect(enable).toBeFocused();
  await expect(page.getByText("Off", { exact: true })).toBeVisible();

  const disabledDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete backup", exact: true }).click();
  const disabledDownload = await disabledDownloadPromise;
  const disabledExported = JSON.parse(await readFile((await disabledDownload.path())!, "utf8"));
  expect(disabledExported.data.notificationPreferences.explicitConsent).toBe(false);
  expect(disabledExported.data.notificationPreferences.enabled).toBe(false);
  expect(disabledExported.data.notificationPreferences.allowedChannels).toEqual([]);
  expect(disabledExported.data.notificationPreferences.destinations.email.address).toBe("local@example.test");
});

test("shows imported last-known worker state and pending preference handoff", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await openSettingsSection(page, "Workspace and data");
  await openSettingsSection(page, "Notification settings and delivery state");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete backup", exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  exported.data.notificationPreferences = {
    ...exported.data.notificationPreferences,
    enabled: false,
    explicitConsent: false,
    allowedChannels: [],
    destinations: {},
  };
  exported.data.lastKnownNotificationDeliveryStatus = {
    contractVersion: "stockledger-notification-status-v1",
    revision: 1,
    generatedAt: "2026-09-18T12:05:00.000Z",
    channel: "email",
    lastIntentId: "notification-handoff",
    lastState: "canceled",
    attemptCount: 0,
    preferenceUpdatedAt: exported.data.notificationPreferences.updatedAt,
    preferenceHash: "0".repeat(64),
  };
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose backup file", exact: true }).click();
  await (await fileChooser).setFiles({ name: "worker-export.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole("button", { name: "Validate backup", exact: true }).click();
  await expect(page.getByText(/Backup validated/)).toBeVisible();
  await page.getByRole("button", { name: "Export current data and restore this backup" }).click();
  await expect(page.getByText(/Last-known worker state \(not live monitoring\): Canceled \/ disabled/)).toBeVisible();
  await page.getByRole("textbox", { name: "Email destination", exact: true }).fill("handoff@example.test");
  await page.getByRole("button", { name: "Enable email delivery", exact: true }).click();
  await expect(page.getByText("Pending worker handoff", { exact: true })).toBeVisible();
  await expect(page.getByText(/this app preference is new/)).toBeVisible();
});

test("resolves entity links, fails safely, and preserves language preference", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();

  const homeHelpInvoker = page.getByRole("button", { name: "Summary help", exact: true });
  const homeHelpFallback = page.getByRole("tab", { name: "Today", exact: true });
  await expect(homeHelpInvoker).toBeVisible();
  await homeHelpFallback.focus();
  await expect(homeHelpFallback).toBeFocused();
  await homeHelpInvoker.click();
  const homeHelpDialog = page.getByRole("dialog");
  await expect(homeHelpDialog).toBeVisible();
  await expect(homeHelpDialog.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(homeHelpDialog).toHaveCount(0);
  await expect(homeHelpInvoker).toBeFocused();

  await homeHelpInvoker.click();
  await expect(homeHelpDialog.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await homeHelpDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(homeHelpDialog).toHaveCount(0);
  await expect(homeHelpInvoker).toBeFocused();

  await homeHelpInvoker.click();
  await expect(homeHelpDialog).toBeVisible();
  await homeHelpInvoker.evaluate((element) => element.remove());
  await homeHelpDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(homeHelpDialog).toHaveCount(0);
  await expect(homeHelpFallback).toBeFocused();

  await page.goto("/#/watchlist?stockId=stock-amd");
  await expect(page.getByText("Advanced Micro Devices", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Advanced Micro Devices", { exact: true }).first()).toBeVisible();

  await page.goto("/#/monitoring?stockId=stock-amd&eyeId=eye-amd");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("AMD", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "Journal", exact: true }).click();
  const newEntry = page.getByRole("button", { name: "New", exact: true });
  await newEntry.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(newEntry).toBeFocused();
  await newEntry.click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(newEntry).toBeFocused();

  await page.goto("/#/watchlist?stockId=missing-entity");
  await expect(page.getByRole("alert").getByText("This link is no longer available", { exact: true })).toBeVisible();
  await expect(page.getByText("Search any stock and inspect the full board", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  await expect(page.getByRole("tab", { name: "관심 종목", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "오늘", exact: true }).click();
  await expect(page.getByText("시각 트리아지", { exact: true })).toBeVisible();
  await expect(page.getByText("결정 루프", { exact: true })).toBeVisible();
  await expect(page.getByText("모니터링 보드", { exact: true })).toBeVisible();
  await expect(page.getByText("AMD", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "설정", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "오늘", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "오늘", exact: true }).click();
  await expect(page.getByText("결정 루프", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "관심 종목", exact: true }).click();
  await page.getByRole("button", { name: "AMD · Advanced Micro Devices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AMD", exact: true })).toBeVisible();
  await expect(page.getByText("Advanced Micro Devices", { exact: true }).first()).toBeVisible();
  await page.goto("/#/monitoring?stockId=stock-amd&eyeId=eye-amd");
  await expect(page.getByText("Deep discount logic.", { exact: true }).first()).toBeVisible();
});

test("home help prefers its explicit press target over stale active focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  const homeHelpInvoker = page.getByRole("button", { name: "Summary help", exact: true });
  const staleActiveControl = page.getByRole("tab", { name: "Today", exact: true });
  await staleActiveControl.focus();
  await expect(staleActiveControl).toBeFocused();

  // Dispatch the press while B remains active so the callback receives A as currentTarget.
  await homeHelpInvoker.dispatchEvent("click");
  const homeHelpDialog = page.getByRole("dialog");
  await expect(homeHelpDialog).toBeVisible();
  await homeHelpDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(homeHelpDialog).toHaveCount(0);
  await expect(homeHelpInvoker).toBeFocused();
});
