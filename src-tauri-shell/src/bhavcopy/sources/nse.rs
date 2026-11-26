use chrono::{Duration, NaiveDate};
use reqwest::Url;

use super::{apply_template, EXCHANGE_UDIFF_START};
use crate::bhavcopy::calendar::parse_trade_date;
use crate::bhavcopy::transport::NSE_INDEX_HISTORY_API_URL;
use crate::bhavcopy::types::{AppResult, Candidate, DownloadTask, NseIndexHistoryTask};

pub fn generate_nse_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    let udiff_start = NaiveDate::parse_from_str(EXCHANGE_UDIFF_START, "%Y-%m-%d")
        .expect("valid exchange UDiFF start date");
    let new_path = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{date_key}_F_0000.csv.zip",
            date,
        ),
        true,
    );
    let sec_full_path = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv",
            date,
        ),
        false,
    );
    let legacy_primary = Candidate::direct(
        apply_template(
            "https://archives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip",
            date,
        ),
        true,
    );
    let legacy_secondary = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip",
            date,
        ),
        true,
    );

    if date >= udiff_start {
        candidates.extend([new_path, sec_full_path, legacy_primary, legacy_secondary]);
    } else {
        candidates.extend([legacy_primary, legacy_secondary, new_path, sec_full_path]);
    }

    candidates
}

pub fn generate_nse_index_candidates(
    date: NaiveDate,
    url_override: Option<&String>,
) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    candidates.extend(vec![
        Candidate::direct(
            apply_template(
                "https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
        Candidate::direct(
            "https://www.nseindia.com/archives/nseidx/bhav.csv".to_string(),
            false,
        ),
    ]);

    candidates
}

#[allow(dead_code)]
pub fn generate_nse_index_history_tasks(
    start_date: &str,
    end_date: &str,
) -> AppResult<Vec<DownloadTask>> {
    let start = parse_trade_date(start_date)?;
    let end = parse_trade_date(end_date)?;
    let index_types = [("NIFTY 50", "NIFTY"), ("NIFTY BANK", "BANKNIFTY")];
    let mut tasks = Vec::new();
    let mut chunk_start = start;

    while chunk_start <= end {
        let chunk_end = std::cmp::min(chunk_start + Duration::days(364), end);
        let from_date = chunk_start.format("%Y-%m-%d").to_string();
        let to_date = chunk_end.format("%Y-%m-%d").to_string();

        for (index_type, symbol) in index_types {
            tasks.push(DownloadTask {
                exchange: "NSE_INDEX".to_string(),
                trade_date: format!("{from_date}..{to_date} {symbol}"),
                candidates: Vec::new(),
                nse_index_history: Some(NseIndexHistoryTask {
                    index_type: index_type.to_string(),
                    symbol: symbol.to_string(),
                    from_date: from_date.clone(),
                    to_date: to_date.clone(),
                }),
            });
        }

        chunk_start = chunk_end + Duration::days(1);
    }

    Ok(tasks)
}

pub fn build_nse_index_history_url(history_task: &NseIndexHistoryTask) -> AppResult<String> {
    let from_date = parse_trade_date(&history_task.from_date)?
        .format("%d-%m-%Y")
        .to_string();
    let to_date = parse_trade_date(&history_task.to_date)?
        .format("%d-%m-%Y")
        .to_string();
    let mut url = Url::parse(NSE_INDEX_HISTORY_API_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("indexType", &history_task.index_type)
        .append_pair("from", &from_date)
        .append_pair("to", &to_date)
        .append_pair("csv", "true");
    Ok(url.to_string())
}
