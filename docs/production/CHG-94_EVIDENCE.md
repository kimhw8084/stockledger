# CHG-94 Fabric evidence: transactional notification delivery, digest and handoff controls

## Exact base and scope

- Protected-main base: 4b4fc73a27b1a58a47405fe8cdf18c7ecf79975f (origin/main).
- Prior candidate carried forward exactly before correction: b5912cc9dcc5d7fe71a4e1cdbd2002a9e0b74c07.
- Final implementation commit: 77dbde2 (the evidence publication commit is its direct child and is reported in the Fabric handoff).
- Branch: codex/stockledger-prod-c07-notification-control-fix-v1.
- No merge to main and no external deployment were performed. The final implementation and evidence commit hashes are supplied in the Fabric handoff because a commit cannot embed its own hash without becoming self-referential.
- Runtime proved for this work: Node v22.23.2 from .nvmrc, npm 10.9.8.

## Versioned contracts and migration

- Delivery contract: stockledger-notification-delivery-v1, revision 1.
- Digest contract: stockledger-notification-digest-v1, revision 1.
- Preference contract: stockledger-notification-preferences-v1, revision 1.
- Existing worker job contract remains stockledger-production-job-v1, revision 2; upstream evaluation retry/attempt budgets are unchanged.
- Worker SQLite schema migrates additively through v3 → v4 → v5 → v6. v5 → v6 adds digest grouping/member linkage, preference/cancellation fences and delivery projection support; existing workspace, recovery, jobs, reconciliation, outbox, intent, attempt and receipt rows are retained. notification_attempts and notification_receipts remain append-only.
- Preferences are included in the complete v2 personal backup/import envelope and are explicitly device-local. CHG-93 stockledger-personal-sync-v1 collections, SQL migrations, RLS, owner conflict handling and account RPCs were not changed. The worker exposes account-owned cancellation only when a deployment explicitly supplies that identity; it does not pretend local intents are account-global.

## Changed surfaces

- Shared domain/types/schema/defaults: versioned preferences, defaults, validation, eligibility, quiet-hours/digest/snooze timing, semantic identity and privacy-safe rendering.
- Worker store/managed/contract/run: atomic intent creation beside the workspace/evaluation/outbox transaction, schema v6 migration, digest claiming/fencing, attempts/receipts, cancellation/reconciliation and separate delivery phase.
- Server transport: provider boundary, concrete SMTP serialization adapter, local idempotent test transport and due-delivery runner. Credentials/endpoints are constructor inputs in server code only; they are not Expo imports or client environment variables.
- App settings/model/i18n: accessible EN/KR consent/channel/configuration, privacy, quiet-hours, digest, last-status boundary and actionable unconfigured/opt-out UI.
- Tests: focused lifecycle/provider/privacy/persistence tests and browser coverage.
- Operations/evidence docs: exact guarantees and external gates.

## Lifecycle guarantees proved

| Area | Proven behavior |
|---|---|
| Alert truth | evaluateWorkspace remains deterministic and owns alert creation. Delivery/UI code never creates alerts or changes the financial engine. Evaluation/alert/review history remains immutable. |
| Atomicity/idempotency | A newly created semantic alert and its intent(s) are inserted in the same transaction as the workspace revision and existing notification.intent outbox row. Replayed semantic intent insertion is ignored by the unique key. |
| States | pending, held, claimed, delivered, failed, retry-wait, canceled, blocked-unconfigured, and ambiguous; terminal_state is persisted separately. |
| Lease/fencing | Claims use owner/token/expiry. Concurrent claims return one winner; expired/replaced workers cannot record outcomes or retry state. An expired claim becomes ambiguous instead of being resent blindly. |
| Retry/ambiguity | Definitive failures use deterministic 1/2/4/8-minute backoff, five-attempt cap, then terminal failed. Provider acceptance without confirmation and timeouts are ambiguous and are never blindly resent. Explicit reconciliation can append a confirmed receipt. |
| Preferences | Consent, enablement, allowed email channel, destination, timezone, quiet hours, immediate/digest mode, digest time, minimum priority and minimal/rich privacy mode are versioned and backup-round-tripped. Default external delivery is off. Preference changes cancel future pending/held/retry/blocked work transactionally; destination changes update pending work. |
| Timing/grouping | Quiet-hours and snooze holds consume no attempts and are not cancellation. Digest delivery is real batching: one deterministic submission contains all eligible members sharing the grouping contract. Claiming the digest and its immutable member links is atomic; retries share one digest attempt budget while each member retains an auditable attempt row and receipt link. Claim rechecks current snooze/policy. Reviewed alert state remains separate; this product policy does not cancel a pending delivery merely because an alert was reviewed. |
| Privacy | Minimal messages contain only a generic review-needed sentence and safe alert deep link/semantic message identity. Thesis text, notes, holdings, evidence and cloud payloads are excluded. Diagnostics contain IDs, channel/state/attempt/timestamps and bounded error classes only. |
| Transport | An isolated local SMTP server received actual RFC-style request serialization; 250 is recorded as provider-accepted/ambiguous, not delivered. Local test transport proves explicit confirmed receipts and semantic idempotency. Definitive SMTP rejection and post-DATA timeout were exercised. |
| Availability/account | Missing destination/transport is blocked-unconfigured; recovery can release it. Delivery only exists while the local worker and configured server-side transport run. Account-owned pending work can be canceled on explicit invalidation; unconnected services are not claimed canceled. |
| In-flight opt-out fence | Claim captures preference updatedAt/hash. Immediately before transport acceptance, a transaction rereads current preferences, alert snooze/account validity and cancellation state. Revoked work is canceled without an attempt; a cancellation request against an existing claim preserves claim history. The SMTP adapter checks the fence before `DATA`; after bytes may be accepted, provider-accepted/ambiguous evidence remains immutable and is never rewritten as canceled. |
| App/worker handoff | Worker import reconciles notification policy in the same workspace-replacement transaction. Opt-out cancels eligible pending/retry/blocked work; destination/privacy/timing changes update eligible work; delivered/ambiguous history is untouched. The safe v1 last-known projection contains only status/timestamps/count/error class/preference timestamp/hash, travels in the explicit backup, remains device-local and outside CHG-93 synced collections, and is labeled worker-only in the app. |

## Verification commands and exits

All commands ran from this worktree with Node v22.23.2; the rtk command wrapper was used for shell output as required by the workspace instructions.

| Command | Exit | Evidence |
|---|---:|---|
| node --version / npm --version | 0 | v22.23.2 / 10.9.8. |
| npm ci | 0 | 595 packages installed; npm reported 0 vulnerabilities. |
| npm run typecheck | 0 | Strict TypeScript passed. |
| npm test -- --run | 0 | 17 test files and 154 tests passed on the final run. |
| npm test -- --run tests/worker.test.ts | 0 | 28 worker tests passed. |
| npm test -- --run tests/notification.test.ts | 0 | 25 focused delivery tests passed, including real digest batching, deterministic member linkage, concurrent claims, restart/idempotency, shared five-attempt retry, ambiguous reconciliation, member cancellation, opt-out fencing, import reconciliation, projection safety, preference changes, quiet/snooze/outage recovery, privacy, SMTP serialization/rejection/timeout and backup round-trip. |
| npm run benchmark:worker | 0 | Synthetic 100-stock/260-session run: 2,837 ms, 1,800,000 ms budget, 1,797,163 ms remaining, SQLite integrity true; database including WAL 12,505,456 bytes, workspace 5,813,608 bytes, RSS 234,176,512 bytes. |
| npm run check:boundaries | 0 | Client secret/runtime parser/server-import boundary passed. |
| npm run check:frozen | 0 | Structural frozen bundle check passed; existing research status remains blocked_unverified for its documented independent-golden-output/survivorship/point-in-time/forward-proof limits. |
| npm run export:all | 0 | Web, iOS and Android Expo bundles exported. |
| npm run test:e2e | 0 | 16 desktop/mobile journeys passed, including imported last-known worker state and pending preference handoff. The first attempt exited before tests because `dist` was not yet exported; `npm run export:all` then completed and the clean rerun exited 0. |
| git diff --check | 0 | No whitespace errors. |
| npm audit --audit-level=high | 0 | No high-or-higher audit findings. |
| npm run test:cloud | N/A | CHG-93 sync/Supabase schema was not changed; no cloud stack was contacted. |
| npx supabase db lint --local --schema public,ledger_private --level warning --fail-on warning | N/A | Same reason: no Supabase migration or account-level preference contract was added. |

## Digest grouping contract

Digest identity is `notification-digest-v1/<sha256>`, where the hash input contains the digest contract revision, channel, normalized destination, privacy mode, policy key, deterministic digest bucket, digest timezone, and the sorted unique immutable member semantic intent identities. A digest is not merely a shared due time: `notification_digests` is claimed atomically with all eligible `notification_digest_members`, and one transport message is submitted for the digest. Each member keeps its own immutable linkage, attempt row and receipt; a confirmed digest receipt is linked to every included member without changing `Alert.reviewed`. Canceled or ineligible members are removed before submission. A definitive failure retries the same grouping with one bounded five-attempt digest budget; provider-accepted or ambiguous outcomes are terminal/awaiting reconciliation and never trigger blind member-by-member resend. Restart and replay resolve the same digest identity and cannot create a second user-visible submission.

Minimal digest content is generic and contains no thesis text, notes, evidence, holdings or cloud payload. Rich digest content uses only the already-approved bounded alert title, state-change and safe alert link fields.

## Opt-out race matrix

| Race point | Durable result | Attempt/transport rule |
|---|---|---|
| Before claim | Intent is canceled during policy reconciliation. | No claim, bytes or attempt. |
| After claim, before acceptance | Cancellation generation/preference fence is observed by transactional preflight. | Claimed work is canceled without consuming a transport retry. |
| Transport waiting before acceptance | The transport callback rechecks the fence immediately before SMTP `DATA`/test acceptance. | No submission and no false delivered receipt; digest members are re-grouped deterministically if eligible members remain. |
| After bytes may be accepted | Existing accepted/ambiguous evidence wins over the late opt-out. | Attempt is recorded as provider-accepted/ambiguous; it is not rewritten as canceled and is not blindly resent. |

## App/worker handoff projection

`WorkerStore.import()` applies the imported preference revision and reconciliation in the same transaction as workspace replacement. The versioned device-local projection (`stockledger-notification-status-v1`, revision 1) contains only generatedAt, channel, last intent/state, attempt count, safe timestamps, bounded error class and the preference updatedAt/hash last applied by the worker. It never contains attempts, credentials, message bodies or alert/thesis data, and it is not added to CHG-93 cloud collections. `NotificationSettingsPanel` labels it “last-known worker state,” exposes failed/ambiguous/blocked-unconfigured states, and shows “pending worker handoff” when the app preference timestamp is newer than the worker-applied timestamp. The app explicitly says that local edits become effective in the separate worker only after export/import.

## External gates and non-claims

The local SMTP adapter and isolated test transport prove serialization, lifecycle transitions and truthful acceptance/ambiguity handling only. No real external recipient, unrelated provider, hosted worker, hosted scheduler, email credential, domain reputation, OS push service or production account was contacted or configured. External email delivery, recipient delivery/read confirmation, account-global preference sync, provider reconciliation APIs and hosting remain deployment gates. The app UI intentionally reports the last delivery status as worker-only rather than inventing a receipt.
