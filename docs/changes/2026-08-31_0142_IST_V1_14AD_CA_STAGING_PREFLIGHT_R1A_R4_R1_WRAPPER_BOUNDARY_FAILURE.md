# V1.14AD CA Staging Preflight R1A-R4-R1 Wrapper Boundary Failure

**IST timestamp:** 2026-08-31 01:42:13 IST

## Objective

Record the R1A-R4-R1 result, independently audit its uploaded child evidence, and establish the smallest corrected next operator before any further staging work.

## Previous defect or limitation

R1A-R4-R1 correctly sanitized all five Git-control variables before invoking exact R1A-R3. It also proved the real Git index was clean and recorded pre-child index SHA-256 `3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A`.

The design error was the wrapper boundary: its second sanitation step was placed after the child invocation returned. Exact R1A-R3 throws inside its own real-index postflight with exit 129, so control never returns to that sanitation statement.

## Files inspected

- exact R1A-R4-R1 console output;
- uploaded R1A-R4-R1 child evidence ZIP;
- `100-latest-source-authority.json`;
- `119b-alt-index-hygiene-normalization.json`;
- `121-alt-index-staged-paths.json`;
- `127-alt-index-stage-verification.json`;
- R1A-R4-R1 wrapper source/design.

## Files changed

Documentation only:

- `docs\CURRENT_WORK_STATUS.md`
- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `docs\changes\2026-08-31_0142_IST_V1_14AD_CA_STAGING_PREFLIGHT_R1A_R4_R1_WRAPPER_BOUNDARY_FAILURE.md`

No application source/test/build configuration, real Git index, database, or portable output is changed.

## Final implementation

The continuity state now records that R1A-R4-R1 did not close the preflight but again proved the full 35-path staging scope before the same child-internal postflight failure.

The corrected next design is R1A-R4-R2. It does not alter R1A-R3 staging logic. Instead it catches only the exact known R1A-R3 postflight failure after the child has emitted its staging evidence, sanitizes immediately, independently audits that new child run, and completes the missing real-index/live-source postflight itself.

## Validation commands and actual results

Independent uploaded-evidence audit:

- uploaded evidence ZIP SHA-256: `24B6F030B7FA2B259E620086F1BF08683DEF077063A86EB44374FAF4AD7E9F7B`;
- fresh snapshot authority JSON SHA-256: `0ED9B8062D6B5829F606EBEFDFF856D7C6F79D757E74CA340D0A9147677CCD33`;
- hygiene JSON SHA-256: `59BCE5BF25C734C94A114525E8E160E0C37D84C1719EFABA033568E5D07053D9`;
- staged-path manifest JSON SHA-256: `3401D26A44DD139875504A86D2FAC051C382576A0881C274DC23C229D22B0330`;
- stage-verification JSON SHA-256: `FC781E100B227EC52C896677A91FF850619985C4E262E52C98B4B714CF1EE5DA`;
- staged path count: 35;
- exact staged path sequence: PASS;
- raw alternate-index verification: true;
- fresh snapshot whole-file exact count: 24;
- exact one-byte hygiene POST: PASS;
- exact 10-path latest-source remainder: PASS;
- exact preservation sentinel list: PASS;
- source/config authority before documentation writes: PASS.

## Behavior deliberately preserved

- build-relevant source/config identity `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`;
- exact 35-path CA staging design;
- raw alternate-index verification;
- Watchlist split/reliability correction;
- real Git index;
- production database;
- package output;
- `readyForRealStaging = false`;
- `PARENT_BASELINE_REVIEW_REQUIRED`.

## Risks or limitations

The uploaded child evidence proves the staged scope but does not prove the final real-index/live-source postflight because R1A-R3 terminated before that gate. R1A-R4-R2 must rerun R1A-R3 from scratch and must fail closed unless the child failure is the exact known exit-129 postflight signature and the full emitted evidence matches the locked contract.

## Rollback guidance

Restore the four continuity documents from their PRE hashes printed by this updater and delete this timestamped report. No source or database rollback is required.

## Recommended next step

Run R1A-R4-R2. If it succeeds, independently audit its reports ZIP, update stable continuity docs to mark alternate-index staging preflight closed, and only then begin `PARENT_BASELINE_REVIEW_REQUIRED`.