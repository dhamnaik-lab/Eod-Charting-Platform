use crate::database::AppResult;
use rusqlite::{
    params, params_from_iter, types::Value as SqlValue, types::ValueRef, Connection,
    TransactionBehavior,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map as JsonMap, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

const V114W_FLAG: &str = "--maintenance-corporate-action-v114w";
const V114W_MODE_DRY_RUN: &str = "dry-run";
const V114W_PRIVATE_COPY_ACK: &str = "V1.14W_PRIVATE_COPY_ONLY";

const V114U_PLAN_FINGERPRINT: &str =
    "6D6F6B15FE86C7D31A333F8097D69E5AF970F0E7A3981E9930A59CB10DF53C95";
pub(super) const V114V_RELEVANT_STATE_FINGERPRINT: &str =
    "1094511FFFAA18AA338A1A45EBAB3D2D2641AA68A210069E7CF3FF412D929E7B";
const V114V_MANIFEST_FINGERPRINT: &str =
    "40297583AC3B77F4C36C4689A9B13A5F56897D76A5F30FFE5E4C2DC12A3CB218";
pub(super) const V114V_SCHEMA_FINGERPRINT: &str =
    "C700F5B8622FFEA89569E6B5AF514A189229E3F338BE46056DC15CF8D6D173D7";
const V114V_AUTHORITY_SHA256: &str =
    "3F7EE2F5B00BDF58049C5A1BED886BC0FB3FAFF54468569DA8B9AAA8815520AF";
const V114V_MANIFEST_SHA256: &str =
    "95FFF73E526EEDC1D5FDC242DA1F9C6C5BEDCE696E41F3631D83D4C19DF887B0";
const V114W_APPLY_PLAN_FINGERPRINT_VERSION: &str = "ca-v114w-five-pair-apply-plan-v1";

const PROTECTED_CORPORATE_ACTION_ID: i64 = 10947;
const PROTECTED_SCAN_IDS: [i64; 3] = [1736, 4670, 5353];
const EXPECTED_RELEVANT_TABLES: [&str; 7] = [
    "corporate_action_imports",
    "corporate_action_import_evidence",
    "corporate_action_import_decisions",
    "corporate_action_event_identity_resolutions",
    "corporate_action_scan_results",
    "corporate_actions",
    "historical_capital_action_backfill_run_outcomes",
];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PairSpec {
    target_import_id: i64,
    owner_import_id: i64,
    target_evidence_id: i64,
    owner_evidence_id: i64,
}

const EXACT_PAIRS: [PairSpec; 5] = [
    PairSpec {
        target_import_id: 42737,
        owner_import_id: 1232,
        target_evidence_id: 42737,
        owner_evidence_id: 1232,
    },
    PairSpec {
        target_import_id: 42779,
        owner_import_id: 3799,
        target_evidence_id: 42779,
        owner_evidence_id: 3799,
    },
    PairSpec {
        target_import_id: 42818,
        owner_import_id: 6362,
        target_evidence_id: 42818,
        owner_evidence_id: 6362,
    },
    PairSpec {
        target_import_id: 42855,
        owner_import_id: 9005,
        target_evidence_id: 42855,
        owner_evidence_id: 9005,
    },
    PairSpec {
        target_import_id: 42863,
        owner_import_id: 9582,
        target_evidence_id: 42863,
        owner_evidence_id: 9582,
    },
];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoritySource {
    v114u_plan_fingerprint: String,
    v114u_result: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AuthorityDocument {
    format_version: String,
    authority_source: AuthoritySource,
    pairs: Vec<PairSpec>,
    expected_imports: Vec<Value>,
    expected_evidence: Vec<Value>,
    protected_corporate_action: Value,
    protected_scan_results: Vec<Value>,
    expected_relevant_tables: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct LiveFamily {
    pub(super) main_path: String,
    pub(super) main_exists: bool,
    pub(super) main_length: u64,
    pub(super) main_sha256: String,
    pub(super) wal_exists: bool,
    pub(super) wal_length: u64,
    pub(super) wal_sha256: String,
    pub(super) shm_exists: bool,
    pub(super) shm_length: u64,
    pub(super) shm_sha256: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct V114VManifest {
    format_version: String,
    version: String,
    mode: String,
    authority_sha256: String,
    authority_plan_fingerprint: String,
    pub(super) live_database_path: String,
    pub(super) live_family_before: LiveFamily,
    pairs: Vec<PairSpec>,
    relevant_state_fingerprint: String,
    schema_fingerprint: String,
    query_only: i64,
    quick_check: Vec<String>,
    foreign_key_violations: Vec<Value>,
    sqlite_total_changes: u64,
    preflight_status: String,
    apply_authorized: bool,
    manifest_fingerprint: String,
}

#[derive(Clone, Debug)]
struct MaintenanceInput {
    database_file: PathBuf,
    output_path: PathBuf,
    authority_path: PathBuf,
    v114v_manifest_path: PathBuf,
}

#[derive(Clone, Debug)]
pub(super) struct PreStateLock {
    relevant_state_fingerprint: String,
    schema_fingerprint: String,
}

#[derive(Clone, Debug)]
struct PreStateSnapshot {
    imports: Vec<Value>,
    evidence: Vec<Value>,
    protected_action: Value,
    protected_scans: Vec<Value>,
    relevant_state: Value,
    schema_contract: Value,
    table_counts: BTreeMap<String, i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DryRunResult {
    version: String,
    result: String,
    mode: String,
    v114u_plan_fingerprint: String,
    v114v_manifest_fingerprint: String,
    pre_state_relevant_fingerprint: String,
    schema_fingerprint: String,
    post_state_fingerprint: String,
    apply_plan_fingerprint_version: String,
    apply_plan_fingerprint: String,
    private_database_path: String,
    private_database_sha256_before: String,
    private_wal_sha256_before: String,
    private_database_sha256_after: String,
    private_wal_sha256_after: String,
    targets_deleted: usize,
    evidence_reparented: usize,
    evidence_rows_preserved: usize,
    owners_preserved: usize,
    approved_corporate_action_10947_unchanged: bool,
    protected_scan_ids: Vec<i64>,
    protected_scans_unchanged: bool,
    quick_check: Vec<String>,
    foreign_key_violations: Vec<Value>,
    transaction_committed_on_private_copy: bool,
    live_database_writes: u32,
    live_apply_capability: bool,
}

fn canonical_sha256(value: &Value) -> AppResult<String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)).to_uppercase())
}

pub(super) fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    use std::io::Read;
    let mut hash = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()).to_uppercase())
}

pub(super) fn sidecar_path(database_file: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", database_file.to_string_lossy(), suffix))
}

pub(super) fn normalize_path_text(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\").to_lowercase()
}

fn ensure_private_database_path(database_file: &Path, live_database_path: &str) -> AppResult<()> {
    let input_text = normalize_path_text(database_file);
    let live_text = live_database_path.replace('/', "\\").to_lowercase();
    if input_text == live_text {
        return Err("V1.14W refuses to open the V1.14V live database path.".to_string());
    }

    if database_file.is_file() {
        let input_canonical = fs::canonicalize(database_file).map_err(|error| error.to_string())?;
        let live_path = PathBuf::from(live_database_path);
        if live_path.is_file() {
            let live_canonical = fs::canonicalize(&live_path).map_err(|error| error.to_string())?;
            if normalize_path_text(&input_canonical) == normalize_path_text(&live_canonical) {
                return Err("V1.14W private-copy path resolves to the live database.".to_string());
            }
        }
    }
    Ok(())
}


pub(super) fn ensure_exact_live_database_path(
    database_file: &Path,
    manifest: &V114VManifest,
) -> AppResult<()> {
    if !database_file.is_file() {
        return Err(format!(
            "V1.14X live database file missing: {}",
            database_file.display()
        ));
    }

    let expected_path = PathBuf::from(&manifest.live_database_path);
    if normalize_path_text(database_file) != normalize_path_text(&expected_path) {
        return Err(format!(
            "V1.14X refuses database path {} because the V1.14V live path is {}.",
            database_file.display(),
            expected_path.display()
        ));
    }

    let actual_canonical = fs::canonicalize(database_file).map_err(|error| error.to_string())?;
    let expected_canonical = fs::canonicalize(&expected_path).map_err(|error| error.to_string())?;
    if normalize_path_text(&actual_canonical) != normalize_path_text(&expected_canonical) {
        return Err("V1.14X database path does not resolve to the exact V1.14V live database.".to_string());
    }
    Ok(())
}

pub(super) fn snapshot_database_family(database_file: &Path) -> AppResult<LiveFamily> {
    let main_exists = database_file.is_file();
    let main_length = if main_exists {
        fs::metadata(database_file)
            .map_err(|error| error.to_string())?
            .len()
    } else {
        0
    };
    let main_sha256 = if main_exists {
        sha256_file(database_file)?
    } else {
        String::new()
    };

    let wal_path = sidecar_path(database_file, "-wal");
    let wal_exists = wal_path.is_file();
    let wal_length = if wal_exists {
        fs::metadata(&wal_path)
            .map_err(|error| error.to_string())?
            .len()
    } else {
        0
    };
    let wal_sha256 = if wal_exists {
        sha256_file(&wal_path)?
    } else {
        String::new()
    };

    let shm_path = sidecar_path(database_file, "-shm");
    let shm_exists = shm_path.is_file();
    let shm_length = if shm_exists {
        fs::metadata(&shm_path)
            .map_err(|error| error.to_string())?
            .len()
    } else {
        0
    };
    let shm_sha256 = if shm_exists {
        sha256_file(&shm_path)?
    } else {
        String::new()
    };

    Ok(LiveFamily {
        main_path: database_file.to_string_lossy().to_string(),
        main_exists,
        main_length,
        main_sha256,
        wal_exists,
        wal_length,
        wal_sha256,
        shm_exists,
        shm_length,
        shm_sha256,
    })
}

pub(super) fn same_database_family(left: &LiveFamily, right: &LiveFamily) -> bool {
    normalize_path_text(Path::new(&left.main_path))
        == normalize_path_text(Path::new(&right.main_path))
        && left.main_exists == right.main_exists
        && left.main_length == right.main_length
        && left.main_sha256 == right.main_sha256
        && left.wal_exists == right.wal_exists
        && left.wal_length == right.wal_length
        && left.wal_sha256 == right.wal_sha256
        && left.shm_exists == right.shm_exists
        && left.shm_length == right.shm_length
        && left.shm_sha256 == right.shm_sha256
}

pub(super) fn verify_exact_live_family_before_open(
    database_file: &Path,
    manifest: &V114VManifest,
) -> AppResult<LiveFamily> {
    ensure_exact_live_database_path(database_file, manifest)?;
    let actual = snapshot_database_family(database_file)?;
    if !same_database_family(&actual, &manifest.live_family_before) {
        return Err("V1.14X live database family differs from the exact V1.14V preflight family.".to_string());
    }
    Ok(actual)
}

fn verify_private_family_before_open(database_file: &Path, manifest: &V114VManifest) -> AppResult<(String, String)> {
    if !database_file.is_file() {
        return Err(format!("V1.14W private database missing: {}", database_file.display()));
    }
    let main_hash = sha256_file(database_file)?;
    if main_hash != manifest.live_family_before.main_sha256 {
        return Err(format!(
            "V1.14W private main hash drift: expected {}, actual {}.",
            manifest.live_family_before.main_sha256, main_hash
        ));
    }
    if fs::metadata(database_file).map_err(|error| error.to_string())?.len()
        != manifest.live_family_before.main_length
    {
        return Err("V1.14W private main length differs from V1.14V authority.".to_string());
    }

    let wal_path = sidecar_path(database_file, "-wal");
    if !manifest.live_family_before.wal_exists || !wal_path.is_file() {
        return Err("V1.14W requires the exact V1.14V WAL sidecar on the private copy.".to_string());
    }
    let wal_hash = sha256_file(&wal_path)?;
    if wal_hash != manifest.live_family_before.wal_sha256 {
        return Err(format!(
            "V1.14W private WAL hash drift: expected {}, actual {}.",
            manifest.live_family_before.wal_sha256, wal_hash
        ));
    }
    if fs::metadata(&wal_path).map_err(|error| error.to_string())?.len()
        != manifest.live_family_before.wal_length
    {
        return Err("V1.14W private WAL length differs from V1.14V authority.".to_string());
    }
    Ok((main_hash, wal_hash))
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> AppResult<Value> {
    match value {
        ValueRef::Null => Ok(Value::Null),
        ValueRef::Integer(value) => Ok(json!(value)),
        ValueRef::Real(value) => serde_json::Number::from_f64(value)
            .map(Value::Number)
            .ok_or_else(|| "V1.14W encountered a non-finite SQLite REAL value.".to_string()),
        ValueRef::Text(value) => Ok(Value::String(
            std::str::from_utf8(value)
                .map_err(|error| error.to_string())?
                .to_string(),
        )),
        ValueRef::Blob(_) => Err("V1.14W relevant-state audit encountered an unexpected BLOB.".to_string()),
    }
}

fn query_json_rows(connection: &Connection, sql: &str, parameters: &[SqlValue]) -> AppResult<Vec<Value>> {
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let column_names = statement
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();
    let mut cursor = statement
        .query(params_from_iter(parameters.iter()))
        .map_err(|error| error.to_string())?;
    let mut result = Vec::<Value>::new();
    while let Some(row) = cursor.next().map_err(|error| error.to_string())? {
        let mut object = JsonMap::<String, Value>::new();
        for (index, name) in column_names.iter().enumerate() {
            object.insert(
                name.clone(),
                sqlite_value_to_json(row.get_ref(index).map_err(|error| error.to_string())?)?,
            );
        }
        result.push(Value::Object(object));
    }
    Ok(result)
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn table_names(connection: &Connection) -> AppResult<Vec<String>> {
    let rows = query_json_rows(
        connection,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        &[],
    )?;
    rows.into_iter()
        .map(|row| {
            row.get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| "V1.14W sqlite_master row missing table name.".to_string())
        })
        .collect()
}

fn table_info(connection: &Connection, table: &str) -> AppResult<Vec<Value>> {
    query_json_rows(
        connection,
        &format!("PRAGMA table_info({})", quote_identifier(table)),
        &[],
    )
}

fn foreign_keys(connection: &Connection, table: &str) -> AppResult<Vec<Value>> {
    query_json_rows(
        connection,
        &format!("PRAGMA foreign_key_list({})", quote_identifier(table)),
        &[],
    )
}

fn exact_ids() -> Vec<i64> {
    EXACT_PAIRS
        .iter()
        .flat_map(|pair| [pair.target_import_id, pair.owner_import_id])
        .collect()
}

fn target_ids() -> HashSet<i64> {
    EXACT_PAIRS.iter().map(|pair| pair.target_import_id).collect()
}

fn owner_ids() -> HashSet<i64> {
    EXACT_PAIRS.iter().map(|pair| pair.owner_import_id).collect()
}

fn fetch_rows_by_ids(
    connection: &Connection,
    table: &str,
    id_column: &str,
    ids: &[i64],
) -> AppResult<Vec<Value>> {
    let marks = (0..ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
    let params = ids.iter().copied().map(SqlValue::Integer).collect::<Vec<_>>();
    query_json_rows(
        connection,
        &format!(
            "SELECT * FROM {} WHERE {} IN ({}) ORDER BY {}",
            quote_identifier(table),
            quote_identifier(id_column),
            marks,
            quote_identifier(id_column)
        ),
        &params,
    )
}

fn fetch_import_rows(connection: &Connection) -> AppResult<Vec<Value>> {
    fetch_rows_by_ids(connection, "corporate_action_imports", "id", &exact_ids())
}

fn fetch_evidence_rows(connection: &Connection) -> AppResult<Vec<Value>> {
    fetch_rows_by_ids(
        connection,
        "corporate_action_import_evidence",
        "import_id",
        &exact_ids(),
    )
}

fn sort_values_by_i64_id(values: &mut [Value]) {
    values.sort_by_key(|value| value.get("id").and_then(Value::as_i64).unwrap_or(i64::MAX));
}

fn is_relevant_table_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [
        "corporate",
        "resolution",
        "decision",
        "evidence",
        "approval",
        "history",
        "import",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn is_heuristic_import_id_column(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == "import_id"
        || lower.ends_with("_import_id")
        || (lower.contains("corporate_action_import") && lower.ends_with("id"))
        || (lower.starts_with("source_import") && lower.ends_with("id"))
}

fn collect_declared_import_references(
    connection: &Connection,
    tables: &[String],
) -> AppResult<Vec<Value>> {
    let ids = exact_ids();
    let mut groups = Vec::<Value>::new();
    for table in tables {
        for fk in foreign_keys(connection, table)? {
            if fk.get("table").and_then(Value::as_str) != Some("corporate_action_imports") {
                continue;
            }
            let Some(column) = fk.get("from").and_then(Value::as_str) else {
                continue;
            };
            let ref_rows = fetch_rows_by_ids(connection, table, column, &ids)?;
            if !ref_rows.is_empty() {
                groups.push(json!({
                    "table": table,
                    "column": column,
                    "rows": ref_rows,
                }));
            }
        }
    }
    Ok(groups)
}

fn collect_heuristic_import_references(
    connection: &Connection,
    tables: &[String],
    declared: &[Value],
) -> AppResult<Vec<Value>> {
    let already = declared
        .iter()
        .filter_map(|group| {
            Some((
                group.get("table")?.as_str()?.to_string(),
                group.get("column")?.as_str()?.to_string(),
            ))
        })
        .collect::<HashSet<_>>();
    let ids = exact_ids();
    let mut groups = Vec::<Value>::new();
    for table in tables {
        if !is_relevant_table_name(table) {
            continue;
        }
        for column in table_info(connection, table)? {
            let Some(name) = column.get("name").and_then(Value::as_str) else {
                continue;
            };
            if already.contains(&(table.clone(), name.to_string())) || !is_heuristic_import_id_column(name) {
                continue;
            }
            let ref_rows = fetch_rows_by_ids(connection, table, name, &ids)?;
            if !ref_rows.is_empty() {
                groups.push(json!({
                    "table": table,
                    "column": name,
                    "rows": ref_rows,
                }));
            }
        }
    }
    Ok(groups)
}

fn protected_action(connection: &Connection) -> AppResult<Value> {
    let mut rows = fetch_rows_by_ids(
        connection,
        "corporate_actions",
        "id",
        &[PROTECTED_CORPORATE_ACTION_ID],
    )?;
    if rows.len() != 1 {
        return Err(format!(
            "V1.14W protected Corporate Action {} missing or duplicated.",
            PROTECTED_CORPORATE_ACTION_ID
        ));
    }
    Ok(rows.remove(0))
}

fn protected_scans(connection: &Connection) -> AppResult<Vec<Value>> {
    fetch_rows_by_ids(
        connection,
        "corporate_action_scan_results",
        "id",
        &PROTECTED_SCAN_IDS,
    )
}

fn build_relevant_state(connection: &Connection, authority: &AuthorityDocument) -> AppResult<Value> {
    let tables = table_names(connection)?;
    for required in &authority.expected_relevant_tables {
        if !tables.iter().any(|table| table == required) {
            return Err(format!("V1.14W required relevant table missing: {required}"));
        }
    }
    let imports = fetch_import_rows(connection)?;
    let evidence = fetch_evidence_rows(connection)?;
    let declared = collect_declared_import_references(connection, &tables)?;
    let heuristic = collect_heuristic_import_references(connection, &tables, &declared)?;
    let action = protected_action(connection)?;
    let mut scans = protected_scans(connection)?;
    sort_values_by_i64_id(&mut scans);
    Ok(json!({
        "pairs": authority.pairs.clone(),
        "imports": imports,
        "evidence": evidence,
        "declaredReferences": declared,
        "heuristicReferences": heuristic,
        "protectedCorporateAction": action,
        "protectedScanResults": scans,
    }))
}

fn build_schema_contract(connection: &Connection, authority: &AuthorityDocument) -> AppResult<Value> {
    let mut contract = JsonMap::<String, Value>::new();
    for table in &authority.expected_relevant_tables {
        contract.insert(
            table.clone(),
            json!({
                "columns": table_info(connection, table)?,
                "foreignKeys": foreign_keys(connection, table)?,
            }),
        );
    }
    Ok(Value::Object(contract))
}

pub(super) fn quick_check(connection: &Connection) -> AppResult<Vec<String>> {
    query_json_rows(connection, "PRAGMA quick_check", &[])?
        .into_iter()
        .map(|row| {
            row.as_object()
                .and_then(|object| object.values().next())
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| "V1.14W could not decode PRAGMA quick_check.".to_string())
        })
        .collect()
}

pub(super) fn foreign_key_check(connection: &Connection) -> AppResult<Vec<Value>> {
    query_json_rows(connection, "PRAGMA foreign_key_check", &[])
}

fn table_counts(connection: &Connection, authority: &AuthorityDocument) -> AppResult<BTreeMap<String, i64>> {
    let mut counts = BTreeMap::<String, i64>::new();
    for table in &authority.expected_relevant_tables {
        let sql = format!("SELECT COUNT(*) AS count FROM {}", quote_identifier(table));
        let rows = query_json_rows(connection, &sql, &[])?;
        let count = rows
            .first()
            .and_then(|row| row.get("count"))
            .and_then(Value::as_i64)
            .ok_or_else(|| format!("V1.14W could not count {table}."))?;
        counts.insert(table.clone(), count);
    }
    Ok(counts)
}

fn snapshot_pre_state(connection: &Connection, authority: &AuthorityDocument) -> AppResult<PreStateSnapshot> {
    let mut imports = fetch_import_rows(connection)?;
    let mut evidence = fetch_evidence_rows(connection)?;
    let mut scans = protected_scans(connection)?;
    sort_values_by_i64_id(&mut imports);
    sort_values_by_i64_id(&mut evidence);
    sort_values_by_i64_id(&mut scans);
    Ok(PreStateSnapshot {
        imports,
        evidence,
        protected_action: protected_action(connection)?,
        protected_scans: scans,
        relevant_state: build_relevant_state(connection, authority)?,
        schema_contract: build_schema_contract(connection, authority)?,
        table_counts: table_counts(connection, authority)?,
    })
}

fn exact_pairs_value() -> AppResult<Value> {
    serde_json::to_value(EXACT_PAIRS.as_slice()).map_err(|error| error.to_string())
}

fn validate_compiled_authority(authority: &AuthorityDocument) -> AppResult<()> {
    if authority.format_version != "v1.14v-live-preflight-authority-v1" {
        return Err("V1.14W authority format mismatch.".to_string());
    }
    if authority.authority_source.v114u_result != "PASS"
        || authority.authority_source.v114u_plan_fingerprint != V114U_PLAN_FINGERPRINT
    {
        return Err("V1.14W authority does not bind to the accepted V1.14U result.".to_string());
    }
    if serde_json::to_value(&authority.pairs).map_err(|error| error.to_string())? != exact_pairs_value()? {
        return Err("V1.14W authority exact five-pair set drifted.".to_string());
    }
    let expected_tables = EXPECTED_RELEVANT_TABLES
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    if authority.expected_relevant_tables != expected_tables {
        return Err("V1.14W relevant-table authority drifted.".to_string());
    }
    if authority.expected_imports.len() != 10
        || authority.expected_evidence.len() != 10
        || authority.protected_scan_results.len() != 3
    {
        return Err("V1.14W authority cardinality drifted.".to_string());
    }
    Ok(())
}

fn validate_manifest_value(manifest_value: &Value) -> AppResult<V114VManifest> {
    let manifest: V114VManifest = serde_json::from_value(manifest_value.clone())
        .map_err(|error| format!("Invalid V1.14V manifest: {error}"))?;
    if manifest.format_version != "v1.14v-exact-live-preflight-manifest-v1"
        || manifest.version != "V1.14V"
        || manifest.mode != "READ_ONLY_PRIVATE_SNAPSHOT_OF_QUIESCENT_LIVE_FAMILY"
        || manifest.authority_sha256 != V114V_AUTHORITY_SHA256
        || manifest.authority_plan_fingerprint != V114U_PLAN_FINGERPRINT
        || manifest.relevant_state_fingerprint != V114V_RELEVANT_STATE_FINGERPRINT
        || manifest.schema_fingerprint != V114V_SCHEMA_FINGERPRINT
        || manifest.manifest_fingerprint != V114V_MANIFEST_FINGERPRINT
        || manifest.query_only != 1
        || manifest.quick_check != vec!["ok".to_string()]
        || !manifest.foreign_key_violations.is_empty()
        || manifest.sqlite_total_changes != 0
        || manifest.preflight_status != "READY_FOR_SEPARATE_APPLY_DESIGN_REVIEW"
        || manifest.apply_authorized
        || serde_json::to_value(&manifest.pairs).map_err(|error| error.to_string())? != exact_pairs_value()?
    {
        return Err("V1.14W V1.14V manifest contract drifted.".to_string());
    }
    if !manifest.live_family_before.main_exists
        || !manifest.live_family_before.wal_exists
        || !manifest.live_family_before.shm_exists
        || manifest.live_family_before.main_path != manifest.live_database_path
        || manifest.live_family_before.main_sha256.is_empty()
        || manifest.live_family_before.wal_sha256.is_empty()
        || manifest.live_family_before.shm_sha256.is_empty()
        || manifest.live_family_before.shm_length == 0
    {
        return Err("V1.14W V1.14V live-family manifest is incomplete.".to_string());
    }

    let mut core = manifest_value.clone();
    core.as_object_mut()
        .ok_or_else(|| "V1.14W V1.14V manifest must be an object.".to_string())?
        .remove("manifestFingerprint");
    if canonical_sha256(&core)? != V114V_MANIFEST_FINGERPRINT {
        return Err("V1.14W recomputed V1.14V manifest fingerprint mismatch.".to_string());
    }
    Ok(manifest)
}

pub(super) fn load_authority(path: &Path) -> AppResult<AuthorityDocument> {
    if sha256_file(path)? != V114V_AUTHORITY_SHA256 {
        return Err("V1.14W authority file SHA-256 mismatch.".to_string());
    }
    let authority: AuthorityDocument = serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Invalid V1.14W authority JSON: {error}"))?;
    validate_compiled_authority(&authority)?;
    Ok(authority)
}

pub(super) fn load_manifest(path: &Path) -> AppResult<V114VManifest> {
    if sha256_file(path)? != V114V_MANIFEST_SHA256 {
        return Err("V1.14W V1.14V manifest file SHA-256 mismatch.".to_string());
    }
    let value: Value = serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Invalid V1.14V manifest JSON: {error}"))?;
    validate_manifest_value(&value)
}

fn verify_authority_rows(snapshot: &PreStateSnapshot, authority: &AuthorityDocument) -> AppResult<()> {
    let mut expected_imports = authority.expected_imports.clone();
    let mut expected_evidence = authority.expected_evidence.clone();
    let mut expected_scans = authority.protected_scan_results.clone();
    sort_values_by_i64_id(&mut expected_imports);
    sort_values_by_i64_id(&mut expected_evidence);
    sort_values_by_i64_id(&mut expected_scans);
    if snapshot.imports != expected_imports {
        return Err("V1.14W exact ten import rows drifted from authority.".to_string());
    }
    if snapshot.evidence != expected_evidence {
        return Err("V1.14W exact ten evidence rows drifted from authority.".to_string());
    }
    if snapshot.protected_action != authority.protected_corporate_action {
        return Err(format!(
            "V1.14W protected Corporate Action {} drifted.",
            PROTECTED_CORPORATE_ACTION_ID
        ));
    }
    if snapshot.protected_scans != expected_scans {
        return Err("V1.14W protected scan-result rows drifted.".to_string());
    }
    Ok(())
}

pub(super) fn expected_pre_state_lock() -> PreStateLock {
    PreStateLock {
        relevant_state_fingerprint: V114V_RELEVANT_STATE_FINGERPRINT.to_string(),
        schema_fingerprint: V114V_SCHEMA_FINGERPRINT.to_string(),
    }
}

fn validate_pre_state(
    connection: &Connection,
    authority: &AuthorityDocument,
    lock: &PreStateLock,
) -> AppResult<PreStateSnapshot> {
    let snapshot = snapshot_pre_state(connection, authority)?;
    verify_authority_rows(&snapshot, authority)?;
    let relevant_fingerprint = canonical_sha256(&snapshot.relevant_state)?;
    if relevant_fingerprint != lock.relevant_state_fingerprint {
        return Err(format!(
            "V1.14W relevant-state fingerprint drift: expected {}, actual {}.",
            lock.relevant_state_fingerprint, relevant_fingerprint
        ));
    }
    let schema_fingerprint = canonical_sha256(&snapshot.schema_contract)?;
    if schema_fingerprint != lock.schema_fingerprint {
        return Err(format!(
            "V1.14W schema fingerprint drift: expected {}, actual {}.",
            lock.schema_fingerprint, schema_fingerprint
        ));
    }
    let quick = quick_check(connection)?;
    if quick != vec!["ok".to_string()] {
        return Err(format!("V1.14W pre-state quick_check failed: {quick:?}"));
    }
    let fk = foreign_key_check(connection)?;
    if !fk.is_empty() {
        return Err("V1.14W pre-state foreign_key_check failed.".to_string());
    }
    Ok(snapshot)
}

fn target_has_any_reference(connection: &Connection, target_id: i64) -> AppResult<bool> {
    let tables = table_names(connection)?;
    for table in &tables {
        for fk in foreign_keys(connection, table)? {
            if fk.get("table").and_then(Value::as_str) != Some("corporate_action_imports") {
                continue;
            }
            let Some(column) = fk.get("from").and_then(Value::as_str) else {
                continue;
            };
            if !fetch_rows_by_ids(connection, table, column, &[target_id])?.is_empty() {
                return Ok(true);
            }
        }
    }
    for table in &tables {
        if !is_relevant_table_name(table) {
            continue;
        }
        let declared_columns = foreign_keys(connection, table)?
            .into_iter()
            .filter(|fk| fk.get("table").and_then(Value::as_str) == Some("corporate_action_imports"))
            .filter_map(|fk| fk.get("from").and_then(Value::as_str).map(str::to_string))
            .collect::<HashSet<_>>();
        for column in table_info(connection, table)? {
            let Some(name) = column.get("name").and_then(Value::as_str) else {
                continue;
            };
            if declared_columns.contains(name) || !is_heuristic_import_id_column(name) {
                continue;
            }
            if !fetch_rows_by_ids(connection, table, name, &[target_id])?.is_empty() {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn expected_post_imports(authority: &AuthorityDocument) -> Vec<Value> {
    let targets = target_ids();
    let mut rows = authority
        .expected_imports
        .iter()
        .filter(|row| {
            row.get("id")
                .and_then(Value::as_i64)
                .map(|id| !targets.contains(&id))
                .unwrap_or(false)
        })
        .cloned()
        .collect::<Vec<_>>();
    sort_values_by_i64_id(&mut rows);
    rows
}

fn expected_post_evidence(authority: &AuthorityDocument) -> AppResult<Vec<Value>> {
    let target_to_owner = EXACT_PAIRS
        .iter()
        .map(|pair| (pair.target_evidence_id, pair.owner_import_id))
        .collect::<HashMap<_, _>>();
    let mut rows = authority.expected_evidence.clone();
    for row in &mut rows {
        let Some(id) = row.get("id").and_then(Value::as_i64) else {
            return Err("V1.14W authority evidence row missing id.".to_string());
        };
        if let Some(owner) = target_to_owner.get(&id) {
            row.as_object_mut()
                .ok_or_else(|| "V1.14W authority evidence row is not an object.".to_string())?
                .insert("import_id".to_string(), json!(owner));
        }
    }
    sort_values_by_i64_id(&mut rows);
    Ok(rows)
}

fn build_post_state(connection: &Connection, authority: &AuthorityDocument) -> AppResult<Value> {
    let owner_vec = EXACT_PAIRS.iter().map(|pair| pair.owner_import_id).collect::<Vec<_>>();
    let mut owners = fetch_rows_by_ids(connection, "corporate_action_imports", "id", &owner_vec)?;
    sort_values_by_i64_id(&mut owners);
    let mut evidence = fetch_rows_by_ids(
        connection,
        "corporate_action_import_evidence",
        "import_id",
        &owner_vec,
    )?;
    sort_values_by_i64_id(&mut evidence);
    let mut scans = protected_scans(connection)?;
    sort_values_by_i64_id(&mut scans);
    Ok(json!({
        "pairs": authority.pairs.clone(),
        "owners": owners,
        "evidence": evidence,
        "protectedCorporateAction": protected_action(connection)?,
        "protectedScanResults": scans,
    }))
}

fn verify_post_state(
    connection: &Connection,
    authority: &AuthorityDocument,
    pre: &PreStateSnapshot,
) -> AppResult<(Value, String)> {
    let target_vec = EXACT_PAIRS.iter().map(|pair| pair.target_import_id).collect::<Vec<_>>();
    if !fetch_rows_by_ids(connection, "corporate_action_imports", "id", &target_vec)?.is_empty() {
        return Err("V1.14W redundant targets remain after dry-run transaction.".to_string());
    }

    let owner_vec = EXACT_PAIRS.iter().map(|pair| pair.owner_import_id).collect::<Vec<_>>();
    let mut owners = fetch_rows_by_ids(connection, "corporate_action_imports", "id", &owner_vec)?;
    sort_values_by_i64_id(&mut owners);
    if owners != expected_post_imports(authority) {
        return Err("V1.14W canonical owner rows changed during consolidation.".to_string());
    }

    let mut evidence = fetch_rows_by_ids(
        connection,
        "corporate_action_import_evidence",
        "import_id",
        &owner_vec,
    )?;
    sort_values_by_i64_id(&mut evidence);
    if evidence != expected_post_evidence(authority)? {
        return Err("V1.14W evidence was lost or mutated beyond import_id re-parenting.".to_string());
    }

    for owner in &owner_vec {
        let count = query_json_rows(
            connection,
            "SELECT COUNT(*) AS count FROM corporate_action_import_evidence WHERE import_id=?",
            &[SqlValue::Integer(*owner)],
        )?
        .first()
        .and_then(|row| row.get("count"))
        .and_then(Value::as_i64)
        .ok_or_else(|| "V1.14W could not verify owner evidence count.".to_string())?;
        if count != 2 {
            return Err(format!("V1.14W owner {owner} does not have exactly two evidence rows."));
        }
    }

    if protected_action(connection)? != pre.protected_action {
        return Err(format!(
            "V1.14W protected Corporate Action {} changed.",
            PROTECTED_CORPORATE_ACTION_ID
        ));
    }
    let mut scans = protected_scans(connection)?;
    sort_values_by_i64_id(&mut scans);
    if scans != pre.protected_scans {
        return Err("V1.14W protected scan results changed.".to_string());
    }

    let post_counts = table_counts(connection, authority)?;
    for (table, before) in &pre.table_counts {
        let expected = if table == "corporate_action_imports" {
            before - EXACT_PAIRS.len() as i64
        } else {
            *before
        };
        if post_counts.get(table).copied() != Some(expected) {
            return Err(format!("V1.14W unexpected row-count drift in {table}."));
        }
    }

    let quick = quick_check(connection)?;
    if quick != vec!["ok".to_string()] {
        return Err(format!("V1.14W post-state quick_check failed: {quick:?}"));
    }
    if !foreign_key_check(connection)?.is_empty() {
        return Err("V1.14W post-state foreign_key_check failed.".to_string());
    }

    let state = build_post_state(connection, authority)?;
    let fingerprint = canonical_sha256(&state)?;
    Ok((state, fingerprint))
}

fn compute_apply_plan_fingerprint(post_state_fingerprint: &str) -> AppResult<String> {
    canonical_sha256(&json!({
        "formatVersion": V114W_APPLY_PLAN_FINGERPRINT_VERSION,
        "v114uPlanFingerprint": V114U_PLAN_FINGERPRINT,
        "v114vManifestFingerprint": V114V_MANIFEST_FINGERPRINT,
        "preStateRelevantFingerprint": V114V_RELEVANT_STATE_FINGERPRINT,
        "schemaFingerprint": V114V_SCHEMA_FINGERPRINT,
        "pairs": EXACT_PAIRS,
        "mutation": [
            "UPDATE corporate_action_import_evidence SET import_id=owner WHERE id=target_evidence AND import_id=target",
            "verify target has zero declared or heuristic import-ID dependencies",
            "DELETE FROM corporate_action_imports WHERE id=target",
        ],
        "protectedCorporateActionId": PROTECTED_CORPORATE_ACTION_ID,
        "protectedScanIds": PROTECTED_SCAN_IDS,
        "postStateFingerprint": post_state_fingerprint,
    }))
}

fn execute_consolidation_transaction(
    connection: &mut Connection,
    authority: &AuthorityDocument,
    lock: &PreStateLock,
    fail_after_pair: Option<usize>,
) -> AppResult<(String, String)> {
    execute_consolidation_transaction_with_behavior(
        connection,
        authority,
        lock,
        fail_after_pair,
        TransactionBehavior::Deferred,
        None,
    )
}

pub(super) fn execute_consolidation_transaction_with_behavior(
    connection: &mut Connection,
    authority: &AuthorityDocument,
    lock: &PreStateLock,
    fail_after_pair: Option<usize>,
    behavior: TransactionBehavior,
    required_fingerprints: Option<(&str, &str)>,
) -> AppResult<(String, String)> {
    let transaction = connection
        .transaction_with_behavior(behavior)
        .map_err(|error| error.to_string())?;
    let pre = validate_pre_state(&transaction, authority, lock)?;

    for (index, pair) in EXACT_PAIRS.iter().enumerate() {
        let updated = transaction
            .execute(
                "UPDATE corporate_action_import_evidence SET import_id=? WHERE id=? AND import_id=?",
                params![pair.owner_import_id, pair.target_evidence_id, pair.target_import_id],
            )
            .map_err(|error| error.to_string())?;
        if updated != 1 {
            return Err(format!(
                "V1.14W evidence re-parent rowcount mismatch for target {}: {}.",
                pair.target_import_id, updated
            ));
        }

        if target_has_any_reference(&transaction, pair.target_import_id)? {
            return Err(format!(
                "V1.14W target {} still has dependent state after evidence re-parenting.",
                pair.target_import_id
            ));
        }

        let deleted = transaction
            .execute(
                "DELETE FROM corporate_action_imports WHERE id=?",
                params![pair.target_import_id],
            )
            .map_err(|error| error.to_string())?;
        if deleted != 1 {
            return Err(format!(
                "V1.14W target delete rowcount mismatch for {}: {}.",
                pair.target_import_id, deleted
            ));
        }

        if fail_after_pair == Some(index + 1) {
            return Err(format!(
                "V1.14W_TEST_FORCED_FAILURE_AFTER_PAIR_{}",
                index + 1
            ));
        }
    }

    let (_post_state, post_state_fingerprint) = verify_post_state(&transaction, authority, &pre)?;
    let apply_plan_fingerprint = compute_apply_plan_fingerprint(&post_state_fingerprint)?;

    if let Some((required_post_state, required_apply_plan)) = required_fingerprints {
        if post_state_fingerprint != required_post_state {
            return Err(format!(
                "V1.14X post-state fingerprint drift before commit: expected {}, actual {}.",
                required_post_state, post_state_fingerprint
            ));
        }
        if apply_plan_fingerprint != required_apply_plan {
            return Err(format!(
                "V1.14X Apply-plan fingerprint drift before commit: expected {}, actual {}.",
                required_apply_plan, apply_plan_fingerprint
            ));
        }
    }

    transaction.commit().map_err(|error| error.to_string())?;
    Ok((post_state_fingerprint, apply_plan_fingerprint))
}

pub(super) fn post_state_fingerprint(
    connection: &Connection,
    authority: &AuthorityDocument,
) -> AppResult<String> {
    canonical_sha256(&build_post_state(connection, authority)?)
}

fn parse_required_arg<'a>(values: &'a HashMap<String, String>, key: &str) -> AppResult<&'a str> {
    values
        .get(key)
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("V1.14W requires {key}."))
}

fn parse_maintenance_args(args: impl IntoIterator<Item = String>) -> AppResult<Option<MaintenanceInput>> {
    let args = args.into_iter().collect::<Vec<_>>();
    if !args.iter().any(|arg| arg == V114W_FLAG) {
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
                | "--private-copy-ack"
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
    if mode != V114W_MODE_DRY_RUN {
        return Err(format!(
            "Invalid V1.14W maintenance mode: {mode}. Only dry-run is available."
        ));
    }
    if parse_required_arg(&values, "--private-copy-ack")? != V114W_PRIVATE_COPY_ACK {
        return Err("V1.14W requires the exact private-copy acknowledgement token.".to_string());
    }

    Ok(Some(MaintenanceInput {
        database_file: PathBuf::from(parse_required_arg(&values, "--database-file")?),
        output_path: PathBuf::from(parse_required_arg(&values, "--output")?),
        authority_path: PathBuf::from(parse_required_arg(&values, "--authority")?),
        v114v_manifest_path: PathBuf::from(parse_required_arg(&values, "--v114v-manifest")?),
    }))
}

fn write_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

fn run_maintenance(input: MaintenanceInput) -> AppResult<i32> {
    let authority = load_authority(&input.authority_path)?;
    let manifest = load_manifest(&input.v114v_manifest_path)?;
    ensure_private_database_path(&input.database_file, &manifest.live_database_path)?;
    let (private_main_before, private_wal_before) =
        verify_private_family_before_open(&input.database_file, &manifest)?;
    fs::create_dir_all(&input.output_path).map_err(|error| error.to_string())?;

    let lock = expected_pre_state_lock();

    let mut connection = Connection::open(&input.database_file).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
        .map_err(|error| error.to_string())?;

    let (post_state_fingerprint, apply_plan_fingerprint) =
        execute_consolidation_transaction(&mut connection, &authority, &lock, None)?;

    let quick = quick_check(&connection)?;
    let fk = foreign_key_check(&connection)?;
    let post_state = build_post_state(&connection, &authority)?;
    if canonical_sha256(&post_state)? != post_state_fingerprint {
        return Err("V1.14W post-commit state fingerprint drifted.".to_string());
    }
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|error| error.to_string())?;
    drop(connection);

    let private_main_after = sha256_file(&input.database_file)?;
    let wal_path = sidecar_path(&input.database_file, "-wal");
    let private_wal_after = if wal_path.is_file() {
        sha256_file(&wal_path)?
    } else {
        String::new()
    };

    let result = DryRunResult {
        version: "V1.14W".to_string(),
        result: "PASS".to_string(),
        mode: "PRIVATE_COPY_DRY_RUN_ONLY".to_string(),
        v114u_plan_fingerprint: V114U_PLAN_FINGERPRINT.to_string(),
        v114v_manifest_fingerprint: V114V_MANIFEST_FINGERPRINT.to_string(),
        pre_state_relevant_fingerprint: V114V_RELEVANT_STATE_FINGERPRINT.to_string(),
        schema_fingerprint: V114V_SCHEMA_FINGERPRINT.to_string(),
        post_state_fingerprint,
        apply_plan_fingerprint_version: V114W_APPLY_PLAN_FINGERPRINT_VERSION.to_string(),
        apply_plan_fingerprint,
        private_database_path: input.database_file.to_string_lossy().to_string(),
        private_database_sha256_before: private_main_before,
        private_wal_sha256_before: private_wal_before,
        private_database_sha256_after: private_main_after,
        private_wal_sha256_after: private_wal_after,
        targets_deleted: EXACT_PAIRS.len(),
        evidence_reparented: EXACT_PAIRS.len(),
        evidence_rows_preserved: authority.expected_evidence.len(),
        owners_preserved: owner_ids().len(),
        approved_corporate_action_10947_unchanged: true,
        protected_scan_ids: PROTECTED_SCAN_IDS.to_vec(),
        protected_scans_unchanged: true,
        quick_check: quick,
        foreign_key_violations: fk,
        transaction_committed_on_private_copy: true,
        live_database_writes: 0,
        live_apply_capability: false,
    };

    write_json(&input.output_path.join("v1-14w-dry-run-result.json"), &result)?;
    write_json(
        &input.output_path.join("v1-14w-dry-run-apply-plan-manifest.json"),
        &json!({
            "formatVersion": V114W_APPLY_PLAN_FINGERPRINT_VERSION,
            "version": "V1.14W",
            "status": "PRIVATE_COPY_DRY_RUN_PASS_NO_LIVE_AUTHORIZATION",
            "v114uPlanFingerprint": V114U_PLAN_FINGERPRINT,
            "v114vManifestFingerprint": V114V_MANIFEST_FINGERPRINT,
            "preStateRelevantFingerprint": V114V_RELEVANT_STATE_FINGERPRINT,
            "schemaFingerprint": V114V_SCHEMA_FINGERPRINT,
            "postStateFingerprint": result.post_state_fingerprint.clone(),
            "pairs": EXACT_PAIRS,
            "targetsDeleted": result.targets_deleted,
            "evidenceReparented": result.evidence_reparented,
            "evidenceRowsPreserved": result.evidence_rows_preserved,
            "ownersPreserved": result.owners_preserved,
            "protectedCorporateActionId": PROTECTED_CORPORATE_ACTION_ID,
            "protectedScanIds": PROTECTED_SCAN_IDS,
            "applyPlanFingerprint": result.apply_plan_fingerprint.clone(),
            "liveApplyAuthorized": false,
        }),
    )?;
    fs::write(
        input.output_path.join("v1-14w-dry-run-summary.txt"),
        format!(
            "V1.14W FIVE-PAIR CONTROLLED CONSOLIDATION DRY RUN\n{}\nresult=PASS\nmode=PRIVATE_COPY_DRY_RUN_ONLY\ntargets_deleted={}\nevidence_reparented={}\nevidence_rows_preserved={}\nowners_preserved={}\ncorporate_action_10947_unchanged=true\nprotected_scans_unchanged=true\nquick_check={:?}\nforeign_key_violations={}\npre_state_relevant_fingerprint={}\nschema_fingerprint={}\npost_state_fingerprint={}\napply_plan_fingerprint={}\nlive_database_writes=0\nlive_apply_capability=0\n",
            "=".repeat(72),
            result.targets_deleted,
            result.evidence_reparented,
            result.evidence_rows_preserved,
            result.owners_preserved,
            result.quick_check,
            result.foreign_key_violations.len(),
            result.pre_state_relevant_fingerprint,
            result.schema_fingerprint,
            result.post_state_fingerprint,
            result.apply_plan_fingerprint,
        ),
    )
    .map_err(|error| error.to_string())?;

    println!("[PASS] V1.14W private-copy dry-run transaction committed");
    println!("[PASS] exact five target imports deleted on private copy");
    println!("[PASS] exact five evidence rows re-parented");
    println!("[PASS] all ten evidence rows preserved");
    println!("[PASS] all five canonical owners preserved");
    println!("[PASS] Corporate Action 10947 preserved");
    println!("[PASS] scan results 1736 / 4670 / 5353 preserved");
    println!("[PASS] quick_check = ok");
    println!("[PASS] foreign_key_check = 0");
    println!("[PASS] live database writes = 0");
    println!("[PASS] live Apply capability = 0");
    println!("V1.14W apply-plan fingerprint: {}", result.apply_plan_fingerprint);
    Ok(0)
}

pub(crate) fn try_run_five_pair_consolidation_maintenance(
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
    use tempfile::tempdir;

    fn create_fixture() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                PRAGMA foreign_keys=ON;
                CREATE TABLE corporate_actions (
                    id INTEGER PRIMARY KEY,
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    effective_date TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    factor REAL NOT NULL,
                    isin TEXT
                );
                CREATE TABLE corporate_action_imports (
                    id INTEGER PRIMARY KEY,
                    dedupe_key TEXT NOT NULL UNIQUE,
                    exchange TEXT NOT NULL,
                    source TEXT NOT NULL,
                    symbol TEXT,
                    isin TEXT,
                    company_name TEXT,
                    purpose_raw TEXT NOT NULL,
                    ex_date TEXT,
                    record_date TEXT,
                    action_type TEXT NOT NULL,
                    old_face_value REAL,
                    new_face_value REAL,
                    cash_amount REAL,
                    factor REAL,
                    price_factor REAL,
                    parse_status TEXT NOT NULL,
                    review_status TEXT NOT NULL,
                    message TEXT,
                    approved_corporate_action_id INTEGER REFERENCES corporate_actions(id),
                    imported_at TEXT NOT NULL,
                    approved_at TEXT
                );
                CREATE TABLE corporate_action_import_evidence (
                    id INTEGER PRIMARY KEY,
                    import_id INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
                    source_code TEXT NOT NULL,
                    source_locator TEXT,
                    captured_at TEXT NOT NULL,
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
                    id INTEGER PRIMARY KEY,
                    import_id INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
                    reason TEXT NOT NULL
                );
                CREATE TABLE corporate_action_event_identity_resolutions (
                    id INTEGER PRIMARY KEY,
                    import_id INTEGER NOT NULL UNIQUE REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
                    event_symbol TEXT NOT NULL
                );
                CREATE TABLE scan_runs (id INTEGER PRIMARY KEY);
                CREATE TABLE corporate_action_scan_results (
                    id INTEGER PRIMARY KEY,
                    scan_run_id INTEGER NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
                    corporate_action_import_id INTEGER REFERENCES corporate_action_imports(id),
                    corporate_action_id INTEGER REFERENCES corporate_actions(id),
                    symbol TEXT,
                    exchange TEXT NOT NULL,
                    scan_status TEXT NOT NULL,
                    confidence REAL
                );
                CREATE TABLE historical_capital_action_backfill_run_outcomes (
                    id INTEGER PRIMARY KEY,
                    import_id INTEGER REFERENCES corporate_action_imports(id) ON DELETE SET NULL,
                    evidence_id INTEGER REFERENCES corporate_action_import_evidence(id) ON DELETE SET NULL
                );
                INSERT INTO corporate_actions(id,symbol,exchange,effective_date,action_type,factor,isin)
                VALUES (10947,'ANDHRAPAP','NSE','2024-09-11','SPLIT',5.0,'INE435A01051');
                INSERT INTO scan_runs(id) VALUES (7),(15),(17);
                ",
            )
            .unwrap();

        for pair in EXACT_PAIRS {
            let action_type = if pair.owner_import_id == 9582 { "SPLIT" } else { "DIVIDEND" };
            let cash = match pair.owner_import_id {
                1232 => Some(5.0),
                3799 => Some(7.5),
                6362 => Some(12.5),
                9005 => Some(10.0),
                _ => None,
            };
            let old_fv = if action_type == "SPLIT" { Some(10.0) } else { None };
            let new_fv = if action_type == "SPLIT" { Some(2.0) } else { None };
            let factor = if action_type == "SPLIT" { Some(5.0) } else { None };
            let price_factor = if action_type == "SPLIT" { Some(0.2) } else { None };
            let event_date = match pair.owner_import_id {
                1232 => "2021-07-29",
                3799 => "2022-08-04",
                6362 => "2023-08-04",
                9005 => "2024-08-05",
                _ => "2024-09-11",
            };
            let record_date = match pair.owner_import_id {
                1232 => "2021-07-30",
                3799 => "2022-08-05",
                6362 => "2023-08-04",
                9005 => "2024-08-05",
                _ => "2024-09-11",
            };
            let owner_isin = if pair.owner_import_id == 9582 {
                "INE435A01051"
            } else {
                "INE435A01028"
            };
            let owner_status = if pair.owner_import_id == 9582 { "APPROVED" } else { "UNRESOLVED" };
            let owner_action_id = if pair.owner_import_id == 9582 { Some(10947) } else { None };

            connection.execute(
                "INSERT INTO corporate_action_imports
                (id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,record_date,action_type,old_face_value,new_face_value,cash_amount,factor,price_factor,parse_status,review_status,message,approved_corporate_action_id,imported_at,approved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                params![
                    pair.owner_import_id,
                    format!("owner-{}", pair.owner_import_id),
                    "NSE","NSE_API",Some("ANDHRAPAP"),owner_isin,Some("ANDHRA PAPER LIMITED"),
                    format!("event-{}", pair.owner_import_id),event_date,record_date,action_type,old_fv,new_fv,cash,factor,price_factor,
                    "PARSED",owner_status,"owner",owner_action_id,"2026-06-09",if owner_action_id.is_some(){Some("2026-08-14")}else{None::<&str>}
                ],
            ).unwrap();
            connection.execute(
                "INSERT INTO corporate_action_imports
                (id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,record_date,action_type,old_face_value,new_face_value,cash_amount,factor,price_factor,parse_status,review_status,message,approved_corporate_action_id,imported_at,approved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                params![
                    pair.target_import_id,
                    format!("target-{}", pair.target_import_id),
                    "NSE","NSE_API",None::<&str>,"INE435A01028",Some("ANDHRA PAPER LIMITED"),
                    format!("event-{}", pair.owner_import_id),event_date,record_date,action_type,old_fv,new_fv,cash,factor,price_factor,
                    "PARSED","UNRESOLVED","target",None::<i64>,"2026-06-10",None::<&str>
                ],
            ).unwrap();
            for (evidence_id, import_id, symbol) in [
                (pair.owner_evidence_id, pair.owner_import_id, Some("ANDHRAPAP")),
                (pair.target_evidence_id, pair.target_import_id, None),
            ] {
                connection.execute(
                    "INSERT INTO corporate_action_import_evidence
                    (id,import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,factor_seen,raw_reference,note)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    params![evidence_id,import_id,"NSE_API",format!("src-{evidence_id}"),"2026-06-10",symbol,"INE435A01028","ANDHRA PAPER LIMITED",action_type,event_date,factor,format!("raw-{evidence_id}"),"note"],
                ).unwrap();
            }
        }

        for (id, run) in [(1736, 7), (4670, 15), (5353, 17)] {
            connection.execute(
                "INSERT INTO corporate_action_scan_results
                (id,scan_run_id,corporate_action_import_id,corporate_action_id,symbol,exchange,scan_status,confidence)
                VALUES (?,?,?,?,?,?,?,?)",
                params![id,run,9582,None::<i64>,"ANDHRAPAP","NSE","MATCHED",0.990625],
            ).unwrap();
        }
        connection
    }

    fn authority_from_fixture(connection: &Connection) -> AuthorityDocument {
        let mut imports = fetch_import_rows(connection).unwrap();
        let mut evidence = fetch_evidence_rows(connection).unwrap();
        let mut scans = protected_scans(connection).unwrap();
        sort_values_by_i64_id(&mut imports);
        sort_values_by_i64_id(&mut evidence);
        sort_values_by_i64_id(&mut scans);
        AuthorityDocument {
            format_version: "v1.14v-live-preflight-authority-v1".to_string(),
            authority_source: AuthoritySource {
                v114u_plan_fingerprint: V114U_PLAN_FINGERPRINT.to_string(),
                v114u_result: "PASS".to_string(),
            },
            pairs: EXACT_PAIRS.to_vec(),
            expected_imports: imports,
            expected_evidence: evidence,
            protected_corporate_action: protected_action(connection).unwrap(),
            protected_scan_results: scans,
            expected_relevant_tables: EXPECTED_RELEVANT_TABLES.iter().map(|value| value.to_string()).collect(),
        }
    }

    fn lock_from_fixture(connection: &Connection, authority: &AuthorityDocument) -> PreStateLock {
        let snapshot = snapshot_pre_state(connection, authority).unwrap();
        PreStateLock {
            relevant_state_fingerprint: canonical_sha256(&snapshot.relevant_state).unwrap(),
            schema_fingerprint: canonical_sha256(&snapshot.schema_contract).unwrap(),
        }
    }

    #[test]
    fn v114w_exact_pair_authority_rejects_a_sixth_pair() {
        let connection = create_fixture();
        let mut authority = authority_from_fixture(&connection);
        authority.pairs.push(PairSpec {
            target_import_id: 1,
            owner_import_id: 2,
            target_evidence_id: 1,
            owner_evidence_id: 2,
        });
        assert!(validate_compiled_authority(&authority).unwrap_err().contains("five-pair"));
    }

    #[test]
    fn v114w_prestate_blocks_import_drift() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("UPDATE corporate_action_imports SET message='drift' WHERE id=42737", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_prestate_blocks_evidence_drift() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("UPDATE corporate_action_import_evidence SET note='drift' WHERE id=42737", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_prestate_blocks_new_target_dependency() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("INSERT INTO corporate_action_import_decisions(id,import_id,reason) VALUES (1,42737,'new')", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_prestate_blocks_owner_dependency_drift() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("INSERT INTO corporate_action_import_decisions(id,import_id,reason) VALUES (1,1232,'new')", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_prestate_blocks_protected_action_drift() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("UPDATE corporate_actions SET factor=4.0 WHERE id=10947", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_prestate_blocks_protected_scan_drift() {
        let connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        connection.execute("UPDATE corporate_action_scan_results SET confidence=0.5 WHERE id=1736", []).unwrap();
        assert!(validate_pre_state(&connection, &authority, &lock).is_err());
    }

    #[test]
    fn v114w_transaction_reparents_five_evidence_rows_and_deletes_five_targets() {
        let mut connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        let (post_fingerprint, apply_plan) = execute_consolidation_transaction(&mut connection, &authority, &lock, None).unwrap();
        assert!(!post_fingerprint.is_empty());
        assert!(!apply_plan.is_empty());
        assert_eq!(connection.query_row("SELECT COUNT(*) FROM corporate_action_imports WHERE id IN (42737,42779,42818,42855,42863)", [], |row| row.get::<_,i64>(0)).unwrap(), 0);
        for owner in [1232,3799,6362,9005,9582] {
            assert_eq!(connection.query_row("SELECT COUNT(*) FROM corporate_action_import_evidence WHERE import_id=?", params![owner], |row| row.get::<_,i64>(0)).unwrap(), 2);
        }
        assert_eq!(connection.query_row("SELECT approved_corporate_action_id FROM corporate_action_imports WHERE id=9582", [], |row| row.get::<_,Option<i64>>(0)).unwrap(), Some(10947));
        assert_eq!(connection.query_row("SELECT COUNT(*) FROM corporate_action_scan_results WHERE id IN (1736,4670,5353) AND corporate_action_import_id=9582", [], |row| row.get::<_,i64>(0)).unwrap(), 3);
    }

    #[test]
    fn v114w_forced_mid_transaction_failure_rolls_back_every_pair() {
        let mut connection = create_fixture();
        let authority = authority_from_fixture(&connection);
        let lock = lock_from_fixture(&connection, &authority);
        let before = canonical_sha256(&build_relevant_state(&connection, &authority).unwrap()).unwrap();
        let error = execute_consolidation_transaction(&mut connection, &authority, &lock, Some(3)).unwrap_err();
        assert!(error.contains("FORCED_FAILURE"));
        let after = canonical_sha256(&build_relevant_state(&connection, &authority).unwrap()).unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn v114w_cli_rejects_non_dry_run_mode() {
        let args = vec![
            "app".to_string(), V114W_FLAG.to_string(), "--mode".to_string(), "live".to_string(),
            "--database-file".to_string(), "x".to_string(), "--output".to_string(), "y".to_string(),
            "--authority".to_string(), "a".to_string(), "--v114v-manifest".to_string(), "m".to_string(),
            "--private-copy-ack".to_string(), V114W_PRIVATE_COPY_ACK.to_string(),
        ];
        assert!(parse_maintenance_args(args).unwrap_err().contains("Only dry-run"));
    }

    #[test]
    fn v114w_cli_requires_private_copy_acknowledgement() {
        let args = vec![
            "app".to_string(), V114W_FLAG.to_string(), "--mode".to_string(), "dry-run".to_string(),
            "--database-file".to_string(), "x".to_string(), "--output".to_string(), "y".to_string(),
            "--authority".to_string(), "a".to_string(), "--v114v-manifest".to_string(), "m".to_string(),
            "--private-copy-ack".to_string(), "wrong".to_string(),
        ];
        assert!(parse_maintenance_args(args).unwrap_err().contains("acknowledgement"));
    }

    #[test]
    fn v114w_private_path_guard_rejects_live_database_path() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("market-data.sqlite3");
        fs::write(&path, b"not-sqlite").unwrap();
        assert!(ensure_private_database_path(&path, &path.to_string_lossy()).is_err());
    }
}
