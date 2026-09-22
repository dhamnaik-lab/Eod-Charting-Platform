# V1.14AD Positional + Contextual Mixed-Hunk Reconstruction Audit

**IST timestamp:** 2026-08-29 12:03:03 +05:30 IST

## Objective

Reconstruct the exact cumulative Corporate Action portions of the nine shared integration files positionally from Git HEAD and the exact R2 full diffs, resolve the five reviewed mixed hunks, and generate a normal context-rich final patch.

## Previous defect / limitation

The R2 zero-context candidate proved hunk attribution but was not safe as a staging patch. A selected subset of zero-context hunks can apply successfully while pure-addition hunks land at incorrect locations because omitted preceding hunks change the new-file coordinate relationship. This audit therefore treats the R2 candidate as attribution evidence only and rebuilds desired bytes from old-file HEAD coordinates.

## Files inspected

- Exact R2 ZIP, candidate, mixed patch, classification JSON, apply result, summary and state.
- Exact nine R2 full HEAD-to-working diffs.
- Current and verified-snapshot copies of all nine shared files.
- Git HEAD blobs for all nine shared files.
- Exact 25-path whole-file-safe CA source/test allowlist.

## Mixed-hunk decisions

- `src-tauri-shell/src/database.rs` hunk 3: **PARTIAL_CA_INCLUDE** — include 5, exclude 2.
- `src/components/CommandPalette.tsx` hunk 3: **EXCLUDE_KEEP_HEAD** — include 0, exclude 22.
- `src/components/DatabaseToolsDialogs.tsx` hunk 77: **INCLUDE_FULL_CA** — include 69, exclude 0.
- `src/components/DatabaseToolsDialogs.tsx` hunk 3: **PARTIAL_CA_INCLUDE** — include 29, exclude 10.
- `src/types/desktop.ts` hunk 10: **EXCLUDE_KEEP_HEAD** — include 0, exclude 63.

## Final shared-file identities

- `src-tauri-shell/src/database.rs` — HEAD `1330B58DC8374BE36A32DBEC017ED3A948C79FDF04AC6ABEF41C56CF055992E9`; final `3B92B18F294621694F3225F18E94C0521564074DE41923B90ADFEA70FEB7D573`; final=current False; final=HEAD False.
- `src-tauri-shell/src/database/eod_data.rs` — HEAD `C6F0C633A578E198E530E12A0F85655A8480891F8EC172568C41FBF08F5E8433`; final `12D10076144FC7E18360533B3F53E426C2A8BE6BF01FCB9EB3130C4D7F12EFE1`; final=current False; final=HEAD False.
- `src-tauri-shell/src/database/instrument_mutations.rs` — HEAD `AB9770284892690A5E2118EF3B7338686DB8F16AF89177A17B7668BCB70171F1`; final `656521287985B46E44518CDE5FFF8A855EC3E76B8D3D25B1AC558BCD2F7C70BF`; final=current True; final=HEAD False.
- `src-tauri-shell/src/main.rs` — HEAD `ABEC59B0C57AB035648019E28A99B03215EF937EDCAD9AD9FE263332F2A7AAEC`; final `BEFC99B30A03BE18FF0750582B005C58A1E306503C47DF3BE882284CA2F59560`; final=current False; final=HEAD False.
- `src/components/CommandPalette.tsx` — HEAD `3BAEB02A1DB70EEC1A04B5C15F33F31645AB9697F8737C0950D46B01005C6283`; final `3BAEB02A1DB70EEC1A04B5C15F33F31645AB9697F8737C0950D46B01005C6283`; final=current False; final=HEAD True.
- `src/components/DatabaseToolsDialogs.tsx` — HEAD `6318A03B59B2D15F26DEBFCB361CED0282D946457AA13CCA5BD17B80DB29CCBD`; final `5D65A2406B6242F04967D9AE6C560E44353DDA67F718B587B8159A7B917AC5F3`; final=current False; final=HEAD False.
- `src/platform/tauriDesktop.ts` — HEAD `5BED38497AD29CCE5DF024C0B27E476F3FA50B6862020F3FB8D4EBE182830C00`; final `5C9153B4925B31A45BF33B0E73A9ABFE6C39F2C361A6AD1136607586088C0836`; final=current False; final=HEAD False.
- `src/platform/types.ts` — HEAD `48806476C653876A3C9DED943C885D5ABCFD150909CC3B5F39D32DF73C4AFB3E`; final `998AB863F39FAE4FC8EF9018D106E583EFC8C74762B1A2F9A65C699BD3826B54`; final=current False; final=HEAD False.
- `src/types/desktop.ts` — HEAD `C340EF0A362C715945D44797E9367DB347C094FBF1182D65851E932A7E203FD9`; final `37FCB52F8D86E0E07A3031B75FC1A798E3ABE901706B660A7B32A53394351404`; final=current False; final=HEAD False.

## Files created

- `30-mixed-hunk-decisions.json`
- `31-r2-zero-context-placement-forensic.json`
- `32-final-nine-file-ca-only-contextual.patch`
- `33-final-nine-file-result-hashes.json`
- `34-final-direct-head-apply.json`
- `35-whole-file-safe-source-test-allowlist.txt`
- `36-positional-contextual-reconstruction-summary.json`
- helper/console/state evidence, this report, and the reports ZIP.

## Files modified

- No production source/config/test file.
- No Git index entry.
- No database.
- No build/package output.

## Final implementation

For every R2 hunk, the helper validates both old coordinates/content against the exact Git HEAD blob and new coordinates/content against the accepted current file. It starts from HEAD bytes, processes hunks in reverse old-coordinate order, applies current slices only for CA_REQUIRED hunks, leaves all NON_CA hunks at HEAD, and applies the five explicit mixed-hunk decisions. It then generates a fresh Git contextual diff from exact HEAD bytes to the reconstructed desired bytes and verifies that patch byte-for-byte in a second disposable HEAD tree.

## Validation commands / evidence

- Exact SHA-256 guards for all R2 authorities and the 25-path allowlist.
- Git index clean guard.
- Per-file current source versus verified snapshot hashes.
- Regenerated `git diff --unified=0` exact hash comparison against each R2 full diff.
- Hunk old/new coordinate and normalized-content checks against exact HEAD/current files.
- Contextual patch generated by Git from a disposable repository seeded with exact HEAD bytes.
- `git apply --check` and `git apply` of the final contextual patch against another disposable exact-HEAD tree.
- Exact final result hash comparison for all nine shared files.

## Actual validation results

- R2 CA_REQUIRED hunks: 50.
- R2 NON_CA hunks retained at HEAD: 198.
- R2 mixed hunks resolved: 5.
- R2 zero-context placement mismatched files: 6.
- R2 zero-context status: **ATTRIBUTION_EVIDENCE_ONLY__NOT_SAFE_FOR_STAGING**.
- NON_CA full hunks applied: 0.
- Final contextual patch SHA-256: `14011DFBD8AD8B5264D77A657215977D6A69FFD8BFB148E8130F6E7A366BBECD`.
- Final patch check/apply: 0 / 0.
- Final patch reconstructs desired bytes exactly: True.

## Classification

**CA_POSITIONAL_CONTEXTUAL_RECONSTRUCTION_COMPLETE__BASELINE_ASSEMBLY_READY**

## Behavior deliberately preserved

- All 198 NON_CA hunks remain at Git HEAD.
- CommandPalette broader redesign remains at HEAD while its existing CA command is preserved.
- Quote Editor imports are excluded from the reconstructed DatabaseToolsDialogs CA import hunk.
- DNN/plugin desktop contracts remain at HEAD.
- Current working-tree source/test bytes and Git index remain untouched.

## Risks / limitations

- This is source-attribution reconstruction only; no compilation/runtime validation has been performed on the assembled cumulative baseline yet.
- The next gate must combine the 25 whole-file-safe CA source/test files with this final contextual shared-file patch in a disposable HEAD tree and run governed validation before any staging.

## Recommended next step

Assemble the exact 25 whole-file-safe paths plus `32-final-nine-file-ca-only-contextual.patch` in a disposable Git-HEAD baseline tree and validate the cumulative Corporate Action baseline there.

**git add is intentionally not executed.**

## Rollback guidance

No production rollback is required because this audit changes no production source or Git-index state. The verified 752-file source snapshot remains the rollback authority.

## Status

**V1_14AD_POSITIONAL_CONTEXTUAL_RECONSTRUCTION_AUDIT_COMPLETE**
