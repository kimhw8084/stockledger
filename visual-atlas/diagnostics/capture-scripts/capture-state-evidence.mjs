import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium } from "/Users/haewonkim/.codex-fabric/worktrees/CF-bcf7ed56e73e87dc270f0ddf/node_modules/playwright/index.mjs";

const root = "/Users/haewonkim/.codex-fabric/runs/stockledger/stockledger-prod-c16-authoring-config-lawbook-v1/visual-atlas";
const baseURL = "http://127.0.0.1:43187";
const viewport = { width: 1440, height: 900 };
const states = [];

async function createPage(browser, sample = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  if (sample) {
    await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
    await page.getByText(/Sample data is present/).waitFor({ state: "visible" });
  }
  return { context, page };
}

async function capture(page, name, note) {
  await page.waitForTimeout(80);
  const geometry = await page.evaluate(() => {
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
  if (geometry.horizontalOverflowPx > 0) throw new Error(`${name} has horizontal overflow: ${JSON.stringify(geometry)}`);
  const path = join(root, "captures", "states", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false, animations: "disabled", caret: "hide", scale: "css" });
  const bytes = await readFile(path);
  states.push({ name, path: path.slice(root.length + 1), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, note, geometry });
  process.stdout.write(`captured state ${name}\n`);
}

async function openEye(page) {
  await page.getByRole("tab", { name: "Watchlist", exact: true }).click();
  await page.getByRole("textbox", { name: "Search or resume a stock", exact: true }).fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
  await page.getByRole("button", { name: "Register Eye", exact: true }).click();
  return page.getByRole("dialog");
}

async function selectFirstOption(dialog, fieldID) {
  const field = dialog.getByTestId(fieldID);
  await field.fill("");
  const option = dialog.locator(`[data-testid^="${fieldID}-option-"]`).first();
  await option.waitFor({ state: "visible" });
  await option.click();
}

async function openSettingsNotifications(page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("button", { name: "Notification settings and delivery state", exact: true });
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
  return section;
}

async function enableNotifications(page) {
  await openSettingsNotifications(page);
  await page.getByRole("textbox", { name: "Email destination", exact: true }).fill("review@example.test");
  const enable = page.getByRole("button", { name: "Enable email delivery", exact: true });
  if (await enable.count()) await enable.click();
  await page.getByRole("button", { name: "Save notification preferences", exact: true }).click();
  await page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true }).waitFor({ state: "visible" });
}

const browser = await chromium.launch({ headless: true });
try {
  {
    const { context, page } = await createPage(browser);
    try {
      let dialog = await openEye(page);
      await dialog.getByTestId("eye-stock").fill("");
      await dialog.getByTestId("eye-save").click();
      await dialog.getByText("Select a stock.", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "eye-blank-validation", "Required stock, recipe, and thesis errors adjacent to their fields.");
      await selectFirstOption(dialog, "eye-stock");
      await selectFirstOption(dialog, "eye-recipe");
      await dialog.getByTestId("eye-thesis").fill("Review source coverage before drawing a conclusion.");
      await dialog.getByTestId("eye-entry-low").fill("120");
      await dialog.getByTestId("eye-entry-high").fill("110");
      await dialog.getByTestId("eye-invalidation").fill("Revisit if the reported source loses required coverage.");
      await dialog.getByTestId("eye-save").click();
      await dialog.getByText("Entry low must not be above entry high.", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "eye-invalid-range", "Reversed optional range shows actionable errors and keeps the entered values.");
      await dialog.getByTestId("eye-entry-low").fill("100");
      await dialog.getByTestId("eye-entry-high").fill("110");
      await dialog.getByTestId("eye-save").click();
      await dialog.waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Manage Eyes", exact: true }).click();
      const thesis = "Review source coverage before drawing a conclusion.";
      await page.getByText(thesis, { exact: true }).waitFor({ state: "visible" });
      const row = page.getByText(thesis, { exact: true }).locator("xpath=ancestor::*[@role='button'][1]");
      await row.click();
      const detail = page.getByRole("dialog");
      await detail.getByRole("button", { name: "Edit", exact: true }).click();
      dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Edit Eye", exact: true }).waitFor({ state: "visible" });
      await capture(page, "eye-edit", "Edit mode restores the exact authored thesis and invalidation rule.");
    } finally { await context.close(); }
  }

  {
    const { context, page } = await createPage(browser);
    try {
      await page.getByRole("tab", { name: "Journal", exact: true }).click();
      await page.getByRole("button", { name: "New", exact: true }).click();
      let dialog = page.getByRole("dialog");
      await dialog.getByTestId("journal-save").click();
      await dialog.getByText("Select an Eye.", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "journal-required-validation", "The current required Journal context is identified without surfacing future errors.");
      await selectFirstOption(dialog, "journal-eye");
      await dialog.getByRole("radio", { name: "Entered", exact: true }).click();
      await dialog.getByTestId("journal-note").fill("I am waiting for a second source before recording a conclusion.");
      await dialog.getByTestId("journal-concern").fill("Coverage may differ across providers.");
      await dialog.getByRole("radio", { name: "Partly", exact: true }).click();
      await dialog.getByRole("radio", { name: "Early", exact: true }).click();
      await dialog.getByTestId("journal-save").click();
      dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Edit", exact: true }).click();
      dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Amend Journal Entry", exact: true }).waitFor({ state: "visible" });
      await capture(page, "journal-amend", "Amend mode preserves the authored note and optional concern.");
    } finally { await context.close(); }
  }

  {
    const { context, page } = await createPage(browser);
    try {
      await page.getByRole("tab", { name: "Recipes", exact: true }).click();
      await page.getByTestId("recipe-layer-control-Sets").click();
      await page.getByRole("button", { name: "New Recipe", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByTestId("recipe-continue").click();
      await dialog.getByText("Recipe name is required.", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "recipe-purpose-validation", "The Purpose step names only the information required for that step.");
      const recipeName = "CHG-199 Visual Evidence Review";
      await dialog.getByTestId("recipe-name").fill(recipeName);
      await dialog.getByTestId("recipe-purpose").fill("Review supported source inputs and preserve their limits.");
      await dialog.getByTestId("recipe-continue").click();
      await dialog.getByTestId("recipe-continue").click();
      await dialog.getByText("Add at least one condition.", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "recipe-logic-validation", "The Logic step asks for at least one supported condition.");
      await dialog.getByTestId("recipe-condition-note").fill("Check a supported price-derived condition.");
      await dialog.getByTestId("recipe-add-condition").click();
      await dialog.getByTestId("recipe-continue").click();
      await dialog.getByTestId("recipe-notes").fill("Review source limitations with each result.");
      await dialog.getByTestId("recipe-continue").click();
      await dialog.getByRole("heading", { name: "Review & Outcome", exact: true }).waitFor({ state: "visible" });
      await capture(page, "recipe-final-review", "The final step reviews purpose, supported logic, risk notes, and review cadence before saving.");
      await dialog.getByTestId("recipe-save").click();
      await page.getByText(recipeName, { exact: true }).waitFor({ state: "visible" });
      const row = page.getByText(recipeName, { exact: true }).locator("xpath=ancestor::*[starts-with(@data-testid,'recipe-set-row-')][1]");
      await row.getByRole("button", { name: "Open set detail", exact: true }).click();
      const detail = page.getByRole("dialog");
      await detail.getByText(recipeName, { exact: true }).waitFor({ state: "visible" });
      await capture(page, "recipe-version-context", "Saved Recipe detail exposes its version context and persisted monitoring intent.");
    } finally { await context.close(); }
  }

  {
    const { context, page } = await createPage(browser);
    try {
      await page.getByRole("tab", { name: "Recipes", exact: true }).click();
      await page.getByTestId("recipe-layer-control-Raw Data").click();
      await page.getByRole("button", { name: "Open raw data registry", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: "Search fields", exact: true }).fill("priceHistorySeries");
      const field = dialog.getByRole("button", { name: "Price history series, priceHistorySeries", exact: true });
      await field.click();
      await dialog.getByText("Declared source and coverage", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "registry-field-detail", "The identifier, meaning, importance, expected source and coverage, and downstream links are visible together.");
      await dialog.getByRole("button", { name: "Registry help", exact: true }).click();
      await dialog.getByRole("heading", { name: "How to read this registry", exact: true }).waitFor({ state: "visible" });
      await capture(page, "registry-help", "Supported help explains how to read registry metadata without equating it with live provider health.");
    } finally { await context.close(); }
  }

  {
    const { context, page } = await createPage(browser, false);
    try {
      await enableNotifications(page);
      const disable = page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true });
      await disable.click();
      let dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Turn off notification delivery?", exact: true }).waitFor({ state: "visible" });
      await capture(page, "notification-confirmation-cancel", "Confirmation presents the preference change and keeps cancel separate from the destructive action.");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page.getByText("Enabled", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "notification-canceled", "Cancel returns to the still-enabled preference state without changing it.");

      await disable.click();
      dialog = page.getByRole("dialog");
      await page.evaluate(() => {
        const prototype = IDBObjectStore.prototype;
        const scoped = prototype;
        if (!scoped.__stockLedgerOriginalPut) scoped.__stockLedgerOriginalPut = prototype.put;
        const original = scoped.__stockLedgerOriginalPut;
        prototype.put = function (value, key) {
          if (key === "stockledger.appData.v2") throw new DOMException("Local write failed. Export a backup and free device space.", "QuotaExceededError");
          return original.call(this, value, key ?? undefined);
        };
      });
      await dialog.getByRole("button", { name: "Turn off notifications", exact: true }).click();
      await dialog.getByRole("alert").waitFor({ state: "visible" });
      await capture(page, "notification-save-error", "Injected local persistence failure retains the confirmation, actionable error, and Enabled preference for retry.");
      await page.evaluate(() => {
        const prototype = IDBObjectStore.prototype;
        if (prototype.__stockLedgerOriginalPut) prototype.put = prototype.__stockLedgerOriginalPut;
      });
      await dialog.getByRole("button", { name: "Turn off notifications", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page.getByText("Off", { exact: true }).waitFor({ state: "visible" });
      await capture(page, "notification-save-success", "The confirmation closes only after the saved preference is Off.");

      await openSettingsNotifications(page);
      await page.getByRole("textbox", { name: "Email destination", exact: true }).fill("review@example.test");
      await page.getByRole("button", { name: "Enable email delivery", exact: true }).click();
      await page.getByRole("button", { name: "Save notification preferences", exact: true }).click();
      await page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true }).click();
      dialog = page.getByRole("dialog");
      await page.evaluate(() => {
        const original = IDBDatabase.prototype.transaction;
        const patched = function (...args) {
          const transaction = original.apply(this, args);
          const add = transaction.addEventListener.bind(transaction);
          Object.defineProperty(transaction, "oncomplete", {
            configurable: true,
            get() { return this.__stockLedgerOnComplete; },
            set(listener) {
              this.__stockLedgerOnComplete = listener;
              if (typeof listener === "function") add("complete", event => window.setTimeout(() => listener.call(transaction, event), 1800));
            },
          });
          return transaction;
        };
        window.__stockLedgerOriginalTransaction = original;
        IDBDatabase.prototype.transaction = patched;
      });
      const confirm = dialog.getByRole("button", { name: "Turn off notifications", exact: true });
      await confirm.dispatchEvent("click");
      await page.waitForTimeout(100);
      const busy = await confirm.getAttribute("aria-busy");
      const disabled = await confirm.getAttribute("aria-disabled");
      if (await dialog.count() === 0 || (busy !== "true" && disabled !== "true")) throw new Error(`Pending state was not retained: aria-busy=${busy}, aria-disabled=${disabled}`);
      await capture(page, "notification-pending", "The preference save remains pending until the delayed local storage acknowledgement returns in this capture fixture.");
      await dialog.waitFor({ state: "detached", timeout: 10000 });
      await page.evaluate(() => {
        const windowWithOriginal = window;
        if (windowWithOriginal.__stockLedgerOriginalTransaction) IDBDatabase.prototype.transaction = windowWithOriginal.__stockLedgerOriginalTransaction;
      });
      await page.getByText("Off", { exact: true }).waitFor({ state: "visible" });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}
await writeFile(resolve(root, "state-evidence.json"), `${JSON.stringify({ candidate: "48aef5d8be21e83a95d299a78da7ab61557006ec", tree: "3c71b82219068c3aec4e620e19f786ae50a580f2", reducedMotion: "reduce", states }, null, 2)}\n`);
process.stdout.write(`state captures ${states.length}\n`);
