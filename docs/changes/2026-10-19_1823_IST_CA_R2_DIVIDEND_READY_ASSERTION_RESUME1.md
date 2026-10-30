# CA R2 Dividend Ready Assertion RESUME1 — Bounded Correction

**Timestamp:** 2026-10-19 1823 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** `Eod Charting Platform Source Code 2026-10-19_175452_IST.zip` SHA-256 `E842455AB9CF9C4FF38AC292A971CD78FEB5AE5995D7CCB24E9957A030946CC4`.  
**Parent package:** `EOD-CA-R2-Cash-Reasons-And-All-Types-Source.zip` SHA-256 `8797791FDF8145C7F02F4D0F46EEB5FB29B0DF879B4C7F4BF95F8B4CD9C0B215`.

## Objective / previous defect
Recover the failed R2 validation without changing current acceptance or financial logic. The R2 runner observed 39 passing and one failing test (40 total) in focused Vitest, `corporateActionDividendExplicitApprovalR1.test.ts` / `routes only independently eligible Dividend P3C rows into Ready`. The test looked for the obsolete spelling `currentOfficialDividendWriteStageScope?.importIds.includes(row.id)` after R2's read-only `Set` membership optimization; application code continues checking membership in the same verified current scope.

## Files in this combined RESUME1 delivery
- Parent R2 **seven candidate files preserved byte-for-byte** (three Rust files, one frontend UI file, all-type helper/test, parent provisional change record).
- `src/features/corporateActions/__tests__/corporateActionDividendExplicitApprovalR1.test.ts` — **modified**, replacing a stale literal source-text check with exact assertions for `Set(currentOfficialDividendWriteStageScope?.importIds ?? [])`, scope-dependent memoization, and the use of `dividendPreparedImportIds.has(row.id)` in readiness. Other assertions remain unchanged.
- `docs/changes/2026-10-19_1823_IST_CA_R2_DIVIDEND_READY_ASSERTION_RESUME1.md` — **new**, this recovery record.

## Final implementation / behavior preserved
No R2 product source changed relative to the original R2 candidate. The Ready gate still needs the current verified dividend scope, `PARSED` + `PENDING` status, and `ELIGIBLE` evidence; the backend still revalidates at an explicit approval confirmation. No fetch/load write, automatic approval, database alteration, price/identity rule widening, UI redesign, or Plugin P5 change.

## Validation commands/results
- Container: source ZIP checksum/CRC and parent package checksum/CRC verified; R2 membership predicates independently inspected; generated manifest file hashes verified. **PASS**.
- Container: TypeScript parser on changed test and R2 changed TS/TSX; semantic source-contract assertions. **PASS** when recorded by packaging script.
- Windows native: focused Vitest -> Rust dividend regression -> renderer typecheck -> `cargo check` -> Tauri build / portable SHA: **PENDING**, runner must produce actual evidence; no release validated yet.
- Manual CA acceptance: **PENDING**; should require only one read-only Load & Validate after native success and copied aggregate counts.

## Risks / limitations
The fixed test remains a source-contract regression, not a substitute for runtime E2E approval testing. Native Rust compilers and Windows Tauri toolchain are unavailable in the packaging environment. Any additional regression must cause stop and original-source rollback. Prior 40/41 test observations alone do not prove other gates pass.

## Rollback
The RESUME1 runner performs per-file SHA-256 prechecks, external source backup, and exact-source restoration on failure. Revert this combined package to the independently verified October 19 17:54:52 IST source bytes, including removal of the new R2 files/tests/docs, but never change databases, SQLite sidecars, or approved financial records. Avoid Git and D: drive access.

## Next step
Execute one combined guarded Windows test/build runner. Only after a complete passing run, open the portable build once and paste the grouped dividend classifier reasons and six-type pending summary. Document manual acceptance before final closure.
