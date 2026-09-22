# Corporate Action R1C-I1 Manual Acceptance Closeout

Status: MANUAL RUNTIME ACCEPTED / I1 CLOSED  
Date: 2026-09-04  
Checkpoint time: after 16:57 IST

## Scope

This closeout records manual runtime acceptance of **Corporate Action R1C-I1 — Official Imports Fetch Improvements** after the automated R1C-I1 pass.

The active product remains the restored existing `CorporateActionDialog`. This checkpoint does not reactivate the reconstructed Fetch -> Load -> Review -> Approve architecture and does not reactivate a separate Corporate Action Maintenance product.

## Automated authority

- Automated report:
  `docs\changes\2026-09-04_1559_IST_CORPORATE_ACTION_R1C_I1_OFFICIAL_IMPORTS_FETCH_IMPROVEMENTS.md`
- Automated evidence:
  `E:\TA Projects\EOD Charting Platform Source Audit\CA_R1C_I1_OFFICIAL_IMPORTS_FETCH_2026-09-04_155934_IST_evidence.zip`
- Automated evidence SHA-256:
  `D6133E04347F84E645BF56E7E4D05F951633EB342041E66307EE2EE61C127F6A`
- Accepted portable:
  `E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`
- Accepted portable SHA-256:
  `64DFFA9C9748D6B12CBD781A1A2FFA29F0E306410CE4403299D947BAFE6AA7E3`
- `DatabaseToolsDialogs.tsx` accepted postimage SHA-256:
  `8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2`
- Focused I1 test SHA-256:
  `4F3A7B42F016264AEB0BDDB1C343147FC525947892FDDB89ECD4BB54697E75DF`

Automated validation recorded:
- focused GREEN/regression: 5 files / 13 tests passed
- full Corporate Action frontend regression: 25 files / 128 tests passed
- renderer typecheck passed
- renderer build passed
- portable Windows build passed
- Task 5B boundary preserved
- donor Normal/Maintenance architecture preserved
- no database access by the installer/runner
- no Git command by the installer/runner

## Manual runtime evidence accepted

### Direct-fetch exchange scope

The direct Official Fetch selector exposed:

- `NSE + BSE`
- `NSE`
- `BSE`

The CSV fallback remained a separate selector limited to concrete exchanges:

- `NSE`
- `BSE`

`NSE + BSE` was not exposed as a CSV-import exchange.

### NSE normal fetch

A normal NSE fetch completed with the expected ordered lifecycle:

1. `NSE - Fetch started`
2. `NSE - Complete`
3. `All selected exchanges complete`

The runtime showed cached-coverage reuse and zero automatic approvals.

The current database last-success record updated to an NSE success at 16:56 IST.

### BSE direct fetch

The BSE direct-fetch path ran independently and reported official BSE rows fetched. A later combined run confirmed BSE coverage completed successfully and was reusable from cache.

### Combined NSE + BSE fetch

A combined fetch completed in the required deterministic order:

1. `NSE - Fetch started`
2. `NSE - Complete`
3. `BSE - Fetch started`
4. `BSE - Complete`
5. `All selected exchanges complete`

The combined status reported 182/182 cached exchange-days reused.

The current database last-success record updated to:

`NSE + BSE · 04-09-2026 16:57 IST`

### Forced combined partial failure

A forced `NSE + BSE` run exercised the failure path:

1. NSE forced fetch started
2. NSE forced fetch completed
3. BSE forced fetch started
4. BSE failed with the real outbound BSE request error

Correct failure semantics were observed:

- no overall `All selected exchanges complete` record was written after the BSE failure
- the prior successful `NSE + BSE · 04-09-2026 16:57 IST` record remained unchanged
- the actual BSE request error was surfaced in the lifecycle log and operator status area

This manually confirms that a partial multi-exchange failure does not overwrite the last full successful fetch.

### Force Re-fetch preservation

Force Re-fetch remained available and bypassed saved coverage for the selected scope. NSE force mode fetched the requested range instead of reusing cached coverage.

### Review-first preservation

Fetched rows continued to enter the existing review-first flow. Runtime status explicitly confirmed that nothing was approved automatically.

The Review Queue remained populated and functional.

### Historical Backfill preservation

Historical Backfill remained reachable and functional.

A TCS pilot over the historical window returned:

- 3 source rows read
- 0 new review rows
- 3 exact duplicates
- 0 errors

The warnings remained visible to the operator rather than being hidden.

### Existing capability areas preserved

Manual runtime inspection confirmed continued reachability of:

- Manual Entry
- Identity Import
- Official Imports
- Scan Database
- Review Issues
- Review Queue
- Historical Backfill
- CSV fallback

## Date validation

The I1 production contract contains:

- From input bounded by To
- To input bounded by From
- explicit `From > To` rejection
- Fetch Official disabled for an invalid range
- Force Re-fetch disabled for an invalid range

The invalid range was not separately forced in the manual checkpoint because the date controls constrain the range. The behavior is covered by the focused automated contract.

## Persistence note

A prior last-success record was visible before the current fetch sequence, which is consistent with persistence for the active database.

Cross-database independence was not separately demonstrated by manually switching between two test databases during this checkpoint. The persisted storage helper remains keyed by exact active database path and its automated tests passed.

## External BSE failure note

The forced combined runtime encountered a real BSE outbound request error. This is treated as external/source-network behavior, not as a reason to weaken validation or multi-exchange failure semantics.

The failure was useful manual evidence because the UI correctly:

- retained the full diagnostic error
- marked BSE failed
- stopped the combined success lifecycle
- preserved the previous full-success record

## Closure

**R1C-I1 is closed and manually accepted.**

The five promoted improvements are now part of the active Corporate Action functional authority:

1. combined `NSE + BSE / NSE / BSE` direct-fetch scope
2. ordered per-exchange lifecycle log
3. per-active-database last successful fetch
4. improved real backend error surfacing
5. From/To validation and date bounds

Future Corporate Action UI/UX work must preserve these behaviors unless a later explicit requirement changes them.
