# Security / Listing / Price-Stream V2 Architecture R1

**Status:** APPROVED FUTURE ARCHITECTURE / DOCUMENTATION FROZEN / IMPLEMENTATION NOT STARTED  
**Scope:** NSE, BSE, NSE_INDEX, BSE_INDEX  
**Phase:** V2-P0 documentation-only architecture freeze


## V2-P0 authority binding

- Freeze date: **2026-09-07 IST**.
- Source snapshot: `Eod Charting Platform Source Code 2026-09-06_161742_IST.zip`.
- Source snapshot SHA-256: `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`.
- R2 test-clone post-runtime evidence ZIP SHA-256: `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`.
- R3 NSE source-series forensic evidence ZIP SHA-256: `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
- Production implementation status: **NOT STARTED**.
- Current production authority remains **EOD1 + Generation 6 + current SQLite schema/identity model** until a later explicitly approved V2 promotion phase.


## 1. Purpose

The current platform was intentionally designed around one canonical `.eod` file per `exchange + symbol`. That model is compact and has served the charting workload well, but the 2026-09-06 R2/R3 evidence proves that symbol-level identity is not sufficient for the full official NSE/BSE security universe.

Two different conflict classes are now proven:

1. **Same security, independently coexisting market streams.** R3 mapped APOLLOTYRE `EQ` and `BL` rows to the same ISIN, and KRT/NXST `RR` plus `BL` to the same ISIN. A block-deal row must not share the normal chart history.
2. **Same display symbol, different securities.** R3 mapped `IMC1` `N1`, `N2`, and `N3` to distinct ISINs. These cannot share one canonical price file.

V2 therefore introduces a bounded identity/storage architecture inside the existing EOD Charting Platform. It is not a redesign of the whole application.

## 2. Current V1 authority remains active

V2-P0 changes documentation only. It does not change any current runtime or storage behavior.

Current authority remains:

- EOD1 binary files under the current `eod_data` tree;
- current SQLite tables, including symbol/exchange keyed price and instrument metadata;
- Generation-6 `eod_binary_state.sqlite` semantics;
- current Bhavcopy durability/recovery ordering;
- current production concurrency policy: binary write/import **2**, read-only prefilter **4**, deferred checkpoint **2**;
- existing Quote Editor, Sidebar, charts, watchlists, scanners, alerts, workspaces, and Corporate Action behavior.

No V2 document may be interpreted as evidence that V2 has already been implemented or promoted.

## 3. Canonical terminology

### 3.1 Security

The economic/listed security identity. A Security owns an immutable internal `security_id`. Symbol, current ISIN, series, group, or exchange security code are evidence/attributes, not the sole primary identity.

### 3.2 Listing

A Security's listing on one exchange authority. A Listing owns an immutable internal `listing_id` and carries exchange-specific official metadata and lifecycle history.

### 3.3 Price Stream

An independently maintained price-history channel for a Listing. A Price Stream owns an immutable `price_stream_id` and is the identity that charts, quote mutation, binary storage, and stream-level state ultimately target.

### 3.4 Security Type

Product-level classification of the Security, for example:

- `EQUITY_OR_ETF`
- `SME_EQUITY`
- `PARTLY_PAID_EQUITY`
- `MUTUAL_FUND`
- `REIT`
- `INVIT`
- `PREFERENCE_SHARE`
- `DEBT_NCD`
- `CONVERTIBLE_DEBT`
- `WARRANT`
- `GOLD_BOND`
- `GOVERNMENT_SECURITY`
- `STATE_DEVELOPMENT_LOAN`
- `TREASURY_BILL`
- `RIGHTS_ENTITLEMENT`
- `INDEX`
- `OTHER`

The exact classifier must use official metadata and must not assume raw series/group alone always determines Security Type.

### 3.5 Raw exchange classification

Exchange-provided classification is preserved exactly and interpreted in an exchange-specific way:

- NSE: raw **Series** (`EQ`, `BE`, `SM`, `RR`, `N1`, `BL`, and so on).
- BSE: raw **Group/classification**; it must not be treated as NSE Series merely because the current V1 schema stores BSE group metadata in the `series` column.

### 3.6 Stream Class

Stable product-level market-channel classification:

- `NORMAL`
- `TRADE_FOR_TRADE`
- `BLOCK_DEAL`
- `BUYBACK`
- `SPECIAL`
- `NOT_APPLICABLE`
- `UNKNOWN`

Raw classification and Stream Class are different fields.

## 4. V2 hard invariants

- **V2-I01 — Symbol is not canonical Security identity.** Symbol alone must never merge securities.
- **V2-I02 — NSE and BSE are equal first-class scope.** Neither exchange is implemented as an afterthought or forced through the other's classification rules.
- **V2-I03 — NSE Series and BSE Group remain exchange-specific evidence.** They must not be conflated.
- **V2-I04 — Index series is not applicable.** `NSE_INDEX` and `BSE_INDEX` have `security_type=INDEX`, `series=NULL`, `series_applicability=NOT_APPLICABLE`.
- **V2-I05 — Missing normal-security series is not Index.** Where series/classification is expected but absent, status is `UNKNOWN`/reviewable rather than `INDEX` or generic `NO_SERIES`.
- **V2-I06 — Conflicting identifiers fail closed.** Distinct valid ISINs sharing a symbol do not merge without authoritative effective-dated identity-transition evidence.
- **V2-I07 — One Security may own multiple independent Price Streams.** Same ISIN does not require one combined OHLCV history when independent market channels coexist.
- **V2-I08 — Classification lifecycle changes do not automatically fragment chart history.** A normal series/group transition such as `EQ -> BE -> EQ` may remain one NORMAL stream when evidence shows a lifecycle transition rather than simultaneous competing channels.
- **V2-I09 — Simultaneous independent channels remain separate.** NORMAL and BLOCK_DEAL data must never share one canonical price history.
- **V2-I10 — Canonical writes are identity-resolved before file access.** Unresolved, ambiguous, or conflicting identity cannot publish a V2 canonical price row.
- **V2-I11 — Corporate Actions attach to Security identity.** Stream-specific price adjustment is derived from the Security relationship; a CA event is not duplicated merely because multiple streams exist.
- **V2-I12 — V1 remains rollback authority until explicit promotion.** EOD1, Generation 6, and current production data remain untouched through design/shadow phases.
- **V2-I13 — Price-stream identity is stable across display metadata changes.** Symbol rename or ordinary exchange classification transition does not change a `price_stream_id` unless the market channel itself changes.
- **V2-I14 — Cross-exchange merge is evidence-driven.** Matching NSE/BSE symbols alone are never enough to create one `security_id`.

## 5. Logical data model

```text
Security (security_id)
  |
  +-- Listing (listing_id, NSE)
  |     +-- Price Stream (price_stream_id, NORMAL)
  |     +-- Price Stream (price_stream_id, BLOCK_DEAL) [when applicable]
  |
  +-- Listing (listing_id, BSE)
        +-- Price Stream (price_stream_id, NORMAL)
```

Supporting effective-dated evidence/history is required for:

- security identifiers (ISIN and official IDs);
- listing symbols/names;
- listing status/lifecycle;
- NSE Series history;
- BSE Group/classification history;
- source provenance and resolution decisions.

Exact SQL DDL is an implementation-phase artifact; this R1 freezes semantics and keys, not every physical column.

## 6. NSE identity and stream resolution

NSE evidence to preserve when present includes symbol, Series, ISIN, official financial-instrument/security ID, instrument type, name, segment/source, and effective/trade date.

Resolution principles:

- Same symbol alone: insufficient.
- Same ISIN plus compatible official evidence: may resolve to the same Security.
- Same symbol plus different valid ISINs: separate Securities unless dated official transition evidence proves continuity.
- Same ISIN plus `EQ/BL` or `RR/BL` on the same date: same Security, separate market streams.
- `EQ -> BE -> EQ` over different periods, without same-date competition and with compatible identity evidence: preserve one NORMAL price stream plus effective-dated Series history.
- `IMC1` `N1/N2/N3` with distinct ISINs: distinct Securities and distinct Price Streams.

## 7. BSE identity and stream resolution

BSE is first-class and uses BSE-specific authority. Evidence includes BSE security code, symbol/name, ISIN, official group/classification, lifecycle state, and price-source evidence.

Resolution principles:

- BSE security code is strong **listing** evidence, not a universal cross-exchange Security ID.
- Same BSE security code plus compatible identity evidence may preserve one Listing across symbol/name changes.
- Same BSE security code plus conflicting ISIN is an identity conflict, not an automatic overwrite.
- BSE Group/classification changes are effective-dated metadata and do not automatically create new price streams.
- BSE Group semantics must never be interpreted with NSE Series rules.
- Cross-exchange security equivalence is decided by a separate evidence-based resolver; neither exchange importer silently mutates the other exchange's listing.

## 8. Index model and Sidebar invariant

Indexes are first-class Securities and Listings with a Price Stream, but Series is not applicable:

```text
NIFTY 50
  exchange = NSE_INDEX
  security_type = INDEX
  series = NULL
  stream_class = NOT_APPLICABLE

SENSEX
  exchange = BSE_INDEX
  security_type = INDEX
  series = NULL
  stream_class = NOT_APPLICABLE
```

UI invariant:

- index rows display `Index` as Security Type and `—`/`N/A` for Series;
- indexes must not appear as `No series` in Series settings;
- Series/Group filters do not decide whether an Index is visible;
- Index visibility belongs to Security Type and exchange-family filtering.

## 9. Default stream selection

A Listing may expose one preferred/default chart stream for backward-compatible symbol selection.

Preferred order is conceptually:

1. NORMAL;
2. a deterministic ordinary continuation stream where the classifier explicitly permits it;
3. never automatically choose BLOCK_DEAL, BUYBACK, or SPECIAL.

Examples:

- APOLLOTYRE default: NORMAL (`EQ` at the R3 date), not `BL`.
- KRT/NXST default: NORMAL (`RR` at the R3 date), not `BL`.
- Index default: its single index Price Stream.
- `IMC1`: no symbol-level default across distinct Securities; exact security/stream selection is required where ambiguity exists.

## 10. Corporate Action boundary

Corporate Action identity attaches to `security_id`.

- Multiple exchange listings can share one Security when authoritative evidence proves equivalence.
- Multiple streams under one listing do not create duplicate CA events.
- Exact-date identifier history may bridge legitimate ISIN/symbol transitions, but CA evidence must not silently override current official exchange master authority.
- Conflicts remain reviewable/fail-closed.

## 11. Compatibility impact matrix

| Component | V2 impact |
|---|---|
| Bhavcopy | resolve Security/Listing/Price Stream before V2 write |
| Binary EOD | EOD2 keyed by `price_stream_id` |
| Binary-state sidecar | V2 state keyed by `price_stream_id` |
| SQLite prices | eventual stream-keyed identity |
| Symbol search | return security/listing/stream descriptor |
| Sidebar | Security Type plus exchange-specific Series/Group/Stream filtering |
| Indexes | Series N/A; visibility independent of Series filter |
| Chart | bind exact `price_stream_id` |
| Quote Editor | mutate exact stream |
| Watchlists | migrate to stream identity where unambiguous |
| Workspaces | resolve legacy `exchange+symbol` references |
| Corporate Actions | bind economic event to `security_id` |
| Identity import | maintain Security/Listing evidence and history |
| Manual import | require deterministic identity resolution |
| Scanners / alerts | consume exact chart stream identity |

## 12. Non-goals

V2 does **not** authorize:

- rebuilding the chart engine or indicators;
- redesigning Corporate Action UI/workflow;
- changing the Bhavcopy 2/4/2 worker policy;
- changing durability/recovery ordering merely because V2 exists;
- removing broad securities from NSE/BSE ingestion;
- inventing missing BSE historical coverage;
- merging NSE and BSE price histories;
- using raw symbol+series as the complete permanent Security identity;
- modifying the production database during V2-P0.

## 13. R2/R3 evidence that triggered V2

### R2 — test-clone post-runtime audit

- physical `.eod` files: **24,754**;
- sidecar indexed/VERIFIED: **24,754 / 24,754**;
- state identity, orphan, missing-row, structural mismatches: **0**;
- same-date duplicate groups in the imported range: **28**;
- duplicate extra records: **32**;
- all 28 duplicate groups contained different values;
- current source policy verified **2 / 4 / 2**.

### R3 — exact official NSE UDiFF source-series mapping

- R2 duplicate groups: **28**;
- physical records in those groups: **60**;
- official NSE source rows: **60**;
- exact source-to-binary matches: **60**;
- all groups explained: **true**;
- source-series matrix: **19 BL+EQ**, **2 BL+RR**, **4 N1+N2+N3**, **1 N1+N3**, **2 N2+N3**.

R3 proves the identity/stream problem for NSE. It does not prove BSE has equivalent collisions in that ten-session sample; BSE remains first-class V2 scope because the V1 identity key has the same symbol-centric structural limitation and BSE has its own official listing identifiers/classifications.

## 14. Approved future-architecture status

This architecture is **approved and frozen for implementation planning**, but implementation remains **NOT STARTED**.

Any coding phase must bind this document, the EOD2 storage spec, migration/compatibility spec, implementation plan, ADRs, the exact source authority, and the R2/R3 evidence before modifying V2-related production source.
