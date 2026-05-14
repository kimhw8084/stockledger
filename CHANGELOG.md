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
- Reworked the app shell around a calmer mobile-first review flow instead of raw CRUD forms.
- Replaced typed ID entry with tappable stock, recipe, eye, and alert selection chips.
- Added in-place alert review actions, guided decision logging controls, and a stronger curated starter dataset.
- Rebuilt the visual system toward a calmer premium finance-product feel with darker editorial framing, softer neutral surfaces, and clearer state hierarchy.
- Reorganized Home, Eyes, Recipes, and Journal around decision-first cards instead of prototype-style stacked forms.
- Tightened selection syncing and review flow behavior so Eye and Alert focus stays coherent as data changes.

## 2026-05-14

- Replaced the serif-heavy editorial theme with a cleaner modern sans-serif system font treatment across headers, labels, body copy, and controls.
- Overhauled the app palette from warm beige tones to cooler finance-style neutrals with darker market surfaces and brighter green-blue accents.
- Increased contrast and consistency across tabs, buttons, pills, forms, and cards to improve readability and make the product feel closer to a contemporary investing app.
