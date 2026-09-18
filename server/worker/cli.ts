import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseExport, serializeExport } from "../../src/domain/backupFormat";
import { normalizeToSchema } from "../../src/lib/eodDataProvider";
import { runWorker } from "./run";
import { WorkerStore } from "./store";

const { values } = parseArgs({ options: {
  db: { type: "string", default: ".local/stockledger.sqlite" }, import: { type: "string" }, "import-revision": { type: "string" },
  csv: { type: "string" }, output: { type: "string", default: ".local/StockLedger-worker.json" }, backup: { type: "string" },
  adjustment: { type: "string", default: "unknown" }, source: { type: "string", default: "Local CSV import" }, managed: { type: "boolean" }, status: { type: "boolean" }, help: { type: "boolean" },
} });

const help = () => console.log(`StockLedger worker
--import BACKUP.json imports into an empty DB. Existing DBs require --import-revision N and get an automatic SQLite backup before replacement.
--csv DIRECTORY evaluates SYMBOL.csv files; --adjustment adjusted|unadjusted|unknown declares provider metadata.
--managed invokes the provider-independent production job contract used by external cron/job platforms. It does not install a hosted scheduler.
--status prints machine-readable scheduler coverage/status without running work.
--output FILE exports a validated app backup. --backup FILE creates a consistent SQLite snapshot.
--db FILE selects the worker database. Evaluation does not contact a provider; server-only delivery is a separate runNotificationDelivery phase.`);

async function main() {
  if (values.help) { help(); return; }
  if (!['adjusted', 'unadjusted', 'unknown'].includes(values.adjustment!)) throw new Error("Invalid adjustment mode.");
  const dbPath = resolve(values.db!);
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
    if (values.status) {
      const workspace = store.load();
      console.log(JSON.stringify({ scheduler: store.schedulerStatus(new Date(), workspace?.data.scannerSettings.providerDelayMinutesAfterClose ?? 45) }));
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
    const output = resolve(values.output!); mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    const temporary = `${output}.${process.pid}.tmp`;
    writeFileSync(temporary, serializeExport(workspace.data, workspace.revision), { mode: 0o600 }); renameSync(temporary, output);
    if (values.backup) await store.backup(resolve(values.backup));
    console.log(JSON.stringify({ exported: output, revision: workspace.revision, integrity: store.integrityCheck(), pendingNotificationIntents: store.pendingOutbox().length, scheduler: store.schedulerStatus(new Date(), workspace.data.scannerSettings.providerDelayMinutesAfterClose) }));
  } finally { store.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; });
