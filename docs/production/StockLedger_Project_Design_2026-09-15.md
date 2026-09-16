# StockLedger — Complete Project Design and Production Plan

**Version:** 1.0 · **Review date:** September 15, 2026 · **Owner:** kimhw8084  
**Repository:** https://github.com/kimhw8084/stockledger  
**Companion:** [Current-state improvement backlog](StockLedger_Improvement_Backlog_2026-09-15.md)

This document defines the product, experience, engineering design, commercial model, and release plan. It separates observed implementation from proposed behavior. A design requirement is not a claim that the current application implements it.

## Contents

1. [Direction and executive decisions](#1-direction-and-executive-decisions)
2. [Review scope and current implementation](#2-review-scope-and-current-implementation)
3. [Objectives, customers, and success measures](#3-objectives-customers-and-success-measures)
4. [Product scope and feature economics](#4-product-scope-and-feature-economics)
5. [Information architecture and user journeys](#5-information-architecture-and-user-journeys)
6. [UI system and interaction requirements](#6-ui-system-and-interaction-requirements)
7. [Domain model and immutable history](#7-domain-model-and-immutable-history)
8. [Market-data contracts and ingestion](#8-market-data-contracts-and-ingestion)
9. [Deterministic evaluation and scanner semantics](#9-deterministic-evaluation-and-scanner-semantics)
10. [Backend, API, jobs, and notifications](#10-backend-api-jobs-and-notifications)
11. [Persistence, synchronization, and recovery](#11-persistence-synchronization-and-recovery)
12. [Security, privacy, and operational controls](#12-security-privacy-and-operational-controls)
13. [Completely free path](#13-completely-free-path)
14. [Minimum-spend growth path](#14-minimum-spend-growth-path)
15. [Capacity, costs, and upgrade triggers](#15-capacity-costs-and-upgrade-triggers)
16. [Monetization and go-to-market](#16-monetization-and-go-to-market)
17. [Repository architecture and migration](#17-repository-architecture-and-migration)
18. [Git, CI, releases, and synchronization](#18-git-ci-releases-and-synchronization)
19. [Validation and production acceptance](#19-validation-and-production-acceptance)
20. [Delivery roadmap and work sequencing](#20-delivery-roadmap-and-work-sequencing)
21. [Operational runbooks](#21-operational-runbooks)
22. [Risks, decisions, and unresolved evidence](#22-risks-decisions-and-unresolved-evidence)
23. [Current review evidence](#23-current-review-evidence)
24. [Sources and maintenance](#24-sources-and-maintenance)

## 1. Direction and executive decisions

**Build a private investment research memory and monitoring service that saves busy people the repeated work of remembering, checking, comparing, and documenting stock ideas.**

The promise is: “Save your reason once. Know what changed. Review when it matters.” The distinctive asset is the connection between a user's original thesis, a versioned monitoring recipe, subsequent evidence, their own decisions, and later learning.

The existing briefs describe personal usefulness before monetization. The latest owner instruction expands the scope to commercial production and two operating-cost paths. This document adopts that expanded destination while preserving the original commitments to explainability, calm interaction, and human judgment.

### Decisions to adopt

| Decision | Reason | Consequence |
|---|---|---|
| Start with US equities and ETFs, completed daily bars, and English/Korean | Fits the implementation and multi-week use case | No real-time feed is required for the first paid product |
| Keep Expo, React Native, TypeScript, and a shared deterministic engine | Substantial reusable implementation exists | Refactor incrementally; avoid a full framework rewrite |
| Make watchlist monitoring the primary loop | Personal context is the differentiation | Broad scanning becomes optional discovery feeding the same loop |
| Separate sample data from personal data | The current reload path can mix generated values with provider labels | A demo workspace must never supply production evidence |
| Ship web first, then native clients | Reduces distribution cost and release complexity | Native push and app-store billing are separate launch gates |
| Implement one modular backend and one worker application | Transactions and operation are simpler | No microservices, Kubernetes, or event-stream cluster at this stage |
| Use immutable recipe versions and evidence references | Users must be able to trust historical explanations | Corrections create new records; old evaluations remain traceable |
| Sell automation, organization, and review time | Sustainable value without promising investment returns | Price by monitored workload and workflow depth, not trading activity |
| Maintain two deployment profiles from one codebase | Prevents two diverging products | Free mode reduces services and guarantees, not calculation integrity |
| License data before distributing it | A free API key does not imply commercial display rights | Market-data procurement is a product gate and a distinct cost line |

“Perfection” means measurable correctness, recoverability, accessibility, clarity, and operating discipline. It cannot mean eliminating every possible defect or building every idea before release.

## 2. Review scope and current implementation

### 2.1 Baseline

The review started from local main at commit **0f6eea3**, with **61 existing commits**, **62 first-party project files**, and **39 source/configuration code files totaling 24,119 lines**. Counts exclude dependencies, Git internals, generated distributions, Expo cache, and the ignored environment file.

The working tree contained 15 modified tracked files and 20 untracked files. Those changes are part of the reviewed prototype. The reviewed working changes were later preserved as baseline commit **81c26f9** without altering their contents. No remote was configured at review start. The authenticated GitHub user was kimhw8084, and repository lookup/listing found no stockledger repository at the beginning.

Review coverage includes repository inventory, all first-party module responsibilities and interfaces, application navigation/actions, existing specifications and decision records, the six-rule research import, configuration, dependency status, deep inspection of data/evaluation/persistence/scanner paths, and isolated correctness checks. Large presentation files were reviewed structurally and through relevant rendering/action paths; this was not a claim of exhaustive visual or device certification.

### 2.2 What exists

| Area | Observed implementation | Production gap |
|---|---|---|
| Client | Expo SDK 54, React 19.1, React Native 0.81.5, React Native Web, strict TypeScript | No proper route stack, deep links, deployment config, or device certification |
| Screens | Home, Stocks, Logic Lab, Eyes, Alerts, Journal, Settings | Mixed personal workflow and technical scanner concepts; excessive presentation state in App.tsx |
| Rules | Metric/formula catalogs, custom expressions, condition roles, editable recipes, explicit version-copy actions | Multiple calculation paths and mutable “versions” |
| Monitoring | Eye evaluation on load and every local commit | No independent monitoring while the app is closed |
| Data | Mock snapshots; unused ordinary Stooq snapshot adapter; separately wired EOD scanner | No canonical market-data service or licensed commercial source |
| Scanner | Six frozen rules across XLY, XLI, XLK; dynamic current S&P 500 constituent lookup | Calendar/alignment/error-state issues; research parity unverified |
| History | Alerts, decisions, pending outcomes; scanner review and forward-proof records | Incomplete outcome editing, incomplete historical immutability |
| Storage | One AsyncStorage JSON document plus language preference | No transactional database, migrations, cloud sync, or recovery workflow |
| Design | Custom cards, sheets, animated navigation, charts, English/Korean helpers | Sparse accessibility semantics, small type, repeated styles, no reduced-motion handling |
| Operations | Typecheck command; local web export succeeds | No test suite, lint command, CI, backend monitoring, or billing |

### 2.3 Highest-priority findings

These are detailed and assigned stable improvement IDs in the companion backlog.

1. **Reload changes data while preserving a provider label.** A synthetic saved price of 220 became 195.12 after load, with isMock still false and source still “Fixture Provider.” The normalization path rebuilds market values from the mock generator.
2. **The market calendar can return a Saturday.** For September 14, 2026 at 22:00 UTC, latestCompletedTradingDate returned September 12. UTC midnight is reinterpreted as the preceding Eastern date.
3. **Required conditions are scored rather than enforced.** A fixture with a failed eligibility condition still reached Attention Needed.
4. **Chart data and market data have incompatible semantics.** The unused provider snapshot adapter stores 24 independently normalized chart points, while evaluators interpret those arrays as actual price/volume history and permit insufficient lookbacks.
5. **Risk interpretation is inconsistent.** The evaluator treats a true disqualifier as dangerous; logicHelpers counts false disqualifiers as blockers. Home uses these helpers.
6. **Scanner comparisons use array positions across instruments.** Missing dates or differing histories can corrupt relative strength and benchmark outcomes.
7. **Alert cooldown settings are stored but not enforced.** A transition is deduplicated against all previous identical transitions indefinitely.
8. **Normal recipe edits overwrite the current version.** Explicit copy/version actions exist, but ordinary editing does not preserve historical semantics.
9. **Some visible controls do nothing.** Stock Edit/Delete callbacks are empty; range and benchmark selectors change labels without selecting corresponding historical inputs.
10. **The dependency audit reports unresolved advisories.** Package-count severity is not equivalent to deployed exploitability, but must be triaged before public release.

The immediate engineering objective is to make one real, recoverable, explainable loop trustworthy.

## 3. Objectives, customers, and success measures

### 3.1 Primary customer

A busy self-directed investor who follows approximately 10–100 companies, holds ideas over days to months, uses a phone during the day and a larger screen for weekly review, and currently combines watchlists, notes, charts, and reminders manually.

Secondary customers, after the individual workflow is proven: research-intensive enthusiasts with hundreds of monitors; small investment clubs with private shared research; and professional research workflows requiring exports and stronger access control. Those extensions require separate validation of needs and data rights.

Initial assumptions: US market coverage; US-oriented payment cost examples; bilingual interface; no order execution; no portfolio custody; no regulated advisory service is assumed. Customer geography and legal classification remain launch decisions.

### 3.2 Jobs and measurable outcomes

| Objective | Job completed | Proposed target, not current performance |
|---|---|---|
| O1 — Capture context | Save a ticker, thesis, and review trigger before forgetting | Median under 30 seconds; p90 under 60 seconds |
| O2 — Reduce monitoring work | Replace repeated checks with evidence-based review | Median reported saving at least 30 minutes/week among retained pilot users |
| O3 — Make alerts understandable | Identify change, reason, risk, and freshness | At least 8/10 usability participants explain an alert correctly within 10 seconds |
| O4 — Preserve decisions | Record review result without re-entering context | Median quick decision under 15 seconds; detailed note under 60 seconds |
| O5 — Make learning reliable | Revisit a decision using the data/version available then | 100% of released evaluations and decisions resolve their provenance references |
| O6 — Protect trust | Avoid fabricated or incorrectly labeled data | Zero known synthetic-to-live provenance defects at release |
| O7 — Build recurring revenue | Convert repeated time savings into a paid workflow | Validate retention and willingness to pay before buying broad coverage |
| O8 — Operate economically | Reuse common market work and cap optional compute | Positive contribution margin; measured cost per active/paid user |

### 3.3 Measurement model

The primary product metric is **weekly users completing a meaningful review loop**: opening an evidence-backed change, reviewing it, and recording a decision or a deliberate review schedule. A passive login does not count.

Supporting metrics: first successful monitor, first review within seven days, four-week retained review usage, useful-alert rating, alerts muted, overdue reviews completed, failed sync rate, import completion, self-reported time saved, paid conversion, cancellation reason, and support minutes per account.

Measure time saving with a baseline interview and repeated diary sample. “Ten fewer screen opens” is a proxy, not ten minutes saved. Do not invent savings claims from event telemetry.

Quality guardrails: no missing-data false positives; no repeated stale-data “opportunities”; no pressure to trade; no revenue experiments that obstruct cancellation, export, or essential risk context.

### 3.4 Research and validation plan

Recruit 10–15 qualified personal users for a four-week assisted pilot. Observe their existing review workflow, import one watchlist, and follow at least one decision/outcome cycle. Test “Eye” terminology against “Monitor,” guided recipes against a blank builder, and a compact change card against a full metric board. Keep English/Korean cohorts distinct when evaluating comprehension.

Use directional thresholds with small samples, not claims of statistical significance. A suggested continuation gate is 60% activation and 40% week-four retention among activated pilot users, combined with specific evidence of time saving and at least five credible paid commitments. Revise thresholds after learning; do not optimize the product to manufacture them.

## 4. Product scope and feature economics

### 4.1 Release tiers

| Layer | Features | Why people return or pay | Gate |
|---|---|---|---|
| Trust foundation | Correct data, visible freshness, durable notes, backups, export, stable navigation | Confidence that recorded work survives | Required in every mode |
| Personal core | Watchlists, guided recipes, versioned Eyes, change feed, decisions, outcome reviews | Less forgotten context and repeat research | First real daily-use release |
| Automation | Closed-app monitoring, digest, quiet hours, multi-device sync, recurring reviews | Removes repetitive monitoring and coordination | Reliable backend and suitable data rights |
| Research depth | Earnings context, filing changes, rule comparison, forward outcomes, custom scanner | Faster preparation and fewer manual comparisons | Reliable history and demonstrated demand |
| Collaboration | Private collections, comments, roles, team billing | Shared research without spreadsheets | Separate multi-user/data-rights evaluation |
| Optional intelligence | Citation-backed summaries and recipe drafting | Less reading and drafting | Opt-in, evaluable quality, capped cost |

### 4.2 Features with strong expected time-saving value

- **Fast capture and import:** paste ticker lists, import CSV with column mapping, save a thesis from a link, deduplicate without losing notes.
- **Personal review inbox:** one queue across Eyes, calendar events, stale theses, and pending outcomes.
- **Change since last review:** compare evidence with the precise baseline the user saw, not a generic daily return.
- **Guided recipe setup:** choose an intent, define necessary conditions, define invalidation, choose timing and review cadence.
- **Batch maintenance:** pause, archive, change cadence, mark reviewed, and apply a recipe across a selected watchlist.
- **Quiet automation:** daily digest, priority escalation, snooze until evening/weekend/after earnings, and a limit on interruption volume.
- **Journal autofill:** reference symbol, recipe version, evidence, price basis, and decision timestamp automatically.
- **Weekly review:** completed outcomes, recurring concerns, noisy conditions, and overdue thesis updates.
- **Portable research:** complete structured export plus human-readable review reports; import previews and recovery.
- **Read-only portfolio import later:** tie research to holdings without adding trading execution or collecting brokerage credentials prematurely.

Every feature should have a job, baseline time, expected saving, adoption measure, maintenance cost, and failure behavior. A feature that mainly adds another dashboard is a low priority unless user research demonstrates value.

### 4.3 Boundaries

No automatic trades, return guarantees, personal “buy now” recommendations, pay-to-rank stock signals, manipulative countdowns, public hype feed, or sale of private strategy data. Portfolio accounting/tax filing, options analytics, universal real-time coverage, and a public marketplace are outside the first commercial release.

AI is optional assistance. Deterministic calculations and state transitions remain usable without it. AI-generated statements must have supporting source references or be clearly identified as interpretation.

## 5. Information architecture and user journeys

### 5.1 Navigation

Use four primary mobile destinations: **Today, Watchlist, Recipes, Journal**. Put Discovery under Watchlist until usage justifies a fifth tab. Alerts become the review inbox in Today, avoiding two competing queues. Account, notifications, data connections, billing, and exports live in Settings.

Desktop uses a left navigation rail and a master/detail workspace. A stock detail may remain open while filtering the list. Route identity, selection, filters, and back navigation must be preserved.

Recommended routes:

~~~text
/today
/watchlist
/stocks/:instrumentId
/eyes/:eyeId
/recipes
/recipes/:recipeId/versions/:versionId
/discovery
/reviews/:reviewItemId
/journal
/decisions/:decisionId
/outcomes/:outcomeId
/settings/{account,notifications,data,privacy,billing}
~~~

“Recipe” remains the reusable logic concept. Introduce an Eye as “a monitor for this stock using a recipe.” Keep L0/L1/L1.5/L2 names in developer documentation; expose optional advanced details using plain names: Sources, Metrics, Conditions, Recipes.

### 5.2 First-use flow

1. Choose local/private mode or account mode; explain where information is stored.
2. Add one familiar stock or import an existing watchlist.
3. Write one sentence: “Why do I care about this?”
4. Select a guided starter recipe or “remind me to review.”
5. Show a coverage preview: which inputs are present, missing, manually entered, or delayed.
6. Save the first monitor, with original thesis and recipe version captured.
7. Offer notification setup only after showing an example relevant change.
8. End on Today with a clear next review time.

Do not fill a new personal workspace with fake decisions or performance history. A separately labeled sample workspace can demonstrate the experience.

### 5.3 Ten-second review

The top of an alert must fit this hierarchy:

~~~text
AMD · Pullback monitor
Review needed — price entered your saved zone
Changed: below 50-day average → above 50-day average
Risk: earnings date unavailable; check before deciding
Data: completed session YYYY-MM-DD · delayed
[Review evidence] [Snooze] [Record decision]
~~~

These are illustrative interface words, not a statement about AMD. The full detail shows current condition results, original thesis, changes, data timestamps, and historical version. Recording “skipped” is as prominent and valid as recording an entry.

### 5.4 Recipe editing

Display a simple intent-based wizard: Purpose → Required conditions → Timing/evidence → Risks → Review schedule. Advanced users can open the metric builder. Show coverage before activation. A draft can be saved with incomplete conditions; it cannot silently become a fully monitored production recipe.

Editing a published recipe creates a draft next version. Preview changes against cached, dated evidence; show affected Eyes; let the user choose which Eyes migrate. Publication and Eye migration are distinct operations. Existing alerts and outcomes stay on the old version.

### 5.5 Discovery to ownership

A scanner match is a **candidate**, not a personal thesis or trading recommendation. Show the matched conditions, scope, data completeness, rule version, and research limitations. “Add to watchlist” creates an idea; “Monitor with this recipe” asks for user context and attaches a version. Keep research matches and personal alerts separately labeled.

### 5.6 Decision and outcome

Decision creation references an immutable evaluation. The user supplies action and optional short reason; deeper fields are optional progressive disclosure. Avoid pre-filling “On Time” and “Thesis valid” as if the user had asserted them.

At the selected outcome horizon, show benchmark-relative price movement, favorable/adverse excursions, the user's actual trade outcome if entered separately, and a lesson prompt. Skipped ideas produce observation outcomes, not fictional realized profits. A history edit records a correction; it does not rewrite what was originally known.

## 6. UI system and interaction requirements

### 6.1 Visual language

Preserve the calm light-neutral direction while removing competing summaries and permanent motion. Use one primary action per context. A large count or gauge must represent an explainable measure; no uncalibrated “confidence” percentage.

Proposed design tokens:

| Token group | Initial specification |
|---|---|
| Canvas/surface | Warm neutral canvas, white cards, subtle border; dark theme from semantic equivalents |
| Text | Strong near-black primary; readable secondary; muted reserved for nonessential metadata |
| Accent | One blue for navigation/actions; green for confirmed conditions; amber for caution; red for invalidation |
| Spacing | 4, 8, 12, 16, 24, 32, 48 units |
| Radius | 8 input/chip, 12 card, 20 sheet; consistent semantic usage |
| Type | 16/24 body mobile; 14/20 dense desktop; 12/16 metadata minimum by default; 20–32 headings |
| Numbers | Tabular numerals; explicit currency, percent/ratio, sign, and date basis |
| Touch | Product target at least 44×44 points with adequate spacing |
| Motion | Short response transitions, generally 120–220 ms; no perpetual pulse for ordinary attention |
| Layout | 360–430 phone, 768 tablet, 1024+ desktop review targets |

These are design targets requiring contrast and device verification. WCAG 2.2 AA is the web acceptance baseline; the product chooses larger touch targets where possible. Keyboard access, focus visibility, labels, and non-color status cues are mandatory. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### 6.2 Required shared components

AppShell, NavigationItem, Button, IconButton, TextField, NumericField, Select, SearchCombobox, Dialog, Sheet, Toast, InlineError, EmptyState, LoadingSkeleton, DataStatusBadge, ConditionResultRow, EvidenceCard, ChangeSummary, Timeline, DecisionComposer, and VirtualizedList.

Each component owns accessible name/role/state, disabled/loading behavior, keyboard behavior on web, focus style, text scaling, and test identifiers. Screens compose them; they do not pass an entire App.tsx stylesheet or arbitrary Button component through multiple levels.

### 6.3 Screen specifications

| Screen | Primary content | Main action | Required empty/error states |
|---|---|---|---|
| Today | Review queue ordered by material risk, relevance, and due time | Review next | No items due; data behind schedule; paused monitoring |
| Watchlist | Searchable stocks with thesis summary and monitor status | Add/import idea | No watchlist; unsupported ticker; import validation |
| Stock | Original/current thesis, linked Eyes, dated chart, relevant events | Add monitor or review | No licensed coverage; stale bars; delisted instrument |
| Eye | Why now, required conditions, risks, change timeline | Record decision | Draft recipe; missing input; paused/archived |
| Recipes | Templates, personal recipes, versions, usage | Create recipe | No custom recipes; unavailable metric; invalid rule |
| Journal | Decisions and outcome queue | Complete review | No decisions; horizon not reached; incomplete benchmark |
| Discovery | Scope, run status, candidates, proof limitations | Save candidate | No matches distinct from failed/partial run |
| Settings | Account, schedule, export, data health, billing | Context dependent | Sync conflict; expired credentials; export failure |

### 6.4 Charts and numerical honesty

Maintain dated raw observations separately from visual coordinates. Range controls must select actual session windows. Benchmark controls must use the chosen instrument and matching dates. Compare performance rebased to 100 or percentage returns; do not subtract two unrelated dollar prices.

Render available history only. Mark missing sessions, delayed data, adjustment basis, and major splits. No invented moving-average overlays or synthetic sector series in personal mode. If insufficient history exists, explain the required lookback. Every interactive point exposes a date and underlying value, including an accessible text/table alternative.

### 6.5 Interaction details

- Save forms with pending/saved/failed states. Keep drafts on transient failure.
- Dismissal of a dirty editor offers keep editing or discard; background refresh does not reset input.
- Archive is reversible. Permanent deletion explains affected records and occurs only from deliberate privacy controls.
- Modals support Escape/back, focus containment/return, safe areas, keyboard avoidance, and a visible close action.
- Swipe actions have equivalent buttons; gestures are never the only way to complete work.
- Long lists use pagination/virtualization; preserve scroll and selection after returning from detail.
- Filters persist per workspace. Browser refresh and back resolve the correct route.
- Offline changes show pending synchronization and a conflict resolution path.
- English and Korean use stable internal codes with presentation translations. Never translate stored domain identifiers or overwrite authored content during loading.
- Locale-sensitive dates, decimal parsing, percent units, and text expansion are tested.

## 7. Domain model and immutable history

### 7.1 Canonical relationships

~~~mermaid
erDiagram
    USER ||--o{ WATCHLIST : owns
    WATCHLIST ||--o{ WATCHLIST_ITEM : contains
    INSTRUMENT ||--o{ WATCHLIST_ITEM : appears_in
    USER ||--o{ RECIPE : owns
    RECIPE ||--o{ RECIPE_VERSION : versions
    RECIPE_VERSION ||--o{ CONDITION : defines
    INSTRUMENT ||--o{ EYE : monitored_by
    RECIPE_VERSION ||--o{ EYE : configures
    EYE ||--o{ EVALUATION : evaluated_as
    EVALUATION ||--o{ STATE_TRANSITION : produces
    STATE_TRANSITION ||--o{ ALERT : notifies
    EVALUATION ||--o{ DECISION : informs
    DECISION ||--o{ OUTCOME : reviewed_by
    DATASET_VERSION ||--o{ EVALUATION : supports
~~~

A scanner rule is a versioned recipe specification in a research scope. A scanner candidate can reference a shared market evaluation; a private Eye adds user context and preferences. User-owned imported data is never silently converted into a shared market dataset.

### 7.2 Core table contracts

All user-owned tables contain owner_id, UUID id, created_at, updated_at where mutable, and a revision for optimistic concurrency. Timestamps use UTC instants; trading sessions use explicit date plus exchange/calendar identifiers. Money and market price persistence use decimal types; returns use decimal fractions with units.

| Table | Important fields | Constraints/indexes | Retention |
|---|---|---|---|
| profiles | id=auth user, locale, timezone, preferences | Unique user; no client-write billing roles | Until account deletion |
| instruments | id, exchange, currency, name, status | Stable identity independent of ticker changes | Reference history |
| instrument_symbols | instrument_id, symbol, valid_from/to, provider | No overlapping mappings per venue/provider | Permanent reference |
| watchlists/items | owner, list, instrument, ordering, notes | Unique item per list/instrument; owner/list index | User-controlled |
| recipes | owner, name, latest_version, archived_at | Owner/name search; archive instead of history deletion | User-controlled |
| recipe_versions | recipe_id, number, status, specification, hash, engine_version | Unique recipe/number; published content immutable | While referenced |
| conditions | version_id, stable condition lineage, role, metric_version, operator, threshold, unit | Typed thresholds; stable identity across revisions | With recipe version |
| eyes | owner, instrument, recipe_version, thesis, entry range, cadence, state, revision | Owner/status/due index; low≤high; composite ownership references | Archive by default |
| thesis_revisions | eye, text, author, effective_at, previous_revision | Append-only | With Eye |
| evaluations | eye or research scope, recipe_version, dataset_id, as_of_session, engine_version, results, quality | Unique semantic evaluation key; index eye/session descending | Detailed hot window + durable referenced evidence |
| state_transitions | eye, previous/next, reason, evaluation_id, occurred_at | Unique evaluation/transition type | With history |
| alerts | owner, transition, priority, dedupe_key, status, snoozed_until | Unique owner/dedupe; owner/status/time index | Archive after resolution |
| decisions | owner, eye, evaluation_id, action, note, decided_at, correction_of | Immutable context, append-only correction | User-controlled |
| outcomes | decision, horizon, target_session, basis, metrics, completeness | Unique decision/horizon/basis | With decision |
| review_events | owner, target_type/id, action, due_at, completed_at | Owner/due/status index | User-controlled |
| dataset_versions | provider, instrument scope, content hash, observed/retrieved/available times, license tag | Immutable manifest, checksum | Rights-aware |
| raw_bars | dataset, instrument, session, OHLCV, adjustment basis | Unique dataset/instrument/session; invariant checks | Licensed retention |
| feature_values | dataset, instrument, session, feature_version, value, unit, quality | Unique semantic key | Recomputable cache |
| universe_snapshots | source, as_of/effective date, member list/hash, point-in-time status | Immutable content | Research reproducibility |
| scan_runs/candidates | scope version, dataset, session, coverage, status, condition results | Run idempotency; candidate semantic uniqueness | Run summary + referenced candidates |
| delivery_outbox/attempts | alert, channel, recipient token ref, status, attempts, next_attempt | Unique event/channel/recipient; due queue index | Short operational history |
| sync_changes/mutations | owner, sequence, entity, revision, operation_id | Monotonic owner cursor; unique owner/operation_id | Cursor horizon + resync fallback |
| subscriptions/entitlements | owner, processor ref, plan, status, valid_until | Server-write only; event idempotency | Billing policy |
| job_runs/audit_events | job, correlation id, status, counts, safe error code | Status/time and correlation indexes | Bounded operational retention |

These are logical contracts, not migrations already applied. Do not create every future table in the first slice. Begin with identity, instruments, recipes/versions, Eyes, evaluations, decisions, and durable local migration; add job/outbox and commercial records with their vertical slices.

### 7.3 Invariants

- Published recipe content, metrics, and rule thresholds cannot change in place.
- A condition has stable identity across versions so a diff distinguishes edit from removal/addition.
- A decision references the exact evaluation and thesis revision the user reviewed.
- A dataset correction creates a new version and an explicit supersession link.
- Owner relationships are enforced in the database; knowing another object's ID never grants access.
- Alerts and billing events have durable unique idempotency keys.
- Null/missing, false, zero, and unavailable are distinct values.
- Outcome horizons count trading sessions, not elapsed calendar days.
- Archiving an Eye does not erase its journal.
- User text is never rewritten as a side effect of locale selection, seed normalization, or provider refresh.

## 8. Market-data contracts and ingestion

### 8.1 Observation contract

A provider adapter returns a typed result containing:

~~~typescript
type Observation<T> = {
  value: T | null;
  instrumentId: string;
  sessionDate?: string;       // exchange-local completed session
  observedAt: string;         // time represented by the observation
  availableAt: string;        // earliest known availability to this system
  retrievedAt: string;        // fetch time, never a substitute for observedAt
  sourceId: string;
  datasetVersion: string;
  unit: string;
  adjustment: "split" | "total_return" | "unadjusted" | "unknown";
  quality: "valid" | "stale" | "missing" | "invalid" | "partial";
  origin: "provider" | "manual" | "demo" | "derived";
  issues: string[];
};
~~~

The actual schema should discriminate valid values from absent/invalid observations at runtime. Storing a timestamp and a boolean is insufficient to describe trust.

### 8.2 Adapter responsibilities

Each adapter owns supported markets, identifiers, endpoint weights, credential placement, licensing metadata, timeouts, response validation, rate-limit interpretation, and normalization. Return per-symbol successes and failures. A failure for one symbol must not discard every successful symbol.

The ingestion orchestrator owns bounded concurrency, request budgets, incremental ranges, retries, caching, and completion status. UI code calls StockLedger APIs/cache, never paid provider endpoints with embedded secrets.

The current EXPO_PUBLIC provider keys are public build-time configuration. Expo explicitly documents that those values appear in compiled applications. Move secret provider credentials to server configuration before public use. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

### 8.3 Daily pipeline

~~~mermaid
flowchart LR
    C[Calendar and due instruments] --> B[Budgeted fetch batches]
    B --> V[Validate and quarantine invalid rows]
    V --> R[Versioned raw archive]
    R --> F[Date-aligned features]
    F --> E[Recipe and Eye evaluations]
    E --> T[Transitions and review queue]
    T --> O[Transactional outbox]
    O --> N[Digest or notification]
    E --> H[Historical outcome updates]
~~~

1. Select the latest eligible completed session using exchange calendars and provider delay.
2. Build the union of instruments required by active Eyes, pending outcomes, and enabled scanner scopes.
3. Fetch each provider/instrument/range once per appropriate freshness window.
4. Validate dates, sorting, duplicates, positive prices, OHLC ordering, nonnegative volume, currency, and adjustment metadata.
5. Keep valid records and record explicit coverage failures. Do not fabricate replacements.
6. Write a checksum manifest and dataset revision before calculating.
7. Align stock and benchmark series by session date. Compute reusable features once per semantic key.
8. Evaluate immutable rule versions. Persist results and transitions transactionally.
9. Create notification intents, then deliver separately.
10. Update matured outcomes, including historical instruments no longer in today's universe.
11. Publish a run summary: expected/fetched/valid/blocked symbols, evaluations, transitions, deliveries, duration, and next retry.

### 8.4 Freshness and calendars

Use a maintained exchange session table: session date, opening/closing instants, holiday/early-close reason, and calendar version. Test daylight saving, Monday morning, holidays, year boundaries, and exceptional closures. The NYSE calendar includes early closes that a fixed 16:00 rule misses. [NYSE trading calendar](https://www.nyse.com/trade/hours-calendars)

Freshness is measured against expected available sessions. A Friday close can be current on Sunday. A freshly downloaded month-old bar is stale. An earnings date needs a source timestamp and confidence/confirmation status; it cannot be inferred from a ticker hash.

Run after close plus provider delay, then retry incomplete data with bounded backoff. A watchdog detects missed runs. A user's phone opening is not the scheduler.

### 8.5 Provider and rights strategy

| Data | Initial direction | Required validation |
|---|---|---|
| Personal price history | User-provided CSV or documented personal-use source behind local adapter | Dates, coverage, splits, symbol mapping, allowed use |
| Commercial daily prices | Contracted provider with exact display, derived-data, and notification permissions | Written scope, quotas, retention, attribution, redistribution |
| Financial statements | SEC structured filings for supported US issuers, with issuer mapping | Filing dates, period, units, restatements, reporting availability |
| Events | Licensed calendar or explicit manual event | Confirmation, changes, timezone, source |
| News | Metadata/link first; summaries only where permitted | Content rights, timestamps, deduplication, source links |
| Constituents | Versioned current universe for discovery | Valid parsing, nonempty expected sectors, source hash, bias label |
| Historical membership | Separate point-in-time dataset if needed | Effective dates and delisted instruments |

SEC exposes submissions and XBRL data through public APIs; this can support filings, but it does not replace stock prices or every desired fundamental metric. Respect SEC access policies and fetch centrally. [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

Stooq is present in the prototype, but commercial redistribution terms and operational reliability were not established in this review. Its availability is not proof of permission. Keep it replaceable and out of commercial commitments until verified.

Alpha Vantage's documented free allowance is 25 requests/day; its default terms describe personal, non-commercial use unless otherwise agreed. It is unsuitable as an assumed shared SaaS feed. [Alpha Vantage support](https://www.alphavantage.co/support/), [terms](https://www.alphavantage.co/terms_of_service/)

Twelve Data distinguishes individual use from commercial display, and redistribution requires a separate agreement. A customer supplying a key does not automatically resolve SaaS usage rights. [Commercial-use guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)

## 9. Deterministic evaluation and scanner semantics

### 9.1 One calculation engine

Create a pure TypeScript domain package usable in client preview, local worker, server worker, and tests. Inputs include explicit evaluation time, recipe version, dataset version, user-context revision, and prior state. The engine does no network access, storage writes, locale conversion, or implicit Date.now calls.

Separate:

1. Observation validation and alignment.
2. Feature computation.
3. Condition truth.
4. Role interpretation and state decision.
5. Transition detection.
6. Alert eligibility.
7. Presentation translation.

The UI renders the returned results. It must not calculate an alternative risk score with different truth semantics.

### 9.2 Metric specification

Every metric version declares its formula, input units, output unit, window measured in sessions, warmup requirement, null behavior, adjustment basis, benchmark identity, and feature semantics version. Price-return fractions and displayed percentages are converted once at the presentation boundary.

Examples:

| Metric | Contract |
|---|---|
| SMA200 | Mean of exactly 200 valid aligned closes; fewer observations → insufficient history |
| 20-session return | close[t] / close[t−20] − 1; requires 21 session observations |
| Relative return | Stock and benchmark returns over identical start/end dates |
| Prior-low reclaim | Compare with a specified previous window; exclude current bar where defined |
| Volume ratio | Explicitly declare whether today's volume is included in the reference average |
| Days since review | Calendar elapsed time from explicit evaluation instant; unrelated to market sessions |

Do not silently change frozen research semantics to match a preferred formula. Preserve a legacy version if necessary, introduce a corrected version, and show which version generated each result.

### 9.3 Condition and state truth table

Condition truth is TRUE, FALSE, or UNKNOWN. UNKNOWN includes missing data, insufficient history, stale critical observations, invalid units, and unsupported functions.

| Role/result | Effect |
|---|---|
| Hard disqualifier TRUE | Thesis Broken / explicit blocked status; outranks positive evidence |
| Hard disqualifier UNKNOWN | Unresolved critical risk; prevent clean opportunity escalation |
| Required FALSE | Not eligible; do not offset failure with supporting points |
| Required UNKNOWN | Partial/blocked evaluation; preserve last reliable state as historical context |
| Supporting TRUE | Adds specified evidence contribution |
| Supporting UNKNOWN | No contribution; show coverage gap |
| Risk warning TRUE | Adds risk, may escalate review; same semantics everywhere |
| Timing TRUE | Can advance state only after required gates and data checks |
| Review trigger TRUE | Adds a review task; not necessarily an opportunity state |
| Outcome tag | Records classification; no state or confidence effect |

Keep quality, opportunity state, risk state, and user workflow state separate. A paused Eye can still display a prior Attention Needed evaluation with “monitoring paused.” Bad data must not be presented as a newly computed opportunity.

After gates, use a small documented scoring/state table. Hysteresis or confirmation across completed sessions may suppress minor oscillation. Hard invalidation bypasses ordinary persistence requirements. Store the raw candidate state and the policy reason if the final state is held.

### 9.4 Expression editor

Replace runtime JavaScript Function construction with a bounded arithmetic parser and explicit function registry. Permit numbers, declared parameter identifiers, arithmetic, and approved functions only. Reject unknown identifiers, invalid units, excessive expression size/depth, and division by zero with structured errors.

The parser generates an AST that is validated before publication. Parameter extraction comes from the AST, not whitespace splitting. Preview and production use the same evaluator and limits. No arbitrary code execution or external side effects belong in user formulas.

### 9.5 Frozen scanner and proof

The V12.3 bundle contains six rules, declared survivorship bias, historical summary values, and references to research resources not included in this repository. Treat it as an imported research artifact with unverified numerical parity, not independently reproduced evidence.

Required work:

- Generate the typed frozen registry from a validated import or verify every copied field in CI.
- Preserve parameters, active conditions, blockers, proof limitations, baseline failures, source checksum, and research version.
- Verify the exact rolling-high, failed-break, reclaim, volume, and relative-strength definitions against golden research fixtures.
- Make dynamic and frozen universe modes explicit. An empty parsed universe is an error, not a successful zero-match scan.
- Validate both stock and benchmark histories on the target session.
- Define near-match by approved distances and gate status; no generic “one condition failed” shortcut through hard blockers.
- Persist completed/no-match, partial, blocked, and failed states separately.
- Keep per-rule and per-symbol counts even when individual failed-condition rows are compacted.

Proof display must separate backtested results, forward observations, and actual user trade results. Show sample size, date range, selection method, benchmark, missing observations, corporate-action basis, and survivorship limitations. “Latest era pass” from an import cannot serve as a commercial performance guarantee.

### 9.6 Outcome semantics

Calculate 5/10/20/30/60-session observation horizons as selected, but do not imply all are part of the first release. Store each target session and completeness independently. Benchmark returns use those same dates.

For a signal evaluated after close, forward high/low excursions begin on the next session. Including the signal day's already-known intraday high/low would contaminate forward metrics. A partially elapsed 30-session window is labeled “to date,” not final MFE30/MAE30.

Delisting, missing prices, halted trading, symbol changes, and absent benchmark data produce explicit incomplete statuses. Do not turn missing returns into zero or discard poor outcomes.

## 10. Backend, API, jobs, and notifications

### 10.1 Runtime boundaries

The target backend is a modular application with domains for identity, research, evaluation, review, billing, and operations. A separate worker entry point runs ingestion, evaluation, notifications, and outcome processing using the same domain package.

For managed mode, use Supabase Postgres/Auth and a small API/worker runtime. Cloudflare Workers is a candidate for bounded HTTP/batch work; benchmark real workloads against CPU, memory, subrequest, and execution limits before adoption. A long-running process on existing hardware supports local mode. Large research backfills move to a bounded dedicated batch runner only when measurements justify it.

Clients read small projections and submit commands. Bulk histories and raw archives stay outside normal screen responses.

### 10.2 API contracts

All routes are versioned, authenticated where private, runtime-validated, and ownership-scoped. Structured errors include code, message, field details, request id, and retryability. No provider key, raw SQL error, or personal note appears in logs.

| Endpoint | Purpose | Behavior |
|---|---|---|
| GET /v1/bootstrap | Profile, first-page review queue, watchlist summaries, sync cursor | Compact; no full history |
| GET /v1/instruments/search | Resolve ticker/company/venue | Debounced; cached reference search |
| POST /v1/eyes | Create monitor with recipe version and thesis | Idempotency key; coverage result |
| PATCH /v1/eyes/:id | Edit mutable settings | Revision precondition; 409 on conflict |
| POST /v1/recipes/:id/versions | Create draft/publish version | Validates specification; immutable after publish |
| POST /v1/evaluation-previews | Evaluate a draft on a bounded cached dataset | No production alert side effect |
| GET /v1/eyes/:id/evaluations | Paginated history | Cursor by time/id |
| GET /v1/review-queue | Combined actionable review projection | Priority, snooze, due date filters |
| POST /v1/reviews/:id/decisions | Record user's decision | Atomic decision + review state + outcome schedule |
| POST /v1/reviews/:id/snooze | Set review availability | Explicit timezone interpretation |
| POST /v1/imports | Validate/start import | Preview before commit; size limits |
| POST /v1/exports | Request complete personal export | Async for large accounts; short-lived private download |
| GET /v1/sync/changes | Pull after opaque cursor | Tombstones and versioned changes |
| POST /v1/sync/mutations | Apply queued local commands | Per-command result; operation dedupe |
| POST /v1/billing/checkout | Create hosted payment session | Server-approved plan; account binding |
| POST /v1/billing/webhook | Reconcile processor event | Signature verification and event idempotency |
| GET /v1/health/ready | Internal readiness | Does not expose private diagnostics |

Use server-side entitlements to enforce monitor limits and compute budgets. Client-disabled controls are usability features, not authorization.

### 10.3 Job protocol

A job has type, semantic key, scheduled_for, status, lease owner/expiry, attempt, next_attempt_at, input version, output references, and safe failure code. Claim due jobs atomically with short transactions and leases. Renew long work; abandoned leases permit retry.

Suggested keys:

~~~text
ingest:{provider}:{instrument}:{session}:{adjustment}
feature:{datasetVersion}:{instrument}:{session}:{featureVersion}
evaluate:{eye}:{recipeVersion}:{datasetVersion}:{contextRevision}
deliver:{alert}:{channel}:{recipientVersion}
outcome:{decision}:{horizon}:{basisVersion}
~~~

Semantically repeatable work must be safe under at-least-once processing. Do not promise exactly-once network delivery. State updates, transition creation, and outbox insertion occur in one transaction. A delivery worker commits a success receipt separately.

Initial policy: explicit timeouts; retry transient failures three times with exponential backoff/jitter; respect provider retry headers; do not retry invalid credentials indefinitely; quarantine invalid data; surface a terminal failure after retry exhaustion. Exact timeouts and batch sizes are measured per provider.

### 10.4 Alert policy

An alert requires a material transition or due review event, adequate data for its wording, user consent for the channel, and an unsuppressed dedupe/cooldown decision.

Dedupe by Eye, recipe version, material reason, and evidence/session identity. Cooldown has a time window; it does not suppress the same transition forever. A materially new invalidation can escalate despite a routine-opportunity cooldown, subject to the user's channel settings.

Group multiple Eyes for one stock into one review item. Keep each triggering version/evidence reference. Notifications contain minimal lock-screen content by default. Quiet hours use the user's timezone and daylight-saving rules. A digest records which events it included and is not recreated on retries.

For native delivery, Expo's push service has no per-notification fee, but app credentials, delivery receipts, stale-token handling, and distribution still require work. A successful send receipt is not proof that a person saw the notification. [Expo push FAQ](https://docs.expo.dev/push-notifications/faq/), [delivery handling](https://docs.expo.dev/push-notifications/sending-notifications/)

### 10.5 Initial service objectives

Proposed targets for managed beta, subject to load testing:

- Cached review API p95 under 500 ms; mutation acknowledgment p95 under 1 second.
- At least 99% of scheduled eligible daily workloads complete within 30 minutes of contracted provider availability.
- p95 valid alert delivery attempt within five minutes of committed transition.
- No lost acknowledged writes in normal operation; failures explicitly surfaced.
- 99.5% monthly application availability during beta, 99.9% only after operational evidence and a suitable recovery design.
- Separate provider delays from StockLedger processing delays in reporting.

These are internal targets, not promised SLAs. Personal free mode offers no always-on service objective.

## 11. Persistence, synchronization, and recovery

### 11.1 Local storage migration

First protect current data before replacing storage. Export the original JSON bytes with a checksum. Validate a versioned schema, migrate into a new namespace/database, compare counts and references, and activate only after success. Retain the original backup for recovery. A parse error must not replace the user's data with seedData.

Use SQLite for native/local service persistence. For web, use a tested IndexedDB adapter initially or evaluate Expo SQLite's web requirements before selecting it. Browser persistence is not a backup and may be cleared or evicted. Keep cross-platform repository interfaces focused on actual use cases rather than a general ORM abstraction.

Serialize local mutations or use transactions so overlapping saves cannot finish out of order. Return saved/failed status to the UI. Never imply a write is durable before its commit succeeds.

### 11.2 Local-to-cloud account adoption

A user can try local mode without an account. When they opt into sync:

1. Show data location and upload scope.
2. Create or authenticate the account.
3. Validate a migration manifest and assign stable IDs.
4. Upload idempotent batches.
5. Compare per-entity counts/checksums and verify ownership.
6. Pull canonical server revisions.
7. Mark sync active only after reconciliation.
8. Retain the local recovery export until the user deliberately removes it.

Demo records require an explicit separate import and stay tagged demo. Never merge sample decisions into personal history automatically.

### 11.3 Sync protocol

The server assigns an ordered cursor per owner. Clients persist last_applied_cursor and a mutation outbox with stable operation IDs. Pull changes in pages; apply each page transactionally; advance cursor only after successful local commit.

Mutable Eye settings use revision preconditions. Append-only notes/decisions merge by distinct IDs. Published recipe edits create new versions. Conflicting thesis text preserves both revisions and asks for a choice. Deletions use tombstones and a defined retention horizon. Old clients beyond that horizon perform a full snapshot resync.

For client UI feedback, track saved locally, syncing, synchronized, and conflict/error separately. A stale or failed sync must never silently erase newer local writing.

### 11.4 Backup and restore

Back up user-authored records and the evidence needed to interpret decisions. Recomputable caches have a different retention policy. Licensed raw data follows the contract and may need deletion independently of user notes.

For personal mode, provide versioned exports to an existing local/iCloud backup destination. Do not place a live SQLite database in a file-sync folder for multi-device concurrent access; export a consistent snapshot instead.

Managed initial recovery target: RPO up to 24 hours and RTO up to four hours, validated with a restore drill. Paid basic backups do not imply minute-level recovery. If product promises require lower RPO, procure PITR or a tested incremental replication strategy and budget it explicitly.

Database backups do not include the underlying Supabase Storage objects. Back up permitted raw archives and attachments separately, retain their manifest references, and include them in restore validation. [Supabase backup scope](https://supabase.com/docs/guides/platform/backups)

A quarterly restore drill uses a fresh isolated database and verifies login, data ownership, recipe/evaluation references, decisions, and exports. Before launch, perform at least one end-to-end drill. Record date, duration, restored record counts, and unresolved gaps.

## 12. Security, privacy, and operational controls

### 12.1 Trust boundaries

Private strategies and notes belong to the user. Provider credentials, signing keys, database secrets, and payment webhook secrets belong only in managed secret storage. Publishable Supabase keys may be used in clients with properly configured authorization; service-role credentials must never enter client bundles.

Use established authentication, verified account recovery, short-lived access tokens, secure native token storage, and an explicitly reviewed browser session approach. Do not claim that adding Supabase automatically secures the application.

### 12.2 Database authorization

Enable RLS on every exposed user-data table and write policies for actual ownership. Validate both existing-row access and proposed-row ownership on mutation. Indexed owner columns and ownership-constrained foreign keys prevent cross-account references.

Server handlers derive owner identity from the verified session. User-editable metadata cannot grant paid plans, admin status, or access to other users' data. Service-role workers run explicit scoped operations; public endpoints do not forward arbitrary privileged queries.

Use security-invoker views where supported, private schemas for internal jobs/licensed data, minimal grants, and controlled function execution. Validate policies with two separate accounts and unauthenticated access. This is defensive access testing, not a substitute for a full independent security review. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

### 12.3 Input and operational safeguards

Runtime-validate imports, API commands, CSV content, formula ASTs, numeric ranges, dates, and upload sizes. Resolve instruments explicitly; do not accept arbitrary client-supplied provider URLs. Bound expensive previews, scanner scopes, and exports.

Log request IDs, aggregate counts, timings, and safe error categories. Redact notes, credential-bearing URLs, payment data, and raw provider payloads. Retain operational logs according to a short documented policy. Security audit records use a separate access-controlled stream.

Use dependency lockfiles, supported runtime versions, automated advisory triage, minimal deployment permissions, and isolated CI secrets. Treat private research imports as data, not executable instructions.

### 12.4 Privacy and lifecycle

Provide export, account deletion, subscription cancellation, session/device controls, and notification preferences. Delete active data and scheduled jobs within a stated service period; explain backup expiration separately. Deletion must prevent further notifications and invalidate sensitive sessions.

AI processing is opt-in per workflow with a preview of included content. Do not send private theses to a model merely because a screen opens. Use aggregate product analytics without raw investment notes or watchlists by default.

Public terms, privacy notices, investment-related product language, app-store rules, tax collection, and data contracts need review for the actual launch jurisdictions. This design does not determine the business's legal classification or substitute for that review.

## 13. Completely free path

### 13.1 What “free” means

**No required paid Supabase plan, no required paid hosting/data/AI subscription, and no automatic metered overage.** Existing device, internet, electricity, and any already-owned storage are prerequisites, not costless resources. Native app-store membership and payment processing are excluded from a literal zero-spend release.

The free product can be polished and useful. It cannot honestly promise unlimited cloud scale, commercial market-data redistribution, or dependable closed-app monitoring without a running service.

### 13.2 Recommended A0: local personal production

| Component | Choice | Limitation |
|---|---|---|
| Client | Expo web build on localhost; optional static free-hosted shell | Browser/device storage needs backup |
| Database | Local SQLite service; web cache through a tested adapter | Single primary data authority initially |
| Worker | Node process scheduled on the owner's existing computer | Stops when device sleeps/offline |
| Data | User-owned/imported data and permitted personal-use adapters | Coverage and quotas may be modest |
| Alerts | In-app review queue; local reminders where supported | No guaranteed unattended remote push |
| Auth | Local single-user boundary | Do not expose the local service to the public internet |
| Backup | Versioned encrypted export to existing backup destination | Owner runs/monitors backups |
| AI | Disabled; deterministic summaries/templates | No recurring model fee |
| Distribution | Local web or static PWA shell on provider subdomain | No paid domain or store listing required |
| Monetization | None required to use this personal path | Commercial operations introduce unavoidable costs |

A0 launch acceptance: one owner, at least 25 watched instruments tested, durable decisions, correct daily processing, reproducible restore, visible last completed run, and a clear stopped-monitoring indicator. Capacity beyond the tested envelope is not promised.

If the machine is unavailable, retain the last reliable evidence, show “monitoring has not run since…,” and catch up idempotently on resume. Do not generate fictional historic notifications as if delivered on time.

### 13.3 Optional A1: free cloud pilot

Use a static free host plus **Supabase Free** for a small private pilot where appropriate, with OAuth-only entry or a separately configured free email provider. Store compact user records and summaries; keep large histories outside the database or local when rights permit.

At review time Supabase Free lists a 500 MB database, 50,000 included MAU, no automatic backups, and pausing after a week of inactivity. These quota numbers are not a promise that this workload can serve 50,000 active investors. [Supabase pricing](https://supabase.com/pricing)

Cloudflare Workers Free lists 100,000 requests/day and a 10 ms CPU allowance per invocation. Free server computation must use small measured work units; a full-universe history scan is not a suitable assumption. Cloudflare Pages Free includes 500 builds/month. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

Use a conservative pilot admission cap of 50 active users, 10 monitors/user, and compact change-only history until storage and CPU measurements support expansion. That is a chosen operating cap, not a vendor guarantee. If server monitoring cannot fit free execution limits, keep it on the local scheduler and disclose the dependency.

The default Supabase SMTP service is intended for testing, restricted to authorized team addresses, and currently heavily rate-limited. It is not a production signup solution. Prefer OAuth or configure custom SMTP with its own verified sending domain. [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)

A custom sending domain has a cost unless already owned. To preserve literal zero new spending, use local mode or supported OAuth and in-app notices; do not imply unlimited email is free.

### 13.4 Free-mode hard stops

- Refuse to enable billable features or overage automatically.
- At 60% of a measured quota, report runway; at 80%, reduce optional background work; at 90%, stop new workload admission until the owner chooses a path.
- Retain user writing and exports; shed optional scans, historical detail, and AI first.
- Keep a supported “export and continue locally” route.
- Do not use fake traffic to defeat provider inactivity policies.
- Do not expose private GitHub source publicly to obtain a free hosting allowance.
- Keep one implementation with capability flags, not a permanently diverging free branch.

## 14. Minimum-spend growth path

### 14.1 Recommended B architecture

Start with the existing Expo client, Supabase Pro for managed Postgres/Auth, a bounded API/worker runtime, and free static hosting. Use database-backed jobs/outbox before buying a separate queue product. Add a paid email tier only when volume or daily bursts justify it. Add raw-object storage only when retention requires it.

Supabase Pro is listed from $25/month, with 8 GB included disk, 100,000 included MAU, seven-day daily backup retention, and a $10 compute credit that offsets one Micro instance. Extra projects, larger compute, overage, and PITR are separate considerations. [Supabase pricing](https://supabase.com/pricing)

Workers Paid starts at $5/month with request and CPU usage allowances; it is not an unlimited compute purchase. Measure batch time and budget retries. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### 14.2 Buy convenience in this order

1. **Managed durable database and working recovery.** Removes self-hosting burden and free-project pauses.
2. **Server-side scheduled monitoring.** Delivers the core promise while users are busy or offline.
3. **Suitable data rights and reliable daily coverage.** Makes shared automated evidence commercially supportable.
4. **Email delivery capacity and domain reputation.** Enables onboarding and useful digests.
5. **Error reporting, restore automation, and support tools.** Reduces incident duration and founder time.
6. **Native distribution and optional AI.** Add after the web workflow proves retention.
7. **Extra compute, replicas, or dedicated research workers.** Triggered by measured constraints.

Do not buy an enterprise suite before verifying the basic value loop. Conversely, avoid building commodity authentication or payment infrastructure merely to save a small monthly fee.

### 14.3 Two commercial stages inside B

**B1 — Workflow-first paid beta:** Charge for private sync, review organization, imports, exports, and automation on data the service is permitted to process. If commercial price-display rights are not secured, clearly limit the product to manual/user-authorized datasets and available metadata. Do not advertise automatic broad-market monitoring.

**B2 — Licensed automated monitoring:** Add centrally shared market ingestion and paid discovery only after the vendor confirms display, calculation, storage, alert, and export rights for the exact product. Source quotas and rights become enforceable capabilities.

Twelve Data's rendered business page currently shows Venture at $499/month, while also containing a lower “from” teaser. Use **$499 only as a conservative planning scenario**, not a verified minimum quote for StockLedger. Exact credits, markets, exchange fees, and redistribution rights require confirmation. [Business pricing](https://twelvedata.com/pricing-business)

### 14.4 Migration from A to B

The schema, engine, recipe IDs, and export format stay stable. Move the primary authority from local SQLite to Postgres through a validated import, then enable server jobs and multi-device sync. Reconcile record counts, immutable hashes, and user-visible history before cutover.

Run local and server evaluators in shadow mode against the same dataset. Compare results without duplicate alerts. Promote the server only after parity; retain rollback export and source data. Turn off the old scheduler after the new authority is verified.

## 15. Capacity, costs, and upgrade triggers

### 15.1 Monthly operating scenarios

USD planning estimates, excluding labor, taxes, legal/accounting, purchased hardware, customer acquisition, refunds, and any unquoted exchange rights. Vendor facts were checked on the review date; usage estimates are engineering assumptions.

| Scenario | Base infrastructure | Data | Other variable cost | What is supported |
|---|---:|---:|---|---|
| A0 personal | $0 new vendor fees | $0 with permitted imports/free personal access | Existing device resources | Local personal product |
| A1 free pilot | $0 within free quotas | Rights-dependent; no shared commercial feed assumed | No automatic overage | Small, explicitly limited private pilot |
| B1 initial managed workflow | About $30/month | $0 incremental only where usage is permitted | Email/domain/storage/processing as needed | Cloud sync and workflow product |
| B1 email growth | About $50/month | Same qualification | Domain and usage | Adds a paid email allowance |
| B2 licensed automation example | About $549/month | $499 scenario included in total | Exchange terms, storage, compute overage, processing | Subject to exact commercial contract |
| Larger growth | Measured quote/budget | Measured quote/budget | Load, support, retention, regions | No fixed user-count promise |

Resend lists Free at 3,000 emails/month with a 100/day limit, and Pro at $20/month for 50,000 emails. A daily digest alone can exceed the free daily limit well before the monthly allowance. [Resend pricing](https://resend.com/pricing)

Separate fixed subscriptions, resource overage, per-user data licensing, per-message delivery, storage, payment processing, and human support in the budget. A $30 infrastructure subtotal is not the full cost of running a financial-data product.

### 15.2 Workload model

Let U be monthly active users, W active Eyes per user, D trading sessions/month, S unique monitored instruments, K distinct shared rule versions, and H retained daily evaluation sessions.

- Eye evaluations/month ≈ U × W × D.
- Shared price ingestion scales mainly with S × D, plus backfills/corrections.
- Shared scanner work scales with S × K × D; personal context may still require Eye-specific evaluation.
- Full evaluation storage ≈ U × W × H × bytes_per_evaluation, plus indexes and backups.
- Notification load depends on material changes and preferences, not every evaluation.
- Auth MAU quota is only one component of capacity.

Illustration with 21 sessions/month, 20 Eyes/user, and 2 KB per evaluation before indexes:

| Active users | Evaluations/month | Raw detailed storage/month | Interpretation |
|---:|---:|---:|---|
| 100 | 42,000 | ~84 MB | Plausible pilot workload; still measure database overhead |
| 1,000 | 420,000 | ~840 MB | Full history grows quickly; keep changed-state/detail policies |
| 10,000 | 4,200,000 | ~8.4 GB | Exceeds a small base plan if stored indefinitely |
| 100,000 | 42,000,000 | ~84 GB | Requires deliberate batching, retention, compute, and pricing |

At an assumed 5 ms CPU per evaluation, those volumes imply 0.21, 2.1, 21, and 210 million CPU ms/month respectively, before parsing, ingestion, API work, and retries. This is arithmetic, not a benchmark. Measure the actual engine and p95/p99 batch cost.

For example, 500 instruments × 252 sessions × 120 bytes/bar is about 15.1 MB of compact bar payload before indexes, metadata, revisions, and runtime JSON overhead. Current full-history archive-per-run behavior multiplies that unnecessarily.

### 15.3 Cost containment and retention

- Shared licensed market datasets are cached once per provider/adjustment/version.
- Keep current Eye projections small; preserve detailed evaluations on state change, user decision, or a bounded recent window.
- Preserve enough input references and licensed data to reproduce retained decisions. A hash without available inputs does not make a result reproducible.
- Compress permitted raw archives; retain manifests; use incremental updates.
- Retain full user-authored history unless the user chooses deletion.
- Batch database writes, index actual access paths, and avoid unbounded realtime subscriptions.
- Use coarse refresh status rather than streaming every market row to every client.
- Limit expensive exports, AI, and custom scans by explicit plan budgets.
- Estimate headroom monthly, including p95 bursts and recovery/backfill load.

### 15.4 Upgrade triggers

Upgrade or redesign based on measured storage >70% with less than 60 days of runway, CPU saturation during the daily deadline, growing queue age, API p95 regression, connection contention, email burst failures, backup/restore targets missed, or a contractual rights limit.

Add indexes and reduce duplicate work before increasing compute. Introduce table partitioning, read replicas, external queues, or warehouse-style analytics only when query plans and volume justify them. Keep financial-history correctness ahead of cache hit rate.

## 16. Monetization and go-to-market

### 16.1 Packaging hypothesis

These prices and limits are proposed experiments, not researched willingness-to-pay facts.

| Plan | Proposed monthly/annual price | Initial value bundle |
|---|---|---|
| Personal Free | $0 | Local private workspace, limited monitors, manual/import workflows, full personal export |
| Plus | $12/month or $120/year | Cloud sync, 50 active Eyes, quiet digest, guided review, reusable templates |
| Pro | $24/month or $240/year | 250 Eyes, richer review automation, custom metrics, scoped discovery, comparison/reporting |
| Private Team, later | Test from $49/month plus seat/usage model | Shared collections, roles, audit, collaborative review; only after validation |

All tiers retain honest data quality, user-data export, accessibility, basic security, and reasonable cancellation. Advanced automation limits protect cost; they must not hide negative evidence. Data coverage may be a separate contracted add-on. Do not sell “unlimited” usage before measuring its cost.

### 16.2 Revenue model and unit economics

US domestic online-card examples use Stripe's listed 2.9% + $0.30 processing fee. Stripe Billing's pay-as-you-go rate is an additional 0.7% of billing volume. Actual geography/payment methods/tax tooling may differ. [Stripe payments pricing](https://stripe.com/pricing), [Stripe Billing pricing](https://stripe.com/billing/pricing)

At $12/month, the combined illustrative transaction cost is $0.732, leaving $11.268 before delivery, compute, support, and fixed expenses. At $24, it is $1.164, leaving $22.836. If variable infrastructure/support allocation is $1.50 for Plus and $3 for Pro, contribution is $9.768 and $19.836.

With an illustrative $549 fixed monthly platform/data budget, break-even is about 57 Plus accounts or 28 Pro accounts before founder salary, taxes, acquisition, refunds, and additional licensing. This is not a revenue forecast. Annual discounts reduce effective monthly revenue; processing the annual charge once does not eliminate costs or refund obligations.

Track contribution margin by cohort and plan, conversion after activation, retention at weeks 4/8/12, annual renewal, support cost, and reasons for cancellation. Favor retaining satisfied users over maximizing initial conversion.

### 16.3 Conversion design

Let users experience a successful capture/review loop before showing a paid upgrade. Trigger the offer at a clear value boundary: more monitored ideas, multi-device continuity, a scheduled digest, or advanced review automation.

Show the exact feature, price, renewal period, quota, data coverage, and cancellation route. Keep a useful free workflow. Avoid blocking access to existing notes if a subscription lapses; downgrade to read/export plus explicit inactive-monitor status.

Billing uses hosted checkout and a customer portal. Server webhooks, periodic reconciliation, and an entitlement table handle active, trialing, past-due, canceled, refunded, and disputed states. A checkout success redirect alone never grants access. Preserve webhook event IDs and handle out-of-order events.

### 16.4 Launch channels

Begin with the owner and a small group of qualified users. Share workflow demonstrations and reusable educational templates, not outcome promises. Test English and Korean positioning independently. Publish examples of “before/after weekly review work” supported by actual user research.

Only add paid acquisition after retention and contribution margin are demonstrated. A private referral program can reward subscription time after a referred user remains active. A public recipe marketplace is deferred until provenance, moderation, licensing, and support economics are understood.

### 16.5 Native commercial distribution

A free web release avoids app-store membership requirements. Apple lists a $99 annual developer membership; native release has separate signing, review, privacy, and commerce requirements. [Apple Developer enrollment](https://developer.apple.com/programs/enroll/)

Before native billing implementation, verify current Apple/Google storefront rules for the chosen regions and business model. Do not assume a web checkout link is allowed everywhere or that one commission rate applies universally. Native distribution cost is outside A0's zero-spend promise.

## 17. Repository architecture and migration

### 17.1 Current structural assessment

App.tsx has 9,374 lines, including roughly 3,000 lines of styles, 74 useState calls, routing, validation, domain-derived calculations, and many modal editors. useAppModel.ts has 903 lines and combines storage, evaluation, scanner scheduling, and mutations. visualEvidence.ts has 1,610 lines of rendering models and calculations; HomeVisualDashboard.tsx has 1,833 lines.

The repository also contains partially detached Logic Lab components and a provider adapter that is not called by the active application. This is a discoverability and maintenance problem, not a reason to delete working assets during a documentation task.

### 17.2 First migration: organize without moving the entry point

~~~text
stockledger/
├── App.tsx                         # small composition root after extraction
├── src/
│   ├── app/                        # providers, navigation, startup, error boundary
│   ├── features/
│   │   ├── today/                  # screens, local components, selectors
│   │   ├── watchlist/
│   │   ├── recipes/
│   │   ├── eyes/
│   │   ├── journal/
│   │   ├── discovery/
│   │   └── settings/
│   ├── domain/
│   │   ├── instruments/
│   │   ├── recipes/
│   │   ├── evaluation/
│   │   ├── evidence/
│   │   └── outcomes/
│   ├── data/
│   │   ├── repositories/
│   │   ├── local/
│   │   ├── providers/
│   │   ├── sync/
│   │   └── migrations/
│   ├── ui/                         # tokens, primitives, charts, accessibility
│   ├── i18n/                       # stable codes + en/ko presentation
│   └── demo/                       # isolated sample workspace and fixtures
├── tests/
│   ├── fixtures/
│   ├── domain/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── production/                 # these two current planning documents
│   ├── adr/                        # dated decisions as adopted
│   └── legacy/                     # migrate older briefs only after links updated
├── scripts/                        # import validation, backup, release checks
└── .github/                        # CI, templates, dependency policy
~~~

Do not create empty directories merely to match this tree. Add each boundary as code moves into it. Keep path changes separate from behavior changes where possible.

### 17.3 Second migration: workspace when backend exists

~~~text
stockledger/
├── apps/
│   ├── client/                     # Expo Router + web/native feature UI
│   ├── api/                        # authenticated command/query handlers
│   └── worker/                     # local and managed runtime entry points
├── packages/
│   ├── domain/                     # pure types, rules, features, outcomes
│   ├── contracts/                  # runtime schemas and API types
│   ├── data/                       # storage/provider implementations
│   ├── ui/                         # shared components only when reused
│   └── test-fixtures/              # deterministic golden datasets
├── supabase/
│   ├── migrations/
│   └── tests/                      # authorization and migration checks
├── infra/                          # environment templates, runtime config
├── docs/
│   ├── production/
│   ├── adr/
│   └── runbooks/
├── scripts/
├── .github/workflows/
├── package.json                    # npm workspaces, common scripts
└── package-lock.json               # one lockfile
~~~

This is the target, not today's tree. Keep a single repository. Do not introduce a separate microservice per domain or a second independent free/paid source tree.

### 17.4 Dependency rules

- UI imports application services and typed view models; it does not import provider secrets or database drivers.
- Domain code imports no React, storage, network, or platform-specific modules.
- Provider adapters normalize observations; they do not decide user Eye states.
- Server/user authorization is enforced at the boundary and database, not inside arbitrary components.
- Demo modules are excluded from production ingestion paths.
- Dependency direction is checked with lightweight lint/import rules when extraction begins.
- Add a shared package only when it has multiple consumers or a genuine runtime boundary.

### 17.5 Migration sequence and safety

1. Protect stored data and add characterization tests for the confirmed correctness defects.
2. Extract pure engine contracts and correct semantics.
3. Extract tokens/primitives and one complete screen at a time.
4. Move persistence behind repositories with real migrations.
5. Introduce navigation with deep links and preserved state.
6. Add backend/worker packages using the already-shared engine.
7. Move entry points into workspaces after both runtimes work.
8. Remove unreachable modules only after import tracing and behavior verification.
9. Reconcile legacy docs, update links, and keep a short compatibility guide.

Retain existing public import paths temporarily through deliberate re-exports where necessary. Avoid a single giant move/rewrite that obscures regressions.

## 18. Git, CI, releases, and synchronization

### 18.1 Immediate repository management

Preserve the existing commit history and the uncommitted prototype as a clearly named baseline commit. Keep the new design/backlog in a separate documentation commit. Create the owner-requested kimhw8084/stockledger repository as **private** because no public-release instruction was given.

Track source, lockfile, research configuration, documentation, and future migrations. Keep .env, dependency folders, device caches, generated distributions, personal exports, and raw market archives out of Git. Do not upload a credential-bearing built bundle.

The review checked current publishable files and historical blobs for exact matches to configured local environment values and common credential patterns. No matches were reported; this is a bounded check, not a guarantee of no historical secrets.

The synchronization completion check is: local main has the intended upstream; local HEAD equals the remote main hash; the working tree is clean; a fresh clone can typecheck and export; all intended source/docs exist remotely. iCloud delivery copies must match the repository documents byte-for-byte.

Git synchronization does not deploy an app, synchronize users' runtime databases, or guarantee that iCloud has completed remote upload.

### 18.2 Ongoing branch policy

Use protected main when available for the account/repository plan, short-lived feature/fix branches, and reviewed pull requests. Do not maintain long-lived free versus paid branches. Keep fixes small, with one behavioral objective and explicit acceptance criteria.

Where private-repository protection features require a paid GitHub plan, document the available protection level and use a procedural pull-request/check policy until upgrading is justified. Do not describe unavailable protection as already enabled.

Commit logical source changes separately from moves, generated files, and documentation. Reference the stable SL improvement ID. Never force-push shared main to resolve divergence. Fetch first; review ahead/behind state; fast-forward, rebase a private branch, or merge with conflict review.

### 18.3 Required CI by phase

Initial CI: clean npm install from lockfile, typecheck, web export, formatting/lint once configured, and the meaningful deterministic regression suite.

Before managed beta: migration from empty and prior schema, two-account authorization tests, provider contract fixtures, job retry/idempotency tests, import/export round-trip, and core web E2E.

Before native release: device/simulator smoke on supported targets, notification/deep-link behavior, locale/text-scaling checks, signing/build verification, and store-specific requirements.

Use minimal workflow permissions, pin action references according to policy, cache dependencies, and avoid provider secrets in pull-request builds. Use synthetic fixture data for CI. Do not make normal tests depend on live market availability.

GitHub Free currently includes 2,000 hosted-runner minutes/month and 500 MB artifact storage for private repositories. Keep Linux checks short, artifact retention bounded, and budgets explicit. CI scheduling should not become the production market-monitoring scheduler. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

### 18.4 Release management

Use semantic app versions, immutable release tags, a changelog, a documented supported schema/engine version, and migration notes. Tag production deployments with source commit and migration version.

Deploy schema expansions first, then compatible server changes, then clients; remove old fields only after the supported-client window. Rollback restores the previous application artifact when safe. Forward-fix a migration when reverting would destroy new user data.

Feature flags separate demo mode, scanner availability, cloud sync, licensed datasets, AI, and billing. The free path remains a tested configuration.

## 19. Validation and production acceptance

### 19.1 Test portfolio

| Layer | Meaningful checks |
|---|---|
| Domain | Required/disqualifier truth table; null/zero distinctions; exact warmups; dated alignment; engine determinism |
| Data | CSV quoting; duplicate/unsorted dates; malformed OHLC; holidays/early close; splits; stale benchmark; provider partial failure |
| Persistence | Original backup retained; corrupted store recovery; interrupted migration; concurrent writes; foreign-key integrity |
| History | Published version immutability; decision context unchanged after later edits; correction and archive behavior |
| Jobs | Duplicate enqueue; process death; lease expiry; retry; partial completion; outbox dedupe |
| Sync | Offline edits; concurrent devices; clock skew; tombstones; expired cursor; partial batch retry |
| Commercial | Webhook duplicate/out-of-order/replay handling; cancellation; downgrade; server quota enforcement |
| Experience | Capture → monitor → review → decision → outcome; keyboard/back; empty/stale/offline/error paths |
| Accessibility | Screen-reader names/order; focus management; touch targets; contrast; zoom/text scaling; reduced motion |
| Operations | Restore drill; workload replay; budget threshold; provider outage; rollback |

Golden calculation fixtures must use independently known expected results, not mirror the implementation. Use explicit clocks and dates. Test important contracts and failure recovery rather than writing snapshot tests for every static style.

### 19.2 Definition of done by launch stage

**Personal production:** no known P0 correctness/data-loss defects; valid personal data source/import; complete persistent loop; data quality visible; backup restored successfully; no false background-service promise.

**Managed private beta:** authenticated ownership isolation; independent jobs; working sync/conflict UX; delivery preferences; measured load headroom; monitoring and incident runbooks; tested export/deletion; provider usage rights adequate for pilot.

**Paid public web:** signed applicable data agreements; operational recovery targets tested; billing reconciliation/cancellation; privacy/terms/support workflows; no unresolved release-blocking advisories; accessible core journeys; no misleading proof or synthetic market displays.

**Native:** all web gates plus actual device validation, deep links, secure sessions, push permissions/receipts, distribution requirements, and current commerce-policy review.

### 19.3 Performance budgets

Measure cold and warm launch separately on a representative midrange device and network. Initial web target: meaningful cached screen within two seconds on the agreed profile, interaction p95 under 200 ms after load, no main-thread scanner work, and smooth list scrolling under realistic account size.

Track bundle growth per release. The current exported web bundle is approximately 1.07 MB uncompressed. This is a build observation, not a transfer-size or real-device performance measurement.

## 20. Delivery roadmap and work sequencing

Effort bands below assume one experienced full-time engineer with periodic product/design review. They are planning ranges, not a commitment; provider procurement and user research can extend the calendar. Work in working vertical slices and keep the current product runnable.

| Phase | Indicative duration | Deliverable | Exit gate |
|---|---|---|---|
| P0 — Preservation and truth | 2–4 weeks | Baseline/repo, data backup, regression fixtures, calendar/gates/provenance fixes | Confirmed P0 defects closed |
| P1 — Reliable personal loop | 2–4 weeks | Real/imported data, canonical engine, durable local storage, immutable history, honest outcomes | One owner uses it for two weeks with successful restore |
| P2 — Focused product experience | 2–3 weeks, partly alongside P1 | Today/Watchlist/Recipes/Journal, working controls, accessible primitives, import/export | Usability and core-journey acceptance |
| P3A — Free personal release | ~1 week after P1/P2 | Local scheduler, stopped-service UX, quotas, backup guide | A0 acceptance and documentation |
| P3B — Managed private beta | 3–5 weeks | Auth/RLS, API/jobs, sync, outbox, digest, operations | 10–50 users; ownership/recovery/load gates |
| P4 — Paid web | 2–4 weeks plus procurement | Licensed scope or accurately limited workflow product, billing, support, policies | Paid-public gate and retention evidence |
| P5 — Growth and native | 4–8+ weeks after validation | Push/native release, richer research, plan expansion | Demand and cost justification |

Do not add the phase durations mechanically where work overlaps. An honest end-to-end paid web plan is roughly a multi-month effort, not a weekend production conversion.

### First ten implementation slices

1. Export/recover existing data without seed mutation.
2. Separate raw market observations from chart series.
3. Repair calendar and date-aligned features.
4. Enforce required gates and consistent risk truth.
5. Preserve recipe/evaluation/decision versions.
6. Implement bounded ingestion and truthful freshness.
7. Implement temporal alert dedupe/cooldown and a real review queue.
8. Complete stock actions, forms, routes, and outcome editing.
9. Move monitoring into a local worker, then managed scheduler.
10. Add sync and delivery with operational evidence.

Each slice should include implementation, contract-level validation, a small reviewable PR, updated limitations, and a demonstration of the user behavior it enables.

## 21. Operational runbooks

### Provider outage or stale data

Detect missing expected session coverage; pause new high-confidence evaluations on affected inputs; preserve last reliable data; show the outage and scope; retry within budget; record recovery. Do not swap in mock data. Backfill produces corrected history with explicit timestamps, not retrospective claims of timely alert delivery.

### Scheduler missed deadline

Check run ledger and lease state; determine whether input data is available; enqueue the same semantic job key; let dedupe prevent repeated transitions. Verify the resulting coverage and outbox counts. Notify operations if user-facing deadlines were missed.

### Incorrect calculation discovered

Disable the affected metric/rule version for new evaluations; preserve evidence; identify affected evaluations and alerts using version references; publish a corrected version; recompute in an auditable correction run; communicate material user impact through an approved support process. Never silently rewrite previous decisions.

### Storage quota or cost threshold

Stop optional backfills and discovery first; retain writes/exports; compact permitted recomputable caches; inspect retention and duplicate work; raise capacity only after cost review. Stop admitting new workloads if existing commitments cannot be met.

### Backup restoration

Restore to an isolated environment; validate schema and ownership; reconcile user record counts and referenced evidence; validate app reads/mutations; determine data-loss window; obtain the appropriate operational cutover decision; retain old state until reconciliation.

### Billing or email event failure

Retry idempotently; reconcile with the provider's authoritative state; preserve access within an explicitly defined grace period; do not charge twice or silently delete user research. Keep delivery suppression/bounce lists and unsubscribe preferences current.

### Incident and support

Capture impact, start time, affected versions/providers, mitigation, owner, next update, and recovery evidence. Use read-only aggregate diagnostics first. Access to a customer's private notes requires an explicit support need and consent workflow. Conduct a short post-incident review with an assigned preventive task.

## 22. Risks, decisions, and unresolved evidence

| Risk/question | Decision or mitigation | When it must be resolved |
|---|---|---|
| Provider rights cost exceeds early revenue | Start narrow; separate workflow value from licensed automation; quote exact usage | Before public automated feed |
| Research bundle parity is unknown | Obtain fixture outputs/provenance; maintain unverified status | Before displaying performance as validated |
| Current source has contradictory calculations | One engine and condition truth contract | Before personal production |
| User storage may already contain regenerated data | Preserve original bytes; flag unverifiable provenance; never reconstruct history as fact | During migration |
| Background promise depends on a sleeping computer | Free mode names that dependency; managed mode has jobs/watchdog | Before describing monitoring guarantees |
| Feature expansion obscures primary value | Prioritize capture/review/learning loop and measure completion | Every roadmap review |
| Single-developer capacity | Small slices, managed commodity services, no premature distributed architecture | Throughout |
| Free cloud limits change | Date-stamped vendor facts and measured admission caps | Monthly and before launch |
| Jurisdiction/data classification uncertain | Review actual target users, contract, product claims, privacy and payment setup | Before paid public release |
| Native/web differences | Device verification and isolated platform adapters | Before native beta |
| No live visual review in this session | Source-based UI findings are provisional; perform formal device/browser review | P2 exit |
| Directory migration disrupts delivery | Move one boundary at a time with characterization checks | During refactor |

### Deferred decisions

Choose the exact commercial data vendor after a written scope/price comparison; select the production worker runtime after a workload benchmark; decide account regions after target-market selection; finalize paid quotas/prices after the pilot; decide team functionality after research; decide native timing after web retention.

These are bounded decision gates. They do not block the correctness, data-model, UI foundation, and local recovery work already specified.

## 23. Current review evidence

| Check | Result on September 15, 2026 | Meaning |
|---|---|---|
| TypeScript | npm run typecheck passed | Types compile; no numerical correctness guarantee |
| Expo web export | Passed with dotenv loading disabled; 281 modules; ~1.07 MB bundle | Buildable web artifact; no visual certification |
| Expo compatibility check | Failed recommendation: installed 54.0.34, expected ~54.0.37 | Coordinate supported dependency upgrade |
| npm audit --omit=dev | 27 reported package findings: 2 critical, 16 high, 8 moderate, 1 low | Triage dependency paths/reachability; not 27 proven runtime exploits |
| Calendar fixture | Monday post-close returned 2026-09-12 | Confirmed session-date defect |
| Expression fixture | Actual price 220, normalized last point 100 → PRICE_NOW returned 100 | Confirms ambiguous input semantics |
| Warmup fixture | Five points → PRICE_AVG_200D returned 50 | Confirms insufficient-history fallback |
| Required-condition fixture | Failed eligibility plus other support → Attention Needed | Confirms missing gate |
| In-memory persistence fixture | Saved 220 → reloaded 195.12 with provider/non-mock labels retained | Confirms provenance corruption path |
| Credential hygiene check | No exact local-env-value/common-pattern matches in intended files or history | Limited check before private synchronization |
| UI automation | No browser/app surface available; native service startup failed | No screenshots, tap testing, or device QA claimed |
| Fresh GitHub clone | Clean npm ci, typecheck, and web export passed; all 62 baseline file hashes matched | Source/history synchronization independently verified |
| Existing automated tests/CI | No test script, test suite, or workflow found at baseline | Test architecture is proposed work |
| Commercial/live backend | No deployed service or database was validated | Production readiness is not claimed |

Correctness probes were isolated with synthetic data and in-memory storage; they did not change the owner's runtime data. Application source was reviewed and preserved, not repaired as part of this documentation deliverable.

## 24. Sources and maintenance

The codebase and existing documents are the primary source for current behavior. References above support external facts; architecture, quotas chosen for the pilot, proposed pricing, effort bands, and performance targets are design decisions or estimates.

Primary external sources checked include:

- [Supabase pricing](https://supabase.com/pricing) and [changelog](https://supabase.com/changelog)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Twelve Data business pricing](https://twelvedata.com/pricing-business) and [commercial-use terms guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
- [Alpha Vantage support](https://www.alphavantage.co/support/) and [terms](https://www.alphavantage.co/terms_of_service/)
- [SEC data APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [NYSE calendar](https://www.nyse.com/trade/hours-calendars)
- [Expo public environment variables](https://docs.expo.dev/guides/environment-variables/), [push FAQ](https://docs.expo.dev/push-notifications/faq/), and [push delivery](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Stripe payment pricing](https://stripe.com/pricing) and [Billing pricing](https://stripe.com/billing/pricing)
- [Resend pricing](https://resend.com/pricing)
- [Apple Developer enrollment](https://developer.apple.com/programs/enroll/)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

The Supabase changelog was also reviewed for relevant changes, including free-plan email customization and database/restore behavior. No Supabase schema or deployment was changed in this task.

Keep this file canonical in docs/production and refresh the iCloud delivery copy when publishing an updated document. Update the companion backlog when requirements are implemented, disproven, or superseded. Recheck prices, service limits, SDK compatibility, and policies before procurement and every public release.

Record material implementation decisions as short ADRs with problem, decision, alternatives, consequences, validation, and reversal conditions. Older numbered briefs remain historical context until deliberately reconciled; this production plan reflects the owner's latest expanded scope.

