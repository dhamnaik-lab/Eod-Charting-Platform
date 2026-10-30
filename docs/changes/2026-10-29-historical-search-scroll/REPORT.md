# Historical identity quick search and scrolling - 29 October 2026

Implemented UI-only changes. The user's screenshot confirms the rebuilt native
historical preview has 14 symbol, 17 name and 13 combined new changes, with zero
errors. This phase improves reviewing that plan; it does not apply it.

## Changes

- Extracted the Historical list into
  `src/features/corporateActions/identity/IdentityHistoricalPreview.tsx`.
- Added case-insensitive search across old/new/current symbols, company names,
  effective dates and review text. Multiple whitespace-separated terms must all
  match. Search scopes restrict results to symbols, company names or dates;
  dates support ISO fragments and day/month/year.
- Added an independent change-type selector for symbol, name or combined changes.
  Existing Actionable/All/Duplicates/Skipped/Errors filters still operate first.
- Added displayed-versus-total counts and an explicit reminder that Apply uses
  the full reviewed plan. Reset search clears the query/scope/type; Escape clears
  the query; Ctrl+F within the list focuses its search input.
- Replaced the nested legacy table-body scroll regions with one native scrolling
  region. Summary, search and outcome filters remain outside it; semantic table
  headings stick to its top. Keyboard focus can reach the scrolling region.
- Current-universe effects remain available under a disclosure in the same
  scrolling region. It identifies its rows as effects of the full reviewed plan.

The legacy layout nested page overflow and table-body overflow with contained
overscroll; it also allowed the toolbar/header to leave view. This structural
cause is removed. Actual pointer-wheel acceptance still needs the rebuilt
portable app because browser automation could not load the local fixture.

Owner integration changes are limited to `src/components/DatabaseToolsDialogs.tsx`
and historical rules in `identityImportWorkspace.css`. Filtering is implemented
in `historicalIdentitySearch.ts` and returns a new display array without modifying
the owner's result, hashes or Apply authority. No platform/backend/approval
handler or database schema changes were made.

## Protection and validation

Pre-edit backup:
`backups/pre_opencode_changes_20261029_202419_historical_search_scroll`.
Existing dirty work was preserved. No database Apply, financial approval, raw
price edit, Rust compile, release build, commit or push was performed.

| Check | Result |
| --- | --- |
| Focused search and Historical/compact/workspace contracts | PASS: initial 31 tests across 5 files |
| `npx vitest run --exclude 'tmp/**' corporateActionIdentity identityImportWorkspace historicalIdentitySearch identityNoActionApply --reporter=dot` | PASS: 80 tests across 15 files |
| `validate-change.ps1 -Profile renderer` with changed UI paths | PASS: renderer typecheck and scoped whitespace |
| `validate-change.ps1 -Profile docs` with scoped paths | PASS: references and whitespace |
| Actual browser pointer-wheel/search interaction | BLOCKED: both in-app and Edge navigation timed out before the fixture loaded |
| Rebuilt native portable acceptance | NOT TESTED; user rebuild required |

A read-only [browser fixture](qa.html) and [entry point](qa.tsx) use the retained
preview JSON at `tmp/nse-historical-repair-fde3f3e95dc4/repaired-preview.json`.
They import the actual new component and styles, and contain no desktop API or
Apply handler. A temporary Vite server on 127.0.0.1:5189 was stopped after the
navigation failures; a final listener check returned zero listeners. No preview
server remains running from this phase.

## Exact native acceptance

1. Rebuild portable and open NSE -> Official -> Historical identity. Preview
   Historical Identity; review counts should be unchanged by this UI patch.
2. Search `AMIRCHAND`: its dated transition to AEROPLANE should appear. Search
   `AEROPLANE` and verify it finds the same transition.
3. Search a company-name fragment with Company names scope; use Symbols scope
   to verify names alone do not match. Search `2026-07` or `20/07/2026` with
   Effective dates scope.
4. Combine a search with Symbol changes/Name changes/Combined changes and the
   existing outcome filters. Verify shown counts and empty results. Reset search
   should restore the selected outcome view; Escape should clear only the query.
5. Choose All or Duplicates and move the pointer over the middle of a table row.
   Roll the mouse wheel in both directions without hovering the scrollbar.
   Verify the rows move while summary, search, filters and headings remain visible.
6. Change a filter while scrolled down: the list should return to its top. Open
   Current-universe effects and confirm that section scrolls in the same region.
7. Search/filtering alone must never save changes. Reviewed Apply continues to
   use the entire reviewed plan and its existing explicit confirmation.
