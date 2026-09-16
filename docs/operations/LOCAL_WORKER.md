# Local worker: no new service subscription

The worker uses the same validation/evaluation engine as the app. It can run while the app is closed, but needs an awake computer and an operator-configured schedule. It reads local CSV files and sends no network requests or emails. It does not place orders.

## Bootstrap

1. Prepare a personal workspace in the app and export its complete backup.
2. Put provider-authorized daily CSV files in a private directory, named `AAPL.csv`, `SPY.csv`, etc. Columns: `Date,Open,High,Low,Close,Volume`. Rows must be ordered, complete NYSE sessions. Adjustment metadata must come from the provider.
3. For the frozen scanner, configure `scannerSettings.frozenUniverseBySector` in the exported workspace with `XLK`, `XLY`, `XLI` keys containing ticker lists. Supply SPY and the relevant sector ETF files too. An empty universe creates a blocked scan; watched-stock Eyes still evaluate available CSV observations.
4. Use Node 22.23.2 and installed dependencies:

```sh
npm run worker -- --help
npm run worker -- --import /absolute/path/StockLedger.json --csv /absolute/path/prices --adjustment adjusted --source "Provider / dataset release" --backup /absolute/path/backups/worker-initial.sqlite
```

Defaults: `.local/stockledger.sqlite` and `.local/StockLedger-worker.json`. Override with `--db` and `--output`. Generated directories/files have restrictive permissions. Backups are plaintext private records. Node 22 labels its built-in SQLite API experimental; the pinned version has restart/transaction/snapshot tests.

Import the exported JSON into the app to review results. Worker storage is independent of app storage: files are an explicit handoff, not live synchronization.

## Repeated operation

```sh
npm run worker -- --csv /absolute/path/prices --adjustment adjusted --source "Provider / dataset release" --backup /absolute/path/backups/worker-latest.sqlite
```

Completed identical work is not repeated. Identity includes completed session, source content, adjustment, settings, recipes/Eyes and rule signatures. Jobs have a 15-minute lease, five-attempt maximum, and a one-minute failure retry delay. Expired workers cannot commit. Workspace, result and outbox changes commit together. Outbox rows record notification intent only; external email/push delivery is not implemented.

CLI output includes status, revision, export path, integrity and pending notification count. Partial/blocked runs are quality results, not successful signals. Corrected data creates another evidence revision. Archives grow; watch disk space and keep independent backups rather than silently discarding evidence.

## Adopting later app edits

Import the latest worker export into the app first, edit it, and export again. Pause scheduled writers during this handoff. Read the current worker revision from a normal export, then explicitly replace it:

```sh
npm run worker -- --import /absolute/path/edited-worker-export.json --import-revision 12
```

The revision must match. A consistent `before-import` SQLite copy is created before replacement. This is whole-workspace replacement, not an automatic three-way merge. Reconcile stale app copies before adopting them. Plain `--import` refuses to overwrite an existing worker DB.

## Schedule and recover

Configure launchd/cron using absolute Node/npm, repository, DB and CSV paths. A 30-minute schedule can invoke the repeated-operation command; session dates and idempotency handle repeated checks. CSV acquisition is a separate permissioned step. Unchanged files never become new observations.

Use private rotated logs. Check nonzero exits and missed expected sessions. A sleeping laptop catches up only after waking; this path is not an always-on hosted service. No scheduler was installed: the real workspace, data directory and desired schedule have not been supplied.

Stop writers before replacing a DB. Prefer `--backup` over copying a live SQLite file alone. Preserve DB/WAL/SHM together after an unclean shutdown. Open backups at a new `--db` path, check integrity, export and validate in the app before switching the schedule. Five previous workspace revisions are kept locally; independent rotated snapshots remain necessary.

## Measured fixture

`npm run benchmark:worker` generates disposable synthetic data. One September 2026 local run processed **100 stocks × 260 sessions in 2,036 ms**, with **100 Eye evaluations and 200 scanner rows**. JSON was **5,656,231 bytes**; DB/WAL total **11,736,672 bytes**; ending RSS **251,641,856 bytes**. This is one machine/run, not p95 or a hosted capacity SLA.

Calendar coverage is 2024–2028. Extend and independently verify it before earlier histories or later scheduling.
