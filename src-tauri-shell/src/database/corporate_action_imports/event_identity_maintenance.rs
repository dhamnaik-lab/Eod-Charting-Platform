use crate::database::AppResult;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use super::event_identity_authority::{
    compute_v114e_resolution_fingerprint, load_v114e_event_identity_authority, V114ECandidate,
    V114E_CANDIDATE_SET_FINGERPRINT, V114E_DESIGN_AUTHORITY_FINGERPRINT,
    V114E_RESOLUTION_AUTHORITY, V114E_RESOLUTION_TYPE, V114E_V114D1_EVIDENCE_SHA256,
};
use super::event_identity_resolution::{
    create_event_identity_resolution_schema_for_controlled_apply,
    event_identity_resolution_table_exists, insert_v114e_resolution_strict,
    load_effective_event_identity, V114EResolutionInsertOutcome,
};

const V114E_APPLY_PLAN_FINGERPRINT_VERSION: &str = "ca-v114e-apply-plan-v1";
const V114E_COMMITTED_REPORT_FAILURE_EXIT: i32 = 44;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MaintenanceMode {
    Preflight,
    Apply,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct V114EDatabaseFamilyHashes {
    main_sha256: String,
    wal_sha256: String,
    shm_sha256: String,
}

#[derive(Clone, Debug)]
struct MaintenanceInput {
    mode: MaintenanceMode,
    database_file: PathBuf,
    output_path: PathBuf,
    live_database_family_hashes: V114EDatabaseFamilyHashes,
    preflight_manifest_path: Option<PathBuf>,
    backup_manifest_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CandidatePlanRow {
    import_id: i64,
    exchange: String,
    raw_symbol: String,
    raw_isin: Option<String>,
    event_date: String,
    action_type: String,
    event_symbol: String,
    event_isin: Option<String>,
    chain_id: String,
    transition_date: String,
    transition_history_row_id: i64,
    raw_identity_source_line_number: i64,
    resolution_fingerprint: String,
    outcome: String,
    workflow_evaluation: String,
    blocking_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolutionPlanCsvRow {
    import_id: i64,
    event_symbol: String,
    transition_date: String,
    outcome: String,
    workflow_evaluation: String,
    resolution_fingerprint: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreflightManifest {
    schema_version: u32,
    version: String,
    status: String,
    mutation_authorization: String,
    database_family_hashes: V114EDatabaseFamilyHashes,
    design_authority_fingerprint: String,
    candidate_set_fingerprint: String,
    apply_plan_fingerprint_version: String,
    apply_plan_fingerprint: String,
    authorized_count: usize,
    ready_insert_count: usize,
    already_satisfied_count: usize,
    blocked_count: usize,
    candidates: Vec<CandidatePlanRow>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    verified: bool,
    source_database_family: V114EDatabaseFamilyHashes,
    backup_directory: String,
    created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyResult {
    result: String,
    transaction_committed: bool,
    schema_created: bool,
    authorized_import_count: usize,
    resolution_rows_inserted: usize,
    resolution_rows_already_satisfied: usize,
    blocked: usize,
    import_rows_updated: usize,
    decision_rows_inserted: usize,
    corporate_action_writes: usize,
    quick_resolves: usize,
    approvals: usize,
    candidate_set_fingerprint: String,
    apply_plan_fingerprint: String,
}

#[derive(Clone, Debug)]
struct CurrentImportState {
    exchange: String,
    symbol: Option<String>,
    isin: Option<String>,
    ex_date: Option<String>,
    action_type: String,
    approved_corporate_action_id: Option<i64>,
    review_status: String,
    company_name: Option<String>,
    message: Option<String>,
}

fn canonical_sha256(value: &Value) -> AppResult<String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn sidecar_path(database_file: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", database_file.to_string_lossy(), suffix))
}

fn require_database_family_matches(
    database_file: &Path,
    expected: &V114EDatabaseFamilyHashes,
) -> AppResult<()> {
    if !database_file.is_file() {
        return Err(format!(
            "V1.14E database file missing: {}",
            database_file.display()
        ));
    }
    let main = sha256_file(database_file)?;
    if main != expected.main_sha256 {
        return Err(format!(
            "V1.14E main database hash drift: expected {}, actual {}.",
            expected.main_sha256, main
        ));
    }

    let wal_path = sidecar_path(database_file, "-wal");
    let wal = if wal_path.is_file() {
        sha256_file(&wal_path)?
    } else {
        String::new()
    };
    if wal != expected.wal_sha256 {
        return Err(format!(
            "V1.14E WAL hash drift: expected '{}', actual '{}'.",
            expected.wal_sha256, wal
        ));
    }
    Ok(())
}

fn resolution_fingerprint(candidate: &V114ECandidate) -> AppResult<String> {
    compute_v114e_resolution_fingerprint(candidate)
}

fn load_current_import_state(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<CurrentImportState>> {
    connection
        .query_row(
            "
              SELECT exchange,
                     symbol,
                     isin,
                     ex_date,
                     action_type,
                     approved_corporate_action_id,
                     review_status,
                     company_name,
                     message
              FROM corporate_action_imports
              WHERE id = ?
            ",
            params![import_id],
            |row| {
                Ok(CurrentImportState {
                    exchange: row.get(0)?,
                    symbol: row.get(1)?,
                    isin: row.get(2)?,
                    ex_date: row.get(3)?,
                    action_type: row.get(4)?,
                    approved_corporate_action_id: row.get(5)?,
                    review_status: row.get(6)?,
                    company_name: row.get(7)?,
                    message: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn analyze_candidate(
    connection: &Connection,
    candidate: &V114ECandidate,
) -> AppResult<CandidatePlanRow> {
    let fingerprint = resolution_fingerprint(candidate)?;
    let mut row = CandidatePlanRow {
        import_id: candidate.import_id,
        exchange: candidate.exchange.clone(),
        raw_symbol: candidate.raw_symbol.clone(),
        raw_isin: candidate.raw_isin.clone(),
        event_date: candidate.event_date.clone(),
        action_type: candidate.action_type.clone(),
        event_symbol: candidate.event_symbol.clone(),
        event_isin: candidate.event_isin.clone(),
        chain_id: candidate.chain_id.clone(),
        transition_date: candidate.transition_date.clone(),
        transition_history_row_id: candidate.transition_history_row_id,
        raw_identity_source_line_number: candidate.raw_identity_source_line_number,
        resolution_fingerprint: fingerprint.clone(),
        outcome: "BLOCKED".to_string(),
        workflow_evaluation: "BLOCKED".to_string(),
        blocking_reason: None,
    };

    let Some(current) = load_current_import_state(connection, candidate.import_id)? else {
        row.blocking_reason = Some("IMPORT_NOT_FOUND".to_string());
        return Ok(row);
    };

    if current.exchange != candidate.exchange
        || current.symbol.as_deref() != Some(candidate.raw_symbol.as_str())
        || current.isin != candidate.raw_isin
        || current.ex_date.as_deref() != Some(candidate.event_date.as_str())
        || current.action_type != candidate.action_type
    {
        row.blocking_reason = Some("RAW_IMPORT_AUTHORITY_DRIFT".to_string());
        return Ok(row);
    }
    if current.approved_corporate_action_id.is_some() {
        row.blocking_reason = Some("IMPORT_ALREADY_APPROVED".to_string());
        return Ok(row);
    }
    if current.review_status != "UNRESOLVED" {
        row.blocking_reason = Some(format!("REVIEW_STATUS_DRIFT:{}", current.review_status));
        return Ok(row);
    }
    if candidate.event_date.as_str() >= candidate.transition_date.as_str() {
        row.blocking_reason = Some("EVENT_NOT_STRICTLY_BEFORE_TRANSITION".to_string());
        return Ok(row);
    }

    if event_identity_resolution_table_exists(connection)? {
        let identity = load_effective_event_identity(connection, candidate.import_id)?;
        if identity.resolved {
            if identity.event_symbol.as_deref() == Some(candidate.event_symbol.as_str())
                && identity.event_isin == candidate.event_isin
                && identity.resolution_type.as_deref() == Some(V114E_RESOLUTION_TYPE)
                && identity.resolution_authority.as_deref() == Some(V114E_RESOLUTION_AUTHORITY)
                && identity.chain_id.as_deref() == Some(candidate.chain_id.as_str())
                && identity.transition_old_symbol.as_deref()
                    == Some(candidate.event_symbol.as_str())
                && identity.transition_new_symbol.as_deref() == Some(candidate.raw_symbol.as_str())
                && identity.transition_effective_date.as_deref()
                    == Some(candidate.transition_date.as_str())
                && identity.raw_identity_source_ref.as_deref()
                    == Some(candidate.raw_identity_source_ref.as_str())
                && identity.raw_identity_source_sha256.as_deref()
                    == Some(candidate.raw_identity_source_sha256.as_str())
                && identity.raw_identity_source_line_number
                    == Some(candidate.raw_identity_source_line_number)
                && identity.resolution_fingerprint.as_deref() == Some(fingerprint.as_str())
            {
                row.outcome = "READY_ALREADY_SATISFIED".to_string();
                row.workflow_evaluation = "EVENT_SYMBOL_RESOLVED_ISIN_REVIEW_REMAINS".to_string();
                return Ok(row);
            }
            row.blocking_reason = Some("CONFLICTING_PRIOR_RESOLUTION".to_string());
            return Ok(row);
        }
    }

    row.outcome = "READY_INSERT".to_string();
    row.workflow_evaluation = "EVENT_SYMBOL_RESOLVED_ISIN_REVIEW_REMAINS".to_string();
    Ok(row)
}

fn analyze_all_authorized(connection: &Connection) -> AppResult<Vec<CandidatePlanRow>> {
    let authority = load_v114e_event_identity_authority()?;
    let mut rows = Vec::with_capacity(authority.candidates.len());
    for candidate in &authority.candidates {
        rows.push(analyze_candidate(connection, candidate)?);
    }
    rows.sort_by_key(|row| row.import_id);
    Ok(rows)
}

fn compute_apply_plan_fingerprint(
    database_family_hashes: &V114EDatabaseFamilyHashes,
    rows: &[CandidatePlanRow],
) -> AppResult<String> {
    let ordered = rows
        .iter()
        .map(|row| {
            json!({
                "importId": row.import_id,
                "outcome": row.outcome,
                "resolutionFingerprint": row.resolution_fingerprint
            })
        })
        .collect::<Vec<_>>();
    canonical_sha256(&json!({
        "applyPlanFingerprintVersion": V114E_APPLY_PLAN_FINGERPRINT_VERSION,
        "candidateSetFingerprint": V114E_CANDIDATE_SET_FINGERPRINT,
        "databaseFamily": database_family_hashes,
        "designAuthorityFingerprint": V114E_DESIGN_AUTHORITY_FINGERPRINT,
        "orderedCandidates": ordered
    }))
}

fn build_preflight_manifest(
    connection: &Connection,
    database_family_hashes: V114EDatabaseFamilyHashes,
) -> AppResult<PreflightManifest> {
    let rows = analyze_all_authorized(connection)?;
    let ready_insert_count = rows
        .iter()
        .filter(|row| row.outcome == "READY_INSERT")
        .count();
    let already_satisfied_count = rows
        .iter()
        .filter(|row| row.outcome == "READY_ALREADY_SATISFIED")
        .count();
    let blocked_count = rows.iter().filter(|row| row.outcome == "BLOCKED").count();
    let status = if rows.len() == 184
        && ready_insert_count + already_satisfied_count == 184
        && blocked_count == 0
    {
        "READY"
    } else {
        "NOT_READY"
    }
    .to_string();
    let apply_plan_fingerprint = compute_apply_plan_fingerprint(&database_family_hashes, &rows)?;

    Ok(PreflightManifest {
        schema_version: 1,
        version: "V1.14E".to_string(),
        status,
        mutation_authorization: "NONE".to_string(),
        database_family_hashes,
        design_authority_fingerprint: V114E_DESIGN_AUTHORITY_FINGERPRINT.to_string(),
        candidate_set_fingerprint: V114E_CANDIDATE_SET_FINGERPRINT.to_string(),
        apply_plan_fingerprint_version: V114E_APPLY_PLAN_FINGERPRINT_VERSION.to_string(),
        apply_plan_fingerprint,
        authorized_count: rows.len(),
        ready_insert_count,
        already_satisfied_count,
        blocked_count,
        candidates: rows,
    })
}

fn validate_preflight_manifest(manifest: &PreflightManifest) -> AppResult<()> {
    if manifest.schema_version != 1
        || manifest.version != "V1.14E"
        || manifest.status != "READY"
        || manifest.mutation_authorization != "NONE"
        || manifest.design_authority_fingerprint != V114E_DESIGN_AUTHORITY_FINGERPRINT
        || manifest.candidate_set_fingerprint != V114E_CANDIDATE_SET_FINGERPRINT
        || manifest.apply_plan_fingerprint_version != V114E_APPLY_PLAN_FINGERPRINT_VERSION
        || manifest.authorized_count != 184
        || manifest.ready_insert_count + manifest.already_satisfied_count != 184
        || manifest.blocked_count != 0
        || manifest.candidates.len() != 184
    {
        return Err("V1.14E Preflight manifest is not an exact READY authority.".to_string());
    }
    let expected =
        compute_apply_plan_fingerprint(&manifest.database_family_hashes, &manifest.candidates)?;
    if expected != manifest.apply_plan_fingerprint {
        return Err("V1.14E Preflight apply-plan fingerprint mismatch.".to_string());
    }
    Ok(())
}

fn raw_import_fingerprint(connection: &Connection) -> AppResult<String> {
    let authority = load_v114e_event_identity_authority()?;
    let mut values = Vec::with_capacity(authority.candidates.len());
    for candidate in &authority.candidates {
        let current = load_current_import_state(connection, candidate.import_id)?
            .ok_or_else(|| format!("V1.14E import {} disappeared.", candidate.import_id))?;
        values.push(json!({
            "approvedCorporateActionId": current.approved_corporate_action_id,
            "companyName": current.company_name,
            "exchange": current.exchange,
            "exDate": current.ex_date,
            "importId": candidate.import_id,
            "isin": current.isin,
            "message": current.message,
            "reviewStatus": current.review_status,
            "symbol": current.symbol
        }));
    }
    canonical_sha256(&Value::Array(values))
}

fn apply_internal(
    connection: &mut Connection,
    manifest: &PreflightManifest,
) -> AppResult<ApplyResult> {
    validate_preflight_manifest(manifest)?;

    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let current_rows = analyze_all_authorized(&transaction)?;
    let current_plan =
        compute_apply_plan_fingerprint(&manifest.database_family_hashes, &current_rows)?;
    if current_plan != manifest.apply_plan_fingerprint {
        return Err(
            "V1.14E state changed after Preflight; transaction aborted before schema/write."
                .to_string(),
        );
    }

    let raw_before = raw_import_fingerprint(&transaction)?;
    let schema_existed_before = event_identity_resolution_table_exists(&transaction)?;
    create_event_identity_resolution_schema_for_controlled_apply(&transaction)?;

    let authority = load_v114e_event_identity_authority()?;
    let fingerprints = manifest
        .candidates
        .iter()
        .map(|row| (row.import_id, row.resolution_fingerprint.clone()))
        .collect::<BTreeMap<_, _>>();

    let mut inserted = 0usize;
    let mut already_satisfied = 0usize;
    for candidate in &authority.candidates {
        let fingerprint = fingerprints.get(&candidate.import_id).ok_or_else(|| {
            format!(
                "V1.14E Preflight manifest is missing import {}.",
                candidate.import_id
            )
        })?;
        match insert_v114e_resolution_strict(
            &transaction,
            candidate,
            fingerprint,
            V114E_V114D1_EVIDENCE_SHA256,
        )? {
            V114EResolutionInsertOutcome::Inserted => inserted += 1,
            V114EResolutionInsertOutcome::AlreadySatisfied => already_satisfied += 1,
        }
    }

    let raw_after = raw_import_fingerprint(&transaction)?;
    if raw_before != raw_after {
        return Err(
            "V1.14E raw Corporate Action import state changed inside transaction.".to_string(),
        );
    }

    if inserted + already_satisfied != 184 {
        return Err("V1.14E transaction did not reconcile all 184 authorized rows.".to_string());
    }

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(ApplyResult {
        result: "COMMITTED_PENDING_POST_AUDIT".to_string(),
        transaction_committed: true,
        schema_created: !schema_existed_before,
        authorized_import_count: 184,
        resolution_rows_inserted: inserted,
        resolution_rows_already_satisfied: already_satisfied,
        blocked: 0,
        import_rows_updated: 0,
        decision_rows_inserted: 0,
        corporate_action_writes: 0,
        quick_resolves: 0,
        approvals: 0,
        candidate_set_fingerprint: V114E_CANDIDATE_SET_FINGERPRINT.to_string(),
        apply_plan_fingerprint: manifest.apply_plan_fingerprint.clone(),
    })
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

fn write_preflight_outputs(output: &Path, manifest: &PreflightManifest) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    write_json(&output.join("v1-14e-ready-manifest.json"), manifest)?;
    write_json(
        &output.join("v1-14e-preflight-summary.json"),
        &json!({
            "status": manifest.status,
            "authorizedCount": manifest.authorized_count,
            "readyInsertCount": manifest.ready_insert_count,
            "alreadySatisfiedCount": manifest.already_satisfied_count,
            "blockedCount": manifest.blocked_count,
            "candidateSetFingerprint": manifest.candidate_set_fingerprint,
            "applyPlanFingerprint": manifest.apply_plan_fingerprint,
            "mutationAuthorization": "NONE",
            "databaseWrites": 0,
            "resolutionWrites": 0,
            "quickResolves": 0,
            "approvals": 0
        }),
    )?;
    write_json(
        &output.join("v1-14e-db-family-before.json"),
        &manifest.database_family_hashes,
    )?;

    let mut candidate_writer = csv::Writer::from_path(output.join("v1-14e-candidates.csv"))
        .map_err(|error| error.to_string())?;
    let mut plan_writer = csv::Writer::from_path(output.join("v1-14e-resolution-plan.csv"))
        .map_err(|error| error.to_string())?;
    for row in &manifest.candidates {
        candidate_writer
            .serialize(row)
            .map_err(|error| error.to_string())?;
        plan_writer
            .serialize(ResolutionPlanCsvRow {
                import_id: row.import_id,
                event_symbol: row.event_symbol.clone(),
                transition_date: row.transition_date.clone(),
                outcome: row.outcome.clone(),
                workflow_evaluation: row.workflow_evaluation.clone(),
                resolution_fingerprint: row.resolution_fingerprint.clone(),
            })
            .map_err(|error| error.to_string())?;
    }
    candidate_writer
        .flush()
        .map_err(|error| error.to_string())?;
    plan_writer.flush().map_err(|error| error.to_string())?;
    Ok(())
}

fn write_apply_outputs(
    output: &Path,
    result: &ApplyResult,
    backup: &BackupManifest,
) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    write_json(&output.join("v1-14e-apply-result.json"), result)?;
    write_json(&output.join("v1-14e-backup-manifest-used.json"), backup)?;
    Ok(())
}

fn parse_required_arg(values: &HashMap<String, String>, name: &str) -> AppResult<String> {
    values
        .get(name)
        .cloned()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Missing required V1.14E maintenance argument {name}."))
}

fn parse_maintenance_args(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<MaintenanceInput>> {
    let args = args.into_iter().collect::<Vec<_>>();
    if !args
        .iter()
        .any(|arg| arg == "--maintenance-corporate-action-v114e")
    {
        return Ok(None);
    }

    let mut values = HashMap::<String, String>::new();
    let mut index = 0usize;
    while index < args.len() {
        let key = args[index].as_str();
        if matches!(
            key,
            "--mode"
                | "--database-file"
                | "--output"
                | "--live-main-sha256"
                | "--live-wal-sha256"
                | "--live-shm-sha256"
                | "--preflight-manifest"
                | "--backup-manifest"
        ) {
            let value = args
                .get(index + 1)
                .ok_or_else(|| format!("Missing value for {key}."))?;
            values.insert(key.to_string(), value.clone());
            index += 2;
        } else {
            index += 1;
        }
    }

    let mode = match parse_required_arg(&values, "--mode")?
        .to_lowercase()
        .as_str()
    {
        "preflight" => MaintenanceMode::Preflight,
        "apply" => MaintenanceMode::Apply,
        other => return Err(format!("Invalid V1.14E maintenance mode: {other}")),
    };

    let main_sha256 = parse_required_arg(&values, "--live-main-sha256")?.to_lowercase();
    let wal_sha256 = values
        .get("--live-wal-sha256")
        .cloned()
        .unwrap_or_default()
        .to_lowercase();
    let shm_sha256 = values
        .get("--live-shm-sha256")
        .cloned()
        .unwrap_or_default()
        .to_lowercase();
    if !is_sha256_hex(&main_sha256)
        || (!wal_sha256.is_empty() && !is_sha256_hex(&wal_sha256))
        || (!shm_sha256.is_empty() && !is_sha256_hex(&shm_sha256))
    {
        return Err("V1.14E SHA-256 arguments must be 64 hex characters when present.".to_string());
    }

    let preflight_manifest_path = values.get("--preflight-manifest").map(PathBuf::from);
    let backup_manifest_path = values.get("--backup-manifest").map(PathBuf::from);
    if mode == MaintenanceMode::Apply
        && (preflight_manifest_path.is_none() || backup_manifest_path.is_none())
    {
        return Err(
            "V1.14E Apply requires --preflight-manifest and --backup-manifest.".to_string(),
        );
    }

    Ok(Some(MaintenanceInput {
        mode,
        database_file: PathBuf::from(parse_required_arg(&values, "--database-file")?),
        output_path: PathBuf::from(parse_required_arg(&values, "--output")?),
        live_database_family_hashes: V114EDatabaseFamilyHashes {
            main_sha256,
            wal_sha256,
            shm_sha256,
        },
        preflight_manifest_path,
        backup_manifest_path,
    }))
}

fn run_maintenance(input: MaintenanceInput) -> AppResult<i32> {
    load_v114e_event_identity_authority()?;
    require_database_family_matches(&input.database_file, &input.live_database_family_hashes)?;
    fs::create_dir_all(&input.output_path).map_err(|error| error.to_string())?;

    match input.mode {
        MaintenanceMode::Preflight => {
            let connection = Connection::open_with_flags(
                &input.database_file,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(|error| error.to_string())?;
            connection
                .execute_batch("PRAGMA query_only=ON;")
                .map_err(|error| error.to_string())?;

            let manifest =
                build_preflight_manifest(&connection, input.live_database_family_hashes.clone())?;
            write_preflight_outputs(&input.output_path, &manifest)?;

            println!(
                "[PASS] V1.14E authorized candidates: {}",
                manifest.authorized_count
            );
            println!("[PASS] READY_INSERT: {}", manifest.ready_insert_count);
            println!(
                "[PASS] READY_ALREADY_SATISFIED: {}",
                manifest.already_satisfied_count
            );
            println!("[PASS] Blocking: {}", manifest.blocked_count);
            println!("[PASS] Database writes: 0");
            println!("[PASS] Resolution writes: 0");
            println!("[PASS] Quick Resolves: 0");
            println!("[PASS] Approvals: 0");
            println!("[PASS] Preflight status: {}", manifest.status);
            Ok(if manifest.status == "READY" { 0 } else { 3 })
        }
        MaintenanceMode::Apply => {
            let preflight_path = input
                .preflight_manifest_path
                .as_deref()
                .ok_or_else(|| "V1.14E Apply requires Preflight manifest.".to_string())?;
            let manifest: PreflightManifest = serde_json::from_slice(
                &fs::read(preflight_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("Invalid V1.14E Preflight manifest: {error}"))?;
            validate_preflight_manifest(&manifest)?;
            if manifest.database_family_hashes != input.live_database_family_hashes {
                return Err(
                    "V1.14E live database-family hashes differ from Preflight manifest."
                        .to_string(),
                );
            }

            let backup_path = input
                .backup_manifest_path
                .as_deref()
                .ok_or_else(|| "V1.14E Apply requires backup manifest.".to_string())?;
            let backup: BackupManifest =
                serde_json::from_slice(&fs::read(backup_path).map_err(|error| error.to_string())?)
                    .map_err(|error| format!("Invalid V1.14E backup manifest: {error}"))?;
            if !backup.verified || backup.source_database_family != manifest.database_family_hashes
            {
                return Err(
                    "V1.14E verified backup does not match the Preflight database family."
                        .to_string(),
                );
            }
            if backup.backup_directory.trim().is_empty() || backup.created_at.trim().is_empty() {
                return Err("V1.14E backup manifest is incomplete.".to_string());
            }

            require_database_family_matches(
                &input.database_file,
                &manifest.database_family_hashes,
            )?;
            let mut connection =
                Connection::open(&input.database_file).map_err(|error| error.to_string())?;
            connection
                .execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
                .map_err(|error| error.to_string())?;
            let result = apply_internal(&mut connection, &manifest)?;
            drop(connection);

            if let Err(error) = write_apply_outputs(&input.output_path, &result, &backup) {
                eprintln!("COMMITTED_REPORT_FAILURE");
                eprintln!("V1.14E transaction committed; report writing failed. Do not restore automatically.");
                eprintln!("Report error: {error}");
                return Ok(V114E_COMMITTED_REPORT_FAILURE_EXIT);
            }

            println!("[PASS] V1.14E transaction committed.");
            println!("[PASS] Result: COMMITTED_PENDING_POST_AUDIT");
            println!(
                "[PASS] Resolution rows inserted: {}",
                result.resolution_rows_inserted
            );
            println!(
                "[PASS] Resolution rows already satisfied: {}",
                result.resolution_rows_already_satisfied
            );
            println!("[PASS] Import row updates: 0");
            println!("[PASS] Decision rows inserted: 0");
            println!("[PASS] Corporate Action writes: 0");
            println!("[PASS] Quick Resolves: 0");
            println!("[PASS] Approvals: 0");
            Ok(0)
        }
    }
}

pub(crate) fn try_run_event_identity_resolution_maintenance(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<i32>> {
    let Some(input) = parse_maintenance_args(args)? else {
        return Ok(None);
    };
    run_maintenance(input).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_authority_import_fixture(connection: &Connection) {
        connection
            .execute_batch(
                "
                  PRAGMA foreign_keys = ON;
                  CREATE TABLE corporate_action_imports (
                    id INTEGER PRIMARY KEY,
                    exchange TEXT NOT NULL,
                    symbol TEXT,
                    isin TEXT,
                    ex_date TEXT,
                    action_type TEXT NOT NULL,
                    approved_corporate_action_id INTEGER,
                    review_status TEXT NOT NULL,
                    company_name TEXT,
                    message TEXT
                  );
                ",
            )
            .unwrap();

        let authority = load_v114e_event_identity_authority().unwrap();
        for candidate in &authority.candidates {
            connection
                .execute(
                    "
                      INSERT INTO corporate_action_imports (
                        id, exchange, symbol, isin, ex_date, action_type,
                        approved_corporate_action_id, review_status, company_name, message
                      )
                      VALUES (?, ?, ?, ?, ?, ?, NULL, 'UNRESOLVED', ?, 'fixture')
                    ",
                    params![
                        candidate.import_id,
                        candidate.exchange,
                        candidate.raw_symbol,
                        candidate.raw_isin,
                        candidate.event_date,
                        candidate.action_type,
                        candidate.raw_identity_security_name,
                    ],
                )
                .unwrap();
        }
    }

    fn sqlite_total_changes(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT total_changes()", [], |row| row.get(0))
            .unwrap()
    }

    fn fixture_family() -> V114EDatabaseFamilyHashes {
        V114EDatabaseFamilyHashes {
            main_sha256: "a".repeat(64),
            wal_sha256: String::new(),
            shm_sha256: String::new(),
        }
    }

    #[test]
    fn v114e_preflight_exact_authority_is_ready_without_writes() {
        let connection = Connection::open_in_memory().unwrap();
        create_authority_import_fixture(&connection);
        let before = sqlite_total_changes(&connection);

        let manifest = build_preflight_manifest(&connection, fixture_family()).unwrap();

        assert_eq!(manifest.status, "READY");
        assert_eq!(manifest.authorized_count, 184);
        assert_eq!(manifest.ready_insert_count, 184);
        assert_eq!(manifest.already_satisfied_count, 0);
        assert_eq!(manifest.blocked_count, 0);
        assert_eq!(sqlite_total_changes(&connection), before);
    }

    #[test]
    fn v114e_preflight_blocks_raw_symbol_drift() {
        let connection = Connection::open_in_memory().unwrap();
        create_authority_import_fixture(&connection);
        let import_id = load_v114e_event_identity_authority().unwrap().candidates[0].import_id;
        connection
            .execute(
                "UPDATE corporate_action_imports SET symbol='DRIFTED' WHERE id=?",
                params![import_id],
            )
            .unwrap();

        let manifest = build_preflight_manifest(&connection, fixture_family()).unwrap();

        assert_eq!(manifest.status, "NOT_READY");
        assert_eq!(manifest.blocked_count, 1);
        assert_eq!(
            manifest
                .candidates
                .iter()
                .find(|row| row.import_id == import_id)
                .unwrap()
                .blocking_reason
                .as_deref(),
            Some("RAW_IMPORT_AUTHORITY_DRIFT")
        );
    }

    #[test]
    fn v114e_apply_inserts_exact_184_resolution_rows_without_import_updates() {
        let mut connection = Connection::open_in_memory().unwrap();
        create_authority_import_fixture(&connection);
        let manifest = build_preflight_manifest(&connection, fixture_family()).unwrap();
        let raw_before = raw_import_fingerprint(&connection).unwrap();

        let result = apply_internal(&mut connection, &manifest).unwrap();

        assert_eq!(result.result, "COMMITTED_PENDING_POST_AUDIT");
        assert!(result.transaction_committed);
        assert!(result.schema_created);
        assert_eq!(result.resolution_rows_inserted, 184);
        assert_eq!(result.resolution_rows_already_satisfied, 0);
        assert_eq!(result.import_rows_updated, 0);
        assert_eq!(result.decision_rows_inserted, 0);
        assert_eq!(result.quick_resolves, 0);
        assert_eq!(result.approvals, 0);
        assert_eq!(raw_import_fingerprint(&connection).unwrap(), raw_before);

        let rows: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_event_identity_resolutions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(rows, 184);
    }

    #[test]
    fn v114e_apply_is_idempotent_only_after_a_fresh_ready_preflight() {
        let mut connection = Connection::open_in_memory().unwrap();
        create_authority_import_fixture(&connection);

        let first_manifest = build_preflight_manifest(&connection, fixture_family()).unwrap();
        let first = apply_internal(&mut connection, &first_manifest).unwrap();
        assert_eq!(first.resolution_rows_inserted, 184);

        let second_manifest = build_preflight_manifest(&connection, fixture_family()).unwrap();
        assert_eq!(second_manifest.ready_insert_count, 0);
        assert_eq!(second_manifest.already_satisfied_count, 184);
        assert_eq!(second_manifest.blocked_count, 0);

        let second = apply_internal(&mut connection, &second_manifest).unwrap();
        assert_eq!(second.resolution_rows_inserted, 0);
        assert_eq!(second.resolution_rows_already_satisfied, 184);
    }

    #[test]
    fn v114e_maintenance_args_absent_flag_preserves_normal_startup() {
        assert!(parse_maintenance_args(["app".to_string()])
            .unwrap()
            .is_none());
    }

    #[test]
    fn v114e_maintenance_args_require_apply_manifests() {
        let error = parse_maintenance_args([
            "app".to_string(),
            "--maintenance-corporate-action-v114e".to_string(),
            "--mode".to_string(),
            "apply".to_string(),
            "--database-file".to_string(),
            "fixture.sqlite3".to_string(),
            "--output".to_string(),
            "out".to_string(),
            "--live-main-sha256".to_string(),
            "a".repeat(64),
        ])
        .unwrap_err();
        assert!(error.contains("--preflight-manifest"));
    }

    #[test]
    fn v114e_resolution_fingerprint_is_deterministic_and_date_sensitive() {
        let authority = load_v114e_event_identity_authority().unwrap();
        let row = authority.candidates.first().unwrap().clone();
        let first = resolution_fingerprint(&row).unwrap();
        assert_eq!(first, resolution_fingerprint(&row).unwrap());

        let mut changed = row;
        changed.transition_date = "2099-01-01".to_string();
        assert_ne!(first, resolution_fingerprint(&changed).unwrap());
    }
}
