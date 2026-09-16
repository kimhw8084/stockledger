> Historical prototype brief. Use [current implementation status](production/IMPLEMENTATION_STATUS.md) and the [production design](production/StockLedger_Project_Design_2026-09-15.md) for the active release scope.

# Roadmap and Backlog

## 1. Roadmap Philosophy

Deferred does not mean rejected.

Deferred means:

> Not now, but remembered.

Rejected means:

> Wrong direction for the product.

Phase-gated means:

> Useful later, but only after specific conditions are met.

The AI CLI should never silently forget reasonable future features.

When a useful feature is deferred, record it here or in BACKLOG.md.

---

## 2. Rejected Product Directions

These are not deferred. They should not be built.

- fake AI trading guru
- buy/sell signal-selling product
- casino-like trading interface
- social hype feed
- copy-trading marketplace
- pump-and-dump style community
- guaranteed profit language
- unsupported AI facts presented as truth
- day-trading execution system
- product designed to increase trading frequency for its own sake

---

## 3. Phase 1: Local Working Prototype

Goal:
Prove the core loop with one user.

Core loop:

Recipe → Eye → Evaluation → Alert → Decision → Outcome

Required:

- create Recipe
- add stock
- apply Recipe to stock as Eye
- evaluate Eye using sample/mock data or first simple data adapter
- show Eye state
- create alert
- log decision
- open outcome review
- clearly show mock, stale, or missing data

Deferred:

- production auth
- payments
- broker integration
- push notifications
- advanced AI
- app store release
- broad scanner
- complex charts

Definition of done:

I can use the app for one stock idea from creation to later review, even if data coverage is limited.

---

## 4. Phase 2: Personal Production Version

Goal:
Make the app reliable for my real daily use.

Add:

- persistent database
- real zero-cost data adapters
- data freshness tracking
- better Eye state history
- better in-app alerts
- mobile-friendly review flow
- decision journal improvements
- outcome review windows
- data health screen
- export/backup basics if practical
- simple authentication if cloud or multi-device use requires it

Definition of done:

I can use the app daily for a small watchlist without relying on hidden mock data.

---

## 5. Phase 3: Intelligence Upgrade

Goal:
Improve decision quality.

Add:

- richer Recipe Builder
- condition library
- Recipe version comparison
- Recipe performance review
- AI-assisted Recipe drafting
- AI-assisted alert explanation
- news headline summarization
- thesis refresh suggestions
- anti-chasing detection
- stale thesis detection
- event calendar awareness

Definition of done:

The app helps me improve Recipes based on outcomes and reduces repeated bad alerts.

---

## 6. Phase 4: Cross-Device and Production Hardening

Goal:
Make the app reliable across devices.

Add:

- stronger authentication
- cloud sync
- better backups
- privacy controls
- monitoring and logs
- production deployment
- mobile push notifications
- offline/degraded mode
- export/import tools

Definition of done:

The app can be trusted with my private strategy notes and used across devices.

---

## 7. Phase 5: Monetization-Ready Version

Goal:
Prepare for outside users only if the app proves personal value first.

Add:

- onboarding
- account management
- subscription billing
- public-facing legal language
- privacy policy
- terms of service
- user settings
- support workflow
- production compliance review
- scalable data-provider strategy

Definition of done:

The app is stable enough that outside users could use it without confusing it for direct investment advice.

---

## 8. Phase 6: Optional Advanced Expansion

Goal:
Add higher-complexity features only if justified.

Possible:

- broker integration
- portfolio analytics
- advanced backtesting
- public Recipe marketplace
- team features
- broad universe scanner
- paid data feeds
- advanced macro regime detection
- advanced event detection
- advanced strategy analytics

These should not be built until the core personal product proves clear value.

---

## 9. Deferred Production Features

Record these as future backlog items.

### Authentication and Account Security

Deferred from V1 unless required by deployment.

Production requirement because the app stores private investment notes, decisions, and strategy logic.

### Mobile Push Notifications

Deferred until in-app alerts are useful.

Production requirement for busy-workday usage.

### Broker Integration

Deferred until monitoring, alerting, decision journaling, and outcome review prove useful.

Should not be part of the first prototype.

### Production Data Providers

Deferred until zero-cost prototype proves value.

The architecture should allow provider replacement.

### Advanced Backtesting

Deferred until Recipes produce enough structure and history.

Backtesting should not replace real outcome feedback.

### Export and Import

Deferred but important for data ownership.

Future support:

- export Recipes
- export decisions
- export journal
- export outcomes
- import watchlist
- import Recipes
- backup database

### Public Recipe Marketplace

Deferred and optional.

Should not be built unless personal Recipe system proves valuable.

### Monetization

Deferred until personal value is proven.

Do not build billing infrastructure in V1.

---

## 10. Backlog Memory Rule

Whenever the AI CLI decides not to implement something because it is outside V1 scope, it should record that feature as:

- Deferred
- Phase-gated
- Rejected

Do not silently discard reasonable future features.

Deferred means not now, but remembered.

Rejected means wrong for the product.

Phase-gated means build only after a specific milestone is met.
