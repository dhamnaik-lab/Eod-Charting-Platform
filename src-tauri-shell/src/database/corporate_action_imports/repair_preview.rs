use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;

use super::super::{
    AppResult, CorporateActionRepairCanonicalValues, CorporateActionRepairEvidenceRecord,
    CorporateActionRepairImportValues, CorporateActionRepairPreviewInput,
    CorporateActionRepairPreviewResult, CorporateActionRepairPreviewRow,
    CorporateActionRepairProposalRow, CorporateActionRepairSourceIdentity,
};
use super::{
    detected_corporate_action_families, normalize_text, parse_compound_action_components,
    parse_corporate_action_purpose,
};

pub(super) const CORPORATE_ACTION_REPAIR_PREVIEW_MAX_IDS: usize = 500;
const CORPORATE_ACTION_REPAIR_FINGERPRINT_VERSION: &str =
    "corporate-action-repair-preview-v1-fnv1a64";

pub(super) fn preview_corporate_action_repairs_internal(
    connection: &Connection,
    input: &CorporateActionRepairPreviewInput,
) -> AppResult<CorporateActionRepairPreviewResult> {
    let requested = input.import_ids.len();
    let import_ids = validate_repair_preview_import_ids(&input.import_ids)?;
    let query_only = connection
        .query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))
        .map_err(|error| error.to_string())?;
    if query_only != 1 {
        return Err("Corporate action repair preview requires PRAGMA query_only=ON.".to_string());
    }

    let mut rows = Vec::with_capacity(import_ids.len());
    let mut missing_import_ids = Vec::new();
    for import_id in import_ids.iter().copied() {
        let Some((source_identity, current_import)) =
            load_repair_preview_import(connection, import_id)?
        else {
            missing_import_ids.push(import_id);
            continue;
        };

        let current_canonical = current_import
            .approved_corporate_action_id
            .map(|canonical_id| load_repair_preview_canonical(connection, canonical_id))
            .transpose()?
            .flatten();
        let current_same_date_canonical_actions = if let Some(canonical) = &current_canonical {
            list_same_date_repair_preview_canonicals(connection, canonical)?
        } else {
            Vec::new()
        };
        let evidence = list_repair_preview_evidence(connection, import_id)?;
        let evidence_grade = grade_repair_preview_evidence(&source_identity, &evidence);
        let row_fingerprint = stable_repair_preview_fingerprint(
            &source_identity,
            &current_import,
            current_canonical.as_ref(),
            &current_same_date_canonical_actions,
            &evidence,
        )?;

        rows.push(build_repair_preview_row(
            row_fingerprint,
            evidence_grade,
            source_identity,
            current_import,
            current_canonical,
            current_same_date_canonical_actions,
            evidence,
        ));
    }

    let previewable = rows.iter().filter(|row| row.previewable).count() as u32;
    let blocked = rows.iter().filter(|row| row.repair_blocked).count() as u32
        + missing_import_ids.len() as u32;
    Ok(CorporateActionRepairPreviewResult {
        requested: requested as u32,
        unique_requested: import_ids.len() as u32,
        missing_import_ids,
        previewable,
        blocked,
        database_query_only: true,
        fingerprint_version: CORPORATE_ACTION_REPAIR_FINGERPRINT_VERSION.to_string(),
        fingerprint_fields: repair_preview_fingerprint_fields(),
        rows,
        message: format!(
            "Read-only repair preview evaluated {} unique explicit import ID(s); {} row(s) produced proposals and {} row(s)/ID(s) remain blocked. No repair was applied.",
            import_ids.len(), previewable, blocked
        ),
    })
}

pub(super) fn validate_repair_preview_import_ids(import_ids: &[i64]) -> AppResult<Vec<i64>> {
    if import_ids.is_empty() {
        return Err("Select at least one corporate action import ID to preview.".to_string());
    }
    if import_ids.len() > CORPORATE_ACTION_REPAIR_PREVIEW_MAX_IDS {
        return Err(format!(
            "Repair preview accepts at most {CORPORATE_ACTION_REPAIR_PREVIEW_MAX_IDS} import IDs per request."
        ));
    }
    if import_ids.iter().any(|import_id| *import_id <= 0) {
        return Err("Repair preview import IDs must be positive integers.".to_string());
    }

    let mut seen = HashSet::with_capacity(import_ids.len());
    Ok(import_ids
        .iter()
        .copied()
        .filter(|import_id| seen.insert(*import_id))
        .collect())
}

pub(super) fn load_repair_preview_import(
    connection: &Connection,
    import_id: i64,
) -> AppResult<
    Option<(
        CorporateActionRepairSourceIdentity,
        CorporateActionRepairImportValues,
    )>,
> {
    connection
        .query_row(
            "
              SELECT id, dedupe_key, exchange, source, source_file, symbol, isin, bse_scrip_code,
                     company_name, purpose_raw, ex_date, record_date, action_type, ratio_num,
                     ratio_den, old_face_value, new_face_value, cash_amount, factor, price_factor,
                     parse_status, review_status, message, approved_corporate_action_id,
                     imported_at, approved_at
              FROM corporate_action_imports
              WHERE id = ?
            ",
            [import_id],
            |row| {
                Ok((
                    CorporateActionRepairSourceIdentity {
                        exchange: row.get(2)?,
                        source: row.get(3)?,
                        source_file: row.get(4)?,
                        symbol: row.get(5)?,
                        isin: row.get(6)?,
                        bse_scrip_code: row.get(7)?,
                        company_name: row.get(8)?,
                        ex_date: row.get(10)?,
                        record_date: row.get(11)?,
                    },
                    CorporateActionRepairImportValues {
                        import_id: row.get(0)?,
                        dedupe_key: row.get(1)?,
                        purpose_raw: row.get(9)?,
                        action_type: row.get(12)?,
                        ratio_num: row.get(13)?,
                        ratio_den: row.get(14)?,
                        old_face_value: row.get(15)?,
                        new_face_value: row.get(16)?,
                        cash_amount: row.get(17)?,
                        factor: row.get(18)?,
                        price_factor: row.get(19)?,
                        parse_status: row.get(20)?,
                        review_status: row.get(21)?,
                        message: row.get(22)?,
                        approved_corporate_action_id: row.get(23)?,
                        imported_at: row.get(24)?,
                        approved_at: row.get(25)?,
                    },
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

pub(super) fn load_repair_preview_canonical(
    connection: &Connection,
    canonical_id: i64,
) -> AppResult<Option<CorporateActionRepairCanonicalValues>> {
    connection
        .query_row(
            "
              SELECT id, symbol, exchange, isin, effective_date, record_date, action_type, factor,
                     ratio_num, ratio_den, old_face_value, new_face_value, cash_amount,
                     adjust_volume, note, source, source_ref, applied_at, created_at, updated_at
              FROM corporate_actions
              WHERE id = ?
            ",
            [canonical_id],
            map_repair_preview_canonical,
        )
        .optional()
        .map_err(|error| error.to_string())
}

pub(super) fn list_same_date_repair_preview_canonicals(
    connection: &Connection,
    linked: &CorporateActionRepairCanonicalValues,
) -> AppResult<Vec<CorporateActionRepairCanonicalValues>> {
    let mut statement = connection
        .prepare(
            "
              SELECT id, symbol, exchange, isin, effective_date, record_date, action_type, factor,
                     ratio_num, ratio_den, old_face_value, new_face_value, cash_amount,
                     adjust_volume, note, source, source_ref, applied_at, created_at, updated_at
              FROM corporate_actions
              WHERE exchange = ? AND symbol = ? AND effective_date = ?
              ORDER BY action_type, id
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                linked.exchange.as_str(),
                linked.symbol.as_str(),
                linked.effective_date.as_str()
            ],
            map_repair_preview_canonical,
        )
        .map_err(|error| error.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn map_repair_preview_canonical(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CorporateActionRepairCanonicalValues> {
    Ok(CorporateActionRepairCanonicalValues {
        id: row.get(0)?,
        symbol: row.get(1)?,
        exchange: row.get(2)?,
        isin: row.get(3)?,
        effective_date: row.get(4)?,
        record_date: row.get(5)?,
        action_type: row.get(6)?,
        factor: row.get(7)?,
        ratio_num: row.get(8)?,
        ratio_den: row.get(9)?,
        old_face_value: row.get(10)?,
        new_face_value: row.get(11)?,
        cash_amount: row.get(12)?,
        adjust_volume: row.get::<_, i64>(13)? != 0,
        note: row.get(14)?,
        source: row.get(15)?,
        source_ref: row.get(16)?,
        applied_at: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
    })
}

pub(super) fn list_repair_preview_evidence(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Vec<CorporateActionRepairEvidenceRecord>> {
    let mut statement = connection
        .prepare(
            "
              SELECT id, source_code, source_locator, captured_at, symbol_seen, isin_seen,
                     company_name_seen, action_type_seen, event_date_seen, factor_seen,
                     raw_reference, note
              FROM corporate_action_import_evidence
              WHERE import_id = ?
              ORDER BY captured_at, id
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([import_id], |row| {
            Ok(CorporateActionRepairEvidenceRecord {
                id: row.get(0)?,
                source_code: row.get(1)?,
                source_locator: row.get(2)?,
                captured_at: row.get(3)?,
                symbol_seen: row.get(4)?,
                isin_seen: row.get(5)?,
                company_name_seen: row.get(6)?,
                action_type_seen: row.get(7)?,
                event_date_seen: row.get(8)?,
                factor_seen: row.get(9)?,
                raw_reference: row.get(10)?,
                note: row.get(11)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

pub(super) fn grade_repair_preview_evidence(
    source_identity: &CorporateActionRepairSourceIdentity,
    evidence: &[CorporateActionRepairEvidenceRecord],
) -> String {
    if evidence.is_empty() {
        return "NONE".to_string();
    }
    if evidence.iter().any(|record| {
        let official_source = matches!(record.source_code.as_str(), "NSE_API" | "BSE_API");
        let has_raw_reference = record
            .raw_reference
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty());
        let event_date_matches =
            source_identity.ex_date.as_deref() == record.event_date_seen.as_deref();
        let identity_matches = source_identity
            .isin
            .as_deref()
            .zip(record.isin_seen.as_deref())
            .is_some_and(|(expected, actual)| expected.eq_ignore_ascii_case(actual))
            || source_identity
                .symbol
                .as_deref()
                .zip(record.symbol_seen.as_deref())
                .is_some_and(|(expected, actual)| expected.eq_ignore_ascii_case(actual));
        let is_legacy_backfill = record.note.as_deref().is_some_and(|note| {
            note.to_ascii_uppercase()
                .contains("BACKFILLED FROM AN EXISTING")
        });
        official_source
            && has_raw_reference
            && event_date_matches
            && identity_matches
            && !is_legacy_backfill
    }) {
        return "STRUCTURED_OFFICIAL".to_string();
    }
    if evidence.iter().any(|record| {
        record.note.as_deref().is_some_and(|note| {
            note.to_ascii_uppercase()
                .contains("BACKFILLED FROM AN EXISTING")
        })
    }) {
        return "LEGACY_BACKFILL".to_string();
    }
    if evidence.iter().any(|record| {
        record
            .raw_reference
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
    }) {
        "STRUCTURED_PARTIAL".to_string()
    } else {
        "METADATA_ONLY".to_string()
    }
}

pub(super) fn stable_repair_preview_fingerprint(
    source_identity: &CorporateActionRepairSourceIdentity,
    current_import: &CorporateActionRepairImportValues,
    current_canonical: Option<&CorporateActionRepairCanonicalValues>,
    current_same_date_canonical_actions: &[CorporateActionRepairCanonicalValues],
    evidence: &[CorporateActionRepairEvidenceRecord],
) -> AppResult<String> {
    let material = serde_json::to_vec(&serde_json::json!({
        "fingerprintVersion": CORPORATE_ACTION_REPAIR_FINGERPRINT_VERSION,
        "sourceIdentity": source_identity,
        "currentImport": current_import,
        "currentCanonical": current_canonical,
        "currentSameDateCanonicalActions": current_same_date_canonical_actions,
        "evidence": evidence,
    }))
    .map_err(|error| error.to_string())?;
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in material {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    Ok(format!(
        "{CORPORATE_ACTION_REPAIR_FINGERPRINT_VERSION}:{hash:016x}"
    ))
}

pub(super) fn repair_preview_fingerprint_fields() -> Vec<String> {
    [
        "sourceIdentity.*",
        "currentImport.*",
        "currentCanonical.*",
        "currentSameDateCanonicalActions[*].*",
        "evidence[*].*",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

fn build_repair_preview_row(
    row_fingerprint: String,
    evidence_grade: String,
    source_identity: CorporateActionRepairSourceIdentity,
    current_import: CorporateActionRepairImportValues,
    current_canonical: Option<CorporateActionRepairCanonicalValues>,
    current_same_date_canonical_actions: Vec<CorporateActionRepairCanonicalValues>,
    evidence: Vec<CorporateActionRepairEvidenceRecord>,
) -> CorporateActionRepairPreviewRow {
    let mut blocking_reasons = vec!["NO_REPAIR_APPLY_COMMAND_IN_PHASE_6E".to_string()];
    if current_import.review_status != "APPROVED" {
        blocking_reasons.push("IMPORT_IS_NOT_APPROVED".to_string());
    }
    if current_import.approved_corporate_action_id.is_none() {
        blocking_reasons.push("IMPORT_IS_NOT_LINKED_TO_A_CANONICAL_ACTION".to_string());
    } else if current_canonical.is_none() {
        blocking_reasons.push("LINKED_CANONICAL_ACTION_IS_MISSING".to_string());
    }
    match evidence_grade.as_str() {
        "STRUCTURED_OFFICIAL" => {}
        "LEGACY_BACKFILL" => {
            blocking_reasons.push("EVIDENCE_LEGACY_BACKFILL_REQUIRES_SOURCE_REFRESH".to_string())
        }
        "STRUCTURED_PARTIAL" => blocking_reasons
            .push("EVIDENCE_IS_PARTIAL_AND_REQUIRES_MANUAL_VERIFICATION".to_string()),
        "METADATA_ONLY" => blocking_reasons.push("EVIDENCE_HAS_METADATA_ONLY".to_string()),
        _ => blocking_reasons.push("EVIDENCE_IS_MISSING".to_string()),
    }

    let normalized = normalize_text(&current_import.purpose_raw);
    let detected_families = detected_corporate_action_families(&normalized);
    let is_compound = detected_families.len() > 1;
    let parsed_actions = if is_compound {
        blocking_reasons.push("COMPOUND_ACTION_REQUIRES_SEPARATE_REVIEW_ROWS".to_string());
        parse_compound_action_components(&current_import.purpose_raw, &detected_families)
    } else {
        let parsed = parse_corporate_action_purpose(&current_import.purpose_raw);
        if parsed.parse_status == "PARSED" {
            vec![parsed]
        } else {
            Vec::new()
        }
    };

    if parsed_actions.len() != detected_families.len().max(1) {
        blocking_reasons.push("PURPOSE_COULD_NOT_BE_PARSED_INTO_COMPLETE_PROPOSALS".to_string());
    }
    if parsed_actions.is_empty() {
        blocking_reasons.push("NO_AUTHORITATIVE_PROPOSAL_COULD_BE_RECOMPUTED".to_string());
    }
    blocking_reasons.sort();
    blocking_reasons.dedup();

    let row_confidence =
        repair_preview_confidence(&evidence_grade, is_compound, !parsed_actions.is_empty());
    let proposed_outcomes = parsed_actions
        .into_iter()
        .map(|parsed| {
            let existing = current_same_date_canonical_actions
                .iter()
                .find(|canonical| canonical.action_type == parsed.action_type);
            let disposition = if existing.is_some_and(|canonical| {
                Some(canonical.id) == current_import.approved_corporate_action_id
            }) {
                "UPDATE_LINKED_CANONICAL"
            } else if existing.is_some() {
                "REVIEW_EXISTING_SAME_DATE_CANONICAL"
            } else if is_compound {
                "CREATE_COMPANION_REVIEW_ROW"
            } else {
                "UPDATE_LINKED_CANONICAL"
            };
            let factor_derivation = match parsed.action_type.as_str() {
                "DIVIDEND" | "RIGHTS" => {
                    Some("RECOMPUTE_FROM_LOCAL_PREVIOUS_CLOSE_DURING_SEPARATE_REPAIR".to_string())
                }
                _ if parsed.factor.is_some() => Some("PARSED_FROM_LIVE_PURPOSE".to_string()),
                _ => None,
            };
            CorporateActionRepairProposalRow {
                action_type: parsed.action_type,
                disposition: disposition.to_string(),
                current_canonical_id: existing.map(|canonical| canonical.id),
                factor: parsed.factor,
                factor_derivation,
                ratio_num: parsed.ratio_num,
                ratio_den: parsed.ratio_den,
                old_face_value: parsed.old_face_value,
                new_face_value: parsed.new_face_value,
                cash_amount: parsed.cash_amount,
                confidence: row_confidence.clone(),
                manual_review_required: true,
                blocking_reasons: blocking_reasons.clone(),
                message: parsed.message,
            }
        })
        .collect::<Vec<_>>();

    let prerequisites_met = current_import.review_status == "APPROVED"
        && current_import.approved_corporate_action_id.is_some()
        && current_canonical.is_some();
    let previewable = prerequisites_met
        && !proposed_outcomes.is_empty()
        && (!is_compound || proposed_outcomes.len() == detected_families.len());
    CorporateActionRepairPreviewRow {
        import_id: current_import.import_id,
        row_fingerprint,
        evidence_grade,
        source_identity,
        current_import,
        current_canonical,
        current_same_date_canonical_actions,
        evidence,
        proposed_outcomes,
        confidence: row_confidence,
        manual_review_required: true,
        repair_blocked: !blocking_reasons.is_empty(),
        blocking_reasons,
        previewable,
    }
}

fn repair_preview_confidence(
    evidence_grade: &str,
    is_compound: bool,
    has_proposal: bool,
) -> String {
    if !has_proposal {
        return "INSUFFICIENT".to_string();
    }
    if evidence_grade == "STRUCTURED_OFFICIAL" && !is_compound {
        "HIGH".to_string()
    } else if evidence_grade == "NONE" || evidence_grade == "METADATA_ONLY" {
        "LOW".to_string()
    } else {
        "MODERATE".to_string()
    }
}
