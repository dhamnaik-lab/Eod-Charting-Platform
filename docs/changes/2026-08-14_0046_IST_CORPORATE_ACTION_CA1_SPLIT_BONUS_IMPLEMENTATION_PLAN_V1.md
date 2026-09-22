# Corporate Action CA-1 — Split + Bonus Validation and Approval UX Implementation Plan V1

**Date:** 2026-08-14 00:46 IST (+05:30)  
**Status:** PLANNED / NOT YET IMPLEMENTED  
**Project:** EOD Charting Platform  
**Project Root:** `E:\TA Projects\EOD Charting Platform`  
**Implementation Phase:** Corporate Action CA-1  
**Scope:** Split + Bonus only, plus the shared local-calendar date helper used by Corporate Actions  
**Source Baseline:** `Eod Charting Platform Source Code 2026-08-14_001606_IST`  
**Uploaded Baseline ZIP SHA-256:** `514168dfe18bc0375cb8dc727c5f3536f06186baeca52d5580b427f3523f2327`

---

## 1. Document Purpose

This document freezes the implementation contract for the first Corporate Action correction phase before any source-code change is made.

CA-1 will make official **Split** and **Bonus** corporate actions understandable, evidence-driven, and safe to approve without changing the existing economic meaning of adjusted historical data.

This document is **not evidence of implementation, test success, build success, packaging success, or manual acceptance**. Those claims may only be made after the corresponding source changes and actual validation command output exist.

---

## 2. Goal

Implement a clear Split/Bonus workflow where the platform:

1. imports or loads the official corporate-action record;
2. resolves the official row to the correct database instrument;
3. derives the official share and historical-price factors;
4. compares local market prices around the ex-date with the theoretical adjusted previous close;
5. explicitly preserves any genuine ex-date gap-up or gap-down;
6. shows identity evidence and price-validation evidence in the same review workflow;
7. allows straightforward one-click approval when evidence is normal;
8. requires deliberate review when identity or price evidence is unusual;
9. keeps raw `.eod` historical price data unchanged;
10. preserves existing safety controls and duplicate/idempotent approval behaviour.

---

## 3. Scope

### 3.1 Included in CA-1

- Official Split imports.
- Official Bonus imports.
- Instrument/identity resolution presentation.
- Local price validation around the official ex-date.
- Theoretical adjusted-price calculation.
- Residual real-market gap calculation.
- Clear validation classifications.
- Official Imports review-table UX.
- Approval gating and review workflow for Split/Bonus.
- Clear share-multiplier versus price-multiplier presentation.
- Removal of ambiguous raw implementation statuses from the main user-facing workflow.
- Automatic or directly integrated Split/Bonus validation so normal approval does not require moving to a separate Scan tab.
- Shared local-calendar date helper correction in `DatabaseToolsDialogs.tsx`.
- Focused Rust and TypeScript/Vitest regression tests.
- Mandatory implementation change report after source changes.

### 3.2 Explicitly out of scope for CA-1

Do not mix the following work into CA-1:

- Rights calculation correction.
- Dividend adjustment redesign.
- Demerger completion/correction.
- Historical approved-row repair application.
- The previously identified defective approved-action backlog repair.
- Blind Scan redesign beyond what is strictly necessary to avoid CA-1 regression.
- Corporate Action source-fetch provider redesign.
- Database-wide storage architecture changes.
- General refactoring of the approximately 11k-line Corporate Action backend module.
- Automatic approval of official actions.
- Rewriting raw historical `.eod` data.

These items require later independently audited phases.

---

## 4. Fresh Baseline Evidence

The CA-1 plan is based on the verified Aug-14 source snapshot.

### 4.1 Key source hashes

| File | SHA-256 |
|---|---|
| `src-tauri-shell/src/database/corporate_action_imports.rs` | `becd17cc7dac3a1a89a9e879c2180611a8df5b98b743aa755fd2b52e240c7dc4` |
| `src-tauri-shell/src/database/eod_data.rs` | `9f5485f2d43192872f45de9510eaf5a61ba0255d1d80488cc4a8e5bfc0e5fef9` |
| `src/components/DatabaseToolsDialogs.tsx` | `d0fea01cb9f57fd771c842e9d583646506cc014f89da954d14ea488e25b30652` |
| `src-tauri-shell/src/database.rs` | `fc9805d85170e338fa94ffc4995fe0dde1774f0c7694ce51b4c013ce8964f0d8` |
| `src-tauri-shell/src/database/bootstrap.rs` | `4e2c611eecf7575b5e4811c11d96c9c47d0eb88f200f05968efa7d6f86c4f348` |

These hashes identify the audited pre-implementation state only.

---

## 5. Confirmed Existing Behaviour to Preserve

### 5.1 Raw EOD history remains authoritative and unmodified

Existing adjusted-history reads apply Corporate Action factors at read time. CA-1 must preserve this architecture.

For a Split/Bonus with share multiplier `F`:

\[
AdjustedPrice = \frac{RawPrice}{F}
\]

for eligible historical rows before the corporate-action effective boundary.

The ex-date/post-action market bar remains the actual market bar.

### 5.2 Genuine ex-date price movement must remain visible

Example:

- previous raw close: `₹100`
- official split: `1 old share -> 2 new shares`
- share multiplier: `2.0`
- historical price multiplier: `0.5`
- theoretical adjusted previous close: `₹50`
- actual ex-date open: `₹52.50`

The adjusted chart must show:

- adjusted previous close: `₹50`
- actual ex-date open: `₹52.50`
- genuine residual opening gap: `+5%`

CA-1 must **not** alter the official factor merely to eliminate the real market gap.

### 5.3 Existing identity protection remains authoritative

The current backend blocks ordinary approval when an official import is unresolved to a database symbol.

CA-1 must preserve identity safety and existing ISIN mismatch protection.

### 5.4 Existing duplicate/idempotent approval behaviour remains

If an import already links to an approved Corporate Action or an equivalent action already exists, CA-1 must preserve the current non-duplicating behaviour.

---

## 6. Confirmed Current Limitations Driving CA-1

### 6.1 `UNRESOLVED` is an identity state, not a price-validation state

Current backend derivation returns `UNRESOLVED` primarily when the official row cannot be mapped safely to a database instrument or no resolved symbol exists.

This is internally legitimate but is confusing when shown directly to the operator.

**CA-1 requirement:** keep compatibility internally if necessary, but present the user-facing meaning as:

> **Instrument Match Required**

Identity state and price-validation state must be shown separately.

---

### 6.2 Price validation already exists but is isolated from normal approval

The existing official scanner reads local bars around the ex-date and calculates:

\[
ActualOpenFactor = \frac{PreviousClose}{ExDateOpen}
\]

\[
ActualCloseFactor = \frac{PreviousClose}{ExDateClose}
\]

It then compares observed factor(s) with the official expected factor.

The current scanner classifies a result as `MATCHED` when the selected confidence is at least `0.85`.

However, this scan result is not currently part of the normal approval gate.

**CA-1 requirement:** normal Split/Bonus review must surface this evidence in the Official Imports workflow instead of forcing the operator to run and interpret a separate Scan workflow.

---

### 6.3 Current scan confidence hides which market observation disagrees

Current scan logic takes the better confidence of ex-date Open or Close.

This can conceal an abnormal opening move if the close later returns near the theoretical level.

Example:

- theoretical adjusted price: `₹50`
- ex-date open: `₹70`
- ex-date close: `₹51`

A "best of open/close" headline can make this appear matched even though the stock opened `+40%` above the theoretical adjusted reference.

**CA-1 requirement:**

- calculate and show **opening residual separately**;
- calculate and show **closing residual separately**;
- do not silently substitute the more favourable observation;
- opening residual is the primary ex-date discontinuity indicator;
- closing residual is secondary evidence.

---

### 6.4 Current UI hides useful scan evidence

The backend result already carries:

- previous trading date;
- ex trading date;
- previous close;
- ex-date open;
- ex-date close;
- expected factor;
- actual open factor;
- actual close factor;
- confidence;
- status;
- message.

Current scan-table presentation omits most of the prices and confidence.

**CA-1 requirement:** show human-readable price evidence directly in the official review workflow.

---

### 6.5 `Adj Factor` is ambiguous

Current Official Imports UI presents one value such as:

`2.000000`

under `Adj Factor`.

For a 1-to-2 split this value is effectively the share multiplier used to divide historical prices. A user can reasonably interpret "adjustment factor" as the price multiplier `0.5`.

**CA-1 requirement:** replace ambiguous presentation with explicit values:

- **Share Multiplier** `×2.000000`
- **Price Multiplier** `×0.500000`

Do not require the operator to infer the reciprocal.

---

### 6.6 Bare ratio notation is ambiguous

Current manual guidance uses forms such as `2:1 split` and `1:1 bonus`.

External sources and users may use opposite ratio conventions.

**CA-1 requirement:** where possible, display the semantic meaning in words.

Examples:

**Split**
> `1 old share -> 2 new shares`

**Bonus**
> `1 bonus share for every 2 existing shares`  
> `2 existing -> 3 total`

The ratio may remain as secondary evidence, but it must not be the only explanation.

---

### 6.7 Corporate Action date helper currently uses UTC calendar date

Current `todayIso()` uses:

```ts
new Date().toISOString().slice(0, 10)
```

That is the UTC date, not the local calendar date.

In India, from midnight IST until 05:29:59 IST, it can resolve to the previous date.

The same helper is used by Corporate Action date defaults.

**CA-1 requirement:** replace UTC-derived date defaults with a local-calendar-safe `YYYY-MM-DD` formatter while preserving all consumers of the shared helper.

`addDaysIso()` must also remain calendar-day-safe and must not introduce a UTC round-trip day shift.

---

## 7. Core Design Principle

Corporate Action validation must distinguish two authorities:

### 7.1 Official corporate-action source

The official source determines:

- action type;
- ex-date;
- split/bonus terms;
- expected share multiplier;
- expected historical price multiplier.

### 7.2 Local market prices

Local EOD bars are **validation evidence**.

They help answer:

> "Does the local price discontinuity broadly agree with the official action?"

They do **not** redefine the official action merely because the stock had a genuine news-driven gap-up or gap-down.

---

## 8. Required Split/Bonus Mathematics

### 8.1 Split

For:

> `1 old share -> 2 new shares`

\[
ShareMultiplier = 2
\]

\[
PriceMultiplier = \frac{1}{2} = 0.5
\]

\[
TheoreticalAdjustedPreviousClose = PreviousClose \times PriceMultiplier
\]

Equivalent current read-path representation:

\[
TheoreticalAdjustedPreviousClose = \frac{PreviousClose}{ShareMultiplier}
\]

---

### 8.2 Bonus

For:

> `1 bonus share for every 2 existing shares`

Existing shares = `2`  
Bonus shares = `1`  
Total post-bonus shares = `3`

\[
ShareMultiplier = \frac{3}{2} = 1.5
\]

\[
PriceMultiplier = \frac{2}{3} = 0.666666\ldots
\]

The UI must show the semantic interpretation instead of relying on `1:2` alone.

---

## 9. Required Residual Market-Move Calculation

For the ex-date Open:

\[
OpeningResidualPct =
\left(
\frac{ExOpen}{TheoreticalAdjustedPreviousClose} - 1
\right)
\times 100
\]

For the ex-date Close:

\[
ClosingResidualPct =
\left(
\frac{ExClose}{TheoreticalAdjustedPreviousClose} - 1
\right)
\times 100
\]

### Example

Previous close: `₹100`  
Share multiplier: `2`  
Theoretical adjusted previous close: `₹50`  
Ex-date open: `₹52.50`

\[
OpeningResidualPct = \left(\frac{52.5}{50}-1\right)\times100 = +5\%
\]

The `+5%` is genuine market movement and must remain on the adjusted chart.

---

## 10. CA-1 Validation Classification

Initial CA-1 user-facing classification:

| Absolute opening residual | User-facing classification |
|---:|---|
| `<= 5%` | `STRONG MATCH` |
| `> 5% and <= 15%` | `PLAUSIBLE MATCH` |
| `> 15%` | `PRICE MOVEMENT REVIEW` |
| Required local bars unavailable | `PRICE DATA UNAVAILABLE` |

### 10.1 Important safety rule

A large residual does not automatically invalidate an official action.

It may be caused by:

- earnings;
- merger/takeover news;
- market shock;
- circuit movement;
- company-specific information;
- another simultaneous event.

Therefore a large residual changes the review status, not the official factor.

### 10.2 Constants

Thresholds must be defined in one backend policy location with descriptive names.

Do not scatter literal `0.05` or `0.15` values across backend and UI.

---

## 11. Target Normal Workflow

```text
Official NSE/BSE Corporate Action
            |
            v
Parse Split / Bonus
            |
            v
Resolve Database Instrument
            |
            +---- not resolved ----> Instrument Match Required
            |
            v
Derive Official Share / Price Factors
            |
            v
Load Previous Trading Close
            |
            v
Load First Trading Bar On/After Ex-Date
            |
            v
Calculate Theoretical Adjusted Previous Close
            |
            v
Calculate Opening and Closing Residual %
            |
            v
Display Evidence in Official Imports
            |
            v
Ready to Approve / Price Movement Review
            |
            v
Manual Operator Approval
```

The separate Scan tab may remain for diagnostics and Blind Scan, but it must not be required for the normal official Split/Bonus approval path.

---

## 12. User-Facing Status Model

Backend compatibility statuses may remain where necessary, but the primary UI must separate:

1. **Identity Status**
2. **Price Validation**
3. **Approval Status**

### 12.1 Suggested mappings

| Existing/internal state | Primary UI meaning |
|---|---|
| `UNRESOLVED` | `Instrument Match Required` |
| `PENDING_ISIN_MISMATCH` | `Identity Evidence Review Required` |
| `NEEDS_REVIEW` | `Corporate Action Details Need Review` |
| parsed + identity matched + strong/plausible price | `Ready to Approve` |
| parsed + identity matched + unusual price | `Price Movement Review` |
| parsed + identity matched + missing price | `Price Data Unavailable` |
| `APPROVED` | `Approved` |
| unsupported | `Unsupported Action Type` |

Do not collapse identity and price evidence into one unexplained word such as `UNRESOLVED`.

---

## 13. Approval State Machine

### 13.1 Normal approval

```text
PARSED
+ IDENTITY MATCHED
+ STRONG MATCH or PLAUSIBLE MATCH
--------------------------------
READY TO APPROVE
```

Provide the normal **Approve** action.

### 13.2 Unusual price movement

```text
PARSED
+ IDENTITY MATCHED
+ PRICE MOVEMENT REVIEW
-----------------------
REVIEW & APPROVE
```

The operator must see the evidence before approval.

A written review reason should be required if the implementation reuses the existing decision-reason framework cleanly. Do not add duplicate reason-storage architecture.

### 13.3 Missing local price data

```text
PARSED
+ IDENTITY MATCHED
+ PRICE DATA UNAVAILABLE
------------------------
REVIEW & APPROVE
```

Do not silently reject a valid official action merely because local historical data is incomplete.

### 13.4 Identity unresolved

```text
IDENTITY NOT MATCHED
--------------------
INSTRUMENT MATCH REQUIRED
```

Approval remains blocked.

### 13.5 ISIN mismatch

Preserve the current stricter exception path. CA-1 must not weaken it.

---

## 14. Target Official Imports UI

A clean Split/Bonus review row or expandable detail should expose:

```text
TCS — SPLIT

Official action
1 old share -> 2 new shares

Ex-date                       2026-08-14
Previous trading close        ₹100.00

Share multiplier              ×2.000000
Historical price multiplier   ×0.500000
Theoretical adjusted close    ₹50.00

Ex-date open                  ₹52.50
Ex-date close                 ₹51.80
Opening residual              +5.00%
Closing residual              +3.60%

Identity                      MATCHED
Price validation              STRONG MATCH
Approval                      READY TO APPROVE

[ Approve ] [ Details ]
```

### 14.1 UX rules

- Do not make the user calculate reciprocals.
- Do not hide actual prices behind only "expected factor / observed factor".
- Do not hide the opening discrepancy because the close matches better.
- Do not force navigation to the Scan tab for routine official Split/Bonus validation.
- Do not auto-approve.
- Do not remove genuine gap-up/gap-down.
- Do not rewrite raw price history.
- Keep detailed technical scan data available under Details/diagnostic view.

---

## 15. Backend Implementation Requirements

Primary file expected:

`src-tauri-shell/src/database/corporate_action_imports.rs`

### 15.1 Introduce a focused validation model

Prefer a maintainable internal model representing:

- import id;
- identity status;
- previous trading date;
- ex trading date;
- previous close;
- ex open;
- ex close;
- share multiplier;
- price multiplier;
- theoretical adjusted previous close;
- opening residual percent;
- closing residual percent;
- validation classification;
- validation timestamp/message.

Reuse existing scan/load-window logic where safe.

Do not create a second independent algorithm for loading surrounding market bars.

### 15.2 Remove "best observation hides anomaly" behaviour from the normal review classification

Existing diagnostic confidence can remain for compatibility if required, but CA-1's normal approval evidence must explicitly calculate Open and Close residuals independently.

### 15.3 Integrate validation into the Official Imports read/review path

Preferred outcome:

- Split/Bonus review rows can load their latest or freshly computed validation evidence directly;
- the UI does not have to launch a separate Scan operation to understand a normal row.

Choose the smallest maintainable implementation after inspecting query cost.

### 15.4 Avoid unnecessary persistence

If validation can be computed cheaply and deterministically during a bounded review request, do not add schema merely for convenience.

If the existing `corporate_action_scan_results` table is reused as persisted evidence, then add an efficient lookup index only if query-plan inspection or implementation design justifies it.

Potential index:

```sql
CREATE INDEX IF NOT EXISTS idx_corporate_action_scan_results_import
ON corporate_action_scan_results(
    corporate_action_import_id,
    id DESC
);
```

This index is a recommendation, not a mandatory change if the final implementation does not need latest-scan lookup.

### 15.5 Approval gating

Do not make `MATCHED` a simplistic hard prerequisite.

Approval policy must distinguish:

- identity blockers;
- normal price evidence;
- unusual price evidence;
- missing local price evidence.

Official evidence remains authoritative for the action factor.

---

## 16. Frontend Implementation Requirements

Primary file expected:

`src/components/DatabaseToolsDialogs.tsx`

### 16.1 Official Imports review table

Replace or augment current columns so the operator can understand:

- Symbol/identity.
- Ex-date.
- Type.
- Human-readable action terms.
- Share multiplier.
- Price multiplier.
- Theoretical adjusted previous close.
- Ex-date open.
- Opening residual.
- Price-validation state.
- Approval state/action.

Avoid making the table excessively wide. A compact summary row plus expandable Details panel is acceptable and may be preferable.

### 16.2 Do not expose raw backend statuses as the only explanation

`UNRESOLVED` may remain internally but must be accompanied or replaced in the primary UX by `Instrument Match Required`.

### 16.3 Preserve separate diagnostics

The existing Scan tab and issue tools may remain available for:

- Blind Scan.
- historical diagnostics.
- batch investigations.
- missing official actions.

Routine official Split/Bonus approval should not depend on them.

---

## 17. Shared Local-Date Correction

Current:

```ts
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
```

must be replaced by a local-calendar formatter.

A suitable behaviour contract is:

```text
Given local system date 2026-08-14 in IST,
return "2026-08-14"
regardless of UTC still being 2026-08-13.
```

`addDaysIso()` must perform calendar arithmetic without reintroducing UTC date shifting.

### 17.1 Regression impact

Because the helper is shared, test all known consumers in `DatabaseToolsDialogs.tsx`, including Quote Editor date defaults, not only Corporate Actions.

---

## 18. Files to Inspect First During Implementation

Before editing, inspect the latest confirmed project files in this order:

1. `src-tauri-shell/src/database/corporate_action_imports.rs`
2. `src-tauri-shell/src/database/eod_data.rs`
3. `src-tauri-shell/src/database.rs`
4. `src-tauri-shell/src/database/bootstrap.rs`
5. `src/components/DatabaseToolsDialogs.tsx`
6. `src/types/desktop.ts`
7. `src/platform/types.ts`
8. `src/platform/tauriDesktop.ts`
9. relevant Corporate Action Rust tests
10. relevant DatabaseToolsDialogs/Vitest tests
11. current `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
12. current `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
13. latest relevant files under `docs\changes\`

Do not assume this Aug-14 snapshot remains latest when implementation begins. Reconfirm the active source before editing.

---

## 19. Expected Files Changed

The final implementation should use the smallest necessary file set.

Likely candidates:

- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/bootstrap.rs` only if an index/schema addition is actually required
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts` only if the bridge contract changes
- `src/components/DatabaseToolsDialogs.tsx`
- focused Rust test files/modules
- focused Vitest test files
- `docs/changes/YYYY-MM-DD_HHMM_IST_CORPORATE_ACTION_CA1_SPLIT_BONUS_....md`

`src-tauri-shell/src/database/eod_data.rs` should **not** be modified unless implementation evidence reveals a real adjustment defect. Its existing read-time pre-ex-date adjustment principle is deliberately preserved.

---

## 20. Required Automated Tests

At minimum, cover these cases.

### 20.1 Split exact theoretical match

```text
Previous close = ₹100
1 old -> 2 new
Theoretical = ₹50
Ex open = ₹50
Expected: STRONG MATCH
```

### 20.2 Split genuine +5% gap

```text
Previous close = ₹100
Theoretical = ₹50
Ex open = ₹52.50
Opening residual = +5%
Expected: STRONG MATCH
```

The actual ex-date open must remain `₹52.50`.

### 20.3 Split genuine -5% gap

```text
Previous close = ₹100
Theoretical = ₹50
Ex open = ₹47.50
Opening residual = -5%
Expected: STRONG MATCH
```

### 20.4 Plausible larger gap

Use a residual greater than 5% and not greater than 15%.

Expected: `PLAUSIBLE MATCH`.

### 20.5 Price-movement review

Use a residual greater than 15%.

Expected: `PRICE MOVEMENT REVIEW`.

The official factor must remain unchanged.

### 20.6 Open anomaly, close normal

```text
Theoretical = ₹50
Ex open = ₹70
Ex close = ₹51
```

Expected:

- opening residual clearly abnormal;
- closing residual separately visible;
- normal review path must **not** hide the opening anomaly by selecting the close as the better match.

### 20.7 Bonus 1:1

Expected:

- share multiplier `2.0`;
- price multiplier `0.5`.

### 20.8 Bonus 1-for-2

Expected:

- `2 existing -> 3 total`;
- share multiplier `1.5`;
- price multiplier approximately `0.6666666667`.

### 20.9 Weekend/holiday official ex-date

Use the first valid local trading bar on or after the official date according to existing loader behaviour.

Do not invent a weekend price.

### 20.10 Missing previous or ex-date-side data

Expected: `PRICE DATA UNAVAILABLE`.

### 20.11 Unresolved instrument

Expected:

- `Instrument Match Required`;
- approval blocked.

### 20.12 ISIN mismatch

Existing protected exception path must remain.

### 20.13 Duplicate approval/idempotency

Repeated approval must not create a duplicate Corporate Action.

### 20.14 Local date around IST midnight

Mock/test a timestamp where:

- local date is Aug-14;
- UTC date is Aug-13.

Expected UI date default: `2026-08-14`.

### 20.15 Raw data preservation

Automated or integration evidence should confirm CA approval does not rewrite raw `.eod` market bars.

---

## 21. Required Validation Commands

No validation may be claimed unless actual output confirms it.

Run relevant focused tests first, then broader validation.

Recommended minimum:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

npx vitest run <focused Corporate Action / DatabaseToolsDialogs tests>

npx tsc -p tsconfig.json --noEmit

npm run build

cargo test --manifest-path ".\src-tauri-shell\Cargo.toml" <focused corporate-action filter if available>

cargo test --manifest-path ".\src-tauri-shell\Cargo.toml"

cargo check --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run tauri:portable:win
```

Use the project's actual package scripts if names differ in the latest source.

Do not state "PASS" unless the command actually ran and passed.

---

## 22. Manual Acceptance Checklist

After portable Windows build succeeds, manually test real Split/Bonus cases.

- [ ] Official Split row imports.
- [ ] Official Bonus row imports.
- [ ] Instrument identity is clearly shown.
- [ ] `UNRESOLVED` no longer acts as an unexplained primary status.
- [ ] Share multiplier is understandable.
- [ ] Price multiplier is understandable.
- [ ] Theoretical adjusted previous close is displayed.
- [ ] Actual ex-date Open is displayed.
- [ ] Actual ex-date Close is available.
- [ ] Opening residual % is displayed.
- [ ] Closing residual % is displayed.
- [ ] +5% genuine gap remains +5% after adjustment.
- [ ] -5% genuine gap remains -5% after adjustment.
- [ ] Large genuine gap enters review instead of changing the official factor.
- [ ] Unresolved identity blocks approval.
- [ ] ISIN mismatch protection remains.
- [ ] Normal strong/plausible case can be approved without using the Scan tab.
- [ ] Approved action adjusts historical chart correctly.
- [ ] Ex-date/post-action raw price is not artificially normalized.
- [ ] Duplicate approval does not create duplicate actions.
- [ ] Corporate Action date defaults use the local calendar date in IST.
- [ ] Quote Editor date defaults are not regressed by the shared date-helper correction.
- [ ] Raw `.eod` data remains unchanged.

---

## 23. Raw `.eod` Preservation Verification

Where practical, select a representative `.eod` file and record SHA-256 before and after Corporate Action approval.

Expected:

```text
raw .eod hash before approval
==
raw .eod hash after approval
```

This provides direct evidence that Corporate Action approval changes adjustment metadata/read behaviour rather than physically rewriting raw historical market data.

If the actual architecture intentionally touches a different file in the latest source, document exactly why before proceeding.

---

## 24. Risks and Possible Regressions

### 24.1 Performance

Integrating validation into Official Imports can cause repeated local history reads for large review batches.

Mitigation:

- bounded/batched validation;
- reuse existing scan data when valid;
- efficient latest-result lookup if persistence is used;
- avoid per-render unbounded backend calls.

### 24.2 Status compatibility

Changing backend enum values can break filtering and historical rows.

Mitigation:

- preserve existing backend statuses where possible;
- introduce user-facing derived presentation states.

### 24.3 Approval regression

Adding a naive "price must match" gate could reject legitimate official actions with real market news gaps.

Mitigation:

- price evidence controls review level, not official factor validity by itself.

### 24.4 Date-helper regression

The local-date helper is shared.

Mitigation:

- test Corporate Action and Quote Editor consumers.

### 24.5 Duplicate validation logic

A second implementation could drift from Scan logic.

Mitigation:

- factor common price-window and validation calculations into one shared backend path.

### 24.6 UI density

Showing all evidence directly in a single table can become unreadable.

Mitigation:

- compact row summary plus expandable Details panel.

---

## 25. Rollback Guidance

CA-1 should be implemented so rollback is straightforward.

If regressions occur:

1. revert only the CA-1 source files listed in the implementation change report;
2. remove a new non-destructive index only if it was introduced and rollback requires exact schema parity;
3. do not modify or restore raw `.eod` files because CA-1 must not rewrite them;
4. preserve official import records and approved Corporate Actions unless a specific data-mutation defect is proven;
5. rerun focused Corporate Action tests and TypeScript/Rust validation after rollback.

A timestamped `docs\changes\` report must record the exact rollback boundary.

---

## 26. Follow-Up Corporate Action Phases

After CA-1 is validated and manually accepted, audit and implement separately:

### CA-2 — Rights

- TERP mathematics;
- out-of-the-money rights handling;
- official terms parsing;
- validation evidence and UI.

### CA-3 — Dividend

- adjustment policy;
- enable/disable semantics;
- chart/scanner/export consistency.

### CA-4 — Demerger

- complete end-to-end support;
- cost-allocation parsing;
- approval path;
- manual UI;
- backend/frontend contract alignment.

### CA-5 — Historical Repair Workflow

- preview;
- per-row evidence;
- explicit apply;
- audit trail;
- rollback;
- repair of validated bad approved records.

### CA-6 — Corporate Action UX Finalization

- remaining window/UI bugs;
- batch controls;
- issues workflow;
- diagnostics;
- terminology cleanup;
- documentation reconciliation.

Do not pull these phases into CA-1 without a new explicit decision.

---

## 27. Required Change Report After Implementation

After any meaningful CA-1 source/configuration change, create:

```text
docs\changes\YYYY-MM-DD_HHMM_IST_CORPORATE_ACTION_CA1_SPLIT_BONUS_VALIDATION_APPROVAL_UX_V1.md
```

The report must include:

- IST timestamp;
- objective;
- previous defect/limitation;
- files inspected;
- files created;
- files modified;
- exact implementation;
- behaviour changed;
- behaviour deliberately preserved;
- validation commands;
- actual validation output/results;
- manual acceptance status;
- risks/limitations;
- rollback guidance;
- exact source snapshot or Git baseline used.

---

## 28. Self-Contained Implementation Instruction for a Coding Agent

### Goal

Implement Corporate Action CA-1 for the EOD Charting Platform: integrate clear Split/Bonus price validation with the Official Imports review/approval workflow while preserving raw EOD history and genuine post-action market gaps.

### Project Path

`E:\TA Projects\EOD Charting Platform`

### Required First Step

Do not assume the Aug-14 audit ZIP is still latest.

Inspect the current live project and confirm the newest source state before editing.

### Files to Read First

```text
src-tauri-shell\src\database\corporate_action_imports.rs
src-tauri-shell\src\database\eod_data.rs
src-tauri-shell\src\database.rs
src-tauri-shell\src\database\bootstrap.rs
src\components\DatabaseToolsDialogs.tsx
src\types\desktop.ts
src\platform\types.ts
src\platform\tauriDesktop.ts
PROJECT_STATE_EOD_CHARTING_PLATFORM.md
FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md
docs\changes\
```

### Constraints

1. Preserve existing working Corporate Action import behaviour.
2. Preserve identity/ISIN protections.
3. Preserve duplicate/idempotent approval behaviour.
4. Preserve read-time historical adjustment.
5. Do not rewrite raw `.eod` prices.
6. Preserve genuine ex-date gap-up/gap-down.
7. Do not auto-approve.
8. Do not mix Rights, Dividend, Demerger, or repair-apply work into CA-1.
9. Reuse existing market-window/scan logic; do not create divergent duplicate validation algorithms.
10. Prefer the smallest maintainable change.
11. Do not claim tests/build/package passed without command output.
12. Create the mandatory timestamped `docs\changes\` report.

### Required Behaviour

For parsed Split/Bonus rows with matched identity:

- derive share multiplier;
- derive reciprocal historical price multiplier;
- load previous trading close;
- load first valid bar on/after ex-date;
- calculate theoretical adjusted previous close;
- calculate opening residual %;
- calculate closing residual %;
- classify opening residual:
  - `<=5%` absolute: Strong Match;
  - `>5% <=15%`: Plausible Match;
  - `>15%`: Price Movement Review;
  - missing required bars: Price Data Unavailable;
- display evidence in Official Imports;
- normal strong/plausible cases can be approved without separately running Scan;
- unusual/missing-price cases remain manually reviewable;
- unresolved identity remains blocked.

### Required UI Meaning

Do not rely on bare `UNRESOLVED`.

Show separate concepts:

- Identity;
- Price Validation;
- Approval.

Replace ambiguous `Adj Factor` presentation with:

- Share Multiplier;
- Price Multiplier.

Show theoretical and actual prices plus residual market move.

### Local Date Fix

Replace UTC-derived `todayIso()` and ensure `addDaysIso()` remains local-calendar-safe.

Regression-test all shared consumers.

### Validation

Run focused tests, renderer TypeScript typecheck, production build, Rust tests/check, portable Windows build, and manual Corporate Action acceptance.

---

## 29. Completion Gate

CA-1 is complete only when all of the following are true:

1. implementation is applied to the latest confirmed source;
2. Split and Bonus validation evidence is integrated into Official Imports;
3. genuine gap-up/gap-down is preserved;
4. identity and price-validation states are clearly separated;
5. normal official Split/Bonus approval no longer requires separate Scan navigation;
6. local-date bug is corrected;
7. focused automated tests pass;
8. TypeScript typecheck passes;
9. frontend build passes;
10. Rust tests/check pass;
11. portable Windows build passes;
12. manual Split/Bonus validation passes;
13. raw `.eod` preservation is verified;
14. timestamped implementation change report is created;
15. exact validation results are recorded.

Until those gates are met, the implementation must remain reported as partial/not yet accepted.

---

## 30. Current Status at Document Creation

**Files inspected:** Aug-14 Corporate Action backend, adjusted EOD read path, database contracts/indexes, Tauri/frontend bridge paths, Corporate Action UI, root state documentation, and existing `docs\changes\` style.

**Files created by this documentation step:** this implementation plan only.

**Runtime/source files modified:** none.

**Behaviour changed:** none.

**Validation performed for implementation:** none, because CA-1 has not yet been implemented.

**Implementation status:** NOT STARTED.

**Recommended next step:** use this document as the frozen CA-1 implementation contract, then implement against the latest confirmed project source with the smallest maintainable change.
