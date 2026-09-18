# CHG-93 deterministic Fabric evidence

## Source identity

- Protected-main base carried by the supplied worktree: `59cc7c672cd6b759cf0ceefb5a77acea66c7435d`.
- Carried-forward CHG-92 source head before this work: `ef253b3fad2475f0b52f7d1722c1350667a44694` (`origin/main` and current branch HEAD before the working-tree patch).
- Branch: `codex/stockledger-prod-c06-account-sync-v1`.
- Merge status: not merged to `main`; changes are in the working tree on the exact carried-forward base.
- Runtime used for local verification: Node `v22.23.2`, npm `10.9.8`.
- Sync contract: `stockledger-personal-sync-v1`.
- Additive migration: `supabase/migrations/20260918000000_secure_personal_sync.sql`, after `supabase/migrations/20260916032227_ledger_sync.sql`.
- Resource bounds: 500 records / 5 MiB per bootstrap or change page and mutation; 256 KiB per payload; 5,000 accepted records / 20 MiB per owner; 10,000 retained accepted changes / owner; 60 new mutations / hour.

## Changed files

- `supabase/migrations/20260918000000_secure_personal_sync.sql` — payload-bearing ordered changes, owner high-water/floor state, bounded bootstrap/feed RPCs, raw-collection filtering, deletion request boundary and operator-only lifecycle transition.
- `src/features/sync/syncPlan.ts` — versioned collection contract and conflict bindings to local hash, remote hash/revision/cursor.
- `src/features/sync/synchronize.ts` — bootstrap/feed client, explicit cursor expiry/re-bootstrap, repository-backed outbox, idempotent acknowledgement recovery and cloud export/deletion calls.
- `src/data/repositories/workspaceRepository.ts` — durable local sync-state store seam outside workspace export.
- `src/features/sync/client.ts` and `src/features/sync/sessionStorage.native.ts` — recovery redirect and stricter native session manifest/generation handling.
- `src/features/sync/CloudSyncPanel.tsx`, `src/app/StockLedgerApp.tsx`, `src/lib/i18n.ts` — account recovery, session state, local/global sign-out, cloud export, deletion states and localized accessible UI; payloads are not rendered.
- `tests/cloud.test.ts`, `tests/sync.test.ts`, `tests/synchronize.test.ts`, `tests/integration/cloud.integration.ts`, `tests/e2e/workspace.spec.ts` — contract, conflict, lifecycle, two-account/two-device, cursor/tombstone, crash/replay and local-first browser coverage.
- `docs/operations/CLOUD_DEPLOYMENT.md` — implemented contract and external lifecycle/deployment gates.

## Verification matrix

Commands were run from this worktree with the runtime above. Exit codes are recorded after the command.

| Command | Exit | Result |
| --- | ---: | --- |
| `node --version` / `npm --version` | 0 | `v22.23.2` / `10.9.8`. |
| `npm ci` | 0 | 595 packages installed; 0 audit vulnerabilities. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test -- --run` | 0 | 16 files, 122 tests passed. |
| `npm test -- --run tests/cloud.test.ts tests/sync.test.ts tests/synchronize.test.ts tests/i18n.test.ts` | 0 | 20 focused tests passed. |
| `npm run check:boundaries` | 0 | Client secret/runtime parser/server-import boundary passed. |
| `npm audit --audit-level=high` | 0 | 0 vulnerabilities. |
| `npm run check:frozen` | 0 | Structural check passed; the pre-existing `blocked_unverified` research limitations remain release-blocking. |
| `npm run export:all` | 0 | Web, Android and iOS bundles exported. |
| `npm run test:e2e` | 0 | 12 desktop/mobile browser journeys passed, including optional-cloud/local-first localized coverage. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run test:cloud` | 1 | Not executed: isolated local Supabase could not start because Docker/OrbStack was unavailable at `/Users/haewonkim/.orbstack/run/docker.sock`. |
| `npx supabase db lint --local --schema public,ledger_private --level warning --fail-on warning` | 1 | Same unavailable local Postgres/Docker gate; no external project was contacted. |

## Contract and lifecycle drill matrix

- Implemented and embedded-proven: owner-derived `auth.uid()` writes; owner RLS; authenticated SELECT-only grants; anonymous/cross-account denial; forged collection rejection; direct DML denial; atomic revision-preconditioned batches; mutation replay and changed-content rejection; immutable recipes/evaluations; bounded bootstrap/feed pages; server cursor ordering; cursor floor expiry; tombstones; local exclusion of provider-heavy archives; deletion invalidation; local workspace preservation; exact conflict hash/revision/cursor checks.
- Implemented and browser-proven: cloud-optional no-account path, local export availability, English/Korean cloud boundary copy, and no raw conflict payload rendering.
- Test fixtures cover: two accounts, two devices on one account, stale revision, duplicate mutation, atomic partial failure, tombstones, delete-vs-edit, concurrent edit, stale conflict resolution, cursor pagination/expiry, raw collection rejection and deletion request status.
- Durable crash/replay path is implemented by the local outbox: intent is written before RPC, acknowledged responses are persisted before local acknowledgement, duplicate mutation IDs are replay-safe, and incomplete acknowledgements retain intent. Unit drills cover a crash before local acknowledgement and an ambiguous network response with mutation-ID reuse. Full client/network crash injection still needs a live Supabase harness.

## Independently proven versus external gates

Implemented/proven in repository code: local-first optional cloud, secure owner-scoped SQL contract, bounded cursor sync, durable outbox protocol, conflict safety, personal accepted-record export, cloud-row deletion request/invalidation, password-recovery entry point, local/global sign-out calls, and explicit Auth-user deletion proof state.

Not claimed from this isolated environment: hosted email delivery, complete Auth-user deletion, revocation of every existing session, provider backup or email-retention erasure, hosted scheduler/notification cancellation, or production deployment. The deletion operator transition refuses `completed` without explicit supported Auth-deletion proof; no internal Supabase Auth tables are mutated.
