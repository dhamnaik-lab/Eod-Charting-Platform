# EOD2 Price-Stream Storage Specification R1

**Status:** APPROVED FUTURE STORAGE SPEC / IMPLEMENTATION NOT STARTED  
**Applies to:** NSE, BSE, NSE_INDEX, BSE_INDEX  
**Current production storage remains:** EOD1 + Generation 6


## V2-P0 authority binding

- Freeze date: **2026-09-07 IST**.
- Source snapshot: `Eod Charting Platform Source Code 2026-09-06_161742_IST.zip`.
- Source snapshot SHA-256: `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`.
- R2 test-clone post-runtime evidence ZIP SHA-256: `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`.
- R3 NSE source-series forensic evidence ZIP SHA-256: `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
- Production implementation status: **NOT STARTED**.
- Current production authority remains **EOD1 + Generation 6 + current SQLite schema/identity model** until a later explicitly approved V2 promotion phase.


## 1. Objective

EOD2 changes binary identity from one file per `exchange + symbol` to one file per immutable `price_stream_id`, while preserving the proven 64-byte OHLCV record payload and the current durability/recovery principles.

EOD2 is a parallel/shadow format until explicit promotion. EOD1 is not modified in place.

## 2. File identity and path

Canonical V2 path is numeric-stream based. Proposed R1 path contract:

```text
eod_data_v2/<exchange>/<price_stream_id>.eod
```

Examples:

```text
eod_data_v2/NSE/12001.eod     # APOLLOTYRE NORMAL
eod_data_v2/NSE/12002.eod     # APOLLOTYRE BLOCK_DEAL
eod_data_v2/NSE/13001.eod     # IMC1 N1 security stream
eod_data_v2/NSE/13002.eod     # IMC1 N2 security stream
eod_data_v2/NSE_INDEX/20001.eod
```

The filename is not a symbol and must remain stable across symbol/name/classification lifecycle changes.

## 3. EOD2 header

EOD2 retains the 128-byte header size and 64-byte record size.

| Offset | Size | Field |
|---:|---:|---|
| 0 | 4 | magic `EOD2` |
| 4 | 2 | version `2` |
| 6 | 2 | record size `64` |
| 8 | 4 | record count `u32` |
| 12 | 4 | price scale `u32` |
| 16 | 32 | symbol snapshot, UTF-8/null-padded/truncated for diagnostics only |
| 48 | 16 | exchange snapshot, UTF-8/null-padded |
| 64 | 8 | `security_id` `u64` |
| 72 | 8 | `listing_id` `u64` |
| 80 | 8 | `price_stream_id` `u64` |
| 88 | 16 | raw exchange-classification snapshot (NSE Series or BSE Group); zero for N/A |
| 104 | 4 | identity/classification flags `u32` |
| 108 | 20 | reserved, zero-filled in R1 |

R1 flag assignments:

- bit 0: `CLASSIFICATION_NOT_APPLICABLE` (Index contract);
- bit 1: `CLASSIFICATION_KIND_BSE_GROUP` (unset means NSE-Series-style raw classification for applicable NSE cash-market streams; exchange snapshot still governs interpretation);
- all other bits reserved and written zero until a later approved spec revision.

The database/catalog remains authoritative for rich metadata. Header symbol/exchange/raw-classification values are diagnostic snapshots and cannot supersede IDs.

## 4. EOD2 record

The 64-byte OHLCV record remains byte-compatible with EOD1:

| Offset | Size | Field |
|---:|---:|---|
| 0 | 4 | date `u32` YYYYMMDD |
| 4 | 4 | flags `u32` |
| 8 | 8 | open `i64` scaled |
| 16 | 8 | high `i64` scaled |
| 24 | 8 | low `i64` scaled |
| 32 | 8 | close `i64` scaled |
| 40 | 8 | previous close `i64` scaled |
| 48 | 8 | volume `u64` |
| 56 | 8 | open interest `u64` |

No Series/Group/ISIN is added to each bar. Those are catalog/evidence attributes resolved before writing the stream.

## 5. Record-level invariants

- one `price_stream_id + date` has at most one canonical V2 record;
- records are strictly ascending by date after canonical publication;
- same-date different-value rows cannot coexist in one V2 stream;
- if resolver output produces a residual same-stream collision, publication fails closed with identity/source evidence;
- historical update/rewrite semantics remain conservative until separately proven safe.

## 6. V2 binary-state sidecar

V2 uses a separate sidecar authority, conceptually `eod_binary_state_v2.sqlite`, and does not mutate the Generation-6 V1 sidecar.

Logical key:

```text
PRIMARY KEY(price_stream_id)
```

Required state attributes include:

- `price_stream_id`;
- `security_id`;
- `listing_id`;
- exchange/symbol/classification snapshots for diagnostics;
- relative path;
- file length / mtime identity;
- record count / price scale / first date / last date;
- state status;
- state generation;
- updated timestamp.

V2 sidecar schema version is distinct from V1 schema version. The first V2 promoted generation must be a fresh bootstrap generation; this R1 deliberately does not permanently hard-code the future generation number beyond “next V2 generation after current Generation 6 authority.”

## 7. Durability and recovery

V2 must preserve the proven storage safety properties unless a separately approved benchmark/change says otherwise:

- new/full-file publication crosses `sync_data()` before atomic rename;
- conservative rewrite/update/historical mutation is immediately durable;
- deferred APPEND_NEWEST durability is allowed only while covered by a durable recovery journal and a verified checkpoint lifecycle;
- checkpoint verification precedes recovery-session cleanup;
- state publication occurs only after physical-file correctness/durability requirements are met;
- current 2/4/2 worker policy is preserved through initial V2 work.

## 8. EOD1 / EOD2 coexistence

During shadow phases:

```text
V1 current authority:
  eod_data/
  eod_binary_state.sqlite
  EOD1

V2 shadow authority:
  eod_data_v2/
  eod_binary_state_v2.sqlite
  EOD2
```

Readers do not silently mix files. Shadow-read comparisons must be explicit and separately reported.

## 9. Index storage

Indexes receive normal IDs and an EOD2 file, but classification is N/A:

- `security_type=INDEX` in catalog;
- header raw classification field zero-filled;
- `CLASSIFICATION_NOT_APPLICABLE` flag set;
- no fake `INDEX`, `NO_SERIES`, or exchange Series is persisted as raw Series.

## 10. Validation gates

An EOD2 file is VERIFIED only when, at minimum:

- magic/version/record-size are valid;
- file length equals `128 + record_count * 64`;
- header IDs match the catalog/expected stream;
- relative path matches `price_stream_id` identity;
- dates are valid and strictly ascending;
- no duplicate dates exist in a canonical stream;
- state file identity (length/mtime) matches physical file;
- first/last dates and record count match the file;
- the V2 sidecar row is at the active complete generation.

## 11. Explicit non-goals

EOD2 R1 does not:

- rewrite EOD1 in place;
- change record price precision;
- put full ISIN/name/history into every binary header;
- use symbol/series in the filename;
- authorize a reader promotion;
- modify the current production sidecar;
- change current download provider routes or Bhavcopy concurrency.

## 12. Promotion boundary

EOD2 becomes production authority only after the migration/compatibility acceptance gates and explicit V2 promotion approval. Until then all EOD2 data is shadow/private evidence.
