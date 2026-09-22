# Binary EOD Database Format (v1)

This document specifies the custom AmiBroker-style binary EOD database foundation for the EOD Charting Platform.

## Goals
- Full-history chart support without the performance overhead of large SQLite tables.
- $O(1)$ random access to records and $O(\log N)$ date-range lookups via binary search.
- Minimal storage footprint with fixed-size records.
- Atomic write safety.

## File Structure

Files use the extension `.eod` and are stored under an `eod_data/[EXCHANGE]/[SYMBOL].eod` hierarchy.

### Header (128 bytes)

| Offset | Size | Type | Field | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0 | 4 | `[u8; 4]` | `magic` | Magic bytes: `EOD1` |
| 4 | 2 | `u16` | `version` | Version (currently `1`) |
| 6 | 2 | `u16` | `record_size` | Record size (always `64` for v1) |
| 8 | 4 | `u32` | `record_count` | Total number of records in file |
| 12 | 4 | `u32` | `price_scale` | Price scaling factor (default `10000`) |
| 16 | 32 | `[u8; 32]` | `symbol` | Symbol (UTF-8, null-padded) |
| 48 | 16 | `[u8; 16]` | `exchange` | Exchange (UTF-8, null-padded) |
| 64 | 64 | `[u8; 64]` | `reserved` | Padding for alignment and future metadata |

### Record (64 bytes)

All numerical values are stored in **Little Endian** format. Prices are stored as `i64` scaled by `price_scale`.

| Offset | Size | Type | Field | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0 | 4 | `u32` | `date` | YYYYMMDD (e.g., `20260513`) |
| 4 | 4 | `u32` | `flags` | Bitmask for future use (e.g. adjustments) |
| 8 | 8 | `i64` | `open` | Open Price * Scale |
| 16 | 8 | `i64` | `high` | High Price * Scale |
| 24 | 8 | `i64` | `low` | Low Price * Scale |
| 32 | 8 | `i64` | `close` | Close Price * Scale |
| 40 | 8 | `i64` | `prev_close` | Prev Close Price * Scale |
| 48 | 8 | `u64` | `volume` | Trading Volume |
| 56 | 8 | `u64` | `oi` | Open Interest |

## Operations

### Reading
- Open the file and validate the `magic` and `version`.
- To read a date range $[D_{start}, D_{end}]$:
  1. Perform a binary search on the record array to find the first index $i$ where $Record[i].date \ge D_{start}$.
  2. Read sequentially from index $i$ until $Record[j].date > D_{end}$ or EOF.

### Writing
1. Sort input records by `date`.
2. Write the header and all records to a `.tmp` file.
3. Flush and close the `.tmp` file.
4. Atomically rename the `.tmp` file to the target `.eod` path.

## Commands

### `get_binary_eod_status(symbol, exchange)`
Returns metadata about a symbol's binary cache:
- `exists`: Whether the file exists on disk.
- `recordCount`: Number of EOD bars stored.
- `firstDate` / `lastDate`: Date range covered.
- `fileSize`: Total bytes on disk.
- `hasOi`: Whether any record contains non-zero open interest.

## Maintenance

### Manual Edits
The system maintains parity between SQLite `eod_prices` and binary `.eod` files during manual quote edits:
- **Upsert**: When a quote is added or edited in the UI, the record is merged into the binary file.
- **Delete**: When a quote is deleted from the UI, it is also removed from the binary file. If the file becomes empty, it is deleted from disk.
