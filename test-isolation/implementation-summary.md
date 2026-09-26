# CHG-273 R2 — worker CLI test handoff isolation

## Repair

The managed app-closed CLI test now gives the worker a `handoff` directory inside its existing `mkdtemp` directory and passes that path through `--handoff-dir`. The child CLI runs with the temporary directory as its current working directory, and both `tsx` and `server/worker/cli.ts` are passed as absolute paths.

The fixture uses the explicit workspace ID `stockledger-cli-fixture`. The test asserts that the temporary `pending.json` exists, parses it with `parseWorkerHandoffManifest`, and checks that its workspace ID matches the fixture. Existing managed-mode, `schedulerInstalled:false`, output, and scoped cleanup assertions remain in place.

No runtime Product source or CLI default changed. The candidate changes only `tests/worker.test.ts`.

## Candidate

- Base: `1d3fc085b54b5002342982cc9c15ccc32bf086ba`
- Candidate: `3e94a3d201b9147a5ecb3c4282cc25a4e6d99670`
- Candidate tree: `e5de003bc445672748b10b4aebf45be5e58bda02`
- Candidate parent: `1d3fc085b54b5002342982cc9c15ccc32bf086ba`
- Changed path: `tests/worker.test.ts`

## Verification

Node `v22.23.2` was used. `npm ci`, the focused worker test file (28 tests), `npm run check` (typecheck and 216 tests), `npm run check:boundaries`, and `git diff --check` passed. The repository-root `.local/stockledger-app-handoff` path was absent before qualification, after the focused test, and after the full check. The known notification retry timeout did not occur.
