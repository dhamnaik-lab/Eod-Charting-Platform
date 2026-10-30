# CA type checkboxes and date-scope review — 23 October 2026

## Backup and changes

Pre-edit backup: `backups/pre_opencode_changes_20261023_175851_ca_type_quick_filters`.

Changed the classic CA type filter from single-choice to a compact checkbox popup. Split, Bonus, Dividend, Rights, Demerger and Other can be combined independently. Quick choices: All, Split + Bonus, Dividends, None. Changing types clears the previous approval selection and confirmation; the existing filtered Ready ID intersection remains authoritative. None displays zero rows and zero Ready actions.

The popup stays within the existing second toolbar row. It renders outside the horizontally scrolling toolbar to avoid clipping on smaller windows, closes on outside click/Escape/resize, and supports keyboard navigation back to Status. Scope wording now says **Fetch dates only**; Load & Validate explains its all-pending scope in a tooltip.

Runtime files: `src/components/DatabaseToolsDialogs.tsx`, `src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx`, `corporateActionClassicModel.ts`, and `corporateActionClassicWorkspace.css`. The ignored, sample-only preview fixture was adapted to the new multi-selection props. No backend, persisted data, financial approval, build or packaging changes were made.

## Verified current date behavior

- `fetchOfficialActions` sends `fetchFromDate` and `fetchToDate` to official source collection.
- `loadAndPrepareOfficialImports` calls `prepareCorporateActionPendingImports` without the fetch dates.
- `loadAllPendingCorporateActionImports` enumerates `listCorporateActionImports({ excludeApproved: true, limit, offset })`: the complete outstanding pending queue, across dates.
- Type, Status and Find restrict presentation/approval selection, not the preparation workload. Changing fetch dates does not remove older imported records or bound Load & Validate.

The range has a real purpose for Fetch. A future selected-period validation option must be a separate, explicit scope with corresponding backend evidence/recheck handling. This task does not silently introduce scoped preparation.

## Review of the user-provided results

Evidence: the six screenshots and portable-build log supplied in this request. This was a screenshot/source review, not a live native workflow audit.

1. Initial screen: compact list layout works, but the single-choice Type control prevented combinations. Restored checkboxes in this task.
2. Loaded list/report: `32,639 = 4,394 Ready + 14,757 blocked + 13,488 informational`. Split 3 Ready + Bonus 3 Ready + Dividend 4,388 Ready = 4,394. Ready still requires deliberate approval.
3. Dividend report: requested 7,847 = 4,388 eligible + 3,459 ineligible; 79/79 batches, zero failed shown. The total Dividend queue is 16,241, so 8,394 records were outside this verification candidate scope. The screenshot does not prove why each was excluded.
4. Search example: KOTAKBANK rows span many years because Fetch dates do not filter the pending list. Dates within the symbol are not chronological under the current symbol-only sort. Different statuses are visible; percentage-worded records remain unready. The latest Ready count is lower than the earlier screenshot and needs an evidence comparison, not an assumed UI explanation.

The supplied log reports a successful release build, seven warnings and portable verification SHA-256 `375F214AB6B99CA0C1E6CDC4C2561337826E7A052B90D44C1627DA44F4D70524`. This confirms the user's build log outcome, not a new build in this task.

## Recommended next UI work

1. Searchable exact-symbol selector showing exchange, symbol and company, with All symbols and Current chart symbol. Preserve free-text Find separately; do not turn a partial company-name match into a persisted identity mapping.
2. Explicit validation scope: All outstanding pending / Selected fetch period. Keep source collection dates and review/list date filters clearly distinguished. Treat scoped preparation as a separate behavior change requiring backend design and focused validation.
3. Sort Symbol then Ex-date within a symbol, preserving deterministic ties. Keep Ex-date column sorting available.
4. Replace nested Dividend report scroll regions with one report table and Copy/Export controls; keep detailed backend wording available in Details.
5. Explain Ready/awaiting evidence/informational counts separately and show which verification candidates were excluded. Investigate the lower candidate/Ready count using current persisted reasons before changing eligibility rules.

## Validation and limits

- PASS: focused Vitest, 4 files / 30 tests (ClassicModel, PendingPreparation, OfficialApprovalUx, DividendExplicitApprovalR1), excluding `tmp/**`.
- PASS: `scripts/validate-change.ps1 -Profile renderer -Paths src/components/DatabaseToolsDialogs.tsx`, TypeScript and scoped whitespace.
- PASS: sample browser interactions for quick choices, arbitrary combinations, None, selection clearing and Tab return to Status. Screenshot: [checkbox quick filter](assets/ca-type-filters-20261023/checkbox-quick-filter.png).
- PASS: 620 × 460 maximized preview; checkbox popup stays visible above the horizontally scrolling table/filter region. No extra toolbar row is introduced.
- No native rebuild or real database preparation/approval was run. Full accessibility compliance and native window behavior are not established by this browser preview.
