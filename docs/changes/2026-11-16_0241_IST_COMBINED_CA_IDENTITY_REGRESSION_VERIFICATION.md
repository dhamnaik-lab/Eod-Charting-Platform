# Combined Corporate Actions and Identity Recovery regression verification

- **Timestamp (IST):** 2026-11-16 02:41:47 +05:30
- **Workstream:** EOD Charting Platform
- **Authorized local root (not accessed):** `E:\\TA Projects\\EOD Charting Platform`
- **Repository:** `dhamnaik-lab/Eod-Charting-Platform`
- **Source authority:** `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Isolated validation branch:** `test/combined-ca-identity-regressions-20261116`
- **Source PRs:** draft PR #106 (CA readiness test) and draft PR #107 (identity source rollback confirmation test).
- **Purpose:** integration **validation only**; separate merge approval required.

## Goal and initial limitation

The unmodified `main` renderer suite has two independently confirmed failing tests:
1. The Corporate Actions normal adapter test incorrectly expected incomplete Rights financial terms to be Ready after local EOD validation.
2. The identity source rollback test required the obsolete native `window.confirm` call after an accepted move to an explicit themed confirmation dialog.

The main-equivalent baseline was verified in [draft PR #105](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/105), [GitHub Actions run 43759843377](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43759843377): **1,826 passed, 2 failed, 1 skipped; TypeScript PASS; Vite build PASS**.

Independently:
- PR #106: CA suite **17/17 PASS**, full suite 1,827 PASS, 1 unrelated identity FAIL, 1 skipped; typecheck/build PASS ([run 43760368433](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760368433)).
- PR #107: identity suite **6/6 PASS**, full suite 1,827 PASS, 1 unrelated CA FAIL, 1 skipped; typecheck/build PASS ([run 43760816073](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760816073)).

Those independent CI runs do **not** prove that both changes pass together.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` at `main` and PR #106 branch
- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` at `main` and PR #107 branch
- GitHub compare records for both drafts against the exact main commit
- Existing GitHub CI run results and change records
- Existing `package.json` test/typecheck/build scripts

## Exact combined implementation

Create this branch from the pinned main commit; copy only the two **already-verified test blobs**, unchanged:
- `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` — original `bc1570114f2fa0cb6217f85dccc956d1589df31a`, revised `98c06b88b8ca5c653ee3ba70e27f86874b356c6b` from PR #106
- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` — original `6b859fac153850acc20dec8a15a1c24378419803`, revised `1bf1670865342891f750470b09a0f666afa1bc9a` from PR #107

GitHub returned exact matching destination blob SHA for both revised sources. This change record is the only additional file.

**No production file, backend file, dependency, lockfile, build configuration, source settings, DB, or package was changed.**

## Behaviour preserved

- Rights financial terms (finite positive ratio numerator, denominator and issue price) remain mandatory for approvability.
- A local EOD price scan alone never supplies Rights financial terms.
- Existing dividend readiness, future-action deferral, and operator/backend revalidation remain unchanged.
- Rollback remains gated by prior review, deliberate themed operator confirmation, and backend authority; cancellation fails closed.
- F-01, F-52 and other audit work remain separately pending and unmerged.

## Validation gates and results

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Source authority | **Verified** pinned `main@42ae31ba` | Live GitHub commit search |
| Changes incorporated | **Verified** exact blob SHA matches for the two test files | GitHub fetch/update outputs |
| Combined source diff | **PASS:** exactly 3 changed files; 0 behind baseline | GitHub compare `main@42ae31ba` to branch |
| Combined full Vitest | **PASS:** 1,828 passed, 1 skipped, **0 failed**; 265 test files passed, 1 skipped | [Renderer CI #43762466626](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43762466626), `npm test` |
| Combined typecheck | **PASS**, job step succeeded | [Renderer CI #43762466626](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43762466626), `npm run typecheck:renderer` |
| Combined renderer build | **PASS**, Vite built in 5.50 seconds | [Renderer CI #43762466626](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43762466626), `npm run build:renderer` |
| Rust/portable/native | **Not executed**, not needed to establish test-only renderer integration; Windows acceptance remains deferred | No native runner |
| Manual approval and GitHub merge | **On hold** | User approval required |

Confirmed actual GitHub command output: the full suite has 1,828 passed, 1 skipped, **zero failures**, including all 17 Corporate Actions adapter tests and all 6 identity-recovery tests. TypeScript typecheck and renderer Vite build passed. The successful run tested source/test commit `f990fc7b216ff4d030227300f8afa1bd614372b4`. Updating this record changes documentation only and may trigger another CI run; do not confuse these commits.

## Risks, limitations and next step

- Source-only regression tests and renderer CI are not proof of native Tauri/WebView2 behaviour.
- These are test contract updates; a passing suite does not authorize any Rights approval or source rollback.
- Existing CI baseline is pinned. A newer main commit, should one appear, requires re-comparison before integration.
- Keep this PR draft and **do not merge** until the user explicitly approves. Do not close or merge PRs #106 and #107 as a side effect.

## Rollback

Discard this isolated validation branch/PR; no edits to `main` occurred. For exact test restoration use source blobs from `main@42ae31bae7937dde944c87a997b94da933ad1a0b`. Preserve the separate original draft PRs and their evidence.
