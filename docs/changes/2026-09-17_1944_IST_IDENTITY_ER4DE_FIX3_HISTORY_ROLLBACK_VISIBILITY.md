# ER4-DE FIX3 — source-version history / Review Rollback visibility

IST timestamp: 2026-09-17T19:44:58+05:30
Workstream and authorized root: `E:\TA Projects\EOD Charting Platform`.

## Objective and authority
Make the existing Identity history and reviewed rollback controls reachable when the
source-health table and history exceed the available window height. This is a candidate
correction only, not a real-source installation or ER4 final acceptance.

Base: `Eod Charting Platform Source Code 2026-09-17_031234_IST.zip`,
SHA256 `A9FD7B2D54C5EB4E6610F4161A3217EE171B8CA5063009E3356966CEC5026A61`.
Parent FIX1 package: `AD8D5AAC71086104FCC5B6AC8339DE92AF1E8B0E5193A46972CCD6773540A470`.
Parent FIX2 package: `EDB3FD83F01FB540502ACB490D2426D284DCCF1F7D60130E39752C3890ACC1C3`.
Accepted automated RESUME3 evidence: `BB28502B69F979870BDC74A420B0B9EFEC36D6C59A3BF190120589292C941F9A`.
The real source remains the accepted ER4-BC 546-file baseline.

## Previous defect and investigation
`findOfficialReplacementCandidates` calls `loadOfficialSourceHistory(result.sourceKey)`
after receiving the result, including a zero-candidate result. The existing render function
places version history outside the candidate-array empty/nonempty branch. Missing history
was therefore not established as a data-loading defect.

The Identity root used shared `corporateActionPanelStyle` (flex column, minHeight 0,
no vertical overflow owner). The enclosing FloatingWindow body uses overflow hidden.
The health table has its own scroll area, but that area does not include candidate/history
rows below it. The offline layout reproduction rendered history below the clipped window
with no user-scrollable ancestor covering those rows.

## Files changed
- `src/components/DatabaseToolsDialogs.tsx`: one root style assignment plus an Identity-only
  style extending the existing shared panel style with overflowX hidden and overflowY auto.
- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`: new six-test regression.
- This change record; no existing production documentation is overwritten by the runner.

## Final implementation and behavior preserved
Only Identity Import gets an outer vertical scroll area. The shared Corporate Actions
panel and other tabs remain unchanged. No state-loading function, source URL, command,
decision handler, promotion condition, rollback condition, confirmation text, backend
schema, persistence or stale-fence behavior is changed.

Zero candidates still means no candidate approval button. Existing eligible prior NSE
versions retain Review Rollback. Active versions, BSE and ineligible configuration-only
sources do not gain rollback eligibility. Existing manual editor and I3/I4 separation
remain unchanged. The discovery rejection count does NOT prove that all rejected links
were downloaded or content-validated; investigating discovery recall is outside FIX3.

## Validation performed in preparation
- Exact parent UI recovered from the authenticated RESUME2 Vitest source dump, undoing
  its line wrapping/ANSI/OEM presentation. The resulting 366,120 bytes match BOTH the
  parent package member and accepted RESUME3 protected manifest:
  `C47E1F8292A3ED33D70FD69CAB1212CC298E00B6902FA42A1F1E828BF7F95897`.
  No inferred or incomplete snippet is used as the patch preimage.
- Source-level regression executed through a local Node test adapter (not claimed as Vitest):
  old runtime 5 pass / 1 intended assertion failure (`ER4_FIX3_SCROLL_OWNER`);
  corrected runtime 6 pass / 0 fail.
- Isolated Chromium fixture built from actual render/style declarations and synthetic
  health/history data: clipping reproduced before the fix at 1649x880, 1280x720,
  1024x640 and 800x500. At each size afterward, the history heading and every rendered
  Review Rollback / Apply Reviewed Rollback control is reachable at its scroll position.
- Full corrected TSX and test parse with the installed TypeScript parser.
- Fixture stubs unrelated dialogs/preview/search and does not mount the whole app, React
  hooks or WebView2; it does not execute mutation handlers.
- Windows Vitest, full Corporate Actions regressions, renderer typecheck/build, portable
  Windows build and actual manual checkpoint: PENDING runner/operator execution.
  See package evidence/preparation for exact outputs and images.

## Runner constraints / build exception
Runner reconstructs a full source sandbox from pinned source/support manifests, verifies
the exact FIX1+FIX2 parent, proves RED, applies only FIX3, then runs frontend regression
and portable gates. Backend source is hash-preserved; no redundant backend test rerun is
claimed. The existing portable build system generates `src-tauri-shell/gen/build-info.json`
and Tauri schema artifacts inside the SANDBOX only; these are recorded separately and do
not silently replace source-install authority.

The shared Cargo target stays under project/tmp/_cargo-cache. Evidence is saved and ZIP
readback verified before heavy-workdir deletion. Failed packaging retains the workdir.
Only known sandbox junctions are detached; their project dependency/cache targets are
never recursively deleted. The runner does not launch the app or access either database.

## Risks and limitations
Scroll reachability in the extracted browser fixture is not Windows WebView2 acceptance.
The operator must repeat the previously blocked view in the new verified portable.
ER4-D live candidate promotion remains not manually exercised with the zero-candidate
result; FIX3 cannot convert that untested path to PASS.

## Rollback
Before installation, discard the FIX3 sandbox/portable and keep the parent RESUME3 portable.
Do not delete the shared cache or TEST/ACTUAL database. For a later controlled installed
rollback, restore only DatabaseToolsDialogs.tsx to the parent candidate preimage and remove
the new visibility test with its recorded change; preserve all ER4-DE backend owners.

## Hash evidence
UI PRE: `C47E1F8292A3ED33D70FD69CAB1212CC298E00B6902FA42A1F1E828BF7F95897`
UI POST: `47510BF3154776D257CCC41F7C276C8DDB6F04C8607C4401652EB0DE40D10394` (366347 bytes)
New test: `5317ADD73DEFE61913BA984A8994653E149E3236431FD449DB5DA9D1710EDC9E` (9803 bytes)
Parent protected files: 546. FIX3 candidate: 547 (one new regression test).
