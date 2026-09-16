# Release, rollback and incidents

## Release procedure

Use one source tree/lockfile for both operating paths. Reference SL backlog IDs in focused changes. Do not commit exports, credentials, local DBs, generated bundles or browser diagnostics.

1. Use `.nvmrc`; run `npm ci`, `npm run check`, `npm run check:boundaries`, and `npm audit --audit-level=high`.
2. Run `npm run export:all`, install Playwright Chromium, then `npm run test:e2e`. Run Expo diagnostics after runtime changes.
3. For cloud changes, run `npm run test:cloud` on isolated Supabase and review migration/advisor output. Embedded SQL does not verify the gateway/hosted Auth configuration.
4. Before broad/native distribution, test real devices, keyboards, text scaling, both languages, network loss, disk pressure, import/restore and screen readers. Browser emulation is not native certification.
5. Record commit, app/engine/schema/calendar versions, migrations, checks, artifact hashes and open gates.
6. Apply compatible additive server migrations before client enablement. Test staging, confirm backups and retain the preceding artifact before promotion.
7. Review CI and compare local/remote HEAD. Configure required checks/branch protection if supported by the account plan; a workflow file alone is not protection.

CI uses read-only repository permissions, pinned action commits, locked dependencies and separate app/cloud jobs. Dependency updates group the Expo runtime. An audit is a dated check, not a guarantee against future findings. The scoped `xcode → uuid 11.1.1` override preserves its used CommonJS v4 API; recheck when upgrading.

## Rollback

Retain the previous static artifact, but never roll schema-2 data back to the old prototype's destructive normalization. Use a compatible release, tested repair, or explicit validated export restore. No silent database downgrade.

For SQLite: stop writers, snapshot, restore to a new path, run integrity/export checks, then change the scheduler. For managed PostgreSQL: use a project-specific restore plan and repeat Auth/ownership checks before traffic. No production restore was performed during implementation.

## Incident procedures

| Incident | Immediate action | Recovery evidence |
| --- | --- | --- |
| Provider outage/partial data | Preserve observations and blocked runs; suppress actionable output with unknown critical inputs. | Correct source/date/adjustment and complete sessions; no mock replacement. |
| Wrong calculation/source revision | Preserve IDs/raw source; disable interpretation; publish corrected engine/data revision. | Independent fixture and both evidence revisions retained. |
| Save failure | Keep draft; resolve disk pressure/competing session. Do not reset. | Durable revision and exported backup with original records. |
| Corrupt store | Export recovery bytes; explicitly restore previous copy. | Validated restore and original failed bytes retained. |
| Sync conflict | Export local data; compare record versions; stop blind retries. | Explicit content-bound resolution and durable acknowledged merge. |
| Missed worker run | Check sleep, schedule, CSV dates, disk, leases and exit status. | Catch-up tied to expected session, one result/outbox intent per job key. |
| Credential incident | Rotate in owning service, revoke sessions, inspect scoped logs. | Verified rotation without values copied into logs/issues. |
| Billing incident | Billing is disabled; implement lifecycle/reconciliation/refund runbooks before enabling. | Provider event IDs and reconciled server entitlement state. |

Shared support diagnostics may include opaque IDs, versions, event types, timings and error codes. Keep private theses, CSV contents, backups, passwords and tokens out of issues/CI logs.

## Readiness boundary

The local candidate has regression, browser journey and worker restore evidence. Cloud code remains a pilot contract. Native QA, complete localization, list virtualization, normalized local repositories/retention, richer entity routes and managed product features remain tracked in implementation status and the original SL backlog. A successful bundle is not completion of those gates.
