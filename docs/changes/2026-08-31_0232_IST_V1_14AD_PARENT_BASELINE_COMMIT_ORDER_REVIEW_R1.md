# V1.14AD Parent Baseline / Commit Order Review R1

**IST timestamp:** 2026-08-31 02:32:13 IST

## Objective

Determine whether the already-validated 35-path Corporate Action staging scope may be committed directly on Git HEAD, or whether an independent prerequisite baseline must be committed and validated first.

## Source and Git authority

- Git HEAD: `f4278bc62649552f119fa6438b688a10dccef25e`.
- Fresh/live build-relevant source: 508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`.
- R1A-R4-R2 evidence ZIP SHA-256: `8312FFFE190A4F036721B0B675638165BCD96241F7959F44B57BF38B9BE51031`.
- Real index SHA-256 before/after review: `3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A`.
- Real index remained clean; no cached paths were created.

## Accepted CA staging evidence carried forward

- exact accepted CA staged path count: 35;
- raw alternate-index blob verification: true;
- current source full-file bytes equal the accepted HEAD-based staged blob on 25 CA paths;
- current source full-file bytes differ from the accepted HEAD-based staged blob on exactly 10 CA paths;
- those exact remainder paths are:

- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/main.rs`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/corporateActionCompoundValidation.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`
- `src/types/desktop.ts`

This confirms that the accepted R4-R2 staging contract is a **HEAD-based isolated CA representation**, not a commit-ready full-file representation on top of all newer current-source changes.

## HEAD versus validated current source

- Build-relevant current path count: 508.
- Non-CA build-relevant paths whose current bytes differ from HEAD: **401**.
- Build-relevant paths present in current source but absent from HEAD: **301**.

The complete path/hash matrix is stored in `10-parent-baseline-path-matrix.json` in the audit evidence directory.

## Known prerequisite / preservation sentinels

- `src-tauri-shell/src/bhavcopy.rs` — changedFromHead=True; CA-scope=False; HEAD=716BFC19DBCF2C471338B0D3EAEA3C3A0DFDA2747F7F5FDA99280D9189A20209; current=FD88890A7D1A3598C6C4A326BABB541C6181D24D0D2AC8B4B039E38A0BE85849
- `src-tauri-shell/src/database/bootstrap.rs` — changedFromHead=True; CA-scope=False; HEAD=4E2C611EECF7575B5E4811C11D96C9C47D0EB88F200F05968EFA7D6F86C4F348; current=2AC2ECF008735D6F41CD3795D0C4EFB97FD12D247B0AB5FF66A1B6DE008C0DDB
- `src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts` — changedFromHead=True; CA-scope=False; HEAD=; current=5F2E5BA604E671A7748BD69C7020557CE3D9FB9748CB8ACD23CA00263EF1034A
- `package.json` — changedFromHead=True; CA-scope=False; HEAD=DE236ECDF94513EE1B34C2C35EEF6D776781699EC5CC5B2C176A0805BFD8863C; current=62CA8FA100A46242C669877064C2332D93C842B16CC95B72045EC02A17F9F9EA

Historical cumulative baseline R4 authority is `CA_CUMULATIVE_BASELINE_COMPILE_TEST_VALIDATION_BLOCKED`: its HEAD-based cumulative CA candidate reached 271 passed Rust tests but failed four tests in `bhavcopy.rs` / `bootstrap.rs` behavior. Later latest-source validation proved those repaired current-source sentinels green. Therefore a direct CA commit on the old HEAD would knowingly choose a parent that does not represent the validated prerequisite baseline.

Historical cumulative R4 evidence ZIP present in this run: **True**; SHA-256 `7D17B5B0E37DC3B4291D47A633EB8F77E6CE658038EFA76829A30D2263E7A54F`.

## Decision

**Classification:** `DIRECT_CA_ON_HEAD_REJECTED__PREREQUISITE_BASELINE_ORDER_REVIEW_REQUIRED`

`readyForRealStaging = false`

The exact 35-path CA staging scope remains accepted as attribution evidence, but **real CA staging on HEAD is not authorized**.

## Required commit order

1. Identify the non-CA prerequisite baseline that must precede Corporate Action integration. Do not automatically promote every unrelated working-tree change.
2. Validate that prerequisite baseline independently from a disposable candidate.
3. Only after that baseline parent is accepted, rebase/reconstruct the 35-path CA scope on the accepted parent.
4. Re-run staging-scope/raw-blob verification and full relevant regression against the rebased CA candidate.
5. Only then consider real Git staging/commit authorization.

## Files inspected / evidence created

- current post-R4-R2 continuity hashes;
- current source/config sentinels;
- exact R4-R2 evidence ZIP and accepted stage-verification JSON;
- Git HEAD/raw blobs for the 508 build-relevant current paths;
- current working-tree Git status/name-status/numstat;
- recent Git history;
- optional historical cumulative R4 evidence ZIP when still present.

## Files modified

Documentation only: this timestamped review report.

No application source/test/config file, real Git index, database, or application package was modified.

## Risks / limitations

This review rejects **direct CA-on-HEAD** and inventories the current non-CA baseline delta. It does not yet decide that every non-CA changed path belongs in one prerequisite commit. The next review must partition the prerequisite baseline into coherent already-validated change units and identify the minimal parent required for a green rebased CA candidate.

## Rollback guidance

Delete this timestamped report and the external audit directory if the audit needs to be discarded. No source, index, database, or package rollback is required.

## Recommended next step

Review the generated non-CA path matrix and recent Git history to design the prerequisite baseline promotion order. Real `git add` remains prohibited.