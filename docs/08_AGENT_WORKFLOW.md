# AI CLI Agent Workflow

## 1. Purpose

This document defines how the AI CLI should work on the project.

The goal is to build fast without losing direction.

The AI CLI should act like a practical technical cofounder, not a passive code generator.

---

## 2. Before Starting Work

Before making changes, review:

- 00_MASTER_BRIEF.md
- 01_BUILD_CONTRACT.md
- current ROADMAP or BACKLOG
- current known limitations
- current app state

Then identify the smallest useful next step.

Do not jump into advanced features.

---

## 3. Work Step Format

For each development step, use this workflow:

1. Immediate objective
2. Files likely to change
3. Implementation
4. Validation
5. Summary
6. Known limitations
7. Deferred items added or updated
8. Recommended next step

---

## 4. Small-Step Rule

Prefer small, runnable increments.

After each step, the app should still run.

Do not make broad refactors unless required to complete the current slice.

Do not add placeholder systems that do not help the core loop.

---

## 5. Validation Rule

Every meaningful change should be validated.

At minimum:

- app starts
- relevant screen opens
- no obvious runtime crash
- new behavior works
- existing core loop still works or remains intentionally incomplete with clear limitation
- missing or mock data is labeled correctly

Avoid silent failures.

---

## 6. Deferred Feature Handling

When a useful feature is not implemented now, record it as:

- Deferred
- Phase-gated
- Rejected

Examples:

Push notifications:
Deferred until in-app alerts are useful.

Broker integration:
Phase-gated until monitoring, alerts, decision logging, and outcome review prove value.

Fake AI buy/sell guru:
Rejected.

Do not silently forget deferred features.

---

## 7. Documentation Maintenance

Maintain these project memory files as the project evolves:

- ROADMAP.md
- BACKLOG.md
- DECISIONS.md
- CHANGELOG.md
- KNOWN_LIMITATIONS.md

If they do not exist yet, create them when useful.

### ROADMAP.md

Tracks phases and major future direction.

### BACKLOG.md

Tracks deferred and phase-gated features.

### DECISIONS.md

Tracks important architecture and product decisions.

### CHANGELOG.md

Tracks what changed over time.

### KNOWN_LIMITATIONS.md

Tracks current limitations, mock data, missing providers, partial features, and technical debt.

---

## 8. Decision Logging for the Agent

When making an important decision, record:

- decision
- reason
- alternatives considered
- tradeoff
- whether it is temporary
- whether it affects future roadmap

This prevents future sessions from losing context.

---

## 9. Anti-Drift Checklist

Before adding a feature, ask:

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

## 10. Output Summary After Work

After completing a step, summarize:

- what changed
- how to run it
- how to test it
- what now works
- what is still missing
- what was deferred
- next recommended step

Keep summaries practical and honest.

---

## 11. Do Not Hide Incomplete Work

If a feature is incomplete, show that clearly.

If data is mock, label it.

If data is stale, label it.

If provider integration is missing, say so.

If evaluation is partial, show what is missing.

Honest partial progress is better than fake completeness.

---

## 12. First Recommended Task

Start with the smallest local core loop.

Build:

- basic app shell
- stock list
- Recipe creation or starter Recipe
- apply Recipe to stock as Eye
- sample/mock data adapter
- simple Eye evaluation
- Eye state display
- in-app alert list
- decision log
- outcome review placeholder

Then validate that the loop works end to end.

Only then replace mock data with zero-cost provider adapters.
