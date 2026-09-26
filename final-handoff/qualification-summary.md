# StockLedger personal handoff qualification

Request: stockledger-prod-c19-final-personal-handoff-qualification-verify-v1
Subject: main 1d3fc085b54b5002342982cc9c15ccc32bf086ba; tree b0013584a69ed47bd7eb1c7d331bddc773f57c6c
Operation: VERIFY; no Product source/test/docs/config/dependency/lockfile/CI/runtime edits; zero Product commits.

## Recommended disposition

FIX_REQUIRED. The deterministic personal path and exact-tree CI checks passed, but a material test-isolation defect prevents owner handoff audit. tests/worker.test.ts launches the CLI with temporary DB/CSV/export files while omitting --handoff-dir. The CLI defaults to .local/stockledger-app-handoff and atomically renames its synthetic pending.json over the destination. npm run check executes this test. This can replace real owner pending evidence when checks run in the same repository. The directory exists here; its contents and pre-run state were not inspected, so actual owner-data loss is not asserted. No Product fix was applied.

## Qualification evidence

- Exact main is PR #28's merge of the exact prior main and CHG-256 Accepted Head; merge tree equals accepted candidate tree. Main stayed unchanged at readback.
- Node v22.23.2 used. npm ci, boundary/audit/workflow checks, all-platform export, full Playwright (89 passed, one existing skip), six focused worker handoff tests, recovery drill, operations qualification/status, and source-bound release evidence/verify passed.
- Local npm run check twice timed out one notification retry test at its unchanged 5-second limit (215/216 each time). The same test passed alone in 2.12 seconds; exact-tree PR #28 app job passed npm run check. The local full-suite outcome is recorded as failure, not called a local pass.
- Local npm run test:cloud was unavailable because the configured OrbStack Docker socket was absent. PR #28's exact-tree cloud-contract job ran isolated Supabase and passed; it supports only that cloud-contract claim.
- Deterministic fixtures cover the app-closed CSV worker path, explicit adjustment, handoff/replay, context in Today/Alerts/Journal, decision retention, stale/partial/missed/conflict/recovery, export/restore and bounded operations. Browser directory access uses a test adapter, not native device evidence.
- No actual owner watchlist/source, schedule, awake-machine state, SMTP destination, delivery, or human read was supplied/asserted. See matrix and residual boundaries.
- CHG-202 Golden UI v3 is reused only for unchanged rendered dependencies; CHG-256 R2/R3 covers Today/Alerts/Settings handoff states on this exact tree. Current E2E passed those browser journeys.
- Supplied Project OS queue context has no known personal-scope Open/Design Change and only CHG-98 commerce/privacy/support and CHG-99 native distribution require attention; both are NOT_APPLICABLE. No Notion change was made.

## Owner setup

Live monitoring also needs the owner's real workspace/watchlist, a permitted and regularly updated completed-daily-bar path with adjustment/provenance, Node 22.23.2, private SQLite and handoff paths, and (for unattended mode only) an owner schedule, awake machine and readable data path. SMTP is optional; Today/Alerts is sufficient. Independent audit/acceptance remains pending.