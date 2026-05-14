# Recipe Builder Foundation Specification

## 1. Purpose

The Recipe Builder exists to help the user create reusable, explainable investment logic without hardcoding each strategy in source code.

The foundation must support this chain:

Raw Data  
-> Metric Formula  
-> Condition  
-> Condition Role  
-> Recipe Logic  
-> Eye Evaluation  
-> Eye State  
-> Alert  
-> Decision  
-> Outcome  
-> Recipe Improvement

The first starter Recipes are examples only. They must use the same foundation as future user-created Recipes.

---

## 2. Product Goal

The builder should feel like a guided investment logic builder, not a random indicator picker.

It should help the user answer:

1. What kind of opportunity is this Recipe looking for?
2. What stocks are eligible?
3. What evidence makes the stock interesting?
4. What confirms quality?
5. What suggests timing is improving?
6. What risks should downgrade the setup?
7. What should completely block the setup?
8. When should the app alert me?
9. When should the app ask me to review again?
10. What should be tracked after I make a decision?

---

## 3. V1 Scope

V1 should prove the smallest useful vertical slice:

- a user can create or view a Recipe
- a Recipe can contain multiple condition roles
- a Recipe can be applied to a stock as an Eye
- an Eye can be evaluated against mock/sample data
- the evaluation produces a deterministic Eye state
- the evaluation explains why the state was produced
- an alert is created when the Eye meaningfully changes
- the user can log a decision
- Recipe version and evaluation context are preserved

V1 data can be mock-backed, but mock status must be visible and must go through the same adapter-style path as future real data.

---

## 4. Future / Deferred Scope

Deferred, not rejected:

- peer comparison frameworks
- analyst revision pipelines
- news clustering and event extraction
- richer quality scoring
- macro sensitivity models
- full event calendar support
- advanced backtesting
- broad market scanning
- broker integration
- production push notifications
- paid data providers

These should be remembered in roadmap/backlog, but not block V1.

---

## 5. Core Model

### 5.1 Metric Catalog

A metric is something measurable or evaluable.

Each metric definition should include:

- `key`
- `name`
- `humanMeaning`
- `formulaKey` or evaluation method
- `requiredData`
- `freshnessExpectation`
- `availability`
  - `automated`
  - `manual`
  - `future`
- `missingDataBehavior`
- `exampleConditions`
- `exampleDisplayText`

### 5.2 Formula Registry

A formula registry maps a metric to a deterministic evaluation method.

Each formula entry should include:

- `formulaKey`
- `name`
- `description`
- `requiredData`
- `outputType`
- `deterministicComputation`

Examples:

- `drawdown_from_52w_high`
- `drawdown_from_6m_high`
- `distance_from_50d_ma_pct`
- `moving_average_reclaim`
- `relative_strength_vs_spy`
- `selling_pressure_cooling`
- `price_inside_entry_zone`
- `days_since_last_thesis_review`

### 5.3 Condition

A condition is a comparison or evaluative rule built from a metric.

Each condition should include:

- `id`
- `metricKey`
- `formulaKey`
- `operator`
- `value`
- `unit`
- `role`
- `label`
- `humanDescription`
- `notes`
- `availability`

### 5.4 Condition Role System

Supported roles:

- `Eligibility Filter`
- `Supporting Evidence`
- `Timing Trigger`
- `Risk Warning`
- `Hard Disqualifier`
- `Review Trigger`
- `Outcome Learning Tag`

The same metric can play different roles in different Recipes.

### 5.5 Recipe Logic Layer

A Recipe should store:

- identity
  - `id`
  - `version`
  - `name`
  - `purpose`
  - `opportunityType`
- guided-builder sections
  - universe / eligibility
  - interesting evidence
  - quality confirmation
  - timing confirmation
  - risk warnings
  - hard disqualifiers
  - review triggers
  - outcome tags
- logic configuration
  - conditions
  - state thresholds
  - alert rules
  - review cadence
  - cooldown / deduplication
- human-readable explanation
- notes

Recipes should be editable and versionable without rewriting source code.

---

## 6. Metric Catalog For V1

V1 should support a mixed catalog of automated, manual, and deferred metrics.

### Automated or Mock-Automated in V1

- drawdown from recent high
- price near support
- stabilization / selling pressure cooling
- valuation discount vs own history
- analyst revision trend placeholder
- earnings proximity
- relative strength vs SPY placeholder
- distance from moving average placeholder
- volume spike / volatility stabilization placeholder

### Manual in V1

- planned entry zone low
- planned entry zone high
- invalidation rule
- manual hard disqualifier flag
- thesis broken flag
- management credibility damage
- accounting issue
- fraud risk
- permanent demand collapse
- severe regulatory risk

### Deferred

- full peer comparison metrics
- analyst consensus revisions from provider feeds
- clustered headline severity
- richer quality and macro models

---

## 7. Formula Registry For V1

V1 formulas / evaluators:

- `drawdown_pct`
  - current price versus recent high baseline
- `near_support_bool`
  - whether price is near prior support zone
- `stabilization_score`
  - simplified cooling / stabilization score
- `valuation_discount_bool`
  - whether valuation is below own recent baseline
- `analyst_revision_trend`
  - improving / flat / weak placeholder signal
- `earnings_soon_bool`
  - event-risk proxy
- `relative_strength_score`
  - simple normalized placeholder versus market benchmark
- `distance_from_ma_50_pct`
  - current price versus mock 50-day average
- `manual_flag_present`
  - true if a named manual risk flag exists
- `days_since_last_review`
  - current date minus stored review timestamp

Later formulas can be added without rewriting the Recipe layer.

---

## 8. Manual vs Automated Condition Strategy

V1 must clearly distinguish:

- automated or mock-automated
- manual
- future/deferred

Missing or deferred data should not be silently treated as false.

Allowed V1 behavior:

- warn about missing data
- mark data quality as partial
- reduce confidence wording
- require manual review

Not allowed:

- pretend missing data passed
- pretend mock data is real

---

## 9. Eye Evaluation Engine

The Eye Evaluation Engine must be deterministic and explainable.

Input:

- Eye
- Recipe
- normalized snapshot / adapter output
- prior Eye evaluation

Output:

- current state
- previous state
- whether state changed
- why now
- supporting evidence
- contradicting evidence
- risk warnings
- hard disqualifiers
- missing data
- stale data
- data quality summary
- recommended user action
- condition results
- whether alert should be created
- whether alert should be suppressed or downgraded

### Evaluation principles

- evaluate conditions by metric + operator + role
- separate condition truth from condition meaning
- map condition results into state thresholds
- prefer explainable heuristics over opaque scoring
- preserve evaluation context for later decisions and outcomes

---

## 10. State Mapping

Stable Eye states:

- Not Relevant
- Becoming Interesting
- Watch Closely
- Opportunity Zone Forming
- Attention Needed
- Thesis Risk Rising
- Thesis Broken

V1 mapping guidance:

- Hard disqualifier present -> Thesis Broken
- Material risk cluster without full invalidation -> Thesis Risk Rising
- Timing trigger + strong evidence + no disqualifier -> Attention Needed
- Timing trigger + enough evidence -> Opportunity Zone Forming
- Evidence building -> Watch Closely
- Early evidence only -> Becoming Interesting
- Little evidence -> Not Relevant

The app should never output “Buy.”

---

## 11. Alert Mapping

Every meaningful alert must answer:

- what happened
- why now
- which Recipe detected it
- what evidence supports it
- what risks should be checked
- what changed since last review
- whether any data is stale, missing, partial, or mock
- what actions the user can take

V1 alert rules should support:

- priority
- cooldown
- deduplication
- review-needed signals
- snooze compatibility

---

## 12. Starter Condition Library

Starter condition templates should cover:

- price drawdown
- planned entry zone
- moving average behavior
- relative strength
- valuation discount
- revenue stability
- margin deterioration
- debt stress
- negative news cluster placeholder
- earnings proximity
- manual hard disqualifier flag
- days since last thesis review

These templates are reusable building blocks, not hardcoded strategies.

---

## 13. Starter Recipes

Starter Recipes must use the same flexible system:

1. Temporary Bargain Sale
2. Sector Leader Pullback
3. Bad News Overreaction
4. Earnings Reset Recovery

### Temporary Bargain Sale example

Possible structure:

- eligibility
  - stock belongs to a user-approved quality watchlist
- supporting evidence
  - meaningful drawdown
  - valuation below own history
  - revenue not collapsing
  - margins not structurally broken
- timing triggers
  - selling pressure cooling
  - price near planned entry zone
- risk warnings
  - earnings soon
  - weak revisions
- hard disqualifiers
  - accounting issue
  - major debt stress
  - repeated guidance cuts
  - permanent demand destruction
  - severe dilution risk

State progression:

- Not Relevant: little evidence
- Becoming Interesting: drawdown / valuation become attractive
- Watch Closely: mispricing + quality evidence present
- Opportunity Zone Forming: timing evidence improves
- Attention Needed: timing + thesis match + no hard disqualifier
- Thesis Risk Rising: important risks appear
- Thesis Broken: hard disqualifier or invalidation present

---

## 14. Acceptance Criteria

The foundation is successful when:

- Recipe logic is flexible rather than hardcoded per strategy
- metrics have formulas or evaluation methods
- conditions have roles
- Eyes evaluate deterministically
- Eye states are explainable
- alerts answer “why now”
- stale, missing, mock, or partial data is visible
- Recipe versions are preserved
- starter Recipes use the same system as custom Recipes
- the app remains runnable
- the core loop works end to end

Recipe -> Eye -> Evaluation -> State -> Alert -> Decision -> Outcome -> Recipe Improvement

---

## 15. First Implementation Target

The first useful implementation should include:

- a metric catalog module
- a formula / evaluation registry module
- richer condition objects on Recipes
- role-aware Eye evaluation
- stored condition results in evaluation output
- version-aware alert / decision context
- clearly labeled mock snapshot path

That is enough to prove the foundation without requiring production-grade data providers yet.
