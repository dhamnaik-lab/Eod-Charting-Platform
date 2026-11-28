use super::{normalize_isin, CorporateActionImportResolutionSuggestion, CorporateActionImportRow};
use crate::database::AppResult;
use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;

const HISTORICAL_ISIN_BOOTSTRAP_DECISION_TYPE: &str = "HISTORICAL_ISIN_BOOTSTRAP_V1_9_2";
const VERIFIED_QUICK_RESOLUTION_DECISION_TYPE: &str = "VERIFIED_QUICK_RESOLUTION";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct VerifiedHistoricalIsinTransition {
    pub transition_import_id: i64,
    pub approved_corporate_action_id: i64,
    pub transition_date: String,
    pub historical_isin: String,
    pub current_isin: String,
}

#[derive(Clone, Debug)]
struct TransitionCandidate {
    transition_import_id: i64,
    approved_corporate_action_id: i64,
    transition_date: String,
}

fn table_exists(connection: &Connection, table: &str) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            params![table],
            |_| Ok(()),
        )
        .optional()
        .map(|row| row.is_some())
        .map_err(|error| error.to_string())
}

fn table_has_columns(connection: &Connection, table: &str, required: &[&str]) -> AppResult<bool> {
    if !table_exists(connection, table)? {
        return Ok(false);
    }
    let sql = format!("PRAGMA table_info({table})");
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<HashSet<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(required.iter().all(|column| columns.contains(*column)))
}

fn transition_schema_available(connection: &Connection) -> AppResult<bool> {
    Ok(table_has_columns(
        connection,
        "corporate_action_imports",
        &[
            "id",
            "exchange",
            "symbol",
            "isin",
            "ex_date",
            "action_type",
            "parse_status",
            "review_status",
            "approved_corporate_action_id",
        ],
    )? && table_has_columns(
        connection,
        "corporate_actions",
        &[
            "id",
            "exchange",
            "symbol",
            "isin",
            "effective_date",
            "action_type",
        ],
    )? && table_has_columns(
        connection,
        "instrument_isin_history",
        &["exchange", "symbol", "isin", "effective_date"],
    )? && table_has_columns(
        connection,
        "corporate_action_import_decisions",
        &[
            "import_id",
            "decision_type",
            "previous_symbol",
            "previous_exchange",
            "previous_isin",
            "resolved_symbol",
            "resolved_exchange",
            "resolved_isin",
            "reason",
        ],
    )?)
}

fn exact_transition_history_is_unambiguous(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    historical_isin: &str,
    transition_date: &str,
) -> AppResult<bool> {
    let (matching, conflicting): (i64, i64) = connection
        .query_row(
            "
              SELECT
                SUM(CASE WHEN UPPER(isin) = ? THEN 1 ELSE 0 END),
                SUM(CASE WHEN UPPER(isin) <> ? THEN 1 ELSE 0 END)
              FROM instrument_isin_history
              WHERE UPPER(exchange) = ?
                AND UPPER(symbol) = ?
                AND effective_date = ?
            ",
            params![
                historical_isin,
                historical_isin,
                exchange,
                symbol,
                transition_date,
            ],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?.unwrap_or(0),
                    row.get::<_, Option<i64>>(1)?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| error.to_string())?;
    Ok(matching >= 1 && conflicting == 0)
}

fn has_bootstrap_transition_decision(
    connection: &Connection,
    transition_import_id: i64,
    exchange: &str,
    symbol: &str,
    historical_isin: &str,
    current_isin: &str,
    transition_date: &str,
) -> AppResult<bool> {
    let tuple = format!(
        "tuple={}:{}:{}:{}->{};",
        exchange, symbol, transition_date, historical_isin, current_isin
    );
    connection
        .query_row(
            "
              SELECT EXISTS (
                SELECT 1
                FROM corporate_action_import_decisions
                WHERE import_id = ?
                  AND decision_type = ?
                  AND UPPER(COALESCE(previous_symbol, '')) = ?
                  AND UPPER(COALESCE(previous_exchange, '')) = ?
                  AND UPPER(COALESCE(previous_isin, '')) = ?
                  AND UPPER(COALESCE(resolved_symbol, '')) = ?
                  AND UPPER(COALESCE(resolved_exchange, '')) = ?
                  AND UPPER(COALESCE(resolved_isin, '')) = ?
                  AND INSTR(reason, ?) > 0
                LIMIT 1
              )
            ",
            params![
                transition_import_id,
                HISTORICAL_ISIN_BOOTSTRAP_DECISION_TYPE,
                symbol,
                exchange,
                historical_isin,
                symbol,
                exchange,
                historical_isin,
                tuple,
            ],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}

fn has_verified_transition_quick_resolution(
    connection: &Connection,
    transition_import_id: i64,
    exchange: &str,
    symbol: &str,
    historical_isin: &str,
) -> AppResult<bool> {
    connection
        .query_row(
            "
              SELECT EXISTS (
                SELECT 1
                FROM corporate_action_import_decisions
                WHERE import_id = ?
                  AND decision_type = ?
                  AND UPPER(COALESCE(previous_symbol, '')) = ?
                  AND UPPER(COALESCE(previous_exchange, '')) = ?
                  AND UPPER(COALESCE(previous_isin, '')) = ?
                  AND UPPER(COALESCE(resolved_symbol, '')) = ?
                  AND UPPER(COALESCE(resolved_exchange, '')) = ?
                  AND UPPER(COALESCE(resolved_isin, '')) = ?
                LIMIT 1
              )
            ",
            params![
                transition_import_id,
                VERIFIED_QUICK_RESOLUTION_DECISION_TYPE,
                symbol,
                exchange,
                historical_isin,
                symbol,
                exchange,
                historical_isin,
            ],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}

pub(super) fn load_verified_historical_isin_transition(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    suggestion: &CorporateActionImportResolutionSuggestion,
) -> AppResult<Option<VerifiedHistoricalIsinTransition>> {
    if !import_row.exchange.eq_ignore_ascii_case("NSE")
        || !matches!(
            import_row.review_status.as_str(),
            "UNRESOLVED" | "PENDING_ISIN_MISMATCH"
        )
        || import_row.approved_corporate_action_id.is_some()
        || import_row.parse_status != "PARSED"
        || !matches!(
            import_row.action_type.as_str(),
            "DIVIDEND" | "SPLIT" | "BONUS"
        )
        || !suggestion.exchange.eq_ignore_ascii_case("NSE")
    {
        return Ok(None);
    }

    let Some(raw_symbol) = import_row.symbol.as_deref() else {
        return Ok(None);
    };
    if !raw_symbol.eq_ignore_ascii_case(suggestion.symbol.as_str()) {
        return Ok(None);
    }

    let Some(historical_isin) = normalize_isin(import_row.isin.as_deref()) else {
        return Ok(None);
    };
    let Some(current_isin) = normalize_isin(suggestion.isin.as_deref()) else {
        return Ok(None);
    };
    if historical_isin == current_isin {
        return Ok(None);
    }

    let Some(event_date) = import_row.ex_date.as_deref() else {
        return Ok(None);
    };
    let event_date_value = NaiveDate::parse_from_str(event_date, "%Y-%m-%d")
        .map_err(|_| "Historical ISIN transition proof requires a valid event date.".to_string())?;

    if !transition_schema_available(connection)? {
        return Ok(None);
    }

    let exchange = import_row.exchange.to_uppercase();
    let symbol = raw_symbol.to_uppercase();
    let mut statement = connection
        .prepare(
            "
              SELECT
                cai.id,
                cai.approved_corporate_action_id,
                cai.ex_date
              FROM corporate_action_imports cai
              JOIN corporate_actions ca
                ON ca.id = cai.approved_corporate_action_id
              WHERE cai.id <> ?
                AND UPPER(cai.exchange) = ?
                AND UPPER(COALESCE(cai.symbol, '')) = ?
                AND UPPER(COALESCE(cai.isin, '')) = ?
                AND cai.action_type = 'SPLIT'
                AND cai.parse_status = 'PARSED'
                AND cai.review_status = 'APPROVED'
                AND cai.approved_corporate_action_id IS NOT NULL
                AND cai.ex_date IS NOT NULL
                AND UPPER(COALESCE(ca.exchange, '')) = ?
                AND UPPER(COALESCE(ca.symbol, '')) = ?
                AND ca.effective_date = cai.ex_date
                AND ca.action_type = 'SPLIT'
                AND UPPER(COALESCE(ca.isin, '')) = ?
              ORDER BY cai.ex_date ASC, cai.id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let candidates = statement
        .query_map(
            params![
                import_row.id,
                exchange,
                symbol,
                historical_isin,
                exchange,
                symbol,
                current_isin,
            ],
            |row| {
                Ok(TransitionCandidate {
                    transition_import_id: row.get(0)?,
                    approved_corporate_action_id: row.get(1)?,
                    transition_date: row.get(2)?,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut verified = Vec::new();
    for candidate in candidates {
        let transition_date_value =
            NaiveDate::parse_from_str(&candidate.transition_date, "%Y-%m-%d").map_err(|_| {
                "Historical ISIN transition evidence contains an invalid transition date."
                    .to_string()
            })?;
        if event_date_value >= transition_date_value {
            continue;
        }
        if !exact_transition_history_is_unambiguous(
            connection,
            &exchange,
            &symbol,
            &historical_isin,
            &candidate.transition_date,
        )? {
            continue;
        }
        if !has_bootstrap_transition_decision(
            connection,
            candidate.transition_import_id,
            &exchange,
            &symbol,
            &historical_isin,
            &current_isin,
            &candidate.transition_date,
        )? {
            continue;
        }
        if !has_verified_transition_quick_resolution(
            connection,
            candidate.transition_import_id,
            &exchange,
            &symbol,
            &historical_isin,
        )? {
            continue;
        }
        verified.push(candidate);
    }

    if verified.len() > 1 {
        return Err(format!(
            "Historical ISIN transition proof is ambiguous for {}:{}; found {} verified transition events.",
            exchange,
            symbol,
            verified.len()
        ));
    }
    let Some(candidate) = verified.into_iter().next() else {
        return Ok(None);
    };

    Ok(Some(VerifiedHistoricalIsinTransition {
        transition_import_id: candidate.transition_import_id,
        approved_corporate_action_id: candidate.approved_corporate_action_id,
        transition_date: candidate.transition_date,
        historical_isin,
        current_isin,
    }))
}
