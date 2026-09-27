# CHG-273 final integrated-main personal handoff qualification

- Project: `stockledger`
- Request: `stockledger-prod-c19-final-integrated-main-personal-handoff-verify-v5`
- Fabric job: `CF-e09132542fe4be3c2092f7e2`
- Operation: VERIFY, no Product/source mutation
- Exact protected main and tested subject: `3934e4cd9f45ee911e0d05e623ad10156cbf0282`
- Exact tree: `dccf00667a9fa73e58525e564e379d328ae82843`
- Source delta since pre-CHG-273 main `1d3fc085b54b5002342982cc9c15ccc32bf086ba`: only `tests/worker.test.ts` and `tests/e2e/worker-app-handoff.spec.ts`; all other tracked files byte-identical.

## Disposition

**OWNER_SETUP_REQUIRED.** Product behavior and exact-tree evidence are ready for owner handoff audit. Real owner workspace/watchlist, permitted daily-bar input, machine paths/runtime and private backup cadence were not supplied to this verification and are required before live monitoring/safe durable use. This is owner setup, not a Product defect.

## Qualification results

- Requirement matrix: 31 requirements; 15 PASS, 7 OWNER_CONFIGURATION_REQUIRED, 9 NOT_APPLICABLE; zero material product/evidence gaps.
- `npm ci` used Node 22.23.2; 639 packages installed; no audit vulnerabilities.
- `npm run check`: TypeScript and 216 tests passed. Focused worker-handoff: 6 passed; worker: 28 passed.
- `npm run test:e2e` with `CI=1`: 89 passed, one existing mobile keyboard-only skip. Desktop/mobile handoff journeys, ordinary current-time fixture, and explicit 48-hour stale case passed.
- Boundary, dependency audit, workflow check, all-platform export, isolated cloud contract, recovery drill, operations qualification/status, and source-bound release evidence/verify passed.
- Supplemental synthetic backup/export verification preserved worker SQLite handoff batch/sequence, job/outbox, app handoff evidence, authored decision/amendment/outcome, evaluation and alerts.
- Exact-tree GitHub Release checks run 36328472547 passed `app`, `cloud-contract`, and `operations`; run head `3387151e14bad81bfa07c82eb6ec39f106408580` has the exact main tree `dccf00667a9fa73e58525e564e379d328ae82843`.
- UI authority is current by byte-equivalence to CHG-202/CHG-256 evidence plus current Playwright. No visual capture was repeated for test-only CHG-273 changes.

## Owner boundary

The verification used labeled synthetic/local fixtures and an isolated empty operations DB. It did not inspect or invent an owner workspace, watchlist, provider authorization, actual local paths, scheduler, machine uptime, backup destination or SMTP settings. Today/Alerts is sufficient; SMTP is optional. The detailed impact for each owner prerequisite is in `owner-path.json`.

## Publication boundary

The artifact commit is evidence-only and will have `3934e4cd9f45ee911e0d05e623ad10156cbf0282` as its sole parent. The normal Fabric evidence ref is `refs/heads/codex-fabric/evidence/stockledger/stockledger-prod-c19-final-integrated-main-personal-handoff-verify-v5`, with canonical `.codex-fabric/audit.json`. Fabric job `CF-e09132542fe4be3c2092f7e2` is RUNNING while this task is executing; its normal publisher accepts terminal jobs, so evidence-ref readback is deferred until job terminalization.
