import { test, expect } from "@playwright/test";

const enterSample = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  const explore = page.getByRole("button", { name: "Explore sample workspace", exact: true });
  if (await explore.count()) await explore.click();
};

test("modal focus restoration rejects unavailable invokers and keeps its scoped fallback", async ({ page }) => {
  const cases = ["aria-hidden-ancestor", "inert-invoker", "hidden-invoker", "disabled-invoker", "removed-invoker", "eligible-invoker"] as const;

  for (const mode of cases) {
    await enterSample(page);
    const invoker = page.locator('[data-testid^="today-review-"]').first().getByRole("button").first();
    const invokerHandle = await invoker.elementHandle();
    expect(invokerHandle, `${mode} should begin with an exact review invoker`).not.toBeNull();

    if (mode === "eligible-invoker") {
      await invoker.click();
    } else {
      await invokerHandle!.evaluate((element, selectedMode) => {
        if (selectedMode === "aria-hidden-ancestor") {
          element.closest('[data-testid^="today-review-"]')?.setAttribute("aria-hidden", "true");
        } else if (selectedMode === "inert-invoker") {
          element.setAttribute("inert", "");
        } else if (selectedMode === "hidden-invoker") {
          element.setAttribute("hidden", "");
        } else if (selectedMode === "disabled-invoker") {
          (element as HTMLButtonElement).disabled = true;
        }
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }, mode);
    }

    const dialog = page.getByRole("dialog");
    await expect(dialog, `${mode} should open the same review panel`).toBeVisible();
    if (mode === "removed-invoker") await invokerHandle!.evaluate((element) => element.remove());
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (mode === "eligible-invoker") await expect(invoker, `${mode} should restore the exact invoker`).toBeFocused();
    else await expect(page.getByRole("tab", { name: "Today", exact: true }), `${mode} should restore to the in-scope Today tab`).toBeFocused();
    await expect(page.getByRole("tab", { name: "Watchlist", exact: true })).toHaveCount(1);

    if (mode === "eligible-invoker" || mode === "aria-hidden-ancestor") {
      if (mode === "eligible-invoker") await invoker.click();
      else await invokerHandle!.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
      await expect(dialog, `${mode} should support a second open after close`).toBeVisible();
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
      if (mode === "eligible-invoker") await expect(invoker).toBeFocused();
      else await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeFocused();
    }
  }
});

test("a delayed durable acknowledgement cannot clear an A-to-B-to-A Eye draft", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, "oncomplete");
    if (!descriptor?.set || !descriptor.get) throw new Error("IndexedDB transaction completion hook is unavailable.");
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get!.call(this); },
      set(handler: ((event: Event) => void) | null) {
        const transaction = this;
        if (!handler) { descriptor.set!.call(transaction, handler); return; }
        descriptor.set!.call(transaction, function (event: Event) {
          const testWindow = window as typeof window & {
            __holdWorkspaceAck?: boolean;
            __releaseWorkspaceAck?: () => void;
          };
          if (testWindow.__holdWorkspaceAck && transaction.mode === "readwrite" && transaction.objectStoreNames.contains("documents")) {
            testWindow.__holdWorkspaceAck = false;
            testWindow.__releaseWorkspaceAck = () => handler.call(transaction, event);
            return;
          }
          handler.call(transaction, event);
        });
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await enterSample(page);
  await page.getByRole("tab", { name: "Watchlist", exact: true }).click();
  await page.getByRole("textbox", { name: "Search or resume a stock" }).fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();

  const openEyeDraft = async (thesis: string, save: boolean) => {
    await page.getByRole("button", { name: "Register Eye", exact: true }).click();
    const dialog = page.getByRole("dialog");
    if (save) {
      await dialog.getByTestId("eye-stock").fill("");
      await dialog.locator('[data-testid^="eye-stock-option-"]').first().click();
      await dialog.getByTestId("eye-recipe").fill("");
      await dialog.locator('[data-testid^="eye-recipe-option-"]').first().click();
    }
    await dialog.getByTestId("eye-thesis").fill(thesis);
    return dialog;
  };

  const first = await openEyeDraft("first A submission", true);
  await page.evaluate(() => { (window as typeof window & { __holdWorkspaceAck?: boolean }).__holdWorkspaceAck = true; });
  await first.getByTestId("eye-save").click();
  await expect.poll(() => page.evaluate(() => typeof (window as typeof window & { __releaseWorkspaceAck?: unknown }).__releaseWorkspaceAck === "function"), {
    message: "the real IndexedDB write should reach its completion acknowledgement",
  }).toBe(true);
  await first.getByRole("button", { name: "Cancel", exact: true }).click();

  const middle = await openEyeDraft("intermediate B draft", false);
  await middle.getByRole("button", { name: "Cancel", exact: true }).click();
  const latest = await openEyeDraft("second A draft remains", false);
  await page.evaluate(() => (window as typeof window & { __releaseWorkspaceAck?: () => void }).__releaseWorkspaceAck?.());
  await expect(latest.getByTestId("eye-thesis")).toHaveValue("second A draft remains");
  await expect(latest.getByRole("heading", { name: "Create Eye", exact: true })).toBeVisible();
  await latest.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("primary review, alert, and recipe actions fit short profiles in EN and KO", async ({ page }) => {
  const profiles = [
    { width: 1366, height: 768, locale: "en", surface: "today" },
    { width: 360, height: 800, locale: "en", surface: "recipes" },
    { width: 390, height: 844, locale: "en", surface: "alerts" },
    { width: 412, height: 915, locale: "en", surface: "today" },
    { width: 1280, height: 720, locale: "ko", surface: "alerts" },
  ] as const;

  for (const profile of profiles) {
    const korean: boolean = profile.locale === "ko";
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await enterSample(page);
    if (korean) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByTestId("settings-language-control-ko").click();
    }

    let action: import("@playwright/test").Locator;
    if (profile.surface === "today") {
      action = page.locator('[data-testid^="today-review-"]').first().getByRole("button").first();
    } else if (profile.surface === "alerts") {
      await page.getByRole("button", { name: korean ? "알림" : "Alerts", exact: true }).click();
      action = page.getByRole("button", { name: korean ? "근거 확인" : "Inspect evidence", exact: true }).first();
    } else {
      await page.getByRole("tab", { name: "Recipes", exact: true }).click();
      await page.getByTestId("recipe-layer-control-Sets").click();
      action = page.getByRole("button", { name: /Open set/ }).first();
    }

    const bounds = await action.boundingBox();
    expect(bounds, `${profile.surface} action should exist at ${profile.width}x${profile.height}`).not.toBeNull();
    expect(bounds!.y, `${profile.surface} action should begin inside the initial viewport`).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height, `${profile.surface} action should fit the initial viewport at ${profile.width}x${profile.height}`).toBeLessThanOrEqual(profile.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(profile.width);

    const nav = page.locator("#stockledger-shell > div").first();
    const navBounds = await nav.boundingBox();
    expect(navBounds).not.toBeNull();
    expect(navBounds!.y).toBeGreaterThanOrEqual(0);
    expect(navBounds!.y + navBounds!.height).toBeLessThanOrEqual(profile.height);
    if (profile.width < 900) {
      expect(navBounds!.y + navBounds!.height).toBe(profile.height);
    } else {
      expect(navBounds!.x).toBe(0);
      expect(navBounds!.width).toBe(224);
    }

    const scrollReport = await page.evaluate(async () => {
      const scrollable = document.querySelector<HTMLElement>("#stockledger-content-scroll");
      const scrollables = scrollable && scrollable.scrollHeight > scrollable.clientHeight + 8 ? [scrollable] : [];
      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const navigation = document.querySelector<HTMLElement>("#stockledger-shell > div");
      const rect = navigation?.getBoundingClientRect();
      return { scrollableCount: scrollables.length, navTop: rect?.top ?? null, navBottom: rect?.bottom ?? null };
    });
    expect(scrollReport.scrollableCount, `${profile.surface} should keep its content scroll context`).toBeGreaterThan(0);
    expect(scrollReport.navTop).toBeGreaterThanOrEqual(0);
    expect(scrollReport.navBottom).toBeLessThanOrEqual(profile.height);

    const nextRoute = profile.surface === "recipes"
      ? (korean ? "오늘" : "Today")
      : (korean ? "레시피" : "Recipes");
    await page.getByRole("tab", { name: nextRoute, exact: true }).click();
    await expect(page.getByRole("tab", { name: nextRoute, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.locator("#stockledger-content-scroll").evaluate((element: HTMLElement) => element.scrollTop), {
      message: "route changes should retain shell scroll ownership and start the new surface at its task entry",
    }).toBe(0);
  }
});

test("forced colors and keyboard focus preserve the panel close path", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await enterSample(page);
  const invoker = page.locator('[data-testid^="today-review-"]').first().getByRole("button").first();
  await invoker.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Done", exact: true });
  await expect(close).toBeFocused();
  const state = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const rect = document.querySelector<HTMLElement>('[role="dialog"]')?.getBoundingClientRect();
    return {
      forcedColors: matchMedia("(forced-colors: active)").matches,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      focusedOutline: active ? getComputedStyle(active).outlineStyle : "none",
      dialogRect: rect ? { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom } : null,
    };
  });
  expect(state.forcedColors).toBe(true);
  expect(state.horizontalOverflow).toBe(false);
  expect(state.focusedOutline).not.toBe("none");
  expect(state.dialogRect?.x).toBeGreaterThanOrEqual(0);
  expect(state.dialogRect?.right).toBeLessThanOrEqual(390);
  expect(state.dialogRect?.y).toBeGreaterThanOrEqual(0);
  expect(state.dialogRect?.bottom).toBeLessThanOrEqual(844);
  await testInfo.attach("forced-colors-focus-diagnostics.json", { body: Buffer.from(JSON.stringify(state, null, 2)), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("forced-colors-focus.png"), animations: "disabled" });

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(invoker).toBeFocused();
});

test("text-spacing tolerance keeps Today, stock detail, and Eye form usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterSample(page);
  await page.addStyleTag({ content: "* { letter-spacing: .12em !important; word-spacing: .16em !important; line-height: 1.5 !important; } p { margin-block-end: 2em !important; }" });
  const checked: Array<Record<string, unknown>> = [];
  const measure = async (surface: string) => {
    const result = await page.evaluate((name) => ({
      surface: name,
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      openDialogs: document.querySelectorAll('[role="dialog"]').length,
    }), surface);
    expect(result.documentWidth, `${surface} should reflow horizontally under text spacing`).toBeLessThanOrEqual(result.viewportWidth);
    expect(result.bodyWidth).toBeLessThanOrEqual(result.viewportWidth);
    checked.push(result);
  };

  await measure("today-primary");
  await page.getByRole("tab", { name: "Watchlist", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search or resume a stock" });
  await search.fill("AAPL");
  await page.getByRole("button", { name: "AAPL · Apple", exact: true }).click();
  await expect(page.getByText("Stock identity and data authority", { exact: true })).toBeVisible();
  await measure("stock-detail");

  const evidenceButton = page.getByRole("button", { name: "Evidence detail", exact: true }).first();
  await evidenceButton.scrollIntoViewIfNeeded();
  await evidenceButton.click();
  const evidenceDialog = page.getByRole("dialog");
  await expect(evidenceDialog.getByText("Freshness", { exact: true })).toBeVisible();
  await measure("metric-detail");
  await page.keyboard.press("Escape");
  await expect(evidenceDialog).toHaveCount(0);

  const register = page.getByRole("button", { name: "Register Eye", exact: true });
  await register.scrollIntoViewIfNeeded();
  await register.click();
  const composer = page.getByRole("dialog");
  await expect(composer.getByRole("heading", { name: "Create Eye", exact: true })).toBeVisible();
  await composer.getByTestId("eye-stock").fill("");
  await composer.getByTestId("eye-thesis").fill("Text spacing draft remains available for correction.");
  const save = composer.getByTestId("eye-save");
  await save.scrollIntoViewIfNeeded();
  await save.click();
  await expect(composer.getByText("Select a stock.", { exact: true })).toBeVisible();
  await expect(composer.getByTestId("eye-thesis")).toHaveValue("Text spacing draft remains available for correction.");
  await measure("eye-composer");
  const cancel = composer.getByRole("button", { name: "Cancel", exact: true });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeVisible();
  await testInfo.attach("text-spacing-tolerance-report.json", { body: Buffer.from(JSON.stringify(checked, null, 2)), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("eye-composer-text-spacing.png"), animations: "disabled" });
  await cancel.click();
  await expect(composer).toHaveCount(0);
  await expect(register).toBeFocused();
});
