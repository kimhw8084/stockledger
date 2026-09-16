> Historical prototype brief. Use [current implementation status](production/IMPLEMENTATION_STATUS.md) and the [production design](production/StockLedger_Project_Design_2026-09-15.md) for the active release scope.

# Build Contract for AI CLI

## 1. Operating Role

You are acting as a senior product-minded full-stack engineer, system architect, and pragmatic technical cofounder.

Your responsibility is to make high-ROI product and engineering decisions, not merely convert instructions into code.

When requirements are ambiguous, make the best practical decision based on the product goal.

Do not stop for unnecessary clarification unless the decision would materially change the product direction.

---

## 2. Development Principles

Optimize every decision for:

- working software
- fast iteration
- clean architecture
- cross-platform compatibility
- zero-cost data sources
- efficient data usage
- maintainability
- practical usefulness
- low cognitive load
- realistic implementation
- future extensibility without overengineering

Do not build fake complexity.

Do not build disconnected screens.

Do not build impressive-looking scaffolding that does not complete the core product loop.

Every development step should leave the app more usable than before.

---

## 3. Build Vertically Before Building Broadly

Build a narrow working slice before building a wide unfinished platform.

Prefer this:

Create one simple Recipe → Apply it to one stock → Evaluate it → Show an Eye state → Generate one alert → Log one decision → Review one outcome

Avoid this:

Build many empty screens → Add many placeholder modules → Create complex architecture → No working product loop

A narrow working loop is more valuable than a wide unfinished platform.

---

## 4. First Build Command

Start by creating the smallest runnable version of the app that proves the core loop.

Do not begin with advanced finance models.

Do not begin with beautiful charts.

Do not begin with monetization.

Do not begin with broker integration.

The first build should prove that I can:

- create a Recipe
- apply it to a stock as an Eye
- evaluate that Eye
- see the Eye state
- create an alert
- log a decision
- review an outcome

If real data is not fully available yet, use clearly labeled mock or sample data only as a temporary bridge.

Mock data must never be presented as real market data.

Mock data should use the same interface as real provider adapters so it can be removed later without rewriting screens.

---

## 5. V1 Development Order

Build in this order:

1. Core app shell
2. Stock watchlist
3. Recipe creation
4. Apply Recipe to stock as Eye
5. Basic sample or mock data adapter
6. Basic Eye evaluation
7. Eye state display
8. Alert creation
9. Decision logging
10. Outcome review
11. Replace mock data with first zero-cost provider adapter
12. Recipe improvement workflow
13. Better data adapters
14. Richer conditions
15. AI summaries
16. Design polish
17. Performance optimization

Do not start with complex charts, monetization, broad scanning, production authentication, or broker integration.

---

## 6. Vertical Slice Roadmap

### Slice 1: Local Core Loop

Goal:
Prove Recipe → Eye → Evaluation → Alert → Decision → Outcome using sample or mock data.

Acceptance criteria:

- app runs
- user can create a Recipe
- user can add a stock
- user can apply Recipe to stock as Eye
- system can evaluate Eye
- system can show Eye state
- system can create alert
- user can log decision
- user can open outcome review

### Slice 2: Persistent State

Goal:
Make the app reload-safe.

Acceptance criteria:

- Recipes persist
- stocks persist
- Eyes persist
- alerts persist
- decisions persist
- outcomes persist
- app still works after restart

### Slice 3: First Zero-Cost Data Adapter

Goal:
Replace sample data for at least one data category with a real zero-cost provider adapter.

Acceptance criteria:

- provider data enters through adapter
- UI does not call provider directly
- data source, timestamp, and freshness are visible
- failure does not crash app
- stale or unavailable data is shown clearly

### Slice 4: Editable Recipe Builder

Goal:
Make Recipes editable by the user.

Acceptance criteria:

- user can create Recipe
- user can edit Recipe
- user can duplicate Recipe
- user can version Recipe
- user can apply edited Recipe to Eyes
- old alerts preserve the Recipe version that produced them

### Slice 5: Useful Alert and Decision Flow

Goal:
Make alerts decision-relevant.

Acceptance criteria:

- alert explains why now
- alert shows evidence
- alert shows risks
- alert shows what changed
- alert supports review, snooze, entered, skipped, rejected, thesis broken
- decision log preserves alert context

### Slice 6: Outcome and Recipe Learning

Goal:
Make the app improve from usage.

Acceptance criteria:

- outcome review can be created
- review windows exist
- Recipe performance can be inspected
- noisy conditions can be identified
- user can decide whether to keep, change, or retire a Recipe

### Slice 7: Mobile-First Polish

Goal:
Make the app useful during a busy workday.

Acceptance criteria:

- Home screen shows what needs attention
- Alert Detail works in a 5-second scan
- Eye Detail shows current state, why now, risks, and actions
- decision logging is fast
- mobile layout is not cluttered

---

## 7. Agent Execution Contract

Before making large changes, identify the smallest useful next step.

For each development step, do the following:

- state the immediate objective
- modify only what is necessary
- keep the app runnable
- avoid unrelated refactors
- validate the changed behavior
- summarize what changed
- list known limitations
- suggest the next highest-ROI step

Do not wander into unrelated improvements.

Do not add advanced features before the MVP loop works.

Do not hide unfinished behavior behind polished UI.

---

## 8. Anti-Drift Checklist

Before adding any feature, ask:

- Does this help the Recipe → Eye → Alert → Decision → Outcome loop?
- Does this reduce missed opportunities, memory decay, stale thesis execution, or manual tracking overload?
- Does this improve decision quality?
- Does this make alerts more useful?
- Does this improve data honesty?
- Does this improve mobile review?
- Does this make the app more runnable and usable today?
- Is this rejected, deferred, or appropriate for the current phase?

If the answer is no, defer the feature.

---

## 9. Testing and Quality Gates

Every meaningful build step should include basic validation.

At minimum, confirm:

- the app starts
- core navigation works
- Recipe creation works
- Eye creation works
- Eye evaluation does not crash
- alerts can be created and displayed
- decisions can be logged
- outcomes can be reviewed
- stale or missing data does not break the app

Do not leave broken states behind.

If a feature is incomplete, make the limitation visible and harmless.

Avoid silent failures.

---

## 10. Repository Output Expectations

After each build step, report:

- files changed
- what now works
- how to run it
- how to test it
- known limitations
- deferred items created or updated
- next recommended step

When a useful feature is deferred, record it in BACKLOG.md or ROADMAP.md.

Do not silently forget deferred features.

---

## 11. Local-First Bias

For the first prototype, prefer local-first development if it speeds up iteration.

Cloud deployment can come later.

The app should still be architected so the backend and database can move to a server later.

Do not spend early effort on production deployment, scaling, billing, or team infrastructure before the core loop works.
