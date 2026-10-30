use chrono::NaiveDate;
use csv::ReaderBuilder;

use super::{ParsedBhavcopyFile, ParsedBhavcopyRow};
use crate::bhavcopy::calendar::parse_trade_date;
use crate::bhavcopy::transport::is_html_response;
use crate::bhavcopy::types::AppResult;
use crate::database::binary_eod::{date_to_u32, DEFAULT_SCALE, EodRecord};

pub fn parse_bhavcopy_csv(
    csv_content: &str,
    exchange: &str,
    trade_date: &str,
    _excluded_series: &[String],
) -> AppResult<ParsedBhavcopyFile> {
    let trimmed = csv_content.trim();
    if trimmed.is_empty() {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some("Empty response received".to_string()),
        });
    }
    if is_html_response(trimmed) {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some("HTML response instead of CSV".to_string()),
        });
    }

    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(trimmed.as_bytes());
    let rows = reader
        .records()
        .filter_map(|result| match result {
            Ok(record) => {
                let row = record
                    .iter()
                    .map(|value| value.trim().to_string())
                    .collect::<Vec<_>>();
                if row.iter().all(|value| value.is_empty()) {
                    None
                } else {
                    Some(Ok(row))
                }
            }
            Err(error) => Some(Err(error.to_string())),
        })
        .collect::<Result<Vec<_>, _>>()?;

    if rows.len() < 2 {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!("Only {} lines in response", rows.len())),
        });
    }

    let headers = rows[0].clone();
    let normalized_headers = build_csv_header_index(&headers);
    let get_column_index = |names: &[&str]| -> Option<usize> {
        names
            .iter()
            .find_map(|name| normalized_headers.iter().position(|header| header == name))
    };

    let symbol_idx = get_column_index(&[
        "SYMBOL",
        "TCKRSYMB",
        "SC_CODE",
        "SC_NAME",
        "SCGROUP",
        "CODE",
        "INDEX_NAME",
        "INDEXNAME",
    ]);
    let series_idx = get_column_index(&[
        "SERIES",
        "SCTY_SRS",
        "SCTYSRS",
        "SECURITY_SERIES",
        "GROUP",
        "SC_GROUP",
    ]);
    let isin_idx = get_column_index(&["ISIN", "ISIN_CODE", "ISIN_NO", "ISIN_NUMBER"]);
    let open_idx = get_column_index(&[
        "OPEN",
        "OPEN_PRICE",
        "OPENPRICE",
        "OPEN_INDEX_VALUE",
        "OPNPRIC",
    ]);
    let high_idx = get_column_index(&[
        "HIGH",
        "HIGH_PRICE",
        "HIGHPRICE",
        "HIGH_INDEX_VALUE",
        "HGHPRIC",
    ]);
    let low_idx = get_column_index(&["LOW", "LOW_PRICE", "LOWPRICE", "LOW_INDEX_VALUE", "LWPRIC"]);
    let close_idx = get_column_index(&[
        "CLOSE",
        "CLOSE_PRICE",
        "CLOSEPRICE",
        "LTP",
        "CLOSING_INDEX_VALUE",
        "CLSPRIC",
    ]);
    let prev_close_idx =
        get_column_index(&["PREVCLOSE", "PREV_CLOSE", "PREVIOUSCLOSE", "PRVSCLSGPRIC"]);
    let volume_idx = get_column_index(&[
        "TOTTRDQTY",
        "TTL_TRD_QNTY",
        "VOLUME",
        "NOOFSHARES",
        "NO_OF_SHRS",
        "TTLTRADGVOL",
    ]);
    let trades_idx = get_column_index(&[
        "TOTALTRADES",
        "TRADES",
        "NOOFTRADES",
        "NO_OF_TRADES",
        "NO_TRADES",
        "TTLNBOFTXSEXCTD",
        "TTLNOOFTXSEXCTD",
    ]);
    let oi_idx = get_column_index(&[
        "OI",
        "OPEN_INT",
        "OPEN_INTEREST",
        "OPEN INTEREST",
        "OPEN_INT_VAL",
    ]);
    let date_idx = get_column_index(&[
        "TIMESTAMP",
        "DATE",
        "DATE1",
        "TRADE_DATE",
        "TRADE_DT",
        "TRADING_DATE",
        "INDEX_DATE",
        "TRADDT",
    ]);
    let is_index_data = get_column_index(&["INDEX_NAME", "INDEXNAME"]).is_some();

    let Some(symbol_idx) = symbol_idx else {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!(
                "Columns not found. Headers: [{}]",
                headers
                    .iter()
                    .take(8)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
        });
    };
    let Some(close_idx) = close_idx else {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!(
                "Columns not found. Headers: [{}]",
                headers
                    .iter()
                    .take(8)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
        });
    };

    let mut resolved_trade_date = trade_date.to_string();
    if let Some(date_idx) = date_idx {
        for row in rows.iter().skip(1) {
            let raw_date = get_csv_value(row, date_idx).trim().to_string();
            if raw_date.is_empty() {
                continue;
            }
            let Some(normalized_date) = normalize_trade_date_value(&raw_date) else {
                return Ok(ParsedBhavcopyFile {
                    exchange: exchange.to_string(),
                    trade_date: trade_date.to_string(),
                    rows: Vec::new(),
                    max_volume: 0,
                    debug: Some(format!("Unrecognized trade date format: {raw_date}")),
                });
            };
            if normalized_date != trade_date {
                return Ok(ParsedBhavcopyFile {
                    exchange: exchange.to_string(),
                    trade_date: trade_date.to_string(),
                    rows: Vec::new(),
                    max_volume: 0,
                    debug: Some(format!(
                        "Archive date mismatch: requested {trade_date}, file contains {normalized_date}"
                    )),
                });
            }
            resolved_trade_date = normalized_date;
            break;
        }
    }

    let normalized_exchange = exchange.to_uppercase();
    let mut max_volume = 0_u64;
    let mut parsed_rows = Vec::<ParsedBhavcopyRow>::new();

    for row in rows.iter().skip(1) {
        let series = series_idx
            .map(|idx| get_csv_value(row, idx).trim().to_uppercase())
            .unwrap_or_default();
        let isin = isin_idx
            .map(|idx| get_csv_value(row, idx).trim().to_uppercase())
            .unwrap_or_default();

        let raw_symbol = get_csv_value(row, symbol_idx).trim().to_string();
        if raw_symbol.is_empty() {
            continue;
        }

        let symbol = if is_index_data {
            let mapped = map_index_symbol(&raw_symbol);
            if mapped.is_empty() {
                continue;
            }
            mapped
        } else {
            raw_symbol.clone()
        };

        let open_raw = open_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let high_raw = high_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let low_raw = low_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let close_raw = get_csv_value(row, close_idx);

        if is_index_data
            && [
                open_raw.as_str(),
                high_raw.as_str(),
                low_raw.as_str(),
                close_raw.as_str(),
            ]
            .iter()
            .any(|value| is_missing_index_value(value))
        {
            continue;
        }

        let open_value = parse_decimal(&open_raw);
        let high_value = parse_decimal(&high_raw);
        let low_value = parse_decimal(&low_raw);
        let close_value = parse_decimal(&close_raw);
        if close_value == 0.0 && !is_index_data {
            continue;
        }

        let instrument_name = if is_index_data {
            raw_symbol.clone()
        } else {
            symbol.clone()
        };
        let prev_close_value = prev_close_idx.map(|idx| parse_decimal(&get_csv_value(row, idx)));
        let volume_value = volume_idx
            .map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64)
            .unwrap_or(0_i64);
        let oi_value = oi_idx
            .map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64)
            .unwrap_or(0_i64);
        let trades_value =
            trades_idx.map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64);

        let volume_u64 = volume_value.max(0) as u64;
        if volume_u64 > max_volume {
            max_volume = volume_u64;
        }

        parsed_rows.push(ParsedBhavcopyRow {
            symbol,
            instrument_name,
            series,
            isin,
            trade_date: resolved_trade_date.clone(),
            open: open_value,
            high: high_value,
            low: low_value,
            close: close_value,
            prev_close: prev_close_value,
            volume: volume_value,
            oi: oi_value,
            trades: trades_value,
            binary_record: EodRecord {
                date: date_to_u32(&resolved_trade_date),
                flags: 0,
                open: (open_value * DEFAULT_SCALE as f64).round() as i64,
                high: (high_value * DEFAULT_SCALE as f64).round() as i64,
                low: (low_value * DEFAULT_SCALE as f64).round() as i64,
                close: (close_value * DEFAULT_SCALE as f64).round() as i64,
                prev_close: (prev_close_value.unwrap_or(0.0) * DEFAULT_SCALE as f64).round() as i64,
                volume: volume_u64,
                oi: oi_value as u64,
            },
        });
    }

    Ok(ParsedBhavcopyFile {
        exchange: normalized_exchange,
        trade_date: resolved_trade_date,
        rows: parsed_rows,
        max_volume,
        debug: None,
    })
}

pub fn build_csv_header_index(headers: &[String]) -> Vec<String> {
    headers
        .iter()
        .map(|header| normalize_csv_header(header))
        .collect()
}

pub fn normalize_csv_header(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\u{FEFF}')
        .to_uppercase()
        .chars()
        .map(|value| {
            if value.is_ascii_alphanumeric() {
                value
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

pub fn get_csv_value(row: &[String], index: usize) -> String {
    row.get(index).cloned().unwrap_or_default()
}

pub fn parse_decimal(value: &str) -> f64 {
    value.replace(',', "").parse::<f64>().unwrap_or(0.0)
}

pub fn normalize_trade_date_value(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if parse_trade_date(trimmed).is_ok() {
        return Some(trimmed.to_string());
    }
    if let Some((date_part, _)) = trimmed.split_once('T') {
        if parse_trade_date(date_part).is_ok() {
            return Some(date_part.to_string());
        }
    }

    for format in [
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%-d/%-m/%Y",
        "%d.%m.%Y",
    ] {
        if let Ok(parsed) = NaiveDate::parse_from_str(trimmed, format) {
            return Some(parsed.format("%Y-%m-%d").to_string());
        }
    }

    None
}

pub fn normalize_index_key(name: &str) -> String {
    name.trim()
        .to_uppercase()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .collect()
}

pub fn map_index_symbol(name: &str) -> String {
    let normalized = normalize_index_key(name);
    if let Some(family) = crate::database::index_aliases::nse_index_alias_family(&normalized) {
        return family.canonical.to_string();
    }
    match normalized.as_str() {
        "NIFTY50" | "SPCNXNIFTY" | "CNXNIFTY" => "NIFTY".to_string(),
        "NIFTYBANK" | "BANKNIFTY" | "CNXBANK" => "BANKNIFTY".to_string(),
        "NIFTYFINSERVICE" | "NIFTYFINANCIALSERVICE" | "NIFTYFINANCIALSERVICES" => {
            "FINNIFTY".to_string()
        }
        "NIFTYNEXT50" => "NIFTYNEXT50".to_string(),
        "NIFTYMIDCAPSELECT" => "MIDCPNIFTY".to_string(),
        "NIFTYMIDCAP50" => "MIDCAP50".to_string(),
        "NIFTYSMALLCAP100" => "SMALLCAP100".to_string(),
        "NIFTY100" => "NIFTY100".to_string(),
        "NIFTY200" => "NIFTY200".to_string(),
        "NIFTY500" => "NIFTY500".to_string(),
        "BSESENSEX" | "SENSEX" => "SENSEX".to_string(),
        "BSEBANKEX" | "BANKEX" => "BANKEX".to_string(),
        "BSESENSEX50" | "SENSEX50" => "SENSEX50".to_string(),
        "BSESENSEXNEXT50" | "SENSEXNEXT50" => "SENSEXNEXT50".to_string(),
        other => other.to_string(),
    }
}

pub fn is_missing_index_value(value: &str) -> bool {
    matches!(
        value.trim().to_uppercase().as_str(),
        "" | "-" | "NA" | "N/A" | "NULL"
    )
}
