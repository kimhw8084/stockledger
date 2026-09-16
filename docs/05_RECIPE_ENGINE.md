> Historical prototype brief. Use [current implementation status](production/IMPLEMENTATION_STATUS.md) and the [production design](production/StockLedger_Project_Design_2026-09-15.md) for the active release scope.

# Recipe Engine Specification

## 1. Purpose

The Recipe Engine evaluates whether a stock matches a reusable investment logic pattern.

It should be deterministic, explainable, testable, and independent from AI-generated summaries.

AI can explain Recipe results, but AI must not secretly decide Recipe results.

---

## 2. Core Engine Responsibilities

The Recipe Engine should:

- evaluate active Eyes
- read normalized data snapshots
- calculate or consume features
- apply Recipe conditions
- detect hard disqualifiers
- produce Eye state
- explain why state changed
- identify supporting evidence
- identify contradicting evidence
- identify stale or missing data
- decide whether an alert should be considered
- preserve evaluation history

---

## 3. Human-Readable First

Recipe logic should be stored programmatically but displayed in human words.

Example:

Technical condition:

drawdown from 52-week high is less than or equal to negative 25 percent

Human display:

Stock is down at least 25 percent from its 52-week high.

The user should not need to read code to understand a Recipe.

---

## 4. Recipe Structure in Human Terms

A Recipe should include:

- name
- purpose
- time horizon
- intended use case
- evidence categories
- positive conditions
- negative conditions
- hard disqualifiers
- state rules
- alert rules
- review cadence
- version
- notes

Avoid overfitting the initial implementation to one Recipe.

The engine should allow more Recipes later.

---

## 5. Evidence Types

A Recipe may use evidence from:

- price behavior
- technical stabilization
- volume behavior
- relative strength
- valuation
- company financials
- news and events
- sector environment
- market environment
- macro environment
- user notes
- event calendar

Not all evidence types are required in V1.

The engine should support partial evaluation when some data is missing.

---

## 6. Condition Types

Conditions may be:

### Required Conditions

Must pass for the setup to advance.

### Supporting Conditions

Increase setup strength but are not required.

### Negative Conditions

Reduce setup strength.

### Hard Disqualifiers

Block, downgrade, or warn against an otherwise attractive setup.

### Review Conditions

Ask the user to review rather than automatically changing to a stronger state.

---

## 7. Hard Disqualifier Behavior

Hard disqualifiers are especially important for bargain-style Recipes.

Examples:

- accounting problems
- fraud risk
- debt stress
- permanent demand collapse
- repeated guidance cuts
- major dilution risk
- management credibility damage
- severe regulatory risk
- loss of major customer
- liquidity crisis

If a hard disqualifier is present, the app should not show the setup as a clean opportunity.

Possible behavior:

- block opportunity state
- move to Thesis Risk Rising
- move to Thesis Broken
- create risk alert
- require manual review

---

## 8. Eye State Machine

Possible Eye states:

- Not Relevant
- Becoming Interesting
- Watch Closely
- Opportunity Zone Forming
- Attention Needed
- Thesis Risk Rising
- Thesis Broken

Rules:

- each Eye has one current state
- state changes must be explainable
- minor noise should not flip states constantly
- state transitions should be logged
- state can move up or down
- high-risk data can downgrade state
- stale or missing data can reduce confidence
- not every state change creates an alert

---

## 9. State Transition Output

Every evaluation should produce:

- current state
- previous state
- whether state changed
- why now
- supporting evidence
- contradicting evidence
- stale data warnings
- missing data warnings
- data quality summary
- suggested user action
- whether alert should be created
- whether alert should be suppressed or grouped

---

## 10. Why Now Requirement

Every meaningful state change and alert must answer:

Why now?

Examples:

Good:

AMD moved to Opportunity Zone Forming because price drawdown, valuation discount, and early stabilization now align for the first time since you created the Eye.

Bad:

AMD triggered.

Why now is one of the most important product requirements.

---

## 11. What Changed Since Last Review

Every Alert Detail and Eye Detail should eventually show changes since last review.

Examples:

- price moved into target zone
- valuation discount widened
- sector stabilized
- earnings date moved closer
- one risk increased
- thesis note is old
- data quality changed
- hard disqualifier appeared

This is essential for a 5-second scan.

---

## 12. Confidence Wording Rules

Avoid fake precision.

Bad:

Confidence: 93 percent

Better:

- Setup Strength: Medium
- Data Quality: Partial
- Thesis Risk: Elevated
- Action Urgency: Review Soon

The app should avoid pretending to be more precise than it is.

---

## 13. Recipe Performance Review

Eventually, the app should help evaluate Recipe quality.

Questions:

- Which Recipes created useful alerts?
- Which Recipes created noise?
- Which conditions were common in good outcomes?
- Which hard disqualifiers helped avoid bad decisions?
- Which Recipes need improvement?
- Which Recipes should be retired?
- Which Recipes work best in which market environment?

This is the long-term edge.

---

## 14. Starter Recipe: Temporary Bargain Sale

Purpose:

Find good companies that may be temporarily undervalued after a meaningful selloff.

Important idea:

Cheap is not enough.

The Recipe should distinguish between:

- good company temporarily mispriced
- value trap with deteriorating business

Possible evidence:

- meaningful drawdown
- valuation below own history
- revenue not collapsing
- margins not structurally broken
- debt manageable
- sector not fully broken
- selling pressure slowing
- no hard disqualifier
- thesis still alive

Possible hard disqualifiers:

- accounting issue
- major debt stress
- repeated guidance cuts
- permanent demand destruction
- severe dilution risk

---

## 15. Starter Recipe: Sector Leader Pullback

Purpose:

Find strong stocks in strong sectors that pulled back into a potentially attractive zone.

Possible evidence:

- company is a relative strength leader
- sector trend remains supportive
- stock pulled back without thesis break
- price approaching support or moving average zone
- volume selling pressure is fading
- broad market not severely hostile

Possible disqualifiers:

- sector breakdown
- company-specific thesis damage
- severe earnings reset
- loss of leadership

---

## 16. Starter Recipe: Bad News Overreaction

Purpose:

Find stocks punished by negative news where the market reaction may be larger than the actual long-term damage.

Possible evidence:

- large negative price reaction
- news appears temporary
- business fundamentals not permanently damaged
- selling pressure starts to stabilize
- no severe credibility or legal issue
- valuation becomes attractive

Possible disqualifiers:

- fraud
- regulatory ban
- permanent demand collapse
- management credibility failure
- repeated negative follow-up news

---

## 17. Starter Recipe: Earnings Reset Recovery

Purpose:

Find stocks that dropped after earnings but may be stabilizing after expectations reset.

Possible evidence:

- post-earnings selloff
- lowered expectations
- price stabilizing after initial reaction
- core business not broken
- margin or revenue trend still acceptable
- analyst revisions no longer worsening

Possible disqualifiers:

- guidance collapse
- repeated misses
- management credibility issue
- debt or liquidity stress
