# CHG-94 Fabric evidence: transactional notification delivery lifecycle

## Exact base and scope

- Protected-main base and current Git HEAD at implementation start: 4b4fc73a27b1a58a47405fe8cdf18c7ecf79975f (origin/main).
- Final Git HEAD remains 4b4fc73a27b1a58a47405fe8cdf18c7ecf79975f; the implementation is intentionally an uncommitted working-tree diff on that exact base.
- Branch: codex/stockledger-prod-c07-notification-delivery-v1.
- No merge to main and no external deployment were performed. The working tree contains the implementation diff on that exact base; no implementation commit was fabricated for this evidence file.
- Runtime proved for this work: Node v22.23.2 from .nvmrc, npm 10.9.8.

## Versioned contracts and migration

- Delivery contract: stockledger-notification-delivery-v1, revision 1.
- Preference contract: stockledger-notification-preferences-v1, revision 1.
- Existing worker job contract remains stockledger-production-job-v1, revision 2; upstream evaluation retry/attempt budgets are unchanged.
- Worker SQLite schema migrates additively from v3 to v5. Existing workspace, recovery, jobs, reconciliation and outbox rows are retained. notification_intents is uniquely keyed by semantic delivery identity, channel and policy; notification_attempts and notification_receipts are append-only.
- Preferences are included in the complete v2 personal backup/import envelope and are explicitly device-local. CHG-93 stockledger-personal-sync-v1 collections, SQL migrations, RLS, owner conflict handling and account RPCs were not changed. The worker exposes account-owned cancellation only when a deployment explicitly supplies that identity; it does not pretend local intents are account-global.

## Changed surfaces

- Shared domain/types/schema/defaults: versioned preferences, defaults, validation, eligibility, quiet-hours/digest/snooze timing, semantic identity and privacy-safe rendering.
- Worker store/managed/contract/run: atomic intent creation beside the workspace/evaluation/outbox transaction, schema v5 migration, claiming/fencing, attempts/receipts, cancellation/reconciliation and separate delivery phase.
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
| Timing/grouping | Quiet-hours and snooze holds consume no attempts and are not cancellation. Digest due times are deterministic and group multiple intents without changing reviewed state. Claim rechecks current snooze/policy. Reviewed alert state remains separate; this product policy does not cancel a pending delivery merely because an alert was reviewed. |
| Privacy | Minimal messages contain only a generic review-needed sentence and safe alert deep link/semantic message identity. Thesis text, notes, holdings, evidence and cloud payloads are excluded. Diagnostics contain IDs, channel/state/attempt/timestamps and bounded error classes only. |
| Transport | An isolated local SMTP server received actual RFC-style request serialization; 250 is recorded as provider-accepted/ambiguous, not delivered. Local test transport proves explicit confirmed receipts and semantic idempotency. Definitive SMTP rejection and post-DATA timeout were exercised. |
| Availability/account | Missing destination/transport is blocked-unconfigured; recovery can release it. Delivery only exists while the local worker and configured server-side transport run. Account-owned pending work can be canceled on explicit invalidation; unconnected services are not claimed canceled. |

## Verification commands and exits

All commands ran from this worktree with Node v22.23.2; the rtk command wrapper was used for shell output as required by the workspace instructions.

| Command | Exit | Evidence |
|---|---:|---|
| node --version / npm --version | 0 | v22.23.2 / 10.9.8. |
| npm ci | 0 | 595 packages installed; npm reported 0 vulnerabilities. |
| npm run typecheck | 0 | Strict TypeScript passed. |
| npm test -- --run | 0 | 17 test files and 144 tests passed on the final run. |
| npm test -- --run tests/worker.test.ts | 0 | 28 worker tests passed. |
| npm test -- --run tests/notification.test.ts | 0 | 15 focused delivery tests passed, including persistence, replay, claims, fencing, receipts, retries, ambiguity, provider idempotency, quiet/digest/active-quiet protection, opt-out, preference change, snooze, outage/recovery, account cancellation, privacy, SMTP serialization/rejection/timeout and backup round-trip. |
| npm run benchmark:worker | 0 | Synthetic 100-stock/260-session run: 2,242 ms, 1,800,000 ms budget, 1,797,759 ms remaining, SQLite integrity true. |
| npm run check:boundaries | 0 | Client secret/runtime parser/server-import boundary passed. |
| npm run check:frozen | 0 | Structural frozen bundle check passed; existing research status remains blocked_unverified for its documented independent-golden-output/survivorship/point-in-time/forward-proof limits. |
| npm run export:all | 0 | Web, iOS and Android Expo bundles exported. |
| npm run test:e2e | 0 | 14 desktop/mobile journeys passed; notification settings journey passed. One earlier rerun exited 1 before tests because a concurrent prior preview server held port 43187; lsof showed no listener and the clean rerun exited 0. |
| git diff --check | 0 | No whitespace errors. |
| npm audit --audit-level=high | 0 | No high-or-higher audit findings. |
| npm run test:cloud | N/A | CHG-93 sync/Supabase schema was not changed; no cloud stack was contacted. |
| npx supabase db lint --local --schema public,ledger_private --level warning --fail-on warning | N/A | Same reason: no Supabase migration or account-level preference contract was added. |

## External gates and non-claims

The local SMTP adapter and isolated test transport prove serialization, lifecycle transitions and truthful acceptance/ambiguity handling only. No real external recipient, unrelated provider, hosted worker, hosted scheduler, email credential, domain reputation, OS push service or production account was contacted or configured. External email delivery, recipient delivery/read confirmation, account-global preference sync, provider reconciliation APIs and hosting remain deployment gates. The app UI intentionally reports the last delivery status as worker-only rather than inventing a receipt.
