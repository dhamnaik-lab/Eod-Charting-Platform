# CA diagnostics layout and observed preparation result — 23 October 2026

## Operator evidence

The supplied portable-build log ends successfully: optimized Rust release build completed in 2 minutes and portable packaging returned its output path. Executable SHA256: `EBFC8D6C490779DC7FD52DCF1B09E8B04A531989AA727FEB0CC755AFA490C462`. Seven warnings were reported; no build error was shown.

The operator's desktop screenshots now show a completed Load & Validate run, elapsed **11 minutes**, 134/134 dividend batches, 13,367 requested, 7,484 eligible, 5,883 ineligible, and no failed/stale/missing records or approvals. This is operator-observed desktop evidence, not an independently repeated controlled before/after benchmark. It supersedes the earlier absence of a complete desktop preparation observation; approval and chart-refresh acceptance remain separate.

The supplied totals reconcile:

- Ready: 12 Split + 7 Bonus + 7,484 Dividend = 7,503.
- Pending: 7,503 Ready + 25,129 Blocked = 32,632.
- Dividend: 7,484 Ready + 6,730 Blocked = 14,214.
- Dividend blocks: 5,883 ineligible evaluator results + 847 other dividend rows outside the completed verification scope = 6,730. The aggregate rejection report covers the 13,367 evaluated rows, not every pending dividend row.

The largest exact evaluator blocks are cash wording (3,150) and unproven identity (1,885). Those require separate app-side evidence/parsing investigation; this layout patch does not relax financial eligibility or approve any rows.

## Layout defect and fix

The expanded type summary had unpadded table cells, no column sizing, and an always-visible report textarea. Expanded diagnostics lived inside a non-shrinking control panel without a height limit. Together with the dividend reasons/report, they could push the pending-action list beyond the visible window.

The targeted edit in `src/components/DatabaseToolsDialogs.tsx` adds:

- Padded type labels and right-aligned numeric columns, tabular digits, horizontal overflow when needed, row/column header scope, and a visible TOTAL row.
- A pending-review diagnostic scroll area limited to `min(30vh, 280px)`.
- Separate, initially collapsed copy-report disclosures for type counts and dividend reasons. Textareas remain read-only, themed, and height-bounded.
- A 160 px minimum for the compact pending-action list, retaining the existing minimum in other views. This avoids overflow in the small-window preview.

No counters, report contents, reason aggregation, selection predicates, approval confirmation, backend calls, or financial rules changed.

Pre-edit backup: `backups/pre_opencode_changes_20261023_032440_ca_diagnostics_layout`.

## Validation

- PASS — `scripts/validate-change.ps1 -Profile renderer -Paths src/components/DatabaseToolsDialogs.tsx`: renderer typecheck and scoped whitespace.
- PASS — focused Vitest: PendingCompactLayout, AllTypeReadinessSummary, DividendBlockerSummary, DividendPreparedScopeObservability, OfficialApprovalUx; 5 files, 39 tests.
- PASS — isolated browser preview at 1280×720, using the actual diagnostic JSX/styles and supplied counts/reasons. With all four disclosures open, diagnostic height was 216 px, scroll content was 853 px, pending-action region was about 171 px high and ended at y=708, and document height remained 720 px. Header text bounds did not overlap. Both copied reports were read-only and reconciled.

The preview used a static surrounding shell and inert controls, with no Tauri bridge, database, or approval handlers. It verifies the changed renderer markup and layout seam, not the entire native window. The temporary server and browser tab were closed after inspection.

Preview artifacts: `tmp/ca-diagnostics-ui-20261023/types-preview.png`, `expanded-preview.png`, `layout-check.json`, and the static fixture/HTML. These are inspection artifacts, not runtime source.

No database mutation, Rust change, financial approval, portable build, or packaging was performed in this UI pass. Rebuilding the portable app is required to observe this source change in the native window. Startup/hint preparation and redundant scan batches remain performance follow-ups.
