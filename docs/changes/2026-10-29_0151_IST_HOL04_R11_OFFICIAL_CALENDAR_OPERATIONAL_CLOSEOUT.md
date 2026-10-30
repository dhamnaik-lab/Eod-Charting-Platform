# HOL-04 R1.1 — Official Holiday Calendar: Native Acceptance and Operational Closeout

**Report timestamp (IST):** 2026-10-29 01:51:53 UTC+05:30  
**Active workstream / authorized root:** `E:\TA Projects\EOD Charting Platform`  
**Disposition:** **User-accepted for current workflow; source and portable build validated.** Explicitly deferred checks are recorded below, not represented as passed.  
**Scope:** HOL-04 R1.1 calendar-source migration and supporting HOL-03 regression-test correction. This report is a **documentation-only addendum** to the original source-change record; it does not authorize database deletion, modification of source behavior, or a new implementation phase.

## 1. Objective and previous limitation

Eliminate the yearly **hard-coded 2023–2027 market-holiday seed list** from newly initialized databases; use independently accepted official exchange/year snapshots for scheduling and **fall back from BSE cash-market holiday lookup to accepted NSE dates only when no BSE-specific accepted snapshot exists**. Preserve existing local records and special trading-day semantics.

Before HOL-04, `bootstrap.rs` populated an empty `market_holidays` table with predefined `BUILTIN` dates. HOL-03 had introduced explicit, user-approved official synchronization, but the BSE calendar could be unavailable if its notice request failed. HOL-04 R1 initially failed an obsolete HOL-03 test expecting legacy BSE precedence; R1 rolled back. R1.1 corrected that **one test expectation** and passed validation.

## 2. Source and behavior delivered

| Project-relative file | Exact final change | Installed SHA-256 (from R1.1 Apply evidence) |
|---|---|---|
| `src-tauri-shell/src/database/bootstrap.rs` | Removes automatic 2023–2027 holiday seeding; retains table and existing data | `A1E1F4A463996D27034C7F0EA8C46AAF54E51CA4C1FD5D7F060C90D525A32C4E` |
| `src-tauri-shell/src/bhavcopy/calendar.rs` | Accepted BSE official snapshot wins; otherwise accepted NSE snapshot may cover BSE/BSE Index cash-market dates, with USER holidays retained | `0C3C58F4BBE0434D32C99D5072BD86D504367C162322B812D43757B40A8E0CE2` |
| `src-tauri-shell/src/bhavcopy/holiday_sync.rs` | Test-only change: BSE legacy fallback expectation `Legacy` -> `NSE official`; no production synchronization logic changed | `4EEB7C63DDE46E008CD9F3BD66CBC8D83F08C93D0241F6E74EDFF6DC0C07DAB4` |

**Preserved:** existing `market_holidays` rows (`BUILTIN`, `USER`); manual Add/Remove and Refresh flows; HOL-01/02 user-interface behavior; HOL-03 preview/explicit acceptance; accepted BSE-specific snapshot precedence; weekend rules; hard-coded exceptional trading-session overrides; NSE/BSE Bhavcopy and sidebar filtering; database format; other production source.

**Calendar precedence in HOL-04 R1.1:**

1. Special trading-session override takes priority over holiday skipping.
2. An accepted official snapshot for the requested cash-market exchange and year is used when present.
3. If BSE/BSE Index lacks its own accepted snapshot, accepted NSE dates for that year can be used as a shared cash-market fallback, without claiming independent BSE verification.
4. Manual `USER` holidays remain applicable. If no accepted official calendar covers the date, legacy table records remain available for existing databases.

**New database:** no automatic hard-coded annual holiday rows. Explicit official calendar acceptance is needed for reliable holiday-aware weekday scheduling. **Existing database:** old `BUILTIN` rows remain visible in the legacy table by design; this is not evidence that the new build continues seeding dates.

## 3. Automated validation — command-output evidence

**Source:** `EOD_HOL04_R1_1_Apply_EVIDENCE_20261029_013308_IST.zip`, SHA-256 `7A4CC2C4BA38E37CFC4CD26F97EBF06BA926D980EEB647D1E5FE908F9B767F65`. Archive integrity checked independently. The Apply log confirms installation/backup/hash gates and the following actual command outputs.

| Validation | Actual result |
|---|---|
| `cargo test --offline --locked ... hol04 -- --test-threads=1` | **7 passed; 0 failed** |
| `cargo test --offline --locked ... hol03 -- --test-threads=1` | **6 passed; 0 failed** |
| `cargo test --offline --locked ... bhavcopy ...` | **102 passed; 0 failed; 3 ignored** |
| `cargo check --offline --locked` (shared target) | **PASS** |
| HOL-01/02/03 focused Vitest | **23 passed, 0 failed (3 test files)** |
| `npm run typecheck:renderer` | **PASS**, `tsc -p tsconfig.json --noEmit` |
| `npm run build:renderer` | **PASS**, Vite 778 modules transformed |
| Installed/preserved source SHA-256 gates | **PASS** |

The prior R1 failure was: **101 Bhavcopy tests passed, 1 failed, 3 ignored** due to an outdated HOL-03 assertion. The R1 runner restored both original source files, verified by hashes. R1.1 corrected the assertion and passed all its selected automated checks. The broader *entire repository* suite is **not claimed to have passed** on this evidence.

## 4. Native portable build — user-supplied command-output evidence

On **29 October 2026 IST**, the user ran at the authorized root:

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
npm run tauri:portable:win
```

The provided terminal output reports: `vite v6.4.3` transformed **778 modules**; Tauri/Rust **release** compilation completed; `scripts/prepare-tauri-portable.ps1` completed; a verified portable executable was produced at `release/tauri-portable-win/EOD Chart Portable`. The executable's **reported** SHA-256 was:

`A2B783088F48A620A09FA53F04538B6A7A87470EA7D2386DB02EB6A4D19B94DB`

There were **10 non-fatal compiler warnings** in the posted release output, covering unused imports, an unnecessary mutable variable, and unused corporate-action items. They did not fail the build. **Independent execution of the Windows build and re-hashing of the resulting EXE were not performed in this documentation session**; those facts are supported by the user-provided terminal output.

## 5. Native application acceptance — screenshot evidence

The user supplied three screenshots from the rebuilt EOD Chart portable application, showing:

| Manual checkpoint | Evidence-supported finding | Status |
|---|---|---|
| Market Holiday dialog and Sync Official Holidays | Visible and interactive | **Observed** |
| Official NSE calendar, year 2026 | Preview verified, 20 records | **Observed** |
| Official BSE calendar, year 2026 | Preview verified, 20 records (base notice and amendment links shown) | **Observed** |
| Explicit acceptance | Status message: **“Accepted 40 official 2026 records: NSE, BSE. Shared/user holidays retained.”** | **Observed, UI-confirmed** |
| Accepted calendar listing | NSE 2026: 20 records; BSE 2026: 20 records; both stamped `2026-10-28 20:13:59 UTC` (**2026-10-29 01:43:59 IST**) | **Observed, UI-confirmed** |
| Historical `BUILTIN` rows | Older 2023 rows remain visible in the legacy list | **Expected; observed** |
| Reopen/restart persistence | No post-restart screenshot or database proof supplied | **Not independently verified** |
| Holiday-specific Bhavcopy skipping on a selected 2026 holiday | No end-to-end checkpoint supplied | **Not independently verified** |
| Muhurat/special-session non-skip in the running downloader | Automated tests cover override; no manual checkpoint supplied | **Manual checkpoint not supplied** |

**Interpretation:** The UI confirms the acceptance workflow reported success and displayed two accepted 2026 snapshots, but screenshot evidence alone is not a direct database row-count audit. The user elected to close the workstream without requesting further tests.

## 6. Source provenance, backup and rollback

- **Source authority:** HOL-03 R1.4 installed baseline, R1 failed Apply with verified rollback, then HOL-04 R1.1 manifest and installed final-file SHA-256 gates.
- **R1.1 manifest SHA-256:** `E9B4325C99B565501EB0F06814C0D315643B6FBF6E6E3EEA269C620BA6A6E25D`.
- **R1.1 successful Apply evidence:** `C:\Users\dharm\Downloads\EOD_HOL04_R1_1_Apply_EVIDENCE_20261029_013308_IST.zip` (hash above).
- **Original change record:** `docs/changes/2026-10-29_0135_IST_HOL04_REMOVE_HARDCODED_CALENDAR_AND_TEST_CONTRACT.md` (retained, not overwritten).
- **Source backup:** `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261029_013315_HOL04_R11_NSE_BSE_TEST_EXPECTATION` (reported by the successful Apply runner).
- **Pre-implementation hashes:** `bootstrap.rs` `4D8377C0C06E7FDEAEA92B0415E0FE4EB26A63B596A900448AFCE90FCD4CBE73`; `calendar.rs` `7BC811DD5FD8D2AEE48186CC8B7B531B13D6F771CD8C0DEA5C5A64CF8342F88F`; `holiday_sync.rs` `F97B1C32EE86DEE5E4A2428113E9C893D6D4D0E5043B535813DA16EA3D09E2C5`.

**Source rollback guidance:** Close the application; retain the current backup and accepted source hashes; restore *all three* backed-up files together if reverting HOL-04 source and test behavior; recheck the three pre-implementation SHA-256 values; rebuild the portable executable if a runtime rollback is intended. **Do not treat source rollback as database rollback.** The user accepted official calendars in the actual database after the native build; reversing those database writes, if ever needed, requires a separate explicitly authorized and backed-up operation. No database rollback is authorized by this record.

## 7. Known boundaries and deferred follow-up

- **Special trading sessions:** fixed special-session lists in `calendar.rs` were deliberately preserved for continuity. Moving them to an authoritative persistent store is **outside HOL-04 R1.1** and would be a separate approved task.
- **Existing built-in rows:** retained in existing databases; no automatic cleanup, reclassification or deletion was performed.
- **Official synchronization:** user-initiated via **Sync Official Holidays**, with preview and explicit acceptance. This is not an automatic scheduled background service.
- **BSE evidence:** the later screenshot showed successful BSE verification; this does not imply that NSE and BSE holiday calendars are always identical across future years, markets or exceptional sessions.
- **Unverified manual checks:** restart persistence and live Bhavcopy/special-session handling remain unproven by provided screenshots. Do not retroactively mark these PASS.
- **Full-suite tests:** no claim of a green entire-repository regression suite; the selected relevant regressions and build checks passed as reported above.

## 8. Closure statement

**HOL-04 R1.1 is closed for the user's accepted workflow as of 29 October 2026 IST.** Automated source validation is confirmed by evidence, native portable build is confirmed by the user-supplied command log, and NSE/BSE official 2026 preview and 40-record acceptance are confirmed by screenshots. The record intentionally preserves the limits noted in section 7. No further source change is authorized by this documentation update.

**Documentation-only update:** This addendum does not modify `src`, `src-tauri-shell`, databases, build outputs, installed portable files, or the original source change record.
