# B04 — Keep chart-indicator alerts faithful to plotted sources

**IST timestamp:** 2026-11-08 02:34 IST (UTC+05:30)
**Workstream:** EOD Charting Platform only
**Authorized Windows root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**GitHub repo:** `dhamnaik-lab/Eod-Charting-Platform`
**Pinned current source authority:** `main` commit `42c83e38d63afe3386869d3b204f29654e6f77f7`, tree `b90bb767d3fc74b9f985aebafe556485a116a0ee`
**Tracking:** B04 issue #33, master register #28, draft PR #73
**Isolated branch:** `fix/b04-indicator-alert-source-parity-20261108`
**First tested commit:** `de94010399ca0a3662d6d77f84736f2a688b09ae`

## Objective / previous defect

EMA, RSI and MACD plots use `getSourceValues(bars, indicator.source, indicator.sourceIndicatorId, sourceSeriesMap)` and can compute from Close, High, Low, price composites or a prior indicator. However the existing alert-series contract names only the indicator kind and numeric period(s), e.g. `ema.9` or `macd.12.26.9`, and `buildIndicatorAlertSeriesBundle` **always** computes from Close. Previously, `getDefaultIndicatorAlertPresetForIndicator` and `createIndicatorAlertRule` allowed an alert from a High/Low/composite or chained chart indicator. Such a new alert could silently compare against a different series than the plotted indicator.

## Source authority and files inspected

- `src/features/alerts/indicatorAlertContracts.ts`, `eodAlerts.ts`, `__tests__/eodAlerts.test.ts` — contract generation, Close-only series, rule normalization, completed-bar evaluation and existing regression behavior.
- `src/indicators/standard/moving-averages/ema.ts`, `src/indicators/standard/momentum/rsi.ts`, `macd.ts`, `src/indicators/base.ts`, `src/indicators/registry.ts`, `src/engine/types.ts` — plotted numerical inputs and chained source handling.
- `src/components/ChartPaneControlsOverlay.tsx`, `ChartCanvas.tsx` — pane button, context-menu eligibility, warning toast and rule creation/save.
- Reverified GitHub `main` before B04 and compared it to B03 merged `a72ae1789ce828734600cd0105ac7d3fc2468d0d`. Two intervening commits changed Corporate Actions and handoff files only; no B04 source/tests were modified. Corporate Actions work was not read or reused as the B04 authority.

## Bounded decision

**Reject non-Close or indicator-chained chart alert creation** with specific feedback, rather than add source-specific series keys, alert persistence migration and an expanded computation pipeline. These would be architectural and require separate approval. Close remains supported when source is omitted or explicitly `close`.

## Files modified / created

- **Modified:** `src/features/alerts/indicatorAlertContracts.ts` — central `getIndicatorAlertSourceUnsupportedReason` checks an actual `sourceIndicatorId` and a configured non-Close `source`; `getDefaultIndicatorAlertPresetForIndicator` returns null when the source cannot be represented truthfully by the Close-only alert key.
- **Modified:** `src/components/ChartPaneControlsOverlay.tsx` — for EMA/RSI/MACD with unsupported inputs, show a disabled alert button wrapped in a descriptive title and accessible `aria-label`; supported Close-source pane alert button retains its original action. Other indicator kinds without alert contracts remain unchanged.
- **Modified:** `src/components/ChartCanvas.tsx` — direct alert creation attempts report the specific unsupported-source reason with an error toast and stop before saving, rather than reporting only a generic unavailable preset. Existing Close alert creation, duplicate check, app-settings persistence and success toast are unchanged.
- **Created:** `src/features/alerts/__tests__/indicatorAlertSourceParity.test.tsx` — eight focused tests including independent chart-vs-alert numerical comparisons and input-source rejection.
- **Created:** `docs/changes/2026-11-08_0234_IST_B04_INDICATOR_ALERT_SOURCE_PARITY.md` — this maintained IST record.
- **Not modified:** EMA/RSI/MACD numerical builders, EOD alert evaluator formulas or persistence schema, completed-bar handling, indicator registry, chart store, npm deps/lock, Rust/Tauri, market database, packaging outputs or other audit fixes.

## Exact behavior changed

- New alert presets and rule creation from EMA/RSI/MACD using `high`, `low`, `open`, `hl2`, `hlc3`, `ohlc4`, or a chained `sourceIndicatorId` are rejected rather than silently turned into Close alerts.
- In pane controls, unsupported configurations show an explicit disabled alert affordance with the reason (choose Close/remove chaining). Direct alert actions show the reason via existing toast infrastructure.
- Close and omitted-source indicators continue to use the prior built-in preset/series keys. Generic Close-only indicator alerts (not tied to a specific chart indicator) remain supported.

## Behavior preserved

- For Close inputs, plotted EMA/RSI/MACD and alert series use exactly the same `technicalindicators` operations and parameters; plotted and alert arrays were compared for every completed bar, including MACD signal line.
- Existing saved Close alert rules, normalization, evaluator, duplicate handling, rule scheduling and last-completed-bar trigger semantics are untouched.
- No chart computation changes, indicator math changes, data mutation or background scanning changes. No new network access or libraries.

## Actual GitHub CI — first tested commit

**Run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42413952349
**Head tested:** `de94010399ca0a3662d6d77f84736f2a688b09ae`

| Command / scope | Actual result |
|---|---|
| Checkout, Node 24, `npm ci` | **PASS** |
| `npm test` (full renderer Vitest) | **PASS:** 225 test files passed, 1 skipped; 1,492 tests passed, 1 skipped, 0 failed |
| New `indicatorAlertSourceParity.test.tsx` | **PASS: 8/8** |
| Existing `eodAlerts.test.ts` | **PASS: 18/18** |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS** (Vite 4.25 seconds) |
| Standalone focused Vitest command | **NOT RUN**; focused tests executed inside the full suite |
| Windows portable build, native/Rust, real chart UI/hover tooltip, real market data/API/database | **NOT RUN** (outside GitHub-only B04 correction) |

**Final-head gate:** Creating this documentation file changes the branch SHA. Run and verify a fresh full GitHub Actions CI workflow on that exact final documentation commit before merge recommendation; first-run success does not validate a later SHA.

## Risks and limitations (important)

- **Legacy rule provenance:** A previously saved rule does not record the source used at creation, only the numeric series key and indicator metadata. Existing Close rules must be preserved, so this fix does **not** rewrite/delete historical rules. Any historical alert created when the chart used High/Low/chaining may still evaluate Close. It cannot be safely inferred or automatically fixed without an approved source-aware migration/review.
- **Post-creation edits:** An alert created on Close can subsequently become out of sync if the user later changes the plotted indicator's source while leaving the pre-existing saved alert unchanged. The current rule format does not link evaluation to the latest chart indicator configuration. Closing that gap requires a separate source-versioning/invalidation design and is not claimed here.
- The disabled button's title/ARIA exposes a reason, but real Windows keyboard focus, hover behavior, screen-reader announcement and pane layout have **not** been manually checked.
- The existing EOD alert evaluation context contains market bars, not the chart's current indicator configuration. This task prevents newly invalid alert creation, not a general cross-workspace source migration or dynamic chart-vs-alert linking.
- The user approved a sequential B04–B06 batch; B05 and B06 are **not** started while B04 remains unmerged, per the one-bounded-issue rule.

## Rollback / acceptance

Before merge, close draft PR #73; this does not alter GitHub `main`. If later merged, revert only B04 via a reviewed PR and keep current unrelated changes intact. Do not delete any branch without authorization. Verify five-file scope, final-head green CI, issue and master tracking. User approval is required before merge. If exact parity for legacy or post-edit rules is required, authorize a separate architecture-level remedy first. All Rust/native, portable Windows, real database and manual UI validation remain untested.
