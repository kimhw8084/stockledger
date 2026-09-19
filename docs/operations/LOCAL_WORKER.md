# Local worker and managed job contract

StockLedger has one provider-independent execution contract, `stockledger-production-job-v1`. The local CLI and an external cron/job platform may invoke the same `runManagedJob` entry point with authorized observations. The repository does not provision or exercise a hosted scheduler, so no managed scheduler deployment is claimed.

The no-subscription path remains local-first: the application can be closed, but the configured computer must be awake, the authorized CSV path must be readable, and an operator must install and monitor launchd/cron. Sleep, power-off, a stopped schedule, an unavailable data path, and provider failure are visible as missed/blocked/partial coverage; they are not silently treated as fresh market data. Notification delivery is optional and separate from evaluation: it runs only when this local worker is invoked with a server-side configured transport. The Expo app itself does not send background email or OS push.

## Contract and durable state

Each scheduled market session has four deterministic stage jobs. The production job contract is revision 2; revision-1 SQLite rows remain revision-1 records after additive migration to database version 3.

| Kind | Meaning | Result boundary |
|---|---|---|
| `ingestion-readiness` | Observation/data-path readiness for the session | Readiness is completed or partial; the input is never replaced with mock data. |
| `evaluation-scan` | Shared StockLedger snapshot, Eye evaluation, alert and condition-scan engine | Workspace, scanner evidence, immutable revisions and this job commit atomically. |
| `outcome-forward-proof` | Forward-proof/outcome stage represented by the scanner result | Completed evidence remains immutable; later observations only fill missing horizons. |
| `notification-outbox-intent` | Delivery intent for committed results | The outbox row is only intent; it is never marked delivered without a separate transport. |

The semantic identity includes the contract version, kind, scheduled session, calendar version, engine/rule versions, source content hash, adjustment declaration, scanner settings, recipes and Eye definitions. Repeating the same input produces the same job keys. Corrected input produces a new evidence revision and preserves the earlier records.

SQLite WAL keeps the workspace, recovery copies, jobs, scheduler checkpoint, reconciliation links, outbox, and CHG-95 ingestion run/item tables together. Claims use an immediate transaction. A job records `queued`, `running`, `retry-wait`, `completed`, `partial`, `blocked`, `terminal-failed`, or `superseded`, plus scheduled/due session, attempt count, lease owner/token/expiry, next retry, completion time, last safe error, input hash, output reference and semantic idempotency key. Leases are 15 minutes by default and are renewed by the managed runner heartbeat for long work. A replaced or expired token cannot commit.

`lastExpectedSession` is an observation/planning watermark, not proof that all earlier work finished. After enqueueing, an invocation may have durable `queued`, expired `running`, or `retry-wait` jobs for older sessions. Every later invocation reconciles newly due calendar sessions with those persisted jobs and processes the union in chronological order. A retry-wait job remains visible with its original attempt count and `nextRetryAt`; it is runnable only after that time. A terminal-failed semantic job is never reset to obtain another five attempts.

The runner also reconciles active semantic workflows by `workflowKey`/`inputHash`, not by scheduled session alone. If current provider histories/settings produce input B while queued, retry-wait, or expired-running workflow A is durable, the four replacement jobs are inserted and A is atomically linked through the SQLite `job_reconciliation` table with an immutable reason, replacement job/semantic identity and timestamp; eligible A jobs become `superseded` without changing attempts or saved errors. Superseded jobs remain queryable and retain retry-deadline/lease-time evidence, but no longer count toward active admission, retrying/missed coverage or current errors. Exact replay is not claimed because the old provider input is not persisted as a replay snapshot.

An unexpired running A lease is never superseded underneath its owner. The replacement B is durably linked but remains queued until A becomes terminal, so only one workflow can commit against the workspace revision at a time. Completed, partial, blocked and terminal-failed A jobs are never mutated; a separate reconciliation link records a corrected B when one is planned. This preserves the old identity and attempt history while allowing corrected B to be a genuinely new semantic workflow. Coverage uses unreconciled current jobs, so a superseded/reconciled A cannot appear as a current retry, miss or quality failure after B succeeds.

Retries are capped at five attempts. Backoff is deterministic: one minute, two, four, eight, then terminal failure; the delay is capped at 15 minutes. Result/evaluation/signal/alert/outbox writes use semantic IDs and one transaction, so retrying cannot duplicate semantic work. A workspace revision conflict rolls back the result and outbox together.

Admission guards reject more than 600 symbols, more than 1,000,000 input rows, more than 32 missed sessions in one catch-up, or more than 256 active queued jobs. Rejection preserves all existing jobs and reports a safe error; it does not discard work.

## Notification delivery contract

The delivery contract is `stockledger-notification-delivery-v1`, revision 1. Digest batching is `stockledger-notification-digest-v1`, revision 1. Preferences are `stockledger-notification-preferences-v1`, revision 1. Preferences are user-owned and included in the complete v2 backup envelope, but are explicitly `device-local`; CHG-93 personal sync does not sync a delivery destination or operate a provider. A managed deployment must add its own authenticated account-owned delivery boundary before treating a preference as cross-device. This local worker does not claim account-global cancellation.

Evaluation remains the source of deterministic alert state. A newly committed semantic alert can create one `notification_intents` row per channel/policy inside the same SQLite transaction as the workspace revision and the existing `notification.intent` outbox row. The outbox row is an event/intent record, never a sent or delivered count. Duplicate/replayed jobs are protected by semantic alert IDs and a unique `(semantic_key, channel, policy_key)` index. Existing v3 worker databases migrate additively through schema v4, v5 and v6; v6 adds digest tables, immutable member linkage, preference/cancellation fences and the safe status projection. Existing workspace, job, recovery, outbox, intent, attempt and receipt rows are not rewritten or discarded.

Each intent retains its alert identity, channel, policy, privacy mode, destination, scheduled/not-before time, cancellation reason, lease/fencing token, attempt count, next retry, terminal state and account scope. State meanings are:

| State | Guarantee |
|---|---|
| `pending` | Eligible for a configured transport claim. |
| `held` | Quiet hours, digest timing, or alert snooze has not elapsed; no retry is consumed. |
| `claimed` | A leased worker may submit bytes; an expired/replaced token cannot record an outcome. An expired claim becomes `ambiguous` rather than being resent blindly. |
| `delivered` | A transport-specific confirmed receipt was recorded. This is not a human-open/read claim. |
| `failed` | Definitive transport failure reached the five-attempt cap. |
| `retry-wait` | Definitive failure is retryable at deterministic 1/2/4/8-minute backoff, capped at 15 minutes. |
| `canceled` | Future work was opted out, below policy priority, explicitly invalidated, or lost its alert; snooze is a hold, not cancellation, and already-delivered receipts remain immutable. |
| `blocked-unconfigured` | Consent/destination/transport configuration is insufficient; it is never counted as delivered. Recovery can make it pending again. |
| `ambiguous` | Bytes may have been accepted but final delivery is unknown; it is not resent automatically and requires provider reconciliation/idempotency evidence. A worker crash or expired claim is treated conservatively the same way. |

Attempt and receipt rows are append-only. A provider submission alone never becomes `delivered`: the SMTP adapter records a `250` as `provider-accepted`/`ambiguous`, because SMTP has no recipient delivery proof. `SmtpEmailTransport` is server-only; host, port, sender, authentication and TLS configuration never enter Expo bundles. The isolated test transport can return an explicit confirmed receipt for lifecycle tests. No real recipient or unrelated provider was contacted during verification.

Digest mode is real batching, not just synchronized due times. The deterministic digest key includes the digest contract revision, channel, normalized destination, privacy mode, policy key, digest bucket/timezone, and sorted immutable member semantic intent IDs. Eligible members are linked and claimed atomically in `notification_digests`/`notification_digest_members`, so one digest produces one user-visible transport submission. A confirmed receipt is linked to every member without marking alerts reviewed. Definitive retries retain the same grouping and one five-attempt digest budget; provider-accepted or ambiguous outcomes are never resent member by member. Minimal digest content is generic; rich content is limited to approved bounded alert fields.

The minimal privacy mode sends only “A review is needed in StockLedger” plus a safe alert deep link and deterministic message identity. It excludes thesis text, personal notes, condition evidence, holdings and cloud payloads. Rich content is an explicit preference and is still not a diagnostic/logging channel. Logs and status output are limited to opaque IDs, channel/state, attempt/timestamps and bounded error classes; credentials, access tokens and alert payloads are not logged.

Preference opt-out transactionally cancels pending, held, retry-wait and blocked intents and records a cancellation request when work is already claimed. Claims capture the preference revision/hash. Immediately before transport acceptance, the worker rereads current preferences, snooze/account validity and cancellation state; the SMTP adapter repeats that fence before `DATA`. A revoked claim is canceled without sending or consuming a retry. If bytes may already have been accepted, provider-accepted/ambiguous evidence remains immutable and is never rewritten as canceled or blindly resent. Changes to destination/privacy/quiet hours affect eligible pending work. Quiet hours do not consume attempts. A snoozed alert is rechecked at claim time and cannot be newly submitted before expiry. Review state remains separate; this product policy does not cancel a pending delivery merely because an alert was reviewed. Account invalidation cancellation is implemented only for explicitly account-owned intents supplied by a deployment; device-local intents are not fabricated as cloud services.

To configure a real SMTP endpoint, construct the server-side adapter with a private `SmtpEmailTransport({ host, port, from, secure, username, password, timeoutMs })` in the worker runtime and invoke `deliverDueNotifications`. Do not put these values in `EXPO_PUBLIC_*` variables, backups, UI status or logs. A missing adapter, endpoint, sender or destination produces `blocked-unconfigured`. A successful local-worker run therefore proves only the local transport boundary and its configured machine; it does not prove external email reputation, recipient delivery, background availability, hosting, or a scheduler installation.

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

## CHG-95 market-data boundary

The provider-neutral contract is `stockledger-market-data-ingestion-v1`, revision 1. It currently covers completed US-equity/ETF daily OHLCV plus the reference-identity and corporate-action capability boundaries needed to interpret dated bars. Fundamentals, earnings/events/news, and intraday/real-time data are deferred and remain unsupported; they are not synthesized from price history.

Commercial managed acquisition is server/worker-only. A future adapter must return exact symbol/date-range observations with UTC retrieval time, adjustment basis, source/request identity where safe, freshness/coverage, stable content identity, validation issues, failure class, and a matching `stockledger-market-data-rights-v1` revision-2 profile using the versioned `stockledger-market-data-rights-authority-v1` model. Only a commercial profile bound to the exact provider/product, with a non-secret evidence reference, explicit `executed-agreement` authority, effective/unexpired dates, and an allowed requested use can pass production. Public comparison evidence is procurement input only and never authority; old profiles are rejected, never upgraded. No provider is selected in this repository, and no commercial license is claimed.

Use boundaries are independent and fail closed. Acquisition/processing requires `internal_computation`. Provider-derived metrics, signals, snapshots, alerts, and other normal user-facing derived state require `derived_metrics` plus `end_user_display` as applicable. Creating notification intents requires `notification`. User-facing export requires `user_export`; raw provider bars/raw archives leaving the controlled runtime additionally require `raw_redistribution`. The worker suppresses only the disallowed use, preserves valid unrelated local/user state, records a durable `rights_blocked:<use>:<reason>`, and never fabricates display, delivery, or export success. User-facing backup export filters provider content from missing, denied, expired, mismatched, or incomplete rights provenance; internal worker backups remain complete for controlled resume/audit.

Provider-derived records carry immutable safe provenance: exact provider/product, profile ID, rights contract revision, authority model/state, evidence reference, each evaluated use, decision/reason, decision time, and effective/expiry timestamps. Secrets and contract documents are never stored. Future managed actions re-evaluate the current profile and authority rather than trusting an old allowed decision.

Stooq remains the explicit public/research-only on-demand adapter. It cannot activate production managed ingestion. User-supplied CSV remains the complete local path and is a local-user boundary, not a commercial license claim.

The worker’s additive schema 7 stores `ingestion_runs` and `ingestion_items`. Run IDs include the contract/provider/product/symbol/date/rights identity; item IDs are stable per run/symbol. Accepted normalized items are retained, completed items are not refetched on replay, and unfinished retryable items resume within the persisted request budget. Symbol count, concurrency, request budget, and attempts are capped. Retryable timeout/outage/rate-limit failures use deterministic capped backoff; provider outage, malformed/empty/stale/partial input, missing required symbols, rate limits, and budget exhaustion remain partial/blocked states. None can be reported as a successful zero-match scan.

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

Outbox rows are delivery intent only. `pendingNotificationIntents` is not a sent/delivered count. Delivery status must be read from the notification intent/attempt/receipt tables. The lifecycle distinguishes alert creation, outbox intent, transport attempt, provider acceptance and confirmed delivery; none is inferred from another.

`WorkerStore.import()` applies notification preference reconciliation in the same transaction as workspace replacement. Opt-out cancels eligible pending/retry/blocked work; destination/privacy/timing changes update eligible work; delivered and ambiguous immutable history is untouched. Worker export carries a safe versioned `stockledger-notification-status-v1` projection with only the last intent/state, attempt count, safe timestamps, bounded error class and the worker-applied preference updatedAt/hash. It contains no attempt table, credentials, message body or alert payload and remains device-local outside CHG-93 sync. The app labels this as last-known worker state rather than live monitoring, reports actionable failed/ambiguous/blocked-unconfigured status, and shows pending worker handoff when a newer app preference has not yet been imported into the worker. Local app edits become effective in the separate worker only after the explicit export/import handoff.

## Measured representative fixture

`npm run benchmark:worker` runs the deterministic synthetic fixture: **100 stocks × 260 sessions**, with SPY and three sector inputs, through the four-stage contract. The benchmark output reports elapsed time, workload size, the explicit **30-minute engineering deadline budget**, remaining headroom, result counts, serialized workspace bytes, SQLite/WAL bytes, RSS and integrity. The CHG-95 Node 22.23.2 run recorded **4,751 ms elapsed**, **1,795,250 ms remaining headroom**, **100 Eye evaluations**, **200 scanner rows**, **5,813,608 workspace bytes**, **12,591,808 SQLite/WAL bytes**, **229,998,592 RSS bytes**, and integrity `true`.

This is one deterministic engineering measurement, not p95 capacity, a production SLA, a hosted guarantee, or a user-count forecast. The CHG-94 notification delivery phase is not included in this evaluation benchmark; it has its own transport/lifecycle evidence.
