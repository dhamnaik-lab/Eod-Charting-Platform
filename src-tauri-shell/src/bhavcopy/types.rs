use std::collections::HashSet;
use serde::{Deserialize, Serialize};

pub type AppResult<T> = Result<T, String>;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub success: bool,
    pub trade_date: String,
    pub exchange: String,
    pub rows_inserted: usize,
    pub max_volume: u64,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeSelection {
    pub nse: bool,
    pub bse: bool,
    pub nse_index: bool,
    pub bse_index: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DownloadMode {
    Range,
    Update,
    FullHistory,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BhavcopySettings {
    pub exchanges: ExchangeSelection,
    pub workers: u32,
    pub excluded_series: Vec<String>,
    pub nse_equity_url_override: Option<String>,
    pub nse_index_url_override: Option<String>,
    pub bse_equity_url_override: Option<String>,
    pub bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBhavcopySettings {
    pub exchanges: Option<ExchangeSelection>,
    pub workers: Option<u32>,
    pub excluded_series: Option<Vec<String>>,
    pub nse_equity_url_override: Option<String>,
    pub nse_index_url_override: Option<String>,
    pub bse_equity_url_override: Option<String>,
    pub bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDownloadConfig {
    pub mode: DownloadMode,
    pub exchanges: ExchangeSelection,
    pub start_date: String,
    pub end_date: String,
    pub workers: u32,
    pub excluded_series: Vec<String>,
    pub nse_equity_url_override: Option<String>,
    pub nse_index_url_override: Option<String>,
    pub bse_equity_url_override: Option<String>,
    pub bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OperationResult {
    pub success: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub progress: u32,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BhavcopyDefaultTemplates {
    pub nse_equity: Vec<String>,
    pub nse_index: Vec<String>,
    pub bse_equity: Vec<String>,
    pub bse_index: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketHoliday {
    pub id: i64,
    pub date: String,
    pub name: String,
    pub source: String,
}

#[derive(Clone, Debug)]
pub struct Candidate {
    pub url: String,
    pub zipped: bool,
    pub bse_download_base: Option<&'static str>,
    pub bse_response_key: Option<&'static str>,
    pub bse_index_archive_json: bool,
}

impl Candidate {
    pub fn direct(url: String, zipped: bool) -> Self {
        Self {
            url,
            zipped,
            bse_download_base: None,
            bse_response_key: None,
            bse_index_archive_json: false,
        }
    }

    pub fn bse_api(url: String, download_base: &'static str, response_key: &'static str) -> Self {
        Self {
            url,
            zipped: false,
            bse_download_base: Some(download_base),
            bse_response_key: Some(response_key),
            bse_index_archive_json: false,
        }
    }

    pub fn bse_index_archive(url: String) -> Self {
        Self {
            url,
            zipped: false,
            bse_download_base: None,
            bse_response_key: None,
            bse_index_archive_json: true,
        }
    }
}

#[derive(Clone, Debug)]
pub struct NseIndexHistoryTask {
    pub index_type: String,
    pub symbol: String,
    pub from_date: String,
    pub to_date: String,
}

#[derive(Clone, Debug)]
pub struct DownloadTask {
    pub exchange: String,
    pub trade_date: String,
    pub mode: DownloadMode,
    pub candidates: Vec<Candidate>,
    pub nse_index_history: Option<NseIndexHistoryTask>,
}

pub struct StagedDownload {
    pub task: DownloadTask,
    pub content: StagedDownloadContent,
}

pub enum StagedDownloadContent {
    Csv(String),
    NseIndexHistory(NseIndexHistoryNormalizeResult),
}

pub enum StagedDownloadOutcome {
    Cancelled,
    Ready(StagedDownload),
    Result(DownloadResult),
}

pub struct BatchPlan {
    pub info_messages: Vec<String>,
    pub calendar_skip_results: Vec<DownloadResult>,
    pub tasks: Vec<DownloadTask>,
}

#[derive(Default)]
pub struct ImportedTradeDates {
    pub dates: HashSet<String>,
    pub stale_zero_volume_dates: usize,
    pub metadata_only_dates: usize,
    pub metadata_lookup_ms: u128,
    pub binary_reconcile_ms: u128,
    pub binary_reconcile_files_scanned: usize,
    pub binary_reconcile_target_dates: usize,
}

pub struct ParseInsertResult {
    pub(crate) admission: super::security_admission::AdmissionReport,
    pub rows_inserted: usize,
    pub max_volume: u64,
    pub debug: Option<String>,
}

// Normalization remains covered by tests, while the legacy history writer
// rejects the import without reading these fields.
#[allow(dead_code)]
pub struct NseIndexHistoryInsertRow {
    pub symbol: String,
    pub instrument_name: String,
    pub trade_date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: u64,
}

#[allow(dead_code)]
pub struct NseIndexHistoryNormalizeResult {
    pub rows: Vec<NseIndexHistoryInsertRow>,
    pub close_only_skipped: usize,
}

pub struct NseIndexHistoryInsertResult {
    pub rows_inserted: usize,
    pub max_volume: u64,
    pub close_only_skipped: usize,
}

#[derive(Debug, Deserialize)]
pub struct NseIndexHistoryResponse {
    pub data: Option<Vec<NseIndexHistoryRow>>,
    pub error: Option<bool>,
    #[serde(rename = "showMessage")]
    pub show_message: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct NseIndexHistoryRow {
    #[serde(rename = "EOD_INDEX_NAME")]
    pub index_name: Option<String>,
    #[serde(rename = "EOD_OPEN_INDEX_VAL")]
    pub open: Option<f64>,
    #[serde(rename = "EOD_HIGH_INDEX_VAL")]
    pub high: Option<f64>,
    #[serde(rename = "EOD_LOW_INDEX_VAL")]
    pub low: Option<f64>,
    #[serde(rename = "EOD_CLOSE_INDEX_VAL")]
    pub close: Option<f64>,
    #[serde(rename = "HIT_TRADED_QTY")]
    pub traded_qty: Option<f64>,
    #[serde(rename = "EOD_TIMESTAMP")]
    pub timestamp: Option<String>,
}
