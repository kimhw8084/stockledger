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
- Replaced pill-based top navigation with a persistent bottom navigation bar and a floating action menu for add/utility actions from any scroll position.
- Reworked the screen architecture into Dashboard, Watchlist, Studio, and Journal to better separate monitoring, drilldown, building, and review.
- Added lightweight stock chart visualizations and a more serious recipe generator flow with condition templates, parameters, roles, and draft-condition assembly.
- Added `docs/09_RECIPE_BUILDER_SPEC.md` to define the Recipe Builder foundation around metrics, formulas, conditions, roles, state rules, alert rules, and version-aware evaluation.
- Replaced the old bargain-only evaluator with a role-aware Recipe evaluation path that reads condition definitions, computes metric results, and maps them deterministically into Eye states.
- Expanded seed recipes, mock snapshots, alerts, and decisions so Recipe version and evaluation context are preserved through the core loop.
- Reduced the overuse of rounded rectangle surfaces by shifting cards, chips, nav, and action controls to tighter finance-dashboard geometry with denser information layouts.
- Replaced loose Recipe Builder threshold inputs with safer typed controls, including numeric steppers, enum selectors, explicit cadence/cooldown choices, and review-date presets.
- Extended Eye creation so entry zones, invalidation notes, and last-review context are stored structurally instead of being buried only in freeform text.
- Added `docs/10_VISUAL_EVIDENCE_LAYER_SPEC.md` to define the reusable explanation layer for Eye detail, Alert detail, and Recipe preview.
- Built a first visual evidence adapter that converts evaluation results into grouped evidence cards with statuses, freshness, source labeling, threshold visuals, and expandable formula details.
- Reworked Dashboard Eye review and Alert review around a shared evidence-board pattern instead of plain text evidence lists.
- Added draft Recipe preview so a stock can be tested against unsaved Recipe logic using the same evaluation and evidence-card path as active Eyes.
- Added a dedicated selected-stock `Visual Analysis` workspace inside Watchlist with grouped evidence families, benchmark and lookback controls, status filtering, and recipe filtering.
- Built stock-level parameter cards for price damage, trend, relative strength, volume and volatility, valuation, financial quality, debt risk, earnings timing, thesis risk, sector context, macro context, and user thesis match.
- Added a stock-scoped Recipe Condition Map that shows each active Eye’s recipe version, state, passed and failed logic, warnings, blockers, data issues, and next likely trigger.
- Added thesis-review actions and stock-to-Studio / stock-to-Journal shortcuts so the new analysis workspace connects directly to Eye creation, recipe preview, and decision logging.
- Reorganized the entire app shell around six clearer workspaces: Home, Stocks, Recipes, Eyes, Alerts, and Journal.
- Promoted Stocks into the first-class stock search and inspection surface instead of burying stock detail inside a mixed watchlist tab.
- Rebuilt the selected-stock experience into a dedicated workspace with Summary, Visual Analysis, Recipe Map, and Notes subviews.
- Added stock search, state-aware stock filtering, compact stock tiles, and a denser grid-style evidence layout so stock review feels more like a purposeful finance workspace than a long stacked page.
- Split recipe authoring, eye creation, alert review, and decision logging into separate workspaces so each destination has a narrower and clearer job.
- Reworked Home from mixed Eye-level cards into stock-grouped review sections so one stock is no longer scattered across multiple independent monitor cards.
- Compressed `Stocks > Visual Analysis` into a more visual 2-up metric-board pattern with compact square tiles, minimal default copy, and tap-to-expand detail.
- Moved most explanation text out of the default stock tiles and into the expanded detail state so the stock workspace is faster to scan at a glance.
- Added selected-stock continuity helpers so moving between Stocks, Eyes, Alerts, and Journal preserves the current stock context more reliably.
- Added a recent-stocks strip and tighter stock switching flow inside Stocks so returning to active names takes fewer taps.
- Reworked Alerts queue from a flatter list into stock-grouped alert clusters with recipe counts, shared stock context, and direct drill-down into stock or alert detail.
- Added stronger stock-level “what changed” summaries so Summary and Recipe Map show clearer cross-recipe changes instead of only isolated Eye snippets.
- Flattened `Stocks > Visual Analysis` into one continuous 2-up metric board instead of section-by-section collapsible evidence groups.
- Added a first provider-aware snapshot adapter that attempts real daily price/history data, derives key market metrics, and falls back to mock snapshots when the provider path is unavailable.
- Updated the app shell to surface provider-backed versus mock-fallback snapshot counts more explicitly so testing data trust is easier.
- Split the Recipe Builder into clearer guided sections for purpose, logic, risk/alerts, and review/outcome framing instead of one undifferentiated authoring block.
- Added first-pass alert lifecycle controls including snoozing, usefulness feedback, grouped active queue handling, and a dedicated snoozed-alert view.
- Enriched Journal history with linked outcome context so decision review shows at least the current outcome status, lesson, and recipe-improvement note.
- Reworked the top-level usage of each workspace so tabs default to current inventory views first and push add/detail flows into triggered window panels where practical.
- Added a global top bar with alert badge count, a stock-add window, and stock metric popup detail so the app relies less on long vertical forms.
- Refocused Stocks on factual parameter visualization only by stripping recipe-linked controls from the main stock board and opening metric detail in a separate panel.
- Reorganized Eyes into grouped subscription inventory by recipe and shifted Journal to default into history rather than immediate composition.
