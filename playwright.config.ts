import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: 2, timeout: 45_000,
  outputDir: "artifacts/browser", reporter: "list",
  use: { baseURL: "http://127.0.0.1:43187", trace: "retain-on-failure", screenshot: "only-on-failure", reducedMotion: "reduce" },
  projects: [ { name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } } ],
  webServer: { command: "node scripts/serve-preview.mjs", url: "http://127.0.0.1:43187", reuseExistingServer: false, timeout: 30_000 },
});
