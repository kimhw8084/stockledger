# CHG-92 deterministic Fabric evidence

## Source identity

- Protected-main base: `59cc7c672cd6b759cf0ceefb5a77acea66c7435d` (`origin/main` at task start)
- Tested implementation head: `5c54d5fba96d67af86d37b074d13405106c95def`
- Evidence publication head: documentation-only child commit of the tested implementation head; exact final head is reported with this publication.
- R1 candidate carried forward exactly: `66ba55796e58c2d37882f091854860d7998a8842`
- Branch: `codex/stockledger-prod-c05-scheduler-recovery-fix-v1`
- Job contract: `stockledger-production-job-v1`, revision `1`
- Runtime: Node `v22.23.2`, npm `10.9.8`
- Hosted scheduler: not provisioned or exercised; external deployment remains a gate

The tested implementation head will be the exact source commit for the runtime/test evidence below; the evidence-publication commit changes documentation only. The protected-main base and R1 candidate were carried forward exactly before the focused recovery correction.

## Changed files

- `server/worker/contract.ts` — versioned job kinds, statuses, keys, retry policy and contract limits.
- `server/worker/managed.ts` — provider-independent managed execution, durable-session reconciliation, chronological recovery, lease heartbeat and deadline evidence.
- `server/worker/store.ts` — additive SQLite v2 migration, durable scheduler/job state, atomic claims/renewals/commits, nullable patch semantics and baseline-aware status output.
- `server/worker/run.ts` — compatibility entry point delegating to managed execution.
- `server/worker/cli.ts` — `--managed` and machine-readable `--status` entry points.
- `src/lib/marketCalendar.ts` — next session and DST/early-close-aware due timestamps.
- `src/lib/stockConditionScanner.ts` — explicit scheduled-session execution input.
- `scripts/benchmark-worker.ts` — deadline/headroom evidence.
- `tests/worker.test.ts` — scheduler/job contract, interruption/restart recovery, leases, retries, partial/blocked correction, catch-up, CLI, status-only misses and guard coverage.
- `docs/operations/LOCAL_WORKER.md` — local prerequisites, checkpoint meaning, crash recovery, status, corrected data, handoff and managed-vs-local guarantees.
- `docs/operations/CLOUD_DEPLOYMENT.md` — explicit hosted execution gate.

## Verification matrix

All commands ran from the implementation workspace with Node `v22.23.2` on the tested implementation head. Exit codes were zero unless stated.

| Command | Exit | Evidence |
|---|---:|---|
| `npm ci` | 0 | 595 packages installed; 0 audit vulnerabilities. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test -- --run` | 0 | 15 files, 108 tests passed. |
| `npm test -- --run tests/worker.test.ts` | 0 | 20 scheduler/worker tests passed, including the restart/recovery matrix below. |
| `npm run benchmark:worker` | 0 | Deterministic representative fixture and deadline evidence below; Node v22.23.2. |
| `npm run check:frozen` | 0 | Structural check completed; result remains `blocked_unverified` for the documented independent-golden-output, survivorship, point-in-time-membership and forward-proof limitations. |
| `npm run check:boundaries` | 0 | Client secret/runtime-parser/server-import boundary passed. |
| `npm run export:all` | 0 | Web, iOS and Android bundles exported. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run test:e2e` | not run | No app UI files changed; the worker/status boundary remains explicit export/import. |

## Scheduler test matrix

- deterministic v1 stage keys and duplicate enqueue/repeated invocation;
- multi-session interruption before the first and middle session, close/reopen, newest-watermark recovery of all older durable jobs and immutable result/outbox behavior;
- atomic claim, lease renewal, lease expiry, replacement and former-worker commit rejection;
- capped deterministic backoff, retry-wait persistence/nextRetryAt enforcement across restart and terminal failure after five attempts;
- partial/blocked provider/data failure followed by a genuinely new corrected semantic revision that preserves prior evidence;
- explicit scheduler-state null clearing and successful-recovery safe-error visibility;
- missed-session catch-up for multiple completed-market sessions;
- status-only calendar missed-session visibility after time advances without an invocation, bounded by the known checkpoint baseline;
- app-closed CLI invocation through `--managed` with truthful `schedulerInstalled:false` status;
- pathological batch, 32-session and 256-active-job admission guards with no discarded queued work;
- SQLite WAL/revision conflict, consistent backup and integrity recovery.

## Deadline/headroom evidence

`npm run benchmark:worker` processed the representative synthetic workload of **100 stocks × 260 sessions**, plus SPY and three sector inputs, through **4 contract stages**.

```json
{
  "elapsedMs": 2069,
  "workloadSize": { "stocks": 100, "sessions": 260, "symbols": 104, "rows": 27040, "jobStages": 4 },
  "deadlineBudgetMs": 1800000,
  "remainingHeadroomMs": 1797931,
  "withinBudget": true,
  "evidenceOnly": true,
  "evaluations": 100,
  "scannerRows": 200,
  "workspaceBytes": 5812831,
  "databaseBytesIncludingWal": 12160024,
  "endingRssBytes": 240467968,
  "integrity": true
}
```

This is engineering evidence from one machine/run, not a production SLA, p95 capacity claim, hosted guarantee or user-count forecast.
