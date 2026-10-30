# CA Dividend Explicit Approve R1 — RESUME1 Bounded Correction

**IST timestamp:** 2026-10-19 15:12 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** 2026-10-19 11:30:09 IST ZIP (`6DFF97E3705A00323FE4ACCF7B84520446D4B68C87E3A71CE4B1F7849F307E8B`).  
**Status:** Correction candidate; Windows validation and user acceptance pending until supported by runner output.

## Objective
Recover from the first explicit dividend Approve package's two failed Rust regressions while retaining the authorized verification→explicit confirmation→guarded write workflow and current accepted behaviour.

## Previous defects / evidence
- R1 application: 57/57 TS tests passed, 115/117 Rust dividend tests passed. Runner stopped and restored 9 original paths.
- `p4a_01_exact_current_simple_cash_dividend_auto_approves_once`: expected one eligible approval but received zero. The positive fixture had only a previous-close EOD bar, not an ex-date/next-trading bar required by the new fail-closed eligibility rule.
- `write_stage_bridge_04_public_bridge_has_no_duplicate_write_owner`: public Tauri write-stage bridge performed cache invalidation and event notification in violation of its transport-only contract.

## Exact source files changed relative to R1 candidate
1. `src-tauri-shell/src/database/corporate_action_imports/auto_approval/write_stage_tests.rs`: add an ex-date EOD bar to eligible fixture setup. Preserve all negative tests for missing/stale evidence, real approval semantics and raw-price immutability.
2. `src-tauri-shell/src/database/corporate_action_imports.rs`: move post-commit cache invalidation and database-changed notification from the public transport bridge into the existing private transaction owner, conditional on `auto_approved > 0`. Transport remains typed mapping-only and retains one private-owner call.
3. This RESUME1 change record. All other R1 candidate files are byte-identical to the failed R1 package; this R1 candidate is applied anew from October 19 baseline after earlier rollback.

## Final implementation and preservation
- Preserve existing strict simple-cash dividend proof, previous-close factor, new valid on/after ex-date EOD guard, exact official witness, identity revalidation, 100-ID batch limit and scope fingerprint.
- Preserve separate user confirmation; no approval or price rewrite during Fetch/Load & Validate; never automatically retry ambiguous write results.
- Preserve Split/Bonus, other CA types, legacy data, UI layout, schema, Plugin P5, and raw `.eod` data.
- The private owner performs post-commit chart/data notifications. A post-commit notification failure must be treated as an **ambiguous result** by the UI, not an invitation to retry.

## Validation commands / actual status
- Source/package hashes and two-source static ownership and fixture proof: verified in the packaging environment.
- Windows `npm run test -- ... seven focused CA files`: pending.
- Windows `cargo test --offline --manifest-path src-tauri-shell/Cargo.toml --bin eod-charting-platform-shell dividend_`: pending.
- Windows `cargo test --offline --manifest-path src-tauri-shell/Cargo.toml --bin eod-charting-platform-shell p4b_`: pending.
- Windows `npm run typecheck:renderer`, `cargo check --offline`, `npm run tauri:build`: pending.
- Portable release and manual acceptance: pending.
- Authoritative actual command outcomes must be obtained from the RESUME1 dated runner report. Do not describe this release as validated before they pass.

## Risks / limitations
- No Rust toolchain or Windows Tauri build environment is available in the packaging container; static checks do not prove compilation.
- Positive fixture update may expose additional previously unexecuted Rust assertions; fail closed, inspect actual output, and avoid unrelated changes.
- Multi-batch explicit Approve may partially commit if a later batch fails; never automatically retry an uncertain batch.
- Eligibility remains limited to current simple NSE cash dividend policy; do not assume all 8,694 pending dividends qualify.

## Rollback
The RESUME1 runner backs up every existing authorized source before apply. On any failure, it restores exact original SHA-256 bytes and removes new tests/docs. No Git, D: access, SQLite modification, database selection or financial write is authorized during runner execution.

## Next step
Run one guarded Windows validation and portable build. After a fully passing native run, perform one controlled portable user acceptance checkpoint with deliberate manual approval only when the user chooses.

## Windows RESUME1 validation results (runner-confirmed)
- IST validation run: 2026-10-19 15:30:43 IST
- Rust parse-only, 7 focused TS CA test files, Rust dividend_ and p4b_ regressions: PASS by native exit code.
- Renderer TypeScript typecheck, Rust cargo check, Windows Tauri release build: PASS by native exit code.
- Evidence report: C:\Users\dharm\Downloads\EOD-CA-Dividend-Explicit-Approve-R1-RESUME1-20261019-152649.txt
- Final user acceptance: PENDING.
