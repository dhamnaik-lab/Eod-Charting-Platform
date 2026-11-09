# Local WIP reconciliation and pre-rebuild integration

## Scope and source authority

The user authorized committing/integrating all 117 local changed entries and three theme commits, resolving the three remaining GitHub issues and PRs, and leaving a clean main checkout before their rebuild. Application database operations and financial approval remain excluded.

Baseline: original HEAD `0812e32f106685cb2680da2bea1aae6b899422f7`; verified GitHub main `66a1af00ec7f7cfcfc9c81b578a13451f52634bb`, tree `c2f40338cde7571f8ce93611c3fcd3fe037a3231`. The 69 modified tracked and 48 untracked files matched every saved backup hash before integration. The clean audit worktree remains untouched.

Fresh source backup: `backups/pre_opencode_changes_20261109_140951_wip_full_integration_20261109` (176 files), plus `backups/pre_opencode_changes_20261109_141539_wip_integration_additional_scope`. Original Downloads manifest/bundle and all old fixture/build directories remain intact.

## Integration choices

- Captured all 117 entries in five logical preservation commits (scanner/chart; CA/BSE; reviewed history; admission/tools; docs/snapshot), retaining all three theme commits in local history. No original work was discarded.
- Reconciled current main rather than replacing files. Retained B18 focus/draft handling, B24 shared favorites, B25 chart-local PATTERN, B17 toolbar semantics, B20 transform reuse, B23 pane-scale status, B26 reduced motion and B06/B07 cache/workspace contracts.
- Resolved the theme conflict using the split token/rules CSS sources and main's minimum focus-ring-consumer assertion.
- Included PR #75's latest exact-row hydration/proof regressions and A1 design evidence. Preparation still never approves; no native/real-price outcome is claimed.
- Preserved main's normal/recent-search exclusion for separate BSE `#` instruments. Sparse settlement chart rendering remains available through the full Symbols browser.
- Corrected single-date binary coverage: first/last sidecar bounds choose candidates, but actual file identity and records prove date membership. Missing files and interior date holes do not count as covered. Added a synthetic regression. Bulk date-set/latest anchoring P1.8 is still a separate follow-up; this change does not claim session completeness.
- Exposed the guarded NIFTY review under Manual Import, with mutual exclusion from normal import/Undo and close protection during history operations. Official verification, database-bound preview and deliberate user approval remain mandatory. Close-only/prelaunch/conflicting/unverified observations stay outside analytics. No candidate bulk history was imported or certified.
- Kept dated repair/proof scripts as manually invoked tools; no repair or residual deletion was run. Historical audit records remain dated evidence, not current acceptance.

## GitHub disposition and release checkpoint

PR #75 was merged as 9d5f64d4e1fe27e169f137896d5fcd5a534bb0ea after fresh CA source checks. PR #81 was closed without merge as superseded by merged B11 commit `ed8cd93` and its schema-type regression; it must be closed without reintroducing the obsolete dialog snapshot. PR #98 was closed without merge as a completed CI-only experiment whose tested integration was already merged through #95/#96/#97; close without merging it. Issues #57/#59 are obsolete CI-baseline tracking once the combined renderer suite passes. Master #28's 27 source tasks are already merged; close source tracking only after preserving its outstanding release checklist here.

**Release/native acceptance remains unperformed:** user portable rebuild; Windows keyboard/focus/dirty confirmation; Sidebar/Picker favorites across windows; PATTERN Save/reopen; theme/System/custom chart-color persistence; scanner overlays/manual drawing preservation; real-price CA Load & Validate on reviewed copies; guarded NIFTY UI review; Bhavcopy canary and per-batch verification. Financial approval and data repair require separately reviewed evidence and explicit user action. Closing source issues does not certify these checks or grant live-data authority.

## Validation

PASS so far: original source/backup authority; staged whitespace checks; initial renderer typecheck; 12 focused renderer files / 131 tests; exact-date Rust coverage regression (1 pass, compile/link 1m38s). Final local renderer suite PASS: 257 files passed / 1 skipped; 1,783 tests passed / 1 skipped / zero failed. Final renderer typecheck PASS. Affected Rust filters all PASS: admission 20, CA A1 15, NIFTY 13, BSE code reader 3, BSE mapping 5, retained source 1, Bhavcopy 66 (1 ignored), imports 225 (1 ignored), CA imports 565 (19 ignored), calendar 1, EOD reader 28 (3 ignored). Counts overlap across filters and are not unique test totals. Docs/whitespace PASS. Source-snapshot tests PASS 26/26 with guarded scratch cleanup. Python certification and repair-safety results are retained under outputs/local-wip-integration-20261109. Final GitHub CI/merge identity is a publication gate, not a local native-acceptance claim.

No release EXE, installer or portable output was built or staged. Existing Cargo artifacts are reused only under project-root target; no application database or raw EOD files are accessed.

The first full renderer run found one B26 test still reading palette selectors from global.css. The test now reads generated palette CSS while keeping all reduced-motion guards unchanged; focused 6/6 and final full suite passed. No acceptance test was skipped to resolve this failure.
