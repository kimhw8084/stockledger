import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseExport, serializeExport } from "../../src/domain/backupFormat";
import { normalizeToSchema } from "../../src/lib/eodDataProvider";
import { runWorker } from "./run";
import { WorkerStore } from "./store";
import { createOperationsStatus } from "./operations";
import { readReleasePackage, verifyRuntimeReleaseEvidence } from "./releaseEvidenceRuntime";
import { makeWorkerHandoffManifest, parseWorkerHandoffAck } from "../../src/domain/workerHandoff";

const { values } = parseArgs({ options: {
  db: { type: "string", default: ".local/stockledger.sqlite" }, import: { type: "string" }, "import-revision": { type: "string" },
  csv: { type: "string" }, output: { type: "string" }, backup: { type: "string" }, "handoff-dir": { type: "string", default: ".local/stockledger-app-handoff" },
  adjustment: { type: "string", default: "unknown" }, source: { type: "string", default: "Local CSV import" }, managed: { type: "boolean" }, status: { type: "boolean" }, "release-evidence": { type: "string" }, help: { type: "boolean" },
} });

const help = () => console.log(`StockLedger worker
--import BACKUP.json imports into an empty DB. Existing DBs require --import-revision N and get an automatic SQLite backup before replacement.
--csv DIRECTORY evaluates SYMBOL.csv files; --adjustment adjusted|unadjusted|unknown declares provider metadata.
--managed invokes the provider-independent production job contract used by external cron/job platforms. It does not install a hosted scheduler.
--status prints machine-readable scheduler coverage/status without running work.
--handoff-dir DIRECTORY publishes incremental worker evidence for the app; choose that same folder once in the browser Settings.
--release-evidence FILE supplies source-bound evidence to --status; it is accepted only after independent verification with STOCKLEDGER_PROTECTED_BASE.
--output FILE explicitly exports a full validated app backup. --backup FILE creates a consistent SQLite snapshot.
--db FILE selects the worker database. Evaluation does not contact a provider; server-only delivery is a separate runNotificationDelivery phase.`);

const publishWorkerHandoff = (store: WorkerStore, directory: string, generatedAt: Date) => {
  const loaded = store.load();
  if (!loaded?.data.workspaceId) return { state: "idle" as const, reason: "workspace-not-initialized" as const, pendingBatchCount: 0, publishedBatchCount: 0, latestSequence: 0, coverage: "complete" as const, schedulerInstalled: false as const };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const pending = store.workerHandoffBatches(loaded.data.workspaceId);
  const sequence = store.workerHandoffSequence(loaded.data.workspaceId);
  const output: typeof pending = [];
  let partial = false;
  for (const batch of pending) {
    const next = [...output, batch];
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 20_000_000) { partial = true; break; }
    output.push(batch);
  }
  if (output.length < pending.length || (sequence.lastSequence > sequence.acknowledgedSequence && !pending.length)) partial = true;
  const scheduler = store.schedulerStatus(generatedAt, loaded.data.scannerSettings.providerDelayMinutesAfterClose);
  const manifest = makeWorkerHandoffManifest({
    workspaceId: loaded.data.workspaceId,
    generatedAt: generatedAt.toISOString(),
    workerRevision: loaded.revision,
    latestSequence: sequence.lastSequence,
    coverage: partial ? "partial" : "complete",
    scheduler: {
      state: scheduler.state,
      lastInvocationAtUtc: scheduler.lastInvocationAtUtc,
      lastSuccessfulRunAtUtc: scheduler.lastSuccessfulRunAtUtc,
      latestExpectedCompletedSession: scheduler.latestExpectedCompletedSession,
      latestSuccessfulSession: scheduler.latestSuccessfulSession,
      missedSessions: scheduler.missedSessions,
      partialSessions: scheduler.coverage.partialSessions,
      schedulerInstalled: false,
    },
    batches: output,
  });
  const destination = join(directory, "pending.json");
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(manifest), { mode: 0o600 });
  renameSync(temporary, destination);
  return { path: destination, pendingBatchCount: pending.length, publishedBatchCount: output.length, latestSequence: sequence.lastSequence, coverage: manifest.coverage };
};

const consumeWorkerHandoffAck = (store: WorkerStore, directory: string) => {
  const ackPath = join(directory, "ack.json");
  if (!existsSync(ackPath)) return;
  try {
    const ack = parseWorkerHandoffAck(readFileSync(ackPath, "utf8"));
    store.acknowledgeWorkerHandoff(ack);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid acknowledgement";
    console.error(`Local app handoff acknowledgement remains retryable: ${message}`);
  }
};

async function main() {
  if (values.help) { help(); return; }
  if (!['adjusted', 'unadjusted', 'unknown'].includes(values.adjustment!)) throw new Error("Invalid adjustment mode.");
  const dbPath = resolve(values.db!);
  const handoffDirectory = resolve(values["handoff-dir"]!);
  const store = new WorkerStore(dbPath);
  try {
    if (values.import) {
      const imported = parseExport(readFileSync(values.import, "utf8"));
      const current = store.load();
      if (current) {
        if (values["import-revision"] !== String(current.revision)) throw new Error(`Worker revision is ${current.revision}. Reconcile the latest worker export before using --import-revision ${current.revision} to replace it.`);
        await store.backup(`${dbPath}.before-import-${current.revision}-${Date.now()}.sqlite`);
      }
      store.import(imported, current?.revision ?? 0);
    }
    consumeWorkerHandoffAck(store, handoffDirectory);
    if (values.status) {
      const workspace = store.load();
      const scheduler = store.schedulerStatus(new Date(), workspace?.data.scannerSettings.providerDelayMinutesAfterClose ?? 45);
      const packageJson = readReleasePackage();
      const releaseIdentity = (() => {
        if (!values["release-evidence"]) return { state: "unavailable" as const, reason: "release_identity_unavailable" as const, sourceCommit: null, sourceTree: null };
        try {
          return verifyRuntimeReleaseEvidence(JSON.parse(readFileSync(resolve(values["release-evidence"]!), "utf8")), process.env.STOCKLEDGER_PROTECTED_BASE);
        } catch {
          return { state: "mismatched" as const, reason: "release_identity_mismatched" as const, sourceCommit: null, sourceTree: null };
        }
      })();
      const operations = createOperationsStatus(store, {
        appVersion: packageJson.version,
        nodeRequirement: packageJson.engines?.node ?? "unknown",
        sourceIdentity: { commit: releaseIdentity.sourceCommit, tree: releaseIdentity.sourceTree, state: releaseIdentity.state, reason: releaseIdentity.reason },
      });
      // Keep the historical scheduler shape, but replace free-form worker errors
      // with the safe versioned projection so --status cannot print private input.
      const handoff = publishWorkerHandoff(store, handoffDirectory, new Date());
      console.log(JSON.stringify({ scheduler: { ...scheduler, lastSafeError: operations.scheduler.lastErrorClass }, operations, handoff }));
      return;
    }
    if (values.csv) {
      const directory = resolve(values.csv);
      const names = readdirSync(directory).filter(name => /^[A-Z0-9][A-Z0-9.-]{0,15}\.csv$/.test(name));
      if (!names.length || names.length > 600) throw new Error("Expected 1–600 files named TICKER.csv.");
      const histories = names.sort().map(name => ({ symbol: name.slice(0, -4), rows: normalizeToSchema(name.slice(0, -4), readFileSync(join(directory, name), "utf8")) }));
      const result = await runWorker(store, histories, { source: values.source!, adjustment: values.adjustment as "adjusted" | "unadjusted" | "unknown" });
      console.log(JSON.stringify({ mode: values.managed ? "managed" : "local", ...result }));
    }
    const workspace = store.load();
    if (!workspace) throw new Error("No workspace. Use --import with an exported StockLedger backup.");
    let exported: string | undefined;
    if (values.output) {
      exported = resolve(values.output); mkdirSync(dirname(exported), { recursive: true, mode: 0o700 });
      const temporary = `${exported}.${process.pid}.tmp`;
      writeFileSync(temporary, serializeExport(workspace.data, workspace.revision), { mode: 0o600 }); renameSync(temporary, exported);
    }
    if (values.backup) await store.backup(resolve(values.backup));
    const handoff = publishWorkerHandoff(store, handoffDirectory, new Date());
    console.log(JSON.stringify({ ...(exported ? { exported } : {}), revision: workspace.revision, integrity: store.integrityCheck(), pendingNotificationIntents: store.pendingOutbox().length, scheduler: store.schedulerStatus(new Date(), workspace.data.scannerSettings.providerDelayMinutesAfterClose), handoff }));
  } finally { store.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; });
