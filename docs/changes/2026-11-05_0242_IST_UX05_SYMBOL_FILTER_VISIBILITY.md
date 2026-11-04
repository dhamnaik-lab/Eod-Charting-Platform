# UX-05 — Make BSE/NSE symbol filter exclusions visible

**IST timestamp:** 2026-11-05 02:42 IST (UTC+05:30)
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`
**GitHub source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main` @ `787fe7c44fa08fa11176976aaf2b9975105695af`
**Change branch:** `fix/ux05-symbol-filter-visibility-20261105`

## Objective / previous limitation
In the Symbols sidebar, series and lifecycle/visibility filters can exclude loaded NSE or BSE symbols. The existing count displayed only filtered symbols, and an empty result said `No symbols available.`, potentially suggesting that the symbols were missing from the database rather than excluded by sidebar filters.

## Files changed
- Modified: `src/components/Sidebar.tsx`
- Created: `src/features/watchlists/symbolFilterVisibility.ts`
- Created: `src/features/watchlists/__tests__/symbolFilterVisibility.test.ts`
- Created: this change record.

## Implementation
- Compare the number of exchange-scoped **loaded search results** to the number remaining after existing series and lifecycle filters.
- When any loaded symbols are excluded, append a small `N hidden` hint to the existing sidebar symbol count. Do not present the hint as a total inventory count for the entire database.
- When loaded symbols exist but none survive filtering, replace misleading `No symbols available.` with an explanation that current Visibility/Series filters hide loaded results, and provide `Adjust filters` to open the existing filter menu.
- Preserve `No symbols available.` when no matching symbols were loaded, and preserve existing loading and no-database states.
- Keep existing `Clear` behavior and selection semantics unchanged. In particular, clearing series/lifecycle selections retains the accepted current-only lifecycle default; older/delisted/suspended categories still require explicit user selection.

## Behavior preserved
- Existing NSE and BSE series selection defaults and persisted localStorage preferences.
- Existing `CURRENT` lifecycle default and inactive category filtering, including historical symbols' source identity.
- Existing exchange and symbol searches; loading/empty states; watchlists, chart-opening and recent-symbol behavior.
- No backend data query, ingestion, symbol identity, database schema, chart rendering, or dependency change.

## Validation and actual evidence
- Verified the current GitHub `main` SHA and task-specific `AGENTS.md`, `Sidebar.tsx` and filter functions before branching: **PASS (source inspection)**.
- Reviewed GitHub source after edits for filter-call preservation, current-only default, hidden-count wiring, empty-state hint and button: **PASS (seven in-memory structural checks)**.
- Six focused test cases created for empty, unfiltered, partial, all-excluded and numeric-clamp cases plus source wiring: **NOT EXECUTED**.
- Focused Vitest: **NOT RUN**.
- TypeScript typecheck: **NOT RUN**.
- Frontend/Tauri/portable build: **NOT RUN**.
- Windows manual UI and NSE/BSE search filter acceptance: **NOT RUN**.
- This GitHub-only change does not modify the user's local checkout or production database.

## Risks and limitations
- Hidden counts are based on **already loaded** exchange-scoped symbols, possibly narrowed by search or API result limits, not all symbols stored in a database.
- Filtering out inactive records when no lifecycle category is selected is existing behavior; this fix does not change visibility eligibility.
- A narrow sidebar might truncate the additional count label; visually check the compact/classic themes before approval.
- The added tests include a source-contract check; runtime behavior still requires actual frontend and Windows checks.
- The pending audit items UX-02/08/10/11/12/13 are separate bounded problems.

## Rollback and acceptance
`main` remains untouched; close the unmerged draft PR to discard or revert this isolated PR after any subsequent merge. Keep all local dirty-worktree changes untouched. No local backup was generated because only GitHub source was edited.

Before merge: run `npm run test -- src/features/watchlists/__tests__/symbolFilterVisibility.test.ts`, relevant sidebar regressions, `npm run typecheck:renderer` and `npm run build:renderer`. Manually check BSE/NSE with current-only, series-selected, all-series, and inactive-category filters, including empty and query-limited result sets.
