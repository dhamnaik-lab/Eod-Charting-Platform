# Native Rust Scanner completion and TypeScript retirement

**Date:** 21 November 2026 IST  
**Active workstream:** EOD Charting Platform  
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `main@48da280cb37eeeef0e564e1c70b9db20f76bf567` (merge of CHART-119 PR #126).  
**Implementation branch:** `feature/native-scanner-completion-20261121`.  
**Status:** IN PROGRESS; experimental native backend remains OFF by default; TypeScript executor must remain available.

## Accepted milestones, not to reimplement

- PR #124/#125: NS-01..NS-04 Rust scanner core, read-only database selection/identity, bounded parallel workers, AST validation, cancellation, native opt-in, four gap detectors, and paged All History gap-pattern scanning. The Windows 14-symbol Nifty Bank Exhaustion Gap comparison returned **128 TypeScript = 128 Rust**; this was a scoped manual acceptance, not a full-catalog parity proof.
- PR #126: CHART-119 restored-axis guard, already merged and tested. Unrelated to native scanner retirement.
- Existing chart-pattern worker, formula parser, alert accounting, plugin host, and UI remain accepted working behavior. Some code has consumers outside the Scanner Window and cannot be removed wholesale.

## Current verified gaps at the source authority

| Area | Implemented in native | Retirement requirement |
| --- | --- | --- |
| Four gap chart patterns | Yes, Rust detectors and paged history | Preserve exact detector metadata, grouping, cache, cancellation, and 128/128 accepted fixture |
| Core OHLCV scanners (10 definitions) | TypeScript | Port *accepted exact* criteria, numeric values, names, directions, dates, reasons; keep latest-only behavior |
| Daily-market scanners (5 definitions) | TypeScript | Port thresholds, 20-day volume baselines, 52-week semantics and result metadata; latest-only |
| Remaining chart-pattern catalog | TypeScript worker | Port or retain an explicitly supported non-native evaluator; no silent dropping |
| Custom formula scanner | TypeScript | Wire validated scanner-only AST and prove exact parser, warning and result behavior |
| Chart signal rules | TypeScript | Preserve saved signal rules, chart/drawing dependencies and execution semantics |
| Alert rules | TypeScript | Price, indicator, drawing, scanner-match and persisted alert delivery require parity before retiring existing runner |
| External plugin scanners | TypeScript host | Preserve plugin execution and security boundary; do not replace with an untrusted native AST |
| Raw price scans | Available native | Existing registered-DB identity and safety gates mandatory |
| Adjusted price scans | **Blocked** in native by CA-01 HOLD | **No enabling** until issuer-action ownership, T+0 provenance, and adjusted parity are separately approved |
| Numeric AST All History | Bounded 1,000 endpoints | Full-history semantics need explicit EMA/RSI seeding/parity design; do not call current cap complete history |
| Native runtime default | OFF | Enable only after independent full coverage, error/cancel/performance acceptance |

### Migration policy

1. Preserve the TypeScript fallback, native OFF default and CA-01 fail-closed adjusted-price gate throughout implementation.
2. Migrate one self-contained scanner family at a time, with TypeScript-derived fixtures proving match **and** nonmatch, metadata, lookback, as-of dates, window edges and error behavior.
3. For any family whose TypeScript scan is latest-only, native execution must also remain latest-only even when chart-pattern historical scanning is requested. Mixed semantics need an explicit contract or safe whole-run TypeScript fallback; never invent historical matches.
4. Do not infer support from implementation status labels or scanner title alone. Rust capability is explicit and closed-list; unknown or unsupported ids are never evaluated approximately.
5. Performance does not outweigh correctness: bounded per-target reads, no duplicate output, no stale-db events, atomic cancellation and deterministic results with one/two/four workers.
6. Preserve chart-pattern worker for non-scanner chart/UI uses. Deleting `scannerRunner.ts` is a **separate**, last-stage change only after its other callers are inventoried.
7. Keep the control flow local-first and source-only; do not modify `market-data.sqlite3`, raw `.eod`, saved profiles, installed hooks, Cargo defaults or dependency manifests without explicit need.

### Implementation work and gates

| Priority | Bounded delivery | Validation |
| --- | --- | --- |
| P0-CORE | Core OHLCV rule metadata and native route, with whole-run fallback where history semantics differ | Rust focused tests, Vitest adapter parity, renderer CI and Rust CI |
| P0-DAILY | Daily-market criteria, 52-week and volume metrics | Multiple bar windows/thresholds/precision parity fixtures |
| P0-CHART | Remaining chart-pattern detector families | Full metadata, episode grouping, long history, fixture determinism |
| P0-FORMULA | Validated custom formula compiler/AST wiring | Formula parser, indicator warmup, error and cancellation parity |
| P0-ALERT | Preserve all alert triggers and dedup/history | Head-to-head alert rule regression and no-double-notify |
| P1-HISTORY | Full uncapped numeric history where mathematically equivalent | Seeded indicators, paging overlap, all endpoints, changed DB failure |
| P1-PLUGIN | Explicit plugin execution compatibility boundary | Sandbox/host permissions and plugin regression tests |
| P1-ROLLOUT | Native default, deprecation then removal of redundant TS execution | CI, TS typecheck, release build, isolated Windows portable and operator acceptance |
| HOLD | Adjusted native corporate-action reads | Separate CA-01 authority resolution; never unblock incidentally |

### Current branch implementation rule

Begin with **P0-CORE only**. Finish and validate that bounded family before commencing P0-DAILY. The integrated completion branch can accumulate verified stages, but each stage must have its own reviewable evidence and no unvalidated claims. If an initial implementation is partial, mark it accurately rather than claiming entire Rust retirement is done.

### Required evidence and change records

For every source change create `docs/changes/YYYY-MM-DD_HHMM_IST_DESCRIPTIVE_TOPIC.md` with source SHA, objective, files changed, exact behavior, preserved behavior, actual test outputs, known risks, rollback, and follow-up. Document CI separately from Windows native acceptance.

Do not merge this branch or delete the TypeScript engine without a complete acceptance decision. No Windows database, Git worktree, or production executable is accessed by the GitHub-only implementation process.
