# B00 — GitHub Renderer CI Baseline

**Created:** 2026-11-07 20:13 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized local root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**Repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Base `main` commit (unmodified):** `44bbf2126aa66484dcdcad13b23d6276a3ad821f`
**Branch:** `audit/b00-renderer-ci-20261107`
**GitHub Issue:** #29 (master register #28)
**Draft PR:** #56 — https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/56

## Objective and previous limitation

Establish an inspectable GitHub-hosted validation baseline using existing npm scripts. Previously the repository had no `.github/workflows` files and no reported CI checks at the pinned main commit. This is a CI-only change, not a renderer or native application correction.

## Files created / modified

- **Created:** `.github/workflows/renderer-ci.yml`
- **Created:** `docs/changes/2026-11-07_2013_IST_B00_RENDERER_CI_BASELINE.md` (this record)
- **Modified existing application/source files:** None.
- **Dependencies, package lock, Rust/backend, database, packaging:** Unchanged.

## Final implementation

- GitHub Actions events: pull requests targeting `main` and `workflow_dispatch` (manual trigger requires the workflow to be on the default branch).
- GitHub-hosted `ubuntu-latest`; `actions/checkout@v7` with credentials not persisted; `actions/setup-node@v7` with Node.js 24 and package-manager caching disabled.
- `permissions: contents: read`, no secrets, no privileged pull-request targets, no external data provider or production database.
- Serial steps: `npm ci`, `npm test`, `npm run typecheck:renderer`, `npm run build:renderer`.
- If install succeeds, all three validation steps run even if an earlier validation step fails (`!cancelled()` and `steps.dependencies.outcome == 'success'`). Failed steps **still fail the job**; there is no `continue-on-error`.
- No required branch protection checks, automatic merge or Rust/Tauri/Windows package checks added.

## Behaviour preserved

Application components, indicators, corporate actions, market-data/cache paths, chart/sheet persistence, drawing geometry, approval authority, native configuration and installed Windows binaries remain unchanged. No database was accessed. This GitHub-only change did not touch the local Windows working tree.

## Validation performed — actual first-run results

| Validation | Actual result |
|---|---|
| Local preview YAML parse and structural assertions (`PyYAML` BaseLoader) | **PASS**, 1,183 UTF-8 bytes, 44 lines of text |
| GitHub branch and workflow Git blob checks | **PASS**; workflow blob `b45bb59d0f3332ef320a9a5dbda337431dbe571b` |
| Draft PR #56 first-diff scope | **PASS**; only `.github/workflows/renderer-ci.yml` before this record |
| GitHub Actions run #42382741871 — commit `d07933bd929eee6fe4b8fef6bde978591e1e78ed` | **FAIL** overall (expected baseline not known beforehand) |
| Checkout | **PASS** |
| Node.js 24 setup | **PASS** |
| `npm ci` | **PASS** |
| `npm test` | **FAIL:** 3 test files failed, 217 passed, 1 skipped (221 total); 8 tests failed, 1,449 passed, 1 skipped (1,458 total) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**, Vite 6.4.3; log reports `built in 5.16s` |
| Rust/Cargo checks, Windows Tauri portable build, local UI and DB tests | **NOT RUN** (outside B00 scope) |

**Run evidence:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42382741871

### Observed Vitest failures — separate remediation required

1. `src/features/app/__tests__/sidebarKeyboardFocus.test.ts`: 1 failure; focus CSS source-text assertion did not match its expected `button:focus-visible` pattern.
2. `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`: 6 failures; test invokes `IdentityImportWorkspace` without a defined binding (`ReferenceError`).
3. `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`: 1 failure; source-text assertion expects `Find Official Replacement Candidates` absent from the inspected source string.

These failures occurred on a branch whose only application-related change was the CI workflow. The existing application and test source matches the base snapshot for the first run. **No attempt was made to patch, skip, suppress or relabel these failures.** Repair each cause as a separate, independently authorized bounded task.

## Risks and limitations

- CI baseline is **red**; do not set it as a required branch protection check before intentional triage and accepted validation.
- A successful renderer typecheck/build is not a full Vitest, Rust, Windows, production-data, or end-to-end certification.
- GitHub-hosted `npm ci` retrieves npm packages online. This does not alter the user's local dependencies; private GitHub Actions minutes may be consumed.
- GitHub-hosted Linux does not replace Windows portable/native acceptance. The user's local uncommitted working tree was not inspected or backed up; the isolated GitHub base commit is the rollback authority.
- This document records the first workflow run. Any subsequent workflow execution for this documentation commit must be inspected separately before PR approval.

## Rollback and completion gate

While unmerged, close draft PR #56 and stop using the isolated branch; `main` remains unchanged. If subsequently merged, revert the CI workflow through a reviewed new PR, preserving evidence. B00 is **not validated complete for merge** until follow-up checks and decisions on the baseline failures are recorded. Do not start B01 or any other bounded source correction without explicit approval.
