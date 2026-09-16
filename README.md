# StockLedger

A local investment research workspace: keep a watchlist and thesis, monitor explicit recipe conditions, review alerts, and preserve decisions and lessons.

**0.2.0 is a local-first beta candidate.** It includes a runnable SQLite worker and an optional Supabase sync pilot. It is not a deployed commercial service. Billing, commercial feeds, managed notification delivery, and store releases remain gated. See [implementation status](docs/production/IMPLEMENTATION_STATUS.md) for verified scope and remaining work.

## Run

Use Node **22.23.2**; `.nvmrc` pins the tested runtime. Expo 57 uses React 19.2 and React Native 0.86.

```sh
nvm use
npm ci
npm run web
```

The personal workspace starts empty. Add a stock or import a watchlist CSV from Settings, add starter recipes, attach a monitoring Eye, and import daily prices. Sample data loads only after choosing **Explore sample workspace**. Sample workspaces are labelled and cannot sync to a personal cloud account.

Export complete JSON backups from Settings. Imports are validated, and the preceding saved workspace is retained. File imports accept JSON up to 100 MB and CSV up to 20 MB. Browser storage uses IndexedDB; native storage uses SQLite; both reject stale concurrent writes. Keep independent backups because browser/device storage can be removed by the OS or owner. Long-running raw archives need the planned retention/streaming work before exceeding this beta's import and memory bounds.

## Check and preview

```sh
npm run check
npm run check:boundaries
npm audit --audit-level=high
npm run export:all
npx playwright install chromium
npm run test:e2e
npm run preview
```

Preview is local-only at `http://127.0.0.1:43187`. Use `export:web` for only a browser artifact. Exports omit `.env` loading intentionally; pass reviewed public build variables explicitly for cloud builds. Never put private keys in `EXPO_PUBLIC_*`. Use this workspace's RTK wrapper around commands where required.

## Operating paths

- **No new service subscription:** local workspace, user-supplied CSV data, JSON backups, review reports and the independent local worker. No Supabase account is required. See [local worker operations](docs/operations/LOCAL_WORKER.md).
- **Managed pilot:** the same domain engine and local workspace, with optional authenticated personal sync. See [cloud deployment](docs/operations/CLOUD_DEPLOYMENT.md). A production project, hosting, email and authorized data sources must be configured before customers are invited.

Daily prices require `Date,Open,High,Low,Close,Volume` columns and consecutive NYSE sessions. Long metrics require their full warmup. Unknown or unadjusted histories stay partial. The calendar covers **2024–2028**. The optional Stooq adapter is on demand; unverified adjustment metadata prevents trusted automated signals. Fetching a file does not establish commercial redistribution rights.

## Organization

```text
App.tsx                    Safe area and application error boundary
src/app/                   Screen composition and extracted styles
src/components/            Shared UI and feature presentations
src/features/              Workspace, journal and cloud-sync workflows
src/domain/                Validation, arithmetic, history, hashes and chart data
src/hooks/                 Serialized application commands and UI state
src/platform/              IndexedDB/SQLite, file access, secure sessions and IDs
src/lib/                   Calendar, adapters, scanner and legacy registries
server/worker/             SQLite jobs, leases, recovery, outbox and CLI
supabase/migrations/       Owner-scoped sync tables and atomic RPC
tests/                     Domain, storage, PostgreSQL, worker and browser checks
scripts/                   Preview, boundary checks and synthetic benchmark
docs/production/           Design, backlog and implementation status
docs/operations/           Deployment, release, recovery and incident runbooks
.github/                   CI, dependency updates and review templates
```

The screen composition is still large; the new boundaries support incremental extraction without duplicating the engine. Earlier numbered briefs/root roadmaps are historical specifications, not current completion claims.

## Project documents

- [Complete design and production plan](docs/production/StockLedger_Project_Design_2026-09-15.md)
- [Prioritized improvement backlog](docs/production/StockLedger_Improvement_Backlog_2026-09-15.md)
- [Implementation and evidence](docs/production/IMPLEMENTATION_STATUS.md)
- [Release and incident runbook](docs/operations/RELEASE_RUNBOOK.md)
- [Changelog](CHANGELOG.md)

Canonical source: [kimhw8084/stockledger](https://github.com/kimhw8084/stockledger). Use short-lived branches and reference stable SL backlog IDs. Free and managed modes share this repository and lockfile.
