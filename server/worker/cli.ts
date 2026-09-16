import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseExport, serializeExport } from "../../src/domain/backupFormat";
import { normalizeToSchema } from "../../src/lib/eodDataProvider";
import { WorkerStore } from "./store";
import { runWorker } from "./run";

const { values } = parseArgs({ options: { db: { type: "string", default: ".local/stockledger.sqlite" }, import: { type: "string" }, "import-revision": { type: "string" }, csv: { type: "string" }, output: { type: "string", default: ".local/StockLedger-worker.json" }, backup: { type: "string" }, adjustment: { type: "string", default: "unknown" }, source: { type: "string", default: "Local CSV import" }, help: { type: "boolean" } } });
async function main() {
  if (values.help) { console.log("StockLedger local worker\n--import BACKUP.json imports into an empty DB. Existing DBs require --import-revision N and get an automatic SQLite backup before replacement.\n--csv DIRECTORY evaluates SYMBOL.csv files; --adjustment adjusted|unadjusted|unknown declares provider metadata.\n--output FILE exports a validated app backup. --backup FILE creates a consistent SQLite snapshot.\n--db FILE selects the worker database. No network requests or emails are sent."); return; }
  if (!["adjusted", "unadjusted", "unknown"].includes(values.adjustment!)) throw new Error("Invalid adjustment mode.");
  const store = new WorkerStore(resolve(values.db!));
  try {
    if (values.import) {
      const imported = parseExport(readFileSync(values.import, "utf8"));
      const current = store.load();
      if (current) {
        if (values["import-revision"] !== String(current.revision)) throw new Error(`Worker revision is ${current.revision}. Reconcile the latest worker export before using --import-revision ${current.revision} to replace it.`);
        await store.backup(`${resolve(values.db!)}.before-import-${current.revision}-${Date.now()}.sqlite`);
      }
      store.import(imported, current?.revision ?? 0);
    }
    if (values.csv) {
      const directory = resolve(values.csv);
      const names = readdirSync(directory).filter(name => /^[A-Z0-9][A-Z0-9.-]{0,15}\.csv$/.test(name));
      if (!names.length || names.length > 600) throw new Error("Expected 1–600 files named TICKER.csv.");
      const histories = names.sort().map(name => ({ symbol: name.slice(0, -4), rows: normalizeToSchema(name.slice(0, -4), readFileSync(join(directory, name), "utf8")) }));
      console.log(JSON.stringify(await runWorker(store, histories, { source: values.source!, adjustment: values.adjustment as "adjusted" | "unadjusted" | "unknown" })));
    }
    const workspace = store.load();
    if (!workspace) throw new Error("No workspace. Use --import with an exported StockLedger backup.");
    const output = resolve(values.output!); mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    const temporary = `${output}.${process.pid}.tmp`;
    writeFileSync(temporary, serializeExport(workspace.data, workspace.revision), { mode: 0o600 }); renameSync(temporary, output);
    if (values.backup) await store.backup(resolve(values.backup));
    console.log(JSON.stringify({ exported: output, revision: workspace.revision, integrity: store.integrityCheck(), pendingNotifications: store.pendingOutbox().length }));
  } finally { store.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; });
