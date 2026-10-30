# Queue Exchange, date ordering and approval-history paging — 25 October 2026

## Changes

- Main Pending/Approved queue: sortable, resizable Exchange column using the import's actual exchange. No symbol inference or identity changes. Virtual spacer rows span all eight columns, including selection.
- Initial queue sorting and Clear all filters now use newest ex-date first. Users can still choose other columns/directions. Recent approval history remains newest **approval timestamp** first, independently of queue sorting.
- Reports → Recent approved actions: starts with 200 records; Load more appends another 200 using the existing backend offset API. Refresh history restarts at the latest approval. Overlapping pages are deduplicated by import ID; offsets advance by fetched rather than displayed rows. Empty/short pages mark the end. A failed page retains existing rows and the retry offset. Duplicate requests and stale database/generation replies are guarded. New approvals during paging may change offsets; Refresh starts a fresh view. There is no new database retention cap or change to saved approvals.
- All eligibility, evidence, selection and explicit financial-confirmation guards remain unchanged. No live financial approval was attempted.

## HEGAM read-only evidence finding

The user's native screenshot establishes that the July 22, 2026 dividend is no longer Ready. The read-only follow-up checked `EOD DATABASE/Nse/market-data.sqlite3` with SQLite URI `mode=ro` and `PRAGMA query_only=ON`:

- Local NSE instrument identity-history query for ISIN `INE545A01024`, HEG and HEGAM returned zero rows.
- Retained symbol-chain source ID 2, captured `2026-10-23 20:58:41`, contains: HEG Advanced Materials Limited, **HEG → HEGAM**, effective **22-SEP-2026**.
- Source URL: `https://nsearchives.nseindia.com/content/equities/symbolchange.csv`; SHA-256 `b080e538a5c3c8b5cc1fd048768b2b660c880cc38b3c2bafc7c0f1b2f983566e`. Recomputed retained-byte SHA-256 matches the stored hash.

This is retained-source evidence, not a fresh network capture or an applied identity transition. The earlier diagnosis that no local dated route exists remains true, but the underlying retained CSV does contain a dated rename candidate. Next identity seam is governed reconciliation/routing of that retained transition, with event-date/ISIN rechecks and disposable-copy verification. No identity history, import evidence, raw prices or approval status was changed. HEGAM stays blocked until that separate integration is validated; do not fetch prices blindly or bypass the writer.

## Validation

PASS: `npx vitest run --exclude 'tmp/**'` with the four exact active paths: `corporateActionClassicModel.test.ts`, `corporateActionApprovalReports.test.ts`, `corporateActionDividendExplicitApprovalR1.test.ts`, `corporateActionMaintenanceNavigation.test.ts` — **28 tests**. Coverage includes date ordering/undated events, exchange fidelity, exact approval IDs, history beyond 200, overlapping/empty pages, unchanged prior rows, and source-contract checks for guards and virtual-table wiring.

PASS: `scripts/validate-change.ps1 -Profile renderer -Paths <seven affected existing files>` via process-scoped PowerShell execution-policy bypass — renderer typecheck and scoped whitespace. Rust logic was not changed, so Rust tests/full builds were not run.

Backup: `backups/pre_opencode_changes_20261025_021035_ca_exchange_history_paging`.

Native rebuild/interaction acceptance remains pending: inspect Exchange in both views, date default/reset, Load more beyond 200 and Refresh without losing existing rows on error. A deliberate single Ready-action approval and chart-refresh acceptance is still separate and was not performed here. Existing BSE master-collection acceptance is also unchanged.
