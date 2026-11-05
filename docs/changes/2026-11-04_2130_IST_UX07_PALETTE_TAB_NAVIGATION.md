# UX-07 — Command Palette native Tab navigation

> **6 November 2026 (IST)** · Landed in `787fe7c44fa08fa11176976aaf2b9975105695af` via the [UI8 consolidation](2026-11-04_2336_IST_UI8_INTEGRATION_CANDIDATE.md#final-consolidation). Original proposal [PR #13](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/13). The later local focused suite passed. Finding-specific native acceptance remains unverified. The validation and rollback below describe the original proposal unless dated otherwise.

**IST:** 2026-11-04 21:30 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `dhamnaik-lab/Eod-Charting-Platform` main @ `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux07-command-palette-tab-navigation-20261104`

## Objective / prior defect
The Command Palette intercepted `Tab` in symbol mode to rotate All/NSE/BSE filters, including Shift+Tab. This blocked normal keyboard focus traversal to other controls and was inconsistent with accessible desktop dialog navigation.

## Files changed
- Modified: `src/components/CommandPalette.tsx`.
- Created: `src/components/__tests__/CommandPaletteKeyboardNavigation.test.ts`.
- Created: this Markdown change record.

## Final implementation
Removed the symbol-mode Tab interception. The browser can now perform natural Tab/Shift+Tab focus movement between existing focusable buttons, the search input, result buttons and close control. The existing visible All/NSE/BSE filter buttons remain and work with click or keyboard activation; there is no implicit exchange cycling shortcut. Added an explicit accessible label to the search input and replaced the obsolete footer hint `Tab Filter Exchange` with `Exchange: choose a filter button`.

## Behavior preserved
- Palette open/close shortcuts (Ctrl+K, S, /, Escape), existing symbol search result loading, history and selected-item navigation.
- Arrow Up/Down, Enter selection, filter-button actions, dragging and stored window position.
- No chart code, data, backend, UI layout dimensions, source parsing or new dependencies.

## Validation performed and actual results
- GitHub main revision and precise source paths inspected: **PASS**.
- Source patch structural checks: Tab interception removed, exchange buttons and arrow/Enter/Escape retained, input label and footer corrected: **PASS (5/5 static)**.
- Three focused regression tests added: **NOT EXECUTED**.
- Vitest, TypeScript, Vite build: **NOT RUN**, desktop testing deferred by user.
- Windows keyboard navigation in symbol mode and all-command mode: **NOT RUN**.
- No CI or build pass claims.

## Risks / limitations
- Intentional user-visible change: Tab no longer cycles exchange filters; access them via the existing buttons, including Shift+Tab from the input to preceding controls.
- Focus trapping/return and full modal ARIA semantics require a separate scoped review; not implemented here.
- Static contract tests cannot prove actual focus behavior in Windows WebView.
- No local project backup was created because this task was GitHub-only while the user was away from the desktop.

## Rollback guidance
The original main commit is preserved. Close the draft PR to discard the candidate or revert through a reviewed PR after any later merge, without resetting unrelated history.

## Deferred acceptance checklist
Execute `npm run test -- src/components/__tests__/CommandPaletteKeyboardNavigation.test.ts`, renderer typecheck and build. In Windows: open both palette modes; Tab/Shift+Tab from search into available controls, select filters using keyboard, navigate results via arrows and Enter, close with Escape, verify Ctrl+K/S// opening, focus order and no chart shortcut interception.
