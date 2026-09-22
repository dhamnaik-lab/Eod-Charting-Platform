# Identity Current Authority After I2/I2-R2 — NSE-First / BSE-Deferred

Status: CURRENT AUTHORITY / MANUAL I2-I2R2 ACCEPTANCE CLOSED
Date: 2026-09-06
Project root: `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the accepted Corporate Action / Identity authority after the compact Identity Import redesign and its Official Preview transition correction, and record the current NSE-first / BSE-deferred data policy.

This document is an authority addendum. It does not change application behavior.

## Accepted Identity milestones

### Identity I0 — Characterization + authority freeze

Closed with focused characterization, full Corporate Action regression, and renderer typecheck.

### Identity I1 — Current-chart exchange correction

Closed. The Identity `Current Chart` shortcut follows the loaded Identity preview exchange and otherwise the active chart exchange.

### Identity I2 — Compact Identity Import UI

Manually accepted. The flat implementation toolbar was replaced with the compact Exchange/Source workflow while preserving existing backend operations and explicit Preview/Apply separation.

Accepted UI concepts include:

- Exchange selector: NSE / BSE
- Source selector: Official / Manual
- Official source refresh workflow
- manual Browse Folder / Browse File workflow
- explicit Preview / Apply separation
- Current Chart shortcut
- compact preview table as the primary workspace

### Identity I2-R2 — Official Preview transition correction

Manually accepted on 2026-09-06.

Accepted behavior:

- switching NSE -> BSE clears the old NSE status, summary badges, search state, and preview rows;
- BSE Official context immediately shows no BSE preview loaded instead of stale NSE information;
- `Refresh & Preview` is immediately available;
- one BSE `Refresh & Preview` operation downloads the current official BSE source and previews the exact returned managed file without a second Preview click;
- `Preview Saved Sources` remains a separate operation;
- `Apply Reviewed Changes` remains explicit and separate.

## Current production authority

`src\components\DatabaseToolsDialogs.tsx`

SHA-256:

`9F26E22A07BF8CE6454594F564B0E67C9E2D42F884B21498BCA9722B3791C488`

Accepted portable SHA-256:

`02FAD133546A8CB022C1BC68D46503B2FFBB31BE74DA297D67750C689741644D`

Accepted I2-R2 automated evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_IMPORT_I2_R2_2026-09-05_200750_IST_evidence.zip`

SHA-256:

`EDCC7C92452DAFF557F4FE15A45E2BAA9E1526EF8A400652C929B815FD26FF38`

Automated I2-R2 result included:

- focused I2-R2 GREEN: PASS;
- I2 compact regression: PASS;
- Identity characterization regression: PASS;
- I1 Current regression: PASS;
- full Corporate Action regression: 29 files / 152 tests PASS;
- renderer typecheck: PASS;
- renderer build: PASS;
- portable Windows build: PASS.

## NSE-first Corporate Action / Identity policy

For the current Corporate Action / Identity workstream, **NSE is the functional and data-acceptance authority**.

NSE behavior is the authority for:

- Corporate Action functional acceptance;
- Identity current-universe correctness;
- historical identity behavior currently supported by the application;
- manual/runtime acceptance of Identity changes;
- deciding whether a bounded Identity or Corporate Action task is complete.

Future work must not be blocked merely because equivalent BSE historical coverage is not yet available.

## BSE deferred-data policy

The BSE database is not yet complete and does not contain the same depth of long historical data as the NSE database.

Therefore BSE currently has a different acceptance role:

- BSE UI and workflow capability must remain structurally preserved;
- BSE source download/preview functionality may be exercised to confirm workflow integrity;
- BSE backend behavior must not be silently removed or broken;
- BSE data correctness parity with NSE is **not** a current acceptance gate;
- BSE historical identity parity is deferred;
- BSE production `Apply Reviewed Changes` acceptance is deferred;
- large BSE preview reconciliation counts are not, by themselves, evidence of a reconciliation defect while the BSE database baseline is incomplete.

The observed BSE preview counts from the I2 manual checkpoint must not be reopened as a defect solely because they are large. They were produced against an incomplete BSE database baseline.

## BSE Apply rule

Do not promote BSE Identity Apply to accepted production behavior until all of the following are separately completed and approved:

1. the BSE database is sufficiently complete for a meaningful comparison;
2. required BSE historical/current-universe source coverage is defined;
3. BSE reconciliation behavior is audited against that completed baseline;
4. a dedicated BSE manual/data acceptance checkpoint passes.

Until then, BSE Apply remains deferred by product/data authority policy, not failed because of the current preview counts.

## Preservation boundaries

The NSE-first policy does not authorize removing or weakening BSE capability.

Continue preserving:

- Manual Entry;
- Identity I0/I1/I2/I2-R2 accepted behavior;
- Official Imports R1C-I1;
- Force Re-fetch / CSV fallback / Historical Backfill behavior in Official Imports;
- Identity backend validation and transaction behavior;
- chart-price formatting authorities;
- package/build authorities.

Do not reactivate the discarded wholesale Corporate Action reconstruction or separate Maintenance product as a consequence of this authority update.

## Next-task rule

The next Corporate Action / Identity task must be separately bounded and approved.

Unless the user explicitly changes the data policy, evaluate the next task against NSE authority first and preserve BSE capability without requiring BSE data parity.
