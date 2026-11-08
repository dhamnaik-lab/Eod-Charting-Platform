# B11 — Compile-time, per-indicator settings-schema field validation

- **IST timestamp:** 2026-11-08 14:44 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform; authorized Windows root `E:\TA Projects\EOD Charting Platform` (not accessed).
- **Source authority:** GitHub `main` at `55c7436745f4661451d1e40a5398b22713021231` (B00–B10 already merged); issue [#40](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/40), master register [#28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), draft PR [#81](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/81).
- **Scope:** One bounded schema-type correctness improvement. Separate merge approval required. No B12 or other issue started.

## Objective / previous defect

`IndicatorSettingsDialog.tsx` declared generic fields with `key?: string` and used `Partial<Record<IndicatorKind, IndicatorSettingsSchema>>` without checking the field key against each `ChartIndicator` variant. Incorrect keys could silently pass TypeScript, resulting in saved form fields disconnected from actual indicator values. B08 (STDEV Source), B09 (TWAP Period), and B10 (missing settings) illustrate the need to retain correct bindings.

## Files modified or created

1. `src/components/IndicatorSettingsDialog.tsx`: add type-only `ChartIndicator` import; retain literal field names and field categories in existing numeric/source/color/pattern field factories; check each descriptor against a mapped `ChartIndicator`-kind contract using TypeScript `satisfies`. Validate plot color-fallback keys against the same indicator's string-valued color properties. Keep current form renderer, field order, source semantics, transforms, and data flow unchanged.
2. `src/indicators/__tests__/indicatorSchemaTypingB11.test.tsx`: positive and negative TypeScript assertions (including `@ts-expect-error` checks for STDEV Source, TWAP Period, cross-indicator names, number/color mismatches, CPR Source and invalid MACD plot color). Four runtime Vitest tests verify B08/B09 controls, B10 STOCHRSI field order, CPR/AVWAP empty Inputs, and preserved legacy saved keys on JSON restore.
3. `docs/changes/2026-11-08_1444_IST_B11_KIND_TYPED_INDICATOR_SCHEMAS.md`: this IST change record.

## Type-level implementation and behavior preserved

- Type acceptance is checked against `Extract<ChartIndicator, { kind: K }>` for each concrete indicator, not a union of unrelated field names.
- Numeric fields must refer to declared numeric properties; source controls must refer to declared `source` properties; color fields/fallbacks must refer to declared string colors (including existing numbered MA Ribbon `color1`–`color4` fields); pattern controls are PATTERN-only.
- All existing explicit indicator schemas remain in the original order. Shared descriptors (`standardSourceSchema`, `standardPeriodSchema`, and shared color arrays) are retained. The runtime indicator editor still uses `IndicatorSettingsSchema` and the existing field rendering and mutation functions.
- Existing calculations, defaults, overlays, legend labels, plot rendering, source selection, persistence shape, legacy STDEV/TWAP metadata and AVWAP anchor behavior remain untouched. Type declarations and compile-time assertions generate no new application behavior.
- No dependency, backend, database, packaging, or local checkout change.

## Actual validation evidence

- Initial type-validation implementation: [GitHub CI #42465992790](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42465992790): Vitest PASS and renderer build PASS, but TypeScript **FAILED** with four TS2322 errors on valid `MA_RIBBON` numbered color keys (`color1`–`color4`). This was **not** counted as passing CI.
- Correction: recognize `color`, keys ending with `Color`, and `color${number}` *only when the property exists and is a string in the current indicator's declared variant*. Added positive type assertion for `MA_RIBBON.color1`.
- [GitHub CI #42466127427](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42466127427), tested code/test commit `01e68e933626e6b46b23635f26707eca842ae7d6`: **SUCCESS**. `npm test`: 232 test files passed, 1 skipped; **1,554 tests passed, 1 skipped, 0 failures**; B11 runtime suite **4/4 passed**. `npm run typecheck:renderer`: **PASS** (including type-only invalid-key checks). `npm run build:renderer`: **PASS** (Vite built in 6.55 s). `npm ci`: PASS.
- Final-head CI **after this documentation commit must be verified separately**; prior CI is not evidence that the later commit passed.

## Risks / limitations / untested

- TypeScript validation catches nonexistent or category-mismatched declared keys. It does **not** verify runtime correctness of all 118 catalog indicator calculations, numeric bounds, every plot ID, or whether a declared property is consumed by its builder. Future semantic audits remain separate bounded tasks.
- An optional legacy property in a `ChartIndicator` may still be present in storage even if no UI editor exposes it. No migrations or destructive edits performed.
- Windows manual settings editing, native Tauri/Rust, portable build, real database and live-workspace Save/Reopen **not performed**. One existing Vitest test remains skipped.

## Rollback and next step

Before merge, abandon draft PR #81 without modifying `main`. If later merged, revert only the B11 squash merge after checking intervening work; the change introduces no data migration. Verify GitHub CI on the final documented head, confirm no unrelated changes, then obtain separate merge approval. B12 is not authorized by this task.
