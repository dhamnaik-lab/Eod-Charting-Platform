# CHART-119 — startup restored price-axis visibility

- **IST timestamp:** 2026-11-21 13:24:35 IST (UTC+05:30)
- **Workstream / authorized root:** `E:\TA Projects\EOD Charting Platform`
- **GitHub source authority:** `main@60a8b6be2b285556e6bec2bedf2b94a05b54c286`; isolated branch `fix/chart119-startup-stale-price-scale-20261121`
- **Issue:** [#119](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/119)

## Objective and previous limitation

An operator restored NSE:SMT at approximately ₹458 per share while the price axis remained around ₹72,000–₹88,000. The display had valid chart bars but invisible candles. F-30 already clears a stale manual price override when **switching instruments**; it does not address startup workspace restoration when the restored tab's instrument identity stays unchanged.

The persisted workspace reader accepts a finite `paneScaleOverrides.price` without checking it against subsequently hydrated candle data. The startup snapshot path restores that override, and the chart renderer intentionally honors it.

## Bounded implementation

1. `src/features/workspace/chartSnapshotHydrationService.ts` — add a startup-only check after chart bars and viewport have been hydrated. If a saved manual price range has **no intersection with any finite visible candle high-low interval**, clear the price-pane override to enable existing auto-fit. If any visible candle overlaps, keep the manual range. Leave the override unchanged if there are no inspectable visible bars. This does not change data hydration, instrument identity, scanner behavior, or render-engine scaling.
2. `src/features/charts/__tests__/chartRequestConsistency.test.ts` — three synthetic cases: disjoint ₹72,000–₹88,000 range vs. ₹458 restored candle clears while preserving an unrelated indicator pane; overlapping saved range persists; ordinary same-symbol hydration preserves a manual range even when disjoint.
3. `HANDOFF.md` — concise current-workstream checkpoint (no prior history rewritten).
4. This record.

## Behavior preserved

- Valid instrument-specific manual price-axis ranges, including partially overlapping ranges, remain enabled after startup.
- Other indicator-pane overrides, drawings, chart types, viewport normalization, active/background tab identity, saved workspace formats (v1), and the existing chart data cache are unchanged.
- Normal same-symbol refresh and instrument replacement retain the existing F-30 contracts; the new check runs only on the initial active-tab startup snapshot hydration.
- Adjusted/raw OHLCV calculations, corporate-action safeguards, scanner routes, SQLite, and `.eod` data are untouched.

## Validation commands and results

- GitHub source reviewed at the exact baseline commit and exact modification anchors checked before publishing the branch. **PASS (source-inspection evidence)**.
- Three synthetic Vitest regressions added; execution **PENDING GitHub Renderer CI**.
- Expected focused command on a Windows checkout of the branch: `npm.cmd test -- src/features/charts/__tests__/chartRequestConsistency.test.ts`.
- Expected broad validation: `npm.cmd run test`, `npm.cmd run typecheck:renderer`, `npm.cmd run build:renderer` (GitHub Renderer CI). **PENDING**.
- Windows portable build and restored-profile visual check: **NOT RUN**; requires a separately authorized build/acceptance and a safe, backed-up profile.
- No local Windows source edits, backup script, database access, builds, or tests performed from this GitHub-only editing session.

## Risks and limitations

- A deliberately saved manual axis that is completely away from **all visible candle prices** will be treated as unusable at startup and reset to auto-fit. This is intentional for chart visibility; partly overlapping scales are preserved.
- The older persisted workspace format has no explicit saved-range instrument provenance. This narrow correction does not add a schema migration or try to infer why a range became disjoint.
- A price range with no valid visible candle data is retained instead of guessing an appropriate range. The correction is not a general-purpose scale repair on every chart operation.
- Automated parity does not establish native WebView2 startup behavior until a Windows smoke check is performed.

## Rollback / evidence

- Branch source was created from immutable GitHub commit `60a8b6be2b285556e6bec2bedf2b94a05b54c286`, which serves as exact rollback authority; revert the bounded PR if acceptance fails. No database rollback is required.
- No Windows `backups/` copy was created because local `E:` files are not accessible here; the baseline GitHub commit remains available. No files under source directories contain build output.
- The PR must **not be merged** until CI validation and the user's acceptance.
