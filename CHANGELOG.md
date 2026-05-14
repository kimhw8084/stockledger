# CHANGELOG

## 2026-05-13

- Created the first runnable Expo app shell for StockLedger.
- Implemented local persistent state for stocks, recipes, eyes, alerts, decisions, outcomes, and mock snapshots.
- Added a deterministic Eye evaluation engine with explainable state changes and alert generation.
- Seeded the app with a starter Recipe, AMD example stock, and mock snapshot data.
- Added project memory files for roadmap, backlog, decisions, changelog, and known limitations.
- Upgraded the project from Expo SDK 53 to SDK 54 to restore compatibility with the current Expo Go client.
- Aligned React, React Native, Expo runtime dependencies, and TypeScript tooling with the SDK 54 version set.
- Excluded generated `dist/` artifacts from TypeScript compilation so validation stays stable after export.
