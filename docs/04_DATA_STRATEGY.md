# Data Strategy

## 1. Core Data Principle

Use the smallest amount of useful data that supports good decisions.

Do not collect data just because it exists.

Every data point should help the app make a better monitoring decision.

---

## 2. Zero-Cost Data First

All data sources for the prototype should be zero-cost.

The app should use free sources intelligently and efficiently.

The app should not waste API calls, bandwidth, tokens, or storage.

The app should fetch only what is needed for watched stocks and active Recipes.

Prefer:

- daily or delayed data over paid real-time data
- cached snapshots over repeated live calls
- compact useful metrics over raw bulky data
- background refresh jobs over frontend waiting
- provider adapters so sources can be replaced later
- watched-stock monitoring before broad market scanning

Because this app targets multi-day to multi-month opportunities, expensive real-time tick data is not required for the first version.

---

## 3. Correct Data Flow

Correct architecture:

External data sources → backend jobs → local cache/database → feature calculations → Recipe evaluation → app display

Incorrect architecture:

User opens screen → frontend calls many external APIs → user waits

The app should feel fast because it uses cached local data, not because it pays for premium feeds.

---

## 4. Watchlist-First, Scanner-Later

Start with user-selected stocks.

Do not build broad stock discovery until watched-stock monitoring works.

V1 should monitor stocks I manually add.

Broad market scanning is useful later, but expensive and complex.

Scanner should be phase-gated:

Add scanner only after Recipes prove useful on manually watched stocks.

---

## 5. Minimum Viable Data Categories

### V1 Required

The first prototype needs:

- stock symbol
- stock name if available
- price snapshot or sample price data
- simple technical metrics
- user thesis
- Recipe logic
- Eye state
- alert history
- decision history
- outcome review

### V1 Optional

Useful but not required for the first vertical slice:

- basic financials
- basic valuation data
- simple news metadata
- basic sector data
- simple market context

### Deferred

Add later:

- deep fundamentals
- full peer comparison
- advanced sentiment
- macro regime model
- advanced backtesting engine
- broad universe scanner
- paid production data feeds
- full event calendar

---

## 6. Data Efficiency Rules

Do not:

- repeatedly fetch the same data
- store huge raw data unless needed
- fetch full articles when metadata is enough
- refresh inactive Eyes as often as active Eyes
- call external APIs directly from normal frontend screens
- send large raw datasets to AI when compact summaries are enough
- scan thousands of stocks constantly in the prototype

Prioritize:

- watched stocks
- active Eyes
- recent alerts
- meaningful changes
- data needed by Recipes
- compact summaries
- precomputed metrics

---

## 7. Data Source Policy

Prefer official, stable, and documented sources when possible.

Unofficial or fragile sources may be used only behind replaceable provider adapters.

The app should not depend permanently on one fragile free source.

The app should gracefully degrade when a source is unavailable.

If a source fails, the app should show what data is stale or unavailable instead of silently producing misleading results.

The app should clearly separate:

- actual retrieved data
- calculated metrics
- user-entered notes
- AI-generated summaries
- stale data
- unavailable data
- mock data

Never mix these together in a way that makes unsupported information look factual.

---

## 8. Data Truth Hierarchy

When information conflicts, use this hierarchy.

### Highest Trust

- user-entered thesis
- user-entered decision logs
- official filings
- official macro data

### Medium Trust

- market price data from free providers
- calculated technical metrics
- structured data from documented APIs

### Lower Trust

- news metadata
- headline sentiment
- unofficial APIs
- scraped data
- AI summaries

### Lowest Trust

- unverified AI interpretation
- incomplete provider output
- stale data
- unsupported inference
- mock data

The app should show uncertainty when data quality is low.

The app should never make stale or weak data look precise.

---

## 9. Data Freshness Expectations

The app should track data freshness.

Every data-backed screen should make it possible to understand whether information is:

- Fresh
- Delayed
- Stale
- Partial
- Unavailable
- Mock Data

For the prototype, freshness does not need to be perfect, but it must be honest.

Examples:

- daily price data may be acceptable for multi-day and multi-month monitoring
- fundamentals may update only when new filings or reliable snapshots are available
- news metadata may be incomplete and should be treated as lower-trust context
- macro data may update at different frequencies depending on the source

The app should not pretend old data is fresh.

The app should not trigger high-confidence alerts from stale or incomplete data without warning.

---

## 10. Monitoring Cadence

The app should refresh data based on usefulness, not because more frequent always seems better.

For the prototype:

- watched stocks should refresh more often than inactive stocks
- active Eyes should refresh more often than inactive Eyes
- price data can refresh daily or periodically depending on available free sources
- fundamentals should refresh only when new reliable data is available
- news or event metadata should be treated as helpful context, not perfect truth
- outcome reviews should run after defined review windows

Do not waste free-source limits on data that does not affect active Eyes.

Do not design the first version around real-time infrastructure.

---

## 11. Data Quality Affects Product Behavior

Data quality should affect Eye evaluation and alert wording.

If data is stale or partial:

- show partial evaluation
- downgrade alert confidence
- avoid high-confidence language
- show missing data clearly
- allow user to review manually

Examples:

- price data is fresh but financial data is stale: show partial validation
- financial data missing: do not claim business quality is confirmed
- news metadata only: show as context, not proof
- mock data active: label everywhere

---

## 12. Event Calendar Awareness

For multi-week trades, events matter.

Event calendar support is deferred, but should be remembered.

Future event types:

- earnings date
- ex-dividend date
- major company event
- Fed meeting
- CPI release
- major macro release
- investor day
- regulatory decision
- product launch
- guidance update

Event data should eventually affect alerts and thesis risk.

---

## 13. No Frontend Provider Calls

Normal frontend screens must not call external data providers directly.

Frontend screens should load from the app’s own backend or local cache.

External provider calls should happen through:

- backend jobs
- provider adapters
- controlled refresh actions
- cached snapshots

This keeps the UI fast and reliable.

---

## 14. Data Health UI

The app should eventually include a simple Data Health area showing:

- last successful refresh
- provider status
- stale data count
- unavailable data count
- mock data status
- active Eyes evaluated
- alerts generated
- failed jobs

This can live in Settings or a developer-only screen during prototype.
