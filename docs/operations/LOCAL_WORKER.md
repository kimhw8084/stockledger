# Local worker and managed job contract

StockLedger has one provider-independent execution contract, `stockledger-production-job-v1`. The local CLI and an external cron/job platform may invoke the same `runManagedJob` entry point with authorized observations. The repository does not provision or exercise a hosted scheduler, so no managed scheduler deployment is claimed.

The no-subscription path remains local-first: the application can be closed, but the configured computer must be awake, the authorized CSV path must be readable, and an operator must install and monitor launchd/cron. Sleep, power-off, a stopped schedule, an unavailable data path, and provider failure are visible as missed/blocked/partial coverage; they are not silently treated as fresh market data. No network requests, notification delivery, orders, billing, or email are performed.

## Contract and durable state

Each scheduled market session has four deterministic stage jobs. The production job contract is revision 2; revision-1 SQLite rows remain revision-1 records after additive migration to database version 3.

| Kind | Meaning | Result boundary |
|---|---|---|
| `ingestion-readiness` | Observation/data-path readiness for the session | Readiness is completed or partial; the input is never replaced with mock data. |
| `evaluation-scan` | Shared StockLedger snapshot, Eye evaluation, alert and condition-scan engine | Workspace, scanner evidence, immutable revisions and this job commit atomically. |
| `outcome-forward-proof` | Forward-proof/outcome stage represented by the scanner result | Completed evidence remains immutable; later observations only fill missing horizons. |
| `notification-outbox-intent` | Delivery intent for committed results | The outbox row is only intent; it is never marked delivered without a separate transport. |

The semantic identity includes the contract version, kind, scheduled session, calendar version, engine/rule versions, source content hash, adjustment declaration, scanner settings, recipes and Eye definitions. Repeating the same input produces the same job keys. Corrected input produces a new evidence revision and preserves the earlier records.

SQLite WAL keeps the workspace, recovery copies, jobs, scheduler checkpoint, reconciliation links and outbox together. Claims use an immediate transaction. A job records `queued`, `running`, `retry-wait`, `completed`, `partial`, `blocked`, `terminal-failed`, or `superseded`, plus scheduled/due session, attempt count, lease owner/token/expiry, next retry, completion time, last safe error, input hash, output reference and semantic idempotency key. Leases are 15 minutes by default and are renewed by the managed runner heartbeat for long work. A replaced or expired token cannot commit.

`lastExpectedSession` is an observation/planning watermark, not proof that all earlier work finished. After enqueueing, an invocation may have durable `queued`, expired `running`, or `retry-wait` jobs for older sessions. Every later invocation reconciles newly due calendar sessions with those persisted jobs and processes the union in chronological order. A retry-wait job remains visible with its original attempt count and `nextRetryAt`; it is runnable only after that time. A terminal-failed semantic job is never reset to obtain another five attempts.

The runner also reconciles active semantic workflows by `workflowKey`/`inputHash`, not by scheduled session alone. If current provider histories/settings produce input B while queued, retry-wait, or expired-running workflow A is durable, the four replacement jobs are inserted and A is atomically linked through the SQLite `job_reconciliation` table with an immutable reason, replacement job/semantic identity and timestamp; eligible A jobs become `superseded` without changing attempts or saved errors. Superseded jobs remain queryable and retain retry-deadline/lease-time evidence, but no longer count toward active admission, retrying/missed coverage or current errors. Exact replay is not claimed because the old provider input is not persisted as a replay snapshot.

An unexpired running A lease is never superseded underneath its owner. The replacement B is durably linked but remains queued until A becomes terminal, so only one workflow can commit against the workspace revision at a time. Completed, partial, blocked and terminal-failed A jobs are never mutated; a separate reconciliation link records a corrected B when one is planned. This preserves the old identity and attempt history while allowing corrected B to be a genuinely new semantic workflow. Coverage uses unreconciled current jobs, so a superseded/reconciled A cannot appear as a current retry, miss or quality failure after B succeeds.

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

The scheduler checkpoint records the latest expected completed-market session it has observed/planned; it does not certify completion. If the computer wakes after a weekend, outage, or sleep, a later invocation reconciles the bounded set of newly due NYSE sessions with all persisted unfinished jobs, including work that was queued before a crash, and processes them in order. Already completed same-input semantic keys are not replayed. If the catch-up or queue exceeds an admission guard, existing work remains persisted and the invocation reports `admission_blocked`; it does not advance the watermark past unplanned work or drop old sessions.

`--status` can report calendar sessions missed while the process was stopped even when no job row was created. Those derived obligations begin only after the scheduler has a known `lastExpectedSession` baseline and use the maintained NYSE calendar through `2028-12-31`; status does not invent obligations before that operating window. `partial` and `blocked` sessions remain separate quality coverage and are not counted as completed success. If corrected input for an older partial or blocked session changes its semantic input hash, new immutable stage/evidence rows may be created while the prior final job and evidence remain unchanged. The same applies to a terminal-failed identity: it remains terminal and is never granted another five attempts; corrected input creates a genuinely new semantic identity. Repeating the corrected input is a no-op. The reconciliation linkage/status survives SQLite close/reopen and is included in audit job queries.

The current session is eligible only after the maintained NYSE close plus the workspace provider delay. The calendar is `NYSE-2026-09-15`, reviewed through `2028-12-31`, and handles holidays, early closes, DST and the recorded exceptional closure. Extend and independently verify it before scheduling outside that range.

For machine-readable coverage without running work:

```sh
npm run worker -- --status --db /absolute/path/worker.sqlite
```

The JSON includes contract version/revision, `lastSuccessfulRunAtUtc`, `latestExpectedCompletedSession`, `nextDueAtUtc`, deadline budget/deadline, missed sessions, per-status counts including audit-only `superseded`, completed/partial/blocked/retrying/terminal-failed sessions, pending outbox intents, and the truthful local dependency. `schedulerInstalled` is always `false` in this repository because no schedule was installed here.

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

`npm run benchmark:worker` runs the deterministic synthetic fixture: **100 stocks × 260 sessions**, with SPY and three sector inputs, through the four-stage contract. The benchmark output reports elapsed time, workload size, the explicit **30-minute engineering deadline budget**, remaining headroom, result counts, serialized workspace bytes, SQLite/WAL bytes, RSS and integrity. A current Node 22.23.2 run recorded **2,211 ms elapsed**, **1,797,790 ms remaining headroom**, **100 Eye evaluations**, **200 scanner rows**, **5,812,831 workspace bytes**, **12,192,912 SQLite/WAL bytes**, **239,517,696 RSS bytes**, and integrity `true`.

This is one deterministic engineering measurement, not p95 capacity, a production SLA, a hosted guarantee, or a user-count forecast.
