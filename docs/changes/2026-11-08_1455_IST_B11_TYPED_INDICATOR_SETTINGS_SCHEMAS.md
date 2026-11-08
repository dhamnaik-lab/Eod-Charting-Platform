# B11 — Type-safe indicator settings schema fields

- **IST timestamp:** 2026-11-08 14:55 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`; GitHub-only, local checkout not accessed
- **Source authority:** GitHub `main` at `55c7436745f4661451d1e40a5398b22713021231`
- **Tracking:** [B11 issue #40](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/40), [master audit register #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #82](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/82)
- **Scope:** B11 only; no B12 or independent UI correction.

## Objective and previous defect

`IndicatorSettingsDialog.tsx` previously stored schema field names as unrestricted `string`. The `Partial<Record<IndicatorKind, IndicatorSettingsSchema>>` registry annotation checked only the existence of a schema per kind, not whether each number, color, source or patterns field was valid for that specific `OverlayIndicator` union member. B08 and B09 had already exposed ineffective STDEV Source and TWAP Period fields; B10 added the missing STOCHRSI, CPR and AVWAP schemas.

## Changed files

1. `src/components/IndicatorSettingsDialog.tsx`: add an inferred, type-only schema validator and preserve field helper key literals. Number fields must reference a number-typed property; color fields must reference a string-typed property; Source requires a declared source property; Patterns is reserved for PATTERN. The registry is passed through an identity function and keeps its exact keys, entries and ordering. Six compile-time positive/negative type assertions guard representative valid and invalid combinations.
2. `src/indicators/__tests__/indicatorSchemaTypeSafetyB11.test.tsx`: four SSR/workspace compatibility tests for B08 STDEV, B09 TWAP, B10 STOCHRSI, CPR and AVWAP, Save button visibility, and legacy persisted metadata.
3. `docs/changes/2026-11-08_1455_IST_B11_TYPED_INDICATOR_SETTINGS_SCHEMAS.md`: this maintained IST record.

## Implementation and preservation

- **Compile-time:** `CheckedIndicatorSchema<K, Schema>` verifies all defined `inputs` and `style` field keys against `Extract<OverlayIndicator, {kind: K}>` and their value types. Shared field and schema definitions retain literal field keys via generic helpers. The existing schema registry type is derived without widening per-kind keys.
- **Runtime:** The identity function returns the original schema registry unchanged. No new field appears, disappears, changes defaults/order, changes labels, alters edit callbacks, affects Save/Cancel, or changes any indicator mathematical calculation, defaults, workspace serialization or legacy metadata.
- The full current registry is accepted by the TypeScript validator, including previously corrected B08/B09 and B10 entries.
- **Compile-only examples:** reject STDEV Source, TWAP Period, CPR numeric pivotColor and AVWAP Source; accept STOCHRSI number/color and TWAP Source/color. These are checked by the ordinary strict renderer `tsc` command.
- **Bounded limitation:** This validates `inputs` and `style` field definitions. Dedicated plot-control `colorFallbackKey` metadata and whether a mathematically typed field is actually consumed by a particular builder are not statically certified; future separate validation may be necessary.
- No dependency, backend, native, chart calculations, database, schema migrations, packaging or unrelated project files changed.

## Verified validation evidence

Initial type-guard only code commit `8ac30c0110fe083dba3cfc02c74e584ec9bf4425`: [GitHub Actions #42466688494](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42466688494) SUCCESS.

First complete implementation/test commit `a7d02be21a200b388929aad91e179fa12312c3cc`: [GitHub Actions #42466923925](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42466923925) **SUCCESS**. Confirmed from GitHub Actions job steps and logs:

- `npm ci`: PASS.
- `npm test`: PASS, **232 test files passed, 1 skipped; 1,554 tests passed, 1 skipped, 0 failed**.
- New B11 regression suite: **4/4 PASS**.
- B08 STDEV: **5/5 PASS**; B09 TWAP **10/10 PASS**; B10 missing schema **10/10 PASS**.
- `npm run typecheck:renderer`: PASS, validating every field descriptor and six compile-only assertions.
- `npm run build:renderer`: PASS, Vite build completed in 6.38 seconds.

**Required final-head CI:** Reverify GitHub CI on the final commit after this documentation file; the above checks do not constitute evidence for a later head.

## Risks, limitations and untested checkpoints

- TypeScript compile-time guarantees require future schema authors to use these typed helpers, rather than escaping through explicit `any` or unsafe casts.
- Plot fallback settings and behavior-level correctness are not proven by field-existence typing; separate B12-related work remains independent.
- No real Windows Save/Reopen interaction, native Tauri/Rust test, Windows portable build, or real database operations were executed.
- The existing one skipped test remains skipped. No tests disabled.

## Rollback

Before merging, close draft PR #82 without integrating it. If subsequently approved and merged, revert only the B11 merge commit after reviewing intervening changes. No data migration/rollback required; the original untyped schema mapping and field helpers can be restored without changing saved settings.

## Acceptance and next step

Verify full renderer Vitest, TypeScript typecheck and Vite build on the final documented PR commit. Keep PR #82 unmerged until separate approval. B12 remains unstarted.
