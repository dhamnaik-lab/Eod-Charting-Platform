# Corporate Action Auto-Approval R1 — Final Closeout / Current Source-Runtime Authority

**Status:** SOURCE / RUNTIME ACCEPTED — STANDARD USER PACKAGE REFRESH PENDING

**Date:** 2026-09-22 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Policy:** `AUTO_APPROVAL_SAFE_V1`  
**Source authority:** `561` source files / `555` protected source files  
**FIX3 failure evidence SHA-256:** `7DDF468D7138F5DA6A5A40F92BC3BCE0B87307289EEEBCB2EA96A55527EA40DE`  
**FIX4 verifier evidence SHA-256:** `575BBA4E20BE09DA4738E958BEEC0A3B80AB541E901930B5C47499D2BA2146BD`  
**FIX5 verifier evidence SHA-256:** `CD4500259F3A92A6FDA8DAA1797436521EB0BCB10BDC3284E5F9C895EC0071B2`  
**FIX3 PRE backup SHA-256:** `BA9E4E269E283A6E5B4306DA0D6C822D6DC565B5DC7E6FB6422A0FFBF610CEE8`  
**Controlled EXE SHA-256:** `65971AB7D5523FFEDFA75ADAD74ED7C2CE1B4D372A07DB9D4797609B7ED7D0C7`

## Accepted R1 boundary

NSE `SPLIT` / `BONUS` only; machine-proven identity; current `MATCHED` validation at confidence `>= 0.95`; no manual/ISIN/price exception provenance; no compound same-date automatic approval; existing canonical approval writer; `AUTO_APPROVAL_SAFE_V1` audit mandatory; manual approval preserved; Dividend/Rights/BSE remain separately gated.

## Real TEST-DB acceptance

The exact controlled `561/555` build completed production `Load & Prepare` and reported `Auto-Approval Safe V1 approved/linked 6`. FIX6 performed no new live write. It recovered acceptance by comparing the preserved PRE backup with a fresh writer-excluded stable copy of the already-mutated TEST DB.

The PRE rollback transaction allocated temporary AUTOINCREMENT action IDs. Those temporary IDs are not semantic authority for newly created canonical actions. FIX6 requires exact IDs for the three `LINKED_EXISTING` rows and verifies those links with the exact production `find_existing_corporate_action` predicate. For the three `AUTO_APPROVED` rows it mirrors `record_price_adjustment_action`: raw historical import ISIN remains on the import/history evidence, while the newly created canonical action must use `resolve_instrument_context()` current symbol/ISIN. Whenever raw and canonical ISIN differ, pre-existing machine identity proof is required. New actions must still form a one-to-one mapping to exactly three new canonical actions.

- import `12685` `KSB` `BONUS` `2011-04-18`: `LINKED_EXISTING` -> live canonical action `451` (PRE rollback observed `451`)
- import `16093` `BBOX` `BONUS` `2012-12-19`: `LINKED_EXISTING` -> live canonical action `414` (PRE rollback observed `414`)
- import `22969` `NAVA` `BONUS` `2016-09-01`: `LINKED_EXISTING` -> live canonical action `335` (PRE rollback observed `335`)
- import `24025` `GAYAPROJ` `SPLIT` `2017-02-10`: `AUTO_APPROVED` -> live canonical action `11417` (PRE rollback observed `11417`); raw ISIN `INE336H01015` -> canonical `GAYAPROJ` / `INE336H01023`; machine proof `VERIFIED_QUICK_RESOLUTION`
- import `36026` `SOTL` `BONUS` `2007-01-17`: `AUTO_APPROVED` -> live canonical action `11419` (PRE rollback observed `11418`); raw ISIN `INE035D01012` -> canonical `SOTL` / `INE035D01020`; machine proof `VERIFIED_EVENT_IDENTITY_RESOLUTION`
- import `42274` `PARSVNATH` `SPLIT` `2010-10-18`: `AUTO_APPROVED` -> live canonical action `11418` (PRE rollback observed `11419`); raw ISIN `INE561H01018` -> canonical `PARSVNATH` / `INE561H01026`; machine proof `VERIFIED_QUICK_RESOLUTION`

Verified totals:
- Quick Resolve transitions: `1221` exact;
- eligible Auto-Approval/link outcomes: `6` exact;
- new `AUTO_APPROVAL_SAFE_V1` audits: `6` exact;
- new canonical actions: `3` exact;
- new decision rows: `1227` exact;
- forbidden manual/exception decisions: `0`;
- scan scope/results: one `official_imports` run / `112` exact results;
- eligible binary EOD: unchanged;
- `instruments`: unchanged;
- `instrument_identity_history`: unchanged;
- import evidence: unchanged;
- schema version: `87` unchanged.

## Preserved authority

AUTO-ID1 and 20MICRONS remain closed/current. `PENDING_ISIN_MISMATCH`, explicit manual approval, raw-price behavior and all deferred action/exchange classes remain unchanged. No production source or schema change was introduced by FIX6.

## Deployment limitation / next gate

The ordinary user-launched package observed before FIX3 was stale. Source/runtime acceptance is complete, but the standard user package still requires a separately gated refresh from the accepted source. After that package refresh is verified, create the next local Snapshot V3 and update remote Git authority as part of the final packaging cycle.
