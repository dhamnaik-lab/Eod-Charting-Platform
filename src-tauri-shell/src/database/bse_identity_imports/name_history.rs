//! BSE publishes dated company names by security code. This is not Security ID evidence.
use super::*;
use crate::bhavcopy::bse_price_history::BrowserRequest;
use rusqlite::OptionalExtension;
use serde::Deserialize;
use std::io::Write;
use std::sync::{atomic::AtomicBool, Arc};

const PAGE: &str = "https://www.bseindia.com/corporates/comp_name";
const API: &str =
    "https://api.bseindia.com/BseIndiaAPI/api/GetNameChanges_ng/w?year=&String=&Isnew=";
const MAX_BYTES: usize = 8 * 1024 * 1024;

#[cfg(test)]
mod tests;

#[derive(Clone)]
struct NameScope;
impl BrowserRequest for NameScope {
    fn page_url(&self) -> &'static str {
        PAGE
    }
    fn request_url(&self) -> &str {
        API
    }
    fn matches(&self, raw: &str) -> bool {
        matches!((super::master_transport::canonical(raw), super::master_transport::canonical(API)), (Some(a),Some(b)) if a==b)
    }
    fn permits_resource(&self, raw: &str) -> bool {
        if self.matches(raw) {
            return true;
        }
        let Ok(url) = reqwest::Url::parse(raw) else {
            return false;
        };
        url.scheme() == "https"
            && url.host_str() == Some("www.bseindia.com")
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
            && (raw == PAGE || url.path().starts_with("/assets/") || url.path() == "/env.js")
    }
    fn validate(&self, status: i32, bytes: &[u8]) -> AppResult<usize> {
        if status != 200 || bytes.len() > MAX_BYTES {
            return Err("BSE name-history response rejected.".into());
        }
        let rows = parse_json(bytes)?;
        if rows.len() < 1000 {
            return Err(
                "BSE name-history population is unexpectedly small; previous sources retained."
                    .into(),
            );
        }
        Ok(rows.len())
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameInput {
    pub source_mode: String,
    pub file_path: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameApplyInput {
    #[serde(flatten)]
    pub source: NameInput,
    pub expected_plan_sha256: String,
    pub expected_database_path: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameRow {
    pub security_code: String,
    pub current_id: Option<String>,
    pub old_name: String,
    pub new_name: String,
    pub source_date: String,
    pub outcome: String,
    pub reason: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameResult {
    pub file_path: String,
    pub source_mode: String,
    pub source_sha256: String,
    pub plan_sha256: String,
    pub rows: Vec<NameRow>,
    pub new_name_changes: usize,
    pub duplicate_rows: usize,
    pub skipped_rows: usize,
    pub held_rows: usize,
    pub can_apply: bool,
    pub applied: bool,
    pub run_id: Option<String>,
    pub completed_at: Option<String>,
    pub warning: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameSource {
    pub file_path: String,
    pub source_sha256: String,
    pub rows: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameRun {
    pub run_id: String,
    pub completed_at: String,
    pub new_name_changes: usize,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OfficialRow {
    #[serde(rename = "Scrip_code")]
    code: u64,
    co_oldname: String,
    co_newname: String,
    effective_date: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OfficialResponse {
    #[serde(rename = "Table")]
    table: Vec<OfficialRow>,
}

fn normalize_name(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn source_row(code: &str, old: &str, new: &str, date: &str) -> AppResult<NameRow> {
    let code = code.trim();
    if code.len() != 6
        || !code.bytes().all(|b| b.is_ascii_digit())
        || old.trim().is_empty()
        || new.trim().is_empty()
    {
        return Err(
            "BSE name-history row requires a six-digit security code and both company names."
                .into(),
        );
    }
    let date = chrono::NaiveDate::parse_from_str(date.trim(), "%d %b %Y")
        .or_else(|_| chrono::NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d"))
        .map_err(|_| format!("Invalid BSE name-history date for security {code}: {date}"))?;
    Ok(NameRow {
        security_code: code.into(),
        current_id: None,
        old_name: old.trim().into(),
        new_name: new.trim().into(),
        source_date: date.to_string(),
        outcome: String::new(),
        reason: String::new(),
    })
}
fn parse_json(bytes: &[u8]) -> AppResult<Vec<NameRow>> {
    if bytes.len() > MAX_BYTES {
        return Err("BSE name history exceeds 8 MiB.".into());
    }
    let value: OfficialResponse = serde_json::from_slice(bytes)
        .map_err(|e| format!("BSE name-history schema rejected: {e}"))?;
    value
        .table
        .into_iter()
        .map(|r| {
            source_row(
                &r.code.to_string(),
                &r.co_oldname,
                &r.co_newname,
                &r.effective_date,
            )
        })
        .collect()
}
fn parse_csv(bytes: &[u8]) -> AppResult<Vec<NameRow>> {
    if bytes.len() > MAX_BYTES {
        return Err("BSE name history exceeds 8 MiB.".into());
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|e| e.to_string())?
        .trim_start_matches('\u{feff}');
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());
    let header = reader.headers().map_err(|e| e.to_string())?.clone();
    if header.iter().map(str::trim).collect::<Vec<_>>()
        != ["Security Code", "Old Name", "New Name", "Date"]
    {
        return Err("Expected the official BSE company-name CSV: Security Code,Old Name,New Name,Date. Current-master CSVs are not name history.".into());
    }
    reader
        .records()
        .enumerate()
        .map(|(i, r)| {
            let r = r.map_err(|e| e.to_string())?;
            if r.len() < 4 || r.iter().skip(4).any(|s| !s.trim().is_empty()) {
                return Err(format!(
                    "BSE name CSV row {} has missing or unexpected fields.",
                    i + 2
                ));
            }
            source_row(&r[0], &r[1], &r[2], &r[3])
        })
        .collect()
}
fn event_key(row: &NameRow) -> String {
    hash(
        serde_json::to_string(&(
            &row.security_code,
            &row.source_date,
            normalize_name(&row.old_name),
            normalize_name(&row.new_name),
        ))
        .unwrap()
        .as_bytes(),
    )
}
fn table_exists(connection: &Connection, table: &str) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
            [table],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
}
fn read_source(folder: &Path, input: &NameInput) -> AppResult<(PathBuf, Vec<u8>, Vec<NameRow>)> {
    let official = input.source_mode == "official";
    if !official && input.source_mode != "manual" {
        return Err("Unknown BSE name-history source mode.".into());
    }
    let path = if official {
        if input.file_path.is_some() {
            return Err("Official name history must use the managed official source.".into());
        }
        let directory = folder.join("reference-data/bse/name-history");
        let mut paths = fs::read_dir(&directory)
            .map_err(|_| "Refresh BSE Sources before previewing company-name history.".to_string())?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| {
                p.file_name().and_then(|s| s.to_str()).is_some_and(|s| {
                    s.starts_with("bse-name-history-")
                        && s.ends_with(".json")
                        && !s.ends_with(".manifest.json")
                })
            })
            .collect::<Vec<_>>();
        paths.sort();
        let path = paths
            .pop()
            .ok_or("No saved BSE company-name source. Refresh BSE Sources first.")?;
        let resolved = fs::canonicalize(&path).map_err(|e| e.to_string())?;
        if resolved.parent()
            != Some(
                fs::canonicalize(&directory)
                    .map_err(|e| e.to_string())?
                    .as_path(),
            )
        {
            return Err("BSE managed source path escaped its directory.".into());
        }
        resolved
    } else {
        fs::canonicalize(
            input
                .file_path
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .ok_or("Select a BSE company-name CSV.")?,
        )
        .map_err(|e| e.to_string())?
    };
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let rows = if official {
        NameScope.validate(200, &bytes)?;
        parse_json(&bytes)?
    } else {
        parse_csv(&bytes)?
    };
    if rows.is_empty() {
        return Err("BSE company-name source is empty.".into());
    }
    if official {
        let manifest: serde_json::Value = serde_json::from_slice(
            &fs::read(path.with_extension("manifest.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if manifest["sourceUrl"] != API
            || manifest["pageUrl"] != PAGE
            || manifest["sourceSha256"] != hash(&bytes)
            || manifest["rows"] != rows.len()
        {
            return Err("BSE name-history saved-source provenance mismatch. Refresh again.".into());
        }
    }
    Ok((path, bytes, rows))
}
fn plan(connection: &Connection, folder: &Path, input: &NameInput) -> AppResult<NameResult> {
    let (path, bytes, mut rows) = read_source(folder, input)?;
    let mut stmt=connection.prepare("SELECT symbol,bse_security_code,name,COALESCE(is_active,1) FROM instruments WHERE exchange='BSE' ORDER BY symbol,bse_security_code,name").map_err(|e|e.to_string())?;
    let instruments = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, bool>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut existing = HashSet::<String>::new();
    if table_exists(connection, "bse_name_history_keys")? {
        let mut stmt=connection.prepare("SELECT k.event_key FROM bse_name_history_keys k JOIN instrument_identity_history h ON h.id=k.history_id WHERE h.exchange='BSE' AND h.source='BSE_COMPANY_NAME_HISTORY_V1'").map_err(|e|e.to_string())?;
        for key in stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
        {
            existing.insert(key.map_err(|e| e.to_string())?);
        }
    }
    let mut seen = existing.clone();
    let today = (chrono::Utc::now() + chrono::Duration::seconds(19800))
        .date_naive()
        .to_string();
    for row in &mut rows {
        let matches = instruments
            .iter()
            .filter(|r| r.1.as_deref().map(str::trim) == Some(row.security_code.as_str()))
            .collect::<Vec<_>>();
        row.current_id = if matches.len() == 1 {
            Some(matches[0].0.clone())
        } else {
            None
        };
        let (outcome, reason) = if normalize_name(&row.old_name) == normalize_name(&row.new_name) {
            (
                "SKIPPED",
                "Capitalization/whitespace-only source record; no name transition.",
            )
        } else if row.source_date > today {
            (
                "HELD",
                "Future BSE change date; no history will be applied yet.",
            )
        } else if seen.contains(&event_key(row)) {
            (
                "DUPLICATE",
                "This dated security-code/name record already exists; no new row is required.",
            )
        } else if matches.is_empty() {
            (
                "SKIPPED",
                "No exact BSE security-code match in this database; no trading ID was inferred.",
            )
        } else if matches.len() > 1 {
            (
                "HELD",
                "Multiple database instruments share this security code; review the mapping.",
            )
        } else {
            seen.insert(event_key(row));
            ("NEW","Will save name-only history by exact BSE security code. Trading ID and lifecycle remain unchanged.")
        };
        row.outcome = outcome.into();
        row.reason = reason.into();
    }
    let count = |outcome: &str| rows.iter().filter(|r| r.outcome == outcome).count();
    let mut result = NameResult {
        file_path: path.display().to_string(),
        source_mode: input.source_mode.clone(),
        source_sha256: hash(&bytes),
        plan_sha256: String::new(),
        new_name_changes: count("NEW"),
        duplicate_rows: count("DUPLICATE"),
        skipped_rows: count("SKIPPED"),
        held_rows: count("HELD"),
        can_apply: count("NEW") > 0,
        applied: false,
        run_id: None,
        completed_at: None,
        warning: None,
        rows,
    };
    let mut keys = existing.into_iter().collect::<Vec<_>>();
    keys.sort();
    result.plan_sha256 = hash(
        &serde_json::to_vec(&(
            "BSE_NAME_HISTORY_ONLY_V1",
            folder.display().to_string(),
            &result,
            &instruments,
            keys,
        ))
        .map_err(|e| e.to_string())?,
    );
    Ok(result)
}
fn apply(
    connection: &Connection,
    folder: &Path,
    input: &NameApplyInput,
    report: &dyn Fn(super::super::IdentityApplyProgress),
) -> AppResult<NameResult> {
    report(super::apply_reporting::progress("checking", 0, 0));
    if input.expected_plan_sha256.len() != 64 {
        return Err("Preview the BSE company-name history before Apply.".into());
    }
    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| e.to_string())?;
    let attempt = (|| -> AppResult<NameResult> {
        let mut result = plan(connection, folder, &input.source)?;
        if result.plan_sha256 != input.expected_plan_sha256 {
            return Err("BSE_NAME_REVIEW_STALE: Source or database changed. Preview again.".into());
        }
        if !result.can_apply {
            return Err("No actionable BSE company-name changes.".into());
        }
        connection.execute_batch("CREATE TABLE IF NOT EXISTS bse_name_history_keys(event_key TEXT PRIMARY KEY,history_id INTEGER NOT NULL UNIQUE); CREATE TABLE IF NOT EXISTS bse_name_history_apply_runs(run_id TEXT PRIMARY KEY,completed_at TEXT NOT NULL,new_name_changes INTEGER NOT NULL,result_json TEXT NOT NULL);").map_err(|e|e.to_string())?;
        let total = result.rows.len();
        for (index, row) in result.rows.iter().enumerate() {
            if row.outcome == "NEW" {
                let source_ref = serde_json::json!({"securityCode":row.security_code,"sourceUrl":if input.source.source_mode=="official" {Some(API)}else{None},"pageUrl":PAGE,"sourceMode":input.source.source_mode,"filePath":result.file_path,"sourceSha256":result.source_sha256,"dateMeaning":"BSE published company-name change date; not Security ID transition proof"});
                connection.execute("INSERT INTO instrument_identity_history(exchange,current_symbol,current_name,old_name,new_name,effective_date,change_type,source,source_ref) VALUES('BSE',?,?,?,?,?,'NAME_CHANGE','BSE_COMPANY_NAME_HISTORY_V1',?)",params![row.current_id,row.new_name,row.old_name,row.new_name,row.source_date,source_ref.to_string()]).map_err(|e|e.to_string())?;
                connection
                    .execute(
                        "INSERT INTO bse_name_history_keys VALUES(?,?)",
                        params![event_key(row), connection.last_insert_rowid()],
                    )
                    .map_err(|e| e.to_string())?;
            }
            if index % 25 == 0 || index + 1 == total {
                report(super::apply_reporting::progress(
                    "applying",
                    index + 1,
                    total,
                ));
            }
        }
        result.applied = true;
        result.can_apply = false;
        result.completed_at = Some(chrono::Utc::now().to_rfc3339());
        result.run_id = Some(format!(
            "bse-names-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        connection
            .execute(
                "INSERT INTO bse_name_history_apply_runs VALUES(?,?,?,?)",
                params![
                    result.run_id,
                    result.completed_at,
                    result.new_name_changes,
                    serde_json::to_string(&result).map_err(|e| e.to_string())?
                ],
            )
            .map_err(|e| e.to_string())?;
        report(super::apply_reporting::progress("committing", total, total));
        connection
            .execute_batch("COMMIT")
            .map_err(|e| e.to_string())?;
        report(super::apply_reporting::progress("committed", total, total));
        Ok(result)
    })();
    if attempt.is_err() && !connection.is_autocommit() {
        let _ = connection.execute_batch("ROLLBACK");
    }
    attempt
}

fn save_source(folder: &Path, bytes: &[u8]) -> AppResult<NameSource> {
    let rows = NameScope.validate(200, bytes)?;
    let directory = folder.join("reference-data/bse/name-history");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join(format!(
        "bse-name-history-{}.json",
        chrono::Utc::now().format("%Y%m%d_%H%M%S_%f")
    ));
    let write = |path: &Path, bytes: &[u8]| -> AppResult<()> {
        let mut f = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        f.write_all(bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())
    };
    let partial = path.with_extension("partial");
    write(&partial, bytes)?;
    let sha = hash(bytes);
    let manifest=serde_json::to_vec_pretty(&serde_json::json!({"sourceUrl":API,"pageUrl":PAGE,"sourceSha256":sha,"rows":rows,"fetchedAt":chrono::Utc::now().to_rfc3339(),"coverage":"company names only; no Security ID changes"})).map_err(|e|e.to_string())?;
    write(&path.with_extension("manifest.json"), &manifest)?;
    fs::rename(partial, &path).map_err(|e| e.to_string())?;
    Ok(NameSource {
        file_path: path.display().to_string(),
        source_sha256: sha,
        rows,
    })
}
fn fetch_source(app: &AppHandle) -> AppResult<Vec<u8>> {
    use reqwest::header::{ACCEPT, REFERER, USER_AGENT};
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(API)
        .header(REFERER, PAGE)
        .header(USER_AGENT, BSE_USER_AGENT)
        .header(ACCEPT, "application/json")
        .send()
        .map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let bytes = if status == 403 {
        crate::bhavcopy::bse_price_history::collect_official(
            app.clone(),
            NameScope,
            Arc::new(AtomicBool::new(false)),
        )?
    } else if status == 200 {
        let mut b = Vec::new();
        response
            .take((MAX_BYTES + 1) as u64)
            .read_to_end(&mut b)
            .map_err(|e| e.to_string())?;
        b
    } else {
        return Err(format!(
            "BSE company-name source returned HTTP {status}; saved sources retained."
        ));
    };
    NameScope.validate(200, &bytes)?;
    Ok(bytes)
}
#[tauri::command]
pub async fn refresh_bse_name_history(app: AppHandle) -> AppResult<NameSource> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = super::super::peek_active_database_folder_read_only(&app)?
            .ok_or("Open a database first.")?;
        let bytes = fetch_source(&app)?;
        save_source(&folder, &bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn preview_bse_name_history(app: AppHandle, input: NameInput) -> AppResult<NameResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = super::super::peek_active_database_folder_read_only(&app)?
            .ok_or("Open a database first.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        connection
            .execute_batch("BEGIN")
            .map_err(|e| e.to_string())?;
        plan(&connection, &folder, &input)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn apply_bse_name_history(
    app: AppHandle,
    input: NameApplyInput,
    operation_id: Option<String>,
) -> AppResult<NameResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = resolve_active_database_folder(&app)?.ok_or("Open a database first.")?;
        super::super::check_identity_reviewed_database_path(
            &folder,
            &input.expected_database_path,
        )?;
        let connection = open_connection_for_folder(&folder, false)?;
        let report = |progress| {
            if let Some(id) = &operation_id {
                let _ = app.emit(
                    "identity:apply-progress",
                    serde_json::json!({"operationId":id,"databasePath":folder,"progress":progress}),
                );
            }
        };
        let mut result = apply(&connection, &folder, &input, &report)?;
        // History search metadata changed; instrument identity and price files did not.
        let refresh = (|| -> AppResult<()> {
            invalidate_cached_db_stats(&app, &folder)?;
            let snapshot = get_app_snapshot_internal(
                &app,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app, &snapshot)
        })();
        if let Err(e) = refresh {
            result.warning = Some(format!("Saved; view notification needs retry: {e}"));
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn list_runs(connection: &Connection) -> AppResult<Vec<NameRun>> {
    if !table_exists(connection, "bse_name_history_apply_runs")? {
        return Ok(Vec::new());
    }
    let mut stmt=connection.prepare("SELECT run_id,completed_at,new_name_changes FROM bse_name_history_apply_runs ORDER BY completed_at DESC,run_id DESC LIMIT 50").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(NameRun {
                run_id: r.get(0)?,
                completed_at: r.get(1)?,
                new_name_changes: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn list_bse_name_history_runs(app: AppHandle) -> AppResult<Vec<NameRun>> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = super::super::peek_active_database_folder_read_only(&app)?
            .ok_or("Open a database first.")?;
        list_runs(&super::super::open_read_only_connection_for_folder(
            &folder,
        )?)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn get_bse_name_history_report(app: AppHandle, run_id: String) -> AppResult<NameResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = super::super::peek_active_database_folder_read_only(&app)?
            .ok_or("Open a database first.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        if !table_exists(&connection, "bse_name_history_apply_runs")? {
            return Err("BSE name-history report not found.".into());
        }
        let json = connection
            .query_row(
                "SELECT result_json FROM bse_name_history_apply_runs WHERE run_id=?",
                [run_id],
                |r| r.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .ok_or("BSE name-history report not found.")?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(all(test, windows))]
#[test]
#[ignore = "Explicit official BSE name source discovery; isolated profile and evidence, no database"]
fn native_bse_name_source_proof() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("docs/changes/2026-10-30-bse-name-history")
        .join(format!(
            "native-proof-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
    let profile = root.join("browser-profile");
    fs::create_dir_all(&profile).unwrap();
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    let app = tauri::Builder::default()
        .any_thread()
        .build(context)
        .unwrap();
    let handle = app.handle().clone();
    let evidence = root.clone();
    let worker = std::thread::spawn(move || {
        let result = crate::bhavcopy::bse_price_history::collect_proof(
            handle.clone(),
            NameScope,
            profile,
            Arc::new(AtomicBool::new(false)),
        );
        if let Ok(bytes) = &result {
            fs::write(evidence.join("official-name-history.json"), bytes).unwrap();
        }
        handle.exit(0);
        result.map(|b| b.len())
    });
    app.run_return(|_, event| {
        if let tauri::RunEvent::ExitRequested {
            code: None, api, ..
        } = event
        {
            api.prevent_exit();
        }
    });
    let result = worker.join().unwrap();
    fs::write(
        root.join("proof.json"),
        serde_json::to_vec_pretty(
            &serde_json::json!({"result":result,"databaseOpened":false,"databaseApplied":false}),
        )
        .unwrap(),
    )
    .unwrap();
    println!("{}: {result:?}", root.display());
    result.unwrap();
}
