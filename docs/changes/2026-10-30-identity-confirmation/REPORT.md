# Identity Apply confirmation dialog

30 October 2026 — `E:\TA Projects\EOD Charting Platform`.

The user rejected the generic `tauri.localhost says` confirmation shown by
`window.confirm()`. Identity maintenance now uses a themed application dialog
for NSE/BSE Current universe, NSE Historical identity and BSE company-name history.
Other browser confirmations outside Identity maintenance were not changed.

The dialog names the operation and destination database, presents full-plan
counts in separate cards, explains that search/category filters do not limit
Apply, and states which data remains unchanged. BSE distinguishes 1,531 new name
records from two duplicates, 1,310 skipped and zero held in the user's example.
Its action is **Save 1,531 name records**, rather than a generic OK. NSE historical
confirmation also lists its planned current-universe effects.

## Interaction and safeguards

- Cancel receives initial focus. Cancel, Close and Escape return false and retain
  the reviewed preview. The established modal restores focus to the opener and
  traps Tab within its controls. Enter on the initially focused Cancel cancels.
- An in-memory confirmation gate allows only one pending request, consumes its
  answer once, and rejects stale handlers. Database/source/plan changes,
  exchange/view changes, busy-state changes and unmount cancel pending reviews.
  Display-only search/category changes do not authorize or restrict Apply.
- Callers await confirmation before consuming reviewed authority or invoking the
  desktop write route. The destination is checked again in the NSE callers after
  the asynchronous dialog. Existing backend fingerprints, database rechecks,
  transactions and completed receipts remain unchanged.
- The dialog has a maximum width of 640 px, a scrollable body, and a separate
  action footer. Short windows retain accessible action buttons. This adds one
  optional styling class to the existing shared modal; its default markup and
  behavior remain unchanged for other consumers.

## Implementation and preservation

New `identity/IdentityApplyConfirmation.tsx` contains the confirmation component,
ephemeral gate, hook and count models. `BseNameHistory.tsx` and the three Identity
Apply handlers in `DatabaseToolsDialogs.tsx` use it. Styles are scoped in
`identityImportWorkspace.css`; `CorporateActionClassicWorkspace.tsx` accepts an
optional modal class. Focused tests cover gate behavior and review rendering.

Pre-edit backup:
`backups/pre_opencode_changes_20261030_105733_identity_apply_confirmation_dialog`.
No backend code, live database, raw price file, financial approval, build metadata,
portable output, commit or push was changed by this phase.

## Validation

- PASS: 50 focused tests across seven files, including 10 new confirmation tests
  covering waiting/cancel, exact-once confirmation, stale database/source/plan,
  duplicate requests, no-op guards, scope/counts and shared NSE/BSE presentation.
- PASS: renderer typecheck, CSS parsing, documentation references and scoped
  whitespace/UTF-8 checks.
- PASS: isolated interactive browser preview uses the actual production component,
  hook and CSS, with synthetic review data and **no desktop/database bridge**.
  At 1280×720 the BSE dialog is fully visible and Cancel is focused. At 800×500
  the BSE/NSE dialogs fit, the body scrolls and the action buttons remain visible.
  Tab moves Cancel → Save → Close; Escape cancels and restores the opener.
  Enter on default Cancel also cancels. NSE current/historical models render their
  own counts and actions; all exercised dialogs were cancelled.
- Evidence: [default-size BSE preview](bse-confirmation-1280x720.jpg),
  [short-window BSE preview](bse-confirmation-800x500.jpg), and
  [isolated HTML fixture](confirmation-preview.html).
  The temporary localhost server was stopped, the viewport override reset, and
  the temporary browser tab closed after inspection.
- PASS, later native evidence: the user rebuilt and supplied the new confirmation
  and completed BSE name Apply screenshots. Green 100%, APPLIED rows and disabled
  Apply are visible. The [read-only persisted audit](../2026-10-30-bse-name-history/native-apply-audit-20261030.json)
  confirms 1,531 saved name records, zero mismatches and the completed receipt at
  11:15:56 IST on 30 October 2026. The agent did not execute or repeat Apply.
- PASS, subsequent screenshots: native Recent Applied and expanded run evidence
  match the persisted receipt. See the later [report polish](../2026-10-30-identity-report-polish/REPORT.md)
  for its separate runtime changes and remaining acceptance.
- NOT TESTED: intermediate progress, restart persistence and native confirmation
  on other Identity routes. Isolated
  checks above remain separate from native acceptance.
