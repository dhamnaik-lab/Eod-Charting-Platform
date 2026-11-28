use crate::database::AppResult;
use rusqlite::{Connection, OpenFlags, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::five_pair_consolidation::{
    execute_consolidation_transaction_with_behavior, expected_pre_state_lock, foreign_key_check,
    load_authority, load_manifest, post_state_fingerprint, quick_check, same_database_family,
    sha256_file, snapshot_database_family, verify_exact_live_family_before_open, LiveFamily,
    V114V_RELEVANT_STATE_FINGERPRINT, V114V_SCHEMA_FINGERPRINT,
};

const V114X_FLAG: &str = "--maintenance-corporate-action-v114x";
const V114X_MODE_APPLY: &str = "apply";
const V114X_LIVE_APPLY_ACK: &str = "V1.14X_LIVE_APPLY_AUTHORIZED";

const V114W_APPLY_PLAN_FINGERPRINT: &str =
    "B926042A76323C273C48BFD5A21C60D609F78091EC6B3111EE47DE788EC4CB96";
const V114W_EXPECTED_POST_STATE_FINGERPRINT: &str =
    "8953723E83FE67351C6463A9D856A4B28C230D7088C22C638A815B44E110967B";
const V114X_EXPECTED_PRE_STATE_FINGERPRINT: &str =
    "1094511FFFAA18AA338A1A45EBAB3D2D2641AA68A210069E7CF3FF412D929E7B";
const V114X_EXPECTED_SCHEMA_FINGERPRINT: &str =
    "C700F5B8622FFEA89569E6B5AF514A189229E3F338BE46056DC15CF8D6D173D7";
const V114W_APPLY_PLAN_MANIFEST_SHA256: &str =
    "3C34A0CD8BED10A50F8BF8BAB015A11F3CFF3BD6D4C0124059D112911B69A393";
const V114X_COMMITTED_REPORT_FAILURE_EXIT: i32 = 47;
const V114X_COMMITTED_POST_AUDIT_FAILURE_EXIT: i32 = 48;

#[derive(Clone, Debug)]
struct MaintenanceInput {
    database_file: PathBuf,
    output_path: PathBuf,
    authority_path: PathBuf,
    v114v_manifest_path: PathBuf,
    v114w_apply_plan_path: PathBuf,
    backup_manifest_path: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct BackupArtifact {
    path: String,
    length: u64,
    sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    version: String,
    verified: bool,
    source_database_family: LiveFamily,
    backup_directory: String,
    created_at: String,
    recovery_main: BackupArtifact,
    recovery_wal: BackupArtifact,
    forensic_shm: BackupArtifact,
    restore_policy: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct V114WApplyPlanManifest {
    format_version: String,
    version: String,
    status: String,
    v114u_plan_fingerprint: String,
    v114v_manifest_fingerprint: String,
    pre_state_relevant_fingerprint: String,
    schema_fingerprint: String,
    post_state_fingerprint: String,
    apply_plan_fingerprint: String,
    targets_deleted: usize,
    evidence_reparented: usize,
    evidence_rows_preserved: usize,
    owners_preserved: usize,
    protected_corporate_action_id: i64,
    protected_scan_ids: Vec<i64>,
    live_apply_authorized: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveApplyResult {
    version: String,
    result: String,
    mode: String,
    transaction_committed: bool,
    v114w_apply_plan_fingerprint: String,
    pre_state_relevant_fingerprint: String,
    schema_fingerprint: String,
    post_state_fingerprint: String,
    backup_manifest_sha256: String,
    backup_directory: String,
    live_database_path: String,
    live_family_before: LiveFamily,
    live_family_after: LiveFamily,
    targets_deleted: usize,
    evidence_reparented: usize,
    evidence_rows_preserved: usize,
    owners_preserved: usize,
    approved_corporate_action_10947_unchanged: bool,
    protected_scan_ids: Vec<i64>,
    protected_scans_unchanged: bool,
    quick_check: Vec<String>,
    foreign_key_violations: Vec<Value>,
    live_apply_authorized: bool,
}

fn load_v114w_apply_plan(path: &Path) -> AppResult<V114WApplyPlanManifest> {
    if sha256_file(path)? != V114W_APPLY_PLAN_MANIFEST_SHA256 {
        return Err("V1.14X V1.14W Apply-plan manifest SHA-256 mismatch.".to_string());
    }
    let plan: V114WApplyPlanManifest =
        serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Invalid V1.14W Apply-plan manifest JSON: {error}"))?;
    validate_v114w_apply_plan(&plan)?;
    Ok(plan)
}

fn validate_v114w_apply_plan(plan: &V114WApplyPlanManifest) -> AppResult<()> {
    if plan.format_version != "ca-v114w-five-pair-apply-plan-v1"
        || plan.version != "V1.14W"
        || plan.status != "PRIVATE_COPY_DRY_RUN_PASS_NO_LIVE_AUTHORIZATION"
        || plan.v114u_plan_fingerprint
            != "6D6F6B15FE86C7D31A333F8097D69E5AF970F0E7A3981E9930A59CB10DF53C95"
        || plan.v114v_manifest_fingerprint
            != "40297583AC3B77F4C36C4689A9B13A5F56897D76A5F30FFE5E4C2DC12A3CB218"
        || plan.pre_state_relevant_fingerprint != V114X_EXPECTED_PRE_STATE_FINGERPRINT
        || plan.schema_fingerprint != V114X_EXPECTED_SCHEMA_FINGERPRINT
        || plan.post_state_fingerprint != V114W_EXPECTED_POST_STATE_FINGERPRINT
        || plan.apply_plan_fingerprint != V114W_APPLY_PLAN_FINGERPRINT
        || plan.targets_deleted != 5
        || plan.evidence_reparented != 5
        || plan.evidence_rows_preserved != 10
        || plan.owners_preserved != 5
        || plan.protected_corporate_action_id != 10947
        || plan.protected_scan_ids != vec![1736, 4670, 5353]
        || plan.live_apply_authorized
    {
        return Err("V1.14X V1.14W Apply-plan contract drifted.".to_string());
    }
    Ok(())
}

fn load_backup_manifest(path: &Path) -> AppResult<BackupManifest> {
    serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Invalid V1.14X backup manifest JSON: {error}"))
}

fn verify_backup_artifact(
    artifact: &BackupArtifact,
    backup_directory: &Path,
    expected_length: u64,
    expected_sha256: &str,
    live_artifact: &Path,
    label: &str,
) -> AppResult<()> {
    let path = PathBuf::from(&artifact.path);
    if !path.is_file() {
        return Err(format!(
            "V1.14X {label} backup artifact missing: {}",
            path.display()
        ));
    }
    let canonical_backup_dir =
        fs::canonicalize(backup_directory).map_err(|error| error.to_string())?;
    let canonical_artifact = fs::canonicalize(&path).map_err(|error| error.to_string())?;
    if !canonical_artifact.starts_with(&canonical_backup_dir) {
        return Err(format!(
            "V1.14X {label} backup artifact is outside backup_directory."
        ));
    }
    if live_artifact.is_file() {
        let live_canonical = fs::canonicalize(live_artifact).map_err(|error| error.to_string())?;
        if canonical_artifact == live_canonical {
            return Err(format!(
                "V1.14X {label} backup artifact aliases the live database family."
            ));
        }
    }
    if artifact.length != expected_length
        || fs::metadata(&path)
            .map_err(|error| error.to_string())?
            .len()
            != expected_length
    {
        return Err(format!("V1.14X {label} backup length mismatch."));
    }
    if artifact.sha256 != expected_sha256 || sha256_file(&path)? != expected_sha256 {
        return Err(format!("V1.14X {label} backup SHA-256 mismatch."));
    }
    Ok(())
}

fn validate_backup_manifest(
    backup: &BackupManifest,
    expected_family: &LiveFamily,
    live_database: &Path,
) -> AppResult<()> {
    if backup.version != "V1.14X_PREWRITE_BACKUP_V1"
        || !backup.verified
        || backup.backup_directory.trim().is_empty()
        || backup.created_at.trim().is_empty()
        || backup.restore_policy != "RESTORE_MAIN_AND_WAL_ONLY_SHM_FORENSIC"
    {
        return Err("V1.14X verified backup manifest is incomplete.".to_string());
    }
    if !same_database_family(&backup.source_database_family, expected_family) {
        return Err(
            "V1.14X backup source_database_family differs from the live preflight family."
                .to_string(),
        );
    }

    let backup_directory = PathBuf::from(&backup.backup_directory);
    if !backup_directory.is_dir() {
        return Err("V1.14X backup_directory does not exist.".to_string());
    }

    verify_backup_artifact(
        &backup.recovery_main,
        &backup_directory,
        expected_family.main_length,
        &expected_family.main_sha256,
        live_database,
        "main",
    )?;
    let live_wal = PathBuf::from(format!("{}-wal", live_database.to_string_lossy()));
    verify_backup_artifact(
        &backup.recovery_wal,
        &backup_directory,
        expected_family.wal_length,
        &expected_family.wal_sha256,
        &live_wal,
        "WAL",
    )?;
    let live_shm = PathBuf::from(format!("{}-shm", live_database.to_string_lossy()));
    verify_backup_artifact(
        &backup.forensic_shm,
        &backup_directory,
        expected_family.shm_length,
        &expected_family.shm_sha256,
        &live_shm,
        "SHM",
    )?;

    Ok(())
}

fn parse_required_arg<'a>(values: &'a HashMap<String, String>, key: &str) -> AppResult<&'a str> {
    values
        .get(key)
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("V1.14X requires {key}."))
}

fn parse_maintenance_args(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<MaintenanceInput>> {
    let args = args.into_iter().collect::<Vec<_>>();
    if !args.iter().any(|arg| arg == V114X_FLAG) {
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
                | "--authority"
                | "--v114v-manifest"
                | "--v114w-apply-plan"
                | "--backup-manifest"
                | "--live-apply-ack"
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

    let mode = parse_required_arg(&values, "--mode")?;
    if mode != V114X_MODE_APPLY {
        return Err(format!(
            "Invalid V1.14X maintenance mode: {mode}. Only apply is available."
        ));
    }
    if parse_required_arg(&values, "--live-apply-ack")? != V114X_LIVE_APPLY_ACK {
        return Err("V1.14X requires the exact live Apply authorization token.".to_string());
    }

    Ok(Some(MaintenanceInput {
        database_file: PathBuf::from(parse_required_arg(&values, "--database-file")?),
        output_path: PathBuf::from(parse_required_arg(&values, "--output")?),
        authority_path: PathBuf::from(parse_required_arg(&values, "--authority")?),
        v114v_manifest_path: PathBuf::from(parse_required_arg(&values, "--v114v-manifest")?),
        v114w_apply_plan_path: PathBuf::from(parse_required_arg(&values, "--v114w-apply-plan")?),
        backup_manifest_path: PathBuf::from(parse_required_arg(&values, "--backup-manifest")?),
    }))
}

fn write_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    fs::write(
        path,
        serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn write_committed_failure_marker(output: &Path, status: &str, error: &str) {
    let _ = fs::create_dir_all(output);
    let _ = fs::write(
        output.join("v1-14x-committed-failure-marker.txt"),
        format!(
            "V1.14X CONTROLLED LIVE APPLY\nstatus={status}\ntransaction_committed=true\nerror={error}\nrestore_automatically=false\n"
        ),
    );
}

fn run_maintenance(input: MaintenanceInput) -> AppResult<i32> {
    fs::create_dir_all(&input.output_path).map_err(|error| error.to_string())?;

    let authority = load_authority(&input.authority_path)?;
    let v114v_manifest = load_manifest(&input.v114v_manifest_path)?;
    let _v114w_plan = load_v114w_apply_plan(&input.v114w_apply_plan_path)?;
    let live_family_before =
        verify_exact_live_family_before_open(&input.database_file, &v114v_manifest)?;

    let backup = load_backup_manifest(&input.backup_manifest_path)?;
    validate_backup_manifest(&backup, &live_family_before, &input.database_file)?;
    let backup_manifest_sha256 = sha256_file(&input.backup_manifest_path)?;

    let mut connection = Connection::open_with_flags(
        &input.database_file,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
        .map_err(|error| error.to_string())?;

    let lock = expected_pre_state_lock();
    if V114V_RELEVANT_STATE_FINGERPRINT != V114X_EXPECTED_PRE_STATE_FINGERPRINT
        || V114V_SCHEMA_FINGERPRINT != V114X_EXPECTED_SCHEMA_FINGERPRINT
    {
        return Err("V1.14X compiled pre-state/schema locks differ from V1.14W.".to_string());
    }

    let (post_state, apply_plan) = execute_consolidation_transaction_with_behavior(
        &mut connection,
        &authority,
        &lock,
        None,
        TransactionBehavior::Immediate,
        Some((
            V114W_EXPECTED_POST_STATE_FINGERPRINT,
            V114W_APPLY_PLAN_FINGERPRINT,
        )),
    )?;

    let post_commit_audit = (|| -> AppResult<(Vec<String>, Vec<Value>, String)> {
        let quick = quick_check(&connection)?;
        if quick != vec!["ok".to_string()] {
            return Err(format!("V1.14X post-commit quick_check failed: {quick:?}"));
        }
        let fk = foreign_key_check(&connection)?;
        if !fk.is_empty() {
            return Err("V1.14X post-commit foreign_key_check failed.".to_string());
        }
        let fingerprint = post_state_fingerprint(&connection, &authority)?;
        if fingerprint != V114W_EXPECTED_POST_STATE_FINGERPRINT
            || fingerprint != post_state
            || apply_plan != V114W_APPLY_PLAN_FINGERPRINT
        {
            return Err("V1.14X committed post-state fingerprint verification failed.".to_string());
        }
        Ok((quick, fk, fingerprint))
    })();

    let (quick, foreign_keys, committed_post_state) = match post_commit_audit {
        Ok(value) => value,
        Err(error) => {
            drop(connection);
            write_committed_failure_marker(
                &input.output_path,
                "COMMITTED_POST_AUDIT_FAILURE",
                &error,
            );
            eprintln!("COMMITTED_POST_AUDIT_FAILURE");
            eprintln!("V1.14X transaction committed; post-commit audit failed. Do not restore automatically.");
            eprintln!("Audit error: {error}");
            return Ok(V114X_COMMITTED_POST_AUDIT_FAILURE_EXIT);
        }
    };

    drop(connection);
    let live_family_after = match snapshot_database_family(&input.database_file) {
        Ok(value) => value,
        Err(error) => {
            write_committed_failure_marker(
                &input.output_path,
                "COMMITTED_FAMILY_SNAPSHOT_FAILURE",
                &error,
            );
            eprintln!("COMMITTED_FAMILY_SNAPSHOT_FAILURE");
            eprintln!("V1.14X transaction committed; post-commit database-family hashing failed. Do not restore automatically.");
            eprintln!("Family snapshot error: {error}");
            return Ok(V114X_COMMITTED_POST_AUDIT_FAILURE_EXIT);
        }
    };

    let result = LiveApplyResult {
        version: "V1.14X".to_string(),
        result: "COMMITTED_POST_AUDIT_PASS".to_string(),
        mode: "CONTROLLED_LIVE_APPLY".to_string(),
        transaction_committed: true,
        v114w_apply_plan_fingerprint: V114W_APPLY_PLAN_FINGERPRINT.to_string(),
        pre_state_relevant_fingerprint: V114X_EXPECTED_PRE_STATE_FINGERPRINT.to_string(),
        schema_fingerprint: V114X_EXPECTED_SCHEMA_FINGERPRINT.to_string(),
        post_state_fingerprint: committed_post_state,
        backup_manifest_sha256,
        backup_directory: backup.backup_directory.clone(),
        live_database_path: input.database_file.to_string_lossy().to_string(),
        live_family_before,
        live_family_after,
        targets_deleted: 5,
        evidence_reparented: 5,
        evidence_rows_preserved: 10,
        owners_preserved: 5,
        approved_corporate_action_10947_unchanged: true,
        protected_scan_ids: vec![1736, 4670, 5353],
        protected_scans_unchanged: true,
        quick_check: quick,
        foreign_key_violations: foreign_keys,
        live_apply_authorized: true,
    };

    if let Err(error) = write_json(
        &input.output_path.join("v1-14x-live-apply-result.json"),
        &result,
    ) {
        write_committed_failure_marker(&input.output_path, "COMMITTED_REPORT_FAILURE", &error);
        eprintln!("COMMITTED_REPORT_FAILURE");
        eprintln!("V1.14X transaction committed; result report writing failed. Do not restore automatically.");
        eprintln!("Report error: {error}");
        return Ok(V114X_COMMITTED_REPORT_FAILURE_EXIT);
    }

    println!("[PASS] V1.14X exact V1.14W Apply-plan lock");
    println!("[PASS] V1.14X verified full pre-write backup manifest");
    println!("[PASS] V1.14X TransactionBehavior::Immediate live transaction committed");
    println!("[PASS] exact five target imports deleted");
    println!("[PASS] exact five evidence rows re-parented");
    println!("[PASS] all ten evidence rows preserved");
    println!("[PASS] all five canonical owners preserved");
    println!("[PASS] Corporate Action 10947 preserved");
    println!("[PASS] scan results 1736 / 4670 / 5353 preserved");
    println!("[PASS] post-state fingerprint: {V114W_EXPECTED_POST_STATE_FINGERPRINT}");
    println!("[PASS] quick_check = ok");
    println!("[PASS] foreign_key_check = 0");
    Ok(0)
}

pub(crate) fn try_run_five_pair_consolidation_apply_maintenance(
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

    fn valid_args() -> Vec<String> {
        vec![
            "app".to_string(),
            V114X_FLAG.to_string(),
            "--mode".to_string(),
            "apply".to_string(),
            "--database-file".to_string(),
            "db".to_string(),
            "--output".to_string(),
            "out".to_string(),
            "--authority".to_string(),
            "authority.json".to_string(),
            "--v114v-manifest".to_string(),
            "v114v.json".to_string(),
            "--v114w-apply-plan".to_string(),
            "v114w.json".to_string(),
            "--backup-manifest".to_string(),
            "backup.json".to_string(),
            "--live-apply-ack".to_string(),
            V114X_LIVE_APPLY_ACK.to_string(),
        ]
    }

    #[test]
    fn v114x_maintenance_args_absent_flag_preserves_normal_startup() {
        assert!(parse_maintenance_args(vec!["app".to_string()])
            .unwrap()
            .is_none());
    }

    #[test]
    fn v114x_maintenance_args_reject_non_apply_mode() {
        let mut args = valid_args();
        let mode_index = args.iter().position(|value| value == "--mode").unwrap() + 1;
        args[mode_index] = "dry-run".to_string();
        assert!(parse_maintenance_args(args)
            .unwrap_err()
            .contains("Only apply"));
    }

    #[test]
    fn v114x_maintenance_args_require_exact_live_authorization_token() {
        let mut args = valid_args();
        let ack_index = args
            .iter()
            .position(|value| value == "--live-apply-ack")
            .unwrap()
            + 1;
        args[ack_index] = "wrong".to_string();
        assert!(parse_maintenance_args(args)
            .unwrap_err()
            .contains("authorization token"));
    }

    fn approved_plan() -> V114WApplyPlanManifest {
        V114WApplyPlanManifest {
            format_version: "ca-v114w-five-pair-apply-plan-v1".to_string(),
            version: "V1.14W".to_string(),
            status: "PRIVATE_COPY_DRY_RUN_PASS_NO_LIVE_AUTHORIZATION".to_string(),
            v114u_plan_fingerprint:
                "6D6F6B15FE86C7D31A333F8097D69E5AF970F0E7A3981E9930A59CB10DF53C95".to_string(),
            v114v_manifest_fingerprint:
                "40297583AC3B77F4C36C4689A9B13A5F56897D76A5F30FFE5E4C2DC12A3CB218".to_string(),
            pre_state_relevant_fingerprint: V114X_EXPECTED_PRE_STATE_FINGERPRINT.to_string(),
            schema_fingerprint: V114X_EXPECTED_SCHEMA_FINGERPRINT.to_string(),
            post_state_fingerprint: V114W_EXPECTED_POST_STATE_FINGERPRINT.to_string(),
            apply_plan_fingerprint: V114W_APPLY_PLAN_FINGERPRINT.to_string(),
            targets_deleted: 5,
            evidence_reparented: 5,
            evidence_rows_preserved: 10,
            owners_preserved: 5,
            protected_corporate_action_id: 10947,
            protected_scan_ids: vec![1736, 4670, 5353],
            live_apply_authorized: false,
        }
    }

    #[test]
    fn v114x_apply_plan_accepts_exact_private_copy_authority() {
        validate_v114w_apply_plan(&approved_plan()).unwrap();
    }

    #[test]
    fn v114x_apply_plan_rejects_pre_authorized_live_plan() {
        let mut plan = approved_plan();
        plan.live_apply_authorized = true;
        assert!(validate_v114w_apply_plan(&plan)
            .unwrap_err()
            .contains("contract drifted"));
    }

    #[test]
    fn v114x_backup_source_family_detects_wal_hash_drift() {
        let family = LiveFamily {
            main_path: "db".to_string(),
            main_exists: true,
            main_length: 1,
            main_sha256: "A".repeat(64),
            wal_exists: true,
            wal_length: 1,
            wal_sha256: "B".repeat(64),
            shm_exists: true,
            shm_length: 1,
            shm_sha256: "C".repeat(64),
        };
        let mut drift = family.clone();
        drift.wal_sha256 = "D".repeat(64);
        assert!(!same_database_family(&family, &drift));
    }

    #[test]
    fn v114x_backup_manifest_rejects_unverified_state() {
        let family = LiveFamily {
            main_path: "db".to_string(),
            main_exists: true,
            main_length: 1,
            main_sha256: "A".repeat(64),
            wal_exists: true,
            wal_length: 1,
            wal_sha256: "B".repeat(64),
            shm_exists: true,
            shm_length: 1,
            shm_sha256: "C".repeat(64),
        };
        let artifact = BackupArtifact {
            path: "missing".to_string(),
            length: 1,
            sha256: "A".repeat(64),
        };
        let backup = BackupManifest {
            version: "V1.14X_PREWRITE_BACKUP_V1".to_string(),
            verified: false,
            source_database_family: family.clone(),
            backup_directory: "missing".to_string(),
            created_at: "2026-08-25T00:00:00+05:30".to_string(),
            recovery_main: artifact.clone(),
            recovery_wal: artifact.clone(),
            forensic_shm: artifact,
            restore_policy: "RESTORE_MAIN_AND_WAL_ONLY_SHM_FORENSIC".to_string(),
        };
        assert!(validate_backup_manifest(&backup, &family, Path::new("db"))
            .unwrap_err()
            .contains("incomplete"));
    }
}
