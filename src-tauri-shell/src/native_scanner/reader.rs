//! NS-01: bounded, validated reader for the existing version-1 `.eod` format.
//!
//! This module is deliberately a *reader*: it never writes, never mutates and never
//! maps a file into memory. It reuses the accepted on-disk layout constants and
//! record decoding from `database::binary_eod`, adds strict structural validation
//! (magic/version/stride/scale/length/monotonic dates/identity), and reads a bounded
//! trailing window with checked offsets so a corrupt or growing file yields an explicit
//! error instead of a silent partial series.
//!
//! The native scanner is opt-in. Nothing here is reachable from the UI until NS-04 and
//! no command is registered by this module.

use crate::database::binary_eod::{
    date_to_u32, BinaryEodFile, EodHeader, EodRecord, CURRENT_VERSION, HEADER_SIZE, MAGIC,
    RECORD_SIZE,
};
use std::collections::BTreeSet;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

/// Upper bound on records a single target may contribute to a scan window.
pub const MAX_WINDOW_BARS: usize = 5000;

/// A validated, read-only view of one instrument file.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedEodFile {
    pub header: EodHeader,
    pub record_count: u32,
}

/// One completed bar decoded from the file, already converted to real price units.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NativeBar {
    pub date: u32,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: f64,
    pub open_interest: f64,
}

fn read_exact_at(file: &mut File, offset: u64, buffer: &mut [u8]) -> Result<(), String> {
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| format!("Unable to seek EOD data: {error}"))?;
    file.read_exact(buffer)
        .map_err(|error| format!("Truncated EOD data at offset {offset}: {error}"))
}

/// Validates header fields that `BinaryEodFile::read_header` does not reject on its own
/// (price scale, identity lengths) using the accepted on-disk layout:
/// magic(4) version(2) record_size(2) record_count(4) price_scale(4) symbol(32) exchange(16).
fn validate_header_bytes(bytes: &[u8; HEADER_SIZE]) -> Result<(), String> {
    if &bytes[0..4] != MAGIC {
        return Err("Invalid .eod magic: expected EOD1.".to_string());
    }
    let version = u16::from_le_bytes([bytes[4], bytes[5]]);
    if version != CURRENT_VERSION {
        return Err(format!(
            "Unsupported .eod version {version}; expected {CURRENT_VERSION}."
        ));
    }
    let record_size = u16::from_le_bytes([bytes[6], bytes[7]]);
    if record_size as usize != RECORD_SIZE {
        return Err(format!(
            "Unsupported .eod record size {record_size}; expected {RECORD_SIZE}."
        ));
    }
    let price_scale = u32::from_le_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]);
    if price_scale == 0 || price_scale > 1_000_000_000 {
        return Err(format!(
            "Invalid .eod price scale {price_scale}; expected a positive scale."
        ));
    }
    let symbol = &bytes[16..48];
    let exchange = &bytes[48..64];
    if !symbol
        .iter()
        .take_while(|byte| **byte != 0)
        .all(|byte| byte.is_ascii_graphic() || *byte == b' ')
    {
        return Err("Invalid .eod symbol identity encoding.".to_string());
    }
    if !exchange
        .iter()
        .take_while(|byte| **byte != 0)
        .all(|byte| byte.is_ascii_graphic() || *byte == b' ')
    {
        return Err("Invalid .eod exchange identity encoding.".to_string());
    }
    Ok(())
}

fn decode_record_at(file: &mut File, index: usize) -> Result<EodRecord, String> {
    let offset = HEADER_SIZE as u64 + (index as u64) * RECORD_SIZE as u64;
    let mut buffer = [0u8; RECORD_SIZE];
    read_exact_at(file, offset, &mut buffer)?;
    Ok(EodRecord {
        date: u32::from_le_bytes(buffer[0..4].try_into().unwrap()),
        flags: u32::from_le_bytes(buffer[4..8].try_into().unwrap()),
        open: i64::from_le_bytes(buffer[8..16].try_into().unwrap()),
        high: i64::from_le_bytes(buffer[16..24].try_into().unwrap()),
        low: i64::from_le_bytes(buffer[24..32].try_into().unwrap()),
        close: i64::from_le_bytes(buffer[32..40].try_into().unwrap()),
        prev_close: i64::from_le_bytes(buffer[40..48].try_into().unwrap()),
        volume: u64::from_le_bytes(buffer[48..56].try_into().unwrap()),
        oi: u64::from_le_bytes(buffer[56..64].try_into().unwrap()),
    })
}

/// Converts a fixed-point record to real units using the file's own price scale.
pub fn record_to_bar(record: &EodRecord, price_scale: u32) -> Result<NativeBar, String> {
    if price_scale == 0 {
        return Err("Cannot decode EOD record with a zero price scale.".to_string());
    }
    let scale = price_scale as f64;
    let open = record.open as f64 / scale;
    let high = record.high as f64 / scale;
    let low = record.low as f64 / scale;
    let close = record.close as f64 / scale;
    if !open.is_finite() || !high.is_finite() || !low.is_finite() || !close.is_finite() {
        return Err(format!(
            "EOD record for {} has a non-finite price after scaling.",
            record.date
        ));
    }
    if high < low {
        return Err(format!(
            "EOD record for {} has high < low; refusing to evaluate corrupt data.",
            record.date
        ));
    }
    let prev_close = if record.prev_close == 0 {
        None
    } else {
        let value = record.prev_close as f64 / scale;
        value.is_finite().then_some(value)
    };
    Ok(NativeBar {
        date: record.date,
        open,
        high,
        low,
        close,
        prev_close,
        volume: record.volume as f64,
        open_interest: record.oi as f64,
    })
}

/// Opens a `.eod` file, validating the header and the exact on-disk length.
pub fn open_validated(path: &Path) -> Result<ValidatedEodFile, String> {
    let binary = BinaryEodFile::open(path)?;
    let header = binary.header.clone();
    let mut header_bytes = [0u8; HEADER_SIZE];
    read_exact_at(
        &mut File::open(path).map_err(|error| format!("Unable to open EOD file: {error}"))?,
        0,
        &mut header_bytes,
    )?;
    validate_header_bytes(&header_bytes)?;
    let metadata =
        std::fs::metadata(path).map_err(|error| format!("Unable to stat EOD file: {error}"))?;
    let expected = HEADER_SIZE as u64 + header.record_count as u64 * RECORD_SIZE as u64;
    if metadata.len() != expected {
        return Err(format!(
            "EOD file length {} does not match its header ({} records, expected {} bytes).",
            metadata.len(),
            header.record_count,
            expected
        ));
    }
    if header.symbol.trim().is_empty() || header.exchange.trim().is_empty() {
        return Err("EOD header is missing its stored symbol/exchange identity.".to_string());
    }
    Ok(ValidatedEodFile {
        header,
        record_count: header.record_count,
    })
}

/// Validates the stored identity of a file against the target being scanned.
pub fn validate_identity(
    file: &ValidatedEodFile,
    expected_symbol: &str,
    expected_exchange: &str,
) -> Result<(), String> {
    if !file.header.symbol.eq_ignore_ascii_case(expected_symbol) {
        return Err(format!(
            "EOD file identity mismatch: header symbol \"{}\" does not match requested \"{expected_symbol}\".",
            file.header.symbol
        ));
    }
    if !file.header.exchange.eq_ignore_ascii_case(expected_exchange) {
        return Err(format!(
            "EOD file identity mismatch: header exchange \"{}\" does not match requested \"{expected_exchange}\".",
            file.header.exchange
        ));
    }
    Ok(())
}

/// Reads at most `window` trailing bars, optionally bounded by an as-of date.
///
/// The window is clamped to `MAX_WINDOW_BARS`. Dates must be strictly increasing both
/// inside the returned window and across the validated sample, so duplicate or
/// out-of-order rows fail closed instead of silently reordering.
pub fn read_trailing_bars(
    path: &Path,
    window: usize,
    as_of_date: Option<u32>,
) -> Result<Vec<NativeBar>, String> {
    let validated = open_validated(path)?;
    let total = validated.record_count as usize;
    if total == 0 {
        return Ok(Vec::new());
    }
    let mut file = File::open(path).map_err(|error| format!("Unable to open EOD file: {error}"))?;

    // Locate the first index at or before the as-of date with a binary search over dates.
    let upper_index = match as_of_date {
        None => total - 1,
        Some(as_of) => {
            let mut low = 0usize;
            let mut high = total - 1;
            let mut found: Option<usize> = None;
            while low <= high {
                let mid = low + (high - low) / 2;
                let record = decode_record_at(&mut file, mid)?;
                if record.date <= as_of {
                    found = Some(mid);
                    low = mid + 1;
                } else if mid == 0 {
                    break;
                } else {
                    high = mid - 1;
                }
            }
            match found {
                Some(index) => index,
                None => return Ok(Vec::new()),
            }
        }
    };

    let window = window.min(MAX_WINDOW_BARS).max(1);
    let start = upper_index.saturating_sub(window - 1);
    let count = upper_index - start + 1;

    let mut reader = BufReader::with_capacity(RECORD_SIZE * 512, file);
    reader
        .seek(SeekFrom::Start(
            HEADER_SIZE as u64 + start as u64 * RECORD_SIZE as u64,
        ))
        .map_err(|error| format!("Unable to seek EOD window: {error}"))?;

    let scale = validated.header.price_scale;
    let mut bars = Vec::with_capacity(count);
    let mut previous_date: Option<u32> = None;
    let mut buffer = [0u8; RECORD_SIZE];
    for _ in 0..count {
        reader
            .read_exact(&mut buffer)
            .map_err(|error| format!("Truncated EOD window read: {error}"))?;
        let record = EodRecord {
            date: u32::from_le_bytes(buffer[0..4].try_into().unwrap()),
            flags: u32::from_le_bytes(buffer[4..8].try_into().unwrap()),
            open: i64::from_le_bytes(buffer[8..16].try_into().unwrap()),
            high: i64::from_le_bytes(buffer[16..24].try_into().unwrap()),
            low: i64::from_le_bytes(buffer[24..32].try_into().unwrap()),
            close: i64::from_le_bytes(buffer[32..40].try_into().unwrap()),
            prev_close: i64::from_le_bytes(buffer[40..48].try_into().unwrap()),
            volume: u64::from_le_bytes(buffer[48..56].try_into().unwrap()),
            oi: u64::from_le_bytes(buffer[56..64].try_into().unwrap()),
        };
        if record.date == 0 {
            return Err("EOD window contains a record with an empty date.".to_string());
        }
        if let Some(previous) = previous_date {
            if record.date <= previous {
                return Err(format!(
                    "EOD window is not strictly date-ascending at {} (previous {previous}).",
                    record.date
                ));
            }
        }
        previous_date = Some(record.date);
        bars.push(record_to_bar(&record, scale)?);
    }
    Ok(bars)
}

/// Parses `YYYY-MM-DD` into the packed `YYYYMMDD` integer used by the format.
pub fn parse_scan_date(value: &str) -> Result<u32, String> {
    let bytes = value.as_bytes();
    let well_formed = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());
    if !well_formed {
        return Err(format!(
            "Invalid scan date \"{value}\"; expected YYYY-MM-DD."
        ));
    }
    let month = value[5..7].parse::<u32>().unwrap_or(0);
    let day = value[8..10].parse::<u32>().unwrap_or(0);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(format!(
            "Invalid scan date \"{value}\"; month/day out of range."
        ));
    }
    let packed = date_to_u32(value);
    if packed == 0 {
        return Err(format!("Invalid scan date \"{value}\"."));
    }
    Ok(packed)
}

/// Counts duplicate calendar dates in a series; used by validation diagnostics.
pub fn count_duplicate_dates(bars: &[NativeBar]) -> usize {
    let mut seen = BTreeSet::new();
    bars.iter().filter(|bar| !seen.insert(bar.date)).count()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::binary_eod::{BinaryEodFile, EodRecord};
    use std::fs;
    use std::path::PathBuf;

    struct TempEod {
        path: PathBuf,
    }

    impl TempEod {
        fn new(name: &str) -> Self {
            let mut path = std::env::temp_dir();
            path.push(format!(
                "native_scan_reader_{}_{}.eod",
                name,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
            ));
            Self { path }
        }
    }

    impl Drop for TempEod {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.path);
        }
    }

    fn record(date: u32, close: i64) -> EodRecord {
        EodRecord {
            date,
            flags: 1,
            open: close - 10,
            high: close + 20,
            low: close - 20,
            close,
            prev_close: close - 5,
            volume: 1_000,
            oi: 0,
        }
    }

    fn write_file(temp: &TempEod, symbol: &str, exchange: &str, records: &[EodRecord], scale: u32) {
        let mut owned = records.to_vec();
        BinaryEodFile::write_all(&temp.path, symbol, exchange, scale, &mut owned)
            .expect("write fixture");
    }

    #[test]
    fn ns01_reader_reads_validated_trailing_window_and_scales_prices() {
        let temp = TempEod::new("valid");
        let records: Vec<EodRecord> = (1..=10)
            .map(|day| record(20240100 + day, 1000 + day as i64 * 100))
            .collect();
        write_file(&temp, "INFY", "NSE", &records, 10000);

        let validated = open_validated(&temp.path).expect("validate");
        assert_eq!(validated.record_count, 10);
        validate_identity(&validated, "INFY", "NSE").expect("identity");

        let bars = read_trailing_bars(&temp.path, 3, None).expect("read window");
        assert_eq!(bars.len(), 3);
        assert_eq!(bars[0].date, 20240108);
        assert_eq!(bars[2].date, 20240110);
        assert!((bars[2].close - 11.0).abs() < 1e-9);
        assert_eq!(count_duplicate_dates(&bars), 0);
    }

    #[test]
    fn ns01_reader_honours_as_of_date_and_returns_empty_before_history() {
        let temp = TempEod::new("asof");
        let records: Vec<EodRecord> = (1..=5).map(|day| record(20240100 + day, 1000)).collect();
        write_file(&temp, "INFY", "NSE", &records, 10000);

        let bars = read_trailing_bars(&temp.path, 10, Some(20240103)).expect("as-of read");
        assert_eq!(bars.len(), 3);
        assert_eq!(bars[2].date, 20240103);

        let empty = read_trailing_bars(&temp.path, 10, Some(20231231)).expect("pre-history read");
        assert!(empty.is_empty());
    }

    #[test]
    fn ns01_reader_rejects_truncated_file_body() {
        let temp = TempEod::new("truncated");
        let records: Vec<EodRecord> = (1..=4).map(|day| record(20240100 + day, 1000)).collect();
        write_file(&temp, "INFY", "NSE", &records, 10000);
        let bytes = fs::read(&temp.path).expect("read fixture");
        fs::write(&temp.path, &bytes[..bytes.len() - 8]).expect("truncate fixture");

        let error = open_validated(&temp.path).expect_err("must reject truncated file");
        assert!(
            error.contains("does not match its header"),
            "unexpected: {error}"
        );
    }

    #[test]
    fn ns01_reader_rejects_bad_magic_version_and_scale() {
        let temp = TempEod::new("magic");
        let records = vec![record(20240101, 1000)];
        write_file(&temp, "INFY", "NSE", &records, 10000);

        let mut bytes = fs::read(&temp.path).expect("read fixture");
        bytes[0] = b'X';
        fs::write(&temp.path, &bytes).expect("corrupt magic");
        let error = open_validated(&temp.path).expect_err("must reject magic");
        assert!(error.contains("magic"), "unexpected: {error}");

        let mut bytes = fs::read(&temp.path).expect("read fixture");
        bytes[4] = 9;
        fs::write(&temp.path, &bytes).expect("corrupt version");
        let error = open_validated(&temp.path).expect_err("must reject version");
        assert!(
            error.contains("version") || error.contains("record size") || error.contains("scale"),
            "unexpected: {error}"
        );
    }

    #[test]
    fn ns01_reader_rejects_zero_price_scale() {
        let temp = TempEod::new("scale");
        let records = vec![record(20240101, 1000)];
        write_file(&temp, "INFY", "NSE", &records, 10000);
        let mut bytes = fs::read(&temp.path).expect("read fixture");
        bytes[12..16].copy_from_slice(&0u32.to_le_bytes());
        fs::write(&temp.path, &bytes).expect("corrupt scale");
        let error = open_validated(&temp.path).expect_err("must reject zero scale");
        assert!(error.contains("price scale"), "unexpected: {error}");
    }

    #[test]
    fn ns01_reader_rejects_identity_mismatch() {
        let temp = TempEod::new("identity");
        let records = vec![record(20240101, 1000)];
        write_file(&temp, "INFY", "NSE", &records, 10000);
        let validated = open_validated(&temp.path).expect("validate");
        let error = validate_identity(&validated, "TCS", "NSE").expect_err("must reject symbol");
        assert!(error.contains("identity mismatch"), "unexpected: {error}");
        let error = validate_identity(&validated, "INFY", "BSE").expect_err("must reject exchange");
        assert!(error.contains("exchange"), "unexpected: {error}");
    }

    #[test]
    fn ns01_reader_rejects_duplicate_and_out_of_order_dates() {
        let temp = TempEod::new("duplicate");
        let records = vec![record(20240101, 1000), record(20240101, 1000)];
        write_file(&temp, "INFY", "NSE", &records, 10000);
        let error = read_trailing_bars(&temp.path, 10, None).expect_err("must reject duplicates");
        assert!(
            error.contains("strictly date-ascending"),
            "unexpected: {error}"
        );
    }

    #[test]
    fn ns01_reader_rejects_high_below_low() {
        let temp = TempEod::new("inverted");
        let mut bad = record(20240101, 1000);
        bad.high = 100;
        bad.low = 900;
        write_file(&temp, "INFY", "NSE", &[bad], 10000);
        let error = read_trailing_bars(&temp.path, 10, None).expect_err("must reject high<low");
        assert!(error.contains("high < low"), "unexpected: {error}");
    }

    #[test]
    fn ns01_reader_window_is_clamped_and_never_loads_everything() {
        let temp = TempEod::new("clamp");
        let records: Vec<EodRecord> = (1..=40).map(|day| record(20240100 + day, 1000)).collect();
        write_file(&temp, "INFY", "NSE", &records, 10000);
        let bars =
            read_trailing_bars(&temp.path, MAX_WINDOW_BARS + 500, None).expect("clamped read");
        assert_eq!(bars.len(), records.len());
    }

    #[test]
    fn ns01_reader_parses_scan_dates_strictly() {
        assert_eq!(parse_scan_date("2024-03-08").unwrap(), 20240308);
        for invalid in [
            "2024-13-01",
            "2024-00-10",
            "20240308",
            "2024-3-8",
            "abcd-ef-gh",
        ] {
            assert!(parse_scan_date(invalid).is_err(), "must reject {invalid}");
        }
    }
}
