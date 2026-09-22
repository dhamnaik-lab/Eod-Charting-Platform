# Compact Layout R1 — validation, manual checkpoint and handback

This document defines future gates. **Nothing below is a claim that the layout implementation has run or passed.** Historical parent results are listed separately.

## 1. Validation matrix

| ID | Case | Expected behavior / evidence | Method |
|---|---|---|---|
| C01 | Exact accepted parent + new test only | The missing compact structure fails for the intended assertion; tool/fixture failures are not RED proof. | Focused Vitest, saved output |
| C02 | Active Pending Review | Exactly one visible compact controls wrapper containing action/filter/status bands; original pending controls are not duplicated elsewhere. | AST/wiring check plus rendered inspection |
| C03 | Initial/no-data state | Existing Apply predicates keep Apply unavailable; load action and initial helper remain usable. No new request from mounting the layout. | Predicate preservation + rendered state |
| C04 | Approved view | Existing Load Approved/Load More Approved and flat rows retained; no pending Apply controls. View switch still loads as before. | Existing bindings + manual comparison |
| C05 | Symbol, Find, Current, action-type changes | Same filter results, selection clearing, confirmation clearing and query setter type. Other still includes OTHER + DEMERGER. | Unchanged region hashes, existing FIX2 tests, manual controls |
| C06 | Preparation in flight | Same status/counts/unknown total, local elapsed clock and allowed safe Cancel. Counts are producer-reported, not simulated. | Component inspection, fixture/rendered status, operator checkpoint |
| C07 | Old ended task plus new status | New current status is shown, never replaced by stale success text; old task can be labelled historical in Details. | Presentation expression test/inspection + rendered fixture |
| C08 | Stopped, partial, failed or uncertain Apply/refresh | Full receipt/warning visible without Details; no fabricated success, automatic retry or new eligibility. Safety text may increase height. | Source contract + synthetic fixture/manual checkpoint |
| C09 | Long company + long reason summary | Checkbox and expansion stay usable; label/summary wrap in allocated space; complete reason still accessible. | Rendered before/after |
| C10 | Confirmation and exception review panels | Exact reviewed IDs/count/scope and explicit final Apply/Cancel remain. Existing resolve/price panels reachable and not clipped. | Preserved handler/JSX + keyboard/manual |
| C11 | Other surfaces | Identity Import, Manual Entry, Scan, Review Issues, Fetch & Import and Historical Backfill not globally restyled or behaviorally altered. | Shared-style/function comparison + CA/Identity suite + smoke inspection |
| C12 | Light/dark, narrower width, increased zoom | Readable text, visible focus, logical tab order, no overlap or inaccessible control/panel. | Actual WebView2/browser checks |
| C13 | Completed normal state, disclosures closed | Same-scale progress/options footprint reduced >=50%; target <=200 original-image px versus reference ~420. | Screenshot/actual DOM measurement, not mocked geometry |
| C14 | Source and support preservation | One declared production replacement; declared test additions only. Native source, APIs, helpers, locks/configs untouched, captured build metadata preserved until an intentional build. | Byte/hash inventories |
| C15 | Final regression | New focused suite, existing focused suites, CA+Identity, full Vitest, TypeScript and renderer build pass with actual counts/exit codes. | Recorded commands and reports |

Source-string/AST checks establish structure or bindings only. They do not establish real visibility, focus or pixel height. Similarly, a screenshot does not prove database immutability or the exact list of approved IDs. Use the evidence appropriate to each claim.

## 2. Source contract checks

Use `authority/protected-dialog-regions.json` against the pinned baseline and candidate. It supplies start/end anchors and LF-normalized hashes for unchanged critical regions. Compare actual code, not merely the existence of a function name. Verify unchanged eligibility, grouping, filtering, selection clearing, request confirmation, exact-ID recheck, ordinary apply and current-generation/database fences.

The parent `corporateActionOfficialImportsFix2Wiring.test.ts` already checks exact-ID bridge/adapter/native registration, readonly owner, confirmation and post-apply wiring, disabled selection, group reasons, dedicated status and operation-fence ownership. Keep it running. The corrected characterization file expects `effectiveImportActionTypes`, not the earlier `selectedImportActionTypes` literal.

Do not use skipped tests, altered suite filters or deleted assertions as proof of preservation. Record any deliberately updated presentation-only assertion and the replacement coverage. The global test configuration and dependency manifests are not permitted edits.

## 3. Concrete command sequence for the implementer

Use the installed local tools. The following are command templates for execution **after source authority and sandbox setup**. They are not a packaged or executed PowerShell runner. Record cwd, executable, arguments, start/end time, exit code and output in the owned evidence directory.

The Node tool paths are established by the parent command journal. `$Work` is a uniquely created and verified sandbox directory under the authorized root's `tmp`; `$Evidence` is its sibling output directory. Initialize these variables in the receiving agent's guarded runner. Do not run the examples with undefined variables.

Local tool verification:

```powershell
$ProjectRoot = 'E:\TA Projects\EOD Charting Platform'
$Vitest = Join-Path $ProjectRoot 'node_modules\vitest\vitest.mjs'
$Tsc = Join-Path $ProjectRoot 'node_modules\typescript\bin\tsc'
$Vite = Join-Path $ProjectRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $Vitest -PathType Leaf)) { throw 'Installed Vitest missing; no dependency retrieval authorized.' }
if (-not (Test-Path -LiteralPath $Tsc -PathType Leaf)) { throw 'Installed TypeScript missing; no dependency retrieval authorized.' }
if (-not (Test-Path -LiteralPath $Vite -PathType Leaf)) { throw 'Installed Vite missing; no dependency retrieval authorized.' }
```

Focused RED against parent with only the new test added:

```powershell
Set-Location -LiteralPath $Work
$RedReport = Join-Path $Evidence '01-layout-red.json'
& node.exe $Vitest run --exclude 'tmp/**' `
  'src/features/corporateActions/__tests__/corporateActionPendingCompactLayout.test.ts' `
  --reporter=json "--outputFile=$RedReport"
$RedExit = $LASTEXITCODE
if ($RedExit -eq 0) { throw 'RED gate unexpectedly passed.' }
```

A nonzero exit is necessary, not sufficient: parse the report and confirm the expected missing-three-band assertion failed, with no tool/startup/unrelated failure substituting for it. Exact new test count is established by the implemented focused suite, not fabricated in this handoff.

After the bounded candidate edit, focused GREEN plus parent tests:

```powershell
$FocusedReport = Join-Path $Evidence '02-layout-focused-green.json'
& node.exe $Vitest run --exclude 'tmp/**' `
  'src/features/corporateActions/__tests__/corporateActionPendingCompactLayout.test.ts' `
  'src/features/corporateActions/__tests__/corporateActionOfficialApprovalUx.test.ts' `
  'src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts' `
  'src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2Wiring.test.ts' `
  'src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.characterization.test.ts' `
  --reporter=json "--outputFile=$FocusedReport"
if ($LASTEXITCODE -ne 0) { throw 'Focused GREEN failed.' }
```

Relevant and full frontend regression:

```powershell
$RelatedReport = Join-Path $Evidence '03-ca-identity.json'
$FullReport = Join-Path $Evidence '04-full-vitest.json'
& node.exe $Vitest run --exclude 'tmp/**' `
  'src/features/corporateActions' 'src/features/identityRecovery' `
  --reporter=json "--outputFile=$RelatedReport"
if ($LASTEXITCODE -ne 0) { throw 'CA/Identity regression failed.' }

& node.exe $Vitest run --exclude 'tmp/**' `
  --reporter=json "--outputFile=$FullReport"
if ($LASTEXITCODE -ne 0) { throw 'Full Vitest failed.' }

& node.exe $Tsc -p tsconfig.json --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Renderer typecheck failed.' }

& node.exe $Vite build
if ($LASTEXITCODE -ne 0) { throw 'Renderer build failed.' }
```

Use a logging wrapper to capture output as well as the JSON reports. Parse each report: success true; zero failed tests; intended test files present; no unexpected skips; counts match the declared additions. Historical totals 237 and 875 are reference counts. With added tests, totals should grow accordingly, not remain artificially fixed or quietly shrink. Compare failed/pending/suite counts as well as process exit.

`npm run build` in the consulted support file includes native cargo checks; this layout gate should use the specific frontend commands above, not trigger an unrelated full build accidentally. If live scripts/configuration differ, inspect before use. Do not use `npx` to silently install a missing tool.

## 4. Native/build scope and generated files

No native implementation/IPC change is approved, so a new native RED/GREEN cycle is not required for this layout. Verify native source and Cargo files unchanged. The prior 6/6 and 106/106 results remain historical evidence only; do not describe them as rerun for R1.

A fresh Windows portable is needed for final UI acceptance after the automated-review checkpoint. With that bounded build authorized, use the existing `npm.cmd run tauri:portable:win`, after parsing the PowerShell scripts it executes. Preserve the previous portable or an authorized backup before overwriting it. Capture the full build output, metadata before/after and executable SHA256. Existing warnings remain deferred; do not run cargo fix.

Routine validation must not download dependencies. If a native or renderer build requires dependency retrieval, state that and obtain the necessary authorization rather than silently changing policy. Do not label a runner offline merely because it is PowerShell.

## 5. Actual visual measurement procedure

Use `reference/completed-preparation-before.png` as the historical visual reference. It is an original 1920×1080 screenshot, not a proposed layout. The reviewed navigation-to-list region was approximately 420 physical screenshot pixels. Record a fresh before image with the current portable where practical; do not change data or approve actions solely to recreate a screenshot.

Record the window's client/outer size, screenshot pixel size, application/browser zoom if applicable, Windows display scaling, theme, relevant view and disclosure states. Do not pretend these are known from the image alone.

Measure:

- `Y_nav`: lower separator of Official Imports subsection navigation.
- `Y_list`: upper edge of the “Pending actions grouped by symbol” header.
- `H_controls = Y_list - Y_nav`.
- `reduction = 1 - H_after / H_before`.

Require the same coordinate system and scale before/after. Normal-state acceptance: completed preparation, no open Details, no confirmation/error/exception panel, same native font sizing and window geometry. Target `H_after <= 200` at the supplied reference scale and `reduction >= 0.50`; 420→200 returns 220 pixels (52.38%). An open confirmation or safety warning is allowed extra height and must not be hidden to pass.

Report actual numbers and screenshots. If source or scale differs, establish a new labelled baseline and explain the difference instead of comparing incomparable pixels. DOM `getBoundingClientRect()` measurements in CSS pixels can supplement screenshots if the tooling is available, but do not compare CSS values directly with physical screenshot pixels without the actual scale relation.

Check empty, preparing, completed, confirmation, stopped/error, partial/uncertain receipt, Approved, long-symbol and long-reason states. For state fixtures, use actual component markup with mocked data/API edges or an existing authorized test surface; a hand-drawn HTML mockup is not product acceptance.

## 6. Manual safety and operator checks

Begin with read-only visual/keyboard checks. Do not automatically open the last-used real database, fetch exchange data or run Apply. Before any data-changing manual checkpoint, the operator must explicitly identify and back up the TEST database. A folder name or prior recent-database entry is not enough.

A minimal reviewed sample is preferable to Apply All Ready on the full backlog. Check whether earlier uncertain actions are already approved before retrying them. Do not force-close an active Apply, retry uncertain writes automatically, or treat `0 processed` UI text as proof that nothing was written.

For the visual controls, verify Tab order, native select keyboard behavior, Find/Current, type filters, Details, permitted Cancel, group checkbox/expansion, confirmation and exception controls. Details must not refetch, reset selection or restart a finished clock. Test light/dark and a narrower window/higher zoom. Necessary wrapping is acceptable; clipped controls, hidden errors and missing focus are not.

## 7. Documentation, rollback and evidence package

After actual implementation, write a fresh IST change record with objective, prior limitation, exact files, final implementation, preserved behavior, commands/results, manual status, risks, rollback and hashes. Prepend a current-status entry; do not replace its historical content or label the whole project CLOSED.

The evidence package must contain: exact PRE/POST/final source manifests, declared delta, captured support hashes, generated-metadata record, bounded backup manifest/hash, RED and GREEN outputs, all regression/typecheck/build results, changed files, change record and manual checkpoint record. ZIP readback must verify all members before deleting temporary work. Preserve reusable caches outside source directories.

Rollback for R1: close the app only when no operation is running; restore the pre-R1 dialog, restore only documentation files actually replaced, remove only newly declared R1 test files, retain evidence/history, then verify the prior 552-path authority with the captured metadata exception. Do not restore old backend files from pre-FIX2 packages. Source rollback never reverses Corporate Action database approvals; that is a separate operation.

## 8. Required handback / interruption template

Complete with actual values, not assumed PASS statuses:

```text
Task: Pending Actions Compact Layout R1
Root: E:\TA Projects\EOD Charting Platform
Stage: PRE / RED / CANDIDATE / AUTOMATED GREEN / MANUAL PENDING / MANUAL ACCEPTED / BLOCKED
Authority evidence SHA256: 06B34E77ADA300A7755165B9C0180B4C3C65E1DCE793D2995B28F80DAA6A034F
Live PRE dialog SHA256:
Current candidate/installed dialog SHA256:
Generated metadata captured SHA256:
Files inspected:
Files created:
Files modified:
Exact behavior changed:
Behavior preserved:
Backup path + verified hash:
Validation commands + cwd + exit codes + report counts:
Manual geometry before / after / ratio / scale:
Manual keyboard/theme/overflow outcomes:
Outstanding parent FIX2 manual checks:
Risks or new separately recorded issues:
Evidence archive path + verified hash:
Last confirmed gate:
Next exact safe action:
No Git / user DB / network / snapshot boundary deviations:
```

Empty fields in this report template are intentionally awaiting execution, not missing design decisions. Do not fill manual or Windows results from this document's preparation-time audit. On a context/model switch, attach the completed checkpoint and changed files, keep the original authority reference, and resume from the first unverified gate.
