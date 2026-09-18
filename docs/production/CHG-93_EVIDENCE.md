# CHG-93 deterministic Fabric evidence

## Source identity

- Supplied protected-main ancestry base: `59cc7c672cd6b759cf0ceefb5a77acea66c7435d`.
- Protected-main source head used for R1: `ef253b3fad2475f0b52f7d1722c1350667a44694` (`origin/main`), the direct parent of the supplied R1 candidate.
- Exact R1 candidate carried forward: `196d52cc8b64ab3cbac2478d5ba2bdd7f9ee1a4d`; its tree was carried onto this branch before the focused correction as `4eb53988f35abd80198954b824f9084c5f3272b1`.
- CHG-93 implementation/test head verified before this evidence-only update: `8a0e7fcc0345012768d3bf759ec6b0ee33ddba81` (`fix: reconcile post-mutation cursor feed`).
- Branch: `codex/stockledger-prod-c06-account-sync-cursor-fix-v1`.
- Merge status: not merged to `main`; the final branch contains the carried-forward R1 source, the focused CHG-93 fix, and this evidence update only.
- Runtime: Node `v22.23.2`, npm `10.8.2`.
- Sync contract/schema: `stockledger-personal-sync-v1`; server RPC payloads and durable local state are validated against that literal contract. SQL schema is the carried-forward `ledger_records`, `ledger_changes`, and `ledger_private` contract from migrations `20260916032227_ledger_sync.sql` and `20260918000000_secure_personal_sync.sql`.
- Bounds preserved: 500 records / 5 MiB per bootstrap or change page and mutation; 256 KiB per payload; 5,000 accepted records / 20 MiB per owner; 10,000 retained accepted changes / owner; 60 new mutations / hour.

## Focused correction

`synchronize` now records `baseCursor` as the cursor immediately before mutation submission. After the RPC acknowledgement, it durably stores the acknowledgement while retaining that cursor and pre-submit remote snapshot. It then observes server high-water, consumes the ordered feed from `baseCursor`, verifies every acknowledged revision/cursor occurred in that feed, applies all intervening writes/tombstones, and only then persists the merged workspace, advances cursor/baseline, and clears the outbox.

The path retains acknowledged intent across crashes and cursor expiry, uses the bounded re-bootstrap flow when explicitly confirmed, preserves newer local edits as exact hash/revision/cursor conflicts, and replays the same mutation identity without re-uploading an acknowledged change. No SQL migration or production UI surface was broadened by CHG-93; raw provider/scanner archives, billing, notifications, hosted deployment, and other excluded domains remain outside the contract.

## Post-mutation interleaving matrix

The deterministic fake-server matrix is in `tests/synchronize.test.ts` and passes as part of the focused suite.

| Scenario | Evidence asserted |
| --- | --- |
| A consumed through `N=10`; B writes unrelated Y at 11; A writes X at 12 | Post-submit feed reconciliation leaves A with Y and X and durable cursor `>=12`. |
| Same interleaving with B deleting another record | Tombstone at 11 is applied locally; the deleted record is absent from the merged workspace and retained in durable remote state. |
| B writes after A's pre-submit pull but before A's RPC | Harness asserts the pre-submit feed completed before the server injects B's write; both ordered changes are consumed. |
| Crash after acknowledgement persistence, before post-submit catch-up | Acknowledged outbox remains, cursor remains 10, no post-submit feed call occurs; retry completes without a second mutation. |
| Crash after catch-up, before workspace persistence | Acknowledged outbox remains replayable; retry recomputes the complete merge and clears only after workspace persistence. |
| Ambiguous response after server commit | Retry reuses the exact mutation ID; only one A change/revision is present. |
| Cursor expiry during post-submit catch-up | Acknowledged outbox and pre-submit cursor are retained; explicit bounded re-bootstrap reaches cursor 12 before clearing. |
| Concurrent same-record change after A's commit | `SyncConflictError` retains the local edit and binds the conflict to the exact remote revision 3 and cursor 12. |
| No cursor regression and repeated retry | Durable cursors are monotonic; retry with the merged workspace performs no additional upload. |

## Verification matrix

All commands below were run from this worktree with Node `v22.23.2`. Exit codes are recorded.

| Command | Exit | Result |
| --- | ---: | --- |
| `node --version` / `npm --version` | 0 | `v22.23.2` / `10.8.2`. |
| `npm ci` | 0 | 595 packages installed; 0 audit vulnerabilities. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test -- --run` | 0 | 16 files, 129 tests passed. |
| `npm test -- --run tests/cloud.test.ts tests/sync.test.ts tests/synchronize.test.ts tests/i18n.test.ts` | 0 | 4 files, 27 focused tests passed. |
| `npm run check:boundaries` | 0 | Client-secret/runtime-parser/server-import boundary passed. |
| `npm run check:frozen` | 0 | Structural check passed; the existing `blocked_unverified` research limitations remain release-blocking. |
| `npm run export:all` | 0 | Web, Android, and iOS bundles exported. |
| `npm run test:e2e` | 0 | 12 desktop/mobile browser journeys passed, including cloud-optional/local-first localized coverage. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run test:cloud` | 1 | Isolated local Supabase could not start: Docker client reported the OrbStack daemon unavailable at `/Users/haewonkim/.orbstack/run/docker.sock`; Supabase then reported `docker: command not found (podman also not found)`. |
| `supabase start` | 1 | Same local Docker/Podman lifecycle failure. |
| `npx supabase db lint --local --schema public,ledger_private --level warning --fail-on warning` | 1 | Local Postgres connection refused at `127.0.0.1:55422`; no local lint result can be claimed. |

The cloud integration and DB-lint failures are explicit environment evidence gaps. No external Supabase project was contacted or modified.

## Contract and lifecycle preservation

The carried-forward R1 contract remains owner-derived `auth.uid()` writes; owner RLS; authenticated SELECT-only grants; denied direct DML; revision-preconditioned `apply_ledger_batch`; mutation-id replay protection; immutable recipe/evaluation history; bounded bootstrap/feed pages; server-issued ordered cursors; tombstones; repository-backed durable outbox; exact conflict bindings; local-first optional cloud; localized account UI; cloud export/recovery/sign-out/deletion states; explicit Auth-deletion proof boundary; CHG-89 financial truth; CHG-90 UX/localization; CHG-91 persistence/recovery; and CHG-92 scheduler/job semantics.

Provider/scanner archives, notifications, billing, raw archive sync, and hosted deployment remain excluded. The SQL/Auth/RLS/RPC contract is covered by the repository's PGlite contract tests and the local Supabase integration/lint commands above; the live isolated Supabase results remain unproven solely because Docker/Postgres could not start in this environment.
