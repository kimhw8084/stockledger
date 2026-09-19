# CHG-95 evidence — provider-neutral market-data ingestion foundation

Status: R1 BUILD / `prod-c08-market-data-ingestion-foundation-v1`

This document is an implementation and verification record. It is not evidence of a commercial agreement or a public/paid deployment.

## Source identity

- Protected-main base: `c290037e6de0079d47048850ee52f86800c8a992`
- Work branch: `codex/stockledger-prod-c08-market-data-ingestion-foundation-v1`
- Final implementation candidate: recorded below after the runtime/tests/docs candidate commit; the evidence closeout commit is recorded in the final handoff.
- Node qualification: repository requirement is `>=22.23.2`; verification uses Node `22.23.2`.

## Changed scope

CHG-95 adds a provider-neutral, server/worker-only acquisition boundary for completed US-equity/ETF daily OHLCV. The normalized contract carries provider/product identity, dataset category, exact symbol, requested and observed ranges, UTC retrieval time, adjustment basis, request identity where safe, freshness/coverage, stable content and dataset identity, validation issues, failure class, and the rights-profile identity.

The rights contract is `stockledger-market-data-rights-v1`, revision 1. It is deny-by-default and evaluates these categories independently: `internal_computation`, `end_user_display`, `derived_metrics`, `notification`, `user_export`, and `raw_redistribution`. Production managed acquisition requires a matching `commercial` profile with explicit permission; missing, unknown, expired, mismatched, research-only, or non-commercial profiles fail closed. The reusable authority is in `src/lib/marketDataContract.ts`.

The ingestion contract is `stockledger-market-data-ingestion-v1`, revision 1. `server/worker/marketDataIngestion.ts` provides the adapter-neutral bounded acquisition/orchestration layer. SQLite worker schema version 7 adds durable `ingestion_runs` and `ingestion_items` tables additively. Stable run/item identities, capped concurrency, request budgets, deterministic capped retry/backoff, per-symbol status, and replay-safe accepted normalized results are retained across interruption/restart.

Validated provider results are threaded into the existing `RawBarRecord` → raw archive → snapshot/scanner/evaluation path. No second financial calculation engine was added. Existing local/user CSV input remains the complete offline path and is not labeled as commercially licensed data. Existing scheduler leases, job reconciliation, workspace revision commits, notification intent semantics, cloud boundary, recovery, and backup/export contracts remain in place.

Stooq remains an explicit public/research-only adapter. Its profile is `stooq:public-daily-csv:research-only`; it cannot activate production managed ingestion. No commercial provider was selected or hard-coded.

Deferred capabilities remain explicit and are not synthesized: fundamentals, earnings/events/news, and intraday/real-time data. Reference identity and corporate-action adjustment/validation are represented as contract capability boundaries; no provider-specific corporate-action semantics are claimed.

## Safety and failure semantics

- Invalid/malformed, empty, stale, partial, missing-symbol, insufficient-history, unknown-adjustment, unsupported, outage, timeout, rate-limit, and budget-exhaustion conditions remain explicit.
- A partial batch preserves valid symbol items and records explicit failures for missing/invalid symbols. It cannot become a successful zero-match scan.
- Required benchmark/sector symbols for the current deterministic scanner include SPY, XLY, XLI, and XLK plus configured universe members; missing coverage remains partial/blocked.
- Raw archive and snapshot provenance retain provider/product, dates, retrieval, adjustment, coverage/freshness, content identity, validation, and rights-profile metadata when the managed contract supplies it.
- No credential, provider secret, or commercial adapter implementation is in Expo/client code. Client configuration remains limited to the existing public API URL boundary.

## Focused proof

`tests/marketDataIngestion.test.ts` proves:

1. Missing/unknown rights and research-only Stooq block production managed use while the local-user boundary remains available.
2. Display permission does not imply notification, export, or raw redistribution permission.
3. Symbol/date/OHLCV/adjustment/retrieval validation and partial required-symbol coverage fail truthfully.
4. Rights blocking happens before provider calls; timeout retry, empty response, partial symbol failure, budget exhaustion, and explicit safe statuses are durable.
5. Completed items are not refetched on replay; stable identity changes with provider/product/adjustment changes.
6. A provider-backed worker call without a matching rights-bound contract is blocked, while the existing local worker path remains usable.
7. Fundamentals remain deferred/unsupported.

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

- `npm ci`: passed; lockfile install reported 0 audit findings at install time.
- `npm run typecheck`: passed under Node `22.23.2`.
- Focused CHG-95 and retained provider/financial-truth/worker tests: passed; 9 CHG-95 tests and 37 focused retained-worker/provider tests passed.
- Full `npm test -- --run`: passed; 18 files / 170 tests.
- `npm run benchmark:worker`: passed; synthetic 100 stocks × 260 sessions, 5,260 ms, 100 evaluations, 200 scanner rows, 12,591,808 bytes SQLite/WAL, 5,813,608 bytes workspace, RSS 223,100,928 bytes, integrity `true`, within the 30-minute engineering budget. This is one local synthetic measurement, not a capacity/SLA claim.
- `npm run check:boundaries`: passed.
- `npm run check:frozen`: passed structural validation; existing status remains `blocked_unverified` / release-blocked for missing independent numeric golden outputs, survivorship bias, unavailable point-in-time membership, and required forward proof.
- `npm run export:all`: passed for web, iOS, and Android bundle export. This is bundle validation, not native-device QA or deployment.
- `npm run test:e2e`: passed; 16 browser journeys across desktop and mobile emulation.
- `npm audit --audit-level=high`: passed; 0 vulnerabilities.
- `git diff --check`: passed.
- Cloud/Supabase tests: not in scope; no cloud contract or migration was changed.

## Retained external gates and non-claims

This run does not claim an executed vendor contract, licensed production feed, real paid/public deployment, external redistribution rights, fundamentals/events coverage, real-time coverage, hosted scheduler, provider SLA, billing/entitlement lifecycle, or real users/recipients. The local worker still requires an operator-supplied authorized CSV path unless a future provider is separately selected, contracted, configured server-side, and verified against this contract.
