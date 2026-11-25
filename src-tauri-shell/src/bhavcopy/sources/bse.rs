use chrono::NaiveDate;

use super::{apply_template, EXCHANGE_UDIFF_START};
use crate::bhavcopy::transport::BSE_INDEX_ARCHIVE_API_URL;
use crate::bhavcopy::types::Candidate;

pub fn generate_bse_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    let udiff_start = NaiveDate::parse_from_str(EXCHANGE_UDIFF_START, "%Y-%m-%d")
        .expect("valid exchange UDiFF start date");
    let modern_direct = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{date_key}_F_0000.CSV",
            date,
        ),
        false,
    );
    let legacy_archive = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP",
            date,
        ),
        true,
    );
    let live_api = Candidate::bse_api(
        apply_template(
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=equity&date={date_key}",
            date,
        ),
        "https://www.bseindia.com/download/BhavCopy/Equity/",
        "dsedcudiff",
    );
    let legacy_api = Candidate::direct(
        apply_template(
            "https://api.bseindia.com/BseIndiaAPI/api/EquityBhavcopy/ws/getEquityBhavcopy?date={ddmmyyyy}",
            date,
        ),
        false,
    );
    let legacy_direct = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity_Bhavcopy_{ddmmyyyy}.csv",
            date,
        ),
        false,
    );

    if date >= udiff_start {
        candidates.extend([
            modern_direct,
            legacy_archive,
            live_api,
            legacy_api,
            legacy_direct,
        ]);
    } else {
        candidates.extend([
            legacy_archive,
            modern_direct,
            live_api,
            legacy_api,
            legacy_direct,
        ]);
    }

    candidates
}

pub fn generate_bse_index_candidates(
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
                "https://www.bseindia.com/bsedata/Index_Bhavcopy/IndexSummary_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
        Candidate::bse_index_archive(build_bse_index_archive_url(date)),
        Candidate::bse_api(
            apply_template(
                "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=IndexSum&date={date_key}",
                date,
            ),
            "https://www.bseindia.com/bsedata/Index_Bhavcopy/",
            "dsIndexSum",
        ),
        Candidate::direct(
            apply_template(
                "https://www.bseindia.com/download/BhavCopy/Index_Bhavcopy_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
    ]);

    candidates
}

pub fn build_bse_index_archive_url(date: NaiveDate) -> String {
    // BSE's historical IndexArchDailyAllPar endpoint is sensitive to the
    // literal DD/MM/YYYY query representation. URL-encoding the slashes as
    // %2F can return HTTP 200 with an empty Table for valid trading dates.
    let api_date = date.format("%d/%m/%Y");
    format!("{BSE_INDEX_ARCHIVE_API_URL}?fmdt={api_date}&index=All&period=D&todt={api_date}")
}
