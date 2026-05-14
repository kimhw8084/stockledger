# Visual Evidence Layer Specification

## Purpose

The Visual Evidence Layer makes Recipe and Eye logic understandable without forcing the user to read raw formulas first.

It turns deterministic evaluation output into a visual evidence board:

Raw Data  
-> Metric Formula  
-> Condition Result  
-> Condition Role  
-> Visual Evidence Card  
-> Eye State Explanation  
-> Alert Explanation  
-> User Decision  
-> Outcome Learning

The app should feel explainable, fast to scan, and honest about uncertainty.

---

## Product Principle

Every major condition should answer:

- what was measured
- what threshold mattered
- what the current value is
- whether the condition passed, failed, warned, blocked, or became uncertain because of stale / missing / mock data
- how that condition affected the Eye state

The user should see the meaning first and the formula second.

---

## V1 Scope

V1 builds the smallest reusable visual explanation layer that proves:

- Eye Detail can render the current state as an evidence board
- Alert Detail can reuse the same evidence cards
- Recipe Builder can preview a draft Recipe against a selected stock
- every V1 condition card shows current value, threshold, status, freshness, source type, effect, and expandable formula details
- mock data is clearly labeled and routed through the same adapter path as future real data

V1 condition visuals:

- price drawdown
- moving-average / trend distance
- relative strength vs SPY
- planned entry zone match
- manual hard disqualifier
- overall data freshness / mock status

---

## Deferred Scope

Deferred, not rejected:

- valuation history bands
- peer comparison visuals
- richer financial trend cards
- news clustering timelines
- macro regime cards
- event timeline / calendar
- Recipe performance and usefulness dashboards
- advanced backtesting visuals

These should stay in roadmap / backlog.

---

## Reusable Components

The first slice should center on practical reusable components:

- `EvidenceCard`
- `EvidenceGroup`
- `ConditionStatusBadge`
- `DataFreshnessBadge`
- `ThresholdBar`
- `EntryZoneVisual`
- `WhyNowPanel`
- `WhatChangedPanel`

Later visual specialization can extend these rather than bypassing them.

---

## Visual Evidence Card Contract

Each card should contain:

- condition title
- role
- visual status
- human explanation
- current value
- threshold or comparison target
- visual representation
- freshness
- source type
- effect on Eye state
- why it matters
- expandable formula details

### Supported V1 statuses

- `Passed`
- `Failed`
- `Warning`
- `Blocked`
- `Partial`
- `Unavailable`
- `Stale`
- `Mock`

Status should not rely on color only. Use text labels and structure.

---

## Visual Families

### Price Damage

Used for drawdown and discount-from-high logic.

V1 visual:

- horizontal threshold bar
- current drawdown marker
- required drawdown marker

### Trend

Used for moving-average distance and stabilization logic.

V1 visual:

- threshold or comparison bar
- clear pass / fail wording

### Relative Strength

Used for stock vs market context.

V1 visual:

- comparison bar centered around zero
- threshold marker

### User Thesis

Used for planned entry zone and thesis discipline.

V1 visual:

- entry-zone band
- current price marker
- inside / outside explanation

### Risk Controls

Used for manual flags, earnings risk, and hard disqualifiers.

V1 visual:

- binary status card
- explicit block / warning language

### Data Quality

Used for freshness, source, missing data, stale data, and mock labels.

V1 visual:

- compact freshness panel
- source label
- missing / stale note

---

## Eye Detail Board

The Eye Detail board should show:

1. Eye header
2. current state
3. Recipe name and version
4. why-now panel
5. support highlights
6. risk highlights
7. what changed since last review
8. evidence groups
9. data quality
10. quick actions

The board should be the main explanation surface for a monitored setup.

---

## Alert Detail Board

Alert Detail should answer quickly:

- what happened
- why now
- whether this needs immediate review
- biggest support
- biggest risk
- freshness / stale / missing / mock status

The detail section should reuse the same evidence cards from Eye Detail.

---

## Recipe Builder Preview

The builder should support draft preview against a selected stock.

The preview should show:

- draft Recipe name and version
- resulting Eye state
- why-now summary
- support and contradiction highlights
- evidence cards grouped the same way as the Eye board

This keeps the Recipe Builder from feeling like blind parameter entry.

---

## Formula Detail Rule

Default UI should emphasize:

- meaning
- current value
- threshold
- status
- why it matters

Expandable detail should contain:

- formula name
- formula description
- required inputs
- source type
- freshness context

---

## Acceptance Criteria

The V1 Visual Evidence Layer is successful when:

- major conditions render as understandable evidence cards
- Eye Detail visually explains the current state
- Alert Detail visually explains why now
- Recipe Builder preview shows how the draft logic behaves on a stock
- stale, partial, unavailable, and mock data are visible
- formulas remain transparent but secondary
- the app remains runnable and the end-to-end loop still works

The user experience should feel like a clear evidence board, not a hidden model or decorative dashboard.
