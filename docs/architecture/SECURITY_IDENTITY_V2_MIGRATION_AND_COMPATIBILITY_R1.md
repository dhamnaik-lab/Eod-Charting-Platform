# Security Identity V2 Migration and Compatibility R1

**Status:** APPROVED FUTURE MIGRATION SPEC / NO MIGRATION AUTHORIZED  
**Scope:** current EOD1/Generation-6 authority to shadow Security/Listing/Price-Stream + EOD2  
**Exchanges:** NSE, BSE, NSE_INDEX, BSE_INDEX


## V2-P0 authority binding

- Freeze date: **2026-09-07 IST**.
- Source snapshot: `Eod Charting Platform Source Code 2026-09-06_161742_IST.zip`.
- Source snapshot SHA-256: `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`.
- R2 test-clone post-runtime evidence ZIP SHA-256: `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`.
- R3 NSE source-series forensic evidence ZIP SHA-256: `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
- Production implementation status: **NOT STARTED**.
- Current production authority remains **EOD1 + Generation 6 + current SQLite schema/identity model** until a later explicitly approved V2 promotion phase.


## 1. Safety model

Migration is parallel, not in-place.

```text
CURRENT AUTHORITY (read-only during migration)
  current SQLite
  EOD1 eod_data/
  Generation 6 sidecar
             |
             | classify / resolve / verify
             v
V2 SHADOW
  V2 catalog/tables
  EOD2 eod_data_v2/
  V2 sidecar
             |
             | acceptance + explicit promotion only
             v
FUTURE AUTHORITY
```

No V2 phase may destroy the rollback ability to reopen the current V1 database until a separately approved promotion/retirement plan exists.

## 2. Legacy migration classes

Every existing EOD1 symbol file must be classified before promotion:

- `UNAMBIGUOUS` — one established Security/Listing/Price Stream; eligible for cheap payload-preserving conversion.
- `MULTI_STREAM_SAME_SECURITY` — one Security, multiple independently coexisting channels; requires source-evidence split/rebuild.
- `MULTI_SECURITY_COLLISION` — one legacy symbol file contains multiple distinct Securities; requires authoritative identity/source rebuild.
- `UNKNOWN_IDENTITY` — insufficient evidence; quarantine/review, no guessed V2 publication.
- `INDEX` — known NSE/BSE Index; migrate as `series=NULL`, N/A.
- `REBUILD_REQUIRED` — physical historical rows cannot be deterministically allocated from EOD1 alone.

## 3. Cheap migration path

For `UNAMBIGUOUS` files:

1. verify EOD1 physical/state integrity;
2. resolve exact `security_id`, `listing_id`, `price_stream_id`;
3. copy the 64-byte record payload into EOD2 without changing OHLCV values;
4. write the EOD2 identity header;
5. durable-sync/publish under V2 shadow rules;
6. prove record-for-record payload parity;
7. publish V2 VERIFIED state.

No EOD1 file is renamed or mutated.

## 4. Ambiguous/rebuild path

EOD1 records do not carry per-record Series/Group/ISIN. Therefore files proven contaminated cannot be split by heuristic price inspection.

Known examples:

- APOLLOTYRE legacy history contains R3-proven normal and block-deal rows in the same symbol file;
- KRT/NXST contain `RR` and `BL` rows under one symbol identity;
- IMC1 contains multiple debt securities (`N1/N2/N3`) with distinct ISINs.

These require authoritative dated source/evidence. The migration rule is:

```text
DO NOT GUESS
DO NOT PICK HIGHEST VOLUME
DO NOT PICK FIRST/LAST
DO NOT SPLIT BY PRICE SHAPE
DO NOT PROMOTE AMBIGUOUS OUTPUT AS VERIFIED
```

## 5. NSE migration authority

NSE migration uses official/current identity evidence plus dated market/source evidence and accepted historical identity bridges. Raw Series is preserved as effective-dated classification. Same security/classification transitions may retain one NORMAL stream; same-date independent channels become separate streams; distinct ISIN securities remain distinct unless official dated continuity evidence proves otherwise.

## 6. BSE migration authority

BSE migration is equal first-class scope.

- preserve BSE security code as first-class listing evidence;
- preserve ISIN and official lifecycle state;
- preserve BSE Group/classification separately from NSE Series semantics;
- do not require existing BSE price history to be complete before identity migration;
- migrate exactly the authoritative price history that actually exists;
- later BSE catch-up may append to the resolved V2 streams.

Price-history completeness and identity completeness are separate states.

## 7. Cross-exchange mapping

NSE and BSE listings are resolved independently first. Cross-exchange Security equivalence is a separate evidence-based step.

- same symbol alone never merges;
- compatible matching ISIN may be strong evidence but conflicts remain reviewable;
- one `security_id` may own one NSE Listing and one BSE Listing;
- price histories remain separate Price Streams per listing/exchange;
- Corporate Actions may attach once at Security level when equivalence is proven.

## 8. Index migration

For `NSE_INDEX` and `BSE_INDEX`:

- create Security Type `INDEX`;
- create Listing and one Price Stream;
- Series remains NULL/N/A;
- Series/Group settings do not control index visibility;
- legacy `NO_SERIES` UI behavior is not carried into V2 semantics.

## 9. Legacy reference compatibility

### 9.1 Watchlists

Current `watchlist_id + exchange + symbol` entries migrate automatically only when the legacy reference has one deterministic preferred stream.

- APOLLOTYRE may map to its NORMAL stream;
- KRT/NXST may map to their NORMAL stream;
- an ambiguous `IMC1` symbol reference across distinct Securities must be marked `REQUIRES_STREAM_SELECTION` rather than guessed.

### 9.2 Saved charts/workspaces

Legacy `exchange + symbol` references follow the same resolver. Unambiguous references map to the preferred V2 stream. Ambiguous multi-security references remain unresolved until explicitly selected.

### 9.3 Quote Editor

V2 Quote Editor mutation targets exact `price_stream_id`. Legacy symbol-level requests must resolve deterministically before mutation.

### 9.4 Scanners/alerts

Any persisted stream reference must be migrated or explicitly invalidated/reviewed; symbol text alone cannot silently point at a different Security after V2.

## 10. Permanent legacy mapping evidence

V2 should retain an auditable migration map conceptually containing:

- legacy exchange;
- legacy symbol;
- migration class/status;
- resolved Security/Listing/Price Stream IDs where applicable;
- reason/evidence source;
- ambiguity/conflict code;
- migration timestamp/version.

This map is evidence, not a second runtime identity system.

## 11. Generation/state compatibility

- current Generation 6 remains untouched throughout shadow migration;
- V2 sidecar uses its own schema/version/generation authority;
- V2 parity may compare against V1 but cannot mutate V1 as a side effect;
- V1 remains immediate rollback authority until promotion.

## 12. Promotion gates

Promotion is forbidden until all required scopes pass:

### Identity

- every legacy file classified;
- no unexplained NSE multi-security collision in promoted scope;
- no unexplained BSE multi-security collision in promoted scope;
- no symbol-only cross-exchange merge;
- Index N/A-series invariant passes.

### Storage

- V2 physical files exactly match V2 VERIFIED state rows;
- 0 DIRTY / 0 UNKNOWN in promoted scope;
- 0 orphan/missing state;
- structural/date/identity checks pass;
- no pending V2 recovery session.

### Compatibility

- Sidebar/Search regression pass for NSE and BSE;
- NSE_INDEX/BSE_INDEX regression pass;
- chart loading pass;
- Quote Editor exact-stream pass;
- watchlist/workspace migration pass;
- scanners/alerts impacted paths pass;
- Corporate Action identity regression pass.

### Rollback

- current EOD1 and Generation 6 remain byte/state untouched during shadow acceptance;
- current application/database can be restored/opened without depending on V2 artifacts.

## 13. BSE history boundary

The actual BSE database may remain historically incomplete by design during V2 work. Migration completeness means **faithfully migrating existing authoritative data**, not inventing or requiring data that has not yet been downloaded.

Large BSE catch-up remains a separate operational phase after the relevant Bhavcopy/V2 safety gates are accepted.

## 14. Migration authorization

This document freezes migration semantics only. **No migration is authorized by V2-P0.**
