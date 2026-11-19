# Reusable Windows validation workspace — bounded infrastructure change

**IST timestamp:** 2026-11-18 12:40 (UTC+05:30)
**Workstream/root:** EOD Charting Platform, E:\TA Projects\EOD Charting Platform
**Source authority:** GitHub main at 8c309050df3c52b33e8ba2ab4dc8c07a04a75ad6
**Review branch:** infra/reusable-windows-validation-20261118
**PR:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/120 (draft; merge HOLD)

## Objective and previous limitation

Reuse one authorized Windows checkout and its existing Node dependencies and project-root Cargo artifacts across repeated bounded validation tasks. Previously, engineers manually combined npm renderer checks with the BUILD-01 Cargo wrapper and separately located their evidence; repeated isolated worktrees/build targets increased setup and compilation overhead.

This change does **not** claim proven time savings. It standardizes repeatable commands and evidence capture; timings and cache-hit benefit must be measured on Windows.

## Inspected existing implementation and preservation boundary

Inspected from pinned GitHub source: AGENTS.md; package.json and package-lock existence; .gitignore; .cargo/config.toml; scripts/Invoke-EOD-SharedCargo.ps1; scripts/Invoke-EOD-TmpLifecycle.ps1; scripts/validate-change.ps1; scripts/prepare-tauri-portable.ps1; scripts/generate-build-metadata.cjs; .github/workflows/renderer-ci.yml; src-tauri-shell/Cargo.toml; src-tauri-shell/tauri.conf.json; relevant F-30 change records.

Existing BUILD-01 uses root target, offline/locked Cargo, serialized execution, and explicit guards against secondary Cargo targets in tmp. TMP-01 protects only marked disposable scratch directories. The portable build writes to the established release path. These mechanisms remain unchanged.

## Files changed

1. **Created:** scripts/Invoke-EOD-WindowsValidation.ps1 — new non-destructive validation entry point.
2. **Created:** .github/workflows/windows-validation-runner-parser.yml — parse-only PowerShell syntax gate on GitHub-hosted Ubuntu when runner/workflow changes.
3. **Created:** this IST change record.

No existing application, package, Cargo, source-control, or packaging file was modified. No new dependency was added. No local Windows backup was created because no local existing file was edited; Git commits retain pre-change source authority for rollback.

## Final implementation

- Default mode Preview performs no validation commands or file writes. It prints the planned renderer actions; RustCheck delegates to the existing shared Cargo Preview.
- Run mode operates exclusively at the exact authorized root and does not fetch branches or inspect Git state. Checkout SHA/dirty-tree verification remains an independent operator prerequisite.
- FocusedRenderer requires explicit existing paths underneath src/. FullRenderer runs the full renderer suite. Both run a read-only npm dependency-list check with --offline, TypeScript, Vitest, and the renderer Vite build. No npm install/ci is issued.
- RustCheck delegates Preview then Run to existing Invoke-EOD-SharedCargo.ps1, retaining --offline --locked, project-root target and its concurrency/secondary-cache safety rules.
- Each Run creates a uniquely named IST directory under tmp/validation-workspace and a PowerShell transcript with a final SHA-256. Retained evidence is never auto-deleted. It is not placed under tmp/disposable.
- Reparse-point, wrong-workstream, missing-path and argument-traversal guards fail closed.
- The runner never builds a Tauri release, stages a portable executable, launches the app, modifies database settings, or invokes destructive cleanup. Existing npm lifecycle scripts (including theme generation) execute unchanged; they may maintain their established generated theme-token source artifact.

## Validation — actual results versus pending checks

- **Static source scan**: PASS for absence of else/elseif, deletion commands, and Git mutation commands. This is not a PowerShell parser run.
- **GitHub renderer CI at script-only implementation commit 41230846aa0bdee6a5954be9e021060b24545d8f**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256394256 — SUCCESS. Log shows 273 test files passed / 1 skipped; 1,892 tests passed / 1 skipped, TypeScript typecheck PASS, renderer Vite build PASS (4.25s). This workflow did not execute the Windows runner.
- **PowerShell parser CI at d444559a5513dc21dc4056a2fa81acada273afea**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256674579 — SUCCESS. GitHub-hosted Ubuntu pwsh parsed scripts/Invoke-EOD-WindowsValidation.ps1; log printed PASS. The runner was not executed.
- **Renderer CI for d444559**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256674541 — in progress at the time of this record.
- **Windows PowerShell 7 parser, Preview, FocusedRenderer Run, FullRenderer Run, RustCheck Run, caching speed comparison, portable native build**: NOT RUN. Do not extrapolate GitHub results to Windows acceptance.

## Windows operator verification (after approved branch fetch and protected-document hash checks)

At the verified authorized root and exact PR commit, parse the runner **before** execution:

    $Script = 'E:\TA Projects\EOD Charting Platform\scripts\Invoke-EOD-WindowsValidation.ps1'
    $Tokens = $null
    $Errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$Tokens, [ref]$Errors) | Out-Null
    if ($Errors.Count -gt 0) { $Errors; throw 'PowerShell parser failed' }

Start with no-write preflight:

    & $Script -Mode Preview -Profile FocusedRenderer -TestPaths @('src/features/charts/__tests__/chartRequestConsistency.test.ts')
    & $Script -Mode Preview -Profile RustCheck

After verifying current source authority and existing node_modules, execute ONE selected profile serially:

    & $Script -Mode Run -Profile FocusedRenderer -TestPaths @('src/features/charts/__tests__/chartRequestConsistency.test.ts')

For full renderer verification, separately:

    & $Script -Mode Run -Profile FullRenderer

Rust check, when relevant and authorized:

    & $Script -Mode Run -Profile RustCheck

Validate exit status, full transcript and hash, source file preservation, and whether the standard target and node_modules were reused. Do not run profiles concurrently. Do not perform Git operations or build a portable as part of the runner task.

## Risks, limitations and rollback

- Existing installed node_modules may not match an updated lockfile. npm ls --depth=0 --offline checks the direct installed dependency tree, not byte-for-byte lockfile fidelity. On mismatch, fail; do not auto-install or assume a valid environment. Any npm ci/update is separately planned.
- The exact-root check intentionally rejects isolated source worktrees; this runner is for the regular authorized Windows checkout.
- Renderer tests and npm build lifecycle can update pre-existing generated theme files as before; inspect protected local changes before/after execution.
- Shared Cargo remains serialized and its compatible cache reuse cannot be guaranteed for different toolchains, features or compiler flags.
- Source-level guards and CI syntax validation do not establish runtime safety on the actual Windows machine. All Windows checks remain open.
- No production database access, local Git checkout modification, native app launch or portable build was performed by GitHub implementation.
- Rollback: close/revert draft PR #120 or remove the two newly added runner/CI files if later approved. Do not remove tmp evidence, protected untracked audit documents, shared target, node_modules or existing release files.

## Completion state

**GitHub source implementation: candidate, with parser CI PASS and initial renderer CI PASS. Windows validation: HOLD. GitHub main: unchanged. Merge: HOLD for user acceptance and separate approval.**

---

## Follow-up: actual Windows validation and remaining implementation (2026-11-18 14:17 IST)

**This later section supersedes the earlier "Windows checks NOT RUN" / "Windows HOLD" statements above where results are now available.** The initial 12:40 IST record remains unchanged as historical evidence. The results below come from the operator's actual Windows PowerShell outputs supplied on 18 November 2026; they were **not independently executed by the GitHub authoring environment**.

### Verified Windows results

| Check | Evidence/result | Disposition |
| --- | --- | --- |
| PowerShell 7 parser | Operator output: PASS | PASS |
| FocusedRenderer Preview | \`EOD_WINDOWS_VALIDATION_PREVIEW_PASS_NO_CHANGES\` | PASS |
| FocusedRenderer Run | Chart-request consistency tests **25/25** passed; TypeScript typecheck PASS; Vite build PASS (846 modules, 8.11 s); \`EOD_WINDOWS_VALIDATION_RUN_PASS\` | PASS |
| FullRenderer Preview | \`EOD_WINDOWS_VALIDATION_PREVIEW_PASS_NO_CHANGES\` | PASS |
| FullRenderer Run | **1,892 tests passed, 1 skipped** across 273 passing/1 skipped test files; TypeScript typecheck PASS; Vite build PASS (846 modules, 7.01 s); \`EOD_WINDOWS_VALIDATION_RUN_PASS\` | PASS |
| RustCheck Preview | BUILD-01 preflight threw "Secondary Cargo artifact roots detected in tmp" | BLOCKED — no Rust compilation |
| RustCheck Run | Same BUILD-01 preflight error, before Cargo invocation | BLOCKED — no Rust compilation |
| Shared Cargo performance/cache-reuse benchmark | No before/after measurements | NOT TESTED |
| Portable/native app and actual database | Not launched/accessed as part of this task | NOT TESTED / NOT IN SCOPE |
| Post-run Git status and protected-five-document SHA preservation | Pre-checkout protection previously passed; post-run checks not supplied | PENDING |

**Focused evidence:** \`tmp\validation-workspace\2026-11-18_130044_IST_5826f18e\validation-transcript.txt\`; operator-reported SHA-256 \`B11C628E7C399537EFF256332AA134034D5000829273C59F7D30B18058CBCB62\`.

**Full-renderer evidence:** \`tmp\validation-workspace\2026-11-18_132001_IST_550e1b9b\validation-transcript.txt\`; operator-reported SHA-256 \`1F7E765610E41D9563D23232B7138107FE2EC277D346C0056F7B12FFC8AEB8CA\`.

**GitHub final commit CI:** parser workflow https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256940231 and renderer workflow https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256940142 both passed at \`169af4126b07e2fb917efca2f8f73f0bedfff164\`.

**Environment note:** \`npm ls --depth=0 --offline\` returned successfully but listed extraneous packages. This does not invalidate the passing tests/build; no dependency cleanup is authorized within this task.

### Exact RustCheck blocker — read-only investigation

The existing \`scripts/Invoke-EOD-SharedCargo.ps1\` recursively discovers secondary \`target\`, \`cargo-target\`, or \`rust-target\` directories with compiled \`deps\` beneath the project \`tmp\`. It rejects all five paths below **before** running \`cargo check\`.

| Observed path relative to project root | Filesystem evidence | Decision |
| --- | --- | --- |
| \`tmp\EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree\target\` | Ordinary directory, debug and release deps exist, modified 2026-11-18 00:43:38 IST; source and Git metadata present | Preserve; historical ownership/retention unresolved |
| \`tmp\EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\worktree\target\` | Ordinary directory, debug and release deps exist, modified 2026-11-18 01:58:45 IST; source and Git metadata present | Preserve; historical ownership/retention unresolved |
| \`tmp\F52_Windows_Native_Acceptance_20261116_102754_IST\pr-source\target\` | Ordinary directory, release deps exist; source and Git metadata present, acceptance logs identified | Preserve; historical ownership/retention unresolved |
| \`tmp\UX_Audit_Completion_20261117_IST\target\` | Junction targeting exactly \`E:\TA Projects\EOD Charting Platform\target\` | Legitimate shared cache alias, not a separate target |
| \`tmp\UX_Audit_PR116_IA_20261117_IST\target\` | Junction targeting exactly \`E:\TA Projects\EOD Charting Platform\target\` | Legitimate shared cache alias, not a separate target |

The two junctions demonstrably point to the authorized root Cargo target. The other three are **independent historical build directories**, not proved disposable. The immediate-parent evidence inventory of the two F-30 worktrees returned no top-level \`.md/.json/.txt/.log\` files; that is **not proof** that nested evidence is absent. F-52 acceptance has logs \`00-source.log\` through \`10-new-tab.log\` in its evidence directory.

No files or links were deleted, moved, renamed or replaced. The existing BUILD-01 guard was not relaxed. The error is a **preflight/environment-policy block**, not a Rust compiler failure.

### Remaining implementation and verification — handoff for a later approved task

This PR is a **conditional renderer-workflow success**, **not** a fully accepted reusable native validation workspace. Pause further implementation so other EOD work can proceed independently.

1. **Bounded follow-up decision:** separately approve an amendment to the existing BUILD-01 secondary-target guard. Do **not** begin that architectural/policy correction inside this documentation update. The design should resolve and classify target junctions by *canonical destination*, accepting aliases only when they resolve to the exact authorized root target. Reject broken/ambiguous links, unexpected link types, and genuinely independent build roots unless an independently approved retention policy explicitly covers them. No hardcoded exemptions for individual F-30/F-52/UX directories.
2. **Historical artifact authority and retention:** identify owners, nested acceptance evidence and current purpose of the three ordinary target directories. Decide an explicit policy for historical caches that remain under retained worktrees; avoid automatically deleting, moving, renaming, or treating them as safe. Any relocation or cleanup requires separate authorization, evidence preservation and a precise rollback plan.
3. **Implement/test only after approval:** inspect BUILD-01 wrapper and its tests first; make the smallest guard change with regression cases for authorized junction aliases, genuine independent targets, unexpected reparse points, broken links, and nested artifacts. Preserve offline/locked Cargo, root target, concurrency guards, current failure safety and existing acceptance evidence. Add an IST change record for that separate source change.
4. **Actual Windows Rust validation:** parse revised PowerShell scripts before execution. Run shared-Cargo Preview then \`RustCheck\` Run serially, verify the actual \`cargo check --offline --locked\` command result and retained evidence/SHA. **Do not** claim Rust PASS based on renderer or GitHub parser CI.
5. **Final acceptance/closure:** after source authority is reverified, confirm local branch, SHA and any Git changes with separately authorized read-only checks, compare all five protected untracked Markdown file hashes against the previous manifest, inspect any generated-theme-file changes, confirm no database/release changes, optionally measure warm/cold cache speed against a reproducible baseline, update evidence and obtain a **separate explicit merge approval** for PR #120.

### Preservation, rollback and parked-task status

- **No implementation in this update:** documentation only. Neither the application nor BUILD-01/runner scripts, dependencies, build configuration, caches, worktrees, database or release artifacts have been changed.
- **Protected:** all five original untracked Markdown documents, three historical Cargo target directories, two root-target junction aliases, project-root \`target\`, \`node_modules\`, prior acceptance logs and release binaries. The original pre-checkout hash protection passed; **post-run** source/document hashes remain to be rechecked locally.
- **Rollback:** revert only this documentation update on the draft branch if necessary. Do not destroy historical artifacts or loosen safeguards to make the preflight pass.
- **Final status (2026-11-18 14:17 IST):** **PR #120 DRAFT / UNMERGED / HOLD for RustCheck acceptance. Focused and full Windows renderer validation PASS.** This workstream issue is parked, with the remaining implementation/validation above explicitly deferred. Other bounded work may proceed; do not conflate its source authority or acceptance with this PR.
