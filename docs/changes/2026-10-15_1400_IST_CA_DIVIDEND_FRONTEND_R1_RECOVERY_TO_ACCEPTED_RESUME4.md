# CA Dividend frontend caller R1 — Recovery to accepted RESUME4 source

**IST timestamp:** 2026-10-15_1400_IST (UTC+05:30)
**Objective:** Recover the unaccepted Lean R1 frontend candidate after native Vitest discovery and rollback harness defects.

## Previous defect / limitation
The native run invoked Vitest without excluding old test copies under tmp. Native result: six intended project-root suites PASS 86/86; historic tmp copies introduced 4,395 extra cases with 128 failures. The rollback helper expected `post` for newly added files while the controller passed `after`, causing a TypeError after processing the modified UI.

## Source authority and exact files changed
- Pre-recovery current state matched only accepted RESUME4 PRE identities and the exact three task-owned Lean R1 candidates. All unrelated 632 pre-existing protected files were verified byte-exact.
- Original PRE manifest: 428EBBCB38FED7C1603F8914D7F68876278C3329ECA64DA0200806B045600935; population 633.
- Restore the accepted original of src/components/DatabaseToolsDialogs.tsx from the verified scoped Windows backup, if not already restored.
- Remove unaccepted task-owned added file src/features/corporateActions/legacy/corporateActionDividendWriteStageOrchestration.ts only when exact candidate SHA 4FB93EF7346AA3BF3519742465DF95E4DB0338404C5406F710047ED5F8442FED matches.
- Remove unaccepted task-owned added file src/features/corporateActions/__tests__/corporateActionDividendWriteStageOrchestration.test.ts only when exact candidate SHA B28B4445FBFB7A15D07FFDDCB9BE9A7FD4D912AA1909C8947C7C73A5108563DB matches.

## Final implementation and behavior preserved
The project is restored to the accepted RESUME4 protected-source population of exactly 633 files, with all paths and SHA256 hashes checked. No CA Dividend write-stage caller is active; P1/P3A/P3B/P3C, P4A/P4B, manual Apply, Safe V2, Bhavcopy, consolidation, and other accepted source behavior remain unchanged. No live DB, Git, build or network activity occurred.

## Validation commands / actual results
- Read-only full-source fingerprint before recovery: PASS exact allowed hybrid of RESUME4 PRE 633 and task-owned 3 candidate files.
- Verified scoped backup of the UI file against accepted PRE bytes/SHA256: PASS.
- After selective restoration/deletion: exact source verification PASS 633/633 against accepted RESUME4 POST manifest.
- No frontend tests, TypeScript typecheck, Vite build or native parser were run by this Node recovery controller.

## Evidence / rollback guidance / limitations
- Scoped backup: E:\TA Projects\EOD Charting Platform\backups\pre_ca_dividend_frontend_lean_r1_2026-10-15_1341_IST_142dfdc1
- Recovery evidence and preserved unaccepted candidates: E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_FRONTEND_R1_RECOVERY_2026-10-15_140018_IST_0222a92f
- To reattempt Lean R1, prepare a newly verified candidate and fix Vitest discovery in a separate bounded task, never rerun the failed original package.
- A recovery is not a successful Lean R1 implementation. Live write activation remains forbidden. Phase5E4 network acceptance remains OPEN / UNSATISFIED / DEFERRED.
