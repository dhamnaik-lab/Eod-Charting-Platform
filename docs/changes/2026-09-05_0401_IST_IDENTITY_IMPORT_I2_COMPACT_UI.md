# Identity Import I2 — Compact UI

Status: AUTOMATED PASS / MANUAL UI CHECK REQUIRED
Generated: 2026-09-05 04:01:08 IST

## Objective

Replace the flat Identity Import toolbar with compact Exchange/Source workflow controls while preserving existing NSE/BSE identity backend operations.

## Production file modified

- src\components\DatabaseToolsDialogs.tsx

## Test authority intentionally evolved

- src\features\corporateActions\__tests__\corporateActionIdentityImportCharacterization.test.ts
- pre-I2 test SHA: AAC6D71DAE9E2D89A1D95E2ACD5B4C70777DD636DB2DCEFCD08EABC6745CB03B
- post-I2 test SHA: D166EDA0C1B1D98035360F24329D299369FBAF54F55DBB5D476D867B5F22FB7A
- I1 Current regression pre-I2 SHA: C0BA9E5EBF9BC1ED7FBC75932840FBD9295EF383B6D28EE94DB8EB8951264A03
- I1 Current regression post-hardening SHA: E5D139A712C7FD7DD7D9D5725ACACCD5E407C3F3AE6CDCEC5302F898EEDC3E77
- I1 change is test-only whitespace normalization; production Current semantics unchanged.

## Final implementation

- Exchange selector: NSE / BSE
- Source selector: Official / Manual
- Refresh NSE Sources: current master bundle + de-listed workbook
- Refresh BSE Sources: existing Active + De-listed + Suspended lifecycle download
- Manual NSE Archive Root + Browse Folder
- Manual BSE Master CSV + Browse File
- Shared Preview Changes / Apply Reviewed Changes controls
- Import Historical Identity remains NSE-manual-only
- Current renamed to Current Chart with I1 logic preserved
- compact 24-28 px Identity-specific controls

## Explicitly not changed

- Manual Entry
- Identity backend/database semantics
- Preview-to-Apply binding semantics
- combined NSE+BSE preview model
- BSE historical identity parity
- Official Imports R1C-I1
- chart-price formatting
- package dependencies

## Validation

- I1 hardened regression on unchanged post-I1 source: PASS
- I2 TDD RED: PASS
- I2 focused GREEN: PASS
- evolved Identity characterization: PASS
- I1 Current regression: PASS
- full Corporate Action frontend regression: PASS
- renderer typecheck: PASS
- renderer build: PASS
- portable Windows build: PASS

## Hashes

- DatabaseTools preimage: A24C71AD7A7EF8BEB21DEB6E1FEF06D020A641089100C671C163027A92392305
- DatabaseTools postimage: 2754864BE58B1CFD62A091AB7991533881BA982C23B875D587A0BE5F0A9C9412
- portable: C0EA875DF0B316D0CE87E7676D077C64264AD691EB384F7EDD1D75FCC7FB318E

## Manual checkpoint

Confirm the compact Identity layout visually, verify NSE/BSE and Official/Manual selectors, Browse controls, shared Preview/Apply controls, Historical Identity visibility, Current Chart label, and absence of the legacy flat toolbar.
