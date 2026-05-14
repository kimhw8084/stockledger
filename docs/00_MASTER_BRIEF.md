# Personal Investment Recipe Engine — Master Brief

## 1. Purpose

Build a real, runnable, cross-platform personal investment monitoring app that helps me stop missing high-quality multi-day to multi-month stock opportunities.

This is not a design-only exercise.

This is not a fake demo.

This is not a generic trading dashboard.

This is not a day-trading tool.

This is not a buy/sell signal product.

The first purpose is not monetization.

The first purpose is to improve my own investing and trading performance by solving a real personal workflow problem:

I often notice good stocks or strong setups, but because I am busy with work and life, I lose track of them. By the time the opportunity becomes actionable, I may forget the original reason, miss the entry zone, hesitate too long, or chase too late.

The app should become my personal stock-opportunity memory system.

The product promise is:

> I should never lose a good stock idea just because I was busy.

---

## 2. Product Identity

This app is a personal investment Recipe Engine.

A Recipe is a reusable, human-understandable investment logic pattern.

An Eye is a Recipe applied to a specific stock.

The core idea is:

> A stock is not simply watched. A stock is watched through a reason.

Example:

AMD may have multiple Eyes:

- Temporary Bargain Sale Eye
- Semiconductor Sector Leader Pullback Eye
- Post-Earnings Recovery Eye
- Macro Risk Eye

Each Eye watches AMD from a different investment logic angle.

The app should tell me when one of those Eyes becomes meaningful, risky, stale, actionable, or invalid.

---

## 3. Core Product Loop

The entire product must protect this loop:

Recipe → Eye → Monitoring → Alert → Decision → Outcome → Recipe Improvement

This loop is the heart of the app.

Do not build advanced production features until this loop works end to end.

### Recipe

A reusable investment logic framework.

### Eye

A Recipe applied to a stock.

### Monitoring

The app checks useful data sources and evaluates whether the Eye is becoming interesting, actionable, risky, stale, or invalid.

### Alert

The app notifies me only when something meaningful changes.

### Decision

I log whether I entered, skipped, snoozed, rejected, revised, or marked the thesis broken.

### Outcome

The app later helps me review what happened after my decision.

### Recipe Improvement

Over time, I learn which Recipes and conditions helped and which created noise.

---

## 4. Core Problems to Solve

### Missed Opportunity

I found a good stock idea but forgot to act when the right price or condition appeared.

### Memory Decay

I forgot why I originally liked the stock.

### Late Chasing

I rediscovered the stock only after it already moved.

### Stale Thesis Execution

The stock finally reached my target zone, but the original reason may no longer be valid.

### Manual Tracking Overload

I spend too much time checking charts, news, financials, sector movement, macro context, and watchlists manually.

### Generic Alert Noise

I do not want simple price alerts.

I want meaningful alerts based on my own investment logic.

---

## 5. Product Invariants

These rules must remain true throughout development.

### Human Decision

The app must not make direct buy or sell decisions for me.

The app provides evidence, context, monitoring, memory, and discipline.

The final decision stays with the user.

### Explainable Logic

If an Eye changes state, the app must be able to explain why.

No unexplained black-box state changes.

### Visible Data Provenance

The app must clearly distinguish between:

- user-entered thesis notes
- retrieved market or company data
- calculated metrics
- AI-generated summaries
- stale data
- unavailable data
- mock data

Unsupported information must never look factual.

### Core Loop First

A small usable app is better than a large unfinished platform.

The first prototype must prove the core loop before advanced features are added.

### Zero-Cost Data First

The prototype must use zero-cost data sources and efficient caching.

Paid data can be considered later only after the app proves personal value.

### Mobile-First Review

The alert and Eye review experience must work well on mobile.

The user may only have a few seconds to understand what changed.

### Calm Product Behavior

The app should encourage patience, discipline, and selective action.

It should not encourage overtrading.

### No Silent Misleading Output

If data is incomplete, stale, uncertain, or unavailable, the app must show that clearly.

The app should prefer honest partial information over fake completeness.

---

## 6. Priority Hierarchy

When tradeoffs appear, use this priority order:

1. Core loop working end to end
2. Data honesty and explainability
3. Mobile-first usefulness
4. Zero-cost data efficiency
5. Clean architecture
6. Fast iteration
7. Visual polish
8. Advanced intelligence
9. Monetization
10. Broker or execution integrations

If two choices conflict, choose the one that protects the core loop and user trust.

Do not sacrifice correctness, explainability, or runnable progress for flashy features.

---

## 7. What the App Should Do

The app should help me:

- save stock ideas quickly
- preserve why I cared about each stock
- create reusable Recipes
- apply Recipes to stocks as Eyes
- monitor active Eyes automatically
- detect when a stock meaningfully matches a Recipe
- explain why an Eye changed state
- show what changed since I started watching
- warn when the original thesis may be damaged
- help me decide whether to act, wait, revise, reject, or mark invalid
- log my decision
- review the outcome later
- improve Recipes based on real results

The product should feel like:

> A serious personal analyst that remembers my investment logic and tells me when a stock deserves attention.

---

## 8. Rejected Product Directions

These are not deferred. They are rejected because they violate the product identity.

Do not build the app into:

- a fake AI trading guru
- a buy/sell signal-selling product
- a casino-like trading interface
- a social hype feed
- a copy-trading marketplace
- a pump-and-dump style community
- a product that promises guaranteed profit
- a tool that pretends unsupported AI output is factual
- a day-trading execution system
- an app designed to increase trading frequency for its own sake

Rejected means wrong direction.

Deferred means useful later, but not now.

Keep these categories separate.

---

## 9. Deferred But Remembered

Some features are intentionally excluded from the first prototype, but they should not be forgotten.

Deferred means:

> Not now, but remembered.

Deferred features should be recorded in ROADMAP.md or BACKLOG.md.

Deferred features include:

- authentication and account security
- mobile push notifications
- production cloud deployment
- multi-device sync
- richer charting
- advanced backtesting
- broker integration
- production-grade data providers
- subscription billing
- public app release
- app store packaging
- portfolio-level analytics
- export and import tools
- public Recipe marketplace
- multi-user support

These should be phase-gated, not permanently removed.

---

## 10. V1 Assumptions

The first prototype should assume:

- single-user personal use
- local-first or simple hosted development
- zero-cost data sources
- watched-stock monitoring before broad scanning
- mock or sample data allowed only as a temporary bridge
- no monetization infrastructure
- no broker integration
- no public users
- no team accounts
- no production compliance packaging
- no complex charting as the primary product

Design the architecture so production expansion is possible later, but do not overbuild V1.

---

## 11. Definition of Done for the First Prototype

The first prototype is done when I can use the app for one real stock idea from creation to later review, even if data coverage is limited.

The app must allow me to:

- create a Recipe
- apply that Recipe to a stock as an Eye
- evaluate that Eye
- see the Eye state
- receive or view a meaningful alert
- log a decision
- review an outcome
- see what data was used
- see whether any data was stale, unavailable, mock, or partial

Working product beats impressive scaffolding.

---

## 12. Final Direction

The app should become my personal investment operating system for multi-week stock opportunities.

It should not try to predict everything.

It should help me remember, monitor, compare, and act with discipline.

The app should preserve the original reason, watch the opportunity through reusable logic, and alert me when the stock deserves review.

Final product feeling:

> A personal analyst that watches my investment Recipes and tells me when a stock deserves my attention.

Build toward that.
