use super::database_use::{CanonicalAccess, CanonicalWriterIntent};
use crate::database::{
    path_to_string, resolve_active_database_folder, with_active_connection, AppResult,
};
use rusqlite::params;
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use tauri::AppHandle;

#[cfg(test)]
std::thread_local! {
    static V17A_TEST_SYNC_DATA_CALLS: std::cell::Cell<usize> = std::cell::Cell::new(0);
}

fn is_transient_windows_io_error(err: &std::io::Error) -> bool {
    matches!(err.raw_os_error(), Some(32) | Some(5))
        || err.kind() == std::io::ErrorKind::PermissionDenied
}

fn retry_fs_op<T, F: FnMut() -> std::io::Result<T>>(mut op: F) -> std::io::Result<T> {
    let mut delay_ms = 2_u64;
    for attempt in 0..8 {
        match op() {
            Ok(val) => return Ok(val),
            Err(err) if attempt < 7 && is_transient_windows_io_error(&err) => {
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                delay_ms = (delay_ms * 2).min(40);
            }
            Err(err) => return Err(err),
        }
    }
    op()
}

fn open_ro_with_retry<P: AsRef<Path>>(path: P) -> std::io::Result<File> {
    let p = path.as_ref();
    retry_fs_op(|| File::open(p))
}

fn open_rw_with_retry<P: AsRef<Path>>(path: P) -> std::io::Result<File> {
    let p = path.as_ref();
    retry_fs_op(|| fs::OpenOptions::new().read(true).write(true).open(p))
}

fn rename_with_retry<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> std::io::Result<()> {
    let f = from.as_ref();
    let t = to.as_ref();
    retry_fs_op(|| fs::rename(f, t))
}

fn sync_data_with_v17a_test_probe(file: &File) -> std::io::Result<()> {
    #[cfg(test)]
    V17A_TEST_SYNC_DATA_CALLS.with(|calls| calls.set(calls.get().saturating_add(1)));
    file.sync_data()
}

#[cfg(test)]
fn v17a_test_reset_sync_data_calls() {
    V17A_TEST_SYNC_DATA_CALLS.with(|calls| calls.set(0));
}

#[cfg(test)]
fn v17a_test_sync_data_calls() -> usize {
    V17A_TEST_SYNC_DATA_CALLS.with(|calls| calls.get())
}

/// Version 1 of the Binary EOD File Format.
///
/// Header (128 bytes):
/// - 0..4: Magic "EOD1"
/// - 4..6: Version (u16)
/// - 6..8: Record size (u16, always 64)
/// - 8..12: Record count (u32)
/// - 12..16: Price scale (u32)
/// - 16..48: Symbol (32 bytes, null-padded)
/// - 48..64: Exchange (16 bytes, null-padded)
/// - 64..128: Reserved (64 bytes)
///
/// Record (64 bytes):
/// - 0..4: Date (u32, YYYYMMDD)
/// - 4..8: Flags (u32)
/// - 8..16: Open (i64, scaled)
/// - 16..24: High (i64, scaled)
/// - 24..32: Low (i64, scaled)
/// - 32..40: Close (i64, scaled)
/// - 40..48: Prev Close (i64, scaled)
/// - 48..56: Volume (u64)
/// - 56..64: Open Interest (u64)

pub const HEADER_SIZE: usize = 128;
pub const RECORD_SIZE: usize = 64;
pub const MAGIC: &[u8; 4] = b"EOD1";
pub const CURRENT_VERSION: u16 = 1;
pub const DEFAULT_SCALE: u32 = 10000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinarySymbolStats {
    pub symbol: String,
    pub exchange: String,
    pub count: u32,
    pub first_date: u32,
    pub last_date: u32,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub success: bool,
    pub symbols_processed: u32,
    pub symbols_written: u32,
    pub records_written: u64,
    pub symbols_skipped: u32,
    pub errors: Vec<String>,
    pub output_folder: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryEodStatus {
    pub exists: bool,
    pub symbol: String,
    pub exchange: String,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub record_count: u64,
    pub first_date: Option<String>,
    pub last_date: Option<String>,
    pub scale: u32,
    pub version: u32,
    pub has_oi: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ParityIssueType {
    BinaryMissing,
    CountMismatch,
    DateRangeMismatch,
    FileCorrupt,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParityIssue {
    pub symbol: String,
    pub exchange: String,
    pub issue_type: ParityIssueType,
    pub sqlite_count: u32,
    pub binary_count: u32,
    pub sqlite_first_date: Option<String>,
    pub sqlite_last_date: Option<String>,
    pub binary_first_date: Option<String>,
    pub binary_last_date: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub success: bool,
    pub symbols_processed: u32,
    pub issues_found: u32,
    pub issues: Vec<ParityIssue>,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EodHeader {
    pub version: u16,
    pub record_count: u32,
    pub price_scale: u32,
    pub symbol: String,
    pub exchange: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EodRecord {
    pub date: u32,
    pub flags: u32,
    pub open: i64,
    pub high: i64,
    pub low: i64,
    pub close: i64,
    pub prev_close: i64,
    pub volume: u64,
    pub oi: u64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct BinaryAppendMergeStats {
    pub inserted_dates: Vec<u32>,
    pub changed_existing_dates: Vec<u32>,
    pub unchanged_existing_dates: Vec<u32>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum BinaryWritePath {
    #[default]
    NoOp,
    NewFile,
    AppendNewest,
    RewriteTail,
    UpdateExisting,
    InsertHistorical,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum BinaryWriteDurability {
    #[default]
    Immediate,
    RecoveryJournalBuffered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BinaryAppendNewestHint {
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub file_mtime_ns: i64,
    pub last_date: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BinaryWriteDiagnostics {
    pub path: BinaryWritePath,
    pub total_us: u128,
    pub exists_us: u128,
    pub open_us: u128,
    pub header_read_us: u128,
    pub last_date_read_us: u128,
    pub sort_us: u128,
    pub lookup_us: u128,
    pub tail_read_us: u128,
    pub new_file_write_us: u128,
    pub seek_us: u128,
    pub data_write_us: u128,
    pub byte_shift_us: u128,
    pub set_len_us: u128,
    pub header_write_us: u128,
    pub flush_us: u128,
    pub flush_calls: usize,
    pub sync_data_us: u128,
    pub sync_data_calls: usize,
    pub deferred_sync_calls: usize,
    pub append_newest_fast_candidates: usize,
    pub append_newest_fast_trusted: usize,
    pub append_newest_fast_fast: usize,
    pub append_newest_fast_fallback: usize,
    pub append_newest_fast_metadata_changed: usize,
    pub append_newest_fast_not_newest: usize,
    pub append_newest_fast_state_mismatch: usize,
    pub header_classification_reads: usize,
    pub last_date_classification_reads: usize,
}

impl BinaryWriteDiagnostics {
    fn add_prefix(&mut self, prefix: &Self) {
        self.exists_us += prefix.exists_us;
        self.open_us += prefix.open_us;
        self.header_read_us += prefix.header_read_us;
        self.last_date_read_us += prefix.last_date_read_us;
        self.sort_us += prefix.sort_us;
        self.append_newest_fast_candidates += prefix.append_newest_fast_candidates;
        self.append_newest_fast_trusted += prefix.append_newest_fast_trusted;
        self.append_newest_fast_fast += prefix.append_newest_fast_fast;
        self.append_newest_fast_fallback += prefix.append_newest_fast_fallback;
        self.append_newest_fast_metadata_changed += prefix.append_newest_fast_metadata_changed;
        self.append_newest_fast_not_newest += prefix.append_newest_fast_not_newest;
        self.append_newest_fast_state_mismatch += prefix.append_newest_fast_state_mismatch;
        self.header_classification_reads += prefix.header_classification_reads;
        self.last_date_classification_reads += prefix.last_date_classification_reads;
    }
}

#[derive(Debug)]
pub struct BinaryAppendMergeResult {
    pub file: BinaryEodFile,
    pub stats: BinaryAppendMergeStats,
    pub diagnostics: BinaryWriteDiagnostics,
}

#[derive(Debug)]
pub struct BinaryEodFile {
    pub path: PathBuf,
    pub header: EodHeader,
}

pub(crate) struct ForwardBinaryRecords {
    reader: std::io::BufReader<File>,
    remaining: u32,
    last_date: Option<u32>,
}

impl ForwardBinaryRecords {
    pub(crate) fn next_record(&mut self) -> AppResult<Option<EodRecord>> {
        if self.remaining == 0 {
            return Ok(None);
        }
        let mut buffer = [0; RECORD_SIZE];
        self.reader
            .read_exact(&mut buffer)
            .map_err(|error| error.to_string())?;
        let record = decode_record(&buffer);
        if self.last_date.is_some_and(|last| record.date <= last) {
            return Err(
                "Canonical binary history contains a duplicate or out-of-order date.".into(),
            );
        }
        self.last_date = Some(record.date);
        self.remaining -= 1;
        Ok(Some(record))
    }
}

impl BinaryEodFile {
    pub(crate) fn forward_records(&self) -> AppResult<ForwardBinaryRecords> {
        let mut file = open_ro_with_retry(&self.path).map_err(|error| error.to_string())?;
        let count = self.header.record_count;
        let expected = HEADER_SIZE as u64 + u64::from(count) * RECORD_SIZE as u64;
        if file.metadata().map_err(|error| error.to_string())?.len() != expected {
            return Err("Canonical binary history length disagrees with its header.".into());
        }
        file.seek(SeekFrom::Start(HEADER_SIZE as u64))
            .map_err(|error| error.to_string())?;
        Ok(ForwardBinaryRecords {
            reader: std::io::BufReader::new(file),
            remaining: count,
            last_date: None,
        })
    }

    /// Opens an existing binary EOD file.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let mut file = open_ro_with_retry(&path).map_err(|e| e.to_string())?;
        let header = Self::read_header(&mut file)?;
        Ok(Self {
            path: path.as_ref().to_path_buf(),
            header,
        })
    }

    /// Reads all records from the file.
    pub fn read_all(&self) -> Result<Vec<EodRecord>, String> {
        self.read_range(0, 99999999)
    }

    /// Reads the latest N records from the file.
    pub fn read_latest(&self, n: usize) -> Result<Vec<EodRecord>, String> {
        let mut file = open_ro_with_retry(&self.path).map_err(|e| e.to_string())?;
        let total_records = self.header.record_count as usize;

        if total_records == 0 {
            return Ok(Vec::new());
        }

        let n = n.min(total_records);
        let start_idx = total_records - n;

        file.seek(SeekFrom::Start(
            (HEADER_SIZE + start_idx * RECORD_SIZE) as u64,
        ))
        .map_err(|e| e.to_string())?;

        let mut records = Vec::with_capacity(n);
        for _ in 0..n {
            let mut buf = [0u8; RECORD_SIZE];
            file.read_exact(&mut buf).map_err(|e| e.to_string())?;
            records.push(decode_record(&buf));
        }

        Ok(records)
    }

    /// Reads records within a specific date range (inclusive).
    /// Uses binary search to find the start of the range.
    pub fn read_range(&self, start_date: u32, end_date: u32) -> Result<Vec<EodRecord>, String> {
        let mut file = open_ro_with_retry(&self.path).map_err(|e| e.to_string())?;
        let total_records = self.header.record_count as usize;

        if total_records == 0 {
            return Ok(Vec::new());
        }

        // Binary search for the first record >= start_date
        let mut low = 0;
        let mut high = total_records - 1;
        let mut first_index = None;

        while low <= high {
            let mid = low + (high - low) / 2;
            let date = self.read_date_at(&mut file, mid)?;

            if date >= start_date {
                first_index = Some(mid);
                if mid == 0 {
                    break;
                }
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        let Some(start_idx) = first_index else {
            return Ok(Vec::new());
        };

        // Read records until end_date or EOF
        let mut records = Vec::new();
        file.seek(SeekFrom::Start(
            (HEADER_SIZE + start_idx * RECORD_SIZE) as u64,
        ))
        .map_err(|e| e.to_string())?;

        for _ in start_idx..total_records {
            let mut buf = [0u8; RECORD_SIZE];
            file.read_exact(&mut buf).map_err(|e| e.to_string())?;
            let record = decode_record(&buf);

            if record.date > end_date {
                break;
            }
            records.push(record);
        }

        Ok(records)
    }

    /// Reads at most `limit` records, taking the **newest** ones within
    /// `start_date..=end_date`.
    ///
    /// Genuinely bounded: it binary-searches the range bounds and seeks straight to the
    /// window start, so a 30-year file costs the same handful of reads as a 30-day one.
    /// The oldest records in the range are never decoded or materialized.
    pub fn read_range_bounded(
        &self,
        start_date: u32,
        end_date: u32,
        limit: usize,
    ) -> Result<Vec<EodRecord>, String> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        let total_records = self.header.record_count as usize;
        if total_records == 0 {
            return Ok(Vec::new());
        }
        let mut file = open_ro_with_retry(&self.path).map_err(|e| e.to_string())?;

        // First record with date >= start_date (the same lower bound `read_range` uses).
        let range_start = match self.lower_bound(&mut file, total_records, start_date)? {
            Some(index) => index,
            None => return Ok(Vec::new()),
        };
        // First record with date > end_date, i.e. the exclusive end of the range.
        let range_end =
            match self.lower_bound(&mut file, total_records, end_date.saturating_add(1))? {
                Some(index) => index,
                None => total_records,
            };
        if range_end <= range_start {
            return Ok(Vec::new());
        }

        // Newest `limit` records of the [range_start, range_end) range.
        let start_idx = range_end.saturating_sub(limit).max(range_start);
        let count = range_end - start_idx;

        file.seek(SeekFrom::Start(
            (HEADER_SIZE + start_idx * RECORD_SIZE) as u64,
        ))
        .map_err(|e| e.to_string())?;

        let mut records = Vec::with_capacity(count);
        for _ in 0..count {
            let mut buf = [0u8; RECORD_SIZE];
            file.read_exact(&mut buf).map_err(|e| e.to_string())?;
            records.push(decode_record(&buf));
        }
        Ok(records)
    }

    /// Index of the first record whose date is `>= target`, or `None` when every record
    /// is older. Binary search over the on-disk date column.
    fn lower_bound(
        &self,
        file: &mut File,
        total_records: usize,
        target: u32,
    ) -> Result<Option<usize>, String> {
        if total_records == 0 {
            return Ok(None);
        }
        let mut low = 0usize;
        let mut high = total_records - 1;
        let mut found = None;
        while low <= high {
            let mid = low + (high - low) / 2;
            let date = self.read_date_at(file, mid)?;
            if date >= target {
                found = Some(mid);
                if mid == 0 {
                    break;
                }
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        Ok(found)
    }

    /// Returns incoming records that are not already present by date, plus the count skipped.
    /// Incoming records are sorted by date before checking.
    pub fn filter_records_against_existing(
        &self,
        mut incoming: Vec<EodRecord>,
    ) -> Result<(Vec<EodRecord>, usize), String> {
        if incoming.is_empty() {
            return Ok((Vec::new(), 0));
        }

        incoming.sort_by_key(|record| record.date);
        if self.header.record_count == 0 {
            return Ok((incoming, 0));
        }

        let mut file = File::open(&self.path).map_err(|e| e.to_string())?;
        let first_date = self.read_date_at(&mut file, 0)?;
        let last_date = self.read_date_at(&mut file, (self.header.record_count - 1) as usize)?;
        let incoming_first = incoming
            .first()
            .map(|record| record.date)
            .unwrap_or(first_date);
        let incoming_last = incoming
            .last()
            .map(|record| record.date)
            .unwrap_or(last_date);

        if incoming_last < first_date || incoming_first > last_date {
            return Ok((incoming, 0));
        }

        let overlap_start = incoming_first.max(first_date);
        let overlap_end = incoming_last.min(last_date);
        let overlap_start_index = self.lower_bound_date(&mut file, overlap_start)?;
        let overlap_end_index = self.upper_bound_date(&mut file, overlap_end)?;

        if overlap_start_index >= overlap_end_index {
            return Ok((incoming, 0));
        }

        let overlap_count = overlap_end_index - overlap_start_index;
        let existing_dates =
            self.read_date_window(&mut file, overlap_start_index, overlap_count)?;
        if existing_dates.is_empty() {
            return Ok((incoming, 0));
        }

        let incoming_dates = incoming
            .iter()
            .map(|record| record.date)
            .collect::<Vec<_>>();
        if overlap_count == incoming_dates.len() && existing_dates == incoming_dates {
            return Ok((Vec::new(), incoming.len()));
        }

        let mut filtered = Vec::with_capacity(incoming.len());
        let mut skipped = 0_usize;
        let mut existing_index = 0_usize;
        for record in incoming {
            while existing_index < existing_dates.len()
                && existing_dates[existing_index] < record.date
            {
                existing_index += 1;
            }

            if existing_index < existing_dates.len()
                && existing_dates[existing_index] == record.date
            {
                skipped += 1;
            } else {
                filtered.push(record);
            }
        }

        Ok((filtered, skipped))
    }

    /// Writes all records to the file atomically.
    /// Sorts records by date before writing.
    pub fn write_all<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        records: &mut [EodRecord],
    ) -> Result<Self, String> {
        let (file, _) =
            Self::write_all_with_sync_timing(path, symbol, exchange, price_scale, records)?;
        Ok(file)
    }

    fn write_all_with_sync_timing<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        records: &mut [EodRecord],
    ) -> Result<(Self, u128), String> {
        records.sort_by_key(|r| r.date);

        if let Some(parent) = path.as_ref().parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let temp_path = path.as_ref().with_extension("tmp");
        super::storage_paths::check_sibling(&temp_path)?;
        let sync_data_us;
        {
            let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;

            // Write Header
            let mut header_buf = [0u8; HEADER_SIZE];
            header_buf[0..4].copy_from_slice(MAGIC);
            header_buf[4..6].copy_from_slice(&CURRENT_VERSION.to_le_bytes());
            header_buf[6..8].copy_from_slice(&(RECORD_SIZE as u16).to_le_bytes());
            header_buf[8..12].copy_from_slice(&(records.len() as u32).to_le_bytes());
            header_buf[12..16].copy_from_slice(&price_scale.to_le_bytes());

            let sym_bytes = symbol.as_bytes();
            let sym_len = sym_bytes.len().min(32);
            header_buf[16..16 + sym_len].copy_from_slice(&sym_bytes[..sym_len]);

            let ex_bytes = exchange.as_bytes();
            let ex_len = ex_bytes.len().min(16);
            header_buf[48..48 + ex_len].copy_from_slice(&ex_bytes[..ex_len]);

            file.write_all(&header_buf).map_err(|e| e.to_string())?;

            // Write Records
            for record in records.iter() {
                file.write_all(&encode_record(record))
                    .map_err(|e| e.to_string())?;
            }

            file.flush().map_err(|e| e.to_string())?;
            // V1.7A: a newly materialized/full-rewrite temp file must cross an
            // explicit durability barrier before it can be renamed into place.
            // This is required even when the caller is using recovery-journal
            // buffering because only APPEND_NEWEST files participate in the
            // deferred checkpoint worker pool.
            let sync_started = Instant::now();
            sync_data_with_v17a_test_probe(&file).map_err(|e| e.to_string())?;
            sync_data_us = sync_started.elapsed().as_micros().max(1);
        }

        rename_with_retry(&temp_path, &path).map_err(|e| e.to_string())?;

        Ok((
            Self {
                path: path.as_ref().to_path_buf(),
                header: EodHeader {
                    version: CURRENT_VERSION,
                    record_count: records.len() as u32,
                    price_scale,
                    symbol: symbol.to_string(),
                    exchange: exchange.to_string(),
                },
            },
            sync_data_us,
        ))
    }

    /// Appends new records or merges them if they overlap with existing data.
    pub fn append_or_merge_records<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        new_records: Vec<EodRecord>,
    ) -> Result<Self, String> {
        Self::append_or_merge_records_with_stats(path, symbol, exchange, price_scale, new_records)
            .map(|result| result.file)
    }

    pub fn append_or_merge_records_with_stats<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        new_records: Vec<EodRecord>,
    ) -> Result<BinaryAppendMergeResult, String> {
        Self::append_or_merge_records_with_stats_durability(
            path,
            symbol,
            exchange,
            price_scale,
            new_records,
            BinaryWriteDurability::Immediate,
        )
    }

    pub fn append_or_merge_records_with_stats_durability<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        new_records: Vec<EodRecord>,
        durability: BinaryWriteDurability,
    ) -> Result<BinaryAppendMergeResult, String> {
        Self::append_or_merge_records_with_stats_durability_hint(
            path,
            symbol,
            exchange,
            price_scale,
            new_records,
            durability,
            None,
        )
    }

    pub fn append_or_merge_records_with_stats_durability_hint<P: AsRef<Path>>(
        path: P,
        symbol: &str,
        exchange: &str,
        price_scale: u32,
        new_records: Vec<EodRecord>,
        durability: BinaryWriteDurability,
        append_newest_hint: Option<BinaryAppendNewestHint>,
    ) -> Result<BinaryAppendMergeResult, String> {
        let total_started = Instant::now();
        let path_ref = path.as_ref();
        let mut diagnostics = BinaryWriteDiagnostics::default();

        if new_records.is_empty() {
            let exists_started = Instant::now();
            let exists = path_ref.exists();
            diagnostics.exists_us += exists_started.elapsed().as_micros();
            if exists {
                let open_started = Instant::now();
                let file = Self::open(path_ref)?;
                diagnostics.open_us += open_started.elapsed().as_micros();
                diagnostics.path = BinaryWritePath::NoOp;
                diagnostics.total_us = total_started.elapsed().as_micros();
                return Ok(BinaryAppendMergeResult {
                    file,
                    stats: BinaryAppendMergeStats::default(),
                    diagnostics,
                });
            } else {
                return Err("No records to write and file does not exist".to_string());
            }
        }

        let exists_started = Instant::now();
        let exists = path_ref.exists();
        diagnostics.exists_us += exists_started.elapsed().as_micros();
        if !exists {
            let mut records = new_records;
            let inserted_dates = records.iter().map(|record| record.date).collect::<Vec<_>>();
            let write_started = Instant::now();
            let (file, sync_data_us) = Self::write_all_with_sync_timing(
                path_ref,
                symbol,
                exchange,
                price_scale,
                &mut records,
            )?;
            diagnostics.new_file_write_us += write_started.elapsed().as_micros();
            diagnostics.sync_data_us += sync_data_us;
            diagnostics.sync_data_calls += 1;
            diagnostics.path = BinaryWritePath::NewFile;
            diagnostics.total_us = total_started.elapsed().as_micros();
            return Ok(BinaryAppendMergeResult {
                file,
                stats: BinaryAppendMergeStats {
                    inserted_dates,
                    changed_existing_dates: Vec::new(),
                    unchanged_existing_dates: Vec::new(),
                },
                diagnostics,
            });
        }

        let mut incoming = new_records;
        let sort_started = Instant::now();
        incoming.sort_by_key(|r| r.date);
        diagnostics.sort_us += sort_started.elapsed().as_micros();

        let open_started = Instant::now();
        let mut file = open_rw_with_retry(path_ref).map_err(|e| e.to_string())?;
        diagnostics.open_us += open_started.elapsed().as_micros();

        if let Some(hint) = append_newest_hint {
            diagnostics.append_newest_fast_candidates += 1;

            let expected_file_length = (hint.record_count as u64)
                .checked_mul(RECORD_SIZE as u64)
                .and_then(|payload| (HEADER_SIZE as u64).checked_add(payload));
            let state_shape_matches = hint.record_count > 0
                && hint.last_date > 0
                && expected_file_length == Some(hint.file_length);

            if !state_shape_matches {
                diagnostics.append_newest_fast_fallback += 1;
                diagnostics.append_newest_fast_state_mismatch += 1;
            } else {
                let open_metadata_matches = file
                    .metadata()
                    .ok()
                    .and_then(|metadata| {
                        binary_file_modified_time_ns(&metadata)
                            .ok()
                            .map(|mtime_ns| {
                                metadata.len() == hint.file_length && mtime_ns == hint.file_mtime_ns
                            })
                    })
                    .unwrap_or(false);

                if !open_metadata_matches {
                    diagnostics.append_newest_fast_fallback += 1;
                    diagnostics.append_newest_fast_metadata_changed += 1;
                } else {
                    diagnostics.append_newest_fast_trusted += 1;

                    if incoming[0].date > hint.last_date {
                        diagnostics.append_newest_fast_fast += 1;
                        let existing = Self {
                            path: path_ref.to_path_buf(),
                            header: EodHeader {
                                version: CURRENT_VERSION,
                                record_count: hint.record_count,
                                price_scale: hint.price_scale,
                                symbol: symbol.to_string(),
                                exchange: exchange.to_string(),
                            },
                        };

                        return Self::append_newest_to_open_file(
                            file,
                            existing,
                            price_scale,
                            incoming,
                            durability,
                            diagnostics,
                            total_started,
                        );
                    }

                    diagnostics.append_newest_fast_fallback += 1;
                    diagnostics.append_newest_fast_not_newest += 1;
                }
            }
        }

        let header_started = Instant::now();
        let header = Self::read_header(&mut file)?;
        diagnostics.header_read_us += header_started.elapsed().as_micros();
        diagnostics.header_classification_reads += 1;
        let existing = Self {
            path: path_ref.to_path_buf(),
            header,
        };

        let last_date_started = Instant::now();
        let last_date = if existing.header.record_count > 0 {
            diagnostics.last_date_classification_reads += 1;
            existing.read_date_at(&mut file, (existing.header.record_count - 1) as usize)?
        } else {
            0
        };
        diagnostics.last_date_read_us += last_date_started.elapsed().as_micros();

        if incoming[0].date > last_date {
            Self::append_newest_to_open_file(
                file,
                existing,
                price_scale,
                incoming,
                durability,
                diagnostics,
                total_started,
            )
        } else {
            let mut result = if incoming.len() == 1 {
                Self::upsert_single_record_by_date(file, existing, price_scale, incoming[0])?
            } else {
                Self::rewrite_from_first_incoming_record(file, existing, price_scale, &incoming)?
            };
            result.diagnostics.add_prefix(&diagnostics);
            result.diagnostics.total_us = total_started.elapsed().as_micros();
            Ok(result)
        }
    }

    fn append_newest_to_open_file(
        mut file: File,
        mut existing: Self,
        price_scale: u32,
        incoming: Vec<EodRecord>,
        durability: BinaryWriteDurability,
        mut diagnostics: BinaryWriteDiagnostics,
        total_started: Instant,
    ) -> Result<BinaryAppendMergeResult, String> {
        // Write data bytes first, then update the header count, and commit both
        // mutations with one final flush + optional sync_data().
        let seek_started = Instant::now();
        file.seek(SeekFrom::End(0)).map_err(|e| e.to_string())?;
        diagnostics.seek_us += seek_started.elapsed().as_micros();

        let data_write_started = Instant::now();
        for record in &incoming {
            file.write_all(&encode_record(record))
                .map_err(|e| e.to_string())?;
        }
        diagnostics.data_write_us += data_write_started.elapsed().as_micros();

        let header_write_started = Instant::now();
        file.seek(SeekFrom::Start(8)).map_err(|e| e.to_string())?;
        let new_count = existing.header.record_count + incoming.len() as u32;
        file.write_all(&new_count.to_le_bytes())
            .map_err(|e| e.to_string())?;
        if price_scale != existing.header.price_scale {
            file.seek(SeekFrom::Start(12)).map_err(|e| e.to_string())?;
            file.write_all(&price_scale.to_le_bytes())
                .map_err(|e| e.to_string())?;
        }
        diagnostics.header_write_us += header_write_started.elapsed().as_micros();

        let flush_started = Instant::now();
        file.flush().map_err(|e| e.to_string())?;
        diagnostics.flush_us += flush_started.elapsed().as_micros();
        diagnostics.flush_calls += 1;

        match durability {
            BinaryWriteDurability::Immediate => {
                let sync_started = Instant::now();
                sync_data_with_v17a_test_probe(&file).map_err(|e| e.to_string())?;
                diagnostics.sync_data_us += sync_started.elapsed().as_micros();
                diagnostics.sync_data_calls += 1;
            }
            BinaryWriteDurability::RecoveryJournalBuffered => {
                diagnostics.deferred_sync_calls += 1;
            }
        }

        existing.header.record_count = new_count;
        existing.header.price_scale = price_scale;
        diagnostics.path = BinaryWritePath::AppendNewest;
        diagnostics.total_us = total_started.elapsed().as_micros();

        Ok(BinaryAppendMergeResult {
            file: existing,
            stats: BinaryAppendMergeStats {
                inserted_dates: incoming.iter().map(|record| record.date).collect(),
                changed_existing_dates: Vec::new(),
                unchanged_existing_dates: Vec::new(),
            },
            diagnostics,
        })
    }

    fn read_header(file: &mut File) -> Result<EodHeader, String> {
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        let mut buffer = [0u8; HEADER_SIZE];
        file.read_exact(&mut buffer).map_err(|e| e.to_string())?;

        if &buffer[0..4] != MAGIC {
            return Err("Invalid magic bytes in EOD file".to_string());
        }

        let version = u16::from_le_bytes(buffer[4..6].try_into().unwrap());
        if version != CURRENT_VERSION {
            return Err(format!("Unsupported EOD file version: {}", version));
        }

        let record_size = u16::from_le_bytes(buffer[6..8].try_into().unwrap());
        if record_size != RECORD_SIZE as u16 {
            return Err(format!(
                "Invalid record size: expected {}, found {}",
                RECORD_SIZE, record_size
            ));
        }

        let record_count = u32::from_le_bytes(buffer[8..12].try_into().unwrap());
        let price_scale = u32::from_le_bytes(buffer[12..16].try_into().unwrap());

        let symbol = String::from_utf8_lossy(&buffer[16..48])
            .trim_matches('\0')
            .to_string();
        let exchange = String::from_utf8_lossy(&buffer[48..64])
            .trim_matches('\0')
            .to_string();

        Ok(EodHeader {
            version,
            record_count,
            price_scale,
            symbol,
            exchange,
        })
    }

    fn rewrite_from_first_incoming_record(
        mut file: File,
        mut existing: Self,
        price_scale: u32,
        incoming: &[EodRecord],
    ) -> Result<BinaryAppendMergeResult, String> {
        let total_started = Instant::now();
        let mut diagnostics = BinaryWriteDiagnostics::default();
        if incoming.is_empty() {
            diagnostics.path = BinaryWritePath::NoOp;
            diagnostics.total_us = total_started.elapsed().as_micros();
            return Ok(BinaryAppendMergeResult {
                file: existing,
                stats: BinaryAppendMergeStats::default(),
                diagnostics,
            });
        }

        let lookup_started = Instant::now();
        let start_index = existing.lower_bound_date(&mut file, incoming[0].date)?;
        diagnostics.lookup_us += lookup_started.elapsed().as_micros();
        let total_records = existing.header.record_count as usize;

        let tail_read_started = Instant::now();
        let mut tail = std::collections::BTreeMap::<u32, EodRecord>::new();
        if start_index < total_records {
            file.seek(SeekFrom::Start(
                (HEADER_SIZE + start_index * RECORD_SIZE) as u64,
            ))
            .map_err(|e| e.to_string())?;

            for _ in start_index..total_records {
                let mut buf = [0u8; RECORD_SIZE];
                file.read_exact(&mut buf).map_err(|e| e.to_string())?;
                let record = decode_record(&buf);
                tail.insert(record.date, record);
            }
        }
        diagnostics.tail_read_us += tail_read_started.elapsed().as_micros();

        let mut changed = price_scale != existing.header.price_scale;
        let mut stats = BinaryAppendMergeStats::default();
        for record in incoming {
            match tail.get(&record.date) {
                Some(existing_record) if existing_record == record => {
                    stats.unchanged_existing_dates.push(record.date);
                }
                Some(_) => {
                    stats.changed_existing_dates.push(record.date);
                    changed = true;
                }
                None => {
                    stats.inserted_dates.push(record.date);
                    changed = true;
                }
            }
            tail.insert(record.date, *record);
        }

        let new_count = start_index + tail.len();
        if new_count != total_records {
            changed = true;
        }

        if !changed {
            diagnostics.path = BinaryWritePath::NoOp;
            diagnostics.total_us = total_started.elapsed().as_micros();
            return Ok(BinaryAppendMergeResult {
                file: existing,
                stats,
                diagnostics,
            });
        }

        let seek_started = Instant::now();
        file.seek(SeekFrom::Start(
            (HEADER_SIZE + start_index * RECORD_SIZE) as u64,
        ))
        .map_err(|e| e.to_string())?;
        diagnostics.seek_us += seek_started.elapsed().as_micros();

        let data_write_started = Instant::now();
        for record in tail.values() {
            file.write_all(&encode_record(record))
                .map_err(|e| e.to_string())?;
        }
        diagnostics.data_write_us += data_write_started.elapsed().as_micros();

        let set_len_started = Instant::now();
        file.set_len((HEADER_SIZE + new_count * RECORD_SIZE) as u64)
            .map_err(|e| e.to_string())?;
        diagnostics.set_len_us += set_len_started.elapsed().as_micros();

        let header_write_started = Instant::now();
        file.seek(SeekFrom::Start(8)).map_err(|e| e.to_string())?;
        file.write_all(&(new_count as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(12)).map_err(|e| e.to_string())?;
        file.write_all(&price_scale.to_le_bytes())
            .map_err(|e| e.to_string())?;
        diagnostics.header_write_us += header_write_started.elapsed().as_micros();

        let flush_started = Instant::now();
        file.flush().map_err(|e| e.to_string())?;
        diagnostics.flush_us += flush_started.elapsed().as_micros();
        diagnostics.flush_calls += 1;

        // Ensure tail-rewrite bytes and updated header count reach physical storage.
        let sync_started = Instant::now();
        sync_data_with_v17a_test_probe(&file).map_err(|e| e.to_string())?;
        diagnostics.sync_data_us += sync_started.elapsed().as_micros();
        diagnostics.sync_data_calls += 1;

        existing.header.record_count = new_count as u32;
        existing.header.price_scale = price_scale;
        diagnostics.path = BinaryWritePath::RewriteTail;
        diagnostics.total_us = total_started.elapsed().as_micros();
        Ok(BinaryAppendMergeResult {
            file: existing,
            stats,
            diagnostics,
        })
    }

    fn upsert_single_record_by_date(
        mut file: File,
        mut existing: Self,
        price_scale: u32,
        incoming: EodRecord,
    ) -> Result<BinaryAppendMergeResult, String> {
        let total_started = Instant::now();
        let mut diagnostics = BinaryWriteDiagnostics::default();

        let total_records = existing.header.record_count as usize;
        let lookup_started = Instant::now();
        let target_index = existing.lower_bound_date(&mut file, incoming.date)?;
        diagnostics.lookup_us += lookup_started.elapsed().as_micros();
        let mut stats = BinaryAppendMergeStats::default();

        if target_index < total_records {
            let record_read_started = Instant::now();
            let existing_record = existing.read_record_at(&mut file, target_index)?;
            diagnostics.tail_read_us += record_read_started.elapsed().as_micros();
            if existing_record.date == incoming.date {
                if existing_record == incoming && price_scale == existing.header.price_scale {
                    stats.unchanged_existing_dates.push(incoming.date);
                    diagnostics.path = BinaryWritePath::NoOp;
                    diagnostics.total_us = total_started.elapsed().as_micros();
                    return Ok(BinaryAppendMergeResult {
                        file: existing,
                        stats,
                        diagnostics,
                    });
                }

                stats.changed_existing_dates.push(incoming.date);
                let data_write_started = Instant::now();
                file.seek(SeekFrom::Start(
                    (HEADER_SIZE + target_index * RECORD_SIZE) as u64,
                ))
                .map_err(|e| e.to_string())?;
                file.write_all(&encode_record(&incoming))
                    .map_err(|e| e.to_string())?;
                diagnostics.data_write_us += data_write_started.elapsed().as_micros();

                if price_scale != existing.header.price_scale {
                    let header_write_started = Instant::now();
                    file.seek(SeekFrom::Start(12)).map_err(|e| e.to_string())?;
                    file.write_all(&price_scale.to_le_bytes())
                        .map_err(|e| e.to_string())?;
                    diagnostics.header_write_us += header_write_started.elapsed().as_micros();
                    existing.header.price_scale = price_scale;
                }

                let flush_started = Instant::now();
                file.flush().map_err(|e| e.to_string())?;
                diagnostics.flush_us += flush_started.elapsed().as_micros();
                diagnostics.flush_calls += 1;

                // Flush in-place record update to physical storage.
                let sync_started = Instant::now();
                sync_data_with_v17a_test_probe(&file).map_err(|e| e.to_string())?;
                diagnostics.sync_data_us += sync_started.elapsed().as_micros();
                diagnostics.sync_data_calls += 1;
                diagnostics.path = BinaryWritePath::UpdateExisting;
                diagnostics.total_us = total_started.elapsed().as_micros();
                return Ok(BinaryAppendMergeResult {
                    file: existing,
                    stats,
                    diagnostics,
                });
            }
        }

        stats.inserted_dates.push(incoming.date);
        let old_len = HEADER_SIZE + total_records * RECORD_SIZE;
        let insert_offset = HEADER_SIZE + target_index * RECORD_SIZE;
        let new_count = total_records + 1;

        let set_len_started = Instant::now();
        file.set_len((old_len + RECORD_SIZE) as u64)
            .map_err(|e| e.to_string())?;
        diagnostics.set_len_us += set_len_started.elapsed().as_micros();

        let byte_shift_started = Instant::now();
        let mut remaining = old_len.saturating_sub(insert_offset);
        let mut buffer = vec![0_u8; 64 * 1024];
        while remaining > 0 {
            let chunk_size = remaining.min(buffer.len());
            let read_offset = insert_offset + remaining - chunk_size;
            file.seek(SeekFrom::Start(read_offset as u64))
                .map_err(|e| e.to_string())?;
            file.read_exact(&mut buffer[..chunk_size])
                .map_err(|e| e.to_string())?;
            file.seek(SeekFrom::Start((read_offset + RECORD_SIZE) as u64))
                .map_err(|e| e.to_string())?;
            file.write_all(&buffer[..chunk_size])
                .map_err(|e| e.to_string())?;
            remaining -= chunk_size;
        }
        diagnostics.byte_shift_us += byte_shift_started.elapsed().as_micros();

        let data_write_started = Instant::now();
        file.seek(SeekFrom::Start(insert_offset as u64))
            .map_err(|e| e.to_string())?;
        file.write_all(&encode_record(&incoming))
            .map_err(|e| e.to_string())?;
        diagnostics.data_write_us += data_write_started.elapsed().as_micros();

        let header_write_started = Instant::now();
        file.seek(SeekFrom::Start(8)).map_err(|e| e.to_string())?;
        file.write_all(&(new_count as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        if price_scale != existing.header.price_scale {
            file.seek(SeekFrom::Start(12)).map_err(|e| e.to_string())?;
            file.write_all(&price_scale.to_le_bytes())
                .map_err(|e| e.to_string())?;
            existing.header.price_scale = price_scale;
        }
        diagnostics.header_write_us += header_write_started.elapsed().as_micros();

        let flush_started = Instant::now();
        file.flush().map_err(|e| e.to_string())?;
        diagnostics.flush_us += flush_started.elapsed().as_micros();
        diagnostics.flush_calls += 1;

        // Flush in-place byte-shift insert and updated header count to physical storage.
        let sync_started = Instant::now();
        sync_data_with_v17a_test_probe(&file).map_err(|e| e.to_string())?;
        diagnostics.sync_data_us += sync_started.elapsed().as_micros();
        diagnostics.sync_data_calls += 1;

        existing.header.record_count = new_count as u32;
        diagnostics.path = BinaryWritePath::InsertHistorical;
        diagnostics.total_us = total_started.elapsed().as_micros();
        Ok(BinaryAppendMergeResult {
            file: existing,
            stats,
            diagnostics,
        })
    }

    fn read_date_at(&self, file: &mut File, index: usize) -> Result<u32, String> {
        let offset = (HEADER_SIZE + index * RECORD_SIZE) as u64;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| e.to_string())?;
        let mut buf = [0u8; 4];
        file.read_exact(&mut buf).map_err(|e| e.to_string())?;
        Ok(u32::from_le_bytes(buf))
    }

    fn read_record_at(&self, file: &mut File, index: usize) -> Result<EodRecord, String> {
        let offset = (HEADER_SIZE + index * RECORD_SIZE) as u64;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| e.to_string())?;
        let mut buf = [0u8; RECORD_SIZE];
        file.read_exact(&mut buf).map_err(|e| e.to_string())?;
        Ok(decode_record(&buf))
    }

    fn lower_bound_date(&self, file: &mut File, target_date: u32) -> Result<usize, String> {
        let total_records = self.header.record_count as usize;
        let mut low = 0_usize;
        let mut high = total_records;

        while low < high {
            let mid = low + (high - low) / 2;
            let date = self.read_date_at(file, mid)?;
            if date < target_date {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        Ok(low)
    }

    fn upper_bound_date(&self, file: &mut File, target_date: u32) -> Result<usize, String> {
        let total_records = self.header.record_count as usize;
        let mut low = 0_usize;
        let mut high = total_records;

        while low < high {
            let mid = low + (high - low) / 2;
            let date = self.read_date_at(file, mid)?;
            if date <= target_date {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        Ok(low)
    }

    fn read_date_window(
        &self,
        file: &mut File,
        start_index: usize,
        count: usize,
    ) -> Result<Vec<u32>, String> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let offset = (HEADER_SIZE + start_index * RECORD_SIZE) as u64;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| e.to_string())?;

        let mut dates = Vec::with_capacity(count);
        let mut buffer = [0u8; RECORD_SIZE];
        for _ in 0..count {
            file.read_exact(&mut buffer).map_err(|e| e.to_string())?;
            dates.push(u32::from_le_bytes(buffer[0..4].try_into().unwrap()));
        }

        Ok(dates)
    }

    fn truncate_file_to_record_count(path: &Path, new_count: usize) -> AppResult<()> {
        let mut file = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        file.set_len((HEADER_SIZE + new_count * RECORD_SIZE) as u64)
            .map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(8)).map_err(|e| e.to_string())?;
        file.write_all(&(new_count as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())
    }

    pub fn get_status<P: AsRef<Path>>(path: P, symbol: &str, exchange: &str) -> BinaryEodStatus {
        let path_ref = path.as_ref();
        let mut status = BinaryEodStatus {
            exists: path_ref.exists(),
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            file_path: path_to_string(path_ref),
            file_size_bytes: 0,
            record_count: 0,
            first_date: None,
            last_date: None,
            scale: DEFAULT_SCALE,
            version: CURRENT_VERSION as u32,
            has_oi: false,
            error: None,
        };

        if !status.exists {
            return status;
        }

        let metadata = match fs::metadata(path_ref) {
            Ok(m) => m,
            Err(e) => {
                status.error = Some(format!("Metadata error: {}", e));
                return status;
            }
        };
        status.file_size_bytes = metadata.len();

        match Self::open(path_ref) {
            Ok(bin) => {
                status.record_count = bin.header.record_count as u64;
                status.scale = bin.header.price_scale;
                status.version = bin.header.version as u32;
                status.symbol = bin.header.symbol.clone();
                status.exchange = bin.header.exchange.clone();

                if status.record_count > 0 {
                    let mut file = match File::open(path_ref) {
                        Ok(f) => f,
                        Err(e) => {
                            status.error = Some(format!("Open error: {}", e));
                            return status;
                        }
                    };

                    // First date
                    if let Ok(d) = bin.read_date_at(&mut file, 0) {
                        status.first_date = Some(u32_to_date(d));
                    }

                    // Last date
                    if let Ok(d) = bin.read_date_at(&mut file, (status.record_count - 1) as usize) {
                        status.last_date = Some(u32_to_date(d));
                    }

                    // has_oi: Scan for any non-zero OI
                    // For status check, scan first/last/middle records to avoid heavy IO on huge files
                    // But for EOD files (typically < 10,000 bars), a full scan is fine.
                    if status.record_count < 50_000 {
                        if let Ok(records) = bin.read_all() {
                            status.has_oi = records.iter().any(|r| r.oi > 0);
                        }
                    } else {
                        status.has_oi = true; // Heuristic for very large files
                    }
                }
            }
            Err(e) => {
                status.error = Some(format!("Invalid file: {}", e));
            }
        }

        status
    }

    pub fn delete_record_by_date<P: AsRef<Path>>(path: P, date: u32) -> AppResult<bool> {
        Ok(Self::delete_records_in_range(path, date, date)? > 0)
    }

    pub fn delete_records_in_range<P: AsRef<Path>>(
        path: P,
        start_date: u32,
        end_date: u32,
    ) -> AppResult<i64> {
        let path_ref = path.as_ref();
        if !path_ref.exists() {
            return Ok(0);
        }

        let (start_date, end_date) = if start_date <= end_date {
            (start_date, end_date)
        } else {
            (end_date, start_date)
        };

        let bin = Self::open(path_ref)?;
        let total_records = bin.header.record_count as usize;
        if total_records == 0 {
            return Ok(0);
        }

        let mut file = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(path_ref)
            .map_err(|e| e.to_string())?;
        let last_date = bin.read_date_at(&mut file, total_records - 1)?;
        if end_date >= last_date {
            let start_index = bin.lower_bound_date(&mut file, start_date)?;
            if start_index >= total_records {
                return Ok(0);
            }

            let deleted = (total_records - start_index) as i64;
            drop(file);
            if start_index == 0 {
                fs::remove_file(path_ref).map_err(|e| e.to_string())?;
            } else {
                Self::truncate_file_to_record_count(path_ref, start_index)?;
            }
            return Ok(deleted);
        }
        drop(file);

        let mut records = bin.read_all()?;
        let original_len = records.len();

        records.retain(|record| record.date < start_date || record.date > end_date);
        let deleted = (original_len - records.len()) as i64;

        if deleted == 0 {
            return Ok(0);
        }

        if records.is_empty() {
            fs::remove_file(path_ref).map_err(|e| e.to_string())?;
        } else {
            Self::write_all(
                path_ref,
                &bin.header.symbol,
                &bin.header.exchange,
                bin.header.price_scale,
                &mut records,
            )?;
        }

        Ok(deleted)
    }
}

pub fn get_all_binary_stats(base_path: &Path) -> Vec<BinarySymbolStats> {
    let mut stats = Vec::new();
    let Ok(eod_data_dir) = super::storage_paths::directory(base_path, &["eod_data"]) else {
        return stats;
    };

    if !eod_data_dir.exists() {
        return stats;
    }

    let exchanges = match fs::read_dir(&eod_data_dir) {
        Ok(entries) => entries,
        Err(_) => return stats,
    };

    for exchange_entry in exchanges.flatten() {
        let exchange_name = exchange_entry.file_name();
        let Some(exchange) = exchange_name.to_str() else {
            continue;
        };
        let Ok(exchange_path) = super::storage_paths::eod_directory(base_path, exchange) else {
            continue;
        };
        if !exchange_path.is_dir() {
            continue;
        }

        let symbols = match fs::read_dir(&exchange_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for symbol_entry in symbols.flatten() {
            let symbol_path = symbol_entry.path();
            if symbol_path.is_dir()
                || symbol_path.extension().and_then(|s| s.to_str()) != Some("eod")
            {
                continue;
            }

            let symbol_name = symbol_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            if symbol_name.is_empty() {
                continue;
            }

            if super::storage_paths::check_sibling(&symbol_path).is_err() {
                continue;
            }
            if let Ok(metadata) = fs::metadata(&symbol_path) {
                let file_size = metadata.len();
                if file_size < HEADER_SIZE as u64 {
                    continue;
                }

                if let Ok(bin) = BinaryEodFile::open(&symbol_path) {
                    if bin.header.record_count == 0 {
                        continue;
                    }

                    let (first_date, last_date) = match File::open(&symbol_path) {
                        Ok(mut file) => {
                            let f = bin.read_date_at(&mut file, 0);
                            let l =
                                bin.read_date_at(&mut file, (bin.header.record_count - 1) as usize);
                            match (f, l) {
                                (Ok(f_date), Ok(l_date)) => (f_date, l_date),
                                _ => continue,
                            }
                        }
                        Err(_) => continue,
                    };

                    stats.push(BinarySymbolStats {
                        symbol: bin.header.symbol,
                        exchange: bin.header.exchange,
                        count: bin.header.record_count,
                        first_date,
                        last_date,
                        file_size,
                    });
                }
            }
        }
    }

    stats
}

/// Inspects the binary EOD cache status for a specific symbol.
#[tauri::command]
pub fn get_binary_eod_status(
    app: AppHandle,
    symbol: String,
    exchange: String,
) -> AppResult<BinaryEodStatus> {
    let folder_path = resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before checking status.".to_string())?;

    let bin_path = super::storage_paths::eod_path(&folder_path, &exchange, &symbol)?;
    Ok(BinaryEodFile::get_status(bin_path, &symbol, &exchange))
}

#[tauri::command]
pub async fn validate_binary_parity(
    app: AppHandle,
    scope: String,
    symbol: Option<String>,
    exchange: Option<String>,
    quick_check: bool,
) -> AppResult<ValidationReport> {
    let start_time = std::time::Instant::now();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app)?
            .ok_or_else(|| "Open a database before validating parity.".to_string())?;

        let mut report = ValidationReport {
            success: true,
            symbols_processed: 0,
            issues_found: 0,
            issues: Vec::new(),
            duration_ms: 0,
        };

        with_active_connection(&app, |conn| {
            let pairs: Vec<(String, String)> = match scope.to_lowercase().as_str() {
                "symbol" => {
                    let s = symbol.clone().ok_or("Symbol required for scope=symbol")?;
                    let e = exchange
                        .clone()
                        .ok_or("Exchange required for scope=symbol")?;
                    vec![(s, e)]
                }
                "exchange" => {
                    let e = exchange
                        .clone()
                        .ok_or("Exchange required for scope=exchange")?;
                    let mut stmt = conn
                        .prepare("SELECT DISTINCT symbol FROM eod_prices WHERE exchange = ?")
                        .map_err(|e| e.to_string())?;
                    let rows = stmt
                        .query_map(params![e], |row| row.get::<_, String>(0))
                        .map_err(|e| e.to_string())?;

                    let mut p = Vec::new();
                    for r in rows {
                        p.push((r.map_err(|e| e.to_string())?, e.clone()));
                    }
                    p
                }
                _ => {
                    let mut stmt = conn
                        .prepare("SELECT DISTINCT symbol, exchange FROM eod_prices")
                        .map_err(|e| e.to_string())?;
                    let rows = stmt
                        .query_map([], |row| {
                            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                        })
                        .map_err(|e| e.to_string())?;

                    let mut p = Vec::new();
                    for r in rows {
                        p.push(r.map_err(|e| e.to_string())?);
                    }
                    p
                }
            };

            report.symbols_processed = pairs.len() as u32;

            for (symbol, exchange) in pairs {
                if let Some(issue) =
                    validate_symbol_parity(conn, &folder_path, &symbol, &exchange, quick_check)
                {
                    report.success = false;
                    report.issues_found += 1;
                    report.issues.push(issue);
                }
            }
            Ok(())
        })?;

        report.duration_ms = start_time.elapsed().as_millis();
        Ok(report)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn validate_symbol_parity(
    conn: &rusqlite::Connection,
    base_path: &Path,
    symbol: &str,
    exchange: &str,
    quick_check: bool,
) -> Option<ParityIssue> {
    // 1. Load SQLite metadata
    let mut stmt = conn
        .prepare(
            "SELECT COUNT(*), MIN(date), MAX(date) FROM eod_prices WHERE symbol = ? AND exchange = ?",
        )
        .ok()?;
    let (sqlite_count, sqlite_min, sqlite_max): (u32, Option<String>, Option<String>) = stmt
        .query_row(params![symbol, exchange], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .ok()?;

    if sqlite_count == 0 {
        return None; // No data in SQLite, nothing to validate
    }

    // 2. Load Binary metadata
    let path = match super::storage_paths::eod_path(base_path, exchange, symbol) {
        Ok(path) => path,
        Err(message) => {
            return Some(ParityIssue {
                symbol: symbol.to_string(),
                exchange: exchange.to_string(),
                issue_type: ParityIssueType::FileCorrupt,
                sqlite_count,
                binary_count: 0,
                sqlite_first_date: sqlite_min,
                sqlite_last_date: sqlite_max,
                binary_first_date: None,
                binary_last_date: None,
                message,
            })
        }
    };

    if !path.exists() {
        return Some(ParityIssue {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            issue_type: ParityIssueType::BinaryMissing,
            sqlite_count,
            binary_count: 0,
            sqlite_first_date: sqlite_min,
            sqlite_last_date: sqlite_max,
            binary_first_date: None,
            binary_last_date: None,
            message: format!("Binary file missing for {}:{}", exchange, symbol),
        });
    }

    let bin_status = BinaryEodFile::get_status(&path, symbol, exchange);

    if let Some(err) = bin_status.error {
        return Some(ParityIssue {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            issue_type: ParityIssueType::FileCorrupt,
            sqlite_count,
            binary_count: bin_status.record_count as u32,
            sqlite_first_date: sqlite_min,
            sqlite_last_date: sqlite_max,
            binary_first_date: bin_status.first_date,
            binary_last_date: bin_status.last_date,
            message: format!("Binary file corruption: {}", err),
        });
    }

    let binary_count = bin_status.record_count as u32;

    // 3. Compare Counts
    if sqlite_count != binary_count {
        return Some(ParityIssue {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            issue_type: ParityIssueType::CountMismatch,
            sqlite_count,
            binary_count,
            sqlite_first_date: sqlite_min,
            sqlite_last_date: sqlite_max,
            binary_first_date: bin_status.first_date,
            binary_last_date: bin_status.last_date,
            message: format!(
                "Count mismatch: SQLite={}, Binary={}",
                sqlite_count, binary_count
            ),
        });
    }

    // 4. Compare Date Range
    if sqlite_min != bin_status.first_date || sqlite_max != bin_status.last_date {
        return Some(ParityIssue {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            issue_type: ParityIssueType::DateRangeMismatch,
            sqlite_count,
            binary_count,
            sqlite_first_date: sqlite_min.clone(),
            sqlite_last_date: sqlite_max.clone(),
            binary_first_date: bin_status.first_date.clone(),
            binary_last_date: bin_status.last_date.clone(),
            message: format!(
                "Date range mismatch: SQLite={:?}..{:?}, Binary={:?}..{:?}",
                sqlite_min, sqlite_max, bin_status.first_date, bin_status.last_date
            ),
        });
    }

    // 5. Deep value check if requested
    if !quick_check {
        // Here we could iterate all records and check values.
        // For Phase 4B1, we stay with counts/ranges to keep it fast,
        // but the hook is here if needed.
    }

    None
}

/// Migration command to move price data from SQLite to Binary EOD files.
#[tauri::command]
pub async fn migrate_to_binary_eod(app: AppHandle) -> AppResult<MigrationReport> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app)?
            .ok_or_else(|| "Open a database before migrating.".to_string())?;
        migrate_database_to_binary(&folder_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn migrate_database_to_binary(folder: &Path) -> AppResult<MigrationReport> {
    let canonical = CanonicalAccess::lock_binary_migration(folder)?;
    let connection = super::connection_registry::open_read_only_connection_for_folder(folder)?;
    let mut statement = connection
        .prepare("SELECT DISTINCT symbol, exchange FROM eod_prices")
        .map_err(|error| error.to_string())?;
    let pairs = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let apply = canonical.begin_apply(CanonicalWriterIntent::BinaryMigration)?;
    let mut report = MigrationReport {
        success: true,
        symbols_processed: pairs.len() as u32,
        symbols_written: 0,
        records_written: 0,
        symbols_skipped: 0,
        errors: Vec::new(),
        output_folder: path_to_string(folder),
    };

    for (symbol, exchange) in pairs {
        match migrate_symbol_to_binary(&connection, folder, &symbol, &exchange) {
            Ok(count) => {
                report.symbols_written += 1;
                report.records_written += count;
            }
            Err(error) => report.errors.push(format!("{exchange}:{symbol}: {error}")),
        }
    }

    if report.errors.is_empty() {
        apply.finish_known_consistent()?;
    } else if report.symbols_written == 0 {
        report.success = false;
    }
    Ok(report)
}

fn migrate_symbol_to_binary(
    conn: &rusqlite::Connection,
    base_path: &Path,
    symbol: &str,
    exchange: &str,
) -> AppResult<u64> {
    let mut stmt = conn
        .prepare(
            "SELECT date, open, high, low, close, prev_close, volume, open_interest FROM eod_prices
         WHERE symbol = ? AND exchange = ? ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;

    let mut records = stmt
        .query_map(params![symbol, exchange], |row| {
            Ok(EodRecord {
                date: date_to_u32(&row.get::<_, String>(0)?),
                flags: 0,
                open: (row.get::<_, f64>(1)? * DEFAULT_SCALE as f64).round() as i64,
                high: (row.get::<_, f64>(2)? * DEFAULT_SCALE as f64).round() as i64,
                low: (row.get::<_, f64>(3)? * DEFAULT_SCALE as f64).round() as i64,
                close: (row.get::<_, f64>(4)? * DEFAULT_SCALE as f64).round() as i64,
                prev_close: (row.get::<_, Option<f64>>(5)?.unwrap_or(0.0) * DEFAULT_SCALE as f64)
                    .round() as i64,
                volume: row.get::<_, i64>(6)? as u64,
                oi: row.get::<_, i64>(7)? as u64,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if records.is_empty() {
        return Ok(0);
    }

    let record_count = records.len() as u64;

    let path = super::storage_paths::eod_write_path(base_path, exchange, symbol)?;

    BinaryEodFile::write_all(path, symbol, exchange, DEFAULT_SCALE, &mut records)?;
    Ok(record_count)
}

pub fn date_to_u32(date: &str) -> u32 {
    date.replace("-", "").parse().unwrap_or(0)
}

pub fn u32_to_date(date: u32) -> String {
    let s = format!("{:08}", date);
    format!("{}-{}-{}", &s[0..4], &s[4..6], &s[6..8])
}

fn binary_file_modified_time_ns(metadata: &fs::Metadata) -> Result<i64, String> {
    let modified = metadata
        .modified()
        .map_err(|error| format!("Failed to read EOD file modified time: {error}"))?;
    let duration = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("EOD file modified time predates Unix epoch: {error}"))?;
    i64::try_from(duration.as_nanos())
        .map_err(|_| "EOD file modified timestamp exceeds i64 range".to_string())
}

fn encode_record(r: &EodRecord) -> [u8; RECORD_SIZE] {
    let mut buf = [0u8; RECORD_SIZE];
    buf[0..4].copy_from_slice(&r.date.to_le_bytes());
    buf[4..8].copy_from_slice(&r.flags.to_le_bytes());
    buf[8..16].copy_from_slice(&r.open.to_le_bytes());
    buf[16..24].copy_from_slice(&r.high.to_le_bytes());
    buf[24..32].copy_from_slice(&r.low.to_le_bytes());
    buf[32..40].copy_from_slice(&r.close.to_le_bytes());
    buf[40..48].copy_from_slice(&r.prev_close.to_le_bytes());
    buf[48..56].copy_from_slice(&r.volume.to_le_bytes());
    buf[56..64].copy_from_slice(&r.oi.to_le_bytes());
    buf
}

fn decode_record(buf: &[u8; RECORD_SIZE]) -> EodRecord {
    EodRecord {
        date: u32::from_le_bytes(buf[0..4].try_into().unwrap()),
        flags: u32::from_le_bytes(buf[4..8].try_into().unwrap()),
        open: i64::from_le_bytes(buf[8..16].try_into().unwrap()),
        high: i64::from_le_bytes(buf[16..24].try_into().unwrap()),
        low: i64::from_le_bytes(buf[24..32].try_into().unwrap()),
        close: i64::from_le_bytes(buf[32..40].try_into().unwrap()),
        prev_close: i64::from_le_bytes(buf[40..48].try_into().unwrap()),
        volume: u64::from_le_bytes(buf[48..56].try_into().unwrap()),
        oi: u64::from_le_bytes(buf[56..64].try_into().unwrap()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::env;

    #[test]
    fn nsr7_binary_migration_retries_partial_work_on_the_pinned_database() {
        let fixture = tempfile::tempdir().unwrap();
        let folder = fixture.path();
        let connection = Connection::open(folder.join(super::super::DATABASE_FILE_NAME)).unwrap();
        super::super::prepare_database_connection(&connection).unwrap();
        connection
            .execute_batch(
                "INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume)
                 VALUES ('AAA','NSE','2026-11-20',10,11,9,10,1),
                        ('BBB','NSE','2026-11-20',20,21,19,20,2);",
            )
            .unwrap();
        let invalid_file = folder.join("eod_data/NSE/BBB.eod");
        fs::create_dir_all(&invalid_file).unwrap();

        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        let read = access.begin_read().unwrap();
        assert_eq!(
            migrate_database_to_binary(folder).unwrap_err(),
            "CANONICAL_PRICE_STORE_BUSY"
        );
        assert!(!folder.join("eod_data/NSE/AAA.eod").exists());
        drop(read);

        let partial = migrate_database_to_binary(folder).unwrap();
        assert_eq!((partial.symbols_written, partial.errors.len()), (1, 1));
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
        let blocked = CanonicalAccess::lock_writer_for_database(folder)
            .err()
            .unwrap();
        assert!(blocked.contains("Pending binary migration"));

        fs::remove_dir(&invalid_file).unwrap();
        let completed = migrate_database_to_binary(folder).unwrap();
        assert_eq!(
            (completed.symbols_written, completed.records_written),
            (2, 2)
        );
        assert!(completed.errors.is_empty());
        assert!(access.begin_read().is_ok());
        let bbb = BinaryEodFile::open(invalid_file)
            .unwrap()
            .read_all()
            .unwrap();
        assert_eq!(bbb[0].close, 20 * i64::from(DEFAULT_SCALE));
        assert_eq!(
            super::super::get_price_storage_mode(&connection),
            super::super::PriceStorageMode::Hybrid
        );
    }

    fn mock_record(date: u32, close: i64) -> EodRecord {
        EodRecord {
            date,
            flags: 0,
            open: close,
            high: close,
            low: close,
            close,
            prev_close: 0,
            volume: 100,
            oi: 0,
        }
    }

    struct TestFile {
        path: PathBuf,
    }

    impl TestFile {
        fn new(name: &str) -> Self {
            let mut path = env::temp_dir();
            path.push(format!(
                "eod_test_{}_{}.eod",
                name,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
            ));
            Self { path }
        }
    }

    impl Drop for TestFile {
        fn drop(&mut self) {
            if self.path.exists() {
                let _ = fs::remove_file(&self.path);
            }
        }
    }

    #[test]
    fn test_write_read_roundtrip() {
        let test_file = TestFile::new("roundtrip");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230101, 1000000),
            mock_record(20230102, 1010000),
            mock_record(20230103, 1020000),
        ];
        records[0].oi = 500;

        let bin_file =
            BinaryEodFile::write_all(file_path, "RELIANCE", "NSE", 10000, &mut records).unwrap();

        assert_eq!(bin_file.header.record_count, 3);
        assert_eq!(bin_file.header.symbol, "RELIANCE");

        let read_back = bin_file.read_all().unwrap();
        assert_eq!(read_back.len(), 3);
        assert_eq!(read_back[0].date, 20230101);
        assert_eq!(read_back[0].oi, 500);
        assert_eq!(read_back[2].close, 1020000);
    }

    #[test]
    fn test_append_only() {
        let test_file = TestFile::new("append");
        let file_path = &test_file.path;

        let records = vec![mock_record(20230101, 100)];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();

        let new_records = vec![mock_record(20230102, 200), mock_record(20230103, 300)];
        let bin = BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, new_records)
            .unwrap();

        assert_eq!(bin.header.record_count, 3);
        let all = bin.read_all().unwrap();
        assert_eq!(all[2].date, 20230103);
    }

    #[test]
    fn test_merge_overlap() {
        let test_file = TestFile::new("merge");
        let file_path = &test_file.path;

        let records = vec![mock_record(20230101, 100), mock_record(20230103, 300)];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();

        // Add 20230102 (middle) and update 20230103
        let incoming = vec![
            mock_record(20230102, 200),
            EodRecord {
                date: 20230103,
                close: 350,
                oi: 1000,
                ..mock_record(20230103, 350)
            },
        ];
        let bin =
            BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, incoming).unwrap();

        assert_eq!(bin.header.record_count, 3);
        let all = bin.read_all().unwrap();
        assert_eq!(all[1].date, 20230102);
        assert_eq!(all[2].date, 20230103);
        assert_eq!(all[2].close, 350);
        assert_eq!(all[2].oi, 1000);
    }

    #[test]
    fn test_existing_dates_overwrite_without_changing_record_count() {
        let test_file = TestFile::new("overwrite_existing");
        let file_path = &test_file.path;

        let records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();

        let incoming = vec![
            EodRecord {
                date: 20230101,
                close: 110,
                volume: 1_000,
                ..mock_record(20230101, 110)
            },
            EodRecord {
                date: 20230103,
                close: 330,
                volume: 3_000,
                ..mock_record(20230103, 330)
            },
        ];
        let bin =
            BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, incoming).unwrap();

        assert_eq!(bin.header.record_count, 3);
        let all = bin.read_all().unwrap();
        assert_eq!(all[0].close, 110);
        assert_eq!(all[0].volume, 1_000);
        assert_eq!(all[1].close, 200);
        assert_eq!(all[2].close, 330);
        assert_eq!(all[2].volume, 3_000);
    }

    #[test]
    fn test_unchanged_existing_dates_skip_rewrite() {
        let test_file = TestFile::new("skip_unchanged_existing");
        let file_path = &test_file.path;

        let records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records.clone())
            .unwrap();
        let before = fs::metadata(file_path).unwrap().modified().unwrap();

        std::thread::sleep(std::time::Duration::from_millis(20));
        let bin =
            BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();
        let after = fs::metadata(file_path).unwrap().modified().unwrap();

        assert_eq!(bin.header.record_count, 3);
        assert_eq!(after, before);
    }

    #[test]
    fn test_append_or_merge_records_with_stats_reports_inserted_changed_and_unchanged_dates() {
        let test_file = TestFile::new("append_merge_stats");
        let file_path = &test_file.path;

        let records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();

        let incoming = vec![
            mock_record(20230102, 200),
            EodRecord {
                date: 20230103,
                close: 333,
                ..mock_record(20230103, 333)
            },
            mock_record(20230104, 400),
        ];

        let result = BinaryEodFile::append_or_merge_records_with_stats(
            file_path, "TEST", "NSE", 1, incoming,
        )
        .unwrap();

        assert_eq!(result.file.header.record_count, 4);
        assert_eq!(result.stats.inserted_dates, vec![20230104]);
        assert_eq!(result.stats.changed_existing_dates, vec![20230103]);
        assert_eq!(result.stats.unchanged_existing_dates, vec![20230102]);
        assert_eq!(result.diagnostics.path, BinaryWritePath::RewriteTail);
        assert_eq!(result.diagnostics.sync_data_calls, 1);
    }

    #[test]
    fn test_missing_recent_date_merges_tail_only() {
        let test_file = TestFile::new("missing_recent_date");
        let file_path = &test_file.path;

        let records = vec![
            mock_record(20260615, 150),
            mock_record(20260617, 170),
            mock_record(20260618, 180),
            mock_record(20260619, 190),
        ];
        BinaryEodFile::append_or_merge_records(file_path, "TEST", "NSE", 1, records).unwrap();

        let incoming = vec![mock_record(20260616, 160)];
        let result = BinaryEodFile::append_or_merge_records_with_stats(
            file_path, "TEST", "NSE", 1, incoming,
        )
        .unwrap();
        let bin = result.file;

        assert_eq!(bin.header.record_count, 5);
        assert_eq!(result.stats.inserted_dates, vec![20260616]);
        assert!(result.stats.changed_existing_dates.is_empty());
        assert!(result.stats.unchanged_existing_dates.is_empty());
        assert_eq!(result.diagnostics.path, BinaryWritePath::InsertHistorical);
        assert_eq!(result.diagnostics.sync_data_calls, 1);
        let all = bin.read_all().unwrap();
        assert_eq!(
            all.iter().map(|record| record.date).collect::<Vec<_>>(),
            vec![20260615, 20260616, 20260617, 20260618, 20260619]
        );
        assert_eq!(all[1].close, 160);
        assert_eq!(all[4].close, 190);
    }

    #[test]
    fn test_write_diagnostics_classifies_new_file_and_append_newest() {
        let test_file = TestFile::new("write_diagnostics_paths");
        let file_path = &test_file.path;

        let first = BinaryEodFile::append_or_merge_records_with_stats(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20230101, 100)],
        )
        .unwrap();
        assert_eq!(first.diagnostics.path, BinaryWritePath::NewFile);
        assert_eq!(first.diagnostics.sync_data_calls, 1);
        assert!(first.diagnostics.sync_data_us > 0);
        assert_eq!(first.stats.inserted_dates, vec![20230101]);

        let second = BinaryEodFile::append_or_merge_records_with_stats(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20230102, 200)],
        )
        .unwrap();
        assert_eq!(second.diagnostics.path, BinaryWritePath::AppendNewest);
        assert_eq!(second.diagnostics.flush_calls, 1);
        assert_eq!(second.diagnostics.sync_data_calls, 1);
        assert_eq!(second.stats.inserted_dates, vec![20230102]);
        assert_eq!(second.file.header.record_count, 2);
        let reopened = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(reopened.header.record_count, 2);
        assert_eq!(
            reopened
                .read_all()
                .unwrap()
                .iter()
                .map(|record| record.date)
                .collect::<Vec<_>>(),
            vec![20230101, 20230102]
        );
    }

    #[test]
    fn test_recovery_journal_buffered_append_newest_defers_physical_sync() {
        let test_file = TestFile::new("buffered_append_newest");
        let file_path = &test_file.path;

        BinaryEodFile::append_or_merge_records_with_stats(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20230101, 100)],
        )
        .unwrap();

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20230102, 200)],
            BinaryWriteDurability::RecoveryJournalBuffered,
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::AppendNewest);
        assert_eq!(result.diagnostics.flush_calls, 1);
        assert_eq!(result.diagnostics.sync_data_calls, 0);
        assert_eq!(result.diagnostics.deferred_sync_calls, 1);
        assert_eq!(result.file.header.record_count, 2);

        let reopened = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(reopened.header.record_count, 2);
        assert_eq!(
            reopened
                .read_all()
                .unwrap()
                .iter()
                .map(|record| record.date)
                .collect::<Vec<_>>(),
            vec![20230101, 20230102]
        );
    }

    #[test]
    fn test_filter_records_against_existing() {
        let test_file = TestFile::new("filter_against_existing");
        let file_path = &test_file.path;

        let mut existing = vec![
            mock_record(20230101, 100),
            mock_record(20230103, 300),
            mock_record(20230105, 500),
        ];
        let bin = BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();

        let incoming = vec![
            mock_record(20221230, 50),
            mock_record(20230101, 101),
            mock_record(20230102, 200),
            mock_record(20230105, 501),
            mock_record(20230106, 600),
        ];

        let (filtered, skipped) = bin.filter_records_against_existing(incoming).unwrap();

        assert_eq!(skipped, 2);
        assert_eq!(filtered.len(), 3);
        assert_eq!(filtered[0].date, 20221230);
        assert_eq!(filtered[1].date, 20230102);
        assert_eq!(filtered[2].date, 20230106);
    }

    #[test]
    fn test_filter_records_against_existing_full_overlap_returns_all_skipped() {
        let test_file = TestFile::new("filter_against_existing_full_overlap");
        let file_path = &test_file.path;

        let mut existing = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        let bin = BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();

        let incoming = vec![
            mock_record(20230101, 101),
            mock_record(20230102, 201),
            mock_record(20230103, 301),
        ];

        let (filtered, skipped) = bin.filter_records_against_existing(incoming).unwrap();

        assert!(filtered.is_empty());
        assert_eq!(skipped, 3);
    }

    #[test]
    fn test_date_range_binary_search() {
        let test_file = TestFile::new("range");
        let file_path = &test_file.path;

        let mut records = (1..=10)
            .map(|i| mock_record(20230100 + i as u32, i as i64 * 100))
            .collect::<Vec<_>>();

        let bin_file = BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        // Exact range
        let range1 = bin_file.read_range(20230103, 20230105).unwrap();
        assert_eq!(range1.len(), 3);
        assert_eq!(range1[0].date, 20230103);
        assert_eq!(range1[2].date, 20230105);

        // Range with gaps
        let range2 = bin_file.read_range(20230100, 20230103).unwrap();
        assert_eq!(range2.len(), 3);
        assert_eq!(range2[0].date, 20230101);

        // Out of range
        let range3 = bin_file.read_range(20230200, 20230300).unwrap();
        assert_eq!(range3.len(), 0);
    }

    #[test]
    fn test_sorting_on_write() {
        let test_file = TestFile::new("sort");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230103, 300),
            mock_record(20230101, 100),
            mock_record(20230102, 200),
        ];

        let bin_file = BinaryEodFile::write_all(file_path, "SORT", "NSE", 1, &mut records).unwrap();

        let read_back = bin_file.read_all().unwrap();
        assert_eq!(read_back[0].date, 20230101);
        assert_eq!(read_back[1].date, 20230102);
        assert_eq!(read_back[2].date, 20230103);
    }

    #[test]
    fn test_atomic_write() {
        let test_file = TestFile::new("atomic");
        let file_path = &test_file.path;

        let mut records = vec![mock_record(20230101, 100)];

        // First write
        BinaryEodFile::write_all(file_path, "A", "NSE", 1, &mut records).unwrap();
        let size1 = fs::metadata(file_path).unwrap().len();

        // Second write (overwrite)
        let mut records2 = vec![mock_record(20230101, 100), mock_record(20230102, 200)];
        BinaryEodFile::write_all(file_path, "A", "NSE", 1, &mut records2).unwrap();
        let size2 = fs::metadata(file_path).unwrap().len();

        assert!(size2 > size1);
        assert_eq!(size2, (HEADER_SIZE + 2 * RECORD_SIZE) as u64);
    }

    #[test]
    fn test_invalid_file() {
        let test_file = TestFile::new("invalid");
        let file_path = &test_file.path;

        let mut buf = [0u8; HEADER_SIZE];
        buf[0..4].copy_from_slice(b"BAD!");
        fs::write(file_path, buf).unwrap();

        let result = BinaryEodFile::open(file_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid magic"));
    }

    #[test]
    fn test_get_status() {
        let test_file = TestFile::new("status");
        let file_path = &test_file.path;

        // Missing file
        let status = BinaryEodFile::get_status(file_path, "TEST", "NSE");
        assert_eq!(status.exists, false);
        assert_eq!(status.symbol, "TEST");

        // Valid file
        let mut records = vec![mock_record(20230101, 100), mock_record(20230105, 500)];
        records[1].oi = 100;
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        let status = BinaryEodFile::get_status(file_path, "TEST", "NSE");
        assert_eq!(status.exists, true);
        assert_eq!(status.record_count, 2);
        assert_eq!(status.first_date, Some("2023-01-01".to_string()));
        assert_eq!(status.last_date, Some("2023-01-05".to_string()));
        assert_eq!(status.has_oi, true);
    }

    #[test]
    fn test_parity_validation() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (symbol TEXT, exchange TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, prev_close REAL, volume INTEGER, open_interest INTEGER)",
            [],
        ).unwrap();

        let symbol = "TEST";
        let exchange = "NSE";

        // 1. Missing Binary File
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, '2023-01-01', 100, 110, 90, 105, 1000)",
            params![symbol, exchange]
        ).unwrap();

        let base_path = env::temp_dir();
        let issue = validate_symbol_parity(&conn, &base_path, symbol, exchange, true);
        assert!(issue.is_some());
        assert_eq!(
            issue.as_ref().unwrap().issue_type,
            ParityIssueType::BinaryMissing
        );

        // 2. Count Mismatch
        let _test_file = TestFile::new("parity");
        let bin_dir = base_path.join("eod_data").join(exchange);
        fs::create_dir_all(&bin_dir).unwrap();
        let bin_path = bin_dir.join(format!("{}.eod", symbol));

        let mut records = vec![
            mock_record(20230101, 1050000),
            mock_record(20230102, 1100000),
        ];
        BinaryEodFile::write_all(&bin_path, symbol, exchange, 10000, &mut records).unwrap();

        let issue = validate_symbol_parity(&conn, &base_path, symbol, exchange, true);
        assert!(issue.is_some());
        assert_eq!(
            issue.as_ref().unwrap().issue_type,
            ParityIssueType::CountMismatch
        );
        assert_eq!(issue.as_ref().unwrap().sqlite_count, 1);
        assert_eq!(issue.as_ref().unwrap().binary_count, 2);

        // 3. Date Range Mismatch
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, '2023-01-03', 115, 120, 110, 118, 1200)",
            params![symbol, exchange]
        ).unwrap();
        // Now SQLite has 2023-01-01 and 2023-01-03. Count is 2 (matches binary).
        // But dates are different: Binary has 01, 02. SQLite has 01, 03.

        let issue = validate_symbol_parity(&conn, &base_path, symbol, exchange, true);
        assert!(issue.is_some());
        assert_eq!(
            issue.as_ref().unwrap().issue_type,
            ParityIssueType::DateRangeMismatch
        );

        // 4. Parity OK
        // Update binary to match SQLite
        let mut records = vec![
            mock_record(20230101, 1050000),
            mock_record(20230103, 1180000),
        ];
        BinaryEodFile::write_all(&bin_path, symbol, exchange, 10000, &mut records).unwrap();

        let issue = validate_symbol_parity(&conn, &base_path, symbol, exchange, true);
        assert!(issue.is_none());

        // Cleanup
        let _ = fs::remove_file(bin_path);
    }

    #[test]
    fn test_delete_record() {
        let test_file = TestFile::new("delete");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        // Delete middle
        assert_eq!(
            BinaryEodFile::delete_record_by_date(file_path, 20230102).unwrap(),
            true
        );

        let bin = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(bin.header.record_count, 2);
        let all = bin.read_all().unwrap();
        assert_eq!(all[0].date, 20230101);
        assert_eq!(all[1].date, 20230103);

        // Delete remaining
        assert_eq!(
            BinaryEodFile::delete_record_by_date(file_path, 20230101).unwrap(),
            true
        );
        assert_eq!(
            BinaryEodFile::delete_record_by_date(file_path, 20230103).unwrap(),
            true
        );

        assert_eq!(file_path.exists(), false);
    }

    #[test]
    fn test_delete_records_in_range() {
        let test_file = TestFile::new("delete_range");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
            mock_record(20230104, 400),
        ];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        assert_eq!(
            BinaryEodFile::delete_records_in_range(file_path, 20230102, 20230103).unwrap(),
            2
        );

        let bin = BinaryEodFile::open(file_path).unwrap();
        let all = bin.read_all().unwrap();
        assert_eq!(
            all.iter().map(|record| record.date).collect::<Vec<_>>(),
            vec![20230101, 20230104]
        );
    }

    #[test]
    fn test_delete_records_in_range_truncates_suffix() {
        let test_file = TestFile::new("delete_range_suffix");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
            mock_record(20230104, 400),
        ];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        assert_eq!(
            BinaryEodFile::delete_records_in_range(file_path, 20230103, 20230104).unwrap(),
            2
        );

        let metadata = fs::metadata(file_path).unwrap();
        assert_eq!(metadata.len(), (HEADER_SIZE + 2 * RECORD_SIZE) as u64);

        let bin = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(bin.header.record_count, 2);
        let all = bin.read_all().unwrap();
        assert_eq!(
            all.iter().map(|record| record.date).collect::<Vec<_>>(),
            vec![20230101, 20230102]
        );
    }

    #[test]
    fn test_delete_record_by_date_truncates_last_record() {
        let test_file = TestFile::new("delete_last_record");
        let file_path = &test_file.path;

        let mut records = vec![
            mock_record(20230101, 100),
            mock_record(20230102, 200),
            mock_record(20230103, 300),
        ];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut records).unwrap();

        assert!(BinaryEodFile::delete_record_by_date(file_path, 20230103).unwrap());

        let metadata = fs::metadata(file_path).unwrap();
        assert_eq!(metadata.len(), (HEADER_SIZE + 2 * RECORD_SIZE) as u64);

        let bin = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(bin.header.record_count, 2);
        let all = bin.read_all().unwrap();
        assert_eq!(
            all.iter().map(|record| record.date).collect::<Vec<_>>(),
            vec![20230101, 20230102]
        );
    }

    fn v14_append_newest_hint(
        file_path: &Path,
        record_count: u32,
        price_scale: u32,
        last_date: u32,
    ) -> BinaryAppendNewestHint {
        let metadata = fs::metadata(file_path).unwrap();
        BinaryAppendNewestHint {
            record_count,
            price_scale,
            file_length: metadata.len(),
            file_mtime_ns: binary_file_modified_time_ns(&metadata).unwrap(),
            last_date,
        }
    }

    #[test]
    fn test_v14_append_newest_fast_classification_skips_header_and_last_date_reads() {
        let test_file = TestFile::new("v14_fast_append");
        let file_path = &test_file.path;

        let mut existing = vec![mock_record(20260820, 100)];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();

        let hint = v14_append_newest_hint(file_path, 1, 1, 20260820);
        let result = BinaryEodFile::append_or_merge_records_with_stats_durability_hint(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260821, 200)],
            BinaryWriteDurability::RecoveryJournalBuffered,
            Some(hint),
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::AppendNewest);
        assert_eq!(result.diagnostics.append_newest_fast_candidates, 1);
        assert_eq!(result.diagnostics.append_newest_fast_trusted, 1);
        assert_eq!(result.diagnostics.append_newest_fast_fast, 1);
        assert_eq!(result.diagnostics.append_newest_fast_fallback, 0);
        assert_eq!(result.diagnostics.header_classification_reads, 0);
        assert_eq!(result.diagnostics.last_date_classification_reads, 0);
        assert_eq!(result.diagnostics.header_read_us, 0);
        assert_eq!(result.diagnostics.last_date_read_us, 0);
        assert_eq!(result.diagnostics.sync_data_calls, 0);
        assert_eq!(result.diagnostics.deferred_sync_calls, 1);
        assert_eq!(result.file.header.record_count, 2);

        let reopened = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(reopened.header.record_count, 2);
        assert_eq!(
            reopened
                .read_all()
                .unwrap()
                .iter()
                .map(|record| record.date)
                .collect::<Vec<_>>(),
            vec![20260820, 20260821]
        );
    }

    #[test]
    fn test_v14_append_newest_fast_classification_metadata_mismatch_falls_back() {
        let test_file = TestFile::new("v14_metadata_fallback");
        let file_path = &test_file.path;

        let mut existing = vec![mock_record(20260820, 100)];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();

        let mut hint = v14_append_newest_hint(file_path, 1, 1, 20260820);
        hint.file_mtime_ns = hint.file_mtime_ns.saturating_add(1);

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability_hint(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260821, 200)],
            BinaryWriteDurability::Immediate,
            Some(hint),
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::AppendNewest);
        assert_eq!(result.diagnostics.append_newest_fast_candidates, 1);
        assert_eq!(result.diagnostics.append_newest_fast_trusted, 0);
        assert_eq!(result.diagnostics.append_newest_fast_fast, 0);
        assert_eq!(result.diagnostics.append_newest_fast_fallback, 1);
        assert_eq!(result.diagnostics.append_newest_fast_metadata_changed, 1);
        assert_eq!(result.diagnostics.header_classification_reads, 1);
        assert_eq!(result.diagnostics.last_date_classification_reads, 1);
        assert_eq!(result.diagnostics.sync_data_calls, 1);
        assert_eq!(result.file.header.record_count, 2);
    }

    #[test]
    fn test_v14_append_newest_fast_classification_not_newest_falls_back() {
        let test_file = TestFile::new("v14_not_newest_fallback");
        let file_path = &test_file.path;

        let mut existing = vec![mock_record(20260820, 100)];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();

        let hint = v14_append_newest_hint(file_path, 1, 1, 20260820);
        let result = BinaryEodFile::append_or_merge_records_with_stats_durability_hint(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260820, 999)],
            BinaryWriteDurability::Immediate,
            Some(hint),
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::UpdateExisting);
        assert_eq!(result.diagnostics.append_newest_fast_candidates, 1);
        assert_eq!(result.diagnostics.append_newest_fast_trusted, 1);
        assert_eq!(result.diagnostics.append_newest_fast_fast, 0);
        assert_eq!(result.diagnostics.append_newest_fast_fallback, 1);
        assert_eq!(result.diagnostics.append_newest_fast_not_newest, 1);
        assert_eq!(result.diagnostics.header_classification_reads, 1);
        assert_eq!(result.diagnostics.last_date_classification_reads, 1);
        assert_eq!(result.stats.changed_existing_dates, vec![20260820]);

        let reopened = BinaryEodFile::open(file_path).unwrap();
        assert_eq!(reopened.header.record_count, 1);
        assert_eq!(reopened.read_all().unwrap()[0].close, 999);
    }
    #[test]
    fn v17a_sync_probe_counter_is_thread_local_across_test_threads() {
        v17a_test_reset_sync_data_calls();
        assert_eq!(v17a_test_sync_data_calls(), 0);

        let child_calls = std::thread::spawn(|| {
            let test_file = TestFile::new("v17a_thread_local_probe_child");
            let file = File::create(&test_file.path).unwrap();

            v17a_test_reset_sync_data_calls();
            sync_data_with_v17a_test_probe(&file).unwrap();
            v17a_test_sync_data_calls()
        })
        .join()
        .unwrap();

        assert_eq!(child_calls, 1);
        assert_eq!(
            v17a_test_sync_data_calls(),
            0,
            "V1.7A sync probe accounting must be isolated per test thread"
        );
    }

    #[test]
    fn v17a_existing_append_probe_confirms_sync_instrumentation() {
        let test_file = TestFile::new("v17a_sync_probe_control");
        let file_path = &test_file.path;

        let mut existing = vec![mock_record(20260820, 100)];
        BinaryEodFile::write_all(file_path, "TEST", "NSE", 1, &mut existing).unwrap();
        v17a_test_reset_sync_data_calls();

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260821, 200)],
            BinaryWriteDurability::Immediate,
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::AppendNewest);
        assert_eq!(v17a_test_sync_data_calls(), 1);
    }

    #[test]
    fn v17a_new_file_immediate_write_crosses_durable_sync() {
        let test_file = TestFile::new("v17a_new_file_immediate");
        let file_path = &test_file.path;
        if file_path.exists() {
            fs::remove_file(file_path).unwrap();
        }
        v17a_test_reset_sync_data_calls();

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260820, 100)],
            BinaryWriteDurability::Immediate,
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::NewFile);
        assert!(
            v17a_test_sync_data_calls() >= 1,
            "a newly-created .eod file must cross an explicit sync_data durability barrier before the write returns"
        );
    }

    #[test]
    fn v17a_new_file_buffered_write_crosses_durable_sync() {
        let test_file = TestFile::new("v17a_new_file_buffered");
        let file_path = &test_file.path;
        if file_path.exists() {
            fs::remove_file(file_path).unwrap();
        }
        v17a_test_reset_sync_data_calls();

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability(
            file_path,
            "TEST",
            "NSE",
            1,
            vec![mock_record(20260820, 100)],
            BinaryWriteDurability::RecoveryJournalBuffered,
        )
        .unwrap();

        assert_eq!(result.diagnostics.path, BinaryWritePath::NewFile);
        assert!(
            v17a_test_sync_data_calls() >= 1,
            "a new-file write cannot rely on the deferred APPEND_NEWEST checkpoint and must be durably synced before return"
        );
    }
}
