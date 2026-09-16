# StockLedger

A local Expo prototype for saving investment theses, monitoring them through reusable recipes, reviewing changes, and keeping a decision journal. It also contains an experimental daily stock-condition scanner.

**Current status:** buildable prototype, not production-ready. The September 2026 review found data-preservation, calendar, evaluation, and history issues that must be resolved before relying on real-data outputs.

## Start here

- [Complete product design, architecture, cost paths, and production plan](docs/production/StockLedger_Project_Design_2026-09-15.md)
- [Prioritized improvements with source evidence and acceptance criteria](docs/production/StockLedger_Improvement_Backlog_2026-09-15.md)
- [Original product brief](docs/00_MASTER_BRIEF.md)

The two production documents reflect the owner's expanded commercial scope. Older numbered specifications and root roadmap files remain historical context and may describe earlier implementation states.

## Local development

The current package scripts support Expo web, iOS, Android, and TypeScript checks.

~~~sh
npm ci
npm run web
npm run typecheck
~~~

A web export can be created with:

~~~sh
EXPO_NO_DOTENV=1 npx expo export --platform web --output-dir dist
~~~

Use the workspace's required command wrapper where applicable. The review verified typecheck and web export; it did not certify real-device behavior. No automated test suite or CI workflow is configured yet.

## Data and privacy

The ordinary Eye workflow uses generated sample snapshots. The scanner has a separate Stooq/current-constituents path. Provider configuration does not establish commercial data rights or prove that displayed values are live.

Do not put secret provider credentials in EXPO_PUBLIC variables for public builds. Keep .env, generated bundles, user exports, and raw market archives out of Git. Preserve a backup before changing persistence.

The project contains no production backend, account sync, subscription billing, or independent cloud monitoring service. The production plan describes how to add them incrementally, including a local zero-new-subscription path.

## Repository

Canonical source: https://github.com/kimhw8084/stockledger

Keep one main branch and short-lived implementation branches. Free and managed modes should share the same domain engine and schemas. Reference the stable SL improvement IDs when implementing the backlog.

