# CHG-273 R4 E2E fixture time repair

Status: `FIX_COMPLETE_AWAITING_INDEPENDENT_AUDIT`

## Identity and source

- Fabric job: `CF-f4e5f0b36bef0af3c7318e2b`
- Repository/project: `kimhw8084/stockledger` / `stockledger`
- Change/operation/request: `CHG-273` / `FIX` / `stockledger-prod-c19-worker-handoff-e2e-time-fixture-fix-v4`
- Protected base and unchanged `main`: `1d3fc085b54b5002342982cc9c15ccc32bf086ba`
- Accepted predecessor: `3e94a3d201b9147a5ecb3c4282cc25a4e6d99670` (tree `e5de003bc445672748b10b4aebf45be5e58bda02`)
- Final candidate: `3387151e14bad81bfa07c82eb6ec39f106408580` (tree `dccf00667a9fa73e58525e564e379d328ae82843`)
- Work branch: `codex/stockledger-prod-c19-worker-handoff-e2e-time-fixture-fix-v4`

The final candidate is exactly one commit on the accepted predecessor. Its R4 diff is only `tests/e2e/worker-app-handoff.spec.ts`. Its complete diff from protected base contains only `tests/worker.test.ts` (the accepted R2 isolation repair) and `tests/e2e/worker-app-handoff.spec.ts` (the R4 fixture repair).

## Repair

`makeManifest()` now defaults its single `at` value to `new Date().toISOString()` when the manifest is created. That value still populates both `generatedAt` and `scheduler.lastSuccessfulRunAtUtc`. `options.generatedAt` remains an explicit override. The stale-state test's fixed `2026-09-20T00:00:00.000Z` override remains unchanged, as do missed and partial coverage and precedence checks.

No runtime Product source changed. The runtime 48-hour stale threshold and status ordering remain untouched.

## Qualification

All commands used Node `22.23.2` and npm `10.8.2`.

- `npm ci`: PASS; 639 packages added, zero vulnerabilities reported.
- `npm run export:all`: PASS for web, iOS, and Android before Playwright.
- Targeted handoff journey with `CI=1`: desktop PASS 3/3 sequential runs; mobile PASS 3/3 sequential runs. Every run passed without using a retry.
- Combined targeted desktop+mobile invocation with normal CI configuration/retries: PASS, 2/2 on the first attempt.
- Full `CI=1 npm run test:e2e`: PASS, 89 passed and the existing intentional mobile keyboard-flow skip preserved (90 total).
- `npm run check`: PASS; typecheck and 216 unit tests passed.
- `npm run check:boundaries`: PASS.
- `npm audit --audit-level=high`: PASS; zero vulnerabilities.
- `git diff --check`: PASS.

The targeted journey retained its strong assertions: the ordinary fixture shows “Worker evidence applied to this workspace”, persists `lastAppliedSequence`, writes the sequence ACK, returns focus to the worker-folder control, and produces no page errors. The explicit old timestamp still shows “Worker handoff is older than 48 hours”. Missed and partial states also passed in the same journey.

See `verification.json`, `source-impact.json`, and `time-controls.json` for the detailed receipts and scope proof.
