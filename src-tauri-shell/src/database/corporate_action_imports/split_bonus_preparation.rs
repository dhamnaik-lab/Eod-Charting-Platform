//! Expand explicit ordinary Split + Bonus terms into pending components only.
use super::*;

pub(super) fn components(purpose: &str) -> Option<Vec<ParsedAction>> {
    let canonical = canonical_purpose(purpose);
    let purpose = canonical.as_str();
    if split_bonus_terms::blocker(purpose).is_some() {
        return None;
    }
    let families = detected_corporate_action_families(&normalize_text(purpose));
    if families.len() != 2
        || !families.iter().any(|s| s == "SPLIT")
        || !families.iter().any(|s| s == "BONUS")
    {
        return None;
    }
    let segments = split_compound_action_segments(purpose);
    if segments.len() != 2 {
        return None;
    }
    let parsed = segments
        .iter()
        .map(|s| parse_corporate_action_purpose(s))
        .collect::<Vec<_>>();
    if parsed.iter().any(|p| {
        p.parse_status != "PARSED" || !p.factor.map(|f| f.is_finite() && f > 1.0).unwrap_or(false)
    }) || parsed.iter().filter(|p| p.action_type == "SPLIT").count() != 1
        || parsed.iter().filter(|p| p.action_type == "BONUS").count() != 1
    {
        return None;
    }
    Some(parsed)
}

fn matching_component(
    c: &Connection,
    row: &CorporateActionImportRow,
    p: &ParsedAction,
) -> AppResult<Option<i64>> {
    c.query_row(
        "SELECT id FROM corporate_action_imports WHERE exchange=? AND symbol IS ? AND isin IS ?
        AND ex_date IS ? AND record_date IS ? AND action_type=? AND parse_status='PARSED'
        AND ratio_num IS ? AND ratio_den IS ? AND old_face_value IS ? AND new_face_value IS ?
        AND factor IS ? AND price_factor IS ? ORDER BY id LIMIT 1",
        params![
            row.exchange,
            row.symbol,
            row.isin,
            row.ex_date,
            row.record_date,
            p.action_type,
            p.ratio_num,
            p.ratio_den,
            p.old_face_value,
            p.new_face_value,
            p.factor,
            p.price_factor
        ],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub(super) fn prepare_companion(
    c: &Connection,
    row: &CorporateActionImportRow,
    parts: &[ParsedAction],
) -> AppResult<()> {
    // Keep raw purpose and original source capture intact on both pending rows.
    // Never bootstrap identity evidence from a newly derived component.
    if row.evidence_count == 0 || !matches!(row.action_type.as_str(), "SPLIT" | "BONUS") {
        return Err("Combined Split/Bonus preparation requires retained source evidence and a primary component.".to_string());
    }
    for p in parts.iter().filter(|p| p.action_type != row.action_type) {
        if matching_component(c, row, p)?.is_some() {
            continue;
        }
        let key = format!("CA_COMPONENT_V1:{}:{}", row.id, p.action_type);
        let exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM corporate_action_imports WHERE dedupe_key=?)",
                [&key],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists {
            return Err(
                "A prepared component changed; automatic replacement is blocked.".to_string(),
            );
        }
        c.execute("INSERT INTO corporate_action_imports (dedupe_key,exchange,source,source_file,symbol,isin,
            bse_scrip_code,company_name,purpose_raw,ex_date,record_date,action_type,ratio_num,ratio_den,
            old_face_value,new_face_value,factor,price_factor,parse_status,review_status,message)
            SELECT ?,exchange,source,source_file,symbol,isin,bse_scrip_code,company_name,purpose_raw,
            ex_date,record_date,?,?,?,?,?,?,?,'PARSED',review_status,? FROM corporate_action_imports WHERE id=?",
            params![key,p.action_type,p.ratio_num,p.ratio_den,p.old_face_value,p.new_face_value,p.factor,p.price_factor,
                format!("Prepared pending {} component from official import #{}; explicit approval and fresh checks required.",p.action_type,row.id),row.id]
        ).map_err(|e| e.to_string())?;
        let id = c.last_insert_rowid();
        c.execute("INSERT INTO corporate_action_import_evidence (import_id,source_code,source_locator,captured_at,
            symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,factor_seen,raw_reference,note)
            SELECT ?,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,
            action_type_seen,event_date_seen,factor_seen,raw_reference,note FROM corporate_action_import_evidence WHERE import_id=?",
            params![id,row.id]).map_err(|e| e.to_string())?;
        let companion = get_import_row(c, id)?;
        record_corporate_action_import_decision(c,row,&companion,"COMPOUND_COMPONENT_PREPARED",
            &format!("Pending component of source import #{}; original source capture retained; no approval or adjustment.",row.id))?;
    }
    Ok(())
}

pub(super) fn ensure_components_prepared(
    c: &Connection,
    row: &CorporateActionImportRow,
) -> AppResult<()> {
    if !matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
        || detected_corporate_action_families(&normalize_text(&row.purpose_raw)).len() < 2
    {
        return Ok(());
    }
    let parts = components(&row.purpose_raw).ok_or_else(|| {
        "Combined action terms require verified component preparation.".to_string()
    })?;
    for p in &parts {
        if matching_component(c, row, p)?.is_none() {
            return Err(
                "Combined Split/Bonus components are incomplete. Load & Validate before approval."
                    .to_string(),
            );
        }
    }
    Ok(())
}
