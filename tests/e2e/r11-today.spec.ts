import { test, expect } from "@playwright/test";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "holdout-412", width: 412, height: 915 },
];

for (const viewport of viewports) {
  test(`Today is composed for ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Today", exact: true })).toHaveAttribute("aria-selected", "true");

    const queue = page.getByText("Needs review", { exact: true });
    await expect(queue).toBeVisible();
    const firstReview = page.locator('[data-testid^="today-review-"]').first();
    await expect(firstReview).toBeVisible();
    const primaryAction = firstReview.getByRole("button").first();
    await expect(primaryAction).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const queueBox = await firstReview.boundingBox();
    const actionBox = await primaryAction.boundingBox();
    expect(queueBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(queueBox!.y).toBeLessThan(viewport.height);
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}.png`), fullPage: false });
  });
}

test("Today review oracle preserves evidence context and opens a deliberate journal action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();

  const firstReview = page.locator('[data-testid^="today-review-"]').first();
  const primaryAction = firstReview.getByRole("button").first();
  await expect(primaryAction).toBeVisible();
  await primaryAction.click();

  const reviewDialog = page.getByRole("dialog");
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByText("Why now", { exact: true })).toBeVisible();
  await expect(reviewDialog.getByText("Risk context", { exact: true })).toBeVisible();
  await expect(reviewDialog.getByText("Data freshness", { exact: true })).toBeVisible();
  await expect(reviewDialog.getByRole("button", { name: "Done", exact: true })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(reviewDialog).toHaveCount(0);
  await expect(primaryAction).toBeFocused();
  await expect(firstReview).toContainText("AMD");

  await primaryAction.click();
  await page.getByRole("dialog").getByRole("button", { name: "Record review", exact: true }).click();
  const journalDialog = page.getByRole("dialog");
  await expect(journalDialog.getByRole("button", { name: "Save Decision", exact: true })).toBeVisible();
  await expect(journalDialog.getByText("Capture the decision only when you choose to add one.", { exact: true })).toBeVisible();
});
