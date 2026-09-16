# StockLedger — Current-State Improvement Backlog

**Review date:** September 15, 2026 · **Baseline:** local main at 0f6eea3 plus the existing working changes, preserved as 81c26f9  
**Design authority:** [Complete project design](StockLedger_Project_Design_2026-09-15.md)  
**Repository:** https://github.com/kimhw8084/stockledger

This file compares the reviewed implementation with the target design. It includes correctness repairs, UI/UX improvements, features, backend work, directory organization, documentation, and Git management. Items are proposals unless explicitly marked delivered. No application feature repair is claimed by the documentation task.

## Contents

1. [How to use this backlog](#1-how-to-use-this-backlog)
2. [Start here](#2-start-here)
3. [Correctness and release blockers](#3-correctness-and-release-blockers)
4. [UI, UX, and workflow improvements](#4-ui-ux-and-workflow-improvements)
5. [Backend, data lifecycle, and operations](#5-backend-data-lifecycle-and-operations)
6. [Time-saving features and monetization](#6-time-saving-features-and-monetization)
7. [Directory, documentation, and Git improvements](#7-directory-documentation-and-git-improvements)
8. [Roadmap mapping and dependency gates](#8-roadmap-mapping-and-dependency-gates)
9. [Validation evidence and limitations](#9-validation-evidence-and-limitations)
10. [Review coverage by subsystem](#10-review-coverage-by-subsystem)
11. [Complete baseline file inventory](#11-complete-baseline-file-inventory)
12. [Delivery note](#12-delivery-note)

## 1. How to use this backlog

Prioritize truthful data and preservation before adding paid features. An attractive dashboard does not compensate for incorrect evaluation or lost notes.

- **P0:** Blocks trustworthy real-data usage or the relevant production boundary.
- **P1:** Required for a dependable personal release or paid beta, as identified.
- **P2:** Valuable time-saving/retention improvement after the core release.
- **P3:** Expansion requiring demonstrated demand.
- **Confirmed:** Directly observed source behavior or isolated deterministic check.
- **Source finding:** Supported by code inspection; end-to-end runtime behavior may still need validation.
- **Design gap:** Capability not found in the reviewed implementation.
- **Validation gap:** Evidence needed before making a readiness or correctness claim.

Effort bands: **S** = about 0.5–1 engineering day; **M** = 1–3 days; **L** = 3–7 days; **XL** = 1–3 weeks. These are directional estimates including relevant validation; overlapping work must not be counted twice. Vendor procurement, user research, and legal review are not predictable engineering tasks.

Owners below are responsibilities, not assigned people: Domain, Client, Data, Backend, Operations, Product. A solo developer may cover several roles.

## 2. Start here

The first implementation sequence is:

1. SL-001 and SL-015: protect saved data and introduce meaningful regression fixtures.
2. SL-002, SL-005, SL-006, SL-007: establish real observation, date, and calculation semantics.
3. SL-003 and SL-004: enforce one condition/risk truth model.
4. SL-008, SL-009, SL-012: preserve history, alerts, and outcomes correctly.
5. SL-010, SL-011, SL-014: make ingestion and delivery readiness honest.
6. SL-020 through SL-031: complete the core workflow and UI quality.
7. SL-040 through SL-057: add durable backend, sync, and operations.
8. SL-060 through SL-070: monetize and expand only after evidence supports it.
9. SL-080 through SL-089: keep organization, Git, and documentation aligned throughout.

The free and paid variants share all correctness requirements. Paid services solve operational constraints; they do not fix wrong formulas automatically.

## 3. Correctness and release blockers

### SL-001 — Preserve real data and recover corrupted local stores

**P0 · Confirmed · L · Data · Design §§7, 8, 11**

Evidence: src/lib/storage.ts:83 rebuilds a snapshot from generated data while retaining selected metadata. At approximately line 304, normalization calls buildMockSnapshot for every stock. loadAppData also writes normalized content immediately and replaces content with seedData on errors.

A synthetic fixture saved price 220 with provider/non-mock labels; loading produced 195.12 with those labels unchanged. Seeded stock/recipe/Eye normalization also overwrites authored fields with current seed values.

Change: preserve original bytes before migration; validate runtime schema; keep real values with their real provenance; isolate demo data; stop automatic seed restoration on parse/migration failure. Add explicit repair/export UI. Do not pretend historical values can be reconstructed if an earlier load already corrupted them.

Acceptance: exact prices, dates, source/origin, notes, and conditions survive reload; invalid content is quarantined/recoverable; a failed save never erases the previous valid state; seeded IDs do not authorize overwriting user edits.

Validation: provider and custom-stock round trips; edited seeded records; malformed JSON; nested schema errors; simulated write failure; migration rollback. Depends on SL-015, coordinated with SL-044.

### SL-002 — Separate market observations from chart coordinates

**P0 · Confirmed/source finding · L · Domain/Data · Design §§6, 8, 9**

Evidence: src/lib/providerSnapshot.ts:149 builds 24 normalized points; src/lib/expressionEngine.ts:55 and src/lib/evaluateEye.ts:30 interpret history arrays as actual market values. A price fixture with price=220 and normalized last point=100 returns PRICE_NOW=100.

Change: store dated raw OHLCV and separately derive chart coordinates. Replace the ambiguous MockSnapshot contract. Make all formulas consume canonical values and explicit windows. Wire the ordinary provider path only after this contract is corrected.

Acceptance: price/volume units remain stable from adapter to engine; chart normalization cannot affect any condition; known return and moving-average values match independent expected results.

Validation: positive/negative/flat series, different absolute price levels, missing dates, price-vs-chart separation, and preview/server parity. Depends on SL-015; precedes SL-006/007/010.

### SL-003 — Enforce required conditions and critical-data gates

**P0 · Confirmed · M · Domain · Design §9.3**

Evidence: src/lib/evaluateEye.ts:304 scores eligibility with supporting evidence instead of requiring all necessary conditions. A failed required revenue-growth condition plus three supports and one timing trigger yields Attention Needed.

Change: represent TRUE/FALSE/UNKNOWN; enforce required and disqualifier gates before scoring. Treat missing critical risk inputs as unresolved, not safe. Separate quality from opportunity state.

Acceptance: required FALSE/UNKNOWN prevents a clean opportunity escalation; hard invalidation outranks support; zero is a valid number; unavailable input remains explicit. Validate every role/result combination and state transition.

### SL-004 — Unify risk truth across engine and dashboard

**P0 · Source finding · M · Domain/Client · Design §§6, 9**

Evidence: evaluateEye treats a passed Hard Disqualifier as dangerous. src/lib/logicHelpers.ts:33 counts non-passed disqualifiers as blockers and non-passed risk warnings as penalties. HomeVisualDashboard uses these helpers in ranking and risk labels.

Change: consume one engine-produced risk view model. Remove conflicting risk math and misleading role-effect text from the UI.

Acceptance: identical evaluation produces identical risk state in Today, Eye detail, recipe preview, alerts, and research views. No “safe” condition raises risk just because its predicate is false.

Validation: one dangerous true flag and one harmless false flag across every consumer; include unknown conditions and stale data.

### SL-005 — Correct trading calendars and session-date handling

**P0 · Confirmed · M · Data · Design §8.4**

Evidence: src/lib/marketCalendar.ts:110 uses a UTC-midnight Date as input to Eastern-time trading-day checks. Monday September 14, 2026 at 22:00 UTC returned Saturday September 12; Tuesday morning also returned that Saturday.

Change: represent session dates independently from instants and use a maintained exchange calendar with explicit close instants, holidays, early closes, and calendar version.

Acceptance: latest eligible session is always a valid completed exchange session; provider delay, daylight saving, weekends, early close, and New Year behavior are correct.

Validation: fixture table against the official exchange calendar, including Monday before/after close, holidays, DST boundaries, Thanksgiving Friday, and Christmas Eve.

### SL-006 — Align every multi-instrument calculation by date

**P0 · Source finding · L · Data/Domain · Design §§8, 9.6**

Evidence: src/lib/processedFeatureEngine.ts:71 constructs relative-strength history using parallel array indices. src/lib/stockConditionScanner.ts:170 applies the stock's startIndex to benchmark arrays when computing outcomes.

Change: join observations by session date; require explicit common start/end sessions; calculate each instrument's own date lookup. Validate benchmark freshness, not just length.

Acceptance: missing benchmark/stock sessions produce explicit incompleteness; no positional comparison between different dates; corporate-action basis matches.

Validation: unequal array lengths, newly listed stock, missing mid-series date, delayed benchmark, suspended trading, and symbol-change fixtures. Depends on SL-002/005.

### SL-007 — Enforce warmup and a versioned metric registry

**P0 · Confirmed/source finding · L · Domain · Design §9.2**

Evidence: expressionEngine falls back to the first available point for 60-day history and averages fewer observations for long moving averages. A five-point fixture produced a 200-day average. metricCatalog documents volume/compression thresholds of 1.4/0.85 while evaluator code uses 1.35/0.86. The mock “200-day” distance uses an average over all 252 points.

Change: define exact formula/window/warmup/unit/missing-data contracts in one versioned registry. Generate labels from those contracts. Preserve any intentionally different frozen research metric as a separately named version.

Acceptance: insufficient history never masquerades as a full-period measure; actual formula and displayed explanation agree; fraction/percentage conversion is explicit.

Validation: N−1/N/N+1 history lengths; zero denominators; decimal thresholds; version migration and frozen-rule parity. Depends on SL-002/006.

### SL-008 — Make recipe and decision history immutable

**P0 for paid/research history · Source finding · L · Domain/Data · Design §§7, 11**

Evidence: useAppModel.ts:514 updateRecipe changes content in place without a new version. Explicit create/restore version actions exist but regenerate condition IDs. updateDecision replaces evaluation context with the Eye's latest evaluation.

Change: published version edits create drafts/new versions; conditions retain lineage IDs; Eyes adopt versions explicitly. Decision corrections append a new revision while retaining original context.

Acceptance: an old alert/decision/outcome still resolves the exact former rule, threshold, thesis, data, and interpretation after any later edit.

Validation: publish→evaluate→decide→edit→migrate Eye→review original history; condition diffs distinguish edited from added/deleted. Depends on SL-001/007.

### SL-009 — Implement real cooldown, dedupe, snooze, and escalation

**P1 personal / P0 before notification promises · Source finding · L · Domain/Backend · Design §10.4**

Evidence: useAppModel.ts:63 deduplicates an identical stateChange over all alert history. Configured cooldownHours and priority settings are not consumed by that path. Snoozing affects alert visibility but is not a durable scheduler policy.

Change: temporal dedupe keys, material-evidence identity, cooldown windows, explicit suppression reason, and user channel/quiet-hour preferences.

Acceptance: the same retry does not duplicate an alert; a genuinely new occurrence after cooldown can alert again; hard risk escalation is handled deliberately; snooze wakes at the intended local time.

Validation: duplicate evaluations, two same transitions weeks apart, new risk during cooldown, timezone/DST quiet hours, and multi-Eye grouping. Depends on SL-005/008.

### SL-010 — Make provider status and freshness truthful

**P0 before live-data claims · Source finding · M/L · Data · Design §8**

Evidence: providerHealth.ts:154 marks Stooq Healthy without checking it. buildProviderSnapshot is unused by App/useAppModel. Settings refresh calls refreshMockData. The scanner nevertheless makes Stooq requests separately. Provider snapshot updatedAt is retrieval time rather than the represented market session.

Change: distinguish configured, reachable, entitled, last successful fetch, and current dataset freshness. Surface actual data mode and per-input source. Remove misleading “healthy” assertions.

Acceptance: users can identify whether the active screen is demo, manual, or provider-backed and which completed session it represents. A successful credentials check does not imply every data capability exists.

Validation: disconnected adapter, stale last row, unavailable benchmark, invalid credentials, quota limit, partial coverage. Depends on SL-002/005.

### SL-011 — Make scanner runs bounded, resumable, and honest

**P0 before scanner production · Source finding · L · Data/Backend · Design §§8, 9.5, 10**

Evidence: eodDataProvider.ts:81 uses Promise.all across symbols and fetches full CSV histories. stockConditionScanner.ts:277 starts at 2024-01-01 every run. A fetch rejection aborts the batch. A blocked run returns an empty signal array that the model can use to replace prior signals. loadDynamicCurrentUniverse does not select a frozen mode up front and accepts empty parsed sectors as a successful result.

Change: bounded per-symbol work, incremental cache, timeouts/retries, validation, resumable job ledger, explicit dynamic/frozen mode, nonempty-universe validation, and truthful run status.

Acceptance: one symbol failure retains valid others; no-match is distinct from failed/blocked/partial; duplicate jobs do not duplicate outcomes; user sees coverage denominator and last successful run.

Validation: one failed symbol among successful ones, empty/malformed constituents, quoted company name CSV, frozen-mode success, retry after process interruption, and budget limit.

### SL-012 — Correct forward outcomes and preserve older observations

**P0 before outcome-performance claims · Source finding · L · Domain/Data · Design §9.6**

Evidence: stockConditionScanner.ts:170 includes the signal bar in its future high/low window and labels partial excursion values mfe30/mae30. Existing proof is recalculated from today's fetched universe, which may omit older signals' instruments. The ordinary journal creates placeholder Outcome text.

Change: independently dated horizons, future-session excursions, completeness flags, retained historical instruments, corrected benchmark joins, and a separate user-trade result model.

Acceptance: no before-entry price excursion counts as future performance; incomplete horizons are labeled; delisted/removed instruments stay visible; old completed evidence is not overwritten with undefined values.

Validation: day 0/1/29/30, missing benchmark, symbol exits universe, partial horizon, split, and no-trade decision. Depends on SL-005/006/008.

### SL-013 — Replace runtime JavaScript expression execution

**P0 before shared formulas/server evaluation · Source finding · L · Domain · Design §9.4**

Evidence: expressionEngine.ts:125 and validateExpressionSyntax construct Function from expression text; parameters are detected by whitespace tokenization.

Change: bounded arithmetic AST parser and explicit allowed function registry, typed units, input size/depth limits, structured validation errors. No JavaScript runtime evaluation.

Acceptance: only supported arithmetic constructs are accepted; parameter extraction is correct without whitespace; preview and server results match; invalid expressions cannot invoke side effects.

Validation: valid nested arithmetic, missing variables, division by zero, unknown function, invalid units, and complexity limits. This item is defensive replacement design; no exploitation procedure is needed.

### SL-014 — Remove public secret usage and triage dependency advisories

**P0 before public deployment · Source finding/audit · L · Operations/Data · Design §12**

Evidence: providerConfig.ts:7 uses EXPO_PUBLIC provider keys. The review audit reported 27 package findings, including 2 critical and 16 high. Expo compatibility recommends ~54.0.37 instead of installed 54.0.34.

Change: server-only provider credentials; no secret-bearing client builds; supported dependency upgrade plan with lockfile; triage each advisory's affected path and runtime reachability. Avoid indiscriminate force upgrades.

Acceptance: production bundle contains no secret credentials; required patch/major migrations are validated; no unresolved applicable release blocker; remaining accepted risks have owner, rationale, and expiry.

Validation: clean install, typecheck/export, core smoke, native compatibility where changed, and bounded secret scanning. A private source sync is not a public deployment.

### SL-015 — Establish the meaningful regression suite

**P1 immediately · Design gap · L · Domain/Operations · Design §19**

Evidence: package.json has no test script; no test suite or CI workflow at baseline. Typecheck and web export pass despite confirmed numerical/data defects.

Change: deterministic test harness, explicit clock, small independently calculated OHLCV fixtures, in-memory storage adapter, and scripts for regression and integration suites.

Acceptance: SL-001/002/003/005/006/007 failures are represented by meaningful tests before fixes; no live provider is needed to run CI; tests assert outcomes rather than implementation details.

## 4. UI, UX, and workflow improvements

| ID | Priority / effort | Current evidence and improvement | Acceptance / design link |
|---|---|---|---|
| SL-020 | P1 · M · Client | App.tsx:3850–3851 passes empty Stock Edit/Delete callbacks. Implement edit and reversible archive with clear dependencies. | Both controls perform their stated action; archived history remains accessible; §§5–6 |
| SL-021 | P1 · L · Client | Stock search uses the local stock directory. Add/import flow must support a genuinely new ticker; current Eye save resolves an existing stock first. | New user captures an unsupported/not-yet-saved symbol, sees coverage, and creates a valid idea in under a minute; §5.2 |
| SL-022 | P1 · L · Client | Range/benchmark controls retain the same underlying arrays; App.tsx:2576 subtracts prices rather than normalized performance. Implement dated ranges and genuine benchmark selection. | Switching controls changes data/basis correctly; missing coverage is disabled/explained; §6.4 |
| SL-023 | P1 · M · Client/Data | visualEvidence.ts creates fallback sector/comparison/MA illustrations and fills some absent values with zero-like text. Remove synthetic evidence from personal mode. | Every plotted personal-data value resolves to a provider/manual/derived observation; §6.4 |
| SL-024 | P1 · L · Client/Product | App has seven workspace states and Home has many repeated summaries. Consolidate Today review queue, Watchlist, Recipes, Journal. | Users find the next review without traversing a technical layer hierarchy; §5.1 |
| SL-025 | P1 · L · Client | Custom tab state lacks route/back/deep-link contracts. Introduce a tested navigation stack and stable routes. | Refresh/back/deep links preserve identity and handle unavailable/deleted records; §§5, 17 |
| SL-026 | P1 · L · Client | BottomNav, WindowPanel, common.tsx, and App have sparse accessibility semantics. Build accessible primitives and focus behavior. | Keyboard/screen-reader core loop, visible focus, accessible errors, scaling and larger touch targets; §6 |
| SL-027 | P1 · M · Client | HomeVisualDashboard runs perpetual loops with no cleanup; MotionSwap/Reveal ignore reduced motion. Add preference handling and animation cleanup. | Reduced-motion mode removes decorative motion; off-screen/unmounted loops stop; §6.1 |
| SL-028 | P1 · M · Client | WindowPanel uses fixed 88% height/minimum 420; no explicit keyboard/safe-area handling. Replace with responsive sheet/dialog behavior. | Works on small phone, keyboard open, landscape/tablet, desktop; focus returns to invoking control; §6.5 |
| SL-029 | P1 · M · Client | saveEye uses Number on optional fields; scanner review accepts numeric conversions without finite/range checks. Add typed optional numeric forms. | Blank stays absent, zero is deliberate, invalid input receives field error, low≤high; §§6–7 |
| SL-030 | P1 · M · Client/Data | User actions update UI before durable save with little failed-save feedback. Add pending/saved/failed indicators and preserved drafts. | Simulated write/network failure loses no authored text and offers retry; §11 |
| SL-031 | P1 · L · Client/Domain | Journal outcomes are mostly pending/placeholder text; quick decisions prefill validity/timing as assertions. Complete outcome editor and explicit user choices. | Decision context autofills factual data only; user can review/edit lessons and distinguish observation from trade result; §§5.6, 9.6 |
| SL-032 | P2 · M · Client | Pinned/recent/filter states are mostly component state. Persist intentional preferences, not transient modal state. | Reload restores chosen view; stale instrument IDs are handled; §6.5 |
| SL-033 | P1 · L · Client | i18n.ts, metricCatalog, seed, and UI mix English/Korean strings; normalization translates stored tags. Use stable codes with complete locale catalogs. | Language switch does not mutate user/domain data; missing translation check; locale-sensitive dates/numbers; §6.5 |
| SL-034 | P1 · L · Client | Large ScrollView/map lists and repeated evidence construction scale poorly; raw scanner displays slice to 18 entries. Introduce pagination/virtualization and counts. | All records are reachable; no silent truncation; measured smoothness at realistic volume; §19 |
| SL-035 | P2 · M · Product/Client | Advanced formula/layer language dominates parts of the workflow. Introduce guided templates and progressive disclosure. | New user can activate a monitor without understanding L0/L1 or writing a formula; §5.4 |
| SL-036 | P2 · M · Product/Client | State-only summaries underuse original context. Add “since last review” evidence diff. | Diff is tied to the last-reviewed evaluation, not overwritten live state; §§5.3, 7 |
| SL-037 | P2 · M · Client | Duplicate maintenance work across Eyes. Add batch review, pause, archive, and cadence actions. | One atomic/clearly reported batch result, partial failures visible, reversible archive; §4.2 |
| SL-038 | P1 · M · Product/Client | New accounts receive seed history today. Add separate sample workspace and clean onboarding. | Personal workspace starts empty; demo activity cannot become production history/alerts; §5.2 |
| SL-039 | P1 · L · Product | No browser/device visual verification in this review. Run formal usability and visual QA. | Representative phones/tablet/desktop, English/Korean, keyboard/text scaling, error states, and five core tasks documented; §§3.4, 19 |

Do not redesign every screen simultaneously. Extract shared primitives and repair the Today→Eye→Decision loop first, then apply the same system to Recipes and Discovery.

## 5. Backend, data lifecycle, and operations

| ID | Priority / effort | Gap and implementation | Acceptance / dependencies |
|---|---|---|---|
| SL-040 | P1 · L · Backend | No backend service. Add authenticated commands and paginated read projections using the shared engine/contracts. | API behavior in design §10.2; private responses bounded; depends SL-002/008/013/015 |
| SL-041 | P1 · L · Backend | No account system. Add auth, recovery, session/device controls, and local-account adoption. | Two real pilot accounts isolated; export/recovery work; §§11–12 |
| SL-042 | P0 before cloud users · L · Backend | No tenant ownership/RLS schema. Add owner-scoped rows, constraints, grants, policies, server-derived identity. | Cross-account references rejected; unauthenticated access denied; server-only billing roles; §12 |
| SL-043 | P1 · L · Backend/Data | Monitoring only runs in client effects/manual actions. Add local worker and managed scheduled job entry points. | App closed/scheduler running still processes due work; sleep/outage visible; §10.3 |
| SL-044 | P1 · XL · Data | One growing AsyncStorage JSON document. Add versioned database/repository migration and serialized writes. | Interrupted migration recoverable; concurrent writes retain order; consistent snapshots; §11.1 |
| SL-045 | P1 · L · Data/Client | No full export/import. Add schema-versioned personal export, CSV preview/mapping, duplicate resolution, checksums. | Round-trip all user entities and history; invalid rows explained; no secret keys exported; §11 |
| SL-046 | P1 · XL · Backend/Client | No multi-device sync. Add mutation outbox, ordered cursor, revision preconditions, tombstones, conflict UI. | Offline/concurrent/clock-skew/resume tests pass; no silent last-write data loss; §11.3 |
| SL-047 | P1 · L · Backend | No delivery outbox or receipts. Add atomic alert intent and retriable channel delivery. | Duplicate jobs create one semantic alert; attempts/receipts tracked; §10 |
| SL-048 | P1 · M/L · Client/Backend | No real notification preferences. Add digests, quiet hours, consent, snooze, and private lock-screen text. | Preference changes affect pending delivery; opt-out works; §10.4 |
| SL-049 | P1 · M · Data | Full raw archive batches accumulate in app state. Add incremental dataset manifests, retention, compression/object placement when needed. | Storage cost model measured; no raw history in bootstrap; reproducible retained decisions; §15 |
| SL-050 | P1 · M · Data | Constituent CSV uses naive comma splitting and snapshots use a weak content hash. Add proper parsing and content-addressed versioning. | Quoted names, renamed symbols, empty sectors, and source revisions tested; §8 |
| SL-051 | P1 · L · Data/Domain | Six frozen rules manually mirror import. Add schema validator, parity check/generation, retained limitations/baseline results. | All IDs/hashes/parameters/conditions match import; mismatches block release; §9.5 |
| SL-052 | P1 · M · Operations | No job/cost observability. Add safe structured events and coverage/queue dashboards. | Operator sees last successful session, partial symbols, retry state, oldest job, quota runway; §§10, 15 |
| SL-053 | P0 before paid launch · L · Operations | No verified backup/restore. Implement consistent exports/backups and an isolated restore drill. | Recovery meets documented RPO/RTO; evidence and ownership intact; §11.4 |
| SL-054 | P1 · M · Backend/Operations | No workload/entitlement limits. Add per-plan caps and provider request budgets server-side. | 60/80/90% warning/degrade/admission policies measured; no unlimited accidental scans; §15 |
| SL-055 | P1 · M · Operations | No release/rollback procedure. Add versioned artifacts, migration order, feature flags, environment separation. | Staging failure cannot mutate production; compatible rollback tested; §18 |
| SL-056 | P0 before paid launch · M/L · Backend/Product | No deletion/privacy lifecycle. Add export, deletion queue, session revocation, notification cancellation, retention notice. | Active data and jobs removed on policy schedule; backup expiry stated; §12 |
| SL-057 | P1 · M · Operations | No incident/support runbooks. Add provider outage, missed scan, wrong result, sync, billing, and restore procedures. | One tabletop drill per critical failure; support sees safe diagnostics; §21 |
| SL-058 | P2 · L · Data | No broad reliable financial/event sources. Add one useful data category at a time with source/period/availability semantics. | Missing fundamentals never look validated; filing/restatement mapping tested; §8.5 |
| SL-059 | P2 · L · Operations | No measured concurrency/load envelope. Replay realistic daily jobs and API traffic. | p95 latency, daily deadline, storage growth, retry surge, and restoration headroom measured; §15 |

A0 requires SL-043's local scheduler and honest availability reporting; it does not require a public API, account system, or managed sync. B requires the ownership, sync, outbox, and operations gates before external users trust it.

## 6. Time-saving features and monetization

| ID | Priority / effort | Proposed improvement and value hypothesis | Acceptance / gating evidence |
|---|---|---|---|
| SL-060 | P1 before paid launch · External + M | Secure commercial data rights for the exact display/derived/notification/export use. | Written scope and vendor quote; do not infer permission from a free/personal key; design §§8, 14 |
| SL-061 | P2 · M · Product | Four-week pilot and baseline time-saving study. | At least 10 qualified users; measured tasks/savings/retention; no invented productivity claims; §3 |
| SL-062 | P1 before billing · L · Backend | Hosted checkout, portal, entitlements, signed/idempotent webhook handling, reconciliation. | Duplicate/out-of-order events, past-due/grace/cancel/refund/downgrade tested; §16 |
| SL-063 | P2 · M · Product | Validate Plus/Pro pricing and workload limits after activation. | Specific willingness-to-pay evidence, contribution model, transparent upgrade/cancellation; §16 |
| SL-064 | P2 · L · Client/Backend | Weekly review report joining decisions, matured outcomes, and noisy conditions. | User prepares weekly review faster; data windows/sample size explicit; §§4, 9 |
| SL-065 | P2 · M · Client/Data | Bulk watchlist import with saved mapping and conflict preview. | Typical existing list imported in minutes without losing notes or duplicating instruments; §4 |
| SL-066 | P2 · L · Product/Data | Earnings/filing review reminders tied to personal thesis. | Confirmed source/date and changed-event handling; no false event certainty; §8 |
| SL-067 | P2 · L · Product/Backend | Opt-in citation-backed AI summary and recipe draft. | Each factual statement grounded; user accepts draft; cost limit; deterministic fallback; §§4, 12 |
| SL-068 | P2 · XL · Client | Native clients, secure sessions, push permissions, deep links, app-store release. | Actual-device QA, signing, delivery receipt handling, current store policy review; §16.5 |
| SL-069 | P3 · XL · Product/Backend | Private shared research/team collections. | Validated collaboration demand; roles/audit/private-sharing tests; separate rights and billing review |
| SL-070 | P3 · XL · Data/Product | Read-only portfolio import and holdings-aware review. | No order execution; user-approved scope; provider agreement; distinction between observation and realized P&L |
| SL-071 | P2 · M · Product | Calm reactivation and referral experiments. | Measure retained review activity, not notification opens or trading frequency; easy opt-out |
| SL-072 | P3 · XL · Product/Data | Broader point-in-time research and backtesting. | Delisted membership, corporate actions, independent fixtures, sample-size/bias disclosure; §9.5 |
| SL-073 | P3 · External + XL | Public template marketplace only after moderation/provenance economics. | Curated versioning, rights, abuse handling, support/fee model; never paid stock ranking |
| SL-074 | P2 · M · Product | Educational workflow templates and bilingual onboarding content. | Users complete core tasks without developer terminology; authored claims reviewed; §5 |
| SL-075 | P2 · M · Operations/Product | Monthly unit-economics and capacity review. | Include data rights, payment fees, email, retries, support, refunds, and labor allocation; §15–16 |

Proposed prices and savings in the design are hypotheses. Avoid adding every feature in this section to the first release. The most promising paid value is unattended reliable monitoring plus a coherent review history; the prerequisite is trustworthy evidence.

## 7. Directory, documentation, and Git improvements

| ID | Priority / effort | Current gap and change | Acceptance |
|---|---|---|---|
| SL-080 | P1 · XL, incremental · Client | App.tsx is 9,374 lines with 74 useState calls. Extract one complete feature at a time; reduce composition-root responsibilities. | Stable core journey after each move; no provider/domain math in screen code; design §17 |
| SL-081 | P1 · L · Domain | Calculations distributed across evaluateEye, expressionEngine, processedFeatureEngine, mockSnapshot, and visualEvidence. Move to pure domain modules. | One formula source with versioned contracts; import-direction check; §17 |
| SL-082 | P1 · L · Data/Backend | useAppModel mixes startup, writes, evaluation, and scanner work. Split repositories, application commands, selectors, and job services. | Mutations independently testable; UI does not drive production scheduling; §17 |
| SL-083 | P1 · M/L · Client | Duplicated style/constants and component injection through App. Create tokens/primitives and focused interfaces. | Shared accessibility/motion rules; strict props; no blanket any styles; §6 |
| SL-084 | P2 · M · Client | Some Logic Lab components and ordinary provider adapter are detached/unreachable. Trace imports, decide integrate/archive/remove. | No deletion until replacement/use is understood; unused code checks prevent drift |
| SL-085 | P1 · M · Operations | No workspaces/backend tree yet. Introduce npm workspaces when second runtime exists, not before. | One lockfile, shared domain/contracts, clean build from root; §17.3 |
| SL-086 | P1 · M · Product/Operations | Legacy BACKLOG/ROADMAP/KNOWN_LIMITATIONS conflict with implemented version controls, scanner, and sheets. Reconcile with current production docs. | One current index/status authority; old briefs labeled historical; no contradictory “done” claims |
| SL-087 | P1 · S/M · Operations | No remote at baseline; existing working changes uncommitted. Preserve baseline, create private owner repo, synchronize main, verify fresh clone. | History retained, intended files present, clean tree, equal local/remote HEAD |
| SL-088 | P1 · M · Operations | No CI/templates/branch policy. Add checks, concise PR template, issue template, release/changelog policy, dependency maintenance. | Checks run on PR; protections reflect actual GitHub plan availability; §18 |
| SL-089 | P1 · S/M · Operations | Git hygiene excludes only .env, not all local secret/export variants. Extend ignore/template policy and verify history before publishing. | No secret/generated/user export data tracked; .env.example contains names/placeholders only |
| SL-090 | P1 · S · Operations | No README at baseline. Add a current entry point with setup, checks, data limitations, and document links. | New contributor can launch and understands demo/production distinction |
| SL-091 | P2 · M · Operations | No release evidence manifest. Add source commit, schema/engine version, test results, migration and rollback notes. | Every production release is traceable and recoverable; §18 |
| SL-092 | P1 · S · Operations | Two requested external files could diverge from source docs. Maintain canonical docs and byte-identical iCloud delivery copies. | Checksums match; companion links resolve; source of truth documented |

SL-087, SL-090, and SL-092 are the repository/documentation actions associated with this delivery. Their final verified state is recorded in the delivery note below. Source refactors, CI implementation, and dependency upgrades remain backlog work.

## 8. Roadmap mapping and dependency gates

| Delivery gate | Required items | Explicitly deferred |
|---|---|---|
| Trustworthy calculations and data | SL-001–008, SL-010–015 as applicable, SL-015 tests | Billing, AI, teams, advanced discovery |
| Personal free release | Above + SL-009, SL-020–031, SL-033–039, local SL-043/044/045/053 | Always-on managed promises, native stores |
| Managed private beta | SL-040–057 plus measured SL-059 and correct data rights | Broad expensive coverage until needed |
| Paid web | SL-014/042/053/056/060/062, validated SL-061/063/075 | Native/team/marketplace |
| Growth | SL-058–059, SL-064–075 selected by evidence | Features lacking retention/time-saving justification |

A task may be a P0 at one release boundary but not block a local documentation snapshot. For example, cloud authorization is mandatory before cloud users, while it is unnecessary for a local-only private workspace.

Recommended PR order: data preservation → canonical observations → calendar/alignment → metric/gate truth → immutable history → temporal alerts/outcomes → live ingestion → core UI completion → worker → sync → delivery → billing. Make source moves separately where possible.

## 9. Validation evidence and limitations

The review ran typecheck and a production web export successfully. It also ran an Expo dependency compatibility check and npm advisory audit, which reported unresolved issues. Isolated synthetic checks confirmed reload/provenance, insufficient warmup, normalized-series interpretation, required-condition gating, and calendar defects.

No financial trading actions were taken. No live user database migration, cloud backend, notification, payment service, or commercial deployment was created. Browser/device QA could not run because no computer-use browser/app surface was available.

Source findings are prioritized evidence, not an exhaustive guarantee that no other defects exist. Performance and accessibility findings require measurement on actual supported devices. Research summary values were read from the supplied artifact; the underlying research dataset/backtest was not reproduced.

The initial secret check used exact configured environment-value matching and common credential patterns over intended files and Git history. It found no matches, but it was not a comprehensive credential audit. Generated bundles and .env remain outside synchronization.

## 10. Review coverage by subsystem

| Subsystem | Files / coverage | Main conclusion |
|---|---|---|
| Composition and navigation | App.tsx; routes/state/actions/render structure/styles | Excessive coupling; dead stock actions; mislabeled chart selectors |
| Model lifecycle | useAppModel.ts, storage.ts, preferences.ts | Local-only, repeated evaluations, unsafe normalization, missing durable protocol |
| Ordinary evaluation | evaluateEye.ts, expressionEngine.ts, metricCatalog.ts, mockSnapshot.ts | Inconsistent units/windows/gates; consolidate engine |
| Scanner | eodDataProvider.ts, universeProvider.ts, marketCalendar.ts, processedFeatureEngine.ts, stockConditionScanner.ts, frozenScannerRules.ts | Distinct pipeline with date/caching/partial-status/proof concerns |
| Presentation of evidence | visualEvidence.ts, logicHelpers.ts, stock components, HomeVisualDashboard.tsx | Conflicting risk interpretation and generated visual context |
| Common controls | common.tsx, BottomNav.tsx, WindowPanel.tsx, MotionSwap.tsx, LogicLevelCard.tsx | Reusable start, needs accessibility/responsiveness/motion contract |
| Logic Lab | L0/L1/L1.5/L2/L3/L4/Preview components | Technical terminology, sliced lists, some detached modules |
| Localization and demo | i18n.ts, seed.ts, mockSnapshot.ts, preferences.ts | Presentation and stored semantics mixed |
| Provider configuration | providerConfig.ts, providerHealth.ts, providerSnapshot.ts | Public key boundary, unused adapter, status not equal to data health |
| Research artifact | docs/v12_3_app_import_bundle.json | Six frozen rules with bias/proof limitations; parity unverified |
| Specifications/history | All numbered docs, BACKLOG, ROADMAP, DECISIONS, CHANGELOG, KNOWN_LIMITATIONS, docs/law.md | Useful product identity; stale implementation status |
| Build/Git | package manifests/lockfile, app.json, Babel/TS config, .gitignore, 61-commit history | Build works; dependencies need maintenance; remote absent initially |

## 11. Complete baseline file inventory

The following table is generated from the pre-documentation working tree. “Existing” means already tracked; “Untracked” means present locally and included in the review, not an instruction to discard it. Generated files, dependencies, Git internals, and ignored credentials are excluded. The new production documents and README are therefore absent from this baseline table.

| Path | Lines | Git at review |
|---|---:|---|
| .gitignore | 6 | Existing |
| App.tsx | 9,374 | Existing |
| BACKLOG.md | 32 | Existing |
| CHANGELOG.md | 63 | Existing |
| DECISIONS.md | 174 | Existing |
| KNOWN_LIMITATIONS.md | 9 | Existing |
| ROADMAP.md | 19 | Existing |
| app.json | 19 | Existing |
| babel.config.js | 6 | Existing |
| docs/00_MASTER_BRIEF.md | 348 | Existing |
| docs/01_BUILD_CONTRACT.md | 306 | Existing |
| docs/02_PRODUCT_SPEC.md | 563 | Existing |
| docs/03_ARCHITECTURE.md | 376 | Existing |
| docs/04_DATA_STRATEGY.md | 318 | Existing |
| docs/05_RECIPE_ENGINE.md | 378 | Existing |
| docs/06_UI_UX.md | 371 | Existing |
| docs/07_ROADMAP_AND_BACKLOG.md | 275 | Existing |
| docs/08_AGENT_WORKFLOW.md | 213 | Existing |
| docs/09_RECIPE_BUILDER_SPEC.md | 469 | Existing |
| docs/10_VISUAL_EVIDENCE_LAYER_SPEC.md | 267 | Existing |
| docs/law.md | 65 | Untracked |
| docs/v12_3_app_import_bundle.json | 1,712 | Untracked |
| package-lock.json | 8,365 | Existing |
| package.json | 28 | Existing |
| src/components/BottomNav.tsx | 193 | Existing |
| src/components/HomeVisualDashboard.tsx | 1,833 | Untracked |
| src/components/MotionSwap.tsx | 59 | Existing |
| src/components/WindowPanel.tsx | 239 | Existing |
| src/components/common.tsx | 926 | Untracked |
| src/components/logic/L0DataLayer.tsx | 438 | Untracked |
| src/components/logic/L15ConditionsLayer.tsx | 186 | Untracked |
| src/components/logic/L1MetricsLayer.tsx | 226 | Untracked |
| src/components/logic/L2RecipesLayer.tsx | 301 | Untracked |
| src/components/logic/L3EyesLayer.tsx | 215 | Untracked |
| src/components/logic/L4OutcomesLayer.tsx | 257 | Untracked |
| src/components/logic/LogicLevelCard.tsx | 229 | Untracked |
| src/components/logic/PreviewTestLayer.tsx | 453 | Untracked |
| src/components/stocks/StockMetricDetailSheet.tsx | 372 | Existing |
| src/components/stocks/StockSearchPanel.tsx | 180 | Existing |
| src/components/stocks/StockTrendHero.tsx | 212 | Existing |
| src/hooks/useAppModel.ts | 903 | Existing |
| src/lib/eodDataProvider.ts | 129 | Untracked |
| src/lib/evaluateEye.ts | 476 | Existing |
| src/lib/expressionEngine.ts | 226 | Untracked |
| src/lib/frozenScannerRules.ts | 219 | Untracked |
| src/lib/i18n.ts | 1,275 | Existing |
| src/lib/logicHelpers.ts | 170 | Untracked |
| src/lib/marketCalendar.ts | 132 | Untracked |
| src/lib/metricCatalog.ts | 485 | Existing |
| src/lib/mockSnapshot.ts | 118 | Existing |
| src/lib/preferences.ts | 18 | Existing |
| src/lib/processedFeatureEngine.ts | 153 | Untracked |
| src/lib/providerConfig.ts | 17 | Existing |
| src/lib/providerHealth.ts | 176 | Existing |
| src/lib/providerSnapshot.ts | 193 | Existing |
| src/lib/seed.ts | 468 | Existing |
| src/lib/stockConditionScanner.ts | 427 | Untracked |
| src/lib/storage.ts | 449 | Existing |
| src/lib/universeProvider.ts | 146 | Untracked |
| src/lib/visualEvidence.ts | 1,610 | Existing |
| src/types.ts | 630 | Existing |
| tsconfig.json | 11 | Existing |

## 12. Delivery note

The design and backlog are canonical under docs/production. The requested iCloud copies use the same filenames. The intended final Git target is private kimhw8084/stockledger with the existing history and reviewed local prototype preserved.

A synchronized documentation/source snapshot is not a production-ready application. The remaining work above is deliberately explicit so future implementation can proceed in small, verified steps.

