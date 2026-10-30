# CA R2 Cash-Reason Regression Assertions — RESUME2

**Timestamp (IST):** 2026-10-19 1835 IST  
**Active workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Status:** SOURCE CANDIDATE ONLY; native Windows results and manual acceptance PENDING.  
**Authority snapshot:** `Eod Charting Platform Source Code 2026-10-19_175452_IST.zip`, SHA-256 `E842455AB9CF9C4FF38AC292A971CD78FEB5AE5995D7CCB24E9957A030946CC4`.  
**Parent candidate:** `EOD-CA-R2-Cash-Reasons-All-Types-RESUME1.zip`, SHA-256 `B46D39F4DC9F324A7C433587DE228616E9CF55DC5473307219E51B4BA9C4A1DF`.  

## Objective / previous limitation
Recover exact R2 Cash Reason reporting + all-type pending/Ready/Blocked coverage after the RESUME1 runner stopped at `RUST_DIVIDEND_CLASSIFIER_AND_POLICY`: 117/118 PASS. Previous TypeScript regression was resolved: 40/40 PASS. Earlier unchanged original bytes were restored by runner (`PASS_ROLLBACK_SOURCE_BYTES_RESTORED`). No accepted R2 portable release exists yet.

## Root cause
The two remaining assertions in `dividend_policy_r1_requires_positive_cash_and_classifier_exact_match` still expected the obsolete substring `classifier`; the new R2 policy returns stable typed reasons: `Parsed and stored cash amounts disagree` and `Special or inclusive multi-component dividend`. Inspection also found the same obsolete wording in `p4a_15_classifier_mismatch_is_ineligible`, a test **not included** by the prior `dividend_` filter. This RESUME2 candidate resolves all three expectations before rerunning native validation.

## Files modified relative to RESUME1
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` — **test assertions only**, in the one existing test; enforce two exact ineligibility reasons, without changing the production evaluator or approval decisions.
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval/write_stage_tests.rs` — **test assertion only**, retain `ineligible=1` and require exact `INELIGIBLE` disposition plus typed reason for special dividend.
- `docs/changes/2026-10-19_1835_IST_CA_R2_RUST_CASH_REASON_ASSERTIONS_RESUME2.md` — this new scoped change record. All nine parent candidate payload files other than the first Rust test block remain byte-identical to RESUME1. One extra existing test file is included for its assertion change.

## Behavior preserved
Strict NSE_API witness, cash amount equality, previous/ex-date EOD proof, current machine identity, duplicate/same-date blockers, explicit approval, batch limits and no automatic approval during Fetch or Load. Existing all-type status calculations and UI are byte-identical to parent candidate. Split/Bonus, Rights, Demerger, Other, database architecture, raw EOD files, backup/evidence, and Plugin P5 fail-closed are unchanged. No D: drive, Git or production DB access authorized in the runner.

## Validation commands and actual results
- Container: complete parent/source ZIP CRC and SHA-256, exact source authority and 10 preservation hashes, typed reason mapping checks, all candidate payload hashes — **PASS** (packager).
- Native Windows: Rust parse-only, 40 focused Vitest, `cargo test --offline ... dividend_` and **new** `cargo test --offline ... p4a_`, renderer `tsc --noEmit`, Rust cargo check, Tauri release/portable integrity — **PENDING actual runner outputs**.
- Full user operational check: **PENDING** after successful build; one read-only Load & Validate and aggregate reason/count export.

## Risks / limits
Text assertions check exact typed diagnostics; any future change to labels requires test review and a new source checkpoint. These are unit/source test repairs, not proof of successful production approval. Do not claim a passing Rust suite or portable build until actual Windows output is available. Unexpected source changes must stop and never be overwritten. No further eligibility grammar expansions without independent evidence.

## Rollback
Guarded RESUME2 runner independently backs up original source bytes in the authorized audit directory. On failure, restores originals by exact pinned SHA-256 and removes new files. Existing accepted portable release and all DB/SQLite components remain untouched. After manual acceptance, update documentation separately and close the bounded issue.
