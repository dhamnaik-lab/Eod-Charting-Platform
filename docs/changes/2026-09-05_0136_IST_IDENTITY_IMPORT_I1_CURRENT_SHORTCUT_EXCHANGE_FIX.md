# Identity Import I1 — Current Shortcut Exchange Fix

Status: AUTOMATED PASS / MANUAL IDENTITY SHORTCUT CHECK REQUIRED
Generated: 2026-09-05 01:36:51 IST

## Objective

Fix the Identity Import Current shortcut so BSE previews/charts are not rejected by a hard-coded NSE override.

## Production change

One wiring expression in src/components/DatabaseToolsDialogs.tsx.

Resolution order:
1. loaded NSE preview -> NSE
2. loaded BSE preview -> BSE
3. no Identity preview -> active chart exchange

The existing applyCurrentSymbolFilter exchange-mismatch guard remains unchanged.

## Preserved

- Manual Entry
- all Identity download/preview/apply/import operations
- Preview/Apply separation
- Identity I0 characterization authority
- Official Imports R1C-I1
- chart price formatting
- backend/database behavior

## Validation

- TDD RED: PASS
- Identity I1 focused GREEN: PASS
- Identity I0 characterization regression: PASS
- full Corporate Action frontend regression: PASS
- renderer typecheck: PASS
- renderer build: PASS
- portable Windows build: PASS

## Hashes

- DatabaseTools preimage: 8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2
- DatabaseTools postimage: A24C71AD7A7EF8BEB21DEB6E1FEF06D020A641089100C671C163027A92392305
- portable: 070357465D8AB81DCBBB7C96244966EA046341A8E5773AA9CE67C9E26C08A641

## Manual checkpoint

1. Load a BSE current-universe preview and keep a BSE chart active; Current should fill the BSE chart symbol instead of showing an NSE mismatch.
2. Load an NSE preview with an NSE chart; Current should continue to work.
3. With no Identity preview loaded, Current should follow the active chart exchange.
4. No other Identity control should change behavior.
