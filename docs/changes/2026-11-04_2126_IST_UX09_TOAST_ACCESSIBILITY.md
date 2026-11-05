# UX-09 — Accessible toast announcements and dismissal

> **6 November 2026 (IST)** · Landed in `787fe7c44fa08fa11176976aaf2b9975105695af` via the [UI8 consolidation](2026-11-04_2336_IST_UI8_INTEGRATION_CANDIDATE.md#final-consolidation). Original proposal [PR #11](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/11). The later local focused suite passed. Finding-specific native acceptance remains unverified. The validation and rollback below describe the original proposal unless dated otherwise.

**IST timestamp:** 2026-11-04 21:26 IST (UTC+05:30)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main` @ `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux09-accessible-toast-notifications-20261104`

## Objective and previous defect
The notification layer rendered clickable toast `div` elements without screen-reader announcement semantics or a keyboard-operable dismissal button. Messages could be dismissed by pointer click only, which is insufficient when the user relies on keyboard or assistive technology.

## Files changed
- Modified: `src/components/ToastContainer.tsx`
- Created: `src/components/__tests__/ToastAccessibility.test.ts`
- Created: this `docs/changes/` record.

## Final implementation
- Error and warning toasts use `role="alert"` and assertive live announcements.
- Informational and success toasts use `role="status"` and polite live announcements.
- A labelled, keyboard-operable `button` dismisses the toast. Button click stops propagation to prevent two dismissal actions.
- Existing full-toast pointer click dismissal is retained; title, message, semantic accent color, stacked placement, background and animation remain.
- No toast store, message dispatch, timing, alert rules or backend logic was changed; no new dependency.

## Behavior preserved
- All toast types and their text.
- Click anywhere on the toast to dismiss, plus new dedicated dismiss button.
- Position and pointer-event passthrough between toasts.
- No changes to chart, dialogs, Bhavcopy, identity, market data or database operations.

## Validation performed / results
- Current pinned GitHub branch source inspected before modification: **PASS**.
- Isolated branch created from pinned main: **PASS**.
- Static inspection after patch: announcement role, aria-live, full-toast click, dedicated button/event isolation, original text/accent logic: **PASS (5/5 source invariants)**.
- Three focused regression tests created: **NOT EXECUTED**.
- `npm run test -- src/components/__tests__/ToastAccessibility.test.ts`: **NOT RUN**.
- TypeScript typecheck and Vite renderer build: **NOT RUN**, user deferred.
- Actual Windows keyboard and screen-reader announcement checks: **NOT RUN**, user deferred.

## Risks / limitations
- Screen-reader announcement timing, severity verbosity, accessible name and focus order require native manual verification.
- Existing removal timing, mobile layout, and other accessibility issues were intentionally left unchanged.
- Adding a focusable button changes tab order while a toast is present, as intended; verify it does not compete with modal focus or chart shortcuts during Windows acceptance.
- Static source checks do not certify runtime accessibility.

## Rollback
The original `main` commit is unmodified. No local PowerShell backup was possible or attempted because the user is away from the Windows desktop and the change is GitHub-only. Discard by closing the draft PR without merging, or revert in a new reviewed PR if later merged. Never reset unrelated commits.

## Deferred checkpoints
Run focused Vitest, renderer typecheck, renderer build, then Windows keyboard tests (Tab/Enter/Space) and screen-reader announcement tests with error, warning, success and info toasts. Verify click-to-dismiss and background click passthrough, including concurrent notifications.
