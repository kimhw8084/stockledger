# CHG-96 — operations, recovery and release evidence

This change establishes a repository-owned evidence spine for the local worker and the existing isolated cloud contract. It does not create a hosted production environment or turn an external gate into a repository fact.

## Repository automation now proves

- `stockledger-operations-status-v1`, revision 1, is a read-only projection of the existing WorkerStore tables. `--status` keeps the historical scheduler object and adds the versioned `operations` projection.
- The projection reports scheduler coverage, durable job counts/age, ingestion runs/items/budget facts, notification lifecycle counts/age, workspace revision and export schema, SQLite schema/integrity/storage facts, repository-known sync state, release contract versions, and explicit external-gate states. `--release-evidence FILE` binds its release identity to the verified candidate manifest when one is available.
- Diagnostics are bounded to IDs, dates, state, contract versions, error classes, hashes and numeric measurements. It does not emit workspace rows, thesis/private-note text, CSV content, notification destinations/bodies, credentials, tokens, provider keys, passwords, or service-role values.
- `npm run recovery:drill` uses a synthetic fixture, the real `WorkerStore.backup()` path, a separate restore path, `PRAGMA integrity_check`, supported-schema validation, validated export parsing, source non-mutation checks, and truncated/incompatible candidate rejection.
- `npm run release:evidence` and `npm run release:verify` create and verify source-bound `stockledger-release-evidence-v1` manifests. They bind the candidate commit/tree, ordered migration digests, package-lock digest, contract/schema versions and optional generated artifact digests. Verification fails closed on stale source/tree, changed migrations, malformed manifests, contract/schema mismatch, changed lock/artifact identity or destructive rollback assertions.
- `npm run operations:qualify` runs repeated synthetic worker samples, backlog/retry/terminal fixtures, storage measurements, RSS measurement, integrity checks and the recovery drill. Percentiles are emitted only when at least two actual samples were completed.

## Recovery semantics

The consistent SQLite snapshot is the RPO boundary: committed workspace revision and durable operational rows at that snapshot have zero measured loss in the drill. Loss since the last operator-created backup is unknown and unbounded when no backup cadence is configured. These are recovery semantics, not a customer SLA.

The drill compares elapsed recovery with a 30,000 ms engineering qualification budget for the synthetic fixture. The result is labeled `evidenceOnly`; it is not an availability promise, hosted backup proof, provider SLA or production recovery exercise.

Rollback is additive/forward-only for database schemas. A static artifact may roll back only to a verified compatible source/schema contract. SQLite restore is to a new path after writers stop, integrity/export checks pass, and the operator explicitly switches paths. No destructive downgrade is supported.

## Isolated cloud recovery/rollback boundary

The existing embedded PostgreSQL and disposable local Supabase tests prove application-owned batch atomicity, owner isolation, revisions, mutation replay/idempotency, tombstones, ordered cursors and explicit cursor-expiry behavior. A failed batch leaves no partial new record. This is the smallest safe rollback proof for the current stack.

It does not prove hosted provider backup/restore, Auth-provider backup or revocation guarantees, hosted deployment recovery, or a production cloud restore. Those remain external gates.

## Incident/tabletop coverage

The repository-owned scenarios are mechanically covered by focused worker, ingestion, notification, sync, storage, cloud and recovery tests:

- provider outage/partial data → ingestion failure classes, partial coverage and rights-blocked state are preserved;
- missed scan/catch-up → scheduler coverage and durable job reconciliation remain inspectable;
- wrong calculation/source revision → immutable historical rows and corrected semantic identities remain available;
- save/storage failure → repository revision guards and previous-copy recovery preserve the last valid state;
- corrupt store → valid backup is restored to a new path while the damaged candidate is retained and rejected;
- sync conflict/interruption → exact revision/cursor-bound conflicts and durable mutation intents are retained;
- notification failure/ambiguity/unconfigured transport → bounded retry, terminal and ambiguous states are reported without message content or destination;
- billing → explicitly `not-configured`; no nonexistent billing service is drilled or claimed.

## Measured synthetic qualification

Run:

```sh
npm run recovery:drill
npm run operations:qualify
```

The generated JSON includes `synthetic: true`, workload/sample counts, elapsed time, deadline headroom, actual p50/p95 samples when available, backlog depth/age, retry/terminal behavior, storage growth, RSS, recovery elapsed time and integrity. It must not be described as production capacity, p95 user latency, provider throughput, an SLA, real-user load or a public-production readiness claim.

One local Node 22.23.2 qualification run measured 100 synthetic stocks, 260 history sessions and three actual samples at 7,301 / 8,783 / 6,615 ms (p50 7,301 ms; p95 8,634.8 ms), a 13-job backlog with 600,000 ms oldest actionable age, one retry-wait job, one terminal job whose five-attempt budget was preserved, 12,151,056 bytes of measured SQLite/WAL growth, 247,988,224 bytes RSS, and a 49 ms recovery drill. These are machine-specific synthetic observations retained for engineering context only.

## Release and environment discipline

Local, isolated cloud-test and any future staging/production deployment are distinct environments. CI can retain only bounded synthetic JSON diagnostics for a short period; it must not upload fixture databases. `docs/production/LOCAL_BUILD_MANIFEST.json` remains historical/current-state input and is not relabeled as proof for this candidate.

Still unproven and intentionally external: hosted scheduler/deployment, hosted mail delivery and external-recipient proof, commercial market-data agreement and quota/cost account, billing lifecycle, external incident pager, production cloud backup, native physical-device certification, public deployment, real-user/load evidence and operator incident response.
