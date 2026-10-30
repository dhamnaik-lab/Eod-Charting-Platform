use std::collections::HashSet;
use rusqlite::{params, OptionalExtension};
use tauri::AppHandle;

use crate::database::get_active_database_file_path;
use crate::bhavcopy::calendar::parse_trade_date;
use crate::bhavcopy::ingestion::open_database_connection;
use crate::bhavcopy::types::*;

pub const SETTINGS_KEY: &str = "bhavcopy_settings";

#[tauri::command]
pub fn get_bhavcopy_default_templates() -> BhavcopyDefaultTemplates {
    BhavcopyDefaultTemplates {
        nse_equity: vec![
            "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv".to_string(),
            "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{date_key}_F_0000.csv.zip".to_string(),
            "https://archives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip".to_string(),
            "https://nsearchives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip".to_string(),
        ],
        nse_index: vec![
            "https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv".to_string(),
            "https://www.nseindia.com/archives/nseidx/bhav.csv".to_string(),
        ],
        bse_equity: vec![
            "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{date_key}_F_0000.CSV".to_string(),
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=equity&date={date_key}".to_string(),
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP".to_string(),
        ],
        bse_index: vec![
            "https://www.bseindia.com/bsedata/Index_Bhavcopy/IndexSummary_{ddmmyyyy}.csv".to_string(),
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=IndexSum&date={date_key}".to_string(),
        ],
    }
}

#[tauri::command]
pub fn get_bhavcopy_settings(app: AppHandle) -> AppResult<BhavcopySettings> {
    let Some(database_file_path) = get_active_database_file_path(&app)? else {
        return Ok(default_settings());
    };
    let connection = open_database_connection(&database_file_path)?;
    let stored = connection
        .query_row(
            "
              SELECT value
              FROM settings
              WHERE key = ?
            ",
            params![SETTINGS_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(stored
        .as_deref()
        .and_then(|raw| serde_json::from_str::<StoredBhavcopySettings>(raw).ok())
        .map(merge_settings_with_defaults)
        .unwrap_or_else(default_settings))
}

#[tauri::command]
pub fn save_bhavcopy_settings(
    app: AppHandle,
    settings: BhavcopySettings,
) -> AppResult<OperationResult> {
    let Some(database_file_path) = get_active_database_file_path(&app)? else {
        return Ok(OperationResult { success: true });
    };
    let connection = open_database_connection(&database_file_path)?;
    let normalized = normalize_settings(settings);
    let raw = serde_json::to_string(&normalized).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
              INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            ",
            params![SETTINGS_KEY, raw],
        )
        .map_err(|error| error.to_string())?;

    Ok(OperationResult { success: true })
}

pub fn default_settings() -> BhavcopySettings {
    BhavcopySettings {
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        workers: 2,
        // Legacy excluded_series is retained for persisted/API/recovery compatibility,
        // but new downloads do not exclude any series during ingestion.
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
    }
}

pub fn merge_settings_with_defaults(stored: StoredBhavcopySettings) -> BhavcopySettings {
    let defaults = default_settings();
    BhavcopySettings {
        exchanges: stored.exchanges.unwrap_or(defaults.exchanges),
        workers: stored.workers.unwrap_or(defaults.workers),
        excluded_series: normalize_excluded_series(
            stored.excluded_series.unwrap_or(defaults.excluded_series),
        ),
        nse_equity_url_override: stored.nse_equity_url_override,
        nse_index_url_override: stored.nse_index_url_override,
        bse_equity_url_override: stored.bse_equity_url_override,
        bse_index_url_override: stored.bse_index_url_override,
    }
}

pub fn normalize_settings(settings: BhavcopySettings) -> BhavcopySettings {
    BhavcopySettings {
        exchanges: settings.exchanges,
        workers: settings.workers.clamp(1, 10),
        excluded_series: normalize_excluded_series(settings.excluded_series),
        nse_equity_url_override: settings
            .nse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        nse_index_url_override: settings
            .nse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_equity_url_override: settings
            .bse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_index_url_override: settings
            .bse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    }
}

pub fn normalize_batch_config(config: BatchDownloadConfig) -> AppResult<BatchDownloadConfig> {
    if matches!(config.mode, DownloadMode::Range) {
        parse_trade_date(&config.start_date)?;
        parse_trade_date(&config.end_date)?;
        if config.start_date > config.end_date {
            return Err("Start date must be on or before end date.".to_string());
        }
    }
    Ok(BatchDownloadConfig {
        mode: config.mode,
        exchanges: config.exchanges,
        start_date: config.start_date,
        end_date: config.end_date,
        workers: config.workers.clamp(1, 10),
        excluded_series: normalize_excluded_series(config.excluded_series),
        nse_equity_url_override: config
            .nse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        nse_index_url_override: config
            .nse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_equity_url_override: config
            .bse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_index_url_override: config
            .bse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    })
}

pub fn normalize_excluded_series(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::<String>::new();
    values
        .into_iter()
        .map(|value| value.trim().to_uppercase())
        .filter(|value| !value.is_empty())
        .filter(|value| seen.insert(value.clone()))
        .collect()
}
