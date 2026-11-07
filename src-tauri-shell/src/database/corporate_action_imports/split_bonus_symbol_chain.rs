//! A single official rename is metadata, never financial approval. Raw imports
//! remain immutable; a separate, revalidated proof names the adjustment owner.
use super::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(super) const DECISION: &str = "VERIFIED_SPLIT_BONUS_SYMBOL_CHAIN_R1";
const VERSION: &str = "SPLIT_BONUS_SYMBOL_CHAIN_R1";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(in crate::database) struct Proof {
    pub(in crate::database) target: String,
    identity: Value,
    scan: Value,
    event: Value,
    price_window: Value,
    database: String,
    previous_date: String,
    previous_close: f64,
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn has_table(c: &Connection, table: &str) -> AppResult<bool> {
    c.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
        [table],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

/// No scan or stored decision is trusted here. Only exact official identity and
/// event evidence may select an alias; it must still pass financial validation.
fn official_event_witness(
    c: &Connection,
    row: &CorporateActionImportRow,
    raw: &str,
) -> AppResult<Option<(i64, String, String, String)>> {
    if let Some(witness) = dated_symbol_chain::price_witness(c, row, raw)? {
        return Ok(Some(witness));
    }
    // A derived component keeps its original capture, including its original
    // action label. Prove the exact component from that whole captured purpose;
    // never edit the capture or borrow unrelated issuer evidence.
    let Some(parts) = split_bonus_preparation::components(&row.purpose_raw) else {
        return Ok(None);
    };
    if !parts.iter().any(|p| {
        p.action_type == row.action_type
            && (
                p.factor,
                p.price_factor,
                p.ratio_num,
                p.ratio_den,
                p.old_face_value,
                p.new_face_value,
            ) == (
                row.factor,
                row.price_factor,
                row.ratio_num,
                row.ratio_den,
                row.old_face_value,
                row.new_face_value,
            )
    }) {
        return Ok(None);
    }
    if split_bonus_preparation::ensure_components_prepared(c, row).is_err() {
        return Ok(None);
    }
    let Some(other) = parts.iter().find(|p| p.action_type != row.action_type) else {
        return Ok(None);
    };
    dated_symbol_chain::price_witness_for_action(c, row, raw, &other.action_type)
}

fn identity(c: &Connection, row: &CorporateActionImportRow) -> AppResult<Option<(String, Value)>> {
    if row.exchange != "NSE"
        || row.instrument_is_active == Some(true)
        || row.source != "NSE_API"
        || row.parse_status != "PARSED"
        || !matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
        || !matches!(
            row.review_status.as_str(),
            "UNRESOLVED" | "PENDING_ISIN_MISMATCH" | "PENDING"
        )
        || row.approved_corporate_action_id.is_some()
        || row.cash_amount.is_some()
        || split_bonus_terms::blocker(&row.purpose_raw).is_some()
        || !has_table(c, "corporate_action_symbol_chain_sources")?
    {
        return Ok(None);
    }
    let (Some(raw), Some(isin), Some(date)) = (&row.symbol, &row.isin, &row.ex_date) else {
        return Ok(None);
    };
    if NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
        return Ok(None);
    }
    let source = c
        .query_row(
            "SELECT id,source_url,source_hash,raw_csv,captured_at,
        captured_at>=datetime('now','-1 day') AND captured_at<=datetime('now','+5 minutes')
        FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",
            [],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Vec<u8>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, bool>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((source_id, url, hash, bytes, captured, fresh)) = source else {
        return Ok(None);
    };
    let parsed = reqwest::Url::parse(&url).ok();
    if !fresh
        || bytes.len() > 2_000_000
        || digest(&bytes) != hash
        || super::super::official_source_urls::validate_nse_official_source_url(&url).is_err()
        || !parsed.is_some_and(|u| {
            u.scheme() == "https" && u.path() == "/content/equities/symbolchange.csv"
        })
        || super::super::official_source_urls::load_official_source_urls(Some(c))?
            .nse_symbol_change_url
            != url
    {
        return Ok(None);
    }
    let Ok(edges) = super::super::nse_identity_imports::parse_ca_symbol_change_source(&bytes)
    else {
        return Ok(None);
    };
    let outgoing: Vec<_> = edges.iter().filter(|e| e.0 == *raw).collect();
    if outgoing.len() != 1 {
        return Ok(None);
    }
    let edge = outgoing[0];
    let target = &edge.1;
    if target == raw
        || date >= &edge.2
        || edges
            .iter()
            .filter(|e| e.0 == *raw || e.1 == *raw || e.0 == *target || e.1 == *target)
            .count()
            != 1
    {
        return Ok(None);
    }
    let mut stmt=c.prepare("SELECT id,current_symbol,old_symbol,new_symbol,effective_date,source,isin,source_ref
        FROM instrument_identity_history WHERE exchange='NSE' AND change_type IN ('SYMBOL_CHANGE','BOTH')
        AND (old_symbol IN (?,?) OR new_symbol IN (?,?) OR current_symbol IN (?,?))").map_err(|e|e.to_string())?;
    let history = stmt
        .query_map(params![raw, target, raw, target, raw, target], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, Option<String>>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if history.len() != 1 {
        return Ok(None);
    }
    let h = &history[0];
    if h.1.as_deref() != Some(target)
        || h.2.as_deref() != Some(raw)
        || h.3.as_deref() != Some(target)
        || h.4 != edge.2
        || h.5.as_deref() != Some("NSE_IDENTITY")
    {
        return Ok(None);
    }
    let mut members = Vec::new();
    for (symbol, active) in [(raw, 0_i64), (target, 1_i64)] {
        let mut stmt = c
            .prepare("SELECT isin,is_active FROM instruments WHERE exchange='NSE' AND symbol=?")
            .map_err(|e| e.to_string())?;
        let values = stmt
            .query_map([symbol], |r| {
                Ok((r.get::<_, Option<String>>(0)?, r.get::<_, Option<i64>>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        if values.len() != 1 || values[0].1 != Some(active) {
            return Ok(None);
        }
        members.push(values[0].clone());
    }
    let Some(current) = members[1].0.as_deref() else {
        return Ok(None);
    };
    if h.6.as_deref().is_some_and(|isin| isin != current) {
        return Ok(None);
    }
    if members[0].0.as_deref() != Some(current)
        || isin.len() != 12
        || !isin.is_ascii()
        || !isin
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
        || !current
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
        || !isin.starts_with("IN")
        || &isin[7..9] != "01"
    {
        return Ok(None);
    }
    if isin != current
        && (!split_isin_price_proof::same_equity_issuer(isin, current)
            || !split_isin_price_proof::event_includes_equity_split(row))
    {
        return Ok(None);
    }
    let unrelated: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM (
        SELECT symbol,exchange FROM instruments WHERE upper(isin) IN (?,?)
        UNION SELECT symbol,exchange FROM instrument_isin_history WHERE upper(isin) IN (?,?))
        WHERE exchange<>'NSE' OR symbol NOT IN (?,?))",
            params![isin, current, isin, current, raw, target],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if unrelated {
        return Ok(None);
    }
    let Some(witness) = official_event_witness(c, row, raw)? else {
        return Ok(None);
    };
    let Some(context) = super::super::eod_data::resolve_instrument_context(c, target, "NSE")?
    else {
        return Ok(None);
    };
    if context.current_symbol != *target
        || context.isin.as_deref() != Some(current)
        || context
            .related_symbols
            .iter()
            .any(|s| s != raw && s != target)
        || context.symbol_transitions.len() != 1
        || context.symbol_transitions[0].old_symbol.as_deref() != Some(raw)
        || context.symbol_transitions[0].new_symbol.as_deref() != Some(target)
        || context.symbol_transitions[0].effective_date != edge.2
    {
        return Ok(None);
    }
    Ok(Some((
        target.clone(),
        serde_json::json!({"version":VERSION,"source":[source_id,url,hash,captured],
        "edge":edge,"history":h,"members":members,"witness":witness}),
    )))
}

/// Event precedes the sole rename, so both bars must belong to the old alias.
/// Never substitute a current-alias file or SQL underneath an existing binary.
pub(super) fn has_identity_route(
    c: &Connection,
    row: &CorporateActionImportRow,
) -> AppResult<bool> {
    Ok(identity(c, row)?.is_some())
}

pub(super) fn trade_window(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
) -> AppResult<Option<(ScannedBar, ScannedBar)>> {
    let Some((_, meta)) = identity(c, row)? else {
        return Ok(None);
    };
    let raw = row.symbol.as_deref().unwrap();
    let date = row.ex_date.as_deref().unwrap();
    let window = if folder
        .join("eod_data")
        .join("NSE")
        .join(format!("{raw}.eod"))
        .exists()
    {
        let file = BinaryEodFile::open(folder.join("eod_data/NSE").join(format!("{raw}.eod")))?;
        if file.header.symbol != raw || file.header.exchange != "NSE" {
            return Ok(None);
        }
        load_binary_trade_window(folder, raw, "NSE", date)?
    } else if get_price_storage_mode(c) == PriceStorageMode::Hybrid {
        load_sqlite_trade_window(c, raw, "NSE", date)?
    } else {
        None
    };
    let Some((previous, ex)) = window else {
        return Ok(None);
    };
    let rename = meta["edge"][2].as_str().unwrap_or("");
    let today = chrono::Utc::now()
        .with_timezone(&chrono::FixedOffset::east_opt(19800).unwrap())
        .date_naive();
    if ensure_import_trade_window_ready(Some(&(previous.clone(), ex.clone())), date, today).is_err()
        || previous.date.as_str() >= rename
        || ex.date.as_str() >= rename
    {
        return Ok(None);
    }
    Ok(Some((previous, ex)))
}

fn selected_price_evidence(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
    previous: &ScannedBar,
    ex: &ScannedBar,
) -> AppResult<Option<Value>> {
    let symbol = row.symbol.as_deref().unwrap();
    let path = folder.join("eod_data/NSE").join(format!("{symbol}.eod"));
    if path.exists() {
        let file = BinaryEodFile::open(path)?;
        if file.header.symbol != symbol || file.header.exchange != "NSE" {
            return Ok(None);
        }
        let records = file.read_range(date_to_u32(&previous.date), date_to_u32(&ex.date))?;
        if records.len() != 2 {
            return Ok(None);
        }
        let values: Vec<_> = records
            .iter()
            .map(|r| {
                serde_json::json!([
                    r.date,
                    r.flags,
                    r.open,
                    r.high,
                    r.low,
                    r.close,
                    r.prev_close,
                    r.volume,
                    r.oi
                ])
            })
            .collect();
        return Ok(Some(
            serde_json::json!({"storage":"EOD1","symbol":symbol,"scale":file.header.price_scale,"records":values}),
        ));
    }
    if get_price_storage_mode(c) != PriceStorageMode::Hybrid {
        return Ok(None);
    }
    let mut stmt = c
        .prepare(
            "SELECT date,open,high,low,close,prev_close,volume,open_interest FROM eod_prices
        WHERE symbol=? AND exchange='NSE' AND date IN (?,?) ORDER BY date",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![symbol, previous.date, ex.date], |r| {
            Ok(serde_json::json!([
                r.get::<_, String>(0)?,
                r.get::<_, Option<f64>>(1)?,
                r.get::<_, Option<f64>>(2)?,
                r.get::<_, Option<f64>>(3)?,
                r.get::<_, Option<f64>>(4)?,
                r.get::<_, Option<f64>>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, Option<i64>>(7)?
            ]))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(if rows.len() == 2 {
        Some(serde_json::json!({"storage":"SQL","symbol":symbol,"records":rows}))
    } else {
        None
    })
}

fn evaluate(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
) -> AppResult<Option<Proof>> {
    let Some((target, identity)) = identity(c, row)? else {
        return Ok(None);
    };
    if ensure_split_bonus_price_validation(c, row, false).is_err()
        || split_bonus_preparation::ensure_components_prepared(c, row).is_err()
    {
        return Ok(None);
    }
    let Some(scan) = load_latest_official_split_bonus_validation(c, row.id)? else {
        return Ok(None);
    };
    if scan.symbol != row.symbol || scan.exchange != row.exchange {
        return Ok(None);
    }
    let Some((previous, ex)) = trade_window(c, folder, row)? else {
        return Ok(None);
    };
    if scan.prev_trade_date.as_deref() != Some(previous.date.as_str())
        || scan.ex_trade_date.as_deref() != Some(ex.date.as_str())
        || scan.prev_close.map(f64::to_bits) != Some(previous.close.to_bits())
        || scan.ex_open.map(f64::to_bits) != Some(ex.open.to_bits())
        || scan.ex_close.map(f64::to_bits) != Some(ex.close.to_bits())
    {
        return Ok(None);
    }
    let Some(price_window) = selected_price_evidence(c, folder, row, &previous, &ex)? else {
        return Ok(None);
    };
    let database: String = c
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(Some(Proof {
        target,
        identity,
        price_window,
        scan: serde_json::to_value(scan).map_err(|e| e.to_string())?,
        event: serde_json::json!({"id":row.id,"symbol":row.symbol,"isin":row.isin,"source":row.source,
            "sourceFile":row.source_file,"purpose":row.purpose_raw,"date":row.ex_date,"recordDate":row.record_date,
            "action":row.action_type,"factor":row.factor,"priceFactor":row.price_factor,"ratio":[row.ratio_num,row.ratio_den],
            "face":[row.old_face_value,row.new_face_value],"cash":row.cash_amount}),
        database: database.replace('/', "\\"),
        previous_date: previous.date,
        previous_close: previous.close,
    }))
}

impl Proof {
    pub(in crate::database) fn fingerprint(&self) -> AppResult<String> {
        Ok(digest(
            &serde_json::to_vec(self).map_err(|e| e.to_string())?,
        ))
    }
    pub(in crate::database) fn previous(&self) -> (&str, f64) {
        (&self.previous_date, self.previous_close)
    }
}

pub(in crate::database) fn verified(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
) -> AppResult<Option<Proof>> {
    if !has_table(c, "corporate_action_split_bonus_chain_proofs")? {
        return Ok(None);
    }
    let stored=c.query_row("SELECT proof_json,fingerprint FROM corporate_action_split_bonus_chain_proofs WHERE import_id=?",
        [row.id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).optional().map_err(|e|e.to_string())?;
    let Some((json, hash)) = stored else {
        return Ok(None);
    };
    let Ok(proof) = serde_json::from_str::<Proof>(&json) else {
        return Ok(None);
    };
    let Some(current) = evaluate(c, folder, row)? else {
        return Ok(None);
    };
    Ok(if proof == current && current.fingerprint()? == hash {
        Some(current)
    } else {
        None
    })
}

pub(super) fn has_decision(c: &Connection, id: i64) -> AppResult<bool> {
    c.query_row("SELECT EXISTS(SELECT 1 FROM corporate_action_import_decisions WHERE import_id=? AND decision_type=?)",
        params![id,DECISION],|r|r.get(0)).map_err(|e|e.to_string())
}

pub(super) fn approval_permit(
    c: &Connection,
    ids: &[i64],
) -> AppResult<Option<crate::database::price_store_operation_lock::PriceStoreOperationPermit>> {
    for id in ids {
        if has_decision(c, *id)? {
            return try_acquire_price_store_operation(
                PriceStoreOperationKind::CorporateActionAutomatic,
            )
            .map(Some);
        }
    }
    Ok(None)
}

pub(super) fn ensure_permit(c: &Connection, ids: &[i64], held: bool) -> AppResult<()> {
    if !held {
        for id in ids {
            if has_decision(c, *id)? {
                return Err("The verified rename route changed before approval acquired its price-store permit. Retry explicit approval.".into());
            }
        }
    }
    Ok(())
}

pub(super) fn prepare(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
) -> AppResult<()> {
    let Some(proof) = evaluate(c, folder, row)? else {
        if has_decision(c, row.id)? {
            identity_recheck::recheck_pending_machine_identity(c, row)?;
        }
        return Ok(());
    };
    let fingerprint = proof.fingerprint()?;
    if row.review_status == "PENDING" && verified(c, folder, row)?.is_some() {
        return Ok(());
    }
    c.execute_batch("SAVEPOINT ca_a1_prepare")
        .map_err(|e| e.to_string())?;
    let result = (|| {
        c.execute("INSERT INTO corporate_action_split_bonus_chain_proofs(import_id,proof_json,fingerprint) VALUES(?,?,?)
        ON CONFLICT(import_id) DO UPDATE SET proof_json=excluded.proof_json,fingerprint=excluded.fingerprint",
        params![row.id,serde_json::to_string(&proof).map_err(|e|e.to_string())?,fingerprint]).map_err(|e|e.to_string())?;
        c.execute("UPDATE corporate_action_imports SET review_status='PENDING',message=? WHERE id=? AND approved_corporate_action_id IS NULL",
        params![format!("Verified historical event; adjustment owner NSE:{}; approval remains explicit.",proof.target),row.id]).map_err(|e|e.to_string())?;
        let after = get_import_row(c, row.id)?;
        record_corporate_action_import_decision(
            c,
            row,
            &after,
            DECISION,
            &format!(
                "raw=NSE:{}; owner=NSE:{}; proof={fingerprint}",
                row.symbol.as_deref().unwrap_or(""),
                proof.target
            ),
        )
    })();
    match result {
        Ok(()) => c
            .execute_batch("RELEASE ca_a1_prepare")
            .map_err(|e| e.to_string()),
        Err(error) => {
            let _ = c.execute_batch("ROLLBACK TO ca_a1_prepare; RELEASE ca_a1_prepare");
            Err(error)
        }
    }
}

/// Route-scoped duplicate lookup: neither an issuer prefix nor a bare ISIN can
/// link a financial record belonging to an unrelated symbol.
pub(super) fn existing(
    c: &Connection,
    row: &CorporateActionImportRow,
    proof: &Proof,
) -> AppResult<Option<i64>> {
    let mut stmt=c.prepare("SELECT id,factor,ratio_num,ratio_den,old_face_value,new_face_value,cash_amount,isin
        FROM corporate_actions WHERE exchange=? AND effective_date=? AND action_type=? AND symbol IN (?,?)").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map(
            params![
                row.exchange,
                row.ex_date,
                row.action_type,
                row.symbol,
                proof.target
            ],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, f64>(1)?,
                    r.get::<_, Option<f64>>(2)?,
                    r.get::<_, Option<f64>>(3)?,
                    r.get::<_, Option<f64>>(4)?,
                    r.get::<_, Option<f64>>(5)?,
                    r.get::<_, Option<f64>>(6)?,
                    r.get::<_, Option<String>>(7)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if rows.is_empty() {
        return Ok(None);
    }
    if rows.len() != 1 {
        return Err("Ambiguous existing adjustment for the verified rename route.".into());
    }
    let r = &rows[0];
    if row.factor != Some(r.1)
        || (
            row.ratio_num,
            row.ratio_den,
            row.old_face_value,
            row.new_face_value,
            row.cash_amount,
            row.isin.as_deref(),
        ) != (r.2, r.3, r.4, r.5, r.6, r.7.as_deref())
    {
        return Err("Existing adjustment terms conflict with the verified rename route.".into());
    }
    Ok(Some(r.0))
}

#[cfg(test)]
mod tests;
