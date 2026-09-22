# Identity ER0-R1 — Current Authority Handoff

**Status:** ER0-R1 DOCUMENTATION FREEZE CANDIDATE  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope completed

ER0-R1 inventories the current NSE/BSE Identity official-source definitions and the actual parser acceptance boundary.

It does not implement ER1 source-health logic.

## Source authority summary

NSE current Identity:

```text
NSE Securities Available landing page
├─ EQUITY_L.csv
├─ SME_EQUITY_L.csv
└─ symbolchange.csv

NSE delisting landing page
└─ discovered/fallback XLSX
```

NSE historical name change:

```text
namechange.csv exists as official NSE provider evidence
BUT
current app has no automatic URL slot/downloader
→ I4 Manual archive consumer only
```

BSE current lifecycle:

```text
BSE List Of Securities
├─ Active CSV
├─ Delisted CSV
└─ Suspended CSV
        ↓
combined local lifecycle master
```

## Format policy frozen

```text
provider-native format
→ current parser acceptance
→ intended contract
```

Do not equate accidental parser permissiveness with desired contract.

## Drift policy

```text
COMPATIBLE
ADAPTER_REQUIRED
SEMANTIC_CONTRACT_CHANGE
```

Semantic-contract changes fail closed in future recovery work.

## High-priority ER0 finding

`ER0-R1-F1`:

Current NSE delisted discovery chooses the first HTTPS `.xlsx` occurrence from the configured delisting page without binding to the `List of Companies Delisted from NSE` caption.

The official page exposes a different `List of Companies Proposed to be Delisted` workbook as well.

This is a documented semantic-selection risk. ER0 does not authorize a fix.

## Other frozen gaps

- official NSE name-change CSV is manual-only in current app;
- current source URL overrides have no host allowlist;
- manual source population sanity is weak;
- BSE parser accepts less metadata than UI guidance implies;
- BSE historical parity and production Apply acceptance remain deferred.

## Next phase boundary

Do not start ER1 automatically.

If separately approved, ER1 should implement deterministic source-health validation from this registry:

```text
transport
+ official host
+ container
+ schema
+ row population
+ semantic checks
+ freshness
```

ER1 must not perform web discovery or automatic URL promotion.
