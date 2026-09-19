# CHG-95 evidence — provider-neutral market-data ingestion and rights enforcement

Status: R1 BUILD / `codex/stockledger-prod-c08-market-data-rights-enforcement-fix-v1`

This document is an implementation and verification record. It is not evidence of a commercial agreement or a public/paid deployment.

## Source identity

- Protected-main base: `c290037e6de0079d47048850ee52f86800c8a992`
- Work branch: `codex/stockledger-prod-c08-market-data-rights-enforcement-fix-v1`
- R1 candidate carried forward: `3b6ca51a02194a736db6abd083a34aae810cec98` (implementation head `a062a9856f3148681d999bb6daff5d4f8778db66`).
- Rights-enforcement fix and evidence closeout commits are recorded in the final handoff and Fabric evidence ref.
- Node qualification: repository requirement is `>=22.23.2`; verification uses Node `22.23.2`.

## Changed scope

CHG-95 adds a provider-neutral, server/worker-only acquisition boundary for completed US-equity/ETF daily OHLCV. The normalized contract carries provider/product identity, dataset category, exact symbol, requested and observed ranges, UTC retrieval time, adjustment basis, request identity where safe, freshness/coverage, stable content and dataset identity, validation issues, failure class, and the rights-profile identity.

The rights contract is `stockledger-market-data-rights-v1`, revision 2, with the versioned authority model `stockledger-market-data-rights-authority-v1`. It is deny-by-default and evaluates these categories independently: `internal_computation`, `end_user_display`, `derived_metrics`, `notification`, `user_export`, and `raw_redistribution`. A production managed profile must be commercial, match the exact provider/product, carry the same non-secret evidence reference at profile and authority levels, explicitly state `executed-agreement`, and be effective and unexpired. Public comparison, research-only, internal-only, unverified, local-user, missing, expired, mismatched, unknown, and non-executed authority fail closed. Revision-1 or older profiles are rejected; they are never auto-upgraded. The reusable authority and decision model is in `src/lib/marketDataContract.ts`.

The ingestion contract is `stockledger-market-data-ingestion-v1`, revision 1. `server/worker/marketDataIngestion.ts` provides the adapter-neutral bounded acquisition/orchestration layer. SQLite worker schema version 7 adds durable `ingestion_runs` and `ingestion_items` tables additively. Stable run/item identities, capped concurrency, request budgets, deterministic capped retry/backoff, per-symbol status, and replay-safe accepted normalized results are retained across interruption/restart.

Validated provider results are threaded into the existing `RawBarRecord` → raw archive → snapshot/scanner/evaluation path. No second financial calculation engine was added. Provider use boundaries are independent: acquisition/processing requires `internal_computation`; provider-derived user-facing metrics/signals/snapshots require both `derived_metrics` and `end_user_display`; notification intents require `notification`; user-facing export requires `user_export`; raw bars/raw archives leaving the controlled runtime require `raw_redistribution` as well. A denied use is suppressed or blocked with a durable `rights_blocked:<use>:<reason>` record while unrelated local/user state is retained; no permission implies another and no successful delivery/display/export is fabricated. Internal worker backups remain complete; user-facing export uses the rights-aware filter.

Immutable provider provenance now includes the exact provider/product, profile ID, rights contract revision, authority model/state, safe evidence reference, per-use decision/reason, decision timestamps, and effective/expiry metadata. No secrets or contract documents are stored. Future managed actions re-evaluate current authority and use permission, so expiry and profile mismatch cannot be silently reused.

Existing local/user CSV input remains the complete offline path and is not labeled as commercially licensed data. Existing scheduler leases, job reconciliation, workspace revision commits, notification transport/delivery semantics, cloud boundary, and recovery contracts remain in place.

Stooq remains an explicit public/research-only adapter. Its profile is `stooq:public-daily-csv:research-only`; it cannot activate production managed ingestion. No commercial provider was selected or hard-coded.

Deferred capabilities remain explicit and are not synthesized: fundamentals, earnings/events/news, and intraday/real-time data. Reference identity and corporate-action adjustment/validation are represented as contract capability boundaries; no provider-specific corporate-action semantics are claimed.

## Safety and failure semantics

- Invalid/malformed, empty, stale, partial, missing-symbol, insufficient-history, unknown-adjustment, unsupported, outage, timeout, rate-limit, and budget-exhaustion conditions remain explicit.
- A partial batch preserves valid symbol items and records explicit failures for missing/invalid symbols. It cannot become a successful zero-match scan.
- Required benchmark/sector symbols for the current deterministic scanner include SPY, XLY, XLI, and XLK plus configured universe members; missing coverage remains partial/blocked.
- Raw archive, snapshot, feature, signal, scan-run, alert, and user-export boundaries retain provider/product, dates, retrieval, adjustment, coverage/freshness, content identity, validation, and immutable rights decision metadata when the managed contract supplies it.
- No credential, provider secret, or commercial adapter implementation is in Expo/client code. Client configuration remains limited to the existing public API URL boundary.

## Focused proof

`tests/marketDataIngestion.test.ts` proves:

1. The existing comparison-only commercial fixture is rejected by production authority; an unmistakably labeled synthetic executed-agreement fixture passes only explicitly allowed categories.
2. Missing evidence, non-executed/comparison authority, expired authority, provider/product mismatch, unknown permission, and old rights revisions fail closed; Stooq remains research-only.
3. Provider-derived normal state is suppressed when derived-metrics or end-user-display rights are denied, while internal computation and unrelated local state remain safe.
4. Notification denial blocks provider-derived notification intents with a durable reason; user export denial excludes provider content, and raw export independently requires raw redistribution.
5. Symbol/date/OHLCV/adjustment/retrieval validation and partial required-symbol coverage fail truthfully.
6. Rights blocking happens before provider calls; timeout retry, empty response, partial symbol failure, budget exhaustion, and explicit safe statuses are durable.
7. Completed items are not refetched on replay; stable identity changes with provider/product/adjustment changes; provenance retains exact rights identity.
8. A provider-backed worker call without a matching rights-bound contract is blocked, while the existing local worker path remains usable.
9. Fundamentals, events/news, and intraday/real-time remain deferred/unsupported.

Existing monitoring, financial-truth, worker, backup/recovery, sync, notification, browser, and boundary tests provide the retained regression surface.

## Public comparison evidence — procurement input only

The following is operator-supplied public comparison evidence checked 2026-09-18 CT. It is not an executed license, does not select a vendor, and is not rights authority. Exact derived, notification, export, and redistribution uses remain contract/terms dependent.

| Provider | Public comparison evidence | Rights caveat / status |
| --- | --- | --- |
| Massive | Stocks Business public pricing shows `$2,499/month` and advertises business/commercial display rights. Financials & Ratios business add-on shows `$699/month`. [Business](https://massive.com/business) · [Market Data Terms](https://massive.com/legal/market-data-terms-of-service) | Derived/notification/export/redistribution use remains contract/terms dependent. Provider selection remains **UNSELECTED**. |
| Twelve Data | Venture shows `$499/month` or `$4,990/year`; Enterprise shows `$1,099/month` or `$10,992/year`. Venture advertises external display; Enterprise advertises external distribution. [Business pricing](https://twelvedata.com/pricing-business) · [Commercial and personal usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) | Redistribution requires a separate agreement/add-on and exchange-specific approvals may apply. No executed evidence is recorded. |
| Tiingo | Public commercial/internal tier shows `$50/month` and internal-use only. EOD + IEX display-redistribution product shows `$250/month` startup and `$500/month` enterprise. [Pricing](https://www.tiingo.com/about/pricing) · [Terms](https://api.tiingo.com/tos/) · [IEX API](https://www.tiingo.com/products/iex-api) | Redistribution requires special permission/additional fees. No executed evidence is recorded. |
| Intrinio | Startup shows `$333/month` for the first six months, `$666/month` for the next six, then `$999/month`; Enterprise shows `$1,250/month+`. [Pricing](https://intrinio.com/pricing) · [Terms](https://about.intrinio.com/terms) | Startup advertises commercial use/display, but display/redistribution/commercialization scope is controlled by an executed Order Form. No executed evidence is recorded. |

Procurement outcome: **UNSELECTED**. StockLedger has **NO executed commercial market-data license** in this run. A personal, free, trial, research-only, or internal-only entitlement cannot satisfy this launch gate.

## Verification ledger

Commands are run from the worktree with Node 22.23.2. Results are recorded at closeout:

- `npm ci`: passed under Node `22.23.2`; lockfile install reported 0 audit findings.
- `npm run typecheck`: passed under Node `22.23.2`.
- Focused CHG-95 and retained provider/financial-truth/worker tests: passed; 14 CHG-95 tests and 91 focused worker/monitoring/notification/repository/sync tests passed at the current verification point.
- Full `npm test -- --run`: passed; 18 files / 175 tests.
- `npm run benchmark:worker`: passed; synthetic 100 stocks × 260 sessions, 4,751 ms, 100 evaluations, 200 scanner rows, 12,591,808 bytes SQLite/WAL, 5,813,608 bytes workspace, RSS 229,998,592 bytes, 1,795,250 ms remaining headroom, integrity `true`, within the 30-minute engineering budget. This is one local synthetic measurement, not a capacity/SLA claim.
- `npm run check:boundaries`: passed.
- `npm run check:frozen`: passed structural validation; existing status remains `blocked_unverified` / release-blocked for missing independent numeric golden outputs, survivorship bias, unavailable point-in-time membership, and required forward proof.
- `npm run export:all`: passed for web, iOS, and Android bundle export. This is bundle validation, not native-device QA or deployment.
- `npm run test:e2e`: passed; 16 browser journeys across desktop and mobile emulation.
- `npm audit --audit-level=high`: passed; 0 vulnerabilities.
- `git diff --check`: passed.
- Cloud/Supabase tests: not in scope; no cloud contract or migration was changed.

## Retained external gates and non-claims

This run does not claim an executed vendor contract, licensed production feed, real paid/public deployment, external redistribution rights, fundamentals/events coverage, real-time coverage, hosted scheduler, provider SLA, billing/entitlement lifecycle, or real users/recipients. The local worker still requires an operator-supplied authorized CSV path unless a future provider is separately selected, contracted, configured server-side, and verified against this contract.
