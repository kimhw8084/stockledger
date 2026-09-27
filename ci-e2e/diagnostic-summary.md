# CHG-273 R3 worker app handoff E2E diagnosis

Classification: CANDIDATE_INDEPENDENT_HARNESS_FLAKE
Candidate: 3e94a3d201b9147a5ecb3c4282cc25a4e6d99670 (tree e5de003bc445672748b10b4aebf45be5e58bda02)
Protected base: 1d3fc085b54b5002342982cc9c15ccc32bf086ba
Fabric job: CF-23eda07a989f8d1f1de381f3

## Finding

The accepted candidate changes only tests/worker.test.ts (9 additions, 3 deletions). The E2E test and application/runtime, export-server, Playwright, Node, and dependency-lock files are unchanged by exact base/candidate blob hashes.

The unchanged makeManifest() helper fixes generatedAt and scheduler.lastSuccessfulRunAtUtc to 2026-09-25T02:00:00Z. CI ran over 48 hours later. The unchanged worker handoff domain intentionally gives old manifests a stale status even after a new batch applies. The test waits for the exact applied label, so that label never appears.

An instrumented replay of the same adapter applied and acknowledged sequence 1 in 131 ms (desktop) and 121 ms (mobile). Permission was granted; pending.json was read; the mocked IDB success handler was registered before its queued microtask fired; the workspace reached sequence 1; ack sequence 1 was written; and focus returned to the folder button. The pending localStorage key remains because the adapter models pending.json and ack.json separately. No replay page or console errors, conflict, or rejection occurred.

## Reproduction

Node 22.23.2 / npm 10.9.8. npm ci passed. npm run export:all was required because the preview server serves dist/. Desktop, mobile, and combined targeted invocations failed at the same assertion on the first attempt and normal retry. GitHub run 36289183109 also failed both profiles on both attempts (87 passed, 2 failed, 1 skipped). The local full E2E suite was not rerun because the targeted runs were not green.

Two initial local commands before export were setup failures only: webServer readiness timed out because dist/ did not exist after npm ci; no E2E test started.

## Smallest future repair

Make the ordinary E2E manifest fixture's last-success timestamp relative to execution time, while retaining explicit old timestamps for stale-manifest cases. No source changes were made during this verification.
