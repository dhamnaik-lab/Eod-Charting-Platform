# CA R3 — Restricted AGM Single-Cash Wording Recovery

**IST created:** 2026-10-20 04:43:25 IST  
**Workstream root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority candidate:** `Eod Charting Platform Source Code 2026-10-20_043352_IST.zip`; SHA-256 `F76E428C9B7BE2669734324CA1D0D7D0A9C4D3D27E60877D6603DB5898D5C450`.  
**R3 diagnostic-only evidence:** `EOD-CA-R3-Wording-Evidence-20261020-041921.zip`; SHA-256 `B494D33A263F320A32FEDF2BC5CD87857A90A25988A057865E1E7F04CCDFABC0`.  
**Status:** R3 SOURCE CANDIDATE, native Windows verification and one read-only operational acceptance pending. The latest source-only ZIP is user-supplied, not a live repository hash attestation until the guarded runner verifies source files on Windows.

## Objective / previous limitation

Existing Dividend R1 grammar rejects otherwise syntactically simple, rupee-denominated cash-dividend descriptions prefixed by the exact event-context wording "Annual General Meeting And" or "Annual General Meeting/". R2 operational evaluation reconciled 8,694 pending dividends: 1,702 Ready; 6,992 ineligible; 6,545 excluded for unrecognized/qualified wording.

## Files changed

1. `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence.rs` — one anchored AGM prefix allowance in `has_simple_per_share_cash_form`; all other classifier grammar and independent proof gates unchanged.
2. `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence_tests.rs` — positive exact AGM/parser-parity/stored-amount tests, negative revised/percentage/special/compound/unit/multiple tests, and updates to two tests that deliberately asserted the former AGM prohibition.
3. `docs/changes/2026-10-20_0443_IST_CA_R3_AGM_SINGLE_CASH_WORDING.md` — this scoped change record, created in the live `docs\changes` folder by the runner. Historical documentation is not imported as source authority.

## Final implementation candidate

Allow only leading whole-string `ANNUAL GENERAL MEETING AND `, `ANNUAL GENERAL MEETING / ` or `ANNUAL GENERAL MEETING/` followed by the **existing** single plain Dividend/Div label and whole-string explicit positive currency amount `PER SHARE`. Do not allow AGM abbreviation, revised/conditional suffixes, percentage, `PER EQUITY SHARE`, special/multiple, unit, compound, extra numbers, face-value or FY interpretation. Exact old canonical parser acceptance and exact `f64` stored amount parity must still pass before *eligibility*; no alternate parser.

## Preservation

`SPLIT`/`BONUS`, `RIGHTS`, `DEMERGER`, `OTHER`, chart UI, P5 fail-closed, NSE official evidence, current machine identity, verified ex-date/previous close, same-date peer exclusion, explicit user approval, transactional writer, raw EOD immutability and chart-refresh contracts unchanged. `Fetch` and `Load & Validate` cannot write approvals. The user alone authorizes `Approve Ready`. Build metadata generation under `src-tauri-shell\gen` is required by the existing Tauri build system; `dist`, `target`, `release` remain outside source code.

## Evidence / expected effect

Uploaded targeted corpus: 6,545 excluded records, 2,219 unique wording/amount pairs, 576 skeleton templates. Exploratory lexical/amount parity under this **narrower first-R3 rule**: 2,702 rows (720 unique pairs), **NOT** newly Ready or approved. The prior 2,969 broad exploratory subset included distinct `PER EQUITY SHARE`/other forms and is NOT this R3 promise. All canonical Rust parser and other independent backend gates remain authoritative. A read-only application run after native build must establish actual gain from baseline **1,702 Ready dividends**.

## Validation commands and results

- Source-only snapshot ZIP CRC + SHA-256, R2 feature presence; targeted before/after source byte pins: PASS in container.
- R3 corpus integrity + bounded independent lexical match: PASS (2702 candidate records); **not Rust execution**.
- Native `rustfmt --emit stdout` parse-only on exact touched `.rs`, focused `cargo test --offline --manifest-path src-tauri-shell/Cargo.toml --bin eod-charting-platform-shell simple_cash_dividend_evidence_tests`, backend Dividend R1 regression, P4A regression, `npm run typecheck:renderer`, `cargo check --offline`, Windows Tauri release and isolated portable ZIP: **PENDING Windows runner results**.
- Manual app results / new Ready count and no unintended approvals: **PENDING**.

## Risks / limitations

Even explicit AGM cash wording is not independent AGM/shareholder approval proof. Existing official-witness/ex-date, identity, price and user approval checks must never be weakened. No source-specific result beyond evidence-derived wording and amount matches can be declared until native validation and read-only runtime evaluation. Without actual final Ready recount, no estimate is an eligibility decision.

## Rollback

The runner pins the complete uploaded source-only ZIP, saves exact prechange Rust files in `E:\TA Projects\EOD Charting Platform Source Audit`, and restores byte-exact originals on any validation failure, also removing the new change record. No DB, Git, `D:` drive or runtime approval accesses are used by the runner.
