# UI and UX Specification

## 1. Product Personality

The app should feel:

- calm
- serious
- fast
- useful
- analytical
- low-noise
- professional
- mobile-friendly
- evidence-driven
- honest about uncertainty

The app should not feel:

- flashy
- casino-like
- cluttered
- hype-driven
- overconfident
- socially manipulative
- designed to increase trading frequency

The app should help me think clearly.

---

## 2. Screen Purpose Rule

Every screen must help answer at least one of these questions:

- What should I pay attention to today?
- Which stock is becoming interesting?
- Which Recipe is triggering?
- Why is this stock triggering now?
- What evidence supports the setup?
- What evidence contradicts it?
- What changed since I started watching?
- Is this still a good opportunity?
- Is the thesis broken?
- What did I decide?
- Did this Recipe work over time?

If a screen does not answer one of these questions, reconsider whether it belongs in the MVP.

---

## 3. Mobile-First Design

Mobile should be best for:

- alerts
- quick review
- checking what needs attention
- logging simple decisions
- snoozing or dismissing alerts

The alert experience should be optimized for a 5-second scan.

A busy user should be able to understand:

- what changed
- why it matters
- what risks exist
- what actions are available

without reading a long report.

---

## 4. Web Design Role

Web should be best for:

- building Recipes
- editing Recipes
- reviewing history
- comparing outcomes
- managing many Eyes
- reviewing data health
- changing settings

Web can be more information-dense than mobile, but should still remain calm and focused.

---

## 5. Main Screens

### Home

Purpose:
Show what needs attention today.

Home should prioritize attention, not information density.

Suggested hierarchy:

1. Attention Needed
2. Thesis Risk Rising
3. Opportunity Zone Forming
4. Watch Closely
5. Quiet Eyes
6. Recent Decisions
7. Data Health warnings

Home should answer:

- what needs review now?
- what changed?
- what can wait?

### Recipes

Purpose:
Create, edit, duplicate, and improve Recipes.

The Recipe Builder should start simple.

Avoid making the first version feel like a programming tool.

Show conditions in human language.

Advanced logic can come later.

### Eyes

Purpose:
Show all active stock monitors and their current states.

Each Eye card should show:

- stock symbol
- Recipe name
- current state
- last updated
- top reason
- data freshness status
- alert priority if any

### Stock Detail

Purpose:
Show why the stock is being watched.

Should include:

- active Eyes
- original thesis snapshots
- current state per Eye
- what changed since last review
- relevant alerts
- recent decisions
- data quality status

### Eye Detail

Purpose:
Explain the current state of one stock under one Recipe.

Should show:

- current state
- why now
- supporting evidence
- contradicting evidence
- hard disqualifiers
- what changed since last review
- original thesis snapshot
- data freshness
- user actions

### Alert Detail

Purpose:
Help user make or preserve a better decision.

Should show:

- alert title
- state change
- why now
- supporting evidence
- risks
- what changed
- data quality
- suggested actions

Actions:

- Review
- Snooze
- Mark Entered
- Mark Skipped
- Mark Rejected
- Mark Thesis Broken
- Edit Eye
- Edit Recipe

### Decision Journal

Purpose:
Record what I did and why.

Decision logging should be fast and guided.

Use prompts, not only blank text.

Suggested prompts:

- Why did you enter or skip?
- Was the original thesis still valid?
- What risk concerned you most?
- Was the alert early, late, or on time?
- What should this Recipe learn?

### Outcome Review

Purpose:
Review whether the decision and Recipe worked after time passed.

Should show:

- decision context
- review window
- price change if available
- max runup if available
- max drawdown if available
- user lesson
- Recipe improvement suggestion

### Settings

Purpose:
Manage preferences and data health.

Should include:

- data source status
- refresh behavior
- mock data status
- provider errors
- AI options later
- export/import later
- privacy/security later

---

## 6. No Chart-First Design

Charts are useful later, but they are not the core product.

The core UI should be:

- state
- why now
- evidence
- risks
- what changed
- actions

Charts support the decision.

Charts are not the product.

Do not start with complex charting before the core loop works.

---

## 7. Data Freshness Badges

Data-backed screens should show freshness clearly.

Possible labels:

- Fresh
- Delayed
- Stale
- Partial
- Unavailable
- Mock Data

Do not hide stale or missing data.

---

## 8. Confidence Wording

Avoid fake precision.

Bad:

Confidence: 93 percent

Better:

- Setup Strength: Medium
- Data Quality: Partial
- Thesis Risk: Elevated
- Action Urgency: Review Soon

The app should not pretend to be more precise than it is.

---

## 9. Compliance and Language Safety

The app should avoid language that sounds like guaranteed advice, direct recommendation, or promotional trading signals.

Avoid phrases like:

- buy now
- guaranteed upside
- safe trade
- risk-free
- sure winner
- must enter
- high-confidence profit

Prefer phrases like:

- matches your Recipe
- review before deciding
- evidence supports the setup
- risks remain
- thesis may be damaged
- data is stale
- conditions changed
- user decision required

The app should support personal decision-making, not replace it.

---

## 10. Personal Workflow Fit

Because the user is busy with work and life, the app should eventually support:

- snooze until after work
- review tonight
- review this weekend
- quiet mode
- priority-only alerts
- quick mark as reviewed
- review reminder
- weekly review list

These are deferred unless needed for MVP, but should be remembered.

---

## 11. Error States as UX

The app should show useful states instead of hiding problems.

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

Good error states build trust.
