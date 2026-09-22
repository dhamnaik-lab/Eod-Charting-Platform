use crate::database::{
    AppResult, CorporateActionAutoApprovalDisposition, CorporateActionAutoApprovalInput,
    CorporateActionAutoApprovalResult, CorporateActionImportRow,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
use std::path::Path;

use super::{
    approve_corporate_action_import_without_transaction, get_import_row,
    is_split_bonus_validation_current, list_resolution_suggestions_for_import_row,
    load_latest_official_split_bonus_validation, record_corporate_action_import_decision,
    strict_quick_resolve_proof, validate_exact_import_lookup_ids,
    CorporateActionQuickResolveProof,
};

pub(super) const AUTO_APPROVAL_POLICY_VERSION: &str = "AUTO_APPROVAL_SAFE_V1";
const AUTO_APPROVAL_MAX_ITEMS: usize = 100;
const AUTO_APPROVAL_MIN_CONFIDENCE: f64 = 0.95;
const MACHINE_DECISION_TYPES: [&str; 3] = [
    "VERIFIED_QUICK_RESOLUTION",
    "VERIFIED_EVENT_IDENTITY_RESOLUTION",
    "VERIFIED_HISTORICAL_ISIN_TRANSITION",
];
const FORBIDDEN_DECISION_TYPES: [&str; 3] = [
    "MANUAL_RESOLUTION",
    "ISIN_MISMATCH_APPROVAL",
    "PRICE_VALIDATION_EXCEPTION",
];

#[derive(Clone, Debug, PartialEq)]
pub(super) struct AutoApprovalEvidence {
    pub identity_proof: String,
    pub scan_id: i64,
    pub scan_timestamp: String,
    pub confidence: f64,
    pub expected_factor: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) enum AutoApprovalEligibility {
    Eligible(AutoApprovalEvidence),
    Ineligible(String),
    AlreadyApproved,
}

fn normalized(value: &str) -> String {
    value.trim().to_uppercase()
}

fn load_unique_active_symbol_isin(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
) -> AppResult<Option<Option<String>>> {
    let mut statement = connection
        .prepare(
            "
              SELECT isin
              FROM instruments
              WHERE exchange = ?
                AND symbol = ?
                AND COALESCE(is_active, 1) <> 0
              ORDER BY symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange, symbol], |row| row.get::<_, Option<String>>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if rows.len() != 1 {
        return Ok(None);
    }
    Ok(Some(rows.into_iter().next().unwrap()))
}

fn has_forbidden_decision(connection: &Connection, import_id: i64) -> AppResult<bool> {
    let count = connection
        .query_row(
            "
              SELECT COUNT(*)
              FROM corporate_action_import_decisions
              WHERE import_id = ?
                AND decision_type IN (
                  'MANUAL_RESOLUTION',
                  'ISIN_MISMATCH_APPROVAL',
                  'PRICE_VALIDATION_EXCEPTION'
                )
            ",
            params![import_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(count > 0)
}

#[derive(Clone, Debug)]
struct MachineDecision {
    decision_type: String,
    resolved_symbol: Option<String>,
    resolved_exchange: Option<String>,
    resolved_isin: Option<String>,
}

fn load_latest_machine_decision(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<MachineDecision>> {
    connection
        .query_row(
            "
              SELECT decision_type, resolved_symbol, resolved_exchange, resolved_isin
              FROM corporate_action_import_decisions
              WHERE import_id = ?
                AND decision_type IN (
                  'VERIFIED_QUICK_RESOLUTION',
                  'VERIFIED_EVENT_IDENTITY_RESOLUTION',
                  'VERIFIED_HISTORICAL_ISIN_TRANSITION'
                )
              ORDER BY id DESC
              LIMIT 1
            ",
            params![import_id],
            |row| Ok(MachineDecision {
                decision_type: row.get(0)?,
                resolved_symbol: row.get(1)?,
                resolved_exchange: row.get(2)?,
                resolved_isin: row.get(3)?,
            }),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn has_same_date_split_bonus_peer(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<bool> {
    let Some(ex_date) = import_row.ex_date.as_deref() else {
        return Ok(false);
    };
    let Some(symbol) = import_row.symbol.as_deref() else {
        return Ok(false);
    };
    let mut statement = connection
        .prepare(
            "
              SELECT id
              FROM corporate_action_imports
              WHERE exchange = ?
                AND ex_date = ?
                AND id <> ?
                AND action_type IN ('SPLIT', 'BONUS')
                AND parse_status = 'PARSED'
                AND review_status <> 'REJECTED'
                AND factor IS NOT NULL
                AND factor > 0
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;
    let peer_ids = statement
        .query_map(
            params![import_row.exchange, ex_date, import_row.id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for peer_id in peer_ids {
        let peer = get_import_row(connection, peer_id)?;
        if peer.symbol.as_deref() == Some(symbol) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn machine_identity_proof(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Option<String>> {
    let Some(symbol) = import_row.symbol.as_deref() else {
        return Ok(None);
    };
    let Some(active_isin) = load_unique_active_symbol_isin(
        connection,
        import_row.exchange.as_str(),
        symbol,
    )? else {
        return Ok(None);
    };

    if let (Some(raw_isin), Some(current_isin)) = (import_row.isin.as_deref(), active_isin.as_deref()) {
        if normalized(raw_isin) == normalized(current_isin) {
            return Ok(Some("EXACT_ACTIVE_CURRENT_IDENTITY".to_string()));
        }
    }

    let Some(decision) = load_latest_machine_decision(connection, import_row.id)? else {
        return Ok(None);
    };
    if !MACHINE_DECISION_TYPES.contains(&decision.decision_type.as_str())
        || decision.resolved_symbol.as_deref() != import_row.symbol.as_deref()
        || decision.resolved_exchange.as_deref() != Some(import_row.exchange.as_str())
        || decision.resolved_isin.as_deref() != import_row.isin.as_deref()
    {
        return Ok(None);
    }

    // A recorded machine decision is provenance, not permanent authority. Re-run the
    // existing strict Quick Resolve proof against the current row/evidence so stale or
    // contradictory fingerprints/history fail closed before autonomous approval.
    let suggestions = list_resolution_suggestions_for_import_row(connection, import_row)?;
    let active = suggestions
        .iter()
        .filter(|candidate| candidate.is_active)
        .collect::<Vec<_>>();
    if active.len() != 1
        || active[0].symbol.as_str() != symbol
        || active[0].exchange.as_str() != import_row.exchange.as_str()
    {
        return Ok(None);
    }
    let mut unresolved_view = import_row.clone();
    unresolved_view.review_status = "UNRESOLVED".to_string();
    let proof = strict_quick_resolve_proof(connection, &unresolved_view, active[0])?;
    let proof_matches_decision = matches!(
        (decision.decision_type.as_str(), proof),
        ("VERIFIED_QUICK_RESOLUTION", Some(CorporateActionQuickResolveProof::ExactEventDateHistoricalIsin))
            | ("VERIFIED_EVENT_IDENTITY_RESOLUTION", Some(CorporateActionQuickResolveProof::VerifiedPersistedEventIdentity { .. }))
            | ("VERIFIED_HISTORICAL_ISIN_TRANSITION", Some(CorporateActionQuickResolveProof::VerifiedHistoricalIsinTransition { .. }))
    );
    if !proof_matches_decision {
        return Ok(None);
    }
    Ok(Some(decision.decision_type))
}

pub(super) fn evaluate_auto_approval_r1(
    connection: &Connection,
    import_id: i64,
) -> AppResult<AutoApprovalEligibility> {
    let import_row = get_import_row(connection, import_id)?;
    if import_row.approved_corporate_action_id.is_some() || import_row.review_status == "APPROVED" {
        return Ok(AutoApprovalEligibility::AlreadyApproved);
    }
    if import_row.exchange != "NSE" {
        return Ok(AutoApprovalEligibility::Ineligible(
            "R1 auto-approval is NSE-only.".to_string(),
        ));
    }
    if !matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS") {
        return Ok(AutoApprovalEligibility::Ineligible(
            "R1 auto-approval is Split/Bonus only.".to_string(),
        ));
    }
    if import_row.parse_status != "PARSED" {
        return Ok(AutoApprovalEligibility::Ineligible(
            "Import is not PARSED.".to_string(),
        ));
    }
    if import_row.review_status != "PENDING" {
        return Ok(AutoApprovalEligibility::Ineligible(format!(
            "R1 requires ordinary PENDING review status; found {}.",
            import_row.review_status
        )));
    }
    if import_row.symbol.as_deref().map(str::trim).unwrap_or_default().is_empty()
        || import_row.ex_date.as_deref().map(str::trim).unwrap_or_default().is_empty()
        || import_row.factor.filter(|value| value.is_finite() && *value > 0.0).is_none()
    {
        return Ok(AutoApprovalEligibility::Ineligible(
            "Resolved symbol, ex-date and positive factor are required.".to_string(),
        ));
    }
    if has_forbidden_decision(connection, import_row.id)? {
        return Ok(AutoApprovalEligibility::Ineligible(
            "Manual or exceptional approval provenance is excluded from R1 auto-approval."
                .to_string(),
        ));
    }
    let Some(identity_proof) = machine_identity_proof(connection, &import_row)? else {
        return Ok(AutoApprovalEligibility::Ineligible(
            "No current machine-proven identity satisfies R1.".to_string(),
        ));
    };
    if has_same_date_split_bonus_peer(connection, &import_row)? {
        return Ok(AutoApprovalEligibility::Ineligible(
            "Same-date compound Split/Bonus rows are excluded from R1 auto-approval."
                .to_string(),
        ));
    }

    let Some(validation) = load_latest_official_split_bonus_validation(connection, import_row.id)? else {
        return Ok(AutoApprovalEligibility::Ineligible(
            "Current official-import Split/Bonus validation is required.".to_string(),
        ));
    };
    if !is_split_bonus_validation_current(connection, &import_row, &validation)? {
        return Ok(AutoApprovalEligibility::Ineligible(
            "The latest Split/Bonus validation is stale.".to_string(),
        ));
    }
    if validation.scan_status != "MATCHED" {
        return Ok(AutoApprovalEligibility::Ineligible(format!(
            "R1 requires MATCHED price validation; found {}.",
            validation.scan_status
        )));
    }
    let Some(confidence) = validation.confidence else {
        return Ok(AutoApprovalEligibility::Ineligible(
            "R1 requires an explicit validation confidence.".to_string(),
        ));
    };
    if !confidence.is_finite() || confidence < AUTO_APPROVAL_MIN_CONFIDENCE {
        return Ok(AutoApprovalEligibility::Ineligible(format!(
            "R1 requires STRONG MATCH confidence >= {:.2}; found {:.6}.",
            AUTO_APPROVAL_MIN_CONFIDENCE, confidence
        )));
    }
    let Some(expected_factor) = validation.expected_factor else {
        return Ok(AutoApprovalEligibility::Ineligible(
            "R1 requires the current validation factor.".to_string(),
        ));
    };

    Ok(AutoApprovalEligibility::Eligible(AutoApprovalEvidence {
        identity_proof,
        scan_id: validation.id,
        scan_timestamp: validation.scanned_at,
        confidence,
        expected_factor,
    }))
}

fn audit_reason(
    import_row: &CorporateActionImportRow,
    evidence: &AutoApprovalEvidence,
    database_context: &str,
    corporate_action_id: i64,
) -> String {
    format!(
        "policy={}; importId={}; exchange={}; symbol={}; actionType={}; exDate={}; factor={:.12}; identityProof={}; scanId={}; scanTimestamp={}; scanStatus=MATCHED; confidence={:.6}; expectedFactor={:.12}; databaseContext={}; canonicalCorporateActionId={}",
        AUTO_APPROVAL_POLICY_VERSION,
        import_row.id,
        import_row.exchange,
        import_row.symbol.as_deref().unwrap_or_default(),
        import_row.action_type,
        import_row.ex_date.as_deref().unwrap_or_default(),
        import_row.factor.unwrap_or_default(),
        evidence.identity_proof,
        evidence.scan_id,
        evidence.scan_timestamp,
        evidence.confidence,
        evidence.expected_factor,
        database_context,
        corporate_action_id,
    )
}

pub(super) fn auto_approve_corporate_action_imports_in_connection(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionAutoApprovalInput,
) -> AppResult<CorporateActionAutoApprovalResult> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    if input.import_ids.is_empty() {
        return Err("Auto-approval requires at least one completed preparation-scope ID.".to_string());
    }
    if input.import_ids.len() > AUTO_APPROVAL_MAX_ITEMS {
        return Err(format!(
            "Auto-approval is limited to {AUTO_APPROVAL_MAX_ITEMS} preparation-scope items per backend batch."
        ));
    }

    let mut seen = HashSet::new();
    let import_ids = input
        .import_ids
        .iter()
        .copied()
        .filter(|id| seen.insert(*id))
        .collect::<Vec<_>>();
    let mut dispositions = Vec::with_capacity(import_ids.len());
    let mut eligible = 0_u32;
    let mut auto_approved = 0_u32;
    let mut linked_existing = 0_u32;
    let mut already_approved = 0_u32;
    let mut skipped = 0_u32;
    let mut failed = 0_u32;

    for import_id in import_ids.iter().copied() {
        match evaluate_auto_approval_r1(connection, import_id)? {
            AutoApprovalEligibility::AlreadyApproved => {
                already_approved += 1;
                dispositions.push(CorporateActionAutoApprovalDisposition {
                    import_id,
                    disposition: "ALREADY_APPROVED".to_string(),
                    reason: "Import is already approved; no autonomous write was performed."
                        .to_string(),
                    import_record: Some(get_import_row(connection, import_id)?),
                    approved_record: None,
                });
            }
            AutoApprovalEligibility::Ineligible(reason) => {
                skipped += 1;
                dispositions.push(CorporateActionAutoApprovalDisposition {
                    import_id,
                    disposition: "SKIPPED".to_string(),
                    reason,
                    import_record: Some(get_import_row(connection, import_id)?),
                    approved_record: None,
                });
            }
            AutoApprovalEligibility::Eligible(evidence) => {
                eligible += 1;
                connection
                    .execute_batch("SAVEPOINT corporate_action_auto_approval_item")
                    .map_err(|error| error.to_string())?;
                let previous = get_import_row(connection, import_id)?;
                let item_result = (|| {
                    let result = approve_corporate_action_import_without_transaction(
                        connection,
                        folder_path,
                        import_id,
                        false,
                        false,
                    )?;
                    let corporate_action_id = result
                        .import_record
                        .approved_corporate_action_id
                        .ok_or_else(|| {
                            "Auto-approval ordinary writer returned no canonical action link."
                                .to_string()
                        })?;
                    let reason = audit_reason(
                        &previous,
                        &evidence,
                        input.expected_database_path.as_str(),
                        corporate_action_id,
                    );
                    record_corporate_action_import_decision(
                        connection,
                        &previous,
                        &result.import_record,
                        AUTO_APPROVAL_POLICY_VERSION,
                        &reason,
                    )?;
                    Ok::<_, String>((result, reason))
                })();

                match item_result {
                    Ok((result, reason)) => {
                        connection
                            .execute_batch("RELEASE SAVEPOINT corporate_action_auto_approval_item")
                            .map_err(|error| error.to_string())?;
                        let disposition = if result.approved_record.is_some() {
                            auto_approved += 1;
                            "AUTO_APPROVED"
                        } else if result
                            .message
                            .starts_with("Import linked to an existing approved")
                        {
                            linked_existing += 1;
                            "LINKED_EXISTING"
                        } else {
                            auto_approved += 1;
                            "AUTO_APPROVED"
                        };
                        dispositions.push(CorporateActionAutoApprovalDisposition {
                            import_id,
                            disposition: disposition.to_string(),
                            reason,
                            import_record: Some(result.import_record),
                            approved_record: result.approved_record,
                        });
                    }
                    Err(error) => {
                        connection
                            .execute_batch("ROLLBACK TO SAVEPOINT corporate_action_auto_approval_item")
                            .map_err(|rollback_error| {
                                format!(
                                    "Could not rollback failed auto-approval {}: {}",
                                    import_id, rollback_error
                                )
                            })?;
                        connection
                            .execute_batch("RELEASE SAVEPOINT corporate_action_auto_approval_item")
                            .map_err(|release_error| {
                                format!(
                                    "Could not release failed auto-approval {}: {}",
                                    import_id, release_error
                                )
                            })?;
                        failed += 1;
                        dispositions.push(CorporateActionAutoApprovalDisposition {
                            import_id,
                            disposition: "FAILED".to_string(),
                            reason: error,
                            import_record: Some(get_import_row(connection, import_id)?),
                            approved_record: None,
                        });
                    }
                }
            }
        }
    }

    let requested = import_ids.len() as u32;
    Ok(CorporateActionAutoApprovalResult {
        requested,
        eligible,
        auto_approved,
        linked_existing,
        already_approved,
        skipped,
        failed,
        dispositions,
        policy_version: AUTO_APPROVAL_POLICY_VERSION.to_string(),
        message: format!(
            "Auto-Approval Safe V1 reviewed {requested} prepared row(s): {auto_approved} newly approved, {linked_existing} linked existing, {already_approved} already approved, {skipped} skipped, {failed} failed. Manual approval remains available for eligible manual-review rows."
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE instruments (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  name TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  series TEXT
                );
                CREATE TABLE instrument_identity_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  current_symbol TEXT,
                  current_name TEXT,
                  old_symbol TEXT,
                  old_name TEXT,
                  new_symbol TEXT,
                  new_name TEXT,
                  effective_date TEXT NOT NULL,
                  change_type TEXT NOT NULL,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT DEFAULT (datetime('now')),
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE instrument_isin_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL,
                  symbol TEXT NOT NULL,
                  isin TEXT NOT NULL,
                  effective_date TEXT,
                  source TEXT,
                  source_ref TEXT,
                  note TEXT,
                  created_at TEXT DEFAULT (datetime('now')),
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL,
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL,
                  review_status TEXT NOT NULL,
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                CREATE TABLE corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );
                CREATE TABLE corporate_action_import_decisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  decision_type TEXT NOT NULL,
                  previous_symbol TEXT,
                  previous_exchange TEXT,
                  previous_isin TEXT,
                  resolved_symbol TEXT,
                  resolved_exchange TEXT,
                  resolved_isin TEXT,
                  reason TEXT NOT NULL,
                  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE scan_runs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scope TEXT NOT NULL,
                  action_types TEXT NOT NULL,
                  started_at TEXT NOT NULL,
                  completed_at TEXT,
                  status TEXT NOT NULL,
                  message TEXT,
                  total_results INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE corporate_action_scan_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scan_run_id INTEGER NOT NULL,
                  corporate_action_import_id INTEGER,
                  corporate_action_id INTEGER,
                  symbol TEXT,
                  exchange TEXT NOT NULL,
                  scan_status TEXT NOT NULL,
                  prev_trade_date TEXT,
                  ex_trade_date TEXT,
                  prev_close REAL,
                  ex_open REAL,
                  ex_close REAL,
                  expected_factor REAL,
                  actual_open_factor REAL,
                  actual_close_factor REAL,
                  confidence REAL,
                  message TEXT,
                  scanned_at TEXT NOT NULL
                );
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  factor REAL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  adjust_volume INTEGER,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT,
                  updated_at TEXT,
                  applied_at TEXT
                );
                INSERT INTO instruments(symbol, exchange, isin, name, is_active, series)
                VALUES ('TEST', 'NSE', 'INEAUTO01001', 'Test Limited', 1, 'EQ');
                ",
            )
            .unwrap();
        connection
    }

    fn insert_import(connection: &Connection, id: i64, action_type: &str, review_status: &str) {
        connection.execute(
            "INSERT INTO corporate_action_imports (
              id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date,
              action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
            ) VALUES (?, ?, 'NSE', 'NSE_API', 'TEST', 'INEAUTO01001', 'Test Limited', ?,
              '2026-08-14', ?, 2, 1, 2, 0.5, 'PARSED', ?)",
            params![id, format!("row-{id}"), format!("{action_type} fixture"), action_type, review_status],
        ).unwrap();
    }

    fn insert_scan(connection: &Connection, import_id: i64, status: &str, confidence: Option<f64>, factor: f64) {
        connection.execute(
            "INSERT INTO scan_runs(scope, action_types, started_at, completed_at, status, total_results)
             VALUES ('official_imports','SPLIT,BONUS','2026-08-14T00:00:00Z','2026-08-14T00:00:01Z','COMPLETED',1)", [],
        ).unwrap();
        let run_id=connection.last_insert_rowid();
        connection.execute(
            "INSERT INTO corporate_action_scan_results(
              scan_run_id, corporate_action_import_id, symbol, exchange, scan_status,
              prev_trade_date, ex_trade_date, expected_factor, confidence, message, scanned_at
             ) VALUES (?, ?, 'TEST', 'NSE', ?, '2026-08-13', '2026-08-14', ?, ?, 'fixture', '2026-08-14T00:00:01Z')",
            params![run_id, import_id, status, factor, confidence],
        ).unwrap();
    }

    fn expect_eligible(connection: &Connection, id: i64) -> AutoApprovalEvidence {
        match evaluate_auto_approval_r1(connection, id).unwrap() {
            AutoApprovalEligibility::Eligible(evidence) => evidence,
            other => panic!("expected eligible, got {other:?}"),
        }
    }

    #[test]
    fn auto_approval_r1_accepts_nse_split_with_exact_identity_and_strong_match() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.95),2.0);
        let evidence=expect_eligible(&connection,1);
        assert_eq!(evidence.identity_proof,"EXACT_ACTIVE_CURRENT_IDENTITY");
        assert_eq!(evidence.confidence,0.95);
    }

    #[test]
    fn auto_approval_r1_accepts_bonus_with_strong_match() {
        let connection=fixture(); insert_import(&connection,1,"BONUS","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        expect_eligible(&connection,1);
    }

    #[test]
    fn auto_approval_r1_rejects_confidence_below_strong_match() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.949999),2.0);
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("0.95")));
    }

    #[test]
    fn auto_approval_r1_rejects_review_no_price_and_missing_validation() {
        for (id,status,confidence) in [(1,"REVIEW",Some(0.99)),(2,"NO_PRICE_DATA",Some(0.99))] {
            let connection=fixture(); insert_import(&connection,id,"SPLIT","PENDING"); insert_scan(&connection,id,status,confidence,2.0);
            assert!(matches!(evaluate_auto_approval_r1(&connection,id).unwrap(),AutoApprovalEligibility::Ineligible(_)));
        }
        let connection=fixture(); insert_import(&connection,3,"SPLIT","PENDING");
        assert!(matches!(evaluate_auto_approval_r1(&connection,3).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("validation")));
    }

    #[test]
    fn auto_approval_r1_rejects_non_nse_non_split_bonus_and_pending_isin_mismatch() {
        let connection=fixture(); insert_import(&connection,1,"DIVIDEND","PENDING");
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(_)));
        connection.execute("UPDATE corporate_action_imports SET action_type='SPLIT', exchange='BSE' WHERE id=1",[]).unwrap();
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(_)));
        connection.execute("UPDATE corporate_action_imports SET exchange='NSE', review_status='PENDING_ISIN_MISMATCH' WHERE id=1",[]).unwrap();
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(_)));
    }

    #[test]
    fn auto_approval_r1_rejects_manual_and_exception_provenance() {
        for decision_type in FORBIDDEN_DECISION_TYPES {
            let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
            connection.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES (1,?, 'fixture')",params![decision_type]).unwrap();
            assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("exceptional") || reason.contains("Manual")));
        }
    }

    #[test]
    fn auto_approval_r1_accepts_whitelisted_machine_resolution_with_historical_isin() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        connection.execute("UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",[]).unwrap();
        connection.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source) VALUES ('NSE','TEST','INEHIST01001','2026-08-14','fixture')",[]).unwrap();
        connection.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,resolved_symbol,resolved_exchange,resolved_isin,reason) VALUES (1,'VERIFIED_QUICK_RESOLUTION','TEST','NSE','INEHIST01001','fixture')",[]).unwrap();
        let evidence=expect_eligible(&connection,1);
        assert_eq!(evidence.identity_proof,"VERIFIED_QUICK_RESOLUTION");
    }

    #[test]
    fn auto_approval_r1_rejects_stale_machine_decision_when_current_proof_is_missing() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        connection.execute("UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",[]).unwrap();
        connection.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,resolved_symbol,resolved_exchange,resolved_isin,reason) VALUES (1,'VERIFIED_QUICK_RESOLUTION','TEST','NSE','INEHIST01001','fixture')",[]).unwrap();
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("machine-proven identity")));
    }

    #[test]
    fn auto_approval_r1_rejects_same_date_split_bonus_compound_scope() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        insert_import(&connection,2,"BONUS","PENDING");
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("compound")));
    }

    #[test]
    fn auto_approval_r1_rejects_stale_factor_fingerprint() {
        let connection=fixture(); insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        connection.execute("UPDATE corporate_action_imports SET factor=3.0 WHERE id=1",[]).unwrap();
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("stale")));
    }

    #[test]
    fn auto_approval_r1_links_existing_and_records_safe_audit_without_touching_out_of_scope_row() {
        let connection=fixture();
        insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        insert_import(&connection,2,"SPLIT","PENDING"); insert_scan(&connection,2,"MATCHED",Some(0.99),2.0);
        connection.execute("UPDATE corporate_action_imports SET ex_date='2026-08-15', dedupe_key='row-2b' WHERE id=2",[]).unwrap();
        connection.execute("INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,ratio_num,ratio_den) VALUES ('TEST','NSE','INEAUTO01001','2026-08-14','SPLIT',2,2,1)",[]).unwrap();
        let result=auto_approve_corporate_action_imports_in_connection(&connection,Path::new("."),&CorporateActionAutoApprovalInput{import_ids:vec![1],expected_database_path:"E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse".to_string()}).unwrap();
        assert_eq!(result.requested,1); assert_eq!(result.eligible,1); assert_eq!(result.linked_existing,1); assert_eq!(result.failed,0);
        let row1=get_import_row(&connection,1).unwrap(); assert_eq!(row1.review_status,"APPROVED"); assert!(row1.approved_corporate_action_id.is_some());
        let row2=get_import_row(&connection,2).unwrap(); assert_eq!(row2.review_status,"PENDING"); assert!(row2.approved_corporate_action_id.is_none());
        let audit:(String,String)=connection.query_row("SELECT decision_type,reason FROM corporate_action_import_decisions WHERE import_id=1 ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get(0)?,r.get(1)?))).unwrap();
        assert_eq!(audit.0,AUTO_APPROVAL_POLICY_VERSION); assert!(audit.1.contains("confidence=0.990000")); assert!(audit.1.contains("canonicalCorporateActionId="));
    }
}
