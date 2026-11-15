# Identity source rollback — preserve explicit themed confirmation test contract

- **IST timestamp:** 2026-11-16 02:24:53 (+05:30)
- **Workstream/local authorized root:** EOD Charting Platform, `E:\\TA Projects\\EOD Charting Platform`
- **Repository source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Branch:** `test/identity-rollback-confirmation-20261116`
- **Bounded issue:** stale source-inspection assertion after accepted themed confirmation migration. No production modification.

## Objective

Restore an explicit, fail-closed identity-source rollback test contract without reintroducing the native `window.confirm` dialog or changing backend rollback authority.

## Previous defect/limitation

Unmodified `main` reproducibly failed `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` at the assertion requiring `window.confirm(` inside `applyOfficialSourceRollback`. The current implementation correctly uses `await confirmation.confirm(...)` from `useActionConfirmation`. This shows a modal `role=alertdialog`, provides an explicit Cancel action, returns false on cancellation, refuses overlapping confirmation requests, and delays `api.applyOfficialSourceRollbackReviewed` until confirmation succeeds. The obsolete test expected the previous mechanism, not the accepted semantic contract.

Baseline evidence: [read-only main PR #105](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/105), [Renderer CI 43759843377](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43759843377), 1,826 pass / 2 fail / 1 skipped on source-identical `main`.

## Files inspected

- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`
- `src/components/DatabaseToolsDialogs.tsx` (review/confirm/apply ordering and dialog host)
- `src/components/common/useActionConfirmation.tsx`
- `src/features/app/useDialogFocus.ts` (shared focus subsystem context)
- `docs/changes/2026-11-15_2019_IST_AUDIT_BOUNDED_UI_PERFORMANCE.md` (existing themed confirmation change)
- `package.json`
- GitHub Renderer CI evidence and baseline PR.

## Files modified

1. `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` — replace native-dialog string check with a check of the current async `confirmation.confirm` guard before backend apply and the themed dialog's cancellation/fail-closed paths.
2. This change record.

No `src/components/DatabaseToolsDialogs.tsx`, `useActionConfirmation`, production state, backend, database, build system or dependencies changed.

## Final implementation

The regression now verifies:
- Rollback review is separate from application; the reviewed rollback guard exists.
- The **async negated confirmation** is evaluated before the backend apply call.
- The confirmation dialog is rendered in the active Corporate Actions owner.
- The helper includes modal `alertdialog` semantics, explicit Cancel-to-false, and a refuse-overlapping-confirmations fail-closed guard.
- No change to the actual confirmation message, review gate, result handling, database context, or API payload.

## Behaviour preserved

- No rollback without prior reviewed authority and deliberate operator confirmation.
- Cancel/Escape, owner removal or database context change may abort the action.
- Backend remains authoritative for stale review rejection and source-history integrity.
- Other identity recovery tests and Corporate Actions financial policy are unchanged.
- No real rollback, database access, internet fetch, file-system source edit or financial action.

## Validation and evidence

| Gate | Command/evidence | Actual result |
| --- | --- | --- |
| Untouched main baseline | GitHub CI #43759843377 | **Confirmed** two failures, including stale rollback native-dialog assertion; typecheck/build pass |
| Identity recovery regression | Included in CI full `npm test`; not separately invoked | **PASS:** 6/6 tests |
| Renderer Vitest | `npm test` | **FAIL overall:** 1,827 passed, 1 failed, 1 skipped; only failure is the out-of-scope CA fixture contract |
| Renderer TypeScript | `npm run typecheck:renderer` | **PASS** in [GitHub Renderer CI 43760816073](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760816073) |
| Renderer build | `npm run build:renderer` | **PASS**, Vite built in 7.66s in CI 43760816073 |
| Source diff | GitHub compare against `main@42ae31ba` | **PASS:** exactly 2 files (1 test, 1 documentation), 0 behind baseline |
| Windows portable/manual | `npm run tauri:portable:win` | **User-held / not run** |

## Risks and limitations

- This is a focused source-contract test. Existing UI/headless checks (see `scripts/verify-audit-ui.mjs`) test operator modal flows separately. No native test is claimed here.
- The separate Corporate Actions test stale expectation is corrected in held draft PR #106; this independent branch intentionally does not include it, so full Vitest may still report that CA failure.
- Test-only branches must not be merged without review and explicit approval; one branch cannot certify combined green until both bounded fixes are integrated.
- The project source root and database were not accessed from this GitHub-only task.

## Rollback

Discard this draft branch or revert only the test change to the exact file blob on `main@42ae31bae7937dde944c87a997b94da933ad1a0b`. Preserve the accepted themed confirmation implementation. Do not reintroduce `window.confirm` solely to satisfy an obsolete test.

## Evidence

- Pinned source `42ae31bae7937dde944c87a997b94da933ad1a0b`
- Initial test-only commit `98fa87ab74e8c192d064f908c1bdee8d2d07a585`
- Tested source commit: `06b922c3bc3cef1094d7c3032271c3d2c7aebcc3`.
- [GitHub Renderer CI 43760816073](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43760816073): identity tests 6/6 PASS; full suite fails only the unrelated CA readiness fixture, TypeScript and Vite build PASS.
- Subsequent documentation-only update does not affect renderer/test source.
