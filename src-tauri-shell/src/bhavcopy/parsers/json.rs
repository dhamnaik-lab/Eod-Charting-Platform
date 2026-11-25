use chrono::NaiveDate;
use csv::WriterBuilder;

use super::csv::{
    is_missing_index_value, map_index_symbol, normalize_index_key, normalize_trade_date_value,
    parse_decimal,
};
use crate::bhavcopy::types::{
    AppResult, NseIndexHistoryInsertRow, NseIndexHistoryNormalizeResult, NseIndexHistoryRow,
};

pub const BSE_INDEX_VOLUME_CRORE_UNITS: f64 = 10_000_000.0;

pub fn normalize_bse_index_archive_json(
    buffer: &[u8],
    trade_date: &str,
) -> AppResult<Option<String>> {
    let value = serde_json::from_slice::<serde_json::Value>(buffer)
        .map_err(|error| format!("BSE Index archive API JSON parse failed: {error}"))?;
    if value.get("error").and_then(|flag| flag.as_bool()) == Some(true) {
        return Err("BSE Index archive API reported an error.".into());
    }
    let Some(rows) = value.get("Table").and_then(|value| value.as_array()) else {
        return Err("BSE Index archive API missing expected Table array.".into());
    };
    if rows.is_empty() {
        return Ok(None);
    }

    let mut writer = WriterBuilder::new()
        .has_headers(false)
        .from_writer(Vec::<u8>::new());
    writer
        .write_record([
            "INDEX_NAME",
            "INDEX_DATE",
            "OPEN_INDEX_VALUE",
            "HIGH_INDEX_VALUE",
            "LOW_INDEX_VALUE",
            "CLOSING_INDEX_VALUE",
            "PREV_CLOSE",
            "VOLUME",
        ])
        .map_err(|error| error.to_string())?;

    let mut usable_rows = 0_usize;
    for row in rows {
        let name = json_scalar_to_string(row.get("I_name"));
        if name.is_empty() {
            continue;
        }

        let raw_date = json_scalar_to_string(row.get("date"));
        let Some(normalized_date) = normalize_trade_date_value(&raw_date) else {
            return Err(format!(
                "BSE Index archive returned unrecognized date: {raw_date}"
            ));
        };
        if normalized_date != trade_date {
            return Err(format!(
                "BSE Index archive date mismatch: requested {trade_date}, response contains {normalized_date}"
            ));
        }

        let open = json_scalar_to_string(row.get("I_open"));
        let high = json_scalar_to_string(row.get("I_high"));
        let low = json_scalar_to_string(row.get("I_low"));
        let close = json_scalar_to_string(row.get("I_close"));
        if [open.as_str(), high.as_str(), low.as_str(), close.as_str()]
            .iter()
            .any(|value| is_missing_index_value(value))
        {
            continue;
        }

        let prev_close = json_scalar_to_string(row.get("Prev_Close"));
        let raw_volume = json_scalar_to_string(row.get("Volume"));
        let volume = if raw_volume.is_empty() {
            0_i64
        } else {
            (parse_decimal(&raw_volume) * BSE_INDEX_VOLUME_CRORE_UNITS)
                .round()
                .max(0.0) as i64
        };

        writer
            .write_record([
                name,
                normalized_date,
                open,
                high,
                low,
                close,
                prev_close,
                volume.to_string(),
            ])
            .map_err(|error| error.to_string())?;
        usable_rows += 1;
    }

    if usable_rows == 0 {
        return Err("BSE Index archive contained no usable rows.".into());
    }

    let bytes = writer.into_inner().map_err(|error| error.to_string())?;
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|error| format!("BSE Index normalized CSV was not UTF-8: {error}"))
}

pub fn json_scalar_to_string(value: Option<&serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(value)) => value.trim().to_string(),
        Some(serde_json::Value::Number(value)) => value.to_string(),
        Some(serde_json::Value::Bool(value)) => value.to_string(),
        _ => String::new(),
    }
}

pub fn normalize_nse_index_history_rows(
    rows: &[NseIndexHistoryRow],
    canonical_symbol: &str,
    requested_index_type: &str,
) -> NseIndexHistoryNormalizeResult {
    let mut normalized_rows = Vec::new();
    let mut close_only_skipped = 0_usize;

    for row in rows {
        let Some(timestamp) = row.timestamp.as_deref() else {
            continue;
        };
        let Ok(parsed_date) = NaiveDate::parse_from_str(timestamp, "%d-%b-%Y") else {
            continue;
        };

        let open = row.open.unwrap_or(0.0);
        let high = row.high.unwrap_or(0.0);
        let low = row.low.unwrap_or(0.0);
        let close = row.close.unwrap_or(0.0);
        if close <= 0.0 {
            continue;
        }
        if open <= 0.0 || high <= 0.0 || low <= 0.0 {
            close_only_skipped += 1;
            continue;
        }

        let instrument_name = row
            .index_name
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(requested_index_type)
            .to_string();
        let symbol = map_index_symbol(&instrument_name);
        normalized_rows.push(NseIndexHistoryInsertRow {
            symbol: if symbol == normalize_index_key(&instrument_name) {
                canonical_symbol.to_string()
            } else {
                symbol
            },
            instrument_name,
            trade_date: parsed_date.format("%Y-%m-%d").to_string(),
            open,
            high,
            low,
            close,
            volume: row.traded_qty.unwrap_or(0.0).max(0.0).round() as u64,
        });
    }

    NseIndexHistoryNormalizeResult {
        rows: normalized_rows,
        close_only_skipped,
    }
}
