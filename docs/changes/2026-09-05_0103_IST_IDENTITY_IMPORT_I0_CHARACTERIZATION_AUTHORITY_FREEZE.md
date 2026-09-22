# Identity Import I0 — Characterization + Authority Freeze

Status: AUTOMATED PASS / NO PRODUCTION BEHAVIOR CHANGE
Generated: 2026-09-05 01:03:05 IST

## Goal

Freeze current Identity Import behavior before UI/UX simplification.

## Files added

- src\features\corporateActions\__tests__\corporateActionIdentityImportCharacterization.test.ts
- docs\superpowers\specs\2026-09-05-identity-import-i0-characterization-authority.md
- docs\superpowers\specs\2026-09-04-identity-import-read-only-functional-ui-audit.md
- docs\superpowers\specs\2026-09-04-identity-import-control-side-effect-matrix.csv

## Production files modified

- None

## Characterized behavior

- Existing Identity Import controls remain present.
- Download actions remain separate from Apply.
- NSE/BSE Preview actions remain non-applying.
- NSE/BSE Apply actions remain explicit and refresh app/chart context.
- BSE path and Archive Root changes invalidate their corresponding preview state.
- Historical NSE identity import remains an explicit separate write.
- Official source URL settings remain explicit persisted specialist controls.

## Known defects not frozen as desired behavior

- Identity Current shortcut hard-codes NSE semantics; planned for I1.
- Apply is not bound to an exact reviewed preview/source/database fingerprint.
- NSE and BSE previews do not coexist as one combined review model.
- No accepted BSE historical identity importer equivalent to NSE history.

## Validation

- Identity I0 focused characterization: PASS
- Full Corporate Action frontend regression: PASS
- Renderer typecheck: PASS
- DatabaseToolsDialogs production SHA preserved: 8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2
- Official Imports R1C-I1 test SHA preserved: 4F3A7B42F016264AEB0BDDB1C343147FC525947892FDDB89ECD4BB54697E75DF
- Chart price production sentinels preserved.

## Test SHA-256

AAC6D71DAE9E2D89A1D95E2ACD5B4C70777DD636DB2DCEFCD08EABC6745CB03B

## Next

Identity I1: fix the Current shortcut exchange behavior only.
