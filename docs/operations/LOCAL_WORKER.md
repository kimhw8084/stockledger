# Local worker and managed job contract

StockLedger has one provider-independent execution contract, `stockledger-production-job-v1`. The local CLI and an external cron/job platform may invoke the same `runManagedJob` entry point with authorized observations. The repository does not provision or exercise a hosted scheduler, so no managed scheduler deployment is claimed.

The no-subscription path remains local-first: the application can be closed, but the configured computer must be awake, the authorized CSV path must be readable, and an operator must install and monitor launchd/cron. Sleep, power-off, a stopped schedule, an unavailable data path, and provider failure are visible as missed/blocked/partial coverage; they are not silently treated as fresh market data. No network requests, notification delivery, orders, billing, or email are performed.

## Contract and durable state

Each scheduled market session has four deterministic stage jobs:

| Kind | Meaning | Result boundary |
|---|---|---|
| `ingestion-readiness` | Observation/data-path readiness for the session | Readiness is completed or partial; the input is never replaced with mock data. |
| `evaluation-scan` | Shared StockLedger snapshot, Eye evaluation, alert and condition-scan engine | Workspace, scanner evidence, immutable revisions and this job commit atomically. |
| `outcome-forward-proof` | Forward-proof/outcome stage represented by the scanner result | Completed evidence remains immutable; later observations only fill missing horizons. |
| `notification-outbox-intent` | Delivery intent for committed results | The outbox row is only intent; it is never marked delivered without a separate transport. |

The semantic identity includes the contract version, kind, scheduled session, calendar version, engine/rule versions, source content hash, adjustment declaration, scanner settings, recipes and Eye definitions. Repeating the same input produces the same job keys. Corrected input produces a new evidence revision and preserves the earlier records.

SQLite WAL keeps the workspace, recovery copies, jobs, scheduler checkpoint and outbox together. Claims use an immediate transaction. A job records `queued`, `running`, `retry-wait`, `completed`, `partial`, `blocked`, or `terminal-failed`, plus scheduled/due session, attempt count, lease owner/token/expiry, next retry, completion time, last safe error, input hash, output reference and semantic idempotency key. Leases are 15 minutes by default and are renewed by the managed runner heartbeat for long work. A replaced or expired token cannot commit.

Retries are capped at five attempts. Backoff is deterministic: one minute, two, four, eight, then terminal failure; the delay is capped at 15 minutes. Result/evaluation/signal/alert/outbox writes use semantic IDs and one transaction, so retrying cannot duplicate semantic work. A workspace revision conflict rolls back the result and outbox together.

Admission guards reject more than 600 symbols, more than 1,000,000 input rows, more than 32 missed sessions in one catch-up, or more than 256 active queued jobs. Rejection preserves all existing jobs and reports a safe error; it does not discard work.

## Bootstrap

1. Prepare a personal workspace in the app and export its complete backup.
2. Put provider-authorized daily CSV files in a private directory, named `AAPL.csv`, `SPY.csv`, etc. Columns: `Date,Open,High,Low,Close,Volume`. Rows must be ordered and complete for the supplied NYSE sessions. Adjustment metadata must come from the provider.
3. For the frozen scanner, configure `scannerSettings.frozenUniverseBySector` with `XLK`, `XLY`, and `XLI` keys containing ticker lists. Supply SPY and the relevant sector ETF files. An empty universe creates a blocked scan; watched-stock Eyes still evaluate available CSV observations.
4. Use Node 22.23.2 and installed dependencies:

```sh
node --version
npm ci
npm run worker -- --help
npm run worker -- --managed --import /absolute/path/StockLedger.json --csv /absolute/path/prices --adjustment adjusted --source "Provider / dataset release" --backup /absolute/path/backups/worker-initial.sqlite
```

Defaults are `.local/stockledger.sqlite` and `.local/StockLedger-worker.json`. Override them with `--db` and `--output`. Generated directories/files have restrictive permissions. Backups are plaintext private records. Node 22 labels its built-in SQLite API experimental; the pinned version has restart, transaction, lease, migration and snapshot tests.

## Repeated operation and catch-up

```sh
npm run worker -- --managed --csv /absolute/path/prices --adjustment adjusted --source "Provider / dataset release" --backup /absolute/path/backups/worker-latest.sqlite
```

The scheduler checkpoint records the latest expected completed-market session it has seen. If the computer wakes after a weekend, outage, or sleep, a later invocation creates the bounded set of overdue NYSE sessions and processes them in order. Already completed semantic keys are not replayed. If the catch-up or queue exceeds an admission guard, work remains persisted and the invocation reports `admission_blocked`; it does not skip old sessions.

The current session is eligible only after the maintained NYSE close plus the workspace provider delay. The calendar is `NYSE-2026-09-15`, reviewed through `2028-12-31`, and handles holidays, early closes, DST and the recorded exceptional closure. Extend and independently verify it before scheduling outside that range.

For machine-readable coverage without running work:

```sh
npm run worker -- --status --db /absolute/path/worker.sqlite
```

The JSON includes contract version, `lastSuccessfulRunAtUtc`, `latestExpectedCompletedSession`, `nextDueAtUtc`, deadline budget/deadline, missed sessions, per-status counts, completed/partial/blocked/retrying/terminal-failed sessions, pending outbox intents, and the truthful local dependency. `schedulerInstalled` is always `false` in this repository because no schedule was installed here.

The app cannot show this as live monitoring: app and worker storage remain an explicit export/import handoff, not synchronization. Import the worker export into the app to review results. Do not add a UI claim that a schedule is installed or that app opening drives the worker.

## Installing a local schedule

Configure launchd or cron with absolute Node/npm, repository, DB, CSV, output, backup and log paths. A 30-minute schedule after the provider’s normal publication window is reasonable for repeated checks; it is an operator choice, not an installed StockLedger schedule. CSV acquisition is a separate permissioned step.

Use private rotated logs, alert on nonzero exits, and inspect `--status` for `missed`, `stopped`, `blocked`, or `terminal-failed`. The machine must remain awake. A sleeping laptop catches up only after waking; this is not an always-on hosted service. If the schedule is removed, the status surface can only report that invocations stopped—it cannot infer that an OS schedule exists.

## App handoff and recovery

Import the latest worker export into the app first, edit it, and export again. Pause scheduled writers during this handoff. Read the current worker revision from a normal export, then explicitly replace it:

```sh
npm run worker -- --import /absolute/path/edited-worker-export.json --import-revision 12
```

The revision must match. A consistent `before-import` SQLite copy is created before replacement. This is whole-workspace replacement, not an automatic three-way merge. Stop writers before replacing a DB. Prefer `--backup` over copying a live SQLite file alone. Preserve DB/WAL/SHM together after an unclean shutdown. Open backups at a new `--db` path, check integrity, export and validate in the app before switching the schedule.

Outbox rows are delivery intent only. `pendingNotificationIntents` is not a sent/delivered count. A future delivery transport must claim and acknowledge delivery separately, with its own idempotency and receipt semantics.

## Measured representative fixture

`npm run benchmark:worker` runs the deterministic synthetic fixture: **100 stocks × 260 sessions**, with SPY and three sector inputs, through the four-stage contract. The benchmark output reports elapsed time, workload size, the explicit **30-minute engineering deadline budget**, remaining headroom, result counts, serialized workspace bytes, SQLite/WAL bytes, RSS and integrity. A current Node 22.23.2 run recorded **2,489 ms elapsed**, **1,797,511 ms remaining headroom**, **100 Eye evaluations**, **200 scanner rows**, **5,812,831 workspace bytes**, **12,160,024 SQLite/WAL bytes**, **240,697,344 RSS bytes**, and integrity `true`.

This is one deterministic engineering measurement, not p95 capacity, a production SLA, a hosted guarantee, or a user-count forecast.
