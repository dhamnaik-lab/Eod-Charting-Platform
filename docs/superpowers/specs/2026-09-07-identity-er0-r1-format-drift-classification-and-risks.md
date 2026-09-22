# Identity ER0-R1 — Format Drift Classification + Risk Freeze

**Status:** ER0-R1 DOCUMENTATION FREEZE CANDIDATE  
**Date:** 2026-09-07 IST

## Drift classes

### COMPATIBLE

A provider presentation change that the current parser already consumes without changing business meaning.

Examples:

- harmless column order changes;
- extra unused columns;
- header case/space/underscore/punctuation changes that normalize to the same accepted key;
- ordinary CSV quoting and surrounding whitespace;
- NSE history date spelling within the already accepted parser formats.

### ADAPTER_REQUIRED

The source still represents the same authority, but the current parser cannot consume the new representation safely.

Examples:

- CSV → XLSX;
- CSV → JSON;
- delimiter change;
- header rename outside accepted aliases;
- XLSX workbook moves to a different worksheet relationship/path;
- BSE returns structured JSON instead of CSV;
- charset changes outside the app's safe text path.

No automatic promotion is permitted.

### SEMANTIC_CONTRACT_CHANGE

The source meaning changed or cannot be proven equivalent.

Examples:

- old/new symbol direction changes;
- lifecycle status meaning changes;
- symbol becomes a display label rather than canonical trading ID;
- row grain changes;
- ISIN no longer identifies the same unit of Identity evidence;
- delisted source becomes proposed-to-be-delisted;
- source population/segment changes materially.

This class must fail closed for future source-health/recovery logic.

---

# ER0-R1 risk findings

## ER0-R1-F1 — NSE delisted workbook discovery is semantically under-bound

**Severity:** HIGH  
**Current behavior change:** NONE  
**Classification:** SEMANTIC_CONTRACT_RISK

The current configured NSE landing page is:

`https://www.nseindia.com/static/list/list-of-companies-proposed-to-be-delisted`

Current downloader code searches page HTML for the **first HTTPS `.xlsx` URL** and does not bind discovery to the caption `List of Companies Delisted from NSE`.

Current NSE provider page exposes distinct workbooks for:

1. `List of Companies Proposed to be Delisted`
2. `List of Companies Delisted from NSE`

Therefore ER0 cannot certify that caption-blind first-XLSX discovery always yields the intended `DELISTED` authority.

**Future correction direction:** Source Contract must bind discovery to the intended official link semantics/identifier, validate allowed host, and validate workbook semantics before promotion.

**ER0 action:** document only.

---

## ER0-R1-F2 — Official NSE company-name history exists but is manual-only in current app

**Severity:** MEDIUM  
**Classification:** COVERAGE_GAP

Current parser consumes `NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT`.

The official NSE Securities Available page exposes `Changes in Company Names (.csv)` at `namechange.csv`, but `OfficialSourceUrls` has no name-change URL and current `Refresh & Preview` does not download it.

This is consistent with the accepted I4 Manual historical fallback boundary, but it must not be mistaken for automated official-history coverage.

**ER0 action:** document only.

---

## ER0-R1-F3 — BSE manual parser is broader than intended UI contract

**Severity:** MEDIUM  
**Classification:** PARSER_TOLERANCE_EXCEEDS_INTENDED_CONTRACT

UI guidance says manual BSE CSV contains:

- Security Id/Scrip Id;
- Security Code;
- Security Name;
- Group;
- ISIN;
- optional Status.

Actual parser hard-requires only symbol/ID.

A future source contract should validate the intended metadata rather than inherit accidental parser permissiveness.

**ER0 action:** document only.

---

## ER0-R1-F4 — Weak current population sanity for manual sources

**Severity:** MEDIUM  
**Classification:** VALIDATION_GAP

Official NSE download rejects zero retained Equity rows and BSE official download rejects zero Active rows.

Manual/current local parsing does not impose an exchange-scale minimum before plan construction.

A syntactically valid but severely truncated source can therefore reach Preview planning.

NSE reviewed Preview/Apply authority reduces write risk, but format health should detect the truncation earlier. BSE production Apply acceptance remains deferred.

**Future correction direction:** ER1 source-health metrics and minimum/delta population validation.

**ER0 action:** document only.

---

## ER0-R1-F5 — URL overrides have no runtime official-host allowlist

**Severity:** MEDIUM  
**Classification:** PROVENANCE_GAP

`officialSourceUrls.v1` accepts non-empty override strings. Current downloader code does not enforce the future-design allowed-host boundary.

The built-in Recovery Brief already instructs researchers to return official candidates only, but the runtime source configuration itself does not yet enforce that policy.

**Future correction direction:** ER1/ER3 contract validation before candidate use/promotion.

**ER0 action:** document only.

---

# Required future classification rule

For every future source mismatch:

```text
same semantics + parser already accepts
→ COMPATIBLE

same semantics + representation changed
→ ADAPTER_REQUIRED

semantics/provenance/population meaning changed or uncertain
→ SEMANTIC_CONTRACT_CHANGE
```

`SEMANTIC_CONTRACT_CHANGE` must never be auto-adapted.
