# Architecture Brief

## 1. Technical Direction

Use a backend.

The backend should own:

- data ingestion
- cache management
- feature calculation
- Recipe evaluation
- Eye state updates
- alert creation
- decision history
- outcome tracking

The frontend should own:

- user interaction
- fast display
- Recipe creation and editing
- Eye management
- alert review
- decision logging
- journal review
- outcome review

The frontend should not call external data providers directly.

The backend should mediate all provider access through adapters.

---

## 2. Cross-Platform Requirement

The app must work well on:

- web
- iOS
- Android

Design mobile-first.

Mobile should be best for:

- alerts
- quick review
- checking what needs attention
- logging simple decisions
- snoozing or dismissing alerts

Web should be best for:

- building Recipes
- reviewing history
- comparing outcomes
- editing settings
- managing many Eyes

The same core product logic should power web and mobile.

Do not build separate unrelated apps.

---

## 3. Default Stack Direction

A strong default stack is:

- TypeScript
- Expo
- React Native
- React Native Web
- Expo Router
- Node.js backend
- SQLite or PostgreSQL depending on prototype and deployment needs
- ORM chosen for speed and maintainability
- scheduled jobs or background workers
- cached normalized data
- provider adapters

The AI CLI may choose a better stack only if it clearly improves ROI while preserving:

- web support
- iOS support
- Android support
- backend monitoring
- cached data
- background refresh
- future expansion

---

## 4. Architecture Layers

Use separation of concerns.

The product should have these conceptual layers:

- UI layer
- API layer
- data provider adapter layer
- local storage/cache layer
- feature calculation layer
- Recipe evaluation layer
- Eye state layer
- alert layer
- journal and outcome layer
- AI explanation layer

The deterministic Recipe Engine should not depend on the AI explanation layer.

The app should be able to show the last known state even when external sources are temporarily unavailable.

---

## 5. Provider Adapter Contract

All external data must enter through provider adapters.

Every adapter should return normalized data.

The rest of the app should not care where the data came from.

Adapters should report:

- source name
- retrieved timestamp
- data timestamp
- freshness status
- success or failure status
- error message if failed
- confidence or quality level when appropriate
- whether data is mock, partial, stale, or unavailable

Provider errors must not crash the UI.

Provider output should never be treated as perfect.

---

## 6. Mock Data Policy

Mock data is allowed only for proving the core loop.

Mock data must be isolated behind the same interface as real providers.

Mock data must be clearly labeled.

Mock data must be removable without rewriting UI components.

Mock data must never be presented as real market data.

Mock data should be replaced with zero-cost provider adapters as soon as the basic loop works.

---

## 7. Local-First Prototype Option

For the first prototype, prefer local-first development if it speeds up iteration.

Cloud deployment can come later.

The app should still be architected so the backend and database can move to a server later.

Do not spend early effort on production deployment, scaling, billing, or team infrastructure before the core loop works.

---

## 8. Single-User V1 Assumption

The first prototype assumes single-user personal use.

Do not build:

- organizations
- team accounts
- roles and permissions
- subscription billing
- public profiles
- public sharing
- admin dashboards
- SaaS tenant management

Design so multi-user support can be added later, but do not implement it first.

---

## 9. Minimum Persistent Concepts

Do not over-prescribe table fields too early, but the app needs persistent records for:

- stocks being watched
- Recipes
- Recipe versions
- Eyes
- evaluations
- state transitions
- alerts
- decisions
- outcomes
- user thesis notes
- data source snapshots
- data freshness status
- job runs
- known limitations
- deferred backlog items

The schema should support the core loop without locking the app into one hardcoded Recipe.

---

## 10. Recipe Versioning Rules

Never overwrite important history.

Recipe edits should preserve or create versions.

Alerts and outcomes should reference the Recipe version that produced them.

Outcome review should be able to compare Recipe versions over time.

If a user improves a Recipe, old results should remain traceable to the older version.

---

## 11. Eye State Architecture

Eye state should be deterministic and explainable.

An Eye evaluation should produce:

- current state
- previous state
- whether state changed
- why now
- supporting evidence
- contradicting evidence
- missing data
- stale data
- data quality
- whether an alert should be created

The state machine should reduce noisy flipping.

Every meaningful state transition should be stored.

---

## 12. Alert Architecture

Alerts should be created from meaningful Eye changes, not raw metric noise.

Alert generation should consider:

- state transition
- priority
- cooldown
- deduplication
- snooze status
- user preferences
- data quality
- alert usefulness history

Alerts should be grouped, downgraded, or suppressed when not decision-relevant.

---

## 13. Data Quality Affects Alert Strength

If data is stale, partial, or low-trust, alert strength should be downgraded.

Examples:

- price data fresh but financial data stale means alert should show partial validation
- missing key financial data should prevent high-confidence wording
- news-only signals should be lower trust unless supported by other evidence
- mock data should never trigger real alerts without obvious labeling

High-confidence language requires high-quality data.

---

## 14. Offline and Degraded Mode

The app should eventually show last-known state even if data sources are unavailable.

If offline or providers fail:

- show cached Eyes and alerts
- show last updated time
- mark data as stale or unavailable
- avoid producing new high-confidence evaluations
- do not crash normal navigation

The app should prefer honest degraded behavior over fake completeness.

---

## 15. Background Jobs and Observability

If background jobs fetch data and evaluate Eyes, the app should provide visibility.

Track:

- job run history
- last successful refresh
- failed provider calls
- number of stocks refreshed
- number of Eyes evaluated
- number of alerts generated
- stale data count
- provider health

This can live in a simple internal Settings or Data Health screen.

---

## 16. Error States as Product

The app should show useful error states.

Examples:

- provider unavailable
- data stale
- Eye partially evaluated
- mock data active
- no Recipe applied
- no decision logged yet
- outcome review not ready
- alert suppressed due to cooldown
- user review overdue

Do not hide important limitations.

Make them understandable.

---

## 17. Security and Privacy Expectations

The app may contain personal investment notes, decisions, and strategy logic.

Treat this data as private.

For the prototype:

- avoid unnecessary data exposure
- avoid logging sensitive notes in unsafe places
- keep user strategy notes separate from external data
- design so authentication can be added or strengthened later
- do not send personal thesis notes to AI unless the user explicitly uses an AI feature that requires it

If cloud deployment is added later, protect user data with sensible authentication, authorization, and secure storage practices.

---

## 18. Data Ownership

Personal strategy data may become valuable.

Future production should support:

- local backup
- export Recipes
- export decisions
- export journal
- export outcomes
- import watchlists
- import Recipes
- clear data location
- no forced lock-in

This is deferred from V1 but should be remembered in the roadmap.
