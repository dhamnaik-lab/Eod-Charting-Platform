use std::collections::HashSet;

use crate::database::binary_eod::EodRecord;

pub mod csv;
pub mod json;
pub mod zip;

pub use csv::*;
pub use json::*;
pub use zip::*;

#[derive(Clone)]
pub struct ParsedBhavcopyRow {
    pub symbol: String,
    pub instrument_name: String,
    pub series: String,
    pub isin: String,
    pub trade_date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: i64,
    pub oi: i64,
    pub trades: Option<i64>,
    pub binary_record: EodRecord,
}

pub struct ParsedBhavcopyFile {
    pub exchange: String,
    pub trade_date: String,
    pub rows: Vec<ParsedBhavcopyRow>,
    pub max_volume: u64,
    pub debug: Option<String>,
}

pub fn find_duplicate_symbol_date_rows(parsed_files: &[ParsedBhavcopyFile]) -> (usize, Vec<String>) {
    let mut seen = HashSet::<(String, String, String)>::new();
    let mut duplicate_rows = 0_usize;
    let mut samples = Vec::<String>::new();

    for parsed in parsed_files {
        for row in &parsed.rows {
            let key = (
                parsed.exchange.clone(),
                row.symbol.clone(),
                row.trade_date.clone(),
            );
            if !seen.insert(key) {
                duplicate_rows += 1;
                if samples.len() < 8 {
                    samples.push(format!(
                        "{}:{}@{}",
                        parsed.exchange, row.symbol, row.trade_date
                    ));
                }
            }
        }
    }

    (duplicate_rows, samples)
}
