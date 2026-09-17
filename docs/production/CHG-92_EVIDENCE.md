# CHG-92 deterministic Fabric evidence

## Source identity

- Protected-main base: `59cc7c672cd6b759cf0ceefb5a77acea66c7435d` (`origin/main` at task start)
- Tested implementation head: `8895d5ab48e3eef4e9d3e80d6f84751608f8dfcd`
- Branch: `codex/stockledger-prod-c05-scheduler-jobs-v1`
- Job contract: `stockledger-production-job-v1`, revision `1`
- Runtime: Node `v22.23.2`, npm `10.9.8`
- Hosted scheduler: not provisioned or exercised; external deployment remains a gate

The final evidence-publication commit is the child commit that adds this document. The tested implementation head above is the exact source commit for the runtime/test evidence below; this evidence document changes no executable code.

## Changed files

- `server/worker/contract.ts` — versioned job kinds, statuses, keys, retry policy and contract limits.
- `server/worker/managed.ts` — provider-independent managed execution, catch-up, lease heartbeat and deadline evidence.
- `server/worker/store.ts` — additive SQLite v2 migration, durable scheduler/job state, atomic claims/renewals/commits and status output.
- `server/worker/run.ts` — compatibility entry point delegating to managed execution.
- `server/worker/cli.ts` — `--managed` and machine-readable `--status` entry points.
- `src/lib/marketCalendar.ts` — next session and DST/early-close-aware due timestamps.
- `src/lib/stockConditionScanner.ts` — explicit scheduled-session execution input.
- `scripts/benchmark-worker.ts` — deadline/headroom evidence.
- `tests/worker.test.ts` — scheduler/job contract, recovery, leases, retries, partial data, catch-up, CLI and guard coverage.
- `docs/operations/LOCAL_WORKER.md` — local prerequisites, catch-up, status, handoff and managed-vs-local guarantees.
- `docs/operations/CLOUD_DEPLOYMENT.md` — explicit hosted execution gate.

## Verification matrix

All commands ran from the implementation workspace with Node `v22.23.2` on the tested implementation head. Exit codes were zero unless stated.

| Command | Exit | Evidence |
|---|---:|---|
| `npm ci` | 0 | 595 packages installed; 0 audit vulnerabilities. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test -- --run` | 0 | 15 files, 100 tests passed. |
| `npm test -- --run tests/worker.test.ts` | 0 | 12 scheduler/worker tests passed. |
| `npm run benchmark:worker` | 0 | Deterministic representative fixture and deadline evidence below. |
| `npm run check:frozen` | 0 | Structural check completed; result remains `blocked_unverified` for the documented independent-golden-output, survivorship, point-in-time-membership and forward-proof limitations. |
| `npm run check:boundaries` | 0 | Client secret/runtime-parser/server-import boundary passed. |
| `npm run export:all` | 0 | Web, iOS and Android bundles exported. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run test:e2e` | not run | No app UI files changed; the worker/status boundary remains explicit export/import. |

## Scheduler test matrix

- deterministic v1 stage keys and duplicate enqueue/repeated invocation;
- restart after durable progress and immutable result/outbox behavior;
- atomic claim, lease renewal, lease expiry, replacement and former-worker commit rejection;
- capped deterministic backoff, retry-wait and terminal failure after five attempts;
- partial provider/data failure with partial scan and one delivery-intent row;
- missed-session catch-up for multiple completed-market sessions;
- app-closed CLI invocation through `--managed` with truthful `schedulerInstalled:false` status;
- pathological batch admission guard with no discarded queued work;
- SQLite WAL/revision conflict, consistent backup and integrity recovery.

## Deadline/headroom evidence

`npm run benchmark:worker` processed the representative synthetic workload of **100 stocks × 260 sessions**, plus SPY and three sector inputs, through **4 contract stages**.

```json
{
  "elapsedMs": 2347,
  "workloadSize": { "stocks": 100, "sessions": 260, "symbols": 104, "rows": 27040, "jobStages": 4 },
  "deadlineBudgetMs": 1800000,
  "remainingHeadroomMs": 1797653,
  "withinBudget": true,
  "evidenceOnly": true,
  "evaluations": 100,
  "scannerRows": 200,
  "workspaceBytes": 5812831,
  "databaseBytesIncludingWal": 12160024,
  "endingRssBytes": 241041408,
  "integrity": true
}
```

This is engineering evidence from one machine/run, not a production SLA, p95 capacity claim, hosted guarantee or user-count forecast.
