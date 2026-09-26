import { test, expect, type Page } from "@playwright/test";
import { contentHash } from "../../src/domain/contentHash";
import { makeWorkerHandoffBatch, makeWorkerHandoffManifest, eyeOwnerIdentityHash } from "../../src/domain/workerHandoff";
import { evaluateEye } from "../../src/lib/evaluateEye";
import { metricCatalog } from "../../src/lib/metricCatalog";
import type { AppData, Evaluation, MockSnapshot, WorkerHandoffEvidence } from "../../src/types";

const openSettings = async (page: Page) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("button", { name: "Workspace and data", exact: true });
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
};

const readWorkspace = (page: Page) => page.evaluate(() => new Promise<AppData>((resolve, reject) => {
  const request = indexedDB.open("stockledger", 1);
  request.onsuccess = () => {
    const database = request.result;
    const tx = database.transaction("documents", "readonly");
    const get = tx.objectStore("documents").get("stockledger.appData.v2");
    get.onsuccess = () => { database.close(); resolve(JSON.parse(String(get.result)).data as AppData); };
    tx.onerror = () => reject(tx.error);
  };
  request.onerror = () => reject(request.error);
}));

const makeEvidence = (data: AppData, input: { id: string; evaluatedAt: string; previous?: Evaluation; snapshotTime: string }): WorkerHandoffEvidence => {
  const eye = data.eyes.find(item => item.id === (input.previous?.eyeId ?? data.eyes[0].id))!;
  const stock = data.stocks.find(item => item.id === eye.stockId)!;
  const recipe = data.recipes.find(item => item.id === eye.recipeId)!;
  const original = data.snapshots.find(item => item.stockId === stock.id)!;
  const snapshot: MockSnapshot = {
    ...original,
    sourceName: "Owner-authorized CSV · daily close",
    updatedAt: input.snapshotTime,
    freshness: "Fresh",
    isMock: false,
    provenance: { schemaVersion: 2, origin: "import", observedDate: "2026-09-24", retrievedAt: input.snapshotTime,
      currency: "USD", adjustment: "adjusted", datasetId: "owner-csv-e2e", contentHash: "c".repeat(64) },
  };
  const evaluated = evaluateEye({ ...eye, ...(input.previous ? { lastEvaluation: input.previous } : {}) }, recipe, snapshot,
    [...metricCatalog, ...data.customMetrics], new Date(input.evaluatedAt));
  const evaluation: Evaluation = { ...evaluated, id: input.id, inputHash: contentHash({ id: input.id, recipe, snapshot }), alertSuggested: true, alertReason: "Worker captured a review transition." };
  const alert = {
    id: `alert-${input.id}`, evaluationId: input.id, eyeId: eye.id, recipeId: recipe.id, recipeVersion: recipe.version,
    title: `Worker review for ${stock.symbol}`, stateChange: `${evaluation.previousState} -> ${evaluation.currentState}`, whyNow: evaluation.whyNow,
    supportingEvidence: evaluation.supportingEvidence, risks: [...evaluation.contradictingEvidence, ...(evaluation.riskWarnings ?? [])],
    dataQuality: evaluation.dataQuality,
    evaluationContext: { currentState: evaluation.currentState, conditionResults: evaluation.conditionResults, staleData: evaluation.staleData, missingData: evaluation.missingData },
    priority: "High" as const, createdAt: input.evaluatedAt, reviewed: false,
  };
  const metricKeys = new Set(recipe.conditions.flatMap(condition => condition.metricKey ? [condition.metricKey] : []));
  return {
    eye, stock, recipe, customMetrics: data.customMetrics.filter(metric => metricKeys.has(metric.key)), evaluation, snapshot, alert,
    ...(eye.lastEvaluation?.id ? { expectedPreviousEvaluationId: eye.lastEvaluation.id } : {}),
    eyeIdentityHash: eyeOwnerIdentityHash(eye), recipeHash: contentHash(recipe), snapshotHash: contentHash(snapshot),
  };
};

const makeBatch = (data: AppData, sequence: number, evidence: WorkerHandoffEvidence) => makeWorkerHandoffBatch({
  workspaceId: data.workspaceId!, sequence, createdAt: evidence.evaluation.evaluatedAt,
  workerRevision: sequence + 1, sourceJobId: `evaluation-scan-e2e-${sequence}`, evidence: [evidence],
});

const makeManifest = (workspaceId: string, batches: ReturnType<typeof makeBatch>[], options: { generatedAt?: string; missed?: boolean; partial?: boolean } = {}) => {
  const at = options.generatedAt ?? "2026-09-25T02:00:00.000Z";
  return makeWorkerHandoffManifest({
    workspaceId, generatedAt: at, workerRevision: batches.at(-1)?.workerRevision ?? 2,
    latestSequence: batches.at(-1)?.sequence ?? 0, coverage: options.partial ? "partial" : "complete",
    scheduler: { state: options.missed ? "missed" : "healthy", lastInvocationAtUtc: at,
      lastSuccessfulRunAtUtc: at, latestExpectedCompletedSession: "2026-09-24", latestSuccessfulSession: "2026-09-24",
      missedSessions: options.missed ? ["2026-09-23"] : [], partialSessions: [], schedulerInstalled: false }, batches,
  });
};

const writePending = (page: Page, manifest: unknown) => page.evaluate(async raw => {
  localStorage.setItem("stockledger-handoff-pending.json", JSON.stringify(raw));
}, manifest);

test("worker evidence opens into Today, Alerts and Journal without replacing the workspace", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const directory = {
      async queryPermission() { return localStorage.getItem("stockledger-handoff-permission") === "granted" ? "granted" : "prompt"; },
      async requestPermission() { localStorage.setItem("stockledger-handoff-permission", "granted"); return "granted"; },
      async getFileHandle(name: string, options: { create?: boolean } = {}) {
        const key = `stockledger-handoff-${name}`;
        if (localStorage.getItem(key) === null && !options.create) throw new DOMException("File not found", "NotFoundError");
        return {
          async getFile() {
            const contents = localStorage.getItem(key) ?? "";
            return { async text() { return contents; } };
          },
          async createWritable() {
            let contents = "";
            return {
              async write(value: string) { contents = value; },
              async close() { localStorage.setItem(key, contents); },
              async abort() {},
            };
          },
        };
      },
    };
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: async () => directory });
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.transaction.db.name === "stockledger-local-worker-handoff" && this.name === "settings" && key === "worker-output-folder") {
        localStorage.setItem("stockledger-handoff-configured", "yes");
        return originalPut.call(this, "owner-granted-test-folder", key);
      }
      return originalPut.call(this, value, key);
    };
    const originalGet = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      if (this.transaction.db.name === "stockledger-local-worker-handoff" && this.name === "settings" && key === "worker-output-folder"
        && localStorage.getItem("stockledger-handoff-configured") === "yes") {
        const request: { result: unknown; error: null; onsuccess: ((this: IDBRequest, event: Event) => void) | null; onerror: null } = {
          result: directory, error: null, onsuccess: null, onerror: null,
        };
        queueMicrotask(() => request.onsuccess?.call(request as unknown as IDBRequest, new Event("success")));
        return request as unknown as IDBRequest;
      }
      return originalGet.call(this, key);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace", exact: true }).click();
  await expect(page.getByText(/Sample data is present/)).toBeVisible();
  await openSettings(page);
  await expect(page.getByText("No local worker folder connected", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-none-en.png"), fullPage: true });
  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  await expect(page.getByText("연결된 로컬 워커 폴더 없음", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-none-ko.png"), fullPage: true });
  await page.getByRole("radio", { name: "English", exact: true }).click();

  const initial = await readWorkspace(page);
  const at = "2026-09-25T01:00:00.000Z";
  const firstEvidence = makeEvidence(initial, { id: `evaluation-${"1".repeat(40)}`, evaluatedAt: at, snapshotTime: at });
  const firstBatch = makeBatch(initial, 1, firstEvidence);
  await writePending(page, makeManifest(initial.workspaceId!, [firstBatch]));
  await page.getByRole("button", { name: "Choose worker folder", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Worker evidence applied to this workspace", { exact: true })).toBeVisible();
  await expect(page.getByTestId("local-worker-handoff-folder")).toBeFocused();
  const stored = await readWorkspace(page);
  expect(stored.workerAppHandoff?.lastAppliedSequence).toBe(1);
  expect(stored.workerAppHandoff?.evidence[0].evidence.snapshot.provenance?.datasetId).toBe("owner-csv-e2e");
  const ack = await page.evaluate(() => JSON.parse(localStorage.getItem("stockledger-handoff-ack.json")!));
  expect(ack.sequence).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-applied-en.png"), fullPage: true });
  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  await expect(page.getByText("워커 근거를 이 워크스페이스에 적용함", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-applied-ko.png"), fullPage: true });
  await page.getByRole("button", { name: "알림", exact: true }).click();
  await expect(page.getByText("Owner-authorized CSV · daily close", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("alerts-handoff-applied-ko.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "오늘", exact: true }).click();
  await expect(page.getByTestId(`today-review-${firstEvidence.stock.symbol}`)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("today-handoff-applied-ko.png"), fullPage: true });
  await page.getByRole("tab", { name: "기록", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("radio", { name: "English", exact: true }).click();

  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await expect(page.getByTestId(`today-review-${firstEvidence.stock.symbol}`)).toBeVisible();
  const reviewButton = page.getByRole("button", { name: new RegExp(`Open review.*${firstEvidence.stock.symbol}`) });
  await reviewButton.click();
  await expect(page.getByText("Owner-authorized CSV · daily close", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New Journal Entry", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Why did you act this way?" }).fill("Owner note saved before the next worker update.");
  await page.getByRole("radio", { name: "Partly", exact: true }).click();
  await page.getByRole("radio", { name: "On Time", exact: true }).click();
  await page.getByRole("button", { name: "Save Decision", exact: true }).click();
  await expect(page.getByText("Owner note saved before the next worker update.", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  const afterDecision = await readWorkspace(page);
  const savedDecision = afterDecision.decisions.find(item => item.note === "Owner note saved before the next worker update.")!;
  expect(savedDecision.evaluationId).toBe(firstEvidence.evaluation.id);
  expect(savedDecision.alertId).toBe(firstEvidence.alert?.id);

  const secondEvidence = makeEvidence(afterDecision, { id: `evaluation-${"2".repeat(40)}`, evaluatedAt: "2026-09-25T02:00:00.000Z", previous: firstEvidence.evaluation, snapshotTime: "2026-09-25T02:00:00.000Z" });
  const secondBatch = makeBatch(afterDecision, 2, secondEvidence);
  await writePending(page, makeManifest(afterDecision.workspaceId!, [firstBatch, secondBatch]));
  await page.reload();
  await expect(page.getByText("Owner note saved before the next worker update.", { exact: true }).first()).toBeVisible();
  const afterSecondHandoff = await readWorkspace(page);
  expect(afterSecondHandoff.workerAppHandoff?.lastAppliedSequence).toBe(2);
  expect(afterSecondHandoff.evaluations?.filter(item => item.id === firstEvidence.evaluation.id || item.id === secondEvidence.evaluation.id)).toHaveLength(2);
  expect(afterSecondHandoff.decisions.find(item => item.id === savedDecision.id)).toEqual(savedDecision);
  const latestAck = await page.evaluate(() => JSON.parse(localStorage.getItem("stockledger-handoff-ack.json")!));
  expect(latestAck.sequence).toBe(2);

  await page.evaluate(() => localStorage.setItem("stockledger-handoff-permission", "prompt"));
  await page.reload();
  await openSettings(page);
  await expect(page.getByText("Grant this browser access to the selected folder to check worker evidence.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-permission-required-en.png"), fullPage: true });
  await page.getByRole("button", { name: "Check for worker updates", exact: true }).click();
  await expect(page.getByText("Worker evidence applied to this workspace", { exact: true })).toBeVisible();
  const afterPermissionReplay = await readWorkspace(page);
  expect(afterPermissionReplay.evaluations?.filter(item => item.id === firstEvidence.evaluation.id || item.id === secondEvidence.evaluation.id)).toHaveLength(2);
  expect(afterPermissionReplay.alerts.filter(item => item.id === firstEvidence.alert?.id || item.id === secondEvidence.alert?.id)).toHaveLength(2);
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-regranted-en.png"), fullPage: true });

  await writePending(page, makeManifest(afterSecondHandoff.workspaceId!, [firstBatch, secondBatch], { missed: true }));
  await page.getByRole("button", { name: "Check for worker updates", exact: true }).click();
  await expect(page.getByText("Worker reports missed or partial scheduled sessions", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-missed-en.png"), fullPage: true });
  await writePending(page, makeManifest(afterSecondHandoff.workspaceId!, [firstBatch, secondBatch], { partial: true }));
  await page.getByRole("button", { name: "Check for worker updates", exact: true }).click();
  await expect(page.getByText("Partial worker history is available; more may be pending", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-partial-en.png"), fullPage: true });
  await writePending(page, makeManifest(afterSecondHandoff.workspaceId!, [firstBatch, secondBatch], { generatedAt: "2026-09-20T00:00:00.000Z" }));
  await page.getByRole("button", { name: "Check for worker updates", exact: true }).click();
  await expect(page.getByText("Worker handoff is older than 48 hours", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-stale-en.png"), fullPage: true });

  const mismatch = makeManifest("workspace-another-owner", []);
  await writePending(page, mismatch);
  await page.getByRole("button", { name: "Check for worker updates", exact: true }).click();
  await expect(page.getByText("Owner changes conflict with this update; nothing was applied", { exact: true })).toBeVisible();
  const afterConflict = await readWorkspace(page);
  expect(afterConflict.workerAppHandoff?.lastAppliedSequence).toBe(2);
  expect(afterConflict.decisions.find(item => item.id === savedDecision.id)).toEqual(savedDecision);
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-conflict-en.png"), fullPage: true });

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("stockledger", 1);
    request.onsuccess = () => {
      const database = request.result;
      const tx = database.transaction("documents", "readwrite");
      tx.objectStore("documents").put("damaged after handoff", "stockledger.appData.v2");
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore previous saved copy", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore previous saved copy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await openSettings(page);
  await expect(page.getByText("A prior valid workspace copy was restored", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-recovered-en.png"), fullPage: true });
  await page.getByRole("radio", { name: "한국어", exact: true }).click();
  await expect(page.getByText("이전의 유효한 워크스페이스 복사본을 복원함", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-handoff-recovered-ko.png"), fullPage: true });

  if (testInfo.project.name === "desktop") {
    const width = await page.evaluate(() => window.innerWidth);
    await page.setViewportSize({ width: Math.max(320, Math.floor(width / 2)), height: 900 });
    expect(await page.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(width / 2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const handoffAction = page.getByTestId("local-worker-handoff-folder");
  await handoffAction.scrollIntoViewIfNeeded();
  await expect(handoffAction).toBeVisible();
  expect(await handoffAction.isEnabled()).toBe(true);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(errors).toEqual([]);
});
