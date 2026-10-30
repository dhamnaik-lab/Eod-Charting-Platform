use crate::database::{
    AppResult, CorporateActionAutoApprovalDisposition, CorporateActionAutoApprovalInput,
    CorporateActionAutoApprovalResult, CorporateActionImportApprovalResult,
    CorporateActionImportRow,
};
use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::Path;

#[cfg(test)]
mod dividend_performance_tests;
#[cfg(test)]
mod dividend_failure_diagnostic;
#[cfg(test)]
mod event_price_route_copy_tests;

use super::simple_cash_dividend_evidence::{
    revalidate_simple_cash_dividend_evidence, SimpleCashDividendEvidence,
};
use super::{
    approve_corporate_action_import_without_transaction, find_existing_corporate_action,
    get_import_row, is_split_bonus_validation_current, list_resolution_suggestions_for_import_row,
    load_latest_official_split_bonus_validation, record_corporate_action_import_decision,
    strict_quick_resolve_proof, validate_exact_import_lookup_ids, verify_import_lookup_database,
    CorporateActionQuickResolveProof,
};

pub(super) const AUTO_APPROVAL_POLICY_VERSION: &str = "AUTO_APPROVAL_SAFE_V2";
const AUTO_APPROVAL_MAX_ITEMS: usize = 100;
const AUTO_APPROVAL_MIN_CONFIDENCE: f64 = 0.95;
const MACHINE_DECISION_TYPES: [&str; 4] = [
    super::dated_symbol_chain::DECISION,
    "VERIFIED_QUICK_RESOLUTION",
    "VERIFIED_EVENT_IDENTITY_RESOLUTION",
    "VERIFIED_HISTORICAL_ISIN_TRANSITION",
];
#[cfg(test)]
const FORBIDDEN_DECISION_TYPES: [&str; 3] = [
    "MANUAL_RESOLUTION",
    "ISIN_MISMATCH_APPROVAL",
    "PRICE_VALIDATION_EXCEPTION",
];

#[derive(Clone, Debug, PartialEq)]
pub(super) enum ActionApprovalBasis {
    SplitBonusScan {
        scan_id: i64,
        scan_timestamp: String,
        confidence: f64,
        expected_factor: f64,
    },
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct AutoApprovalEvidence {
    pub identity_proof: String,
    pub basis: ActionApprovalBasis,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) enum AutoApprovalEligibility {
    Eligible(AutoApprovalEvidence),
    Ineligible(String),
    AlreadyApproved,
}

pub(super) const SIMPLE_CASH_DIVIDEND_POLICY_VERSION: &str =
    "AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1";
const DIVIDEND_MAX_PREV_TRADE_GAP_DAYS: i64 = 7;

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub(super) struct SimpleCashDividendPolicyEvidence {
    pub(super) identity_proof: String,
    pub(super) official_evidence_id: i64,
    pub(super) evidence_captured_at: String,
    pub(super) source_locator: Option<String>,
    pub(super) cash_amount: f64,
    pub(super) previous_trade_date: String,
    pub(super) previous_close: f64,
    pub(super) computed_factor: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) enum SimpleCashDividendPolicyEligibility {
    Eligible(SimpleCashDividendPolicyEvidence),
    Ineligible(String),
    AlreadyApproved,
}

pub(super) const SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION: &str =
    "CA_DIVIDEND_PREPARED_SCOPE_R1";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct SimpleCashDividendPreparedScopeInput {
    pub(super) import_ids: Vec<i64>,
    pub(super) expected_database_path: String,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub(super) struct SimpleCashDividendPreparedScopeDisposition {
    pub(super) import_id: i64,
    pub(super) disposition: String,
    pub(super) reason: String,
    pub(super) current_action_type: Option<String>,
    pub(super) current_parse_status: Option<String>,
    pub(super) current_review_status: Option<String>,
    pub(super) evidence: Option<SimpleCashDividendPolicyEvidence>,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct SimpleCashDividendPreparedScopeResult {
    pub(super) requested: u32,
    pub(super) reused_count: u32,
    pub(super) eligible: u32,
    pub(super) ineligible: u32,
    pub(super) already_approved: u32,
    pub(super) stale_scope: u32,
    pub(super) missing: u32,
    pub(super) failed: u32,
    pub(super) dispositions: Vec<SimpleCashDividendPreparedScopeDisposition>,
    pub(super) policy_version: String,
    pub(super) scope_fingerprint: String,
    pub(super) complete: bool,
    pub(super) message: String,
}

pub(super) const SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION: &str = "CA_DIVIDEND_WRITE_STAGE_R1";
pub(super) const SIMPLE_CASH_DIVIDEND_DECISION_TYPE: &str = SIMPLE_CASH_DIVIDEND_POLICY_VERSION;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct SimpleCashDividendWriteStageInput {
    pub(super) import_ids: Vec<i64>,
    pub(super) expected_database_path: String,
    pub(super) expected_policy_version: String,
    pub(super) expected_scope_version: String,
    pub(super) expected_write_stage_version: String,
    pub(super) expected_scope_fingerprint: String,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct SimpleCashDividendWriteStageDisposition {
    pub(super) import_id: i64,
    pub(super) disposition: String,
    pub(super) reason: String,
    pub(super) corporate_action_id: Option<i64>,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct SimpleCashDividendWriteStageResult {
    pub(super) requested: u32,
    pub(super) revalidated_eligible: u32,
    pub(super) auto_approved: u32,
    pub(super) ineligible: u32,
    pub(super) already_approved: u32,
    pub(super) stale_scope: u32,
    pub(super) missing: u32,
    pub(super) failed: u32,
    pub(super) dispositions: Vec<SimpleCashDividendWriteStageDisposition>,
    pub(super) policy_version: String,
    pub(super) scope_version: String,
    pub(super) write_stage_version: String,
    pub(super) scope_fingerprint: String,
    pub(super) complete: bool,
    pub(super) message: String,
}

fn normalize_prepared_scope_database_path(value: &str) -> String {
    let mut normalized = value.trim().replace('/', "\\").to_lowercase();
    while normalized.ends_with('\\')
        && !(normalized.len() == 3
            && normalized.as_bytes().get(1) == Some(&b':')
            && normalized.as_bytes().get(2) == Some(&b'\\'))
    {
        normalized.pop();
    }
    normalized
}

pub(super) fn simple_cash_dividend_prepared_scope_fingerprint(
    expected_database_path: &str,
    import_ids: &[i64],
) -> String {
    let normalized_database_path = normalize_prepared_scope_database_path(expected_database_path);
    let mut normalized_ids = import_ids.to_vec();
    normalized_ids.sort_unstable();
    let ids = normalized_ids
        .iter()
        .map(i64::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let material =
        format!("{SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION}\n{normalized_database_path}\n{ids}");
    let digest = Sha256::digest(material.as_bytes());
    digest.iter().map(|byte| format!("{:02X}", *byte)).collect()
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct OfficialSimpleCashDividendEvidence {
    id: i64,
    captured_at: String,
    source_locator: Option<String>,
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

fn has_legacy_manual_raw_event_identity_conflict(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<bool> {
    let Some(ex_date) = import_row.ex_date.as_deref() else {
        return Ok(false);
    };
    let Some(resolved_isin) = import_row.isin.as_deref() else {
        return Ok(false);
    };

    let manual_message = import_row
        .message
        .as_deref()
        .map(normalized)
        .map(|message| message.contains("MANUALLY RESOLVED"))
        .unwrap_or(false);

    let mut statement = connection
        .prepare(
            "
              SELECT isin_seen, note
              FROM corporate_action_import_evidence
              WHERE import_id = ?
                AND event_date_seen = ?
                AND isin_seen IS NOT NULL
                AND TRIM(isin_seen) <> ''
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![import_row.id, ex_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (isin_seen, note) in rows {
        let legacy_backfill = note
            .as_deref()
            .map(normalized)
            .map(|text| {
                text.contains("BACKFILLED FROM AN EXISTING CORPORATE_ACTION_IMPORTS ROW")
            })
            .unwrap_or(false);
        if normalized(isin_seen.as_str()) != normalized(resolved_isin)
            && (manual_message || legacy_backfill)
        {
            return Ok(true);
        }
    }
    Ok(false)
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
                  'VERIFIED_HISTORICAL_ISIN_TRANSITION',
                  'VERIFIED_DATED_SYMBOL_CHAIN_R1'
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

fn effective_event_identity_key(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<String>> {
    let identity = super::event_identity_resolution::load_effective_event_identity(connection, import_id)?;
    if let Some(symbol) = identity
        .event_symbol
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(Some(format!("SYMBOL:{}", normalized(symbol))));
    }
    Ok(identity
        .event_isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|isin| format!("ISIN:{}", normalized(isin))))
}

fn same_date_automatic_exclusion_peer(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Option<String>> {
    same_date_automatic_exclusion_peer_with_cache(connection, import_row, None)
}

#[derive(Default)]
struct DividendPeerCache {
    identities: HashMap<i64, Option<String>>,
    peers: HashMap<(String, String), Vec<(i64, String)>>,
}

fn peer_identity_key(
    connection: &Connection,
    id: i64,
    cache: Option<&mut DividendPeerCache>,
) -> AppResult<Option<String>> {
    let Some(cache) = cache else {
        return effective_event_identity_key(connection, id);
    };
    if let Some(key) = cache.identities.get(&id) {
        return Ok(key.clone());
    }
    let key = effective_event_identity_key(connection, id)?;
    cache.identities.insert(id, key.clone());
    Ok(key)
}

fn same_date_automatic_exclusion_peer_with_cache(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    mut cache: Option<&mut DividendPeerCache>,
) -> AppResult<Option<String>> {
    let Some(ex_date) = import_row.ex_date.as_deref() else {
        return Ok(None);
    };
    let Some(current_key) = peer_identity_key(connection, import_row.id, cache.as_deref_mut())?
    else {
        return Ok(None);
    };
    let group = (import_row.exchange.clone(), ex_date.to_string());
    let peers = if let Some(peers) = cache.as_ref().and_then(|cache| cache.peers.get(&group)) {
        peers.clone()
    } else {
        let mut statement = connection
            .prepare(
                "
              SELECT id, action_type
              FROM corporate_action_imports
              WHERE exchange = ?
                AND ex_date = ?
                AND action_type IN ('SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS', 'DEMERGER')
                AND review_status <> 'REJECTED'
              ORDER BY id
            ",
            )
            .map_err(|error| error.to_string())?;
        let peers = statement
            .query_map(params![import_row.exchange, ex_date], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        if let Some(cache) = cache.as_deref_mut() {
            cache.peers.insert(group, peers.clone());
        }
        peers
    };

    for (peer_id, action_type) in peers {
        if peer_id != import_row.id
            && peer_identity_key(connection, peer_id, cache.as_deref_mut())?.as_deref()
                == Some(current_key.as_str())
        {
            return Ok(Some(action_type));
        }
    }

    // Manual/legacy canonical actions need not have an import row. Include the
    // resolved instrument's aliases, while retaining ordinary duplicate linking.
    if let Some(symbol) = import_row.symbol.as_deref() {
        if let Some(context) = crate::database::eod_data::resolve_instrument_context(
            connection,
            symbol,
            &import_row.exchange,
        )? {
            let matching_id = find_existing_corporate_action(connection, import_row)?;
            for action in context.corporate_actions {
                if action.effective_date == ex_date && Some(action.id) != matching_id {
                    return Ok(Some(action.action_type));
                }
            }
        }
    }
    Ok(None)
}

fn machine_identity_proof(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    block_exact_active_current: bool,
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
        let raw_norm = normalized(raw_isin);
        let cur_norm = normalized(current_isin);
        if raw_norm == cur_norm && !block_exact_active_current {
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
    let dated_chain = decision.decision_type == super::dated_symbol_chain::DECISION
        && matches!(
            &proof,
            Some(CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(_))
        )
        && super::dated_symbol_chain::verify_persisted(connection, &unresolved_view, active[0])?;
    let proof_matches_decision = dated_chain || matches!(
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

fn load_exact_simple_cash_dividend_official_evidence(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Option<OfficialSimpleCashDividendEvidence>> {
    let Some(ex_date) = import_row.ex_date.as_deref() else {
        return Ok(None);
    };
    let mut statement = connection
        .prepare(
            "
              SELECT id, captured_at, source_locator, raw_reference, note,
                     symbol_seen, isin_seen, event_date_seen
              FROM corporate_action_import_evidence
              WHERE import_id = ?
                AND source_code = 'NSE_API'
                AND action_type_seen = 'DIVIDEND'
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query_map(params![import_row.id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let is_backfill = |note: &Option<String>| {
        note.as_deref()
            .unwrap_or("")
            .to_lowercase()
            .contains("backfill")
    };
    let fresh_count = rows.iter().filter(|r| !is_backfill(&r.4)).count();
    // A second independent observation is still ambiguity, including a
    // contradictory payload that would otherwise disappear in exact filtering.
    if fresh_count > 1 {
        return Ok(None);
    }
    if fresh_count == 1 && rows.iter().any(|r| is_backfill(&r.4)) {
        // Supersede only matching reconstructed evidence with one exact,
        // independently captured official witness. Keep every stored record.
        for (_, captured, locator, raw, note, symbol, isin, date) in &rows {
            let Some(payload) = raw
                .as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
            else {
                return Ok(None);
            };
            let field = |key: &str| payload.get(key).and_then(serde_json::Value::as_str);
            if captured.trim().is_empty()
                || symbol.as_deref() != import_row.symbol.as_deref()
                || isin.as_deref() != import_row.isin.as_deref()
                || date.as_deref() != Some(ex_date)
                || field("symbol") != symbol.as_deref()
                || field("isin") != isin.as_deref()
                || field("exDate") != Some(ex_date)
                || field("purposeRaw") != Some(import_row.purpose_raw.as_str())
            {
                return Ok(None);
            }
            if !is_backfill(note) {
                let Some(url) = locator.as_deref() else {
                    return Ok(None);
                };
                let Ok(parsed) = reqwest::Url::parse(url) else {
                    return Ok(None);
                };
                if super::super::official_source_urls::validate_nse_official_source_url(url)
                    .is_err()
                    || parsed.scheme() != "https"
                    || parsed.path() != "/api/corporates-corporateActions"
                {
                    return Ok(None);
                }
            }
        }
        rows.retain(|r| !is_backfill(&r.4));
    }
    let matching = rows
        .into_iter()
        .filter_map(
            |(id, captured_at, source_locator, raw_reference, _, _, _, event_date)| {
                let raw_reference = raw_reference?;
                let payload = serde_json::from_str::<serde_json::Value>(&raw_reference).ok()?;
                let purpose_matches = payload
                    .get("purposeRaw")
                    .and_then(serde_json::Value::as_str)
                    == Some(import_row.purpose_raw.as_str());
                let ex_date_matches =
                    payload.get("exDate").and_then(serde_json::Value::as_str) == Some(ex_date);
                if !purpose_matches
                    || !ex_date_matches
                    || event_date.as_deref() != Some(ex_date)
                    || captured_at.trim().is_empty()
                {
                    return None;
                }
                Some(OfficialSimpleCashDividendEvidence {
                    id,
                    captured_at,
                    source_locator,
                })
            },
        )
        .collect::<Vec<_>>();
    if matching.len() != 1 {
        return Ok(None);
    }
    Ok(matching.into_iter().next())
}

fn parse_simple_cash_dividend_policy_date(value: &str, label: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("Dividend R1 requires a valid {label} YYYY-MM-DD date."))
}

fn dividend_basis_policy_ineligibility(error: &str) -> Option<String> {
    match error {
        "No local previous trading-day close was found before the effective date."
        | "Dividend amount must be smaller than the local previous close."
        | "Dividend adjustment produced a non-positive ex-basis price." => Some(format!(
            "Dividend R1 requires a usable local previous-close basis: {error}"
        )),
        _ => None,
    }
}

// Presentation proof only. Never links an import or authorizes another adjustment.
pub(super) fn verified_existing_dividend(
    connection: &Connection,
    folder_path: &Path,
    import_id: i64,
) -> AppResult<Option<i64>> {
    let row = get_import_row(connection, import_id)?;
    if row.exchange != "NSE" || row.source != "NSE_API" || row.action_type != "DIVIDEND"
        || row.parse_status != "PARSED" || row.review_status != "PENDING"
        || row.approved_corporate_action_id.is_some()
        || row.factor.is_some() || row.price_factor.is_some()
        || row.ratio_num.is_some() || row.ratio_den.is_some()
        || row.old_face_value.is_some() || row.new_face_value.is_some()
    {
        return Ok(None);
    }
    let (Some(isin), Some(date), Some(symbol), Some(cash)) =
        (row.isin.as_deref(), row.ex_date.as_deref(), row.symbol.as_deref(), row.cash_amount)
    else { return Ok(None); };
    if isin.trim().is_empty() || !cash.is_finite() || cash <= 0.0
        || find_existing_corporate_action(connection, &row)?.is_none()
    { return Ok(None); }
    if !matches!(revalidate_simple_cash_dividend_evidence(&row.purpose_raw, Some(cash)),
        SimpleCashDividendEvidence::EligibleSimpleCash(amount) if amount == cash)
        || load_exact_simple_cash_dividend_official_evidence(connection, &row)?.is_none()
        || has_forbidden_decision(connection, import_id)?
    { return Ok(None); }
    let conflict = has_legacy_manual_raw_event_identity_conflict(connection, &row)?;
    if machine_identity_proof(connection, &row, conflict)?.is_none() { return Ok(None); }

    let mut statement = connection.prepare(
        "SELECT id, factor, cash_amount, adjust_volume, source,
                ratio_num, ratio_den, old_face_value, new_face_value, isin
         FROM corporate_actions WHERE exchange=? AND effective_date=? AND action_type='DIVIDEND'
           AND (isin=? OR symbol=?) LIMIT 2"
    ).map_err(|e| e.to_string())?;
    let candidates = statement.query_map(params![row.exchange, date, isin, symbol], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, f64>(1)?, r.get::<_, Option<f64>>(2)?,
            r.get::<_, i64>(3)?, r.get::<_, Option<String>>(4)?,
            r.get::<_, Option<f64>>(5)?, r.get::<_, Option<f64>>(6)?,
            r.get::<_, Option<f64>>(7)?, r.get::<_, Option<f64>>(8)?, r.get::<_, Option<String>>(9)?))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    if candidates.len() != 1 { return Ok(None); }
    let (id, factor, stored_cash, volume, source, num, den, old_fv, new_fv, canonical_isin) = &candidates[0];
    if *stored_cash != Some(cash) || *volume != 0 || source.as_deref() != Some("NSE_API")
        || !factor.is_finite() || *factor <= 1.0
        || num.is_some() || den.is_some() || old_fv.is_some() || new_fv.is_some()
        || canonical_isin.as_deref() != Some(isin)
    { return Ok(None); }
    let linked: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM corporate_action_imports
         WHERE approved_corporate_action_id=? AND review_status='APPROVED' AND parse_status='PARSED'
           AND source='NSE_API' AND exchange=? AND isin=? AND ex_date=?
           AND action_type='DIVIDEND' AND cash_amount=? AND id<>?)",
        params![id, row.exchange, isin, date, cash, import_id], |r| r.get(0),
    ).map_err(|e| e.to_string())?;
    if !linked { return Ok(None); }
    let Some(context) = crate::database::eod_data::resolve_instrument_context(connection, symbol, &row.exchange)?
    else { return Ok(None); };
    if !context.corporate_actions.iter().any(|action| action.id == *id) { return Ok(None); }
    let basis = match crate::database::instrument_mutations::load_dividend_adjustment_basis(
        connection, Some(folder_path), &context, date, Some(cash),
    ) { Ok(basis) => basis, Err(_) => return Ok(None) };
    if (basis.computed_factor - factor).abs() > 1e-9 * factor.abs().max(1.0) {
        return Ok(None);
    }
    Ok(Some(*id))
}

pub(super) fn evaluate_simple_cash_dividend_policy_r1(
    connection: &Connection,
    folder_path: &Path,
    import_id: i64,
) -> AppResult<SimpleCashDividendPolicyEligibility> {
    evaluate_simple_cash_dividend_policy_with_peer_cache(connection, folder_path, import_id, None)
}

fn evaluate_simple_cash_dividend_policy_with_peer_cache(
    connection: &Connection,
    folder_path: &Path,
    import_id: i64,
    peer_cache: Option<&mut DividendPeerCache>,
) -> AppResult<SimpleCashDividendPolicyEligibility> {
    let import_row = get_import_row(connection, import_id)?;
    if import_row.approved_corporate_action_id.is_some() || import_row.review_status == "APPROVED" {
        return Ok(SimpleCashDividendPolicyEligibility::AlreadyApproved);
    }
    if import_row.exchange != "NSE" {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 is NSE-only.".to_string(),
        ));
    }
    if import_row.source != "NSE_API" {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires source NSE_API.".to_string(),
        ));
    }
    if import_row.action_type != "DIVIDEND" {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 accepts DIVIDEND rows only.".to_string(),
        ));
    }
    if import_row.parse_status != "PARSED" {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires PARSED imports.".to_string(),
        ));
    }
    if import_row.review_status != "PENDING" {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(format!(
            "Dividend R1 requires ordinary PENDING review status; found {}.",
            import_row.review_status
        )));
    }
    let Some(symbol) = import_row
        .symbol
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires a resolved symbol.".to_string(),
        ));
    };
    let Some(ex_date_text) = import_row
        .ex_date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires the official ex-date.".to_string(),
        ));
    };
    let ex_date = match parse_simple_cash_dividend_policy_date(ex_date_text, "official ex-date") {
        Ok(value) => value,
        Err(reason) => {
            return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
        }
    };

    let Some(cash_amount) = import_row
        .cash_amount
        .filter(|value| value.is_finite() && *value > 0.0)
    else {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires a finite positive stored cash amount.".to_string(),
        ));
    };
    if import_row.factor.is_some()
        || import_row.price_factor.is_some()
        || import_row.ratio_num.is_some()
        || import_row.ratio_den.is_some()
        || import_row.old_face_value.is_some()
        || import_row.new_face_value.is_some()
    {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires cash-only stored semantics with no factor, price-factor, ratio, or face-value fields.".to_string(),
        ));
    }

    match revalidate_simple_cash_dividend_evidence(&import_row.purpose_raw, Some(cash_amount)) {
        SimpleCashDividendEvidence::EligibleSimpleCash(amount) if amount == cash_amount => {}
        SimpleCashDividendEvidence::Ineligible(reason) => {
            return Ok(SimpleCashDividendPolicyEligibility::Ineligible(format!(
                "Dividend R1 cash evidence: {}.", reason.diagnostic_label()
            )));
        }
        _ => {
            return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
                "Dividend R1 cash evidence: parsed amount did not match the stored cash amount."
                    .to_string(),
            ));
        }
    }

    let Some(official_evidence) =
        load_exact_simple_cash_dividend_official_evidence(connection, &import_row)?
    else {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires exactly one exact persisted NSE_API official-source witness."
                .to_string(),
        ));
    };

    if has_forbidden_decision(connection, import_row.id)? {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Manual or exceptional approval provenance is excluded from Dividend R1.".to_string(),
        ));
    }
    let legacy_manual_raw_event_conflict =
        has_legacy_manual_raw_event_identity_conflict(connection, &import_row)?;
    let Some(mut identity_proof) =
        machine_identity_proof(connection, &import_row, legacy_manual_raw_event_conflict)?
    else {
        let reason = if legacy_manual_raw_event_conflict {
            "Legacy/manual resolved identity has conflicting raw event identity evidence and no machine-verifiable event-time identity proof for Dividend R1.".to_string()
        } else {
            "No current machine-proven identity satisfies Dividend R1.".to_string()
        };
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
    };

    if let Some(peer_action_type) = same_date_automatic_exclusion_peer_with_cache(connection, &import_row, peer_cache)? {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(format!(
            "Same-date automatic-exclusion {} peer is excluded from Dividend R1.",
            peer_action_type
        )));
    }

    if find_existing_corporate_action(connection, &import_row)?.is_some() {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires manual reconciliation when a matching canonical Corporate Action already exists.".to_string(),
        ));
    }

    let Some(context) = crate::database::eod_data::resolve_instrument_context(
        connection,
        symbol,
        import_row.exchange.as_str(),
    )?
    else {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires a current resolved instrument context.".to_string(),
        ));
    };
    let dated_price_route = match super::event_price_route::resolve(connection,folder_path,&import_row) {
        Ok(route) => route,
        Err(reason) if reason.starts_with("Awaiting verified dated price-route identity:") || reason.starts_with("Waiting for EOD Data:") || reason.starts_with("Scheduled / Upcoming:") => {
            return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
        }
        Err(error) => return Err(error),
    };
    if let Some(route) = &dated_price_route {
        identity_proof.push_str(&format!(";eventPriceRouteR1={}",route.fingerprint()));
    }
    let basis_result = if let Some(route) = &dated_price_route { route.dividend_basis(cash_amount) } else {
        crate::database::instrument_mutations::load_dividend_adjustment_basis(
        connection,
        Some(folder_path),
        &context,
        ex_date_text,
        Some(cash_amount),
    ) };
    let basis = match basis_result {
        Ok(value) => value,
        Err(error) => {
            if let Some(reason) = dividend_basis_policy_ineligibility(&error) {
                return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
            }
            return Err(error);
        }
    };
    let previous_trade_date = match parse_simple_cash_dividend_policy_date(
        &basis.previous_trade_date,
        "previous trade date",
    ) {
        Ok(value) => value,
        Err(reason) => {
            return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
        }
    };
    let gap_days = ex_date
        .signed_duration_since(previous_trade_date)
        .num_days();
    if !(1..=DIVIDEND_MAX_PREV_TRADE_GAP_DAYS).contains(&gap_days) {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(format!(
            "Dividend R1 requires the previous trade date within {} calendar days before the ex-date; found {} day(s).",
            DIVIDEND_MAX_PREV_TRADE_GAP_DAYS, gap_days
        )));
    }
    // A previous close alone cannot prove the ex-date has traded. Require an
    // actual post-ex local bar before this newly activated approval path writes.
    let latest_ex_date = ex_date
        .checked_add_signed(chrono::Duration::days(DIVIDEND_MAX_PREV_TRADE_GAP_DAYS))
        .ok_or_else(|| "Dividend R1 ex-date window overflow.".to_string())?;
    let today = chrono::Local::now().date_naive();
    if ex_date > today {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 cannot approve before the official ex-date.".to_string(),
        ));
    }
    let ex_window_end = latest_ex_date.min(today).format("%Y-%m-%d").to_string();
    let ex_rows = if dated_price_route.is_some() { Vec::new() } else { crate::database::eod_data::load_unified_price_rows(
        folder_path, connection, &context, ex_date_text, &ex_window_end,
    )? };
    if dated_price_route.is_none() && !ex_rows.iter().any(|row| {
        row.date.as_str() >= ex_date_text && row.date.as_str() <= ex_window_end.as_str()
            && row.close.is_finite() && row.close > 0.0
    }) {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 requires a valid local ex-date or next-trading-date EOD close within seven calendar days."
                .to_string(),
        ));
    }

    if !basis.previous_close.is_finite()
        || basis.previous_close <= 0.0
        || basis.cash_amount != cash_amount
        || cash_amount >= basis.previous_close
        || !basis.computed_factor.is_finite()
        || basis.computed_factor <= 1.0
        || (basis.computed_factor - 1.0).abs() < f64::EPSILON
    {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(
            "Dividend R1 local previous-close basis is not valid for autonomous eligibility."
                .to_string(),
        ));
    }

    // Ready must satisfy the ordinary writer's symbol/date routing too. A
    // shared ISIN in unified prices is not dated historical-symbol evidence.
    if let Err(reason) = super::ensure_official_import_eod_ready(
        connection, folder_path, &import_row, symbol, ex_date_text,
    ) {
        return Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason));
    }

    Ok(SimpleCashDividendPolicyEligibility::Eligible(
        SimpleCashDividendPolicyEvidence {
            identity_proof,
            official_evidence_id: official_evidence.id,
            evidence_captured_at: official_evidence.captured_at,
            source_locator: official_evidence.source_locator,
            cash_amount,
            previous_trade_date: basis.previous_trade_date,
            previous_close: basis.previous_close,
            computed_factor: basis.computed_factor,
        },
    ))
}

pub(super) fn evaluate_simple_cash_dividend_prepared_scope_in_connection(
    connection: &Connection,
    folder_path: &Path,
    input: &SimpleCashDividendPreparedScopeInput,
) -> AppResult<SimpleCashDividendPreparedScopeResult> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;

    let mut import_ids = input.import_ids.clone();
    import_ids.sort_unstable();
    let scope_fingerprint = simple_cash_dividend_prepared_scope_fingerprint(
        input.expected_database_path.as_str(),
        &import_ids,
    );

    let mut eligible = 0_u32;
    let mut ineligible = 0_u32;
    let mut already_approved = 0_u32;
    let mut stale_scope = 0_u32;
    let mut missing = 0_u32;
    let mut failed = 0_u32;
    let mut dispositions = Vec::with_capacity(import_ids.len());
    // Reuse reads only inside this invocation's stable transaction snapshot.
    // Direct/autocommit and financial writer policy calls retain fresh reads.
    let mut peer_cache = (!connection.is_autocommit()).then(DividendPeerCache::default);

    for import_id in import_ids.iter().copied() {
        let exists = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM corporate_action_imports WHERE id = ?)",
                params![import_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?
            != 0;
        if !exists {
            missing += 1;
            dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                import_id,
                disposition: "MISSING".to_string(),
                reason: "Prepared-scope import ID no longer exists; no policy evaluation or write was performed.".to_string(),
                current_action_type: None,
                current_parse_status: None,
                current_review_status: None,
                evidence: None,
            });
            continue;
        }

        let import_row = get_import_row(connection, import_id)?;
        let current_action_type = Some(import_row.action_type.clone());
        let current_parse_status = Some(import_row.parse_status.clone());
        let current_review_status = Some(import_row.review_status.clone());

        if import_row.approved_corporate_action_id.is_some()
            || import_row.review_status == "APPROVED"
        {
            already_approved += 1;
            dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                import_id,
                disposition: "ALREADY_APPROVED".to_string(),
                reason:
                    "Prepared-scope row is already approved; no autonomous write was performed."
                        .to_string(),
                current_action_type,
                current_parse_status,
                current_review_status,
                evidence: None,
            });
            continue;
        }

        if import_row.action_type != "DIVIDEND"
            || import_row.parse_status != "PARSED"
            || import_row.review_status != "PENDING"
        {
            stale_scope += 1;
            dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                import_id,
                disposition: "STALE_SCOPE".to_string(),
                reason: format!(
                    "Prepared-scope row is no longer DIVIDEND + PARSED + PENDING; found {} + {} + {}.",
                    import_row.action_type, import_row.parse_status, import_row.review_status
                ),
                current_action_type,
                current_parse_status,
                current_review_status,
                evidence: None,
            });
            continue;
        }

        match evaluate_simple_cash_dividend_policy_with_peer_cache(connection, folder_path, import_id, peer_cache.as_mut()) {
            Ok(SimpleCashDividendPolicyEligibility::Eligible(evidence)) => {
                eligible += 1;
                dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                    import_id,
                    disposition: "ELIGIBLE".to_string(),
                    reason: format!(
                        "Eligible under {SIMPLE_CASH_DIVIDEND_POLICY_VERSION}; this read-only scope stage performed no write."
                    ),
                    current_action_type,
                    current_parse_status,
                    current_review_status,
                    evidence: Some(evidence),
                });
            }
            Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason)) => {
                ineligible += 1;
                dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                    import_id,
                    disposition: "INELIGIBLE".to_string(),
                    reason,
                    current_action_type,
                    current_parse_status,
                    current_review_status,
                    evidence: None,
                });
            }
            Ok(SimpleCashDividendPolicyEligibility::AlreadyApproved) => {
                already_approved += 1;
                dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                    import_id,
                    disposition: "ALREADY_APPROVED".to_string(),
                    reason: "Dividend R1 evaluator reported the row already approved; no autonomous write was performed.".to_string(),
                    current_action_type,
                    current_parse_status,
                    current_review_status,
                    evidence: None,
                });
            }
            Err(error) => {
                failed += 1;
                dispositions.push(SimpleCashDividendPreparedScopeDisposition {
                    import_id,
                    disposition: "FAILED".to_string(),
                    reason: error,
                    current_action_type,
                    current_parse_status,
                    current_review_status,
                    evidence: None,
                });
            }
        }
    }

    let requested = import_ids.len() as u32;
    let complete = failed == 0;
    Ok(SimpleCashDividendPreparedScopeResult {
        requested,
        reused_count: 0,
        eligible,
        ineligible,
        already_approved,
        stale_scope,
        missing,
        failed,
        dispositions,
        policy_version: SIMPLE_CASH_DIVIDEND_POLICY_VERSION.to_string(),
        scope_fingerprint,
        complete,
        message: format!(
            "Dividend prepared-scope R1 read-only evaluation reviewed {requested} row(s): {eligible} eligible, {ineligible} ineligible, {already_approved} already approved, {stale_scope} stale scope, {missing} missing, {failed} failed. No Corporate Action or decision write was performed."
        ),
    })
}

pub(super) fn validate_simple_cash_dividend_write_stage_input(
    folder_path: &Path,
    input: &SimpleCashDividendWriteStageInput,
) -> AppResult<(Vec<i64>, String)> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    if input.expected_policy_version != SIMPLE_CASH_DIVIDEND_POLICY_VERSION {
        return Err(format!(
            "Dividend write-stage policy version mismatch: expected {SIMPLE_CASH_DIVIDEND_POLICY_VERSION}."
        ));
    }
    if input.expected_scope_version != SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION {
        return Err(format!(
            "Dividend write-stage prepared-scope version mismatch: expected {SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION}."
        ));
    }
    if input.expected_write_stage_version != SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION {
        return Err(format!(
            "Dividend write-stage protocol version mismatch: expected {SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION}."
        ));
    }

    let mut import_ids = input.import_ids.clone();
    import_ids.sort_unstable();
    let scope_fingerprint = simple_cash_dividend_prepared_scope_fingerprint(
        input.expected_database_path.as_str(),
        &import_ids,
    );
    if input.expected_scope_fingerprint != scope_fingerprint {
        return Err(
            "Dividend write-stage scope fingerprint mismatch. Load & Prepare again.".to_string(),
        );
    }
    Ok((import_ids, scope_fingerprint))
}

fn simple_cash_dividend_write_stage_audit_reason(
    import_row: &CorporateActionImportRow,
    evidence: &SimpleCashDividendPolicyEvidence,
    input: &SimpleCashDividendWriteStageInput,
    scope_fingerprint: &str,
    corporate_action_id: i64,
) -> String {
    format!(
        "policy={}; writeStageVersion={}; preparedScopeVersion={}; scopeFingerprint={}; importId={}; databaseContext={}; exchange={}; symbol={}; isin={}; actionType={}; exDate={}; cashAmount={:.12}; identityProof={}; officialEvidenceId={}; evidenceCapturedAt={}; sourceLocator={}; previousTradeDate={}; previousClose={:.12}; computedFactor={:.12}; canonicalCorporateActionId={}",
        SIMPLE_CASH_DIVIDEND_POLICY_VERSION,
        SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION,
        SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION,
        scope_fingerprint,
        import_row.id,
        input.expected_database_path,
        import_row.exchange,
        import_row.symbol.as_deref().unwrap_or_default(),
        import_row.isin.as_deref().unwrap_or_default(),
        import_row.action_type,
        import_row.ex_date.as_deref().unwrap_or_default(),
        evidence.cash_amount,
        evidence.identity_proof,
        evidence.official_evidence_id,
        evidence.evidence_captured_at,
        evidence.source_locator.as_deref().unwrap_or_default(),
        evidence.previous_trade_date,
        evidence.previous_close,
        evidence.computed_factor,
        corporate_action_id,
    )
}

fn verify_simple_cash_dividend_write_result(
    connection: &Connection,
    previous: &CorporateActionImportRow,
    result: &CorporateActionImportApprovalResult,
    evidence: &SimpleCashDividendPolicyEvidence,
) -> AppResult<i64> {
    let approved = result.approved_record.as_ref().ok_or_else(|| {
        "Dividend R1 write invariant failed: ordinary writer returned linked-existing/no new canonical action after fresh eligibility."
            .to_string()
    })?;
    if approved.stored_record_id <= 0 {
        return Err(
            "Dividend R1 write invariant failed: ordinary writer returned an invalid canonical action ID."
                .to_string(),
        );
    }
    if approved.action_type != "DIVIDEND" {
        return Err(format!(
            "Dividend R1 write invariant failed: ordinary writer returned action type {}.",
            approved.action_type
        ));
    }
    let expected_symbol = previous.symbol.as_deref().ok_or_else(|| {
        "Dividend R1 write invariant failed: current symbol is missing.".to_string()
    })?;
    let expected_ex_date = previous
        .ex_date
        .as_deref()
        .ok_or_else(|| "Dividend R1 write invariant failed: ex-date is missing.".to_string())?;
    if approved.exchange != previous.exchange
        || approved.current_symbol != expected_symbol
        || approved.effective_date != expected_ex_date
    {
        return Err(
            "Dividend R1 write invariant failed: writer result identity/date does not match the freshly revalidated import."
                .to_string(),
        );
    }
    if approved.factor != Some(evidence.computed_factor) {
        return Err(
            "Dividend R1 write invariant failed: writer factor does not match the fresh policy evidence factor."
                .to_string(),
        );
    }
    if result.import_record.id != previous.id
        || result.import_record.review_status != "APPROVED"
        || result.import_record.approved_corporate_action_id != Some(approved.stored_record_id)
    {
        return Err(
            "Dividend R1 write invariant failed: final import row is not APPROVED and linked to the exact new canonical action."
                .to_string(),
        );
    }

    let canonical = connection
        .query_row(
            "\n              SELECT symbol, exchange, isin, effective_date, action_type, cash_amount, factor\n              FROM corporate_actions\n              WHERE id = ?\n            ",
            params![approved.stored_record_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<f64>>(5)?,
                    row.get::<_, Option<f64>>(6)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| {
            "Dividend R1 write invariant failed: resulting canonical action could not be reloaded."
                .to_string()
        })?;
    // Quick Resolve retains the official event-time ISIN. The canonical writer
    // stores the current instrument ISIN; the freshly revalidated historical
    // proof above binds the two identities without rewriting the source row.
    let expected_canonical_isin = load_unique_active_symbol_isin(
        connection, &previous.exchange, expected_symbol,
    )?.ok_or_else(|| "Dividend R1 current canonical identity is no longer unique.".to_string())?;
    if canonical.0 != expected_symbol
        || canonical.1 != previous.exchange
        || canonical.2 != expected_canonical_isin
        || canonical.3 != expected_ex_date
        || canonical.4 != "DIVIDEND"
        || canonical.5 != Some(evidence.cash_amount)
        || canonical.6 != Some(evidence.computed_factor)
    {
        return Err(
            "Dividend R1 write invariant failed: persisted canonical Dividend does not match the freshly revalidated import/evidence."
                .to_string(),
        );
    }
    Ok(approved.stored_record_id)
}

fn execute_simple_cash_dividend_write_stage_with_ops<W, A>(
    connection: &Connection,
    folder_path: &Path,
    input: &SimpleCashDividendWriteStageInput,
    writer: W,
    audit: A,
) -> AppResult<SimpleCashDividendWriteStageResult>
where
    W: Fn(&Connection, &Path, i64) -> AppResult<CorporateActionImportApprovalResult>,
    A: Fn(&Connection, &CorporateActionImportRow, &CorporateActionImportRow, &str) -> AppResult<()>,
{
    let (import_ids, scope_fingerprint) =
        validate_simple_cash_dividend_write_stage_input(folder_path, input)?;
    let mut revalidated_eligible = 0_u32;
    let mut auto_approved = 0_u32;
    let mut ineligible = 0_u32;
    let mut already_approved = 0_u32;
    let mut stale_scope = 0_u32;
    let mut missing = 0_u32;
    let mut failed = 0_u32;
    let mut dispositions = Vec::with_capacity(import_ids.len());

    for import_id in import_ids.iter().copied() {
        let exists = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM corporate_action_imports WHERE id = ?)",
                params![import_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?
            != 0;
        if !exists {
            missing += 1;
            dispositions.push(SimpleCashDividendWriteStageDisposition {
                import_id,
                disposition: "MISSING".to_string(),
                reason:
                    "Prepared-scope import ID no longer exists; no autonomous write was performed."
                        .to_string(),
                corporate_action_id: None,
            });
            continue;
        }

        let current = get_import_row(connection, import_id)?;
        if current.approved_corporate_action_id.is_some() || current.review_status == "APPROVED" {
            already_approved += 1;
            dispositions.push(SimpleCashDividendWriteStageDisposition {
                import_id,
                disposition: "ALREADY_APPROVED".to_string(),
                reason:
                    "Current import is already approved; no second autonomous write was performed."
                        .to_string(),
                corporate_action_id: current.approved_corporate_action_id,
            });
            continue;
        }
        if current.action_type != "DIVIDEND"
            || current.parse_status != "PARSED"
            || current.review_status != "PENDING"
        {
            stale_scope += 1;
            dispositions.push(SimpleCashDividendWriteStageDisposition {
                import_id,
                disposition: "STALE_SCOPE".to_string(),
                reason: format!(
                    "Prepared-scope row is no longer DIVIDEND + PARSED + PENDING; found {} + {} + {}.",
                    current.action_type, current.parse_status, current.review_status
                ),
                corporate_action_id: current.approved_corporate_action_id,
            });
            continue;
        }

        let evidence = match evaluate_simple_cash_dividend_policy_r1(
            connection,
            folder_path,
            import_id,
        ) {
            Ok(SimpleCashDividendPolicyEligibility::Eligible(evidence)) => evidence,
            Ok(SimpleCashDividendPolicyEligibility::Ineligible(reason)) => {
                ineligible += 1;
                dispositions.push(SimpleCashDividendWriteStageDisposition {
                    import_id,
                    disposition: "INELIGIBLE".to_string(),
                    reason,
                    corporate_action_id: None,
                });
                continue;
            }
            Ok(SimpleCashDividendPolicyEligibility::AlreadyApproved) => {
                already_approved += 1;
                let row = get_import_row(connection, import_id)?;
                dispositions.push(SimpleCashDividendWriteStageDisposition {
                    import_id,
                    disposition: "ALREADY_APPROVED".to_string(),
                    reason: "Dividend R1 fresh evaluator reported the import already approved; no write was performed."
                        .to_string(),
                    corporate_action_id: row.approved_corporate_action_id,
                });
                continue;
            }
            Err(error) => {
                failed += 1;
                dispositions.push(SimpleCashDividendWriteStageDisposition {
                    import_id,
                    disposition: "FAILED".to_string(),
                    reason: error,
                    corporate_action_id: None,
                });
                continue;
            }
        };
        revalidated_eligible += 1;

        connection
            .execute_batch("SAVEPOINT corporate_action_dividend_r1_item")
            .map_err(|error| error.to_string())?;
        let item_result = (|| -> AppResult<(i64, String)> {
            let previous = get_import_row(connection, import_id)?;
            let result = writer(connection, folder_path, import_id)?;
            let corporate_action_id = verify_simple_cash_dividend_write_result(
                connection, &previous, &result, &evidence,
            )?;
            let reason = simple_cash_dividend_write_stage_audit_reason(
                &previous,
                &evidence,
                input,
                &scope_fingerprint,
                corporate_action_id,
            );
            audit(connection, &previous, &result.import_record, &reason)?;
            Ok((corporate_action_id, reason))
        })();

        match item_result {
            Ok((corporate_action_id, reason)) => {
                connection
                    .execute_batch("RELEASE SAVEPOINT corporate_action_dividend_r1_item")
                    .map_err(|error| error.to_string())?;
                auto_approved += 1;
                dispositions.push(SimpleCashDividendWriteStageDisposition {
                    import_id,
                    disposition: "AUTO_APPROVED".to_string(),
                    reason,
                    corporate_action_id: Some(corporate_action_id),
                });
            }
            Err(error) => {
                connection
                    .execute_batch(
                        "ROLLBACK TO SAVEPOINT corporate_action_dividend_r1_item; \
                         RELEASE SAVEPOINT corporate_action_dividend_r1_item",
                    )
                    .map_err(|rollback_error| {
                        format!(
                            "Could not rollback failed Dividend R1 write-stage item {}: {}",
                            import_id, rollback_error
                        )
                    })?;
                failed += 1;
                dispositions.push(SimpleCashDividendWriteStageDisposition {
                    import_id,
                    disposition: "FAILED".to_string(),
                    reason: error,
                    corporate_action_id: None,
                });
            }
        }
    }

    let requested = import_ids.len() as u32;
    let complete = failed == 0;
    Ok(SimpleCashDividendWriteStageResult {
        requested,
        revalidated_eligible,
        auto_approved,
        ineligible,
        already_approved,
        stale_scope,
        missing,
        failed,
        dispositions,
        policy_version: SIMPLE_CASH_DIVIDEND_POLICY_VERSION.to_string(),
        scope_version: SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION.to_string(),
        write_stage_version: SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION.to_string(),
        scope_fingerprint,
        complete,
        message: format!(
            "Dividend write-stage R1 reviewed {requested} scoped row(s): {revalidated_eligible} freshly eligible, {auto_approved} auto-approved, {ineligible} ineligible, {already_approved} already approved, {stale_scope} stale scope, {missing} missing, {failed} failed. P3C eligibility was not used as write authority."
        ),
    })
}

pub(super) fn execute_simple_cash_dividend_write_stage_in_connection(
    connection: &Connection,
    folder_path: &Path,
    input: &SimpleCashDividendWriteStageInput,
) -> AppResult<SimpleCashDividendWriteStageResult> {
    execute_simple_cash_dividend_write_stage_with_ops(
        connection,
        folder_path,
        input,
        |connection, folder_path, import_id| {
            approve_corporate_action_import_without_transaction(
                connection,
                folder_path,
                import_id,
                false,
                false,
            )
        },
        |connection, previous, resolved, reason| {
            record_corporate_action_import_decision(
                connection,
                previous,
                resolved,
                SIMPLE_CASH_DIVIDEND_DECISION_TYPE,
                reason,
            )
        },
    )
}

const AUTO_APPROVAL_NEAR_UNITY_MARGIN: f64 = 0.40;
const AUTO_APPROVAL_MAX_EX_DATE_GAP_DAYS: i64 = 7;

fn parse_policy_date(value: &str, label: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("Safe V2 requires a valid {label} YYYY-MM-DD date."))
}

fn split_bonus_scan_basis(
    import_row: &CorporateActionImportRow,
    validation: &crate::database::CorporateActionScanResultRow,
    confidence: f64,
    expected_factor: f64,
) -> Result<ActionApprovalBasis, String> {
    if !confidence.is_finite() || !expected_factor.is_finite() || expected_factor <= 0.0 {
        return Err("Safe V2 requires finite positive Split/Bonus validation evidence.".to_string());
    }

    let Some(ex_date_text) = import_row.ex_date.as_deref() else {
        return Err("Safe V2 requires the official ex-date.".to_string());
    };
    let Some(ex_trade_date_text) = validation.ex_trade_date.as_deref() else {
        return Err("Safe V2 requires an explicit ex-side trade date.".to_string());
    };
    let ex_date = parse_policy_date(ex_date_text, "official ex-date")?;
    let ex_trade_date = parse_policy_date(ex_trade_date_text, "ex-side trade")?;
    let gap_days = ex_trade_date.signed_duration_since(ex_date).num_days();
    if !(0..=AUTO_APPROVAL_MAX_EX_DATE_GAP_DAYS).contains(&gap_days) {
        return Err(format!(
            "Safe V2 requires ex-side price evidence within {} calendar days of the official ex-date; found {} day(s).",
            AUTO_APPROVAL_MAX_EX_DATE_GAP_DAYS, gap_days
        ));
    }

    let mut observed_factor: Option<f64> = None;
    for value in [validation.actual_open_factor, validation.actual_close_factor]
        .into_iter()
        .flatten()
    {
        if !value.is_finite() || value <= 0.0 {
            continue;
        }
        observed_factor = Some(match observed_factor {
            Some(current)
                if (current - expected_factor).abs() <= (value - expected_factor).abs() => current,
            _ => value,
        });
    }
    let Some(observed_factor) = observed_factor else {
        return Err("Safe V2 requires a finite positive observed Split/Bonus price factor.".to_string());
    };

    let allowed_distance = AUTO_APPROVAL_NEAR_UNITY_MARGIN * (expected_factor - 1.0).abs();
    if (observed_factor - expected_factor).abs() > allowed_distance {
        return Err(format!(
            "Safe V2 near-unity discriminator failed: observed factor {:.12}, expected factor {:.12}, k={:.2}.",
            observed_factor, expected_factor, AUTO_APPROVAL_NEAR_UNITY_MARGIN
        ));
    }

    Ok(ActionApprovalBasis::SplitBonusScan {
        scan_id: validation.id,
        scan_timestamp: validation.scanned_at.clone(),
        confidence,
        expected_factor,
    })
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
    let legacy_manual_raw_event_conflict =
        has_legacy_manual_raw_event_identity_conflict(connection, &import_row)?;
    let Some(identity_proof) = machine_identity_proof(
        connection,
        &import_row,
        legacy_manual_raw_event_conflict,
    )? else {
        let reason = if legacy_manual_raw_event_conflict {
            "Legacy/manual resolved identity has conflicting raw event identity evidence and no machine-verifiable event-time identity proof.".to_string()
        } else {
            "No current machine-proven identity satisfies R1.".to_string()
        };
        return Ok(AutoApprovalEligibility::Ineligible(reason));
    };
    if let Some(peer_action_type) = same_date_automatic_exclusion_peer(connection, &import_row)? {
        let reason = if matches!(peer_action_type.as_str(), "SPLIT" | "BONUS") {
            "Same-date compound Split/Bonus rows are excluded from Safe V2 auto-approval.".to_string()
        } else {
            format!(
                "Same-date cross-action {} peer is excluded from Safe V2 auto-approval.",
                peer_action_type
            )
        };
        return Ok(AutoApprovalEligibility::Ineligible(reason));
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
            "Safe V2 requires the current validation factor.".to_string(),
        ));
    };
    let basis = match split_bonus_scan_basis(&import_row, &validation, confidence, expected_factor) {
        Ok(basis) => basis,
        Err(reason) => return Ok(AutoApprovalEligibility::Ineligible(reason)),
    };

    Ok(AutoApprovalEligibility::Eligible(AutoApprovalEvidence {
        identity_proof,
        basis,
    }))
}

fn audit_reason(
    import_row: &CorporateActionImportRow,
    evidence: &AutoApprovalEvidence,
    database_context: &str,
    corporate_action_id: i64,
) -> String {
    match &evidence.basis {
        ActionApprovalBasis::SplitBonusScan {
            scan_id,
            scan_timestamp,
            confidence,
            expected_factor,
        } => format!(
            "policy={}; importId={}; exchange={}; symbol={}; actionType={}; exDate={}; factor={:.12}; identityProof={}; basis=SplitBonusScan; scanId={}; scanTimestamp={}; scanStatus=MATCHED; confidence={:.6}; expectedFactor={:.12}; nearUnityK={:.2}; maxExDateGapDays={}; databaseContext={}; canonicalCorporateActionId={}",
            AUTO_APPROVAL_POLICY_VERSION,
            import_row.id,
            import_row.exchange,
            import_row.symbol.as_deref().unwrap_or_default(),
            import_row.action_type,
            import_row.ex_date.as_deref().unwrap_or_default(),
            import_row.factor.unwrap_or_default(),
            evidence.identity_proof,
            scan_id,
            scan_timestamp,
            confidence,
            expected_factor,
            AUTO_APPROVAL_NEAR_UNITY_MARGIN,
            AUTO_APPROVAL_MAX_EX_DATE_GAP_DAYS,
            database_context,
            corporate_action_id
        ),
    }
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
            "Auto-Approval Safe V2 reviewed {requested} prepared row(s): {auto_approved} newly approved, {linked_existing} linked existing, {already_approved} already approved, {skipped} skipped, {failed} failed. Manual approval remains available for eligible manual-review rows."
        ),
    })
}

#[cfg(test)]
mod write_stage_tests;

#[cfg(test)]
mod tests {
    use super::*;
    include!("auto_approval/dividend_incremental_tests.rs");

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
                  series TEXT,
                  sector TEXT,
                  industry TEXT
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
                  adjust_volume INTEGER NOT NULL DEFAULT 1,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT,
                  updated_at TEXT,
                  applied_at TEXT
                );
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  high REAL NOT NULL,
                  low REAL NOT NULL,
                  close REAL NOT NULL,
                  prev_close REAL,
                  volume INTEGER NOT NULL DEFAULT 0,
                  open_interest INTEGER NOT NULL DEFAULT 0
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
        insert_scan_window(
            connection,
            import_id,
            status,
            confidence,
            factor,
            "2026-08-14",
            Some(factor),
            Some(factor),
        );
    }



    fn insert_scan_window(
        connection: &Connection,
        import_id: i64,
        status: &str,
        confidence: Option<f64>,
        factor: f64,
        ex_trade_date: &str,
        actual_open_factor: Option<f64>,
        actual_close_factor: Option<f64>,
    ) {
        connection.execute(
            "INSERT INTO scan_runs(scope, action_types, started_at, completed_at, status, total_results)
             VALUES ('official_imports','SPLIT,BONUS','2026-08-14T00:00:00Z','2026-08-14T00:00:01Z','COMPLETED',1)", [],
        ).unwrap();
        let run_id=connection.last_insert_rowid();
        connection.execute(
            "INSERT INTO corporate_action_scan_results(
              scan_run_id, corporate_action_import_id, symbol, exchange, scan_status,
              prev_trade_date, ex_trade_date, expected_factor, actual_open_factor,
              actual_close_factor, confidence, message, scanned_at
             ) VALUES (?, ?, 'TEST', 'NSE', ?, '2026-08-13', ?, ?, ?, ?, ?, 'fixture', '2026-08-14T00:00:01Z')",
            params![run_id, import_id, status, ex_trade_date, factor, actual_open_factor, actual_close_factor, confidence],
        ).unwrap();
    }

    fn split_bonus_basis(evidence: &AutoApprovalEvidence) -> (i64, &str, f64, f64) {
        match &evidence.basis {
            ActionApprovalBasis::SplitBonusScan { scan_id, scan_timestamp, confidence, expected_factor } =>
                (*scan_id, scan_timestamp.as_str(), *confidence, *expected_factor),
        }
    }

    fn dividend_policy_folder() -> std::path::PathBuf {
        std::env::temp_dir().join("eod-dividend-policy-r1-no-binary-fixture")
    }

    fn insert_simple_cash_dividend_import(
        connection: &Connection,
        id: i64,
        source: &str,
        review_status: &str,
        purpose_raw: &str,
        ex_date: &str,
        cash_amount: f64,
    ) {
        connection
            .execute(
                "INSERT INTO corporate_action_imports (
                   id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date,
                   action_type, cash_amount, parse_status, review_status
                 ) VALUES (?, ?, 'NSE', ?, 'TEST', 'INEAUTO01001', 'Test Limited', ?, ?,
                   'DIVIDEND', ?, 'PARSED', ?)",
                params![
                    id,
                    format!("dividend-row-{id}"),
                    source,
                    purpose_raw,
                    ex_date,
                    cash_amount,
                    review_status
                ],
            )
            .unwrap();
    }

    fn insert_exact_dividend_official_evidence(
        connection: &Connection,
        import_id: i64,
        purpose_raw: &str,
        ex_date: &str,
    ) {
        let raw_reference = super::super::build_import_evidence_raw_reference(
            Some("TEST"),
            Some("INEAUTO01001"),
            None,
            Some("Test Limited"),
            purpose_raw,
            Some(ex_date),
            None,
        )
        .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_action_import_evidence(
                   import_id, source_code, source_locator, captured_at, symbol_seen, isin_seen,
                   company_name_seen, action_type_seen, event_date_seen, factor_seen, raw_reference, note
                 ) VALUES (?, 'NSE_API', 'fixture://nse-api', '2026-08-10T10:00:00Z', 'TEST',
                   'INEAUTO01001', 'Test Limited', 'DIVIDEND', ?, NULL, ?, 'fixture')",
                params![import_id, ex_date, raw_reference],
            )
            .unwrap();
    }

    fn insert_dividend_previous_close(connection: &Connection, date: &str, close: f64) {
        connection
            .execute(
                "INSERT INTO eod_prices(
                   symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest
                 ) VALUES ('TEST','NSE',?, ?, ?, ?, ?, NULL, 1000, 0)",
                params![date, close, close, close, close],
            )
            .unwrap();
    }

    fn prepared_scope_folder() -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!(
            "eod-dividend-prepared-scope-r1-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&folder).unwrap();
        folder.canonicalize().unwrap()
    }

    fn prepared_scope_input(
        folder: &std::path::Path,
        import_ids: Vec<i64>,
    ) -> SimpleCashDividendPreparedScopeInput {
        SimpleCashDividendPreparedScopeInput {
            import_ids,
            expected_database_path: folder.to_string_lossy().to_string(),
        }
    }

    fn eligible_dividend_fixture() -> Connection {
        let connection = fixture();
        let purpose = "Interim Dividend - Rs. 5 per share";
        insert_simple_cash_dividend_import(
            &connection,
            1,
            "NSE_API",
            "PENDING",
            purpose,
            "2026-08-14",
            5.0,
        );
        insert_exact_dividend_official_evidence(&connection, 1, purpose, "2026-08-14");
        insert_dividend_previous_close(&connection, "2026-08-13", 100.0);
        insert_dividend_previous_close(&connection, "2026-08-14", 95.0);
        connection
    }

    fn existing_dividend_fixture() -> Connection {
        let c = eligible_dividend_fixture();
        c.execute("INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,action_type,factor,cash_amount,adjust_volume,source)
            VALUES (77,'TEST','NSE','INEAUTO01001','2026-08-14','DIVIDEND',?,5,0,'NSE_API')", [100.0 / 95.0]).unwrap();
        insert_simple_cash_dividend_import(&c, 2, "NSE_API", "APPROVED", "Dividend Rs.5 per share", "2026-08-14", 5.0);
        c.execute("UPDATE corporate_action_imports SET approved_corporate_action_id=77 WHERE id=2", []).unwrap();
        c
    }

    #[test]
    fn existing_dividend_classification_is_read_only_and_keeps_duplicate_guard() {
        let c = existing_dividend_fixture();
        c.execute_batch("PRAGMA query_only=ON").unwrap();
        assert_eq!(verified_existing_dividend(&c, &dividend_policy_folder(), 1).unwrap(), Some(77));
        let row = get_import_row(&c, 1).unwrap();
        assert_eq!(row.review_status, "PENDING");
        assert!(row.approved_corporate_action_id.is_none());
        assert!(matches!(evaluate_simple_cash_dividend_policy_r1(&c, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(_)));
        assert_eq!(find_existing_corporate_action(&c, &row).unwrap(), Some(77));
    }

    #[test]
    fn existing_dividend_classification_rejects_conflicts_and_missing_proof() {
        for sql in [
            "UPDATE corporate_action_imports SET approved_corporate_action_id=NULL WHERE id=2",
            "UPDATE corporate_action_imports SET cash_amount=6 WHERE id=2",
            "UPDATE corporate_action_imports SET review_status='UNRESOLVED' WHERE id=1",
            "UPDATE corporate_action_imports SET isin='OTHER' WHERE id=1",
            "DELETE FROM corporate_action_import_evidence",
            "UPDATE corporate_actions SET factor=1.2",
            "UPDATE corporate_actions SET source='LEGACY_MUTATED'",
            "UPDATE corporate_actions SET adjust_volume=1",
            "UPDATE corporate_actions SET isin='OTHER'",
            "INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,cash_amount) SELECT symbol,exchange,isin,effective_date,action_type,factor,cash_amount FROM corporate_actions",
        ] {
            let c = existing_dividend_fixture();
            c.execute_batch(sql).unwrap();
            assert_eq!(verified_existing_dividend(&c, &dividend_policy_folder(), 1).unwrap(), None, "{sql}");
        }
    }

    #[test]
    #[ignore = "Explicit read-only acceptance of the marked local evidence copy"]
    fn existing_dividend_classification_real_copy_acceptance() {
        let folder = std::path::PathBuf::from(std::env::var("CA_EXISTING_DIVIDEND_ACCEPTANCE").unwrap());
        assert!(folder.is_absolute());
        assert_eq!(folder.file_name().unwrap(), "ca-existing-dividend-acceptance-20261024");
        // Dated-chain proofs bind the database path. Keep their captured path;
        // use the separate acceptance folder only for copied binary prices.
        let proof_folder = folder.parent().unwrap().join("ca-witness-provenance-20261023");
        assert!(proof_folder.join("DATED_CHAIN_AUDIT.txt").is_file());
        let c = Connection::open_with_flags(proof_folder.join("market-data.sqlite3").canonicalize().unwrap(),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        c.execute_batch("PRAGMA query_only=ON").unwrap();
        let context = crate::database::eod_data::resolve_instrument_context(&c, "DELPHIFX", "NSE")
            .unwrap().unwrap();
        let rows = crate::database::eod_data::load_unified_price_rows_with_mode(
            &folder, &c, &context, "1900-01-01", "2100-01-01", crate::database::PriceStorageMode::Binary,
        ).unwrap();
        assert_eq!(rows.first().unwrap().date, "2011-06-28");
        for (import, id, date, previous, close, cash) in [
            (20928, 10199, "2015-09-04", "2015-09-03", 245.4, 7.5),
            (22118, 9769, "2016-03-18", "2016-03-17", 188.15, 7.5),
            (24836, 8699, "2017-08-14", "2017-08-11", 707.85, 3.0),
            (26670, 7991, "2018-07-30", "2018-07-27", 538.8, 1.0),
        ] {
            let matches = context.corporate_actions.iter().filter(|a| a.id == id).cloned().collect::<Vec<_>>();
            assert_eq!(matches.len(), 1);
            let raw = rows.iter().find(|r| r.date == previous).unwrap();
            assert_eq!(raw.close, close);
            let factor = close / (close - cash);
            assert!((matches[0].factor - factor).abs() < 1e-12);
            let adjusted = crate::database::eod_data::apply_corporate_adjustments(rows.clone(), &matches, true, false).unwrap();
            let before = adjusted.iter().find(|r| r.date == previous).unwrap();
            assert_eq!(before.close, crate::database::round_price(close - cash));
            assert_eq!(before.volume, raw.volume);
            let ex_raw = rows.iter().find(|r| r.date == date).unwrap();
            let ex_adjusted = adjusted.iter().find(|r| r.date == date).unwrap();
            assert_eq!(ex_raw.close, ex_adjusted.close);
            assert_eq!(verified_existing_dividend(&c, &folder, import).unwrap(), Some(id));
            let stored = get_import_row(&c, import).unwrap();
            assert!(stored.approved_corporate_action_id.is_none());
            println!("PASS import={import} canonical={id} date={date} raw_previous={close} cash={cash} adjusted_previous={} factor={factor}", before.close);
        }
    }

    fn expect_dividend_eligible(connection: &Connection) -> SimpleCashDividendPolicyEvidence {
        match evaluate_simple_cash_dividend_policy_r1(connection, &dividend_policy_folder(), 1)
            .unwrap()
        {
            SimpleCashDividendPolicyEligibility::Eligible(evidence) => evidence,
            other => panic!("expected eligible Dividend R1 policy result, got {other:?}"),
        }
    }

    #[test]
    fn phase5b_safe_v2_well_separated_split_remains_eligible_with_typed_scan_basis() {
        let connection=fixture();
        insert_import(&connection,1,"SPLIT","PENDING");
        insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        let evidence=expect_eligible(&connection,1);
        let (_, _, confidence, expected_factor)=split_bonus_basis(&evidence);
        assert_eq!(confidence,0.99);
        assert_eq!(expected_factor,2.0);
        assert_eq!(AUTO_APPROVAL_POLICY_VERSION,"AUTO_APPROVAL_SAFE_V2");
    }

    #[test]
    fn phase5b_safe_v2_near_unity_no_move_bonus_fails_closed() {
        let connection=fixture();
        insert_import(&connection,1,"BONUS","PENDING");
        connection.execute("UPDATE corporate_action_imports SET factor=1.05 WHERE id=1",[]).unwrap();
        let confidence=1.0-(0.05_f64/1.05_f64);
        insert_scan_window(&connection,1,"MATCHED",Some(confidence),1.05,"2026-08-14",Some(1.0),Some(1.0));
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("near-unity")));
    }

    #[test]
    fn phase5b_safe_v2_near_unity_bonus_close_to_expected_remains_eligible() {
        let connection=fixture();
        insert_import(&connection,1,"BONUS","PENDING");
        connection.execute("UPDATE corporate_action_imports SET factor=1.05 WHERE id=1",[]).unwrap();
        let confidence=1.0-(0.01_f64/1.05_f64);
        insert_scan_window(&connection,1,"MATCHED",Some(confidence),1.05,"2026-08-14",Some(1.04),Some(1.04));
        expect_eligible(&connection,1);
    }

    #[test]
    fn phase5b_safe_v2_seven_day_ex_gap_passes_and_eight_day_gap_fails() {
        let seven=fixture();insert_import(&seven,1,"SPLIT","PENDING");
        insert_scan_window(&seven,1,"MATCHED",Some(0.99),2.0,"2026-08-21",Some(2.0),Some(2.0));
        expect_eligible(&seven,1);

        let eight=fixture();insert_import(&eight,1,"SPLIT","PENDING");
        insert_scan_window(&eight,1,"MATCHED",Some(0.99),2.0,"2026-08-22",Some(2.0),Some(2.0));
        assert!(matches!(evaluate_auto_approval_r1(&eight,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("7 calendar days") || reason.contains("8 day")));
    }

    #[test]
    fn phase5b_safe_v2_same_date_dividend_peer_blocks_split() {
        let connection=fixture();insert_import(&connection,1,"SPLIT","PENDING");insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        insert_import(&connection,2,"DIVIDEND","PENDING");
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("cross-action") && reason.contains("DIVIDEND")));
    }

    #[test]
    fn phase5b_safe_v2_different_date_dividend_peer_does_not_block_split() {
        let connection=fixture();insert_import(&connection,1,"SPLIT","PENDING");insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        insert_import(&connection,2,"DIVIDEND","PENDING");
        connection.execute("UPDATE corporate_action_imports SET ex_date='2026-08-15' WHERE id=2",[]).unwrap();
        expect_eligible(&connection,1);
    }

    #[test]
    fn phase5b_safe_v2_nonfinite_observed_factor_fails_closed() {
        let connection=fixture();insert_import(&connection,1,"SPLIT","PENDING");
        insert_scan_window(&connection,1,"MATCHED",Some(0.99),2.0,"2026-08-14",Some(f64::NAN),Some(f64::INFINITY));
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("finite positive observed")));
    }

    #[test]
    fn phase5b_safe_v2_split_bonus_peer_keeps_compound_reason() {
        let connection=fixture();insert_import(&connection,1,"SPLIT","PENDING");insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);insert_import(&connection,2,"BONUS","PENDING");
        assert!(matches!(evaluate_auto_approval_r1(&connection,1).unwrap(),AutoApprovalEligibility::Ineligible(reason) if reason.contains("compound")));
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
        assert_eq!(split_bonus_basis(&evidence).2,0.95);
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


    fn r1b4_insert_event_evidence(
        connection: &Connection,
        import_id: i64,
        isin_seen: &str,
        note: &str,
    ) {
        connection
            .execute(
                "INSERT INTO corporate_action_import_evidence(
                   import_id, source_code, source_locator, captured_at,
                   symbol_seen, isin_seen, company_name_seen, action_type_seen,
                   event_date_seen, factor_seen, raw_reference, note
                 ) VALUES (?1,'NSE_API','r1b4-fixture','2026-08-14T00:00:00Z',
                   'TEST',?2,'Test Limited','SPLIT','2026-08-14',2.0,'{}',?3)",
                params![import_id, isin_seen, note],
            )
            .unwrap();
    }

    #[test]
    fn r1b4_ordinary_exact_current_without_raw_conflict_remains_eligible() {
        let connection = fixture();
        insert_import(&connection, 1, "SPLIT", "PENDING");
        insert_scan(&connection, 1, "MATCHED", Some(0.99), 2.0);

        let evidence = expect_eligible(&connection, 1);

        assert_eq!(evidence.identity_proof, "EXACT_ACTIVE_CURRENT_IDENTITY");
        assert_eq!(split_bonus_basis(&evidence).2, 0.99);
    }

    #[test]
    fn r1b4_legacy_row_with_matching_raw_event_isin_remains_eligible() {
        let connection = fixture();
        insert_import(&connection, 1, "SPLIT", "PENDING");
        insert_scan(&connection, 1, "MATCHED", Some(0.99), 2.0);
        connection
            .execute(
                "UPDATE corporate_action_imports SET message='Manually resolved this official row to NSE:TEST.' WHERE id=1",
                [],
            )
            .unwrap();
        r1b4_insert_event_evidence(
            &connection,
            1,
            "INEAUTO01001",
            "Backfilled from an existing corporate_action_imports row. Older builds did not retain full raw source payloads separately.",
        );

        let evidence = expect_eligible(&connection, 1);

        assert_eq!(evidence.identity_proof, "EXACT_ACTIVE_CURRENT_IDENTITY");
    }

    #[test]
    fn r1b4_verified_quick_resolution_remains_eligible() {
        let connection = fixture();
        insert_import(&connection, 1, "SPLIT", "PENDING");
        insert_scan(&connection, 1, "MATCHED", Some(0.99), 2.0);
        connection
            .execute(
                "UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",
                [],
            )
            .unwrap();
        r1b4_insert_event_evidence(
            &connection,
            1,
            "INEHIST01001",
            "Backfilled from an existing corporate_action_imports row. Older builds did not retain full raw source payloads separately.",
        );
        connection
            .execute(
                "INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
                 VALUES ('NSE','TEST','INEHIST01001','2026-08-14','fixture')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_action_import_decisions(
                   import_id,decision_type,resolved_symbol,resolved_exchange,resolved_isin,reason
                 ) VALUES (1,'VERIFIED_QUICK_RESOLUTION','TEST','NSE','INEHIST01001','fixture')",
                [],
            )
            .unwrap();

        let evidence = expect_eligible(&connection, 1);

        assert_eq!(evidence.identity_proof, "VERIFIED_QUICK_RESOLUTION");
    }

    #[test]
    fn r1b4_legacy_manual_raw_event_isin_conflict_fails_closed() {
        let connection = fixture();
        insert_import(&connection, 1, "SPLIT", "PENDING");
        insert_scan(&connection, 1, "MATCHED", Some(0.99), 2.0);
        connection
            .execute(
                "UPDATE corporate_action_imports SET message='Manually resolved this official row to NSE:TEST.' WHERE id=1",
                [],
            )
            .unwrap();
        r1b4_insert_event_evidence(
            &connection,
            1,
            "INELEGACY01019",
            "Backfilled from an existing corporate_action_imports row. Older builds did not retain full raw source payloads separately.",
        );

        assert!(matches!(
            evaluate_auto_approval_r1(&connection, 1).unwrap(),
            AutoApprovalEligibility::Ineligible(reason)
                if reason.contains("raw event identity") || reason.contains("legacy/manual")
        ));
    }

    #[test]
    fn auto_approval_r1_links_existing_and_records_safe_audit_without_touching_out_of_scope_row() {
        let connection=fixture();
        let folder = tempfile::tempdir().unwrap();
        insert_import(&connection,1,"SPLIT","PENDING"); insert_scan(&connection,1,"MATCHED",Some(0.99),2.0);
        insert_import(&connection,2,"SPLIT","PENDING"); insert_scan(&connection,2,"MATCHED",Some(0.99),2.0);
        connection.execute("UPDATE corporate_action_imports SET ex_date='2026-08-15', dedupe_key='row-2b' WHERE id=2",[]).unwrap();
        connection.execute("INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,ratio_num,ratio_den) VALUES ('TEST','NSE','INEAUTO01001','2026-08-14','SPLIT',2,2,1)",[]).unwrap();
        // Linking still requires actual local EOD bars, not only a stored scan.
        connection.execute("INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close) VALUES('TEST','NSE','2026-08-13',100,100,100,100),('TEST','NSE','2026-08-14',50,50,50,50)",[]).unwrap();
        let result=auto_approve_corporate_action_imports_in_connection(&connection,folder.path(),&CorporateActionAutoApprovalInput{import_ids:vec![1],expected_database_path:folder.path().to_string_lossy().to_string()}).unwrap();
        assert_eq!(result.requested,1); assert_eq!(result.eligible,1); assert_eq!(result.linked_existing,1); assert_eq!(result.failed,0);
        let row1=get_import_row(&connection,1).unwrap(); assert_eq!(row1.review_status,"APPROVED"); assert!(row1.approved_corporate_action_id.is_some());
        let row2=get_import_row(&connection,2).unwrap(); assert_eq!(row2.review_status,"PENDING"); assert!(row2.approved_corporate_action_id.is_none());
        let audit:(String,String)=connection.query_row("SELECT decision_type,reason FROM corporate_action_import_decisions WHERE import_id=1 ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get(0)?,r.get(1)?))).unwrap();
        assert_eq!(audit.0,AUTO_APPROVAL_POLICY_VERSION); assert!(audit.1.contains("confidence=0.990000")); assert!(audit.1.contains("canonicalCorporateActionId="));
    }

    #[test]
    fn dividend_policy_r1_accepts_exact_nse_api_simple_cash_with_current_identity_and_fresh_basis()
    {
        let connection = eligible_dividend_fixture();
        let evidence = expect_dividend_eligible(&connection);

        assert_eq!(
            SIMPLE_CASH_DIVIDEND_POLICY_VERSION,
            "AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1"
        );
        assert_eq!(evidence.identity_proof, "EXACT_ACTIVE_CURRENT_IDENTITY");
        assert_eq!(evidence.official_evidence_id, 1);
        assert_eq!(evidence.evidence_captured_at, "2026-08-10T10:00:00Z");
        assert_eq!(
            evidence.source_locator.as_deref(),
            Some("fixture://nse-api")
        );
        assert_eq!(evidence.cash_amount, 5.0);
        assert_eq!(evidence.previous_trade_date, "2026-08-13");
        assert_eq!(evidence.previous_close, 100.0);
        assert_eq!(evidence.computed_factor, 100.0 / 95.0);
    }

    #[test]
    fn dividend_policy_r1_is_nse_only() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET exchange='BSE' WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("NSE-only")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_nse_api_source() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("NSE_API")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_dividend_parsed_pending_and_resolved_state() {
        for (sql, expected) in [
            (
                "UPDATE corporate_action_imports SET action_type='RIGHTS' WHERE id=1",
                "DIVIDEND",
            ),
            (
                "UPDATE corporate_action_imports SET parse_status='NEEDS_REVIEW' WHERE id=1",
                "PARSED",
            ),
            (
                "UPDATE corporate_action_imports SET review_status='UNRESOLVED' WHERE id=1",
                "PENDING",
            ),
            (
                "UPDATE corporate_action_imports SET symbol=NULL WHERE id=1",
                "resolved symbol",
            ),
            (
                "UPDATE corporate_action_imports SET ex_date=NULL WHERE id=1",
                "ex-date",
            ),
        ] {
            let connection = eligible_dividend_fixture();
            connection.execute(sql, []).unwrap();
            assert!(
                matches!(
                    evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
                    SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains(expected)
                ),
                "{sql}"
            );
        }
    }

    #[test]
    fn dividend_policy_r1_requires_valid_ex_date() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET ex_date='2026-99-99' WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("valid official ex-date")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_cash_only_stored_semantics() {
        for column in [
            "factor",
            "price_factor",
            "ratio_num",
            "ratio_den",
            "old_face_value",
            "new_face_value",
        ] {
            let connection = eligible_dividend_fixture();
            connection
                .execute(
                    &format!("UPDATE corporate_action_imports SET {column}=2 WHERE id=1"),
                    [],
                )
                .unwrap();
            assert!(
                matches!(
                    evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
                    SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("cash-only stored semantics")
                ),
                "{column}"
            );
        }
    }

    #[test]
    fn dividend_policy_r1_requires_positive_cash_and_classifier_exact_match() {
        let invalid_cash = eligible_dividend_fixture();
        invalid_cash
            .execute(
                "UPDATE corporate_action_imports SET cash_amount=0 WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&invalid_cash, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("finite positive")
        ));

        let mismatch = eligible_dividend_fixture();
        mismatch
            .execute(
                "UPDATE corporate_action_imports SET cash_amount=6 WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&mismatch, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason)
                if reason == "Dividend R1 cash evidence: Parsed and stored cash amounts disagree."
        ));

        let complex = eligible_dividend_fixture();
        complex.execute(
            "UPDATE corporate_action_imports SET purpose_raw='Special Dividend Rs 5 per share' WHERE id=1",
            [],
        ).unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&complex, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason)
                if reason == "Dividend R1 cash evidence: Special or inclusive multi-component dividend."
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_exact_unique_nse_api_official_witness() {
        let missing = eligible_dividend_fixture();
        missing
            .execute(
                "DELETE FROM corporate_action_import_evidence WHERE import_id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&missing, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("exactly one exact persisted NSE_API")
        ));

        let mismatched = eligible_dividend_fixture();
        mismatched.execute(
            r#"UPDATE corporate_action_import_evidence SET raw_reference='{"purposeRaw":"Dividend Rs 6 per share","exDate":"2026-08-14"}' WHERE import_id=1"#,
            [],
        ).unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&mismatched, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("exactly one exact persisted NSE_API")
        ));

        let duplicate = eligible_dividend_fixture();
        let raw: String = duplicate
            .query_row(
                "SELECT raw_reference FROM corporate_action_import_evidence WHERE import_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        duplicate.execute(
            "INSERT INTO corporate_action_import_evidence(
               import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,
               action_type_seen,event_date_seen,factor_seen,raw_reference,note
             ) VALUES (1,'NSE_API','fixture://duplicate','2026-08-10T11:00:00Z','TEST','INEAUTO01001',
               'Test Limited','DIVIDEND','2026-08-14',NULL,?,'duplicate')",
            params![raw],
        ).unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&duplicate, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("exactly one exact persisted NSE_API")
        ));
    }

    fn dividend_witness_provenance_fixture() -> (Connection, i64) {
        let c = eligible_dividend_fixture();
        c.execute("UPDATE corporate_action_import_evidence SET note='Backfilled from an existing corporate_action_imports row.' WHERE import_id=1", []).unwrap();
        let row = get_import_row(&c, 1).unwrap();
        let raw = super::super::build_import_evidence_raw_reference(
            row.symbol.as_deref(),
            row.isin.as_deref(),
            None,
            row.company_name.as_deref(),
            &row.purpose_raw,
            row.ex_date.as_deref(),
            None,
        )
        .unwrap();
        let id = super::super::ensure_import_evidence(
            &c,
            1,
            "NSE_API",
            Some("https://www.nseindia.com/api/corporates-corporateActions?index=equities"),
            Some("2026-08-10T11:00:00Z"),
            row.symbol.as_deref(),
            row.isin.as_deref(),
            row.company_name.as_deref(),
            Some("DIVIDEND"),
            row.ex_date.as_deref(),
            None,
            Some(&raw),
            Some("Captured from current structured official source row."),
        )
        .unwrap();
        (c, id)
    }

    #[test]
    fn dividend_policy_r1_witness_provenance_selects_fresh_without_modifying_evidence() {
        let (c, fresh_id) = dividend_witness_provenance_fixture();
        let before: String = c.query_row("SELECT group_concat(id || ':' || raw_reference || ':' || note,'|') FROM corporate_action_import_evidence",[],|r|r.get(0)).unwrap();
        let evidence = expect_dividend_eligible(&c);
        assert_eq!(evidence.official_evidence_id, fresh_id);
        let after: String = c.query_row("SELECT group_concat(id || ':' || raw_reference || ':' || note,'|') FROM corporate_action_import_evidence",[],|r|r.get(0)).unwrap();
        assert_eq!(before, after);
        assert_eq!(
            get_import_row(&c, 1).unwrap().approved_corporate_action_id,
            None
        );
        // Without a fresh observation the existing single-backfill policy is
        // unchanged; the separate dated-chain identity contract still rejects it.
        c.execute(
            "DELETE FROM corporate_action_import_evidence WHERE id=?",
            [fresh_id],
        )
        .unwrap();
        expect_dividend_eligible(&c);
    }

    #[test]
    fn dividend_policy_r1_witness_provenance_rejects_conflicts_and_invalid_capture() {
        for (column, value) in [
            (
                "raw_reference",
                r#"{"symbol":"TEST","isin":"INEAUTO01001","purposeRaw":"Dividend Rs 99 per share","exDate":"2026-08-14"}"#,
            ),
            ("raw_reference", "not JSON"),
            ("isin_seen", "INEOTHER01001"),
            ("symbol_seen", "OTHER"),
            ("event_date_seen", "2026-08-15"),
            ("captured_at", ""),
            (
                "source_locator",
                "https://example.com/api/corporates-corporateActions",
            ),
            (
                "source_locator",
                "http://www.nseindia.com/api/corporates-corporateActions",
            ),
        ] {
            for corrupt_fresh in [false, true] {
                if !corrupt_fresh && column == "source_locator" {
                    continue;
                }
                let (c, fresh_id) = dividend_witness_provenance_fixture();
                let id = if corrupt_fresh {
                    fresh_id
                } else {
                    fresh_id - 1
                };
                c.execute(
                    &format!("UPDATE corporate_action_import_evidence SET {column}=? WHERE id=?"),
                    params![value, id],
                )
                .unwrap();
                assert!(
                    matches!(evaluate_simple_cash_dividend_policy_r1(&c,&dividend_policy_folder(),1).unwrap(),
                    SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("exactly one exact persisted NSE_API")),
                    "{column}, fresh={corrupt_fresh}"
                );
            }
        }
    }

    #[test]
    fn dividend_policy_r1_witness_provenance_rejects_multiple_independent_observations() {
        for contradictory in [false, true] {
            let (c, fresh_id) = dividend_witness_provenance_fixture();
            c.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,raw_reference,note)
                SELECT import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,raw_reference,'second independent capture'
                FROM corporate_action_import_evidence WHERE id=?",[fresh_id]).unwrap();
            if contradictory {
                c.execute("UPDATE corporate_action_import_evidence SET raw_reference='{}',event_date_seen='2026-08-15' WHERE id=last_insert_rowid()",[]).unwrap();
            }
            assert!(
                matches!(evaluate_simple_cash_dividend_policy_r1(&c,&dividend_policy_folder(),1).unwrap(),
                SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("exactly one exact persisted NSE_API"))
            );
        }
    }

    #[test]
    fn dividend_policy_r1_rejects_manual_and_exception_provenance() {
        for decision_type in FORBIDDEN_DECISION_TYPES {
            let connection = eligible_dividend_fixture();
            connection.execute(
                "INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES (1,?,'fixture')",
                params![decision_type],
            ).unwrap();
            assert!(
                matches!(
                    evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
                    SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("Manual") || reason.contains("exceptional")
                ),
                "{decision_type}"
            );
        }
    }

    #[test]
    fn dividend_policy_r1_requires_current_machine_identity() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("machine-proven identity")
        ));
    }

    #[test]
    fn dividend_policy_r1_accepts_revalidated_verified_quick_resolution() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",
                [],
            )
            .unwrap();
        connection.execute(
            "UPDATE corporate_action_import_evidence SET isin_seen='INEHIST01001' WHERE import_id=1",
            [],
        ).unwrap();
        connection
            .execute(
                "INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
             VALUES ('NSE','TEST','INEHIST01001','2026-08-14','fixture')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_action_import_decisions(
               import_id,decision_type,resolved_symbol,resolved_exchange,resolved_isin,reason
             ) VALUES (1,'VERIFIED_QUICK_RESOLUTION','TEST','NSE','INEHIST01001','fixture')",
                [],
            )
            .unwrap();

        let evidence = expect_dividend_eligible(&connection);
        assert_eq!(evidence.identity_proof, "VERIFIED_QUICK_RESOLUTION");
    }

    #[test]
    fn dividend_policy_r1_rejects_same_date_peer_for_effective_identity() {
        let connection = eligible_dividend_fixture();
        insert_import(&connection, 2, "SPLIT", "PENDING");
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("Same-date") && reason.contains("SPLIT")
        ));
    }

    #[test]
    fn dividend_policy_r1_rejects_matching_existing_canonical_action() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "INSERT INTO corporate_actions(
               symbol,exchange,isin,effective_date,action_type,factor,cash_amount,adjust_volume
             ) VALUES ('TEST','NSE','INEAUTO01001','2026-08-14','DIVIDEND',1.0526315789473684,5,0)",
                [],
            )
            .unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("manual reconciliation")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_actual_post_ex_date_local_eod_close() {
        let connection = eligible_dividend_fixture();
        connection.execute("DELETE FROM eod_prices WHERE date >= '2026-08-14'", []).unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("ex-date")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_local_previous_close_basis() {
        let connection = eligible_dividend_fixture();
        connection.execute("DELETE FROM eod_prices", []).unwrap();
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("previous-close basis")
        ));
    }

    #[test]
    fn dividend_policy_r1_requires_previous_trade_within_seven_calendar_days() {
        let connection = eligible_dividend_fixture();
        connection.execute("DELETE FROM eod_prices", []).unwrap();
        insert_dividend_previous_close(&connection, "2026-08-06", 100.0);
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("7 calendar days") && reason.contains("8 day")
        ));
    }

    #[test]
    fn dividend_policy_r1_rejects_cash_not_smaller_than_previous_close() {
        let connection = fixture();
        let purpose = "Dividend Rs 100 per share";
        insert_simple_cash_dividend_import(
            &connection,
            1,
            "NSE_API",
            "PENDING",
            purpose,
            "2026-08-14",
            100.0,
        );
        insert_exact_dividend_official_evidence(&connection, 1, purpose, "2026-08-14");
        insert_dividend_previous_close(&connection, "2026-08-13", 100.0);
        assert!(matches!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1).unwrap(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) if reason.contains("previous-close basis")
        ));
    }

    #[test]
    fn dividend_policy_r1_returns_already_approved_without_policy_write() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET approved_corporate_action_id=77 WHERE id=1",
                [],
            )
            .unwrap();
        assert_eq!(
            evaluate_simple_cash_dividend_policy_r1(&connection, &dividend_policy_folder(), 1)
                .unwrap(),
            SimpleCashDividendPolicyEligibility::AlreadyApproved
        );
    }

    #[test]
    fn dividend_policy_r1_evaluator_is_read_only() {
        let connection = eligible_dividend_fixture();
        let before_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| {
                row.get(0)
            })
            .unwrap();
        let before_decisions: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let before_status: (String, Option<i64>) = connection.query_row(
            "SELECT review_status,approved_corporate_action_id FROM corporate_action_imports WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();

        let _ = expect_dividend_eligible(&connection);

        let after_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| {
                row.get(0)
            })
            .unwrap();
        let after_decisions: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let after_status: (String, Option<i64>) = connection.query_row(
            "SELECT review_status,approved_corporate_action_id FROM corporate_action_imports WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();
        assert_eq!(after_actions, before_actions);
        assert_eq!(after_decisions, before_decisions);
        assert_eq!(after_status, before_status);
    }

    #[test]
    fn dividend_prepared_scope_r1_returns_eligible_with_full_policy_evidence() {
        let connection = eligible_dividend_fixture();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1]),
        )
        .unwrap();
        assert_eq!(result.requested, 1);
        assert_eq!(result.eligible, 1);
        assert_eq!(result.ineligible, 0);
        assert_eq!(result.failed, 0);
        assert!(result.complete);
        assert_eq!(result.policy_version, SIMPLE_CASH_DIVIDEND_POLICY_VERSION);
        assert_eq!(result.dispositions[0].disposition, "ELIGIBLE");
        let evidence = result.dispositions[0].evidence.as_ref().unwrap();
        assert_eq!(evidence.cash_amount, 5.0);
        assert_eq!(evidence.previous_trade_date, "2026-08-13");
        assert_eq!(evidence.previous_close, 100.0);
        assert!(evidence.computed_factor > 1.0);
    }

    #[test]
    fn dividend_prepared_scope_r1_preserves_policy_ineligible_reason() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
                [],
            )
            .unwrap();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1]),
        )
        .unwrap();
        assert_eq!(result.ineligible, 1);
        assert_eq!(result.dispositions[0].disposition, "INELIGIBLE");
        assert!(result.dispositions[0].reason.contains("source NSE_API"));
    }

    #[test]
    fn dividend_prepared_scope_r1_returns_already_approved_without_write() {
        let connection = eligible_dividend_fixture();
        connection
            .execute(
                "UPDATE corporate_action_imports SET review_status='APPROVED', approved_corporate_action_id=77 WHERE id=1",
                [],
            )
            .unwrap();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1]),
        )
        .unwrap();
        assert_eq!(result.already_approved, 1);
        assert_eq!(result.dispositions[0].disposition, "ALREADY_APPROVED");
    }

    #[test]
    fn dividend_prepared_scope_r1_marks_changed_action_or_status_stale() {
        for (action_type, parse_status, review_status) in [
            ("SPLIT", "PARSED", "PENDING"),
            ("DIVIDEND", "UNSUPPORTED", "PENDING"),
            ("DIVIDEND", "PARSED", "UNRESOLVED"),
        ] {
            let connection = eligible_dividend_fixture();
            connection
                .execute(
                    "UPDATE corporate_action_imports SET action_type=?, parse_status=?, review_status=? WHERE id=1",
                    params![action_type, parse_status, review_status],
                )
                .unwrap();
            let folder = prepared_scope_folder();
            let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
                &connection,
                &folder,
                &prepared_scope_input(&folder, vec![1]),
            )
            .unwrap();
            assert_eq!(
                result.stale_scope, 1,
                "{action_type}/{parse_status}/{review_status}"
            );
            assert_eq!(result.dispositions[0].disposition, "STALE_SCOPE");
        }
    }

    #[test]
    fn dividend_prepared_scope_r1_marks_missing_id_without_aborting_batch() {
        let connection = eligible_dividend_fixture();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1, 2]),
        )
        .unwrap();
        assert_eq!(result.requested, 2);
        assert_eq!(result.eligible, 1);
        assert_eq!(result.missing, 1);
        assert_eq!(result.dispositions[0].import_id, 1);
        assert_eq!(result.dispositions[1].import_id, 2);
        assert_eq!(result.dispositions[1].disposition, "MISSING");
    }

    #[test]
    fn dividend_prepared_scope_r1_rejects_empty_duplicate_invalid_and_over_100_ids() {
        let connection = fixture();
        let folder = prepared_scope_folder();
        for ids in [
            vec![],
            vec![1, 1],
            vec![0],
            (1_i64..=101_i64).collect::<Vec<_>>(),
        ] {
            assert!(evaluate_simple_cash_dividend_prepared_scope_in_connection(
                &connection,
                &folder,
                &prepared_scope_input(&folder, ids),
            )
            .is_err());
        }
    }

    #[test]
    fn dividend_prepared_scope_r1_rejects_database_context_change() {
        let connection = eligible_dividend_fixture();
        let folder = prepared_scope_folder();
        let other = std::env::temp_dir().join(format!(
            "eod-dividend-prepared-scope-r1-other-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&other).unwrap();
        let input = SimpleCashDividendPreparedScopeInput {
            import_ids: vec![1],
            expected_database_path: other.canonicalize().unwrap().to_string_lossy().to_string(),
        };
        assert!(evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &input,
        )
        .unwrap_err()
        .contains("active database changed"));
    }

    #[test]
    fn dividend_prepared_scope_r1_records_unexpected_evaluator_error_as_failed() {
        let connection = eligible_dividend_fixture();
        connection.execute("DROP TABLE instruments", []).unwrap();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1]),
        )
        .unwrap();
        assert_eq!(result.failed, 1);
        assert!(!result.complete);
        assert_eq!(result.dispositions[0].disposition, "FAILED");
        assert!(result.dispositions[0].reason.contains("instruments"));
    }

    #[test]
    fn dividend_prepared_scope_r1_fingerprint_is_order_independent_and_frontend_compatible() {
        let folder = prepared_scope_folder();
        let path = folder.to_string_lossy().to_string();
        let ids = vec![9, 2, 7];
        let left = simple_cash_dividend_prepared_scope_fingerprint(&path, &ids);
        let right = simple_cash_dividend_prepared_scope_fingerprint(
            path.replace('\\', "/").to_uppercase().as_str(),
            &[2, 7, 9],
        );
        assert_eq!(left, right);
        assert_eq!(left.len(), 64);
        assert!(left
            .chars()
            .all(|value| value.is_ascii_hexdigit() && !value.is_ascii_lowercase()));
    }

    #[test]
    fn dividend_prepared_scope_r1_sorts_output_dispositions_by_import_id() {
        let connection = fixture();
        insert_simple_cash_dividend_import(
            &connection,
            3,
            "NSE_CSV",
            "PENDING",
            "Interim Dividend - Rs. 5 per share",
            "2026-08-14",
            5.0,
        );
        insert_simple_cash_dividend_import(
            &connection,
            1,
            "NSE_CSV",
            "PENDING",
            "Interim Dividend - Rs. 5 per share",
            "2026-08-14",
            5.0,
        );
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![3, 1]),
        )
        .unwrap();
        assert_eq!(
            result
                .dispositions
                .iter()
                .map(|item| item.import_id)
                .collect::<Vec<_>>(),
            vec![1, 3]
        );
        assert_eq!(result.ineligible, 2);
    }

    #[test]
    fn dividend_prepared_scope_r1_batch_is_read_only() {
        let connection = eligible_dividend_fixture();
        let before_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| {
                row.get(0)
            })
            .unwrap();
        let before_decisions: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let before_import: (String, Option<i64>) = connection
            .query_row(
                "SELECT review_status,approved_corporate_action_id FROM corporate_action_imports WHERE id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let folder = prepared_scope_folder();
        let result = evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &prepared_scope_input(&folder, vec![1]),
        )
        .unwrap();
        assert_eq!(result.eligible, 1);
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            before_actions
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM corporate_action_import_decisions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            before_decisions
        );
        assert_eq!(
            connection.query_row(
                "SELECT review_status,approved_corporate_action_id FROM corporate_action_imports WHERE id=1",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)),
            ).unwrap(),
            before_import
        );
    }
}
