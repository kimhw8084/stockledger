import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium } from "/Users/haewonkim/.codex-fabric/worktrees/CF-bcf7ed56e73e87dc270f0ddf/node_modules/playwright/index.mjs";

const root = "/Users/haewonkim/.codex-fabric/runs/stockledger/stockledger-prod-c16-authoring-config-lawbook-v1/visual-atlas";
const baseURL = "http://127.0.0.1:43187";
const locales = [
  { key: "en", settings: "Settings", languageOption: "English", watchlist: "Watchlist", recipes: "Recipes", journal: "Journal", rawData: "Raw Data", newRecipe: "New Recipe", registry: "Open raw data registry", email: "Email destination", enable: "Enable email delivery", savePreferences: "Save notification preferences", notificationsSection: "Notification settings and delivery state", disable: "Opt out and cancel future delivery" },
  { key: "ko", settings: "설정", languageOption: "한국어", watchlist: "관심 종목", recipes: "레시피", journal: "기록", rawData: "Raw Data", newRecipe: "새 레시피 만들기", registry: "원천 데이터 레지스트리 열기", email: "이메일 수신 주소", enable: "이메일 전달 사용", savePreferences: "알림 설정 저장", notificationsSection: "알림 설정과 전달 상태", disable: "옵트아웃하고 이후 전달 취소" },
];
const viewports = [
  { profile: "desktop-1440x900", width: 1440, height: 900, folder: "canonical" },
  { profile: "mobile-390x844", width: 390, height: 844, folder: "canonical" },
  { profile: "desktop-1366x768", width: 1366, height: 768, folder: "stress" },
  { profile: "mobile-360x800", width: 360, height: 800, folder: "stress" },
  { profile: "mobile-412x915", width: 412, height: 915, folder: "holdout" },
];
const surfaces = ["eye-composer", "journal-composer", "recipe-builder", "logic-registry", "notification-confirmation"];
const captured = [];

async function newPage(browser, locale, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: locale.key === "ko" ? "ko-KR" : "en-US",
  });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
  await page.getByText(/Sample data is present/).waitFor({ state: "visible" });
  if (locale.key === "ko") {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-language-control").getByRole("radio", { name: locale.languageOption, exact: true }).click();
    await page.getByRole("tab", { name: locale.watchlist, exact: true }).waitFor({ state: "visible" });
  }
  return { context, page };
}

async function openSurface(page, locale, surface) {
  if (surface === "eye-composer") {
    await page.getByRole("tab", { name: locale.watchlist, exact: true }).click();
    const searchName = locale.key === "ko" ? "종목 검색 또는 다시 열기" : "Search or resume a stock";
    await page.getByRole("textbox", { name: searchName, exact: true }).fill("AAPL");
    await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
    await page.getByRole("button", { name: locale.key === "ko" ? "관찰 항목 등록" : "Register Eye", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: locale.key === "ko" ? "모니터 만들기" : "Create Eye", exact: true }).waitFor({ state: "visible" });
    return dialog;
  }
  if (surface === "journal-composer") {
    await page.getByRole("tab", { name: locale.journal, exact: true }).click();
    await page.getByRole("button", { name: locale.key === "ko" ? "새 기록" : "New", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    return dialog;
  }
  if (surface === "recipe-builder") {
    await page.getByRole("tab", { name: locale.recipes, exact: true }).click();
    await page.getByTestId("recipe-layer-control-Sets").click();
    await page.getByRole("button", { name: locale.newRecipe, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    return dialog;
  }
  if (surface === "logic-registry") {
    await page.getByRole("tab", { name: locale.recipes, exact: true }).click();
    await page.getByTestId("recipe-layer-control-Raw Data").click();
    await page.getByRole("button", { name: locale.registry, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: locale.key === "ko" ? "원천 데이터 레지스트리" : "Raw Data Registry", exact: true }).waitFor({ state: "visible" });
    return dialog;
  }
  if (surface === "notification-confirmation") {
    await page.getByRole("button", { name: locale.settings, exact: true }).click();
    const notifications = page.getByRole("button", { name: locale.notificationsSection, exact: true });
    if (await notifications.getAttribute("aria-expanded") !== "true") await notifications.click();
    const email = page.getByRole("textbox", { name: locale.email, exact: true });
    await email.fill("review@example.test");
    await page.getByRole("button", { name: locale.enable, exact: true }).click();
    await page.getByRole("button", { name: locale.savePreferences, exact: true }).click();
    await page.getByRole("button", { name: locale.disable, exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: locale.disable, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: locale.key === "ko" ? "알림 전달을 끌까요?" : "Turn off notification delivery?", exact: true }).waitFor({ state: "visible" });
    return dialog;
  }
  throw new Error(`Unknown surface: ${surface}`);
}

async function metrics(page, viewport, surface) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth),
      dialogRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    };
  });
  if (result.viewport.width !== viewport.width || result.viewport.height !== viewport.height) throw new Error(`Viewport mismatch for ${surface}: ${JSON.stringify(result)}`);
  if (result.horizontalOverflowPx > 0) throw new Error(`Horizontal overflow on ${surface}: ${JSON.stringify(result)}`);
  if (result.dialogRect && (result.dialogRect.x < -1 || result.dialogRect.y < -1 || result.dialogRect.x + result.dialogRect.width > viewport.width + 1 || result.dialogRect.y + result.dialogRect.height > viewport.height + 1)) {
    throw new Error(`Dialog escapes viewport on ${surface}: ${JSON.stringify(result)}`);
  }
  return result;
}

async function saveCapture(page, locale, viewport, surface) {
  const dialog = await openSurface(page, locale, surface);
  await dialog.waitFor({ state: "visible" });
  await page.waitForTimeout(80);
  const check = await metrics(page, viewport, surface);
  const section = viewport.folder === "holdout" ? "holdout" : viewport.folder;
  const path = join(root, "captures", section, locale.key, viewport.profile, `${surface}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false, animations: "disabled", caret: "hide", scale: "css" });
  const bytes = await (await import("node:fs/promises")).readFile(path);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const state = surface === "logic-registry" ? "ready" : surface === "notification-confirmation" ? "confirmation" : "open";
  const key = `stockledger|surface:${surface}|canonical|${state}|reference-user|light|${viewport.profile}`;
  captured.push({ key, surface, state, locale: locale.key, viewport: viewport.profile, path: path.slice(root.length + 1), sha256: digest, bytes: bytes.length, metrics: check });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const locale of locales) {
    for (const viewport of viewports) {
      for (const surface of surfaces) {
        const { context, page } = await newPage(browser, locale, viewport);
        try {
          await saveCapture(page, locale, viewport, surface);
          process.stdout.write(`captured ${locale.key} ${viewport.profile} ${surface}\n`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(resolve(root, "capture-metrics.json"), `${JSON.stringify({ candidate: "48aef5d8be21e83a95d299a78da7ab61557006ec", tree: "3c71b82219068c3aec4e620e19f786ae50a580f2", reducedMotion: "reduce", captures: captured }, null, 2)}\n`);
process.stdout.write(`capture count ${captured.length}\n`);
