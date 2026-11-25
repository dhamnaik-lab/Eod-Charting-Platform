//! User-facing presentation only. Raw outcomes and coverage remain authoritative.
use super::{get_exchange_holiday_name, special_trading_day_name, DownloadOutcome, DownloadResult};
use chrono::{FixedOffset, NaiveDate, Timelike, Utc};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};
use std::path::Path;

pub(super) struct ActivityClock {
    today: String,
    before_cutoff: bool,
}

impl ActivityClock {
    pub(super) fn now() -> Self {
        let ist =
            Utc::now().with_timezone(&FixedOffset::east_opt(19_800).expect("valid IST offset"));
        Self {
            today: ist.format("%Y-%m-%d").to_string(),
            before_cutoff: ist.hour() < super::UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum ActivityStatus {
    Existing,
    Imported,
    Weekend,
    Holiday,
    NotDue,
    Absent,
    Incomplete,
    Failed,
    Cancelled,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ActivityEntry {
    trade_date: String,
    exchange: String,
    rows_inserted: usize,
    status: ActivityStatus,
    message: String,
    context: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ActivityReport {
    entries: Vec<ActivityEntry>,
    calendar_warning: Option<String>,
}

fn is_date_result(result: &DownloadResult) -> bool {
    !result.diagnostic
        && matches!(
            result.exchange.as_str(),
            "NSE" | "BSE" | "NSE_INDEX" | "BSE_INDEX"
        )
        && result.trade_date.len() == 10
        && NaiveDate::parse_from_str(&result.trade_date, "%Y-%m-%d").is_ok()
}

fn absence(result: &DownloadResult, archive_absent: bool) -> bool {
    result.outcome == DownloadOutcome::ConfirmedAbsent
        || (result.outcome == DownloadOutcome::PartialCoverage
            && result.exchange == "NSE_INDEX"
            && result.rows_inserted == 0
            && archive_absent
            && result
                .message
                .starts_with("No data available for this date"))
}

fn source_reason(result: &DownloadResult) -> &'static str {
    let message = &result.message;
    match result.outcome {
        DownloadOutcome::SourceRejected if message.contains("Archive date mismatch") => {
            "Archive date mismatch"
        }
        DownloadOutcome::SourceRejected if message.contains("Invalid index OHLC") => {
            "Invalid index OHLC"
        }
        DownloadOutcome::SourceRejected => "Source data rejected",
        DownloadOutcome::SourceError if message.contains("HTTP 403") => "HTTP 403",
        DownloadOutcome::SourceError if message.contains("invalid HTTP header") => {
            "Invalid HTTP header"
        }
        DownloadOutcome::SourceError => "Source request failed",
        DownloadOutcome::ImportError => "Import failed — inspect recovery evidence",
        DownloadOutcome::WorkerError => "Download worker failed",
        _ => "Download failed",
    }
}

fn classify(
    result: &DownloadResult,
    clock: &ActivityClock,
    holiday: Option<&str>,
    special: Option<&str>,
    archive_absent: bool,
) -> ActivityEntry {
    use ActivityStatus as Status;
    let absent = absence(result, archive_absent);
    let contextual_source_miss = absent
        || result.outcome == DownloadOutcome::SourceError
        || (result.outcome == DownloadOutcome::SourceRejected
            && result.message.contains("Archive date mismatch"));
    let not_due = result.trade_date > clock.today
        || (result.trade_date == clock.today && clock.before_cutoff);
    let mut context = special.map(str::to_owned);
    let (status, message) = match result.outcome {
        DownloadOutcome::Imported => (Status::Imported, format!("+{} rows", result.rows_inserted)),
        DownloadOutcome::AlreadyPresent => (Status::Existing, "Already imported".into()),
        DownloadOutcome::CalendarSkip => {
            let message = if result.message.starts_with("Weekend (")
                && !result.message.contains("Exchange holiday")
            {
                "Weekend — not requested".to_owned()
            } else {
                result.message.clone()
            };
            (Status::Weekend, message)
        }
        DownloadOutcome::Cancelled => (Status::Cancelled, "Cancelled — not completed".into()),
        _ if contextual_source_miss => {
            let reason = if absent {
                "No data available"
            } else {
                source_reason(result)
            };
            if let Some(name) = holiday.filter(|_| special.is_none()) {
                context = Some(format!("Saved holiday: {name}"));
                (Status::Holiday, reason.into())
            } else if not_due {
                let due_context = if result.trade_date > clock.today {
                    "Future date".to_owned()
                } else {
                    format!(
                        "Before {}:00 IST Bhavcopy cutoff",
                        super::UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR
                    )
                };
                context = Some(match context {
                    Some(event) => format!("{event}; {due_context}"),
                    None => due_context,
                });
                (Status::NotDue, reason.into())
            } else if absent {
                (Status::Absent, "No data available (unresolved)".into())
            } else {
                (Status::Failed, reason.into())
            }
        }
        DownloadOutcome::PartialCoverage => (
            Status::Incomplete,
            format!("Partial coverage (+{} rows)", result.rows_inserted),
        ),
        _ => (Status::Failed, source_reason(result).into()),
    };
    ActivityEntry {
        trade_date: result.trade_date.clone(),
        exchange: result.exchange.clone(),
        rows_inserted: result.rows_inserted,
        status,
        message,
        context,
    }
}

pub(super) fn build_report(
    database_file_path: &Path,
    results: &[DownloadResult],
    prefiltered: &[DownloadResult],
    clock: &ActivityClock,
) -> ActivityReport {
    // The read-only lookup is informational and never changes the raw outcome.
    let mut connection = None;
    let mut calendar_warning = None;
    let archive_absences: HashSet<_> = results
        .iter()
        .filter_map(|result| {
            if result.diagnostic && result.outcome == DownloadOutcome::ConfirmedAbsent {
                result
                    .trade_date
                    .strip_suffix(" archive")
                    .map(|date| (result.exchange.as_str(), date))
            } else {
                None
            }
        })
        .collect();
    let mut terminal = BTreeMap::new();
    for result in prefiltered
        .iter()
        .chain(results)
        .filter(|r| is_date_result(r))
    {
        terminal.insert((&result.trade_date, &result.exchange), result);
    }
    let mut entries = Vec::with_capacity(terminal.len());
    for (_, result) in terminal {
        let special = special_trading_day_name(&result.exchange, &result.trade_date);
        let archive_absent =
            archive_absences.contains(&(result.exchange.as_str(), result.trade_date.as_str()));
        let needs_context = absence(result, archive_absent)
            || matches!(
                result.outcome,
                DownloadOutcome::SourceError | DownloadOutcome::SourceRejected
            );
        let mut holiday = None;
        if needs_context && special.is_none() {
            let opened = connection.get_or_insert_with(|| {
                Connection::open_with_flags(database_file_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            });
            if let Err(error) = &*opened {
                calendar_warning.get_or_insert_with(|| error.to_string());
            }
            if let Ok(conn) = &*opened {
                match get_exchange_holiday_name(conn, &result.exchange, &result.trade_date) {
                    Ok(name) => holiday = name,
                    Err(error) => {
                        calendar_warning.get_or_insert(error);
                    }
                }
            }
        }
        entries.push(classify(
            result,
            clock,
            holiday.as_deref(),
            special,
            archive_absent,
        ));
    }
    ActivityReport {
        entries,
        calendar_warning,
    }
}

#[cfg(test)]
mod tests {
    use super::super::{failed_download_result, skipped_download_result};
    use super::*;
    fn clock(before_cutoff: bool) -> ActivityClock {
        ActivityClock {
            today: "2026-11-25".into(),
            before_cutoff,
        }
    }
    fn failure(
        exchange: &str,
        date: &str,
        outcome: DownloadOutcome,
        message: &str,
    ) -> DownloadResult {
        failed_download_result(exchange, date, message).with_outcome(outcome)
    }
    #[test]
    fn bhav02_holiday_context_does_not_mutate_source_failure() {
        let result = failure(
            "BSE_INDEX",
            "2026-11-24",
            DownloadOutcome::SourceError,
            "HTTP 403: source request blocked",
        );
        let entry = classify(&result, &clock(true), Some("Fixture holiday"), None, false);
        assert_eq!(entry.status, ActivityStatus::Holiday);
        assert_eq!(entry.message, "HTTP 403");
        assert_eq!(
            entry.context.as_deref(),
            Some("Saved holiday: Fixture holiday")
        );
        assert_eq!(result.outcome, DownloadOutcome::SourceError);
        assert!(!result.success);
        assert_eq!(
            classify(&result, &clock(true), None, None, false).status,
            ActivityStatus::Failed
        );
    }
    #[test]
    fn bhav02_current_date_cutoff_is_context_only() {
        let result = failure(
            "BSE",
            "2026-11-25",
            DownloadOutcome::SourceError,
            "invalid HTTP header parsed",
        );
        assert_eq!(
            classify(&result, &clock(true), None, None, false).status,
            ActivityStatus::NotDue
        );
        assert_eq!(
            classify(&result, &clock(false), None, None, false).status,
            ActivityStatus::Failed
        );
        let mut valid = result.clone().with_outcome(DownloadOutcome::Imported);
        valid.rows_inserted = 9;
        assert_eq!(
            classify(&valid, &clock(true), Some("Stale holiday"), None, false).status,
            ActivityStatus::Imported
        );
    }
    #[test]
    fn bhav02_never_hides_import_worker_or_invalid_ohlc_errors() {
        for (outcome, message) in [
            (DownloadOutcome::ImportError, "write failed"),
            (DownloadOutcome::WorkerError, "panic"),
            (
                DownloadOutcome::SourceRejected,
                "Invalid index OHLC for Nifty50 USD",
            ),
        ] {
            let result = failure("NSE_INDEX", "2026-11-25", outcome, message);
            assert_eq!(
                classify(&result, &clock(true), Some("Fixture holiday"), None, false).status,
                ActivityStatus::Failed
            );
        }
    }
    #[test]
    fn bhav02_special_session_and_absence_stay_unresolved() {
        let result = skipped_download_result("NSE", "2026-11-08", "No data available")
            .with_outcome(DownloadOutcome::ConfirmedAbsent);
        let entry = classify(
            &result,
            &clock(true),
            Some("Stale holiday"),
            Some("Muhurat Trading"),
            false,
        );
        assert_eq!(entry.status, ActivityStatus::Absent);
        assert_eq!(entry.context.as_deref(), Some("Muhurat Trading"));
    }
    #[test]
    fn bhav02_index_absence_requires_archive_evidence() {
        let result = failure("NSE_INDEX", "2026-11-24", DownloadOutcome::PartialCoverage, "No data available for this date (all candidates reported absence); no final NSE index import reported; coverage unresolved");
        assert_eq!(
            classify(&result, &clock(true), Some("Fixture holiday"), None, false).status,
            ActivityStatus::Incomplete
        );
        assert_eq!(
            classify(&result, &clock(true), Some("Fixture holiday"), None, true).status,
            ActivityStatus::Holiday
        );
    }
    #[test]
    fn bhav02_saved_calendar_and_prefilter_results_are_date_ordered() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("calendar.db");
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch("CREATE TABLE market_holidays(date TEXT, name TEXT, source TEXT); INSERT INTO market_holidays VALUES('2026-11-24','Fixture holiday','USER');").unwrap();
        drop(conn);
        let skipped = skipped_download_result("NSE", "2026-11-23", "Already imported")
            .with_outcome(DownloadOutcome::AlreadyPresent);
        let error = failure(
            "BSE",
            "2026-11-24",
            DownloadOutcome::SourceError,
            "HTTP 403",
        );
        let report = build_report(&path, &[error], &[skipped], &clock(true));
        assert!(report.calendar_warning.is_none());
        assert_eq!(report.entries.len(), 2);
        assert_eq!(report.entries[0].status, ActivityStatus::Existing);
        assert_eq!(report.entries[1].status, ActivityStatus::Holiday);
        let unavailable_result = failure(
            "BSE",
            "2026-11-24",
            DownloadOutcome::SourceError,
            "HTTP 403",
        );
        let unavailable = build_report(
            &dir.path().join("missing.db"),
            &[unavailable_result],
            &[],
            &clock(true),
        );
        assert!(unavailable.calendar_warning.is_some());
        assert_eq!(unavailable.entries[0].status, ActivityStatus::Failed);
        let empty = build_report(&dir.path().join("missing.db"), &[], &[], &clock(true));
        assert!(empty.calendar_warning.is_none());
        assert!(!dir.path().join("missing.db").exists());
    }
}
