//! NSE security admission before metadata/price writes (also used for journal replay).
//! Authority: docs/plans/2026-11-08_BHAVCOPY_SERIES_COLLISION_AUDIT_AND_REPAIR_PLAN.md
//! (section 4 "Current code state"). The previously referenced
//! docs/plans/2026-11-08_CA_SERIES_COLLISION_DESIGN.md is missing from the repo;
use super::parsers::{ParsedBhavcopyFile, ParsedBhavcopyRow};
use crate::bhavcopy::types::AppResult;
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static AUDIT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Default, Serialize)]
pub struct AdmissionReport {
    pub separated: usize,
    pub market_rows: usize,
    pub conflicted: usize,
    pub duplicates: usize,
    pub evidence: Option<String>,
}

impl AdmissionReport {
    pub fn message(&self) -> Option<String> {
        if self.separated + self.market_rows + self.conflicted + self.duplicates == 0 {
            return None;
        }
        Some(format!(
            "Security admission: separated {} non-equity rows, kept {} auxiliary-market rows out of daily prices, blocked {} rows, identical duplicates {}; evidence {}",
            self.separated, self.market_rows, self.conflicted, self.duplicates,
            self.evidence.as_deref().unwrap_or("none")
        ))
    }

    pub fn describe_result(&self, base: String) -> String {
        let message = match self.message() {
            Some(details) => format!("{base}; {details}"),
            None => base,
        };
        if self.conflicted > 0 {
            format!("Security subset: {message}")
        } else {
            message
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum SecurityClass {
    Equity,
    Separate,
    Other(&'static str),
    Unknown,
}

fn family(series: &str, prefixes: &[u8], zero: bool) -> bool {
    let b = series.as_bytes();
    b.len() == 2
        && prefixes.contains(&b[0])
        && (b[1].is_ascii_uppercase() || (b[1].is_ascii_digit() && (zero || b[1] != b'0')))
}

fn classify(series: &str) -> SecurityClass {
    // NSE legend of series (updated 2024-09-19); the 2010-11-11 NSE
    // listing notice independently qualifies SBIN N1/N2 from 2010-11-12.
    // Exact existing equity codes MUST precede the overlapping debt families.
    match series {
        "EQ" | "BE" | "BZ" | "SM" | "ST" | "SZ" | "SP" | "SL" | "SI" | "SO" | "SQ" | "BT"
        | "BL" | "BO" | "IL" | "IQ" | "TT" | "IT" | "T0" => SecurityClass::Equity,
        // Preserve existing standalone instruments and government-security policy.
        // They may not be combined with equity at a shared symbol/date key.
        "GS" | "GB" | "GF" | "GT" | "GBD" | "GBI" | "GSD" | "GSI" | "SG" | "TB" => {
            SecurityClass::Other("government")
        }
        "MF" | "ME" => SecurityClass::Other("fund"),
        "IV" | "ID" => SecurityClass::Other("invit"),
        "RR" | "RT" => SecurityClass::Other("reit"),
        "DR" | "DE" => SecurityClass::Other("depositary_receipt"),
        _ if family(series, b"EX", false) => SecurityClass::Equity,
        _ if family(series, b"NYZAB", true)
            || family(series, b"UPOQFDSWK", false)
            || family(series, b"M", true) =>
        {
            SecurityClass::Separate
        }
        _ => SecurityClass::Unknown,
    }
}

fn legacy_paired_market(series: &str) -> bool {
    // Pre-2009 NSE bhavcopy also published a second equity-series bucket for
    // the same company (`E1`/`E2`: compulsory-demat / illiquid segment). When
    // one of those rows shares a symbol/date with the regular EQ bar it is a
    // market-segment quote, not the canonical daily bar — same role as the
    // IL/BL auxiliary markets. On its own it stays a normal equity row.
    // Only the numbered `E1`..`E9` buckets. `EQ`/`EX` also start with 'E' but are
    // regular equity series and must never be treated as a segment.
    let bytes = series.as_bytes();
    bytes.len() == 2 && bytes[0] == b'E' && (b'1'..=b'9').contains(&bytes[1])
}

fn auxiliary_market(series: &str) -> bool {
    // Official NSE market-segment descriptions distinguish these from regular
    // daily quotations. SME equivalents follow CMTR21587. They are retained
    // in the audit, never added to regular OHLC/volume or called non-equity.
    //
    // `BO` is the open-market buyback window: NSE publishes those trades under
    // the same symbol/date as the ordinary equity bar, so the buyback print must
    // never replace the canonical OHLCV row. It is kept as evidence exactly like
    // the block/illiquid buckets.
    // T0 is the separate optional same-day settlement market, not a T+1 bar.
    matches!(
        series,
        "IL" | "IQ" | "BL" | "SL" | "SI" | "SQ" | "BO" | "T0"
    )
}

// New exceptions require positive identity evidence. Keep the historical
// both-ISIN-less rule for the already accepted equity auxiliary markets.
fn same_present_isin(a: &ParsedBhavcopyRow, b: &ParsedBhavcopyRow) -> bool {
    a.isin.len() == 12 && a.isin.starts_with("IN") && a.isin == b.isin
}

fn equal_rows(a: &ParsedBhavcopyRow, b: &ParsedBhavcopyRow) -> bool {
    a.series == b.series
        && a.isin == b.isin
        && a.instrument_name == b.instrument_name
        && a.open == b.open
        && a.high == b.high
        && a.low == b.low
        && a.close == b.close
        && a.prev_close == b.prev_close
        && a.volume == b.volume
        && a.oi == b.oi
        && a.trades == b.trades
        && a.binary_record == b.binary_record
}

pub(crate) struct Admission {
    pub masks: Vec<Vec<bool>>,
    pub reports: Vec<AdmissionReport>,
}

pub(crate) fn admit(database_path: &Path, files: &[ParsedBhavcopyFile]) -> AppResult<Admission> {
    let mut masks: Vec<Vec<bool>> = files.iter().map(|f| vec![true; f.rows.len()]).collect();
    let mut reports = vec![AdmissionReport::default(); files.len()];
    let mut keys = BTreeMap::<(String, String), Vec<(usize, usize)>>::new();
    let mut reasons = BTreeMap::<(usize, usize), &'static str>::new();
    for (fi, file) in files
        .iter()
        .enumerate()
        .filter(|(_, f)| f.exchange == "NSE")
    {
        for (ri, row) in file.rows.iter().enumerate() {
            match classify(&row.series) {
                SecurityClass::Separate => {
                    masks[fi][ri] = false;
                    reports[fi].separated += 1;
                    reasons.insert((fi, ri), "OFFICIAL_NON_EQUITY_SERIES");
                }
                _ => {
                    keys.entry((row.symbol.clone(), row.trade_date.clone()))
                        .or_default()
                        .push((fi, ri));
                }
            }
        }
    }
    // A symbol/date guard alone is insufficient: an independently dated row
    // of another security class must not be appended to an existing equity file.
    let mut symbol_classes = BTreeMap::<String, Vec<SecurityClass>>::new();
    for positions in keys.values() {
        for &(f, r) in positions {
            let row = &files[f].rows[r];
            let classes = symbol_classes.entry(row.symbol.clone()).or_default();
            // BL is a market segment, not a security class, when a same-key
            // InvIT unit with matching identity establishes its actual owner.
            // Keep unmatched BL and all other existing class guards unchanged.
            if row.series == "BL"
                && positions.iter().any(|&(pf, pr)| {
                    let primary = &files[pf].rows[pr];
                    matches!(primary.series.as_str(), "IV" | "ID")
                        && same_present_isin(primary, row)
                })
            {
                continue;
            }
            let class = classify(&row.series);
            if class != SecurityClass::Unknown && !classes.contains(&class) {
                classes.push(class);
            }
        }
    }
    if !symbol_classes.is_empty() {
        let connection =
            Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|e| e.to_string())?;
        let mut query = connection
            .prepare("SELECT series FROM instruments WHERE exchange='NSE' AND symbol=?")
            .map_err(|e| e.to_string())?;
        for (symbol, classes) in &mut symbol_classes {
            let current: Option<Option<String>> = query
                .query_row([symbol], |r| r.get(0))
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some(series) = current.flatten() {
                let class = classify(&series);
                if class != SecurityClass::Unknown && !classes.contains(&class) {
                    classes.push(class);
                }
            }
        }
    }
    for positions in keys.values() {
        let (fi, ri) = positions[0];
        let first = &files[fi].rows[ri];
        let unknown = positions
            .iter()
            .any(|&(f, r)| classify(&files[f].rows[r].series) == SecurityClass::Unknown);
        let class_conflict = symbol_classes
            .get(&first.symbol)
            .map_or(false, |classes| classes.len() > 1);
        // A key resolves to its canonical regular row when every other row is a
        // market-segment quote: auxiliary markets (IL/IQ/BL/SL/SI/SQ) always, and
        // the legacy `E1`/`E2` bucket only when a non-legacy regular row shares
        // the key (a standalone E1 row stays an ordinary equity row).
        let has_canonical = positions.iter().any(|&(f, r)| {
            let series = &files[f].rows[r].series;
            !auxiliary_market(series) && !legacy_paired_market(series)
        });
        let is_paired_segment = |f: usize, r: usize| {
            let series = &files[f].rows[r].series;
            auxiliary_market(series) || (has_canonical && legacy_paired_market(series))
        };
        let regular: Vec<_> = positions
            .iter()
            .copied()
            .filter(|&(f, r)| !is_paired_segment(f, r))
            .collect();
        let paired_segments: Vec<_> = positions
            .iter()
            .copied()
            .filter(|&(f, r)| is_paired_segment(f, r))
            .collect();
        // Pre-2009 archives (and some later ones) carry no ISIN column at all: an
        // absent ISIN cannot disprove identity, so it must not disable the
        // market-segment rule when the regular row is equally ISIN-less. A
        // present ISIN must be a 12-character Indian identifier, and a segment
        // row that carries one must match it.
        let isin_ok = |isin: &str| isin.is_empty() || (isin.len() == 12 && isin.starts_with("IN"));
        let primary = regular.first().map(|&(f, r)| &files[f].rows[r]);
        let qualified = !unknown
            && !class_conflict
            && primary.map_or(false, |primary| {
                let invit_block_pair = matches!(primary.series.as_str(), "IV" | "ID")
                    && !paired_segments.is_empty()
                    && paired_segments.iter().all(|&(f, r)| {
                        let segment = &files[f].rows[r];
                        segment.series == "BL" && same_present_isin(primary, segment)
                    });
                let t0_identity_ok = paired_segments.iter().all(|&(f, r)| {
                    let segment = &files[f].rows[r];
                    segment.series != "T0"
                        || (primary.series == "EQ" && same_present_isin(primary, segment))
                });
                (classify(&primary.series) == SecurityClass::Equity || invit_block_pair)
                    && t0_identity_ok
                    && isin_ok(&primary.isin)
                    && regular
                        .iter()
                        .all(|&(f, r)| equal_rows(primary, &files[f].rows[r]))
                    && paired_segments.iter().all(|&(f, r)| {
                        let other = &files[f].rows[r].isin;
                        if other.is_empty() {
                            primary.isin.is_empty()
                        } else {
                            other == &primary.isin
                        }
                    })
            });
        let auxiliary_only = !unknown && !class_conflict && regular.is_empty();
        if !paired_segments.is_empty() && (qualified || auxiliary_only) {
            for &(f, r) in &paired_segments {
                masks[f][r] = false;
                reports[f].market_rows += 1;
                reasons.insert(
                    (f, r),
                    if auxiliary_market(&files[f].rows[r].series) {
                        "AUXILIARY_MARKET_QUOTE"
                    } else {
                        "LEGACY_MARKET_QUOTE"
                    },
                );
            }
        }
        if auxiliary_only {
            continue;
        }
        let candidates = if qualified { &regular } else { positions };
        let (first_file, first_row) = candidates[0];
        let first = &files[first_file].rows[first_row];
        let conflict = unknown
            || class_conflict
            || candidates
                .iter()
                .any(|&(f, r)| !equal_rows(first, &files[f].rows[r]));
        if conflict {
            for &(f, r) in positions {
                masks[f][r] = false;
                reports[f].conflicted += 1;
                reasons.insert(
                    (f, r),
                    if unknown {
                        "UNQUALIFIED_SECURITY_SERIES"
                    } else if class_conflict {
                        "SYMBOL_SECURITY_CLASS_CONFLICT"
                    } else {
                        "UNEQUAL_SECURITY_OR_PRICE_ROWS"
                    },
                );
            }
        } else {
            for &(f, r) in candidates.iter().skip(1) {
                masks[f][r] = false;
                reports[f].duplicates += 1;
                reasons.insert((f, r), "IDENTICAL_DUPLICATE");
            }
        }
    }
    if !reasons.is_empty() {
        // Keep ALL input rows for affected files (including admitted equity), exact
        // binary fields, and positional references; never overwrite prior evidence.
        // Evidence persistence failure aborts before any metadata or price mutation.
        let mut evidence_rows = Vec::new();
        for (fi, file) in files
            .iter()
            .enumerate()
            .filter(|(i, _)| reports[*i].message().is_some())
        {
            for (ri, row) in file.rows.iter().enumerate() {
                evidence_rows.push(serde_json::json!({
                    "fileIndex":fi,"rowIndex":ri,"exchange":file.exchange,"tradeDate":file.trade_date,
                    "symbol":row.symbol,"series":row.series,"isin":row.isin,"rowTradeDate":row.trade_date,
                    "instrumentName":row.instrument_name,"open":row.open,"high":row.high,"low":row.low,
                    "close":row.close,"prevClose":row.prev_close,"volume":row.volume,"oi":row.oi,"trades":row.trades,
                    // The decoded binary record is intentionally NOT duplicated here:
                    // it is a debug rendering of the numeric fields above and doubled
                    // the evidence size (a repair run produces >250 MB per year).
                    "admitted":masks[fi][ri],
                    "reason":reasons.get(&(fi,ri)).copied().unwrap_or("ADMITTED")
                }));
            }
        }
        let directory = database_path
            .parent()
            .ok_or("Database path has no parent")?
            .join("bhavcopy_admission");
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let path = directory.join(format!(
            "security-{}-{}-{}.json",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
            std::process::id(),
            AUDIT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        let data = serde_json::to_vec(&serde_json::json!({"schema":"nse-security-admission-v2","classification":"NSE legend 2024-09-19 and SBIN listing 2010-11-11; BHAV-03A T0 settlement and identity-matched InvIT BL","rows":evidence_rows,"reports":reports})).map_err(|e|e.to_string())?;
        let mut output = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)
            .map_err(|e| e.to_string())?;
        output
            .write_all(&data)
            .and_then(|_| output.sync_all())
            .map_err(|e| e.to_string())?;
        for report in &mut reports {
            if report.message().is_some() {
                report.evidence = Some(path.to_string_lossy().into_owned());
            }
        }
    }
    Ok(Admission { masks, reports })
}

pub(crate) fn filter_files(
    files: &[ParsedBhavcopyFile],
    admission: &Admission,
) -> Vec<ParsedBhavcopyFile> {
    files
        .iter()
        .zip(&admission.masks)
        .map(|(file, mask)| {
            let rows: Vec<_> = file
                .rows
                .iter()
                .zip(mask)
                .filter(|(_, keep)| **keep)
                .map(|(r, _)| r.clone())
                .collect();
            let max_volume = rows
                .iter()
                .map(|r| r.volume.max(0) as u64)
                .max()
                .unwrap_or(0);
            ParsedBhavcopyFile {
                exchange: file.exchange.clone(),
                trade_date: file.trade_date.clone(),
                rows,
                max_volume,
                debug: file.debug.clone(),
            }
        })
        .collect()
}

pub(crate) fn require_replay_safe(
    database_path: &Path,
    files: &[ParsedBhavcopyFile],
) -> AppResult<()> {
    let admission = admit(database_path, files)?;
    if admission
        .reports
        .iter()
        .any(|r| r.conflicted > 0 || r.separated > 0 || r.market_rows > 0)
    {
        return Err(format!(
            "Bhavcopy recovery requires security requalification before any restore/replay: {}",
            admission
                .reports
                .iter()
                .filter_map(AdmissionReport::message)
                .collect::<Vec<_>>()
                .join("; ")
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests;
