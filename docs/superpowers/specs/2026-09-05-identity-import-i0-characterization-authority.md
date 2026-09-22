# Identity Import I0 — Characterization Authority Freeze

Status: CURRENT CHARACTERIZATION AUTHORITY / NO PRODUCTION BEHAVIOR CHANGE  
Date: 2026-09-05  
Project root: `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the accepted current Identity Import behavior before any UI/UX simplification.

This phase adds characterization tests and documentation only. It does not redesign Identity Import and does not change database, backend, networking, Manual Entry, Official Imports, or chart behavior.

## Active Identity capability groups

### Current NSE universe

- Download NSE Master
- Download NSE De-listed
- Preview NSE
- Apply NSE

Downloads save/update official reference data and invalidate stale preview state.

Preview is non-applying.

Apply is explicit and refreshes application/chart context afterward.

### Current BSE universe

- manual BSE current-master CSV path
- Download BSE Master
- Preview BSE
- Apply BSE

Changing the manual BSE path invalidates the BSE preview.

Preview is non-applying.

Apply is explicit and refreshes application/chart context afterward.

### Manual NSE archive-root current-universe path

- Archive Root
- Preview Sync
- Apply Sync

Changing Archive Root invalidates the current NSE preview.

### Historical NSE identity

- Import NSE Identity

This is a separate database-writing workflow from current-universe Preview/Apply.

It imports historical NSE symbol/name identity chains and refreshes the application/chart context.

### Source configuration

- Official source URLs
- NSE/BSE source groups
- Reset Defaults
- Apply URLs
- persisted key `officialSourceUrls.v1`

These remain specialist/advanced controls.

## Characterization boundaries

The I0 test freezes:

1. presence of the current Identity Import capability surface;
2. separation of downloads from Apply;
3. preview handlers as non-applying;
4. explicit Apply handlers and post-apply refresh behavior;
5. preview invalidation when manual source paths change;
6. historical identity import as a separate explicit write;
7. persisted official-source URL configuration.

## Known defects deliberately NOT frozen as desired behavior

### Current button exchange bug

The existing Identity preview `Current` shortcut uses an NSE override even when the current chart is BSE.

This remains a known defect for I1.

The I0 characterization test intentionally does not assert that hard-coded NSE behavior as the desired contract.

### Preview-to-Apply authority gap

Current Apply operations rebuild/execute from the current source state. They are not cryptographically or transactionally bound to the exact preview the operator reviewed.

This remains a separate later safety task.

I0 does not redefine Apply semantics.

### NSE/BSE combined preview gap

The current UI carries only one active current-universe preview family at a time. NSE and BSE preview state replaces the other.

A future combined NSE+BSE workflow requires a combined review model; it must not be simulated only by merging buttons.

### Historical BSE parity

There is no accepted BSE historical symbol/name identity importer equivalent to the NSE historical archive workflow in the current audited authority.

This is not part of I0.

## Preservation boundaries

I0 must not modify:

- `src/components/DatabaseToolsDialogs.tsx`
- Manual Entry behavior
- Official Imports R1C-I1 behavior
- chart market-price formatting
- Rust/backend source
- package dependencies
- database state

## Next bounded task

Identity I1 — fix the Identity Import `Current` shortcut so it respects the active/preview exchange without changing the rest of Identity behavior.
