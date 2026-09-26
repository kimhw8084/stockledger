# StockLedger CHG-256 personal handoff gap audit

**Disposition: FIX_REQUIRED.** Current source is 9331b8850dc674e55181447a7bd5963059fd3649 (tree b3cbaaa0698522e9ab19d6fb8558a263101a05f7), Product version 0.2.0. No Product source, tests, configuration, documentation, dependency/lockfile, CI, or runtime changes were made; Product commits and Product changed files are both zero.

## Decisive finding

The shared financial engine, dated data contracts, recipe and evaluation history, app review surfaces, local SQLite worker, notification lifecycle, backup/recovery and bounded operations checks are implemented and locally verified. The worker can run while the Expo UI is closed when invoked by an owner-installed schedule on an awake machine with authorized CSV input.

The worker persists to SQLite and writes a complete JSON workspace export. The web app persists separately in IndexedDB and shows only an imported last-known worker status. Scheduled worker evaluations do not appear in Today/Alerts/Journal when the owner opens the app until the owner finds and imports that whole-workspace export. Editing the app then requires the reverse export/import with a matching worker revision, a paused schedule and a before-import worker copy. Repeating that state shuttle for routine monitoring makes the promised review-when-it-matters path materially too cumbersome for a finished personal product.

A configured SMTP endpoint can send optional notices, but it is not a substitute for the app review context. Provider acceptance is not delivery, and no external service or actual recipient was tested. The smallest next repair is a revision/content-bound local worker update handoff that exposes new evidence in Today while preserving app decisions and history.

## Owner inputs and boundaries

Real watchlist data, provider-authorized CSV files, adjustment declarations, Node 22.23.2, an externally installed launchd/cron schedule and an awake machine are configuration/owner inputs. Email is optional configuration. The synthetic empty-worker status correctly says schedulerInstalled false and requires an awake machine and authorized path. Stooq remains research-only and does not qualify trusted automated monitoring.

Paid/public/native/multi-user/hosted and broad-scanner requirements are out of this personal web/local handoff scope. No automatic trading, custody, return guarantee or maximum-profit claim is made.

## Verification

At Node 22.23.2, npm ci, typecheck plus all 209 tests across 26 files, client-boundary checks, high-severity npm audit (0 vulnerabilities), release-workflow validation, all-platform export, recovery drill, operations qualification, operations status, and same-source release evidence generation/verification passed. The browser suite initially had one 45-second timeout while locating a Settings control; its isolated rerun passed and the complete rerun passed 87 tests with one intentional mobile-keyboard skip.

Recovery/operations results use synthetic inputs and are engineering evidence only. No owner data, scheduler, provider, SMTP recipient, hosted service or native device was fabricated or qualified. Current tree equals Golden UI v3 accepted tree, so its visual authority is reusable for unchanged source; no duplicate visual capture was run. A future fix affecting Today/Settings needs fresh captures and task/focus/reflow/localization verification.

## Documentation drift

README points owners to IMPLEMENTATION_STATUS as current verified scope. That document still records a September 16-era source/evidence baseline, engine 2.0.0 and 61 tests/11 files, while current source is later, engine 2.1.0, and this run passed 209 tests/26 files. Current local-worker and release runbooks give more current operational boundaries. The owner impact of the stale status authority is UNPROVEN; no documentation change was made.
