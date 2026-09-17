# Optional managed sync pilot

This mode adds personal sync to the local workspace. It is not an operated market-data or paid service. Both public cloud variables may remain blank.

## Implemented contract

- Password sign-in/sign-up through Supabase Auth. Native sessions use OS SecureStore; browser sessions use device storage. Workspace adoption is explicit; sample data cannot upload.
- Owner-keyed `ledger_records`, direct authenticated SELECT only, ownership RLS, no anonymous table access or direct client mutation.
- `apply_ledger_batch` derives identity from Auth, checks expected revisions and limits, serializes each owner's writes, and commits records/change metadata/retry receipts atomically.
- Published recipe definitions/evaluation payloads cannot be overwritten; retirement metadata is allowed. Deletes use tombstones.
- Sync includes personal stocks, recipes, metrics, Eyes, alerts, decisions, outcomes, evaluations and signal review notes. OHLCV archives, scanner datasets and snapshots remain local. Derived evidence still requires appropriate contractual/privacy treatment.
- Independent edits merge. Conflicts require a per-record choice and a backup export; choices are bound to the exact contents shown. Newer edits prompt again.
- A durable local merge precedes baseline acknowledgement. Changes made locally during a request are preserved and cause a retry. Baselines are scoped to endpoint/user/workspace; restore requires adoption again.

Pilot bounds: **500 records / 5 MiB per batch; 256 KiB per payload; 5,000 records / 20 MiB per owner; 60 new mutations/hour**. Receipts retain at most 200 requests and at most 30 days; stale revisions remain rejected after eviction. Change metadata keeps at most 10,000 rows/owner. These are resource bounds, not paid plans. The pilot reads full owner records in 500-row pages; cursor/snapshot sync remains future work.

## Local integration

Use the pinned CLI. Never link/reset an unrelated project.

```sh
npx supabase start --help
npx supabase start -x studio,edge-runtime,logflare,vector,supavisor,imgproxy,realtime,storage-api
npm run test:cloud
npx supabase stop --no-backup
```

Ports are 5542x. The integration script reads CLI status internally, restricts itself to loopback, creates two disposable local accounts and checks Auth/PostgREST/RPC/ownership. It does not print keys or connect to a hosted account. Unit tests also run the migration against embedded PostgreSQL with minimal Auth-role fixtures.

Docker startup/listing was unresponsive on the implementation Mac. Its standalone PostgreSQL package also lacked support-file paths. Neither global installation was changed. Embedded SQL works locally; GitHub CI supplies a separate full-stack integration job. The recorded result in implementation status is authoritative.

## Deployment sequence

1. Select a dedicated StockLedger project and region. Existing unrelated connected projects are not targets. Free/paid project selection belongs to the operator; no paid service was activated.
2. Separate staging/production refs. Review the migration, run integration tests, database lint and Supabase security/performance advisors before deployment. Consult the pinned CLI's `link`, `db push`, and `db lint` help. Never reset production.
3. Enable hosted email confirmation; minimum password length 12; configure SMTP, exact redirect/site URLs, abuse controls and operator MFA. Local configuration intentionally disables email confirmation for tests.
4. Set only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the client build. Keep service-role, DB, payment and provider credentials server-side. HTTPS is required except on loopback.
5. Build the reviewed commit:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY npm run export:web
```

6. Serve `dist/` on HTTPS with cache-busted JS and short/no-cache HTML. Test a CSP against the actual emitted Expo artifact and required Supabase endpoints. Use a dedicated app origin without third-party scripts because browser sessions use device storage.
7. Test two real pilot accounts: adoption, sign-out, conflicts, interrupted sync, stale sessions, export, local storage failure and cross-device retrieval. Cloud-imported stocks have unavailable local prices until observations are supplied on that device.

## Before external users or charges

Still unimplemented: complete password recovery/device-session management, self-service account deletion/backup expiry, managed ingestion/scheduling/notification delivery, checkout/portal/entitlements/webhooks/reconciliation, and support/admin projections. These are code and operational work, not just missing variables.

Also required: actual hosting/project/domain, authorized data rights, email setup, privacy/retention terms, pilot usage and unit economics, restore/load drills, and native signing/device/store QA if distributing native clients. Do not represent this candidate as paid-launch ready.

CHG-92 adds a provider-independent managed execution entry point and a versioned durable job contract, but no managed hosting target, credentials, scheduler installation, or hosted execution evidence exists in this repository. Provisioning and exercising a hosted cron/job platform is an explicit external gate. The local no-subscription path is documented in `docs/operations/LOCAL_WORKER.md`; it depends on an awake operator-owned machine and does not imply hosted availability.

Upstream references: [local development](https://supabase.com/docs/guides/local-development), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
