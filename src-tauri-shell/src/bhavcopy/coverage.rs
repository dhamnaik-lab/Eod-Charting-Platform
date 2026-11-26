//! BHAV-03BCD: source-scope receipts, physical verification and missing-only admission.
//! A receipt is not an exchange-wide universe certificate. Legacy log counts are hints only.
use super::calendar::{
    full_history_start_for_exchange, generate_calendar_days, get_exchange_holiday_name,
    is_special_trading_day, parse_trade_date,
};
use super::ingestion::{connection_database_folder, storage_mode_get_latest_imported_trade_date};
use super::parsers::{ParsedBhavcopyFile, ParsedBhavcopyRow};
use super::types::{AppResult, ImportedTradeDates};
use crate::database::binary_eod::{
    date_to_u32, u32_to_date, BinaryEodFile, EodRecord, DEFAULT_SCALE, HEADER_SIZE, RECORD_SIZE,
};
use crate::database::database_use::CanonicalAccess;
use crate::database::index_aliases::nse_index_alias_family;
use crate::database::{get_price_storage_mode, PriceStorageMode};
use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime};

const SCHEMA: &str = "bhavcopy-coverage-v1";
const WINDOW_DAYS: i64 = 31;
const RETRY_LOOKBACK_DAYS: i64 = 90;
const RETRY_CAP: usize = 10;
const RETRY_COOLDOWN_SECS: i64 = 24 * 60 * 60;
const MAX_RECEIPT_BYTES: usize = 16 * 1024 * 1024;
const MAX_MEMBERS: usize = 50_000;
type Job = (String, String);

pub(super) fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn table_exists(connection: &Connection, table: &str) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
            [table],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
}

fn database_path(connection: &Connection) -> AppResult<Option<PathBuf>> {
    let path: String = connection
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok((!path.is_empty()).then(|| PathBuf::from(path)))
}

fn safe_symbol(symbol: &str) -> bool {
    !symbol.is_empty()
        && !symbol.contains(['/', '\\', ':', '\0'])
        && !matches!(symbol, "." | "..")
        && !symbol.ends_with(['.', ' '])
}

fn valid_date_number(date: u32) -> bool {
    NaiveDate::from_ymd_opt((date / 10000) as i32, date / 100 % 100, date % 100).is_some()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Member {
    symbol: String,
    ohlc: [i64; 4],
    previous_close: Option<i64>,
    volume: Option<u64>,
    oi: Option<u64>,
    trades: Option<i64>,
}

impl Member {
    fn from_row(row: &ParsedBhavcopyRow, exchange: &str) -> Self {
        let r = row.binary_record;
        let index = exchange == "NSE_INDEX" || exchange == "BSE_INDEX";
        Self {
            symbol: row.symbol.clone(),
            ohlc: [r.open, r.high, r.low, r.close],
            // The existing writer may infer prev_close when the source omits it.
            // Only a supplied nonzero previous close is a source assertion.
            previous_close: (!index && r.prev_close != 0).then_some(r.prev_close),
            volume: (!index || r.volume != 0).then_some(r.volume),
            oi: (!index).then_some(r.oi),
            trades: if index { None } else { row.trades },
        }
    }

    fn matches_binary(&self, record: &EodRecord, scale: u32) -> bool {
        if scale == 0 {
            return false;
        }
        let equal = |actual: i64, expected: i64| {
            i128::from(actual) * i128::from(DEFAULT_SCALE)
                == i128::from(expected) * i128::from(scale)
        };
        [record.open, record.high, record.low, record.close]
            .iter()
            .zip(self.ohlc)
            .all(|(&actual, expected)| equal(actual, expected))
            && self
                .previous_close
                .is_none_or(|v| equal(record.prev_close, v))
            && self.volume.is_none_or(|v| record.volume == v)
            && self.oi.is_none_or(|v| record.oi == v)
            && record.flags == 0
    }

    fn matches_sql(&self, row: &SqlBar) -> bool {
        let equal = |actual: f64, expected: i64| {
            actual.is_finite() && (actual * DEFAULT_SCALE as f64).round() == expected as f64
        };
        row.ohlc
            .iter()
            .zip(self.ohlc)
            .all(|(&actual, expected)| equal(actual, expected))
            && self
                .previous_close
                .is_none_or(|v| row.previous_close.is_some_and(|p| equal(p, v)))
            && row.volume >= 0
            && self.volume.is_none_or(|v| row.volume as u64 == v)
            && row.oi >= 0
            && self.oi.is_none_or(|v| row.oi as u64 == v)
            && self.trades.is_none_or(|v| row.trades == Some(v))
    }
}

#[derive(Clone, Debug)]
struct SqlBar {
    ohlc: [f64; 4],
    previous_close: Option<f64>,
    volume: i64,
    oi: i64,
    trades: Option<i64>,
}

// Each file is streamed once per planning/apply pass to establish strict order;
// later bounded windows reuse that structural check only while identity is unchanged.
// No per-date file opens, no assumption based on a sidecar's date bounds.
#[derive(Default)]
struct BinaryReader {
    validated: HashMap<PathBuf, (u64, SystemTime)>,
    opens: usize,
}

impl BinaryReader {
    fn read(
        &mut self,
        connection: &Connection,
        root: &Path,
        exchange: &str,
        symbol: &str,
        dates: &BTreeSet<u32>,
    ) -> AppResult<(u32, BTreeMap<u32, EodRecord>)> {
        if !safe_symbol(symbol) || !matches!(exchange, "NSE" | "BSE" | "NSE_INDEX" | "BSE_INDEX") {
            return Err(format!("Unsafe coverage identity {exchange}:{symbol}"));
        }
        let path = root
            .join("eod_data")
            .join(exchange)
            .join(format!("{symbol}.eod"));
        let metadata = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok((DEFAULT_SCALE, BTreeMap::new()))
            }
            Err(e) => return Err(e.to_string()),
        };
        if !metadata.file_type().is_file() {
            return Err(format!("Non-regular EOD file {}", path.display()));
        }
        let (file, handle) = BinaryEodFile::open_with_read_handle(&path)?;
        self.opens += 1;
        let header_symbol = String::from_utf8_lossy(&symbol.as_bytes()[..symbol.len().min(32)]);
        let owned = symbol.len() <= 32 || connection.query_row("SELECT EXISTS(SELECT 1 FROM instruments WHERE exchange=?1 AND symbol=?2 COLLATE BINARY)", params![exchange,symbol], |r| r.get::<_,bool>(0)).map_err(|e|e.to_string())?;
        if !owned
            || file.header.symbol.as_str() != &*header_symbol
            || file.header.exchange != exchange
            || file.header.price_scale == 0
            || metadata.len()
                != HEADER_SIZE as u64 + u64::from(file.header.record_count) * RECORD_SIZE as u64
        {
            return Err(format!(
                "EOD identity, scale or length mismatch: {}",
                path.display()
            ));
        }
        let modified = metadata.modified().map_err(|e| e.to_string())?;
        let stamp = (metadata.len(), modified);
        let mut selected = BTreeMap::new();
        if self.validated.get(&path) == Some(&stamp) {
            if let (Some(&first), Some(&last)) = (dates.first(), dates.last()) {
                let mut previous = None;
                for r in file.read_range_from(handle, first, last)? {
                    if !valid_date_number(r.date) || previous.is_some_and(|d| d >= r.date) {
                        return Err(format!("Invalid EOD ordering: {}", path.display()));
                    }
                    previous = Some(r.date);
                    if dates.contains(&r.date) {
                        selected.insert(r.date, r);
                    }
                }
            }
        } else {
            let mut records = file.forward_records_from(handle)?;
            while let Some(r) = records.next_record()? {
                if !valid_date_number(r.date) {
                    return Err(format!("Invalid EOD date: {}", path.display()));
                }
                if dates.contains(&r.date) {
                    selected.insert(r.date, r);
                }
            }
            self.validated.insert(path.clone(), stamp);
        }
        let after = fs::metadata(&path).map_err(|e| e.to_string())?;
        if after.len() != stamp.0 || after.modified().map_err(|e| e.to_string())? != stamp.1 {
            self.validated.remove(&path);
            return Err(format!(
                "EOD file changed during verification: {}",
                path.display()
            ));
        }
        Ok((file.header.price_scale, selected))
    }
}

fn sql_rows(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    dates: &BTreeSet<u32>,
) -> AppResult<BTreeMap<u32, SqlBar>> {
    let (Some(&first), Some(&last)) = (dates.first(), dates.last()) else {
        return Ok(BTreeMap::new());
    };
    let mut statement = connection.prepare_cached("SELECT date,open,high,low,close,prev_close,volume,open_interest,trades FROM eod_prices WHERE exchange=?1 AND symbol=?2 AND date BETWEEN ?3 AND ?4 ORDER BY date").map_err(|e|e.to_string())?;
    let rows = statement
        .query_map(
            params![exchange, symbol, u32_to_date(first), u32_to_date(last)],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    SqlBar {
                        ohlc: [r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?],
                        previous_close: r.get(5)?,
                        volume: r.get(6)?,
                        oi: r.get(7)?,
                        trades: r.get(8)?,
                    },
                ))
            },
        )
        .map_err(|e| e.to_string())?;
    let mut result = BTreeMap::new();
    for row in rows {
        let (date, bar) = row.map_err(|e| e.to_string())?;
        let date = date_to_u32(&date);
        if dates.contains(&date) && result.insert(date, bar).is_some() {
            return Err("Duplicate SQLite quotation".into());
        }
    }
    Ok(result)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Existing {
    Missing,
    Exact,
    Held,
}

// An alias-only NSE index can satisfy its canonical source identity. In Hybrid,
// require both physical and SQL representations before certifying a receipt.
// A one-sided Hybrid bar is preserved, not silently repaired by this task.
fn classify_group(
    connection: &Connection,
    root: &Path,
    reader: &mut BinaryReader,
    exchange: &str,
    symbol: &str,
    members: &BTreeMap<u32, Member>,
    hybrid: bool,
) -> AppResult<BTreeMap<u32, Existing>> {
    let dates = members.keys().copied().collect::<BTreeSet<_>>();
    let aliases = if exchange == "NSE_INDEX" {
        nse_index_alias_family(symbol)
            .map(|family| family.symbols.to_vec())
            .unwrap_or_else(|| vec![symbol])
    } else {
        vec![symbol]
    };
    let mut binary_seen = HashSet::new();
    let mut sql_seen = HashSet::new();
    let mut conflicts = HashSet::new();
    let mut alias_volumes = HashMap::<u32, u64>::new();
    for alias in aliases {
        let (scale, records) = reader.read(connection, root, exchange, alias, &dates)?;
        for (date, record) in records {
            binary_seen.insert(date);
            if exchange == "NSE_INDEX"
                && alias_volumes
                    .insert(date, record.volume)
                    .is_some_and(|prior| prior != record.volume)
            {
                conflicts.insert(date);
            }
            if !members[&date].matches_binary(&record, scale) {
                conflicts.insert(date);
            }
        }
        if hybrid {
            for (date, row) in sql_rows(connection, exchange, alias, &dates)? {
                sql_seen.insert(date);
                if exchange == "NSE_INDEX"
                    && row.volume >= 0
                    && alias_volumes
                        .insert(date, row.volume as u64)
                        .is_some_and(|prior| prior != row.volume as u64)
                {
                    conflicts.insert(date);
                }
                if !members[&date].matches_sql(&row) {
                    conflicts.insert(date);
                }
            }
        }
    }
    Ok(dates
        .into_iter()
        .map(|date| {
            let b = binary_seen.contains(&date);
            let s = sql_seen.contains(&date);
            let state = if conflicts.contains(&date) || (hybrid && b != s) {
                Existing::Held
            } else if b {
                Existing::Exact
            } else {
                Existing::Missing
            };
            (date, state)
        })
        .collect())
}

#[derive(Default, Clone, Debug)]
pub(super) struct GapOutcome {
    pub exact: usize,
    pub held: usize,
    pub details: Vec<String>,
}

/// Called under the existing canonical apply lease, after security admission,
/// before preparing the recovery journal. Forced repair never uses this filter.
/// NSE_INDEX uses its accepted alias-aware guard, not a second writer.
pub(super) fn guard_missing_only(
    database: &Path,
    files: &mut [ParsedBhavcopyFile],
) -> AppResult<BTreeMap<Job, GapOutcome>> {
    let connection =
        Connection::open_with_flags(database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
    let root = database.parent().ok_or("Missing database folder")?;
    let mode = get_price_storage_mode(&connection);
    let hybrid = mode == PriceStorageMode::Hybrid;
    let mut reader = BinaryReader::default();
    let mut groups = BTreeMap::<(String, String), Vec<(usize, usize)>>::new();
    for (fi, file) in files
        .iter()
        .enumerate()
        .filter(|(_, f)| f.exchange != "NSE_INDEX")
    {
        for (ri, row) in file.rows.iter().enumerate() {
            groups
                .entry((file.exchange.clone(), row.symbol.clone()))
                .or_default()
                .push((fi, ri));
        }
    }
    let mut masks = files
        .iter()
        .map(|f| vec![true; f.rows.len()])
        .collect::<Vec<_>>();
    let mut outcomes = BTreeMap::<Job, GapOutcome>::new();
    for ((exchange, symbol), positions) in groups {
        let mut members = BTreeMap::<u32, Member>::new();
        let mut contradictory = HashSet::new();
        for &(fi, ri) in &positions {
            let row = &files[fi].rows[ri];
            let member = Member::from_row(row, &exchange);
            if let Some(old) = members.insert(row.binary_record.date, member.clone()) {
                if old != member {
                    contradictory.insert(row.binary_record.date);
                }
            }
        }
        let classified = classify_group(
            &connection,
            root,
            &mut reader,
            &exchange,
            &symbol,
            &members,
            hybrid,
        )?;
        // Reproduce the existing stable per-symbol previous-close inference on
        // the original admitted batch, not on the smaller missing-only write set.
        let mut positions = positions;
        positions.sort_by_key(|&(fi, ri)| files[fi].rows[ri].binary_record.date);
        let mut inferred = BTreeMap::new();
        let mut prior_close = 0;
        for &(fi, ri) in &positions {
            let record = files[fi].rows[ri].binary_record;
            if record.prev_close == 0 && prior_close != 0 {
                inferred.insert((fi, ri), prior_close);
            }
            prior_close = record.close;
        }
        let mut accepted = HashSet::new();
        for (fi, ri) in positions {
            let row = &files[fi].rows[ri];
            let date = row.binary_record.date;
            let outcome = outcomes
                .entry((exchange.clone(), files[fi].trade_date.clone()))
                .or_default();
            if contradictory.contains(&date) || classified[&date] == Existing::Held {
                masks[fi][ri] = false;
                outcome.held += 1;
                if outcome.details.len() < 50 {
                    outcome.details.push(format!("{symbol}: conflicting source/store or Hybrid parity; existing prices preserved"));
                }
            } else if classified[&date] == Existing::Exact || !accepted.insert(date) {
                masks[fi][ri] = false;
                outcome.exact += 1;
            } else if let Some(previous) = inferred.get(&(fi, ri)) {
                files[fi].rows[ri].binary_record.prev_close = *previous;
            }
        }
    }
    if get_price_storage_mode(&connection) != mode {
        return Err("Storage mode changed during missing-only verification".into());
    }
    for (file, mask) in files.iter_mut().zip(masks) {
        let mut mask = mask.into_iter();
        file.rows.retain(|_| mask.next().expect("row mask length"));
        file.max_volume = file
            .rows
            .iter()
            .map(|r| r.volume.max(0) as u64)
            .max()
            .unwrap_or(0);
    }
    Ok(outcomes)
}

#[derive(Clone, Default, Debug)]
pub(super) struct SourceEvidence {
    pub archive_sha256: Option<String>,
    pub fallback_sha256: Vec<String>,
    pub held: usize,
    pub close_only: usize,
}

impl SourceEvidence {
    pub(super) fn note(
        &mut self,
        csv: &str,
        daily_archive: bool,
        rejected: &[super::parsers::IndexRejectedRow],
    ) {
        let sha = digest(csv.as_bytes());
        if daily_archive {
            self.archive_sha256 = Some(sha);
        } else {
            self.fallback_sha256.push(sha);
        }
        self.held += rejected.iter().filter(|r| !r.close_only).count();
        self.close_only += rejected.iter().filter(|r| r.close_only).count();
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct Receipt {
    schema: String,
    database_key: String,
    storage_mode: String,
    exchange: String,
    date: String,
    archive_sha256: Option<String>,
    fallback_sha256: Vec<String>,
    held: usize,
    close_only: usize,
    members: Vec<Member>,
    verified_members: usize,
    store_unresolved: usize,
    details: Vec<String>,
}

impl Receipt {
    fn complete_scope(&self) -> bool {
        self.archive_sha256
            .as_ref()
            .is_some_and(|sha| sha.len() == 64 && sha.bytes().all(|b| b.is_ascii_hexdigit()))
            && self.held == 0
            && self.store_unresolved == 0
            && !self.members.is_empty()
            && self.verified_members == self.members.len()
            && (self.exchange != "NSE_INDEX"
                || super::index_fallback::SUPPORTED
                    .iter()
                    .filter(|i| self.date.as_str() >= i.admitted_from)
                    .all(|i| self.members.iter().any(|m| m.symbol == i.symbol)))
    }
    pub(super) fn describe(&self) -> String {
        format!("{}; expected {} admitted source identities; matched {}; held {}; store unresolved {}; close-only unsupported {}; {}", if self.complete_scope(){"Daily OHLC archive scope matched (checkpoint required before reuse; not full-market certification)"}else{"Coverage unresolved / scoped subset"}, self.members.len(),self.verified_members,self.held,self.store_unresolved,self.close_only, self.details.iter().take(5).cloned().collect::<Vec<_>>().join("; "))
    }
    pub(super) fn is_complete_scope(&self) -> bool {
        self.complete_scope()
    }
    pub(super) fn count(&self) -> usize {
        self.verified_members
    }
    pub(super) fn max_volume(&self) -> u64 {
        self.members
            .iter()
            .filter_map(|m| m.volume)
            .max()
            .unwrap_or(0)
    }
    pub(super) fn hold(&mut self, held: usize, details: &[String]) {
        self.held += held;
        self.details.extend(details.iter().cloned());
    }
}

/// Capture source identities before additive filtering, so unchanged rows are not
/// lost from the proof merely because the writer correctly does no work.
pub(super) fn prepare_receipts(
    database: &Path,
    files: &[ParsedBhavcopyFile],
    source: &BTreeMap<Job, SourceEvidence>,
) -> AppResult<BTreeMap<Job, Receipt>> {
    let connection =
        Connection::open_with_flags(database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
    let key = CanonicalAccess::sqlite_key_for_file(database)?;
    let mode = get_price_storage_mode(&connection).as_str().to_string();
    let mut receipts = BTreeMap::new();
    for (job, evidence) in source {
        receipts.insert(
            job.clone(),
            Receipt {
                schema: SCHEMA.into(),
                database_key: key.clone(),
                storage_mode: mode.clone(),
                exchange: job.0.clone(),
                date: job.1.clone(),
                archive_sha256: evidence.archive_sha256.clone(),
                fallback_sha256: evidence.fallback_sha256.clone(),
                held: evidence.held,
                close_only: evidence.close_only,
                members: vec![],
                verified_members: 0,
                store_unresolved: 0,
                details: vec![],
            },
        );
    }
    for file in files {
        if let Some(receipt) = receipts.get_mut(&(file.exchange.clone(), file.trade_date.clone())) {
            let mut members = receipt
                .members
                .drain(..)
                .map(|m| (m.symbol.clone(), m))
                .collect::<BTreeMap<_, _>>();
            for row in &file.rows {
                let m = Member::from_row(row, &file.exchange);
                if let Some(old) = members.insert(m.symbol.clone(), m.clone()) {
                    if old != m {
                        receipt.held += 1;
                        receipt
                            .details
                            .push(format!("{}: conflicting source duplicates", m.symbol));
                    }
                }
            }
            receipt.members = members.into_values().collect();
        }
    }
    Ok(receipts)
}

/// Compare the complete pre-filter source scope with the physical store after
/// successful apply (or verified no-write). This must not invent success on
/// Hybrid one-sided rows, missing members, malformed files or alias conflicts.
pub(super) fn check_receipts(
    connection: &Connection,
    root: &Path,
    receipts: &mut BTreeMap<Job, Receipt>,
) {
    let mode = get_price_storage_mode(connection);
    let hybrid = mode == PriceStorageMode::Hybrid;
    let mut reader = BinaryReader::default();
    let mut by_exchange = BTreeMap::<String, Vec<String>>::new();
    for ((exchange, date), receipt) in receipts.iter_mut() {
        receipt.verified_members = 0;
        receipt.store_unresolved = receipt.members.len();
        by_exchange
            .entry(exchange.clone())
            .or_default()
            .push(date.clone());
    }
    for (exchange, dates) in by_exchange {
        let mut remaining = dates.as_slice();
        while let Some(first) = remaining.first() {
            let cutoff = match parse_trade_date(first) {
                Ok(date) => date + Duration::days(WINDOW_DAYS - 1),
                Err(_) => break,
            }
            .format("%Y-%m-%d")
            .to_string();
            let length = remaining.partition_point(|date| date <= &cutoff).max(1);
            let (window, rest) = remaining.split_at(length);
            remaining = rest;
            let mut groups = BTreeMap::<String, BTreeMap<u32, Member>>::new();
            for date in window {
                if let Some(receipt) = receipts.get(&(exchange.clone(), date.clone())) {
                    for member in &receipt.members {
                        groups
                            .entry(member.symbol.clone())
                            .or_default()
                            .insert(date_to_u32(date), member.clone());
                    }
                }
            }
            for (symbol, members) in groups {
                match classify_group(
                    connection,
                    root,
                    &mut reader,
                    &exchange,
                    &symbol,
                    &members,
                    hybrid,
                ) {
                    Ok(states) => {
                        for (number, state) in states {
                            if let Some(receipt) =
                                receipts.get_mut(&(exchange.clone(), u32_to_date(number)))
                            {
                                if state == Existing::Exact {
                                    receipt.verified_members += 1;
                                    receipt.store_unresolved -= 1;
                                } else if receipt.details.len() < 50 {
                                    receipt
                                        .details
                                        .push(format!("{symbol}: current source member {state:?}"));
                                }
                            }
                        }
                    }
                    Err(error) => {
                        for number in members.keys() {
                            if let Some(receipt) =
                                receipts.get_mut(&(exchange.clone(), u32_to_date(*number)))
                            {
                                if receipt.details.len() < 50 {
                                    receipt.details.push(format!(
                                        "{symbol}: physical verification failed: {error}"
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    // Never reuse proof obtained while the storage representation changed.
    if get_price_storage_mode(connection) != mode {
        for receipt in receipts.values_mut() {
            receipt.verified_members = 0;
            receipt.store_unresolved = receipt.members.len();
            receipt
                .details
                .push("Storage mode changed during receipt verification".into());
        }
    }
}

// Main metadata DB owns this small, versioned, per-session-date source receipt.
// Creation is additive/lazy; legacy databases are not rewritten by planning.
// Pending receipts are NEVER eligible for skipping until the existing journal
// checkpoint path explicitly promotes their session. A lost receipt is a retry,
// not a data repair or an authority to trust a legacy success marker.
pub(super) fn save_receipts(
    connection: &Connection,
    receipts: &BTreeMap<Job, Receipt>,
    session: Option<&str>,
) -> AppResult<()> {
    if receipts.is_empty() {
        return Ok(());
    }
    connection.execute_batch("CREATE TABLE IF NOT EXISTS bhavcopy_coverage_v1(exchange TEXT NOT NULL, trade_date TEXT NOT NULL, receipt_json TEXT NOT NULL, receipt_sha256 TEXT NOT NULL, pending_session TEXT, PRIMARY KEY(exchange,trade_date));").map_err(|e|e.to_string())?;
    let transaction = connection
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    let mut statement = transaction.prepare_cached("INSERT INTO bhavcopy_coverage_v1(exchange,trade_date,receipt_json,receipt_sha256,pending_session) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(exchange,trade_date) DO UPDATE SET receipt_json=excluded.receipt_json,receipt_sha256=excluded.receipt_sha256,pending_session=excluded.pending_session").map_err(|e|e.to_string())?;
    for ((exchange, date), receipt) in receipts {
        let json = serde_json::to_string(receipt).map_err(|e| e.to_string())?;
        if json.len() > MAX_RECEIPT_BYTES || receipt.members.len() > MAX_MEMBERS {
            return Err("Coverage receipt exceeds evidence limit".into());
        }
        statement
            .execute(params![
                exchange,
                date,
                json,
                digest(json.as_bytes()),
                session
            ])
            .map_err(|e| e.to_string())?;
    }
    drop(statement);
    transaction.commit().map_err(|e| e.to_string())
}

pub(super) fn checkpoint_receipts(database: &Path, session: &str) -> AppResult<()> {
    let connection = super::ingestion::open_database_connection(database)?;
    if table_exists(&connection, "bhavcopy_coverage_v1")? {
        // The persisted receipt embeds the physical SQLite key, revalidated by
        // the planner. A copied/replaced database cannot authorize skipping.
        connection
            .execute(
                "UPDATE bhavcopy_coverage_v1 SET pending_session=NULL WHERE pending_session=?1",
                [session],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Load only checkpointed, identity-bound, content-hash-verified receipts.
/// Validate every expected source member against physical records, in bounded
/// calendar windows. A corrupt/missing proof or file is never a successful skip.
pub(super) fn verified_dates(
    connection: &Connection,
    exchange: &str,
    from: &str,
    to: &str,
) -> AppResult<ImportedTradeDates> {
    let started = Instant::now();
    let mut result = ImportedTradeDates::default();
    let Some(database) = database_path(connection)? else {
        return Ok(result);
    };
    let Some(root) = connection_database_folder(connection)? else {
        return Ok(result);
    };
    if !table_exists(connection, "bhavcopy_coverage_v1")? {
        return Ok(result);
    }
    let key = CanonicalAccess::sqlite_key_for_file(&database)?;
    let storage_mode = get_price_storage_mode(connection);
    let mode = storage_mode.as_str();
    let hybrid = storage_mode == PriceStorageMode::Hybrid;
    let mut start = parse_trade_date(from)?;
    let end = parse_trade_date(to)?;
    let mut reader = BinaryReader::default();
    while start <= end {
        let stop = (start + Duration::days(WINDOW_DAYS - 1)).min(end);
        let mut stmt = connection.prepare("SELECT trade_date,receipt_json,receipt_sha256 FROM bhavcopy_coverage_v1 WHERE exchange=?1 AND trade_date BETWEEN ?2 AND ?3 AND pending_session IS NULL ORDER BY trade_date").map_err(|e|e.to_string())?;
        let rows = stmt
            .query_map(
                params![
                    exchange,
                    start.format("%Y-%m-%d").to_string(),
                    stop.format("%Y-%m-%d").to_string()
                ],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                    ))
                },
            )
            .map_err(|e| e.to_string())?;
        let mut candidates = BTreeMap::<u32, String>::new();
        let mut groups = BTreeMap::<String, BTreeMap<u32, Member>>::new();
        let mut invalid = HashSet::new();
        for row in rows {
            let (date, json, sha) = row.map_err(|e| e.to_string())?;
            if json.len() > MAX_RECEIPT_BYTES || digest(json.as_bytes()) != sha {
                continue;
            }
            let Ok(receipt) = serde_json::from_str::<Receipt>(&json) else {
                continue;
            };
            if receipt.schema != SCHEMA
                || receipt.database_key != key
                || receipt.storage_mode != mode
                || receipt.exchange != exchange
                || receipt.date != date
                || !receipt.complete_scope()
                || receipt.members.len() > MAX_MEMBERS
            {
                continue;
            }
            let Ok(parsed_date) = parse_trade_date(&date) else {
                continue;
            };
            if parsed_date.format("%Y-%m-%d").to_string() != date {
                continue;
            }
            let number = date_to_u32(&date);
            candidates.insert(number, date);
            for member in receipt.members {
                if !safe_symbol(&member.symbol)
                    || groups
                        .entry(member.symbol.clone())
                        .or_default()
                        .insert(number, member)
                        .is_some()
                {
                    invalid.insert(number);
                }
            }
        }
        result.binary_reconcile_target_dates += candidates.len();
        for (symbol, members) in groups {
            match classify_group(
                connection,
                &root,
                &mut reader,
                exchange,
                &symbol,
                &members,
                hybrid,
            ) {
                Ok(states) => {
                    for (date, state) in states {
                        if state != Existing::Exact {
                            invalid.insert(date);
                        }
                    }
                }
                Err(_) => invalid.extend(members.keys().copied()),
            }
        }
        for (number, date) in candidates {
            if !invalid.contains(&number) {
                result.dates.insert(date);
            } else {
                result.metadata_only_dates += 1;
            }
        }
        start = stop + Duration::days(1);
    }
    if get_price_storage_mode(connection) != storage_mode {
        return Err("Storage mode changed during coverage planning".into());
    }
    result.binary_reconcile_files_scanned = reader.opens;
    result.binary_reconcile_ms = started.elapsed().as_millis();
    Ok(result)
}

#[derive(Default)]
pub(super) struct RetryPlan {
    pub dates: BTreeSet<String>,
    pub deferred: usize,
    pub outside_window: usize,
}

/// Earlier dates are considered independently of the successful high-water mark.
/// Fair oldest-attempt-first ordering plus deterministic date tie-break and cooldown.
/// Explicit Range remains available for all dates outside automatic scope.
pub(super) fn update_retries(
    connection: &Connection,
    exchange: &str,
    end: &str,
    now: i64,
    verified: &HashSet<String>,
) -> AppResult<RetryPlan> {
    let Some(latest) = storage_mode_get_latest_imported_trade_date(connection, exchange)? else {
        return Ok(RetryPlan::default());
    };
    let upper = parse_trade_date(&latest)?.min(parse_trade_date(end)?);
    let floor = (parse_trade_date(end)? - Duration::days(RETRY_LOOKBACK_DAYS - 1))
        .max(parse_trade_date(full_history_start_for_exchange(exchange))?);
    let floor_str = floor.format("%Y-%m-%d").to_string();
    let upper_str = upper.format("%Y-%m-%d").to_string();
    let attempts_available = table_exists(connection, "bhavcopy_download_attempts")?;
    // Only consider history at or after a known attempted/imported session;
    // a first successful recent import does not implicitly authorize decades of downloads.
    let mut first: Option<String> = connection
        .query_row(
            "SELECT MIN(trade_date) FROM download_log WHERE exchange=?1 AND length(trade_date)=10",
            [exchange],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if attempts_available {
        let attempted:Option<String> = connection.query_row("SELECT MIN(trade_date) FROM bhavcopy_download_attempts WHERE exchange=?1 AND length(trade_date)=10 AND outcome<>'cancelled'",[exchange],|r|r.get(0)).map_err(|e|e.to_string())?;
        if let Some(attempted) = attempted {
            first = Some(first.map_or(attempted.clone(), |v| v.min(attempted)));
        }
    }
    let start = first
        .as_deref()
        .and_then(|s| parse_trade_date(s).ok())
        .unwrap_or(upper)
        .max(floor);
    let outside_window:usize = connection.query_row("SELECT COUNT(*) FROM download_log WHERE exchange=?1 AND length(trade_date)=10 AND trade_date<?2 AND status IN ('error','partial')",params![exchange,floor_str],|r|r.get::<_,i64>(0)).map_err(|e|e.to_string())?.max(0) as usize;
    let mut plan = RetryPlan {
        outside_window,
        ..Default::default()
    };
    if start > upper {
        return Ok(plan);
    }
    let mut legacy = HashMap::<String, i64>::new();
    let mut stmt = connection.prepare("SELECT trade_date,COALESCE(CAST(strftime('%s',downloaded_at) AS INTEGER),0) FROM download_log WHERE exchange=?1 AND trade_date BETWEEN ?2 AND ?3").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map(params![exchange, floor_str, upper_str], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (date, stamp) = row.map_err(|e| e.to_string())?;
        legacy.insert(date, stamp);
    }
    let mut attempts = HashMap::<String, (i64, String)>::new();
    if attempts_available {
        let mut stmt=connection.prepare("SELECT trade_date,COALESCE(CAST(strftime('%s',attempted_at) AS INTEGER),0),outcome FROM bhavcopy_download_attempts WHERE exchange=?1 AND trade_date BETWEEN ?2 AND ?3 AND outcome<>'cancelled'").map_err(|e|e.to_string())?;
        let rows = stmt
            .query_map(params![exchange, floor_str, upper_str], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (date, stamp, outcome) = row.map_err(|e| e.to_string())?;
            attempts.insert(date, (stamp, outcome));
        }
    }
    let mut eligible = Vec::new();
    for date in generate_calendar_days(&start.format("%Y-%m-%d").to_string(), &upper_str)? {
        if verified.contains(&date) {
            continue;
        }
        let special = is_special_trading_day(exchange, &date);
        if !special
            && matches!(
                parse_trade_date(&date)?.weekday(),
                Weekday::Sat | Weekday::Sun
            )
        {
            continue;
        }
        let attempt = attempts.get(&date);
        // Confirmed absence + saved holiday is diagnostic evidence for retry
        // scheduling only; it never suppresses an explicit date-range request.
        let holiday_absence = !special
            && attempt.is_some_and(|(_, outcome)| outcome == "confirmedAbsent")
            && get_exchange_holiday_name(connection, exchange, &date)?.is_some();
        let cooldown = if holiday_absence {
            7 * RETRY_COOLDOWN_SECS
        } else {
            RETRY_COOLDOWN_SECS
        };
        let stamp = attempt
            .map(|(stamp, _)| *stamp)
            .or_else(|| legacy.get(&date).copied())
            .unwrap_or(0);
        if stamp > now.saturating_sub(cooldown) {
            plan.deferred += 1;
            continue;
        }
        eligible.push((stamp, date));
    }
    eligible.sort();
    plan.deferred += eligible.len().saturating_sub(RETRY_CAP);
    plan.dates = eligible
        .into_iter()
        .take(RETRY_CAP)
        .map(|(_, date)| date)
        .collect();
    Ok(plan)
}

pub(super) fn retry_window_start(end: &str) -> AppResult<String> {
    Ok(
        (parse_trade_date(end)? - Duration::days(RETRY_LOOKBACK_DAYS - 1))
            .format("%Y-%m-%d")
            .to_string(),
    )
}
pub(super) fn now_timestamp() -> i64 {
    Utc::now().timestamp()
}

#[cfg(test)]
mod tests;
