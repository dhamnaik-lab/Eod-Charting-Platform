# Deferred work — not authorized by Compact Layout R1

Prepared: 2026-09-19 16:31:34 +05:30. Root: `E:\TA Projects\EOD Charting Platform`.

This is a durable handoff record, not a statement that the issues have been fixed or installed in the user's project logs. Copy it into the project documentation through the controlled docs step; preserve existing history.

| ID | Observation / prior-review finding | Current disposition |
|---|---|---|
| PA-LIST-PERF-01 | Every matching group header is rendered; several readiness/selection traversals occur during parent renders. | OPEN / DEFERRED. Virtualization, bounded presentation and derived-summary caching are not R1 work. |
| PA-SELECTOR-01 | The native Symbol popup can be very long. | OPEN / DEFERRED. R1 retains the native selector and exact option/filter semantics; searchable combobox is separate. |
| RUNTIME-PERF-01 | Operator screenshot reported high GPU activity and system memory pressure while no import was apparently active. Prior source review identified an unchanged continuously called chart overlay as a profiling lead. | OPEN / DEFERRED. Neither memory leak nor GPU root cause is established. No chart-engine edit, tracing instrumentation, acceleration toggle or native profiling in R1. |
| PA-PREP-PERF-01 | Full preparation shown as 5m49s for 32,202 rows. | OPEN / DEFERRED. This is not a scrolling-latency measure. No batching/query/index/matching/validation changes in R1. |
| RUST-WARN-01 | Five unused-import/dead-code warnings in the latest reported portable build. | NON-BLOCKING / SEPARATE CLEANUP. Do not run cargo fix or remove retained owners. |
| GANN-DEFERRED | Prior Gann visual geometry not accepted; default OFF and future save-delay issue retained. | Preserve prior disposition; no work here. |
| BSE-REFERER | Previously recorded transport observation. | Preserve NON-BLOCKING / DEFERRED status. |
| IDENTITY-ER5 | Earlier Identity follow-up deferred. | Not authorized by this layout approval. |

No claim of faster preparation, lower GPU use, lower memory use, or improved list latency may be made from the screen-space reduction alone. Future work needs its own exact baseline, scope and authorization. Do not mix another EOD workstream into the authority chain.
