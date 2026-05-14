# Product Specification

## 1. Core Concepts

### Recipe

A Recipe is a reusable, human-understandable investment logic pattern.

Examples:

- Temporary Bargain Sale
- Sector Leader Pullback
- Bad News Overreaction
- Earnings Reset Recovery
- Forgotten Compounder

A Recipe should be editable, reusable, testable, versioned, and improvable.

### Eye

An Eye is a Recipe applied to one specific stock.

Example:

AMD watched through the Temporary Bargain Sale Recipe.

One stock can have multiple Eyes.

One Recipe can be applied to multiple stocks.

### State

State is the current condition of an Eye.

Possible Eye states:

- Not Relevant
- Becoming Interesting
- Watch Closely
- Opportunity Zone Forming
- Attention Needed
- Thesis Risk Rising
- Thesis Broken

### Alert

An Alert is a decision-relevant event created when an Eye changes meaningfully.

Not every state change needs an alert.

Not every metric change needs an alert.

### Decision

A Decision records what the user did after reviewing an alert or Eye.

Possible decisions:

- Entered
- Skipped
- Snoozed
- Revised
- Rejected
- Marked Thesis Broken

### Outcome

An Outcome is a later review of what happened after the decision.

### Review

A Review is a user or system follow-up on an Eye, Alert, Decision, or Outcome.

---

## 2. Recipe Philosophy

Recipes must be human-readable, editable, reusable, testable, and improvable.

A Recipe should represent a clear investment idea.

Temporary Bargain Sale should not mean:

Stock is down a lot.

That is too shallow.

It should mean:

A good company appears temporarily mispriced because the stock has dropped significantly, valuation has become attractive, the business does not appear permanently damaged, and there are early signs that selling pressure may be stabilizing.

Recipes should combine:

- positive evidence
- negative evidence
- hard disqualifiers
- state changes
- alert thresholds
- user review logic

The app must understand the difference between:

- cheap because temporarily mispriced
- cheap because the business is deteriorating

This distinction is critical.

---

## 3. Recipe Maturity Levels

### Draft Recipe

A rough idea created by the user or AI.

It may use simple conditions and may not be fully tested.

### Active Recipe

A Recipe currently applied to one or more stocks as Eyes.

It should be explainable and usable.

### Reviewed Recipe

A Recipe with enough alert and outcome history to evaluate whether it is useful.

### Improved Recipe

A newer version created after reviewing false positives, false negatives, missed opportunities, and successful outcomes.

Recipe versions should be preserved.

Old alerts and outcomes should remain linked to the Recipe version that produced them.

Never overwrite important history.

---

## 4. Condition Library

The app should eventually support a reusable condition library.

The first version can use simple conditions, but the design should allow condition blocks to expand later.

Possible condition blocks:

- price drawdown
- price near prior support
- moving average recovery
- moving average breakdown
- volume surge
- volume exhaustion
- volatility compression
- relative strength vs market
- relative strength vs sector
- valuation discount vs history
- revenue stability
- margin stability
- cash flow strength
- debt risk
- earnings date proximity
- negative news cluster
- sector strength
- broad market stress
- macro risk

Each condition should be displayable in human language.

Example:

Technical condition:
drawdown from 52-week high is less than or equal to negative 25 percent

Human display:
Stock is down at least 25 percent from its 52-week high.

Human-readable first, technical second.

---

## 5. Hard Disqualifier Principle

Recipes must support hard disqualifiers.

A hard disqualifier is a condition that blocks, downgrades, or warns against an otherwise attractive setup.

Examples:

- accounting problems
- fraud risk
- severe debt stress
- permanent demand collapse
- repeated guidance cuts
- major dilution risk
- management credibility damage
- severe regulatory risk
- loss of a major customer
- business model deterioration
- liquidity crisis

This is especially important for bargain-style Recipes.

The app must help avoid value traps.

---

## 6. Eye Philosophy

An Eye is not a price alert.

An Eye is a living monitor.

It should tell me where a stock currently stands under a specific Recipe.

Example Eye summary:

AMD is becoming interesting under your Temporary Bargain Sale Recipe.

The stock is down significantly from its recent high, valuation is more attractive than before, and selling pressure has started to slow.

However, earnings are approaching and analyst revisions are still weak.

This is much more useful than:

AMD alert triggered.

---

## 7. Eye State Machine

Eye states should behave like a simple explainable state machine.

Rules:

- each Eye has one current state
- every state change must have a reason
- every state change should be logged
- not every state change creates an alert
- minor metric noise should not constantly flip states
- user should be able to see state history
- Eye should be allowed to move upward or downward
- stale or missing data should affect state confidence

Possible transitions:

Not Relevant → Becoming Interesting

Becoming Interesting → Watch Closely

Watch Closely → Opportunity Zone Forming

Opportunity Zone Forming → Attention Needed

Opportunity Zone Forming → Thesis Risk Rising

Attention Needed → Thesis Broken

Thesis Risk Rising → Watch Closely

State changes should include:

- previous state
- new state
- why now
- supporting evidence
- contradicting evidence
- missing or stale data warnings
- recommended user review action

---

## 8. Thesis Snapshot Requirement

When an Eye is created, the app should preserve the original context.

The snapshot should include, where available:

- original user thesis
- original stock price
- original date
- original Eye state
- original key metrics
- original notes
- original concerns
- original intended review cadence
- original data freshness status

Later, the app should compare the current state to the original snapshot.

This is central to solving memory decay.

---

## 9. Alert Philosophy

Alerts must be rare, useful, and context-rich.

The app should not spam me.

Alert only when something meaningful changes.

Good alert reasons include:

- an Eye changed state
- a stock entered an important opportunity zone
- a stock strongly matches a Recipe
- a major risk appeared
- the original thesis may be broken
- a key condition changed
- a setup is close to becoming actionable
- a setup is becoming stale
- a previous opportunity materially improved or deteriorated

---

## 10. Alert Quality Bar

An alert is good only if it helps the user make or preserve a better decision.

Every alert should answer:

- What happened?
- Why now?
- Why does it matter?
- Which Recipe detected it?
- What evidence supports it?
- What risks should I check?
- What changed since last review?
- What can I do next?
- Is any data stale, missing, partial, or low-trust?

Good alert:

AMD is now in Opportunity Zone Forming under Temporary Bargain Sale.

Why now:
The stock entered the target drawdown zone, valuation is below its recent historical range, and selling pressure has slowed.

Risks:
Earnings are close, analyst revisions remain weak, and the sector is not fully recovered.

Suggested action:
Review, snooze, revise, or mark invalid.

Bad alert:

AMD moved today.

---

## 11. Alert Cooldown and Deduplication

The app should avoid annoying repeated alerts.

Rules:

- do not alert repeatedly for the same reason
- group related alerts when practical
- suppress low-value repeated changes
- allow snooze
- support alert priority levels
- allow user to mark whether an alert was useful
- avoid re-alerting unless new evidence appears or state changes materially

Alert priority levels can include:

- Quiet Update
- Review Soon
- Attention Needed
- Thesis Risk
- Thesis Broken

---

## 12. Decision System

Every important alert should lead to a decision opportunity.

The app should make it easy to record:

- I entered
- I skipped
- I snoozed
- I revised the Eye
- I rejected the setup
- I marked the thesis broken

The decision log should capture enough context to be useful later.

The user should be able to answer:

- What did I decide?
- Why did I decide that?
- What was the Eye state at the time?
- What evidence was visible?
- What changed since the original thesis?
- What happened afterward?

Suggested decision prompts:

- Why did you enter or skip?
- Was the original thesis still valid?
- What risk concerned you most?
- Did the alert arrive too early, too late, or at the right time?
- What should this Recipe learn?

The app should not only help me find opportunities.

It should help me learn from my decisions.

---

## 13. Outcome Review

Outcome review should support windows such as:

- 5 trading days
- 10 trading days
- 20 trading days
- 60 trading days

Outcome review should help answer:

- Did the stock move as expected?
- Did I enter too early?
- Did I enter too late?
- Did I skip a good setup?
- Did the Recipe produce a false positive?
- Did a hard disqualifier save me?
- Which condition mattered most?
- Which condition created noise?

The goal is not to prove perfection.

The goal is to improve Recipes through real feedback.

---

## 14. Recipe Improvement Workflow

After outcomes, the app should help decide whether to:

- keep condition
- remove condition
- lower weight
- raise weight
- add hard disqualifier
- duplicate Recipe
- retire Recipe
- create improved version
- change alert threshold
- change review cadence

Long-term value comes from improving my personal Recipes over time.

Monitoring is only half the product.

Learning from outcomes is the other half.

---

## 15. Manual Override Philosophy

The user should always be able to override the system.

The app should allow:

- manually change Eye state
- mark thesis broken
- pause Eye
- snooze Eye
- force review later
- disable noisy condition
- duplicate Recipe and edit
- add personal note
- mark alert useful or not useful

The app supports human judgment.

It does not replace it.

---

## 16. Anti-Chasing Logic

The app should eventually help prevent late chasing.

It should detect when:

- stock has moved far beyond planned zone
- risk/reward no longer matches original setup
- alert is late
- setup may already be missed
- user is considering entry outside original conditions

Preferred wording:

This may no longer be the original opportunity.

Avoid encouraging late entry.

---

## 17. Stale Thesis Detection

The app should eventually detect when an Eye may need thesis refresh.

Possible stale thesis signals:

- Eye has been active too long without review
- user notes are old
- price has changed materially
- major data changed since thesis creation
- earnings or major events occurred
- state changed multiple times without user review

The app should be able to ask:

Should you refresh this thesis?

---

## 18. Review Cadence

Not every Eye needs constant alerts.

Each Eye should eventually support review cadence such as:

- review weekly
- review after earnings
- review if state changes
- review if price enters zone
- review if thesis risk rises
- review manually only

This supports multi-month opportunities without alert noise.

---

## 19. Starter Recipes

Seed the app with editable starter Recipes.

They should be useful but not treated as perfect.

### Temporary Bargain Sale

Find good companies that may be temporarily undervalued after a meaningful selloff.

### Sector Leader Pullback

Find strong stocks in strong sectors that pulled back into a potentially attractive zone.

### Bad News Overreaction

Find stocks punished by negative news where the market reaction may be larger than the actual long-term damage.

### Earnings Reset Recovery

Find stocks that dropped after earnings but may be stabilizing after expectations reset.

Starter Recipes should be simple enough to understand but structured enough to be useful.
