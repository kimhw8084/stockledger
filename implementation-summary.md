# CHG-256 R2 — Worker to app review handoff

## Repair

StockLedger now transfers bounded, append-only evaluation evidence from the local SQLite worker into the web app’s existing IndexedDB workspace through a private owner-selected folder. The worker publishes `pending.json`; the web app reads it when opened, saves through its revision compare-and-set path, and then writes an idempotent `ack.json`. The next worker invocation consumes the receipt and retires acknowledged batches. Normal worker cycles no longer need a whole-workspace export/import.

The batch preserves the worker’s evaluation ID/time, session, source snapshot, provenance, freshness and quality, exact recipe/version, custom metric definitions, condition results, and alert context. Replays add no duplicate evidence. The app preserves decisions, amendments, outcomes, notes, alert review/snooze/usefulness state, and other owner history. An overlapping Eye, stock, recipe, or referenced metric edit becomes an explicit conflict.

Before state changes, app persistence retains the last valid workspace copy, including a valid empty baseline for the first save. Invalid or incomplete manifests do not mutate app data. A failed receipt write is safe to retry after the app commit.

## Owner boundary

The owner chooses the same private folder once in web Settings. The browser stores the granted directory handle locally, reads only `pending.json`, and writes only `ack.json`; permission can be re-requested when the browser suspends it. No local network listener is opened. The bridge is web-browser-only. A scheduler remains owner-installed and requires an awake machine and readable authorized daily CSV data. No scheduler, hosted service, SMTP recipient, email delivery, or real owner data was installed or claimed.

## Candidate and evidence

- Protected base: `9331b8850dc674e55181447a7bd5963059fd3649`
- Candidate: `3a76d78663b555392cd152977bb2f9c5cd91a79f`
- Candidate tree: `b0013584a69ed47bd7eb1c7d331bddc773f57c6c`
- Product source changes: 25 files
- Worker database advances additively to schema 8; workspace/export schema remains 2.
- `verification.json` records commands, results, browser rerun flakiness, and release verification.
- `ui/` contains desktop/mobile state captures and the authentic Chrome 200% tab-zoom capture.
- `release-evidence.json` binds the exact candidate/base/tree and UI image hashes.

This package verifies the local personal-use handoff path. It does not certify hosted scheduling, commercial market-data rights, external delivery, native-device behavior, whole-product visual quality, or production availability.
