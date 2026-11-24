//! Forward traversal of raw canonical bars under one shared source lease.

use chrono::NaiveDate;
use std::collections::VecDeque;

use super::*;
use crate::database::binary_eod::ForwardBinaryRecords;
use crate::database::{connection_registry, database_use::CanonicalAccess, storage_paths};

const FIRST_DATE: &str = "1900-01-01";
const BEFORE_FIRST_DATE: &str = "1899-12-31";
const DEFAULT_CUTOFF: &str = "2100-12-31";
const SQLITE_BATCH: usize = 64;
const MAX_RELATED_SYMBOLS: usize = 64;
const MAX_PAGE_BARS: usize = 1000;

pub(crate) struct ForwardSource {
    folder: std::path::PathBuf,
    connection: Connection,
    #[cfg(all(windows, feature = "wp02-acceptance"))]
    _acceptance_guard: Option<std::fs::File>,
    _lease: crate::database::database_use::CanonicalLease,
}

pub(crate) struct ForwardTarget(ResolvedInstrumentContext);

impl ForwardTarget {
    pub(crate) fn identity(&self) -> (&str, &str) {
        (&self.0.exchange, &self.0.current_symbol)
    }
}

pub(crate) struct ForwardCursor<'source> {
    connection: &'source Connection,
    context: ResolvedInstrumentContext,
    sources: Vec<SourceCursor>,
    cutoff: String,
    previous: Option<(NaiveDate, f64)>,
}

impl ForwardSource {
    pub(crate) fn open(folder: &Path) -> AppResult<Self> {
        Self::open_under(folder, CanonicalAccess::for_database(folder)?)
    }

    #[cfg(all(windows, feature = "wp02-acceptance"))]
    pub(crate) fn open_wp02_acceptance(folder: &Path) -> AppResult<Self> {
        let lease = CanonicalAccess::for_database(folder)?.begin_read()?;
        let (guard, connection) = connection_registry::open_wp02_acceptance_connection(folder)?;
        Ok(Self {
            folder: folder.to_owned(),
            connection,
            _acceptance_guard: Some(guard),
            _lease: lease,
        })
    }

    #[cfg(test)]
    pub(crate) fn in_namespace(folder: &Path, namespace: &Path) -> AppResult<Self> {
        Self::open_under(folder, CanonicalAccess::in_namespace(folder, namespace)?)
    }

    fn open_under(folder: &Path, access: CanonicalAccess) -> AppResult<Self> {
        let lease = access.begin_read()?;
        let connection = connection_registry::open_read_only_connection_for_folder(folder)?;
        Ok(Self {
            folder: folder.to_owned(),
            connection,
            #[cfg(all(windows, feature = "wp02-acceptance"))]
            _acceptance_guard: None,
            _lease: lease,
        })
    }

    pub(crate) fn resolve(&self, symbol: &str, exchange: &str) -> AppResult<ForwardTarget> {
        let symbol = normalize_symbol(symbol)?;
        let exchange = normalize_exchange(exchange)?;
        let context = resolve_instrument_context(&self.connection, &symbol, &exchange)?
            .ok_or_else(|| {
                format!("Target {exchange}:{symbol} has no resolvable instrument identity.")
            })?;
        if context.related_symbols.len() > MAX_RELATED_SYMBOLS {
            return Err("Canonical history target exceeds the related-symbol limit.".into());
        }
        Ok(ForwardTarget(context))
    }

    pub(crate) fn cursor(
        &self,
        target: ForwardTarget,
        as_of: Option<&str>,
    ) -> AppResult<ForwardCursor<'_>> {
        let context = target.0;
        let exchange = &context.exchange;
        let cutoff = normalize_optional_trade_date(as_of)?.unwrap_or_else(|| DEFAULT_CUTOFF.into());
        let storage_mode = get_price_storage_mode(&self.connection);
        let mut sources = Vec::new();
        for related in &context.related_symbols {
            if !same_chart_settlement(&exchange, &context.current_symbol, related) {
                continue;
            }
            let path = storage_paths::eod_path(&self.folder, exchange, related)?;
            let stream = if path.try_exists().map_err(|error| error.to_string())? {
                let binary = BinaryEodFile::open(path)?;
                if exchange == "BSE"
                    && bse_code_history::is_security_code(related)
                    && (binary.header.symbol != *related
                        || binary.header.exchange != *exchange
                        || binary.header.price_scale == 0)
                {
                    return Err(format!(
                        "BSE security-code file identity/scale mismatch: {related}"
                    ));
                }
                Stream::Binary {
                    records: binary.forward_records()?,
                    scale: binary.header.price_scale,
                }
            } else if storage_mode == PriceStorageMode::Hybrid {
                Stream::Sqlite {
                    after: BEFORE_FIRST_DATE.into(),
                    rows: VecDeque::new(),
                }
            } else {
                continue;
            };
            sources.push(SourceCursor {
                symbol: related.clone(),
                stream,
                head: None,
            });
        }
        Ok(ForwardCursor {
            connection: &self.connection,
            context,
            sources,
            cutoff,
            previous: None,
        })
    }
}

impl ForwardCursor<'_> {
    pub(crate) fn next_page(
        &mut self,
        limit: usize,
        remaining: &mut usize,
        cancelled: impl Fn() -> bool,
    ) -> AppResult<Vec<ScanPriceBar>> {
        if !(1..=MAX_PAGE_BARS).contains(&limit) {
            return Err("Invalid canonical history source page size.".into());
        }
        if cancelled() {
            return Err("Canonical history read cancelled.".into());
        }
        let mut page = Vec::with_capacity(limit);
        while page.len() < limit {
            for source in &mut self.sources {
                if cancelled() {
                    return Err("Canonical history read cancelled.".into());
                }
                source.fill(
                    self.connection,
                    &self.context.exchange,
                    &self.cutoff,
                    remaining,
                    &cancelled,
                )?;
            }
            let Some(date) = self
                .sources
                .iter()
                .filter_map(|s| s.head.as_ref())
                .map(|row| &row.date)
                .min()
                .cloned()
            else {
                break;
            };
            let rows = self
                .sources
                .iter_mut()
                .filter_map(|source| {
                    if source.head.as_ref().is_some_and(|row| row.date == date) {
                        source.head.take()
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            validate_index_alias_rows(&date, &rows, &self.context)?;
            bse_code_history::validate_bse_code_rows(&date, &rows, &self.context)?;
            let mut row = select_preferred_price_row(&date, &rows, &self.context)
                .expect("the minimum date came from a source row");
            let parsed_date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                .map_err(|error| format!("Invalid canonical price row date {date}: {error}"))?;
            row.prev_close = self.previous.and_then(|(prior_date, close)| {
                let adjacent = (1..=7).contains(&(parsed_date - prior_date).num_days());
                (self.context.exchange != "NSE_INDEX" || adjacent).then_some(close)
            });
            page.push(scan_price_bar_from_row(&row)?);
            self.previous = Some((parsed_date, row.close));
        }
        Ok(page)
    }
}

struct SourceCursor {
    symbol: String,
    stream: Stream,
    head: Option<PriceRow>,
}

enum Stream {
    Binary {
        records: ForwardBinaryRecords,
        scale: u32,
    },
    Sqlite {
        after: String,
        rows: VecDeque<PriceRow>,
    },
    Exhausted,
}

impl SourceCursor {
    fn fill(
        &mut self,
        connection: &Connection,
        exchange: &str,
        cutoff: &str,
        remaining: &mut usize,
        cancelled: &impl Fn() -> bool,
    ) -> AppResult<()> {
        if self.head.is_some() {
            return Ok(());
        }
        self.head = match &mut self.stream {
            Stream::Binary { records, scale } => loop {
                if cancelled() {
                    return Err("Canonical history read cancelled.".into());
                }
                let Some(record) = records.next_record()? else {
                    break None;
                };
                consume_source_rows(remaining, 1)?;
                let row = eod_record_to_price_row(&record, &self.symbol, *scale);
                // Continue checking order beyond the cutoff. A later on-disk
                // record may be older than the first record beyond the cutoff.
                if (FIRST_DATE..=cutoff).contains(&row.date.as_str()) {
                    break Some(row);
                }
            },
            Stream::Sqlite { after, rows } => {
                if rows.is_empty() {
                    *rows = read_sqlite_batch(connection, exchange, &self.symbol, after, cutoff)?;
                    consume_source_rows(remaining, rows.len())?;
                    if let Some(last) = rows.back() {
                        after.clone_from(&last.date);
                    }
                }
                rows.pop_front()
            }
            Stream::Exhausted => return Ok(()),
        };
        if self.head.is_none() {
            self.stream = Stream::Exhausted;
        }
        Ok(())
    }
}

fn consume_source_rows(remaining: &mut usize, count: usize) -> AppResult<()> {
    *remaining = remaining
        .checked_sub(count)
        .ok_or("Numeric history source row limit exceeded.")?;
    Ok(())
}

fn read_sqlite_batch(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    after: &str,
    cutoff: &str,
) -> AppResult<VecDeque<PriceRow>> {
    let mut query = connection
        .prepare_cached(
            "SELECT symbol, date, open, high, low, close, prev_close, volume, open_interest
         FROM eod_prices WHERE exchange=? AND symbol=? AND date>=? AND date>? AND date<=?
         ORDER BY date ASC LIMIT ?",
        )
        .map_err(|error| error.to_string())?;
    let rows = query
        .query_map(
            params![
                exchange,
                symbol,
                FIRST_DATE,
                after,
                cutoff,
                SQLITE_BATCH as i64
            ],
            |row| {
                Ok(PriceRow {
                    symbol: row.get(0)?,
                    date: row.get(1)?,
                    open: row.get(2)?,
                    high: row.get(3)?,
                    low: row.get(4)?,
                    close: row.get(5)?,
                    prev_close: row.get(6)?,
                    volume: row.get(7)?,
                    open_interest: row.get(8).unwrap_or(0),
                })
            },
        )
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<_, _>>()
        .map_err(|error| error.to_string())
}

#[test]
fn nsr7_forward_cursor_matches_all_canonical_bars_across_alias_and_storage_seams() {
    use crate::database::binary_eod::DEFAULT_SCALE;
    use chrono::Days;

    let fixture = tempfile::tempdir().unwrap();
    let folder = fixture.path();
    let mut conn = Connection::open(folder.join(crate::database::DATABASE_FILE_NAME)).unwrap();
    crate::database::prepare_database_connection(&conn).unwrap();
    conn.execute_batch(
        "INSERT INTO instruments(symbol, exchange, name) VALUES
         ('NIFTY','NSE_INDEX','NIFTY 50'), ('CNXNIFTY','NSE_INDEX','CNX Nifty');",
    )
    .unwrap();

    let start = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
    let mut records = Vec::new();
    let transaction = conn.transaction().unwrap();
    for offset in (0..5024).filter(|offset| !(64..76).contains(offset)) {
        let date = (start + Days::new(offset)).format("%Y-%m-%d").to_string();
        let close = 100 + offset as i64;
        if offset % 2 == 0 {
            let price = close * i64::from(DEFAULT_SCALE);
            records.push(EodRecord {
                date: date_to_u32(&date),
                flags: 0,
                open: price,
                high: price,
                low: price,
                close: price,
                prev_close: 0,
                volume: 2,
                oi: 0,
            });
        } else {
            transaction
                .execute(
                    "INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume)
                 VALUES('CNXNIFTY','NSE_INDEX',?1,?2,?2,?2,?2,2)",
                    params![date, close],
                )
                .unwrap();
        }
    }
    transaction.commit().unwrap();
    let binary_path = folder.join("eod_data/NSE_INDEX/NIFTY.eod");
    BinaryEodFile::write_all(
        binary_path,
        "NIFTY",
        "NSE_INDEX",
        DEFAULT_SCALE,
        &mut records,
    )
    .unwrap();

    for mode in [PriceStorageMode::Binary, PriceStorageMode::Hybrid] {
        crate::database::set_price_storage_mode(&conn, mode.clone()).unwrap();
        let context = resolve_instrument_context(&conn, "NIFTY", "NSE_INDEX")
            .unwrap()
            .unwrap();
        for (page_size, cutoff) in [
            (1, DEFAULT_CUTOFF),
            (64, "2012-08-01"),
            (1000, DEFAULT_CUTOFF),
        ] {
            let oracle = load_unified_price_rows_with_mode(
                folder,
                &conn,
                &context,
                FIRST_DATE,
                cutoff,
                mode.clone(),
            )
            .unwrap()
            .iter()
            .map(scan_price_bar_from_row)
            .collect::<AppResult<Vec<_>>>()
            .unwrap();
            let source = ForwardSource::in_namespace(folder, folder).unwrap();
            let mut cursor = source
                .cursor(source.resolve("NIFTY", "NSE_INDEX").unwrap(), Some(cutoff))
                .unwrap();
            let mut budget = 10_000;
            let writer = CanonicalAccess::lock_writer_for_database(folder)
                .err()
                .unwrap();
            assert_eq!(writer, "CANONICAL_PRICE_STORE_BUSY");
            let mut paged = Vec::new();
            loop {
                let page = cursor.next_page(page_size, &mut budget, || false).unwrap();
                if page.is_empty() {
                    break;
                }
                assert!(page.len() <= page_size);
                paged.extend(page);
            }
            assert_eq!(
                paged, oracle,
                "page {page_size}, cutoff {cutoff}, storage {mode:?}"
            );
            if mode == PriceStorageMode::Hybrid && cutoff == DEFAULT_CUTOFF {
                assert_eq!(paged.len(), 5_012);
                assert_eq!(paged[64].prev_close, None);
            }
        }
    }
}

#[test]
fn nsr7_forward_cursor_refuses_duplicate_binary_dates_and_cancellation() {
    use crate::database::binary_eod::DEFAULT_SCALE;

    let fixture = tempfile::tempdir().unwrap();
    let folder = fixture.path();
    let conn = Connection::open(folder.join(crate::database::DATABASE_FILE_NAME)).unwrap();
    crate::database::prepare_database_connection(&conn).unwrap();
    conn.execute(
        "INSERT INTO instruments(symbol, exchange) VALUES('TEST','NSE')",
        [],
    )
    .unwrap();
    let record = EodRecord {
        date: 20261120,
        flags: 0,
        open: 10000,
        high: 10000,
        low: 10000,
        close: 10000,
        prev_close: 0,
        volume: 1,
        oi: 0,
    };
    BinaryEodFile::write_all(
        folder.join("eod_data/NSE/TEST.eod"),
        "TEST",
        "NSE",
        DEFAULT_SCALE,
        &mut [record; 2],
    )
    .unwrap();
    let source = ForwardSource::in_namespace(folder, folder).unwrap();
    let mut cursor = source
        .cursor(source.resolve("TEST", "NSE").unwrap(), None)
        .unwrap();
    let mut budget = 10;
    assert!(cursor
        .next_page(1, &mut budget, || true)
        .unwrap_err()
        .contains("cancelled"));
    assert_eq!(
        cursor.next_page(1, &mut budget, || false).unwrap()[0].date,
        20261120
    );
    assert!(cursor
        .next_page(1, &mut budget, || false)
        .unwrap_err()
        .contains("duplicate"));
}

#[test]
fn nsr7_forward_cursor_keeps_bse_settlement_bars_separate() {
    let fixture = tempfile::tempdir().unwrap();
    let folder = fixture.path();
    let conn = Connection::open(folder.join(crate::database::DATABASE_FILE_NAME)).unwrap();
    crate::database::prepare_database_connection(&conn).unwrap();
    conn.execute_batch(
        "INSERT INTO instruments(symbol,exchange,isin) VALUES
         ('TEST','BSE','INE123A01001'), ('TEST#','BSE','INE123A01001');
         INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume) VALUES
         ('TEST','BSE','2026-11-20',10,10,10,10,1),
         ('TEST#','BSE','2026-11-20',20,20,20,20,1);",
    )
    .unwrap();
    let source = ForwardSource::in_namespace(folder, folder).unwrap();
    for (symbol, close) in [("TEST", 10.0), ("TEST#", 20.0)] {
        let mut cursor = source
            .cursor(source.resolve(symbol, "BSE").unwrap(), None)
            .unwrap();
        let mut budget = 10;
        let page = cursor.next_page(1, &mut budget, || false).unwrap();
        assert_eq!(page[0].close, close);
        assert!(cursor
            .next_page(1, &mut budget, || false)
            .unwrap()
            .is_empty());
    }
}
