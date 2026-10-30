# EOD Corporate Actions — R3 Operational Acceptance & Closeout

**Record timestamp (IST):** 2026-10-20 18:29:26 IST  
**Accepted by user:** 20 October 2026 (IST), explicit approval in current conversation  
**Workstream:** EOD Charting Platform  
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`  
**Scope:** R3 AGM explicit single-cash dividend wording recovery, followed by R3 Dividend Verification Progress FIX1  
**Disposition:** **ACCEPTED — R3 BOUNDED TASK CLOSED** (documentation-only closeout)

## 1. Objective and previous limitation

The application must perform identity, raw-price evidence, cash-amount validation, eligibility and adjustment-factor calculation itself, leaving final financial approval to the operator. R2 recognized only 1,702 of 8,694 pending dividend candidates as Ready and excluded 6,545 records for unrecognized or qualified cash-dividend wording. The original preparation UI displayed `Operation stage: complete` even while the independent Dividend R1 evaluator remained active; elapsed time stopped before verification finished.

**R3 delivery:** A strict AGM context prefix extension to the existing canonical single-cash dividend grammar, with exact stored-cash parity and every independent backend eligibility gate retained. FIX1 distinguished queue preparation from Dividend R1 verification and exposed batch progress and terminal outcomes.

## 2. Exact implementation delivered earlier (not modified by closeout)

**R3 cash-classifier correction:**
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence.rs`
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence_tests.rs`

**R3 completion-state FIX1:**
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/legacy/corporateActionDividendPreparedScopeOrchestration.ts`
- `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts`

The original implementation and FIX1 created their own timestamped `docs/changes` records. This acceptance record is new and does not supersede or rewrite those historical receipts.

**This documentation closeout creates only:** `docs/changes/2026-10-20_1829_IST_CA_R3_OPERATIONAL_ACCEPTANCE_CLOSEOUT.md`.  
**Existing source/configuration files modified by this closeout:** **none**.  
**Database, EOD price files, and financial approvals accessed/modified:** **none**.

## 3. Source authority and preservation

- Source-only authority input: `Eod Charting Platform Source Code 2026-10-20_043352_IST.zip`; SHA-256 `F76E428C9B7BE2669734324CA1D0D7D0A9C4D3D27E60877D6603DB5898D5C450`. R3 AGM applied after 645/645 file authority checks; FIX1 applied after 640/640 immutable source checks and presence verification of five Tauri-generated outputs, including confirmation of the previously accepted R3 change record.
- Two separate external audit-root backups created during the approved Windows implementations:
  - `E:\TA Projects\EOD Charting Platform Source Audit\CA R3 AGM Wording Backup 20261020-044808`
  - `E:\TA Projects\EOD Charting Platform Source Audit\CA R3 Progress FIX1 Backup 20261020-173700`
- The existing UI/UX, other Corporate Action types, backend database architecture, Plugin P5 fail-closed behavior, raw `.eod` data immutability, current identity/ISIN evidence rules, prior/next trading-day price safeguards, duplicate/same-date exclusions, and write-time revalidation remain preserved.
- No Git use, D: drive access, synthetic database, or automatic financial approval is part of closeout.

## 4. Actual automated validation — evidenced, not rerun during closeout

| Scope | Windows validation output | Result |
|---|---|---|
| R3 classifier | Focused Rust tests | 38 passed, 0 failed |
| R3 policy | Dividend-policy Rust regression | 19 passed, 0 failed, as shown in original user execution |
| R3 approval write-stage | Rust P4A regression | 40 passed, 0 failed, as shown in original user execution |
| R3 frontend | Focused Vitest | 20 passed, 0 failed, as shown in original user execution |
| R3 renderer and backend | TypeScript typecheck, Rust check, Tauri Windows build | PASS |
| FIX1 read-only batch progress | Focused Vitest | 51 passed, 0 failed, five files |
| FIX1 build | TypeScript typecheck and Windows Tauri release | PASS |
| Portable archive verification | Both R3 ZIPs | CRC PASS, 35 entries each, matching reported ZIP/EXE hashes |

Supporting original machine-generated transcripts:
- `EOD-CA-R3-AGM-Wording-20261020-044808.txt` — SHA-256 `470E94171F8075BBB8034F8A0C0D8BD417F6AACAC30AD0B63E640F07EAD66273`.
- `EOD-CA-R3-Progress-FIX1-20261020-173700.txt` — SHA-256 `06F639D90688FC2D75FE805C9548C7078A6D092DFC487AE9D660FF83BBB9FFD8`.

Validated portable artifacts:
- AGM candidate: `EOD-Chart-CA-R3-AGM-Cash-Wording-Portable-20261020-044808.zip`, ZIP SHA-256 `3645110FAA562EC4EE995DA33A7D9219B9EBF705E9BFBEE1321F4BD1578792DE`; EXE SHA-256 `333612A3E155B4D3CF6DBF87EC39CCD985659E647D4C70440E1FB36B10E60CAA`.
- Final FIX1 candidate: `EOD-Chart-CA-R3-Progress-FIX1-Portable-20261020-173700.zip`, ZIP SHA-256 `F361BB90EDDCCDE06C5614BEA87FB94570CDF03300C21353E3C7E82F359AFA7F`; EXE SHA-256 `6ED38422255C55065376E5FE83B98E77378AED77B3FC730E231310D775A755A4`.

These tests and builds were completed by the user's PowerShell runner earlier. **No test, build, database query or application execution was repeated during this documentation-only closeout.**

## 5. Manual operational acceptance — 20 October 2026

The final FIX1 portable application was opened against the authorized NSE testing database. The application performed one read-only `Load & Validate`, progressed through the separate Dividend R1 evaluator, and displayed `Operation stage: dividend-verified`. The user supplied final screenshots and both aggregate outputs, then explicitly approved acceptance.

**Dividend R1 evaluation results:**

| Measure | R2 accepted baseline | R3 accepted operational result | Delta |
|---|---:|---:|---:|
| Parsed/Pending candidates evaluated | 8,694 | 8,694 | 0 |
| Eligible / Ready (not approved) | 1,702 | **3,551** | **+1,849** |
| Ineligible within evaluated scope | 6,992 | 5,143 | −1,849 |
| Unrecognized/qualified cash wording | 6,545 | 3,843 | −2,702 |
| Completed evaluator batches | 87/87 | 87/87 | unchanged |
| Failed evaluations | 0 | 0 | unchanged |

R3 verification: requested 8,694, eligible 3,551, ineligible 5,143; reported complete 87/87, zero failed/stale/missing; application reported **Reconciled: YES** and **no approvals occurred**. The read-only operation displayed elapsed time **9m 36s**.

**All loaded corporate actions — final Ready eligibility snapshot**

| Type | Not approved | Ready for explicit approval | Blocked / not ready |
|---|---:|---:|---:|
| SPLIT | 57 | 0 | 57 |
| BONUS | 53 | 1 | 52 |
| DIVIDEND | 14,286 | 3,551 | 10,735 |
| RIGHTS | 379 | 0 | 379 |
| DEMERGER | 7 | 0 | 7 |
| OTHER | 17,892 | 0 | 17,892 |
| **TOTAL** | **32,674** | **3,552** | **29,122** |

The user had left **Other** unchecked for the *filtered view*. The all-action-type summary nevertheless describes the complete 32,674-row pending queue; filtered count was 14,775. These are **eligibility** counts, not approvals or writes. Exactly one Ready action was a Bonus and 3,551 were Dividends. Remaining 29,122 not-Ready actions require independent evidence and are not approved.

**Explicit preservation:** no financial adjustments were approved during testing. The UI retained separate, explicit operator approval controls. No evidence was presented of raw EOD mutation in this R3 operational checkpoint; the acceptance was explicitly read-only.

## 6. Rejection detail / evidence limitation

The final app report stated **29 distinct exact backend rejection reasons** and **5,143 ineligible dispositions**, internally reconciled. Its two largest displayed categories were:
- Unrecognized/qualified cash wording: 3,843.
- No current machine-proven identity: 877.

**Transcription limitation:** the rejection-reason text pasted into the conversation displays **28 reason lines totaling 5,137**, six fewer than the stated app total of 5,143. Do not invent or reassign the missing six. This does **not** invalidate the independently displayed top-level identity `3,551 + 5,143 = 8,694` or the application's reported internal reconciliation. A fully exported 29-line reason record may be retained for later diagnostic work, but it is not required for accepting the bounded R3 success. The six-row detail gap is **documentation-level, not an identified runtime defect**.

No per-record mapping of the 2,702 newly parseable AGM wordings against the 1,849 net Ready gain was provided; the 853 difference must not be attributed to specific blocker causes without ID-level evidence. No eligibility widening beyond the accepted exact AGM forms is authorized by this closeout.

## 7. Rollback guidance

The accepted R3 AGM and FIX1 implementations have existing external backups and unchanged historical change records. If a later regression is discovered, use the exact verified backups and the corresponding bounded change records after obtaining explicit rollback authorization. Do not replace source with the pre-R3 source-only ZIP, and never roll back financial approval records as part of a code rollback. To undo this documentation-only closeout, remove only `docs/changes/2026-10-20_1829_IST_CA_R3_OPERATIONAL_ACCEPTANCE_CLOSEOUT.md` after verifying its installed SHA-256. Preserve audit evidence and accepted portable artifacts.

## 8. Final closeout and next bounded task

**R3 source implementation: COMPLETE; automated Windows validation: PASS; manual operational acceptance: APPROVED; final documentation closeout: ACCEPTED when this record is installed and SHA-verified.**

R3 is closed after installing this document. The broader Corporate Actions automation program remains open: 3,843 excluded cash wordings and other independent dividend blockers, plus blocked Split, Bonus, Rights, Demerger, and Other actions are potential **separate**, evidence-bounded work. None is authorized for further implementation by this R3 acceptance. In particular, percentage-only and ambiguous financial wording must remain fail-closed.
