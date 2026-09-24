import { expect, test, type Locator, type Page } from "@playwright/test";

const openSampleWorkspace = async (page: Page) => {
  await page.goto("/");
  await activateByKeyboard(page.getByRole("button", { name: "Explore sample workspace", exact: true }));
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
};

const activateByKeyboard = async (locator: Locator, key = "Enter") => {
  await locator.focus();
  await locator.press(key);
};

const selectFirstOption = async (dialog: Locator, fieldTestId: string) => {
  const field = dialog.getByTestId(fieldTestId);
  await field.fill("");
  const option = dialog.locator(`[data-testid^="${fieldTestId}-option-"]`).first();
  await expect(option).toBeVisible();
  const label = await option.getAttribute("aria-label");
  await activateByKeyboard(option);
  return label ?? "";
};

test("Eye Composer validates, saves, edits authored text, and restores invoker focus", async ({ page }) => {
  await openSampleWorkspace(page);
  await activateByKeyboard(page.getByRole("tab", { name: "Watchlist", exact: true }));
  await page.getByRole("textbox", { name: "Search or resume a stock" }).fill("AAPL");
  await activateByKeyboard(page.getByRole("button", { name: "AAPL · Apple", exact: true }));
  const create = page.getByRole("button", { name: "Register Eye", exact: true });
  await activateByKeyboard(create);
  let composer = page.getByRole("dialog");
  await expect(composer.getByRole("heading", { name: "Create Eye", exact: true })).toBeVisible();
  await composer.getByTestId("eye-stock").fill("");
  await activateByKeyboard(composer.getByTestId("eye-save"));
  const missingStock = composer.getByText("Select a stock.", { exact: true });
  await missingStock.scrollIntoViewIfNeeded();
  await expect(missingStock).toBeInViewport();
  await expect(composer.getByText("Select a recipe.", { exact: true })).toBeVisible();
  await expect(composer.getByText("Thesis snapshot is required.", { exact: true })).toBeVisible();
  await activateByKeyboard(composer.getByRole("button", { name: "Cancel", exact: true }));
  await expect(composer).toHaveCount(0);
  await expect(create).toBeFocused();

  await activateByKeyboard(create);
  composer = page.getByRole("dialog");
  const stock = await selectFirstOption(composer, "eye-stock");
  const recipe = await selectFirstOption(composer, "eye-recipe");
  const thesis = "CHG-199 authored thesis: verify two published periods before review.";
  const invalidation = "Revisit if recurring revenue no longer supports the stated thesis.";
  await composer.getByTestId("eye-thesis").fill(thesis);
  await composer.getByTestId("eye-entry-low").fill("120");
  await composer.getByTestId("eye-entry-high").fill("110");
  await composer.getByTestId("eye-invalidation").fill(invalidation);
  await activateByKeyboard(composer.getByTestId("eye-save"));
  await expect(composer.getByText("Entry low must not be above entry high.", { exact: true })).toBeVisible();
  await expect(composer.getByText("Entry high must not be below entry low.", { exact: true })).toBeVisible();
  await expect(composer.getByTestId("eye-entry-low")).toHaveValue("120");
  await expect(composer.getByTestId("eye-entry-high")).toHaveValue("110");
  await composer.getByTestId("eye-entry-low").fill("100");
  await composer.getByTestId("eye-entry-high").fill("110");
  await activateByKeyboard(composer.getByTestId("eye-save"));
  await expect(composer).toHaveCount(0);
  await activateByKeyboard(page.getByRole("button", { name: "Manage Eyes", exact: true }));
  await expect(page.getByText(thesis, { exact: true })).toBeVisible();

  const row = page.getByText(thesis, { exact: true }).locator("xpath=ancestor::*[@role='button'][1]");
  await activateByKeyboard(row);
  const detail = page.getByRole("dialog");
  await expect(detail.getByText(thesis, { exact: true })).toBeVisible();
  const edit = detail.getByRole("button", { name: "Edit", exact: true });
  await edit.click();
  composer = page.getByRole("dialog");
  await expect(composer.getByRole("heading", { name: "Edit Eye", exact: true })).toBeVisible();
  await expect(composer.getByTestId("eye-thesis")).toHaveValue(thesis);
  await expect(composer.getByTestId("eye-invalidation")).toHaveValue(invalidation);
  const revisedThesis = `${thesis} Add a source coverage check.`;
  await composer.getByTestId("eye-thesis").fill(revisedThesis);
  await activateByKeyboard(composer.getByTestId("eye-save"));
  await expect(page.getByRole("heading", { name: "Edit Eye", exact: true })).toHaveCount(0);
  await expect(detail.getByText(revisedThesis, { exact: true })).toBeVisible();
  await edit.click();
  composer = page.getByRole("dialog");
  await expect(composer.getByTestId("eye-thesis")).toHaveValue(revisedThesis);
  await expect(composer.getByTestId("eye-invalidation")).toHaveValue(invalidation);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Edit Eye", exact: true })).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect(stock).toBeTruthy();
  expect(recipe).toBeTruthy();
});

test("Journal Composer requires deliberate context and action, then preserves amendments", async ({ page }) => {
  await openSampleWorkspace(page);
  await activateByKeyboard(page.getByRole("tab", { name: "Journal", exact: true }));
  const create = page.getByRole("button", { name: "New", exact: true });
  const initialRecordCount = await page.getByText(/^\d+ entries ·/).innerText();
  await activateByKeyboard(create);
  let composer = page.getByRole("dialog");
  await expect(composer.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(composer).toHaveCount(0);
  await expect(create).toBeFocused();
  await activateByKeyboard(create);
  composer = page.getByRole("dialog");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  const missingEye = composer.getByText("Select an Eye.", { exact: true });
  await missingEye.scrollIntoViewIfNeeded();
  await expect(missingEye).toBeInViewport();
  await expect(composer.getByText("Choose the action you recorded.", { exact: true })).toHaveCount(0);
  await expect(composer.getByText("Choose your thesis assessment.", { exact: true })).toHaveCount(0);
  await expect(composer.getByText("Choose your timing assessment.", { exact: true })).toHaveCount(0);
  await activateByKeyboard(composer.getByRole("button", { name: "Cancel", exact: true }));
  await expect(composer).toHaveCount(0);
  await expect(create).toBeFocused();
  await expect(page.getByText(/^\d+ entries ·/)).toHaveText(initialRecordCount);

  await activateByKeyboard(create);
  composer = page.getByRole("dialog");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(composer.getByText("Select an Eye.", { exact: true })).toBeVisible();
  const eye = await selectFirstOption(composer, "journal-eye");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(composer.getByText("Choose the action you recorded.", { exact: true })).toBeVisible();
  await expect(composer.getByText("Choose your thesis assessment.", { exact: true })).toHaveCount(0);
  await expect(composer.getByText("Choose your timing assessment.", { exact: true })).toHaveCount(0);
  await activateByKeyboard(composer.getByRole("radio", { name: "Entered", exact: true }), "Space");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(composer.getByText("A decision note is required.", { exact: true })).toBeVisible();
  const note = "I am waiting for a second source before recording a conclusion.";
  const concern = "Coverage may differ across providers.";
  await composer.getByTestId("journal-note").fill(note);
  await composer.getByTestId("journal-concern").fill(concern);
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(composer.getByText("Choose your thesis assessment.", { exact: true })).toBeVisible();
  await activateByKeyboard(composer.getByRole("radio", { name: "Partly", exact: true }), "Space");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(composer.getByText("Choose your timing assessment.", { exact: true })).toBeVisible();
  await activateByKeyboard(composer.getByRole("radio", { name: "Early", exact: true }), "Space");
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(page.getByRole("heading", { name: "New Journal Entry", exact: true })).toHaveCount(0);

  let detail = page.getByRole("dialog");
  await expect(detail.getByText(note, { exact: true })).toBeVisible();
  await expect(detail.getByText(concern, { exact: true })).toBeVisible();
  await activateByKeyboard(detail.getByRole("button", { name: "Edit", exact: true }));
  composer = page.getByRole("dialog");
  await expect(composer.getByRole("heading", { name: "Amend Journal Entry", exact: true })).toBeVisible();
  await expect(composer.getByTestId("journal-note")).toHaveValue(note);
  const amended = `${note} I recorded the source limit.`;
  await composer.getByTestId("journal-note").fill(amended);
  await activateByKeyboard(composer.getByTestId("journal-save"));
  await expect(page.getByRole("heading", { name: "Amend Journal Entry", exact: true })).toHaveCount(0);
  detail = page.getByRole("dialog");
  await expect(detail.getByText(amended, { exact: true })).toBeVisible();
  await expect(detail.getByText("Previous authored versions", { exact: true })).toBeVisible();
  await activateByKeyboard(detail.getByRole("button", { name: "Previous authored versions", exact: true }));
  await expect(detail.getByText(note, { exact: true })).toBeVisible();
  expect(eye).toBeTruthy();
});

test("Recipe Builder validates by step, keeps drafts, and creates a versioned recipe", async ({ page }) => {
  await openSampleWorkspace(page);
  await activateByKeyboard(page.getByRole("tab", { name: "Recipes", exact: true }));
  await activateByKeyboard(page.getByTestId("recipe-layer-control-Sets"));
  const newRecipe = page.getByRole("button", { name: "New Recipe", exact: true });
  await activateByKeyboard(newRecipe);
  let builder = page.getByRole("dialog");
  await page.keyboard.press("Escape");
  await expect(builder).toHaveCount(0);
  await expect(newRecipe).toBeFocused();
  const recipeName = "CHG-199 Recovery Review Recipe";
  await expect(page.getByText(recipeName, { exact: true })).toHaveCount(0);
  await activateByKeyboard(newRecipe);
  builder = page.getByRole("dialog");
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByText("Recipe name is required.", { exact: true })).toBeVisible();
  await expect(builder.getByText("Purpose is required.", { exact: true })).toBeVisible();
  await expect(builder.getByText("Add at least one condition.", { exact: true })).toHaveCount(0);

  const purpose = "Monitor for recoveries with complete inputs and review the supporting evidence.";
  await builder.getByTestId("recipe-name").fill(recipeName);
  await builder.getByTestId("recipe-purpose").fill(purpose);
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByRole("heading", { name: "Logic", exact: true })).toBeVisible();
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByText("Add at least one condition.", { exact: true })).toBeVisible();
  await builder.getByTestId("recipe-condition-note").fill("Check a supported price-derived condition.");
  await activateByKeyboard(builder.getByTestId("recipe-add-condition"));
  await expect(builder.getByText(/Notes: Check a supported price-derived condition/)).toBeVisible();
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByRole("heading", { name: "Risk & Alerts", exact: true })).toBeVisible();
  await builder.getByTestId("recipe-notes").fill("Retain source and review limitations with the saved recipe.");
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByRole("heading", { name: "Review & Outcome", exact: true })).toBeVisible();
  await expect(builder.getByText(/does not promise returns or represent live execution/i)).toBeVisible();
  await activateByKeyboard(builder.getByTestId("recipe-back"));
  await expect(builder.getByTestId("recipe-notes")).toHaveValue("Retain source and review limitations with the saved recipe.");
  await activateByKeyboard(builder.getByTestId("recipe-back"));
  await expect(builder.getByText(/Notes: Check a supported price-derived condition/)).toBeVisible();
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await activateByKeyboard(builder.getByTestId("recipe-save"));
  await expect(builder.getByRole("heading", { name: "Recipe Builder", exact: true })).toHaveCount(0);
  await expect(page.getByText(recipeName, { exact: true })).toBeVisible();

  const recipeRow = page.getByText(recipeName, { exact: true }).locator("xpath=ancestor::*[starts-with(@data-testid,'recipe-set-row-')][1]");
  await activateByKeyboard(recipeRow.getByRole("button", { name: "Open set detail", exact: true }));
  let detail = page.getByRole("dialog");
  await expect(detail.getByText(recipeName, { exact: true })).toBeVisible();
  const openBuilder = detail.getByRole("button", { name: "Open Builder", exact: true });
  await activateByKeyboard(openBuilder);
  builder = page.getByRole("dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Edit Recipe", exact: true })).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(openBuilder).toBeFocused();
  await expect(detail.getByText("Version 1", { exact: false })).toBeVisible();

  await activateByKeyboard(openBuilder);
  builder = page.getByRole("dialog");
  await expect(builder.getByRole("heading", { name: "Edit Recipe", exact: true })).toBeVisible();
  await expect(builder.getByTestId("recipe-name")).toHaveValue(recipeName);
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByText(/Notes: Check a supported price-derived condition/)).toBeVisible();
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await activateByKeyboard(builder.getByTestId("recipe-continue"));
  await expect(builder.getByTestId("recipe-save")).toHaveText("Save New Version");
  await activateByKeyboard(builder.getByTestId("recipe-save"));
  await expect(builder.getByRole("heading", { name: "Edit Recipe", exact: true })).toHaveCount(0);
  detail = page.getByRole("dialog");
  await expect(detail.getByText(recipeName, { exact: true })).toBeVisible();
  await expect(detail.getByText("Version 2", { exact: false })).toBeVisible();
});

test("Logic Registry exposes raw meaning, declared coverage, downstream links, help, and focus return", async ({ page }) => {
  await openSampleWorkspace(page);
  await activateByKeyboard(page.getByRole("tab", { name: "Recipes", exact: true }));
  await activateByKeyboard(page.getByTestId("recipe-layer-control-Raw Data"));
  const openRegistry = page.getByRole("button", { name: "Open raw data registry", exact: true });
  await activateByKeyboard(openRegistry);
  let registry = page.getByRole("dialog");
  const search = registry.getByRole("textbox", { name: "Search fields", exact: true });
  await search.fill("priceHistorySeries");
  const field = registry.getByRole("button", { name: "Price history series, priceHistorySeries", exact: true });
  await activateByKeyboard(field);
  await expect(registry.getByText("Primary price source", { exact: true })).toBeVisible();
  await expect(registry.getByText("Market price feed", { exact: true })).toBeVisible();
  await expect(registry.getByText("Declared source and coverage", { exact: true })).toBeVisible();
  await expect(registry.getByText("Downstream processed features", { exact: true })).toBeVisible();
  await expect(registry.getByText("Why it matters", { exact: true })).toBeVisible();
  const help = registry.getByRole("button", { name: "Registry help", exact: true });
  await activateByKeyboard(help);
  await expect(registry.getByRole("heading", { name: "How to read this registry", exact: true })).toBeVisible();
  await activateByKeyboard(registry.getByRole("button", { name: "Close help", exact: true }));
  await expect(registry.getByRole("heading", { name: "How to read this registry", exact: true })).toHaveCount(0);
  registry = page.getByRole("dialog");
  await expect(help).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(registry).toHaveCount(0);
  await expect(openRegistry).toBeFocused();
});

test("Raw Data Registry instruction stays fully readable across supported viewports and languages", async ({ page }) => {
  const profiles = [
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 412, height: 915 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await activateByKeyboard(page.getByRole("button", { name: "Explore sample workspace", exact: true }));
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
  for (const language of ["en", "ko"] as const) {
    await activateByKeyboard(page.getByRole("button", { name: "Settings", exact: true }));
    await activateByKeyboard(page.getByTestId(`settings-language-control-${language}`));
    await activateByKeyboard(page.getByRole("tab", { name: language === "ko" ? "레시피" : "Recipes", exact: true }));

    const instruction = language === "ko"
      ? "여기서는 원천 데이터만 봅니다. 정의, 중요도, 연결된 처리 피처, 소스, API 원천을 확인하세요."
      : "This is the raw-data registry only. Review the definitions, importance, linked processed features, sources, and API origins here.";
    for (const profile of profiles) {
      await page.setViewportSize(profile);
      await activateByKeyboard(page.getByTestId("recipe-layer-control-Raw Data"));
      await activateByKeyboard(page.getByRole("button", { name: language === "ko" ? "원천 데이터 레지스트리 열기" : "Open raw data registry", exact: true }));
      const registry = page.getByRole("dialog");
      const subtitle = registry.getByText(instruction, { exact: true });
      await expect(subtitle).toBeVisible();
      await expect(registry.getByRole("button", { name: language === "ko" ? "닫기" : "Done", exact: true })).toBeInViewport();
      const layout = await subtitle.evaluate((element) => {
        const measureLines = (target: Element) => {
          const range = document.createRange();
          range.selectNodeContents(target);
          return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size;
        };
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.position = "fixed";
        clone.style.left = "-10000px";
        clone.style.top = "-10000px";
        clone.style.width = `${element.getBoundingClientRect().width}px`;
        clone.style.height = "auto";
        clone.style.maxHeight = "none";
        clone.style.display = "block";
        clone.style.overflow = "visible";
        clone.style.webkitLineClamp = "unset";
        clone.style.webkitBoxOrient = "initial";
        document.body.appendChild(clone);
        const fullLineCount = measureLines(clone);
        clone.remove();
        return {
          text: element.textContent,
          lineCount: measureLines(element),
          fullLineCount,
          lineClamp: getComputedStyle(element).webkitLineClamp,
          width: element.clientWidth,
          scrollWidth: element.scrollWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(layout.text).toBe(instruction);
      expect(layout.lineClamp).toBe("8");
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
      expect(layout.documentWidth).toBeLessThanOrEqual(profile.width);
      expect(layout.lineCount).toBe(layout.fullLineCount);
      expect(layout.fullLineCount).toBeLessThanOrEqual(8);
      if (profile.width >= 412) expect(layout.fullLineCount).toBeLessThanOrEqual(4);
      await page.keyboard.press("Escape");
      await expect(registry).toHaveCount(0);
    }
  }
});

test("notification disable keeps a failed preference save visible and retryable", async ({ page }) => {
  await page.goto("/");
  await activateByKeyboard(page.getByRole("button", { name: "Settings", exact: true }));
  const section = page.getByRole("button", { name: "Notification settings and delivery state", exact: true });
  if (await section.getAttribute("aria-expanded") !== "true") await activateByKeyboard(section);
  await expect(section).toHaveAttribute("aria-expanded", "true");
  await activateByKeyboard(page.getByRole("button", { name: "Enable email delivery", exact: true }));
  await expect(page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true })).toBeVisible();
  const disable = page.getByRole("button", { name: "Opt out and cancel future delivery", exact: true });
  await activateByKeyboard(disable);
  const confirmation = page.getByRole("dialog");
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __stockLedgerOriginalPut?: IDBObjectStore["put"] };
    if (!prototype.__stockLedgerOriginalPut) prototype.__stockLedgerOriginalPut = prototype.put;
    const original = prototype.__stockLedgerOriginalPut;
    prototype.put = function (value: unknown, key?: IDBValidKey | null) {
      if (key === "stockledger.appData.v2") throw new DOMException("Uncaught exception in event handler.", "UnknownError");
      return original.call(this, value, key ?? undefined);
    };
  });
  await activateByKeyboard(confirmation.getByRole("button", { name: "Turn off notifications", exact: true }));
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("alert")).toBeVisible();
  await expect(confirmation.getByText("Notification preferences could not be saved. No changes were made.", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("The preference was not changed. Retry the save or cancel.", { exact: true })).toBeVisible();
  await expect(page.getByText("Uncaught exception in event handler.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __stockLedgerOriginalPut?: IDBObjectStore["put"] };
    if (prototype.__stockLedgerOriginalPut) prototype.put = prototype.__stockLedgerOriginalPut;
  });
  await activateByKeyboard(confirmation.getByRole("button", { name: "Turn off notifications", exact: true }));
  await expect(page.getByRole("heading", { name: "Turn off notification delivery?", exact: true })).toHaveCount(0);
  await expect(page.getByText("Off", { exact: true })).toBeVisible();

  await activateByKeyboard(page.getByTestId("settings-language-control-ko"));
  await activateByKeyboard(page.getByRole("button", { name: "이메일 전달 사용", exact: true }));
  await expect(page.getByRole("button", { name: "옵트아웃하고 이후 전달 취소", exact: true })).toBeVisible();
  await activateByKeyboard(page.getByRole("button", { name: "옵트아웃하고 이후 전달 취소", exact: true }));
  const koreanConfirmation = page.getByRole("dialog");
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __stockLedgerOriginalPut?: IDBObjectStore["put"] };
    if (!prototype.__stockLedgerOriginalPut) prototype.__stockLedgerOriginalPut = prototype.put;
    const original = prototype.__stockLedgerOriginalPut;
    prototype.put = function (value: unknown, key?: IDBValidKey | null) {
      if (key === "stockledger.appData.v2") throw new DOMException("Uncaught exception in event handler.", "UnknownError");
      return original.call(this, value, key ?? undefined);
    };
  });
  await activateByKeyboard(koreanConfirmation.getByRole("button", { name: "알림 끄기", exact: true }));
  await expect(koreanConfirmation.getByText("알림 설정을 저장하지 못했습니다. 변경 사항은 저장되지 않았습니다.", { exact: true })).toBeVisible();
  await expect(koreanConfirmation.getByText("설정은 변경되지 않았습니다. 다시 저장하거나 취소하세요.", { exact: true })).toBeVisible();
  await expect(page.getByText("Uncaught exception in event handler.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("사용 중", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __stockLedgerOriginalPut?: IDBObjectStore["put"] };
    if (prototype.__stockLedgerOriginalPut) prototype.put = prototype.__stockLedgerOriginalPut;
  });
  await activateByKeyboard(koreanConfirmation.getByRole("button", { name: "알림 끄기", exact: true }));
  await expect(page.getByRole("heading", { name: "알림 전달을 끌까요?", exact: true })).toHaveCount(0);
  await expect(page.locator("#settings-notifications-content").getByText("꺼짐", { exact: true })).toBeVisible();
});
