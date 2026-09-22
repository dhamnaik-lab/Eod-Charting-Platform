# Identity ER1-A — Accelerated Design Handoff R1

**Status:** ER1-A DESIGN FREEZE  
**Implementation:** NOT STARTED  
**Project:** `E:\TA Projects\EOD Charting Platform`

## Frozen architecture

ER1 is a thin read-only layer over existing Identity authority:

```text
OfficialSourceUrls
→ in-memory health fetch
→ existing provenance validators
→ existing parsers/contracts
→ existing population/freshness semantics
→ one OfficialSourceHealthResult contract
→ read-only UI evidence
→ optional Source Recovery Brief appendix
```

No current downloader or Apply path is replaced.

## Eleven logical source results

```text
NSE_SECURITIES_AVAILABLE_LANDING
NSE_EQUITY_MASTER
NSE_SME_MASTER
NSE_SYMBOL_CHANGE
NSE_COMPANY_NAME_CHANGE
NSE_DELISTED_LANDING
NSE_DELISTED_WORKBOOK
BSE_LIST_SCRIPS_REFERER
BSE_LIST_SCRIPS_ACTIVE
BSE_LIST_SCRIPS_DELISTED
BSE_LIST_SCRIPS_SUSPENDED
```

## Drift authority

```text
COMPATIBLE
ADAPTER_REQUIRED
SEMANTIC_CONTRACT_CHANGE
```

Do not force a drift class when the evidence does not prove one.

## Immutable boundaries

```text
No managed-source write
No SQLite mutation
No Apply
No URL rewrite
No automatic adapter
No AI authority
```

Read-only access to the active database is permitted solely to resolve the configured `officialSourceUrls.v1`.

## Accelerated execution

```text
ER1-B  ONE TDD RED
ER1-C  BACKEND ASSESSOR + NSE + BSE
ER1-D  UI + RECOVERY BRIEF EVIDENCE
ER1-E  FULL OFFLINE VALIDATION
ER1-F  CONTROLLED LIVE-NETWORK READ-ONLY VERIFICATION
ER1-G  CLOSEOUT
```

ER1-A combines the former P1/P2/P3 design gates. It removes redundant review rounds, not substantive validation.
