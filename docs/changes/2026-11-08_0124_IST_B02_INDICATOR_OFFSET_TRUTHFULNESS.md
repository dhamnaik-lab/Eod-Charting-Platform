# B02 — Generic Offset and ALMA/LSMA algorithmic offsets

**Timestamp:** 2026-11-08 01:24 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized local Windows root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Pinned task source authority:** `main` at `56c3a42b7e56413c657a7b7820efa689b677740d` (tree `270c888b32275b4046284b1120a785a505262ddd`)
**Issue:** #31 (B02); **master register:** #28; **draft PR:** #70
**Branch:** `fix/b02-indicator-offset-truthfulness-20261108`
**First test commit:** `caf19ba8e3e68327d2a2071899bff93d2d98280b`

## Objective / previous limitation

After B01, the Indicator Settings Inputs tab still displayed an unconditional generic `Offset (bars)` number control. For normal studies such as EMA, this wrote the `offset` metadata but the renderer did not shift plotted values. The catalog also added an offset suffix to titles regardless of whether it affected the plot. For ALMA and LSMA, this generic input duplicated their real `offset` algorithm parameter, which is **not** a visual bar shift. ALMA changes its Gaussian weighting phase; LSMA changes the regression endpoint. Claiming a common bar shift was misleading and duplicate offset labels were confusing.

## Files inspected

- `src/components/IndicatorSettingsDialog.tsx` — schema-defined ALMA and LSMA fields versus unconditional generic control.
- `src/indicators/catalog.ts` — ALMA/LSMA algorithmic labels and legacy generic offset tag.
- `src/indicators/base.ts` — `buildLineSeries`, `applyOffset` helper, `getPlotOffset` getter.
- `src/indicators/standard/moving-averages/alma.ts` and `lsma.ts` — mathematical offset calculations.
- `src/indicators/registry.ts`, `src/engine/types.ts`, `src/engine/Indicators.ts`, existing `IndicatorsMTFOffset.test.ts`, B01 regression test and workspace persistence reader.
- Read-only GitHub code search found no builder consumer of `getPlotOffset`; Alligator's explicit jaw/teeth/lips shifts use `applyOffset` separately and are preserved.

## Files modified / created

- **Modified:** `src/components/IndicatorSettingsDialog.tsx` — remove unconditional `Offset (bars)` control; leave only schema-defined inputs.
- **Modified:** `src/indicators/catalog.ts` — remove generic `[+offset]` / negative-offset title suffix; ALMA/LSMA algorithm-specific offset values continue to appear inside their parameter titles.
- **Modified:** `src/indicators/__tests__/indicatorTimeframeTruthfulness.test.tsx` — revise B01 expectations that previously explicitly preserved the generic Offset control/tag pending B02.
- **Created:** `src/indicators/__tests__/indicatorOffsetTruthfulness.test.tsx` — seven cases (including two parameterized dialog cases), numeric golden references and legacy restore protection.
- **Created:** `docs/changes/2026-11-08_0124_IST_B02_INDICATOR_OFFSET_TRUTHFULNESS.md` (this record).
- **Not modified:** ALMA/LSMA builders and arithmetic, indicator types, base applyOffset, Alligator code, chart data/serialization, native/Rust, database, lockfile or dependencies.

## Final implementation and exact behavior

- Generic plot-shift control is no longer displayed because there is no supported generic offset mechanism wired to study plots.
- EMA and other non-ALMA/LSMA indicators no longer advertise misleading extra offset suffixes in legends.
- ALMA continues to expose one schema Offset field with its original `0.05` step; LSMA continues to expose one schema Offset field with its original `1` step. Their mathematical offset parameters and values are unchanged.
- Legacy indicator `offset` fields are **not erased, migrated or clamped**. They remain restorable in existing workspace objects, including generic EMA metadata, even though generic visualization of this field is hidden.
- Positive/negative `applyOffset` helper semantics, Alligator's deliberately shifted lines, real chart timeframe, completed-bar behavior, and actual indicator values remain unchanged.

## Validation commands and real GitHub CI output

**First GitHub Actions run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42408286399
**Exact tested commit:** `caf19ba8e3e68327d2a2071899bff93d2d98280b`.

| Validation | Confirmed first-run result |
|---|---|
| Checkout, Node 24, `npm ci` | **PASS** |
| `npm test` (full renderer Vitest) | **PASS:** 223 test files passed, 1 skipped; 1,473 tests passed, 1 skipped, 0 failed (1,474 total) |
| New `indicatorOffsetTruthfulness.test.tsx` | **PASS: 7/7**, including ALMA phase and LSMA endpoint hardcoded golden series (24 ms) |
| B01 `indicatorTimeframeTruthfulness.test.tsx` | **PASS: 5/5** (19 ms) |
| Existing `IndicatorsMTFOffset.test.ts` | **PASS: 4/4** (6 ms) |
| Existing `workspacePersistence.test.ts` | **PASS: 5/5** (7 ms) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**; Vite built in 6.43 seconds |
| Separately invoked focused Vitest commands | **NOT RUN**; these suites were executed and reported within the full renderer suite |
| Real Windows keyboard/dialog/chart visual review; Windows portable build; Rust tests; real database/API reads or writes | **NOT RUN** (out of this scoped GitHub renderer correction) |

**Final-head validation gate:** Creating this IST record changes the PR commit SHA. Verify the **new** GitHub Actions run and its exact source SHA, steps and test counts before recommending merge. Do not treat the first run as a test of the later documentation commit.

## Risk, preservation and limitations

- The historical generic `offset` field can still exist in workspace JSON and other sources; this task does not intentionally scrub it or change formula math. A future fully supported **visual** bar shift must use a separate design/field and numerical non-repainting alignment tests.
- ALMA offset is a Gaussian phase fraction and LSMA offset is a regression-evaluation displacement; they are **not** equivalent to visual array shifting. A single shared visualization field would change accepted numerical behavior and was deliberately not introduced.
- Existing `getPlotOffset` and `applyOffset` helpers were left intact even if not generally wired, preserving other legitimate and potentially future call paths.
- Hardcoded numerical goldens verify deterministic values on sample bars; they do not replace a Windows graphical acceptance check, a production database test, or all historical market-data combinations.
- Generic Offset UI removal and label change are user-visible behavior adjustments. The new PR must be reviewed before acceptance/merge. B03 and other audit items remain separate.

## Rollback guidance / next checkpoint

Before merge, close draft PR #70. If merged later, revert only the B02 change via a reviewed PR, keeping unrelated source authority intact. Verify four code/test changes plus this IST change record, full CI, preserved legacy offset values and ALMA/LSMA UI with a manual Windows checkpoint before closing issue #31. No automatic merge, branch cleanup, source control mutation outside this isolated branch, or database access was authorized.
