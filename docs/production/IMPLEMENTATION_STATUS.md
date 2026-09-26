# StockLedger 0.2.0 implementation and release evidence

Implementation began September 15, 2026, from `02e54c5`. The older ledger below records historical checks through September 16 UTC; CHG-256 R2 adds the current worker-to-app handoff implementation and verification for that area. The design and SL improvement backlog remain the target specification; this file is the current completion authority.

**Release assessment: usable local-first beta candidate, with a separately gated cloud-sync pilot.** This is a substantial implementation, not completion of every item in the production roadmap. No public deployment, paid service, live trading integration, or native store release was performed.

## Delivered behavior

### Trustworthy data and calculations

- CHG-89 adds one versioned `financial_truth_v1` contract registry for supported recipe metrics and frozen scanner features. Formula, exact session window/warmup, units, benchmark/alignment, adjustment basis, thresholds and UNKNOWN behavior are consumed by preview, workspace/worker evaluation, snapshots and scanner feature metadata.
- Independent N−1/N/N+1, zero-denominator, dated-gap, stale/partial, split-basis and symbol-mixed fixtures are checked in `tests/financialTruth.test.ts`. Preview and worker/workspace evaluation are compared with the same dated inputs and explicit evaluation instant.
- `npm run check:frozen` machine-checks all six V12.3 rule IDs, hashes, parameters, blockers, conditions, definitions and limitations against `docs/v12_3_app_import_bundle.json`. Numerical research parity remains explicitly **blocked/unverified** because source golden outputs are not included; no performance guarantee is inferred.
- Replaced runtime JavaScript expression execution with a bounded arithmetic grammar. Unsupported inputs, missing observations and insufficient warmup remain unknown.
- Required/eligibility gates and risk conditions now control interpretation consistently. Incomplete critical data cannot become a confident opportunity signal.
- Daily observations retain actual prices, dates, source, retrieval time and adjustment status. Personal workspaces no longer manufacture missing prices, financials, event dates or sector evidence.
- NYSE session handling covers 2024–2028, holidays, early closes, DST and the January 2025 special closure. Outside coverage fails explicitly.
- Relative performance and forward outcomes join matching dates. Full metric warmups are enforced. Forward excursions exclude signal day; incomplete later inputs do not erase completed observations.
- Raw batches, evaluations, scan runs and signal revisions use content identities. Corrected inputs retain earlier evidence. Failed and blocked scanner results stay visible.
- Network work has response/time/symbol bounds and concurrency limits. The free path can operate entirely from user-supplied CSV files.

### Durable personal workspace

- Empty personal onboarding; sample workspace is explicit and labelled. Sample data cannot upload to a personal cloud account. Leaving sample mode exports a copy first.
- Schema-validated migration preserves original legacy bytes. Startup does not overwrite real saved data with seed values or reset malformed data silently.
- IndexedDB on web and SQLite on native support atomic compare-and-save revisions and previous-copy recovery. Serialized commands publish success only after durable persistence.
- Corrupt storage can be exported as original bytes; restoring the previous copy is explicit. Failed saves preserve drafts and surface errors.
- JSON export/import round-trips the full workspace with validation and backup before replacement. JSON file imports allow 100 MB; CSV imports allow 20 MB. Both remain in-memory operations, not unlimited archive storage.
- Real stock creation/editing, reversible archiving/restoring, watchlist CSV preview, duplicate detection, stored pins/recents, and paginated directories are connected.

### Research and review loop

- Recipes publish new versions with stable condition lineage. Changing an Eye's recipe preserves its historical binding. Referenced custom metrics are copied before revision.
- Evaluation and alert detail preserve captured evidence instead of substituting the latest live conditions.
- Decisions require deliberate thesis/timing choices. Editing preserves authored amendments and original context; deletion becomes reversible archive.
- Outcome review supports lessons and notes. Weekly Markdown reports join current review activity and coverage without inventing return or productivity claims.
- Today, Watchlist, Recipes and Journal are the main tabs. Entity-aware workspace hash routes survive browser refresh/back and fail safely for missing or archived records; native hardware back uses a history stack.
- Charts use actual dated lookback windows and comparable returns. Unsupported benchmarks show unavailable coverage.
- Shared controls expose accessibility state/errors and pending actions. Main decorative animations respect reduced motion; sheets use safe areas, keyboard avoidance, initial focus, Escape/back dismissal, and opener focus return.

### Runnable independent worker

- `server/worker` uses the shared engine and local CSV observations while the UI is closed. No server subscription is required.
- SQLite WAL storage, expected revisions, job leases, capped retries, atomic result/outbox commits and restart idempotency are implemented.
- Consistent SQLite backups and isolated restore tests pass. Importing a later app export requires a matching worker revision and creates a before-import backup.
- CHG-256 R2 adds a local incremental worker-to-app evidence handoff. An owner-selected browser folder carries bounded, content-addressed evaluation batches and idempotent receipts; the app preserves exact worker context, owner history and an atomic recoverable prior copy, and reports conflicts and coverage states explicitly. App-authored preferences and edits still use the revision-gated reverse import below. CHG-94's server-only versioned delivery lifecycle, digest batching, opt-out fencing, safe device-local last-known status, local SMTP boundary and durable intent/attempt/receipt tables remain; no hosted provider, recipient, OS push service or scheduler is installed.

### Optional cloud pilot

- Supabase Auth sign-in/sign-up, explicit account adoption, native SecureStore sessions and personal record sync are implemented.
- Owner-scoped SQL records, RLS, restricted grants, server-derived identity, atomic revision checks, immutable published history, retry receipts and resource limits are implemented.
- Three-way sync detects conflicts; explicit choices are tied to the exact versions displayed. A durable local merge must precede acknowledgement. Local edits during a request are retained and require retry.
- Raw prices/scanner archives remain local. The pilot reads complete owner records in bounded pages; it does not yet implement the production cursor/outbox protocol.
- Cloud account lifecycle and managed hosted delivery/billing are incomplete. Local delivery behavior is proven only against isolated test transport; see the deployment runbook before enabling cloud for anyone else.

## Verification ledger

CHG-256 R2 verification is recorded separately below after the September 26 qualification. The older ledger that follows is historical and is not evidence for the current worker/app handoff.

### CHG-256 R2 verification (September 26, 2026)

- Runtime: Node **22.23.2**. `npm ci`, strict typecheck plus Vitest (`npm run check`), `npm run check:boundaries`, `npm audit --audit-level=high`, and `npm run export:all` passed. The final unit run passed **216 tests across 27 files**. Dependency audit reported zero vulnerabilities; web, iOS, and Android exports completed.
- Handoff unit/integration coverage (`tests/workerHandoff.test.ts`): **6 passed**, covering captured identity, replay, owner-authored state, overlap conflict, malformed/incomplete input, and durable worker batch/ack behavior. Repository recovery tests also cover the initial valid empty baseline copy.
- Browser handoff journey (`tests/e2e/worker-app-handoff.spec.ts`): **2 passed** across desktop and Pixel 7 emulation. It reaches Today, Alerts, and Journal, verifies exact captured source context and decision/amendment retention, and exercises replay, permission regrant, missed/partial/stale/conflict and recovery states without importing a full workspace. The browser test uses a test directory-handle adapter; it does not claim native OS picker or native-device qualification.
- Full Playwright: one full default run passed **89 tests with 1 existing mobile keyboard-only case skipped as not applicable**. Later full re-runs reproduced unrelated intermittent existing Recipes/Eye Composer focus/bounds failures (88 passed, 1 skipped, 1 failed); the two affected handoff journeys passed in every run and in the final focused run. This suite flakiness is retained explicitly rather than counted as a clean rerun.
- `npm run recovery:drill`: passed with source unchanged, restored integrity, authored history/evaluations/decisions/jobs/ingestion/notification state retained, and corrupted/incompatible candidates rejected. The drill is synthetic evidence; its no-scheduler RPO remains unknown.
- `npm run operations:qualify`: passed its synthetic 100-stock/260-session budget, retry-attempt preservation, and isolated restore budget. The three samples are an engineering qualification, not a production SLA or capacity promise. `npm run operations:status` passed on an uninitialized local database and truthfully reported `workspace_missing`, `schedulerInstalled:false`, no local schedule, and no release identity.
- Golden UI v3 impact was limited to Today/Alerts worker evidence context and the Settings handoff card/status. Existing affected states were recaptured on desktop and mobile, in English and Korean, with keyboard focus return and reduced motion. A real Chrome tab zoom set to 200% produced a 640 CSS-pixel viewport at device pixel ratio 2; the handoff card reflowed within its content width and the folder action remained visible and reachable. Screenshot evidence is included in the CHG-256 artifact package. This is not a full-product visual audit, human preference finding, native-device qualification, or blanket accessibility conformance claim.
- SMTP, a real recipient, owner data, an installed scheduler, and an always-awake machine were not used or asserted.

| Check | Recorded result |
| --- | --- |
| Strict TypeScript and Vitest | **61 tests across 11 files passed** on Node 22.23.2. Includes recovery/CAS, domain/date/warmup behavior, immutable history, sync conflicts, embedded PostgreSQL ownership/atomicity, worker restart/leases and SQLite restore. |
| Browser journeys | **8 passed:** four workflows in Chromium desktop and Pixel 7 browser emulation. Covers real watchlist persistence and backup restore; deliberate sample/navigation; corrupt-store recovery export; decision → outcome → amendment. |
| Expo bundle export | **Web, iOS and Android passed** on SDK 57 / React Native 0.86. Web JS about 2 MB; native Hermes bundles about 3.8 MB each. This is bundle validation, not native-device QA. |
| Expo diagnostics | **21 of 21 checks passed.** |
| Dependency audit | **0 findings** at verification. The scoped xcode/uuid override also passed a CommonJS UUID generation smoke check. |
| Client boundaries | Public environment allowlist, no runtime eval/Function and no server/Node client imports passed. |
| Repository hygiene | Whitespace check passed; no generated DB/export/environment files selected; credential-pattern scan found no matches. A pattern scan is not a comprehensive security audit. |
| Full local Supabase integration | **Passed on GitHub Linux** using the actual isolated local Supabase stack: Auth sessions, PostgREST ownership, denied anonymous/direct writes, atomic RPC, retry and revision checks. Local Docker was unresponsive; no Mac full-stack result is claimed. |
| GitHub clean-environment checks | The first clean Linux run passed builds/cloud integration and caught mobile header overflow in one browser journey. The layout is fixed and the journey now asserts viewport bounds; **the corrected run passed both jobs**. A separate fresh Mac clone of `bb6d3b1` passed locked install, TypeScript and all 61 tests; all 139 tracked files matched byte-for-byte. It was then fast-forwarded to the corrected source. |

### CHG-89 verification (September 16, 2026 local run)

- `npm run typecheck`: passed.
- `npm test -- --run tests/financialTruth.test.ts tests/correctness.test.ts tests/monitoring.test.ts tests/history.test.ts`: **44 tests across 4 files passed**.
- `npm run check:frozen`: passed structural parity for all 6 frozen rules; status remains `blocked_unverified` and release-blocked for missing independent numeric golden outputs, survivorship bias, unavailable point-in-time membership, and required forward proof.
- `npm run check:boundaries`, `git diff --check`, and `npm run export:all`: passed.
- Full local `npm test -- --run`: **67 tests passed across 11 files**. `tests/worker.test.ts` could not initialize on the available Node 20.19.4 runtime because `node:sqlite` is unavailable; worker coverage is not claimed from this run. The repository package requires Node >=22.23.2.

Browser screenshots were inspected locally. Desktop/browser-emulated phone coverage does not establish screen-reader, real-device, tablet, landscape, Korean or large-text acceptance.

### CHG-90 verification (September 17, 2026 local run)

- `npm run typecheck`: passed.
- `npx vitest run --exclude tests/worker.test.ts`: **72 tests across 13 files passed**.
- `npm test`: **72 tests passed**; the worker suite could not initialize on Node 20.19.4 because `node:sqlite` is unavailable. The package declares Node >=22.23.2, so worker execution is not claimed from this environment.
- `npm run check:boundaries`, `npm run check:frozen`, and `git diff --check`: passed. Frozen-bundle validation remains structurally green but release-blocked for its documented independent-golden-output and point-in-time-data limitations.
- `npm run export:web` and `npm run export:all`: passed on the available Expo 57 toolchain.
- `npm run test:e2e`: **10 passed** across Desktop Chrome and Pixel 7 browser emulation. The suite covers the four existing journeys plus stock/Eye deep-link refresh, missing-entity fallback, dialog focus/Escape/return focus, Korean switching, domain-text preservation, reload persistence, viewport bounds, backup/recovery, and no external requests.
- Browser evidence is limited to the configured emulation profiles. Screen-reader announcements, physical touch targets, real-device/tablet/landscape behavior, and large-text/OS zoom acceptance remain retained manual gates; no acceptance claim is made for them.
- The changed core surfaces reuse the existing `Button`, `Input`, `HorizontalChoice`, `SearchableSelect`, `WindowPanel`, and navigation primitives. No alternate preference store or domain-data mutation was introduced.

The synthetic worker fixture processed **100 stocks × 260 sessions in 2,036 ms**, producing 100 Eye evaluations and 200 scanner rows. Export: **5,656,231 bytes**; SQLite/WAL: **11,736,672 bytes**; ending RSS: **251,641,856 bytes**; integrity check passed. This is one local run, not p95, a load test or a user-count capacity guarantee. Reproduce with `npm run benchmark:worker`.

## Backlog reconciliation

“Implemented scope” below describes shipped behavior; **partial** means the original item's complete acceptance criteria remain open. Nothing in this table marks the entire roadmap complete.

| SL items | Implemented scope / remaining acceptance |
| --- | --- |
| 001–006 | Recovery, observation separation, gates/risk, exchange sessions and date joins implemented and tested. Broader real-provider/corporate-action fixtures remain. |
| 007 | **CHG-89 complete for current supported scope:** versioned formula/window/warmup/unit/missing-data/benchmark contracts and independent boundary fixtures are implemented. New metrics still require a contract before production use. |
| 008 | Recipe/evaluation/decision history and amendments implemented; full visual diff/version migration UX remains **partial**. |
| 009 | Cooldown, semantic dedupe and existing snooze wired; quiet hours/escalation/channel lifecycle **partial**. |
| 010 | Explicit provider configuration, truthful unavailable/partial/stale provenance implemented; licensed managed adapters remain. |
| 011 | Bounded downloads, validation and retained blocked/failed results; resumable per-symbol distributed ingestion **partial**. |
| 012–015 | Forward outcome preservation, safe expressions, client secret separation, dependency updates and regression suite implemented. More independent market fixtures still desirable. |
| 020–024 | Stock editing/import, honest chart/evidence basis and four main destinations implemented. Only SPY comparison is supported; other benchmarks are visibly unavailable. |
| 025–028 | Back/refresh routes, stable entity deep links with safe fallback, shared accessible primitives, reduced motion and browser-tested sheet focus behavior implemented; screen-reader/native-device acceptance matrix remains **partial**. |
| 029–031 | Optional numeric validation, durable action feedback, explicit decisions and outcome review implemented. |
| 032–033 | Pins/recents and the intentional language preference persist; core English/Korean catalog parity, English fallback, locale-aware dates/numbers and missing-translation checks are implemented. Broader preference scope remains **partial**. |
| 034–037 | Directory/scanner pagination, starter recipes and atomic alert-group review implemented. Virtualization, guided authoring, since-last-review diff and broad batch actions **partial or pending**. |
| 038–039 | Clean/sample separation implemented. Ten browser journeys across Desktop Chrome and Pixel 7 emulation and refreshed screenshots completed; formal usability/native/screen-reader/language QA **partial**. |
| 040–042 | Auth and owner-scoped atomic sync contract implemented; full normalized APIs, account recovery/deletion/device controls and hosted isolation/advisor checks **partial**. |
| 043–044 | Local SQLite worker and atomic client stores implemented. Scheduler installation, managed jobs and normalized local repositories **partial**; workspace payloads are still growing JSON documents. |
| 045–046 | Full backup and simple watchlist CSV preview; optimistic three-way personal sync pilot implemented. Saved mappings, checksum manifests, durable mutation outbox/cursors and broader cross-device drills **partial**. |
| 047–049 | Transactional notification intent now has versioned device-local preferences, email transport boundary, leases/fencing with in-flight opt-out preflight, privacy-safe real digest batching, cancellation, bounded retry, ambiguous-send reconciliation and an explicit app/worker last-known status projection. Hosted delivery, account-level preference sync and archive retention/compression remain. |
| 050–051 | Quoted CSV parsing/content hashes and structural frozen-rule import validation implemented. The six-rule bundle is machine-checked; independent numerical parity is explicitly release-blocked until source golden outputs are supplied. |
| 052–054 | Worker status, tested snapshots, bounded cloud RPC and a benchmark exist. Operator dashboards, measured RPO/RTO, hosted restore and per-plan budgets **partial**. |
| 055–057 | Release/rollback/deployment/incident runbooks and CI exist. Actual staging promotion, account deletion lifecycle and incident tabletop evidence remain. |
| 058–063 | Fundamentals/events feeds, managed concurrency envelope, licensed commercial rights, external pilot, billing and pricing validation remain. |
| 064–065 | First weekly report and watchlist CSV preview implemented. Measured time savings, saved column mappings and richer conflict handling **partial**. |
| 066–075 | Event reminders, AI drafts, store distribution, teams, portfolios, acquisition experiments, point-in-time backtesting, marketplace, educational onboarding and unit-economics program remain phase-gated. No monetization claim is made. |
| 080–083 | Small root App, separate styles/features/domain/platform/worker, shared engine and safer primitives implemented. Large screen composition/model, duplicated registries and remaining loose style props still need extraction. |
| 084–085 | Dormant code inventory/cleanup remains. One package and lockfile with separate client/worker entry points is retained deliberately; npm workspace packaging is deferred until independently versioned/deployed packages justify it. |
| 086–090 | README/current-status authority, historical document labels, Git hygiene, templates, pinned CI and dependency updates implemented. GitHub synchronization and account-plan branch-protection state are recorded below. |
| 091–092 | This evidence manifest and operational docs added. Original design/backlog iCloud copies remain canonical delivery artifacts; an implementation-status copy accompanies them. Release artifact hashes and final Git ref follow verification. |

## Remaining gates, separated by cause

**Further code/QA work:** full localization/accessibility/device coverage; entity navigation; screen/model/metric-registry extraction; normalized storage and bounded archive retention; full account recovery/deletion/session lifecycle; cursor sync; managed ingestion/scheduling; notification transport/preferences; subscription checkout/entitlements/webhooks; operational projections; broader load/restore tests. These cannot be described as merely missing credentials.

**External inputs/operations:** a dedicated StockLedger cloud project and hosting target; owned domain and email service; contractual market-data rights; payment-provider/business configuration if billing is chosen; native signing/store accounts and physical-device QA; real pilot users and measured willingness to pay. Existing unrelated Supabase projects and private local environment values were not changed.

**Operator action for the no-subscription path:** provide the actual workspace backup and authorized CSV directory, then install a schedule from the local-worker runbook. Existing hardware must remain awake. No real user's scheduler or data import was fabricated during this implementation.

## Architecture decisions

1. Preserve the original prototype/history and add recovery before feature growth. No destructive reseeding or silent repair.
2. Share deterministic domain code between Expo and the Node worker. Keep server imports and secrets out of bundles.
3. Keep whole-document local revisions for a recoverable beta migration; defer normalized repositories explicitly because they require another data migration and archive policy.
4. Keep cloud optional. Ship the complete local workflow independently of paid infrastructure; restrict the first cloud contract to personal records and explicit conflicts.
5. Retain a single root package/lockfile for now. Platform-specific persistence/session adapters are separate from portable domain code.
6. Do not fabricate financial/event evidence or populate paid features with placeholders. Add those only with real inputs and complete lifecycle tests.

## Runbooks and release identity

- [Local worker and recovery](https://github.com/kimhw8084/stockledger/blob/main/docs/operations/LOCAL_WORKER.md)
- [Cloud contract and deployment gates](https://github.com/kimhw8084/stockledger/blob/main/docs/operations/CLOUD_DEPLOYMENT.md)
- [Release, rollback and incidents](https://github.com/kimhw8084/stockledger/blob/main/docs/operations/RELEASE_RUNBOOK.md)
- App: **0.2.0**; persisted workspace/export schema: **2**; evaluation engine: **2.0.0**; calendar: **2024–2028**.
- Migration: `20260916032227_ledger_sync.sql`.
- Source baseline: `02e54c5`; implementation: `bb6d3b1`; verified corrected code: **`dcac4da59fe5d11ee005caf3bc3c6fac3f44041e`**. The following documentation commit does not alter runtime code.


## Final release evidence

- **Both jobs passed:** [Release checks for dcac4da](https://github.com/kimhw8084/stockledger/actions/runs/35056249829), September 16, 2026 UTC. The application job performs locked installation, TypeScript, 61 tests, boundary checks, dependency audit, all-platform export and eight browser journeys. The cloud job starts actual isolated Supabase, exercises Auth/PostgREST/RPC and lints application database functions with warnings treated as failures.
- The first Linux run identified a Watchlist header that overflowed with Linux fonts. The corrected header wraps text, reserves 44-point controls, and has a viewport regression assertion. CI passed after the fix; it was not resolved by forcing clicks or hiding the test.
- [Local build manifest](https://github.com/kimhw8084/stockledger/blob/main/docs/production/LOCAL_BUILD_MANIFEST.json) records the exact source ref and SHA-256 hashes for the web/iOS/Android verification artifacts. It does not represent signed native applications or a public deployment.
- Main-branch protection is enabled: required `app` and `cloud-contract` checks with up-to-date branches; pull-request flow with zero required external approvals for the solo repository; linear history and resolved conversations; force pushes and branch deletion disabled. Administrator override remains available to the owner. This is configuration, not an independent code review.
- Canonical GitHub repository remains private. Existing history is preserved. Final documentation is delivered through the same protected repository and the local/remote refs are checked at handoff.
- The original design/backlog copies in iCloud Downloads still match their canonical repository documents byte-for-byte. `StockLedger_Implementation_Status_2026-09-15.md` adds this status report beside them; it is also byte-identical to this canonical file.

This release is ready for controlled local use and further pilot verification. The unfinished code and external launch gates listed above remain open; no paid or public production readiness is asserted.
