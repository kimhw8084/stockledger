> Historical prototype record. Current delivery scope, verification and remaining gates: [implementation status](docs/production/IMPLEMENTATION_STATUS.md). The [production backlog](docs/production/StockLedger_Improvement_Backlog_2026-09-15.md) defines stable SL work items.

# KNOWN LIMITATIONS

- All market snapshots currently come from a clearly labeled mock adapter.
- Outcome review metrics are placeholders and do not yet use real historical pricing.
- The app uses text inputs for Eye and Decision linking instead of a proper picker flow.
- There is no backend yet, so evaluation, alert generation, and persistence all run locally on-device.
- There are no scheduled refresh jobs or push notifications yet.
- Recipe versioning and evaluation context are now preserved structurally, but recipe editing and version-upgrade workflows are not exposed yet.
- The V1 metric catalog and formula registry are still partial; several metrics remain manual or future/deferred placeholders until real data providers are integrated.
