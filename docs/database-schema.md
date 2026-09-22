# Database Schema

## Connection setup (database.rs)

```rust
pub fn prepare_database_connection(connection: &Connection) -> AppResult<()> {
    // These PRAGMAs must be set — confirm all are present:
    connection.execute_batch("
        PRAGMA journal_mode=WAL;      -- required for concurrent worker writes
        PRAGMA synchronous=NORMAL;    -- safe with WAL
        PRAGMA foreign_keys=ON;
        PRAGMA busy_timeout=5000;     -- prevents SQLITE_BUSY errors under load
    ")?;
    Ok(())
}
```

**WAL mode is critical.** Without it, the bhavcopy worker pool (up to 10 threads,
each with its own connection) will hit `SQLITE_BUSY` errors during batch downloads.

---

## Tables

### `instruments`
```sql
CREATE TABLE IF NOT EXISTS instruments (
    symbol             TEXT NOT NULL,
    exchange           TEXT NOT NULL DEFAULT 'NSE',
    isin               TEXT,
    name               TEXT,
    series             TEXT,
    series_as_of_date  TEXT,
    sector             TEXT,
    industry           TEXT,
    is_active          INTEGER NOT NULL DEFAULT 1,
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(symbol, exchange)
);
CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments(exchange);
CREATE INDEX IF NOT EXISTS idx_instruments_isin ON instruments(isin);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange_isin ON instruments(exchange, isin);
```

Bhavcopy imports write NSE `SERIES` and BSE `GROUP` into `instruments.series`.
`series_as_of_date` stores the source trade date for that metadata so full-history
backfills cannot let an older worker overwrite newer daily-use classification.
The field is intended for symbol-browser filtering; it should not be used to drop
equity history at import time. The current daily NSE preset keeps `EQ`, `BE`,
`BZ`, `SM`, `ST`, and `SZ` visible while leaving other stored series available
through the `All` filter.

### `eod_prices`
```sql
CREATE TABLE IF NOT EXISTS eod_prices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    exchange    TEXT    NOT NULL,
    date        TEXT    NOT NULL,   -- ISO format: YYYY-MM-DD
    open        REAL,
    high        REAL,
    low         REAL,
    close       REAL    NOT NULL,
    prev_close  REAL,
    volume      INTEGER,
    trades      INTEGER,
    UNIQUE(symbol, exchange, date)
);
CREATE INDEX IF NOT EXISTS idx_eod_symbol_exchange ON eod_prices(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_eod_exchange_date   ON eod_prices(exchange, date);
CREATE INDEX IF NOT EXISTS idx_eod_date            ON eod_prices(date);
```

**INSERT OR REPLACE** is used in bhavcopy import — re-downloading a date overwrites existing rows.

### `download_log`
```sql
CREATE TABLE IF NOT EXISTS download_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_date      TEXT    NOT NULL,
    exchange        TEXT    NOT NULL,
    rows_inserted   INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL,  -- 'ok' | 'error'
    note            TEXT,              -- error message if status='error'
    downloaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(trade_date, exchange)
);
```

Used to skip re-downloading dates already successfully imported.
Query: `SELECT id FROM download_log WHERE trade_date=? AND exchange=? AND status='ok'`

### `settings`
```sql
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,   -- JSON blob
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Current keys:
- `"bhavcopy_settings"` → `BhavcopySettings` JSON

Upsert pattern:
```sql
INSERT INTO settings (key, value, updated_at)
VALUES (?, ?, datetime('now'))
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
```

### `watchlists`
```sql
CREATE TABLE IF NOT EXISTS watchlists (
    id          TEXT    PRIMARY KEY,   -- UUID
    name        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### `watchlist_items`
```sql
CREATE TABLE IF NOT EXISTS watchlist_items (
    id              TEXT    PRIMARY KEY,
    watchlist_id    TEXT    NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol          TEXT    NOT NULL,
    exchange        TEXT    NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(watchlist_id, symbol, exchange)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
```

### `corporate_actions`
```sql
CREATE TABLE IF NOT EXISTS corporate_actions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol           TEXT NOT NULL,
    exchange         TEXT NOT NULL DEFAULT 'NSE',
    effective_date   TEXT NOT NULL,
    action_type      TEXT NOT NULL,   -- SPLIT | BONUS | DIVIDEND | RIGHTS
    factor           REAL NOT NULL,   -- share-multiplier used by Adjusted mode
    adjust_volume    INTEGER NOT NULL DEFAULT 1,
    note             TEXT,
    applied_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, exchange, effective_date, action_type, factor)
);
```

Additional migrated columns are maintained through `ensure_column(...)` in
`src-tauri-shell/src/database/bootstrap.rs`:

- `isin`
- `record_date`
- `ratio_num`
- `ratio_den`
- `old_face_value`
- `new_face_value`
- `cash_amount`
- `source`
- `source_ref`
- `created_at`
- `updated_at`

`factor` stays the canonical adjusted-mode multiplier:

- split `Rs 10 -> Re 1` => `10.0`
- bonus `1:1` => `2.0`
- bonus `1:2` => `1.5`
- dividend => derived at approval time from the previous local close
- rights => derived at approval time from TERP using the previous local close,
  ratio, and issue/subscription price

`source` and `source_ref` preserve approval provenance:

- manual entry keeps `MANUAL`
- approved imports preserve their original import source such as `NSE_API`,
  `BSE_API`, `NSE_CSV`, or `BSE_CSV`

Raw `.eod` files are not rewritten. Adjusted prices are derived at read time.

### `corporate_action_imports`
```sql
CREATE TABLE IF NOT EXISTS corporate_action_imports (
    id                            INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key                    TEXT NOT NULL UNIQUE,
    exchange                      TEXT NOT NULL DEFAULT 'NSE',
    source                        TEXT NOT NULL,   -- NSE_API | BSE_API | NSE_CSV | BSE_CSV
    source_file                   TEXT,
    symbol                        TEXT,
    isin                          TEXT,
    bse_scrip_code                TEXT,
    company_name                  TEXT,
    purpose_raw                   TEXT NOT NULL,
    ex_date                       TEXT,
    record_date                   TEXT,
    action_type                   TEXT NOT NULL DEFAULT 'OTHER',
    ratio_num                     REAL,
    ratio_den                     REAL,
    old_face_value                REAL,
    new_face_value                REAL,
    cash_amount                   REAL,
    factor                        REAL,
    price_factor                  REAL,
    parse_status                  TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    review_status                 TEXT NOT NULL DEFAULT 'PENDING',
    message                       TEXT,
    approved_corporate_action_id  INTEGER REFERENCES corporate_actions(id),
    imported_at                   TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at                   TEXT
);
```

This table stores fetched/imported review candidates only. Nothing in this table
changes chart prices until the row is manually approved into `corporate_actions`.
Each newly inserted row now also writes one provenance snapshot into
`corporate_action_import_evidence`, and older databases backfill one evidence
snapshot per existing import row the first time they open on the newer build.

Current review states in active use:

- `PENDING` → parsed and matched to one database symbol
- `PENDING_ISIN_MISMATCH` → exact symbol matched, but the official ISIN differs
  from the current `instruments.isin` snapshot; this is still reviewable and
  approvable because it often reflects historical ISIN drift
- `UNRESOLVED` → the row could not be mapped safely yet
- `NEEDS_REVIEW` → parsing or date capture is incomplete
- `UNSUPPORTED` → stored for review only in the current flow
- `APPROVED` → already linked to the canonical `corporate_actions` table

`Review Issues` can now bulk auto-recheck selected `UNRESOLVED` rows against
the current database state without hitting NSE/BSE again. That path reuses the
same resolver logic as the single-row auto-recheck flow. For NSE rows, the
auto-recheck path can now also follow a connected identity-history symbol chain
and prefer the single active current symbol when a one-hop lookup is not enough.
If that chain is still ambiguous, the unresolved row message now lists the
candidate database symbols so manual review has immediate context. The same
review flow now also exposes a read-only per-row suggestion endpoint that
preloads likely current symbols into the resolve panel before the user runs a
manual search; those suggestions are derived from the same identity-history
chain plus any matching `instrument_isin_history` evidence for the event date.
When those suggestions narrow to exactly one active current symbol, the resolve
panel also exposes a one-click `Use Top Suggestion` action on top of the normal
manual resolve flow. `Review Issues` row actions now reuse that same suggestion
path first, so obvious one-candidate cases can resolve directly from the table
without opening the panel. A separate batch hint endpoint now summarizes visible
unresolved rows into quick labels such as `1 active`, `2 active`, `No active`,
or `No hint`, so the issue table can show the likely resolve shape before the
row action is clicked. `Review Issues` also uses those same hints for a selected
bulk quick-resolve action, but only rows with `ONE_ACTIVE` hint are resolved in
that batch; the rest stay manual-review rows. A UI-side `Only 1 Active` filter
now narrows the unresolved issue list to that same one-candidate subset without
changing the underlying review statuses, while a second `Multiple Active` filter
can isolate ambiguous unresolved rows whose hint cache currently shows more than
one active suggested current symbol. A third `No Active` filter can isolate
unresolved rows whose current hint cache has no active suggested current symbol.
When that filter is enabled, the UI now shows inline help clarifying that this
is a resolver-status hint and not proof that the company is unlisted. The same
clarification now also appears in the row-level `No active` hint tooltip inside
the unresolved issue table. A `Save No Active` toolbar action can also export
the unresolved `NONE_ACTIVE` rows through a native save dialog as tab-separated
audit text for grouped manual review. The same review toolbar now also exposes
`Save 1 Active`, `Save Multiple`, and `Save No Hint`, and the default issue
summary separates those four hint buckets so `No Active` no longer hides `No
hint` rows inside the same audit count. An `All matching` export toggle now
lets those save actions fetch every unresolved row matching the current type
and search filters instead of only the loaded page. When `All matching` is
enabled, the review status line now reports page-fetch progress, hint-batch
progress, and the final file-write step during large exports. The same long
running path now also exposes `Cancel Export`, which stops after the current
fetch or hint batch completes and exits without writing a file. The review UI
now also shows that long-running export progress inline near the export
controls, instead of relying only on the shared status line. That same inline
progress area now also shows compact badges for pages fetched, unresolved rows
gathered, hint batches completed, and matching rows being written. The top
`Review Issues` action toolbar now also wraps at the default floating-window
width so those resolve and save/export actions stay reachable without
horizontally clipping the row first.

### `corporate_action_import_evidence`
```sql
CREATE TABLE IF NOT EXISTS corporate_action_import_evidence (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id          INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
    source_code        TEXT NOT NULL,
    source_locator     TEXT,
    captured_at        TEXT NOT NULL DEFAULT (datetime('now')),
    symbol_seen        TEXT,
    isin_seen          TEXT,
    company_name_seen  TEXT,
    action_type_seen   TEXT,
    event_date_seen    TEXT,
    factor_seen        REAL,
    raw_reference      TEXT,
    note               TEXT
);
```

This table stores per-import source provenance. It is not a second approval
table and does not change chart pricing by itself.

Current use:

- new NSE/BSE API and CSV import rows write one evidence snapshot automatically
- older databases backfill one evidence snapshot per existing import row once on
  open behind `migration.corporate_action_import_evidence_backfill_v1`
- the Phase 3 historical pilot command now also uses this table when a BSE or
  NSE historical source proves an action that already exists in
  `corporate_action_imports`, so the app can preserve extra source provenance
  without cloning the same split/bonus row into the review queue again

`source_locator` is intentionally broader than `source_url`, because historical
backfill evidence can come from live endpoints, local CSV paths, or archived
documents.

The current Phase 3 pilot command is backend-only and typed through the desktop
bridge:

- `backfillHistoricalCapitalActionsForSymbol`

Current contract:

- targets `NSE` symbols only in this slice
- uses the official NSE structured API with a concrete `symbol=` parameter for
  the requested symbol plus connected identity-history aliases
- can optionally use official BSE deep history through `DefaultData` when the
  caller supplies a `bseScripCode`, and the `Official Imports` UI now tries a
  conservative unique same-ISIN BSE lookup when that field is left blank
- processes only split/bonus rows
- inserts new review rows into `corporate_action_imports`
- attaches new provenance to equivalent existing import rows instead of
  recreating cross-source duplicates

### `corporate_action_fetch_coverage`
```sql
CREATE TABLE IF NOT EXISTS corporate_action_fetch_coverage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange    TEXT NOT NULL DEFAULT 'NSE',
    source      TEXT NOT NULL,   -- NSE_API | BSE_API
    from_date   TEXT NOT NULL,
    to_date     TEXT NOT NULL,
    fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (exchange, source, from_date, to_date)
);
```

This table records which official date windows were fetched successfully, even
when the source returned zero corporate-action rows for that window. It lets
later official re-fetches reuse saved coverage and call the source only for
missing dates.

The coverage table is still the default optimization path. A request-scoped
`forceRefresh` fetch can bypass coverage for one explicit refresh request
without deleting the saved coverage rows.

### `scan_runs`
```sql
CREATE TABLE IF NOT EXISTS scan_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    scope          TEXT NOT NULL,     -- OFFICIAL | BLIND
    action_types   TEXT NOT NULL,     -- CSV list of targeted action types
    started_at     TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at   TEXT,
    status         TEXT NOT NULL DEFAULT 'RUNNING',
    message        TEXT,
    total_results  INTEGER NOT NULL DEFAULT 0
);
```

### `corporate_action_scan_results`
```sql
CREATE TABLE IF NOT EXISTS corporate_action_scan_results (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_run_id                 INTEGER NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    corporate_action_import_id  INTEGER REFERENCES corporate_action_imports(id),
    corporate_action_id         INTEGER REFERENCES corporate_actions(id),
    symbol                      TEXT,
    exchange                    TEXT NOT NULL DEFAULT 'NSE',
    scan_status                 TEXT NOT NULL,
    prev_trade_date             TEXT,
    ex_trade_date               TEXT,
    prev_close                  REAL,
    ex_open                     REAL,
    ex_close                    REAL,
    expected_factor             REAL,
    actual_open_factor          REAL,
    actual_close_factor         REAL,
    confidence                  REAL,
    message                     TEXT,
    scanned_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

These are review diagnostics only. Scan rows do not auto-approve actions.

### `instrument_identity_history`
```sql
CREATE TABLE IF NOT EXISTS instrument_identity_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange        TEXT NOT NULL DEFAULT 'NSE',
    isin            TEXT,
    current_symbol  TEXT,
    current_name    TEXT,
    old_symbol      TEXT,
    old_name        TEXT,
    new_symbol      TEXT,
    new_name        TEXT,
    effective_date  TEXT NOT NULL,
    change_type     TEXT NOT NULL,   -- SYMBOL_CHANGE | NAME_CHANGE | COMBINED
    source          TEXT,
    source_ref      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

This table preserves old-to-current continuity for symbol/name history and is
also used by the NSE identity archive import plus manual current-universe sync.

### `instrument_isin_history`
```sql
CREATE TABLE IF NOT EXISTS instrument_isin_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange        TEXT NOT NULL DEFAULT 'NSE',
    symbol          TEXT NOT NULL,
    isin            TEXT NOT NULL,
    effective_date  TEXT,
    source          TEXT,
    source_ref      TEXT,
    note            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

This table stores point-in-time ISIN evidence for a current database symbol. It
does not replace `instruments.isin`; it supplements the current snapshot with
historical evidence captured during approved corporate-action flows. Older
databases also backfill this table one time from existing approved official
imports plus canonical approved corporate actions. That lets future official
imports distinguish likely historical ISIN drift from true symbol mapping
failures without waiting for new approvals. The same upgrade path also
reclassifies already-stored `PENDING_ISIN_MISMATCH` rows back to `PENDING` when
that exact symbol/date/ISIN evidence is now present. New evidence written by
future approvals also performs that same normalization immediately.

---

## Key queries

### Latest imported date per exchange (used in Update mode)
```sql
SELECT MAX(date) FROM eod_prices WHERE exchange = ?
```

### Pre-filter already imported dates (used in Update + FullHistory)
```sql
SELECT DISTINCT date
FROM eod_prices
WHERE exchange = ?
  AND date >= ?
  AND date <= ?
```

### Check if date already downloaded (skip logic)
```sql
SELECT id FROM download_log
WHERE trade_date = ? AND exchange = ? AND status = 'ok'
LIMIT 1
```

### Verify rows exist for date (double-check before skip)
```sql
SELECT 1 FROM eod_prices
WHERE date = ? AND exchange = ?
LIMIT 1
```

### Load EOD data for a symbol
```sql
SELECT date, open, high, low, close, prev_close, volume
FROM eod_prices
WHERE symbol = ? AND exchange = ?
ORDER BY date ASC
```

---

## Exchange key normalization

Exchange strings stored in DB are uppercase, alphanumeric only:
- `"NSE"`, `"BSE"`, `"NSE_INDEX"`, `"BSE_INDEX"`

Normalized via:
```rust
fn normalize_exchange_key(exchange: &str) -> String {
    exchange.to_uppercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect()
}
// "NSE_INDEX" → "NSEINDEX" (for comparison only, storage keeps underscore)
```

---

## Data volume reference

Full NSE history (1994–present): ~8M rows in eod_prices
Full BSE history (1990–present): ~15M rows in eod_prices
Typical database file size: 400MB–1.2GB depending on exchanges imported
Query performance: index-covered, sub-millisecond for single symbol loads
