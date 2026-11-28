use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use tauri::AppHandle;

use super::official_source_candidate_review::{
    compute_er4_configuration_fingerprint, validate_er4_candidate_review_plan_integrity,
    validation_report_json_from_review, Er4CurrentSourceAuthority,
    OfficialSourceCandidateReviewPlan, OfficialSourceRollbackReview, ER4_REVIEW_SCHEMA_VERSION,
    ER4_SOURCE_REGISTRY,
};
use super::official_source_urls::{
    load_legacy_official_source_urls, OfficialSourceUrls, OFFICIAL_SOURCE_URLS_SETTING_KEY,
};
use super::settings::write_setting_value;
use super::{now_iso, with_active_connection, AppResult};

pub(crate) const ER4_LEDGER_CORRUPT: &str = "ER4_LEDGER_CORRUPT";
pub(crate) const ER4_STALE_REJECTED: &str = "ER4_STALE_REJECTED";

const CHANGE_BASELINE: &str = "BASELINE_IMPORT";
const CHANGE_MANUAL: &str = "MANUAL_OVERRIDE";
const CHANGE_PROMOTION: &str = "CANDIDATE_PROMOTION";
const CHANGE_ROLLBACK: &str = "ROLLBACK";
const RESULT_RECORDED: &str = "RECORDED";
const RESULT_PROMOTED: &str = "PROMOTED";
const RESULT_ROLLBACK_COMPLETED: &str = "ROLLBACK_COMPLETED";
const DECISION_KEEP_CURRENT: &str = "KEEP_CURRENT";
const DECISION_REJECT_CANDIDATE: &str = "REJECT_CANDIDATE";
const DECISION_APPROVE_PROMOTION: &str = "APPROVE_PROMOTION";
const DECISION_ROLLBACK_APPROVED: &str = "ROLLBACK_APPROVED";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceAuthorityEntry {
    pub source_key: String,
    pub exchange: String,
    pub source_id: Option<String>,
    pub source_role: Option<String>,
    pub config_field: String,
    pub candidate_promotion_eligible: bool,
    pub current_version_id: i64,
    pub revision: i64,
    pub current_url: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceConfigurationAuthority {
    pub schema_version: u32,
    pub configuration_fingerprint: String,
    pub urls: OfficialSourceUrls,
    pub sources: Vec<OfficialSourceAuthorityEntry>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedOfficialSourceRevision {
    pub source_key: String,
    pub revision: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOfficialSourceUrlsReviewedInput {
    pub expected_configuration_fingerprint: String,
    pub expected_source_revisions: Vec<ExpectedOfficialSourceRevision>,
    pub urls: OfficialSourceUrls,
    pub operator_note: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOfficialSourceUrlsReviewedResult {
    pub success: bool,
    pub changed_source_keys: Vec<String>,
    pub authority: OfficialSourceConfigurationAuthority,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PromotionRevalidationEvidence {
    pub candidate_content_sha256: String,
    pub validation_report_sha256: String,
}

#[derive(Clone, Debug)]
pub(crate) struct CommittedOfficialSourceMutation {
    pub review_event_id: i64,
    pub result_version_id: i64,
    pub authority: OfficialSourceConfigurationAuthority,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct RollbackRevalidationEvidence {
    pub target_content_sha256: String,
    pub target_validation_sha256: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct OfficialSourceVersionRecord {
    pub version_id: i64,
    pub source_key: String,
    pub exchange: String,
    pub source_id: Option<String>,
    pub source_role: Option<String>,
    pub revision: i64,
    pub url: String,
    pub parent_version_id: Option<i64>,
    pub change_kind: String,
}

#[derive(Clone, Debug)]
pub(crate) struct PostHealthRetryContext {
    pub review_event_id: i64,
    pub decision: String,
    pub result_version_id: i64,
    pub authority: OfficialSourceConfigurationAuthority,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceHistoryEntry {
    pub entry_kind: String,
    pub version_id: i64,
    pub revision: i64,
    pub active: bool,
    pub url: String,
    pub change_kind: String,
    pub parent_version_id: Option<i64>,
    pub created_at: String,
    pub candidate_content_sha256: Option<String>,
    pub review_decision: Option<String>,
    pub review_result_status: Option<String>,
    pub result_version_id: Option<i64>,
    pub operator_note: Option<String>,
    pub post_health_status: Option<String>,
}

pub(crate) fn ensure_official_source_version_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS official_source_url_versions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              schema_version INTEGER NOT NULL CHECK (schema_version = 1),
              source_key TEXT NOT NULL,
              exchange TEXT NOT NULL,
              source_id TEXT,
              source_role TEXT,
              source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
              url TEXT NOT NULL,
              parent_version_id INTEGER REFERENCES official_source_url_versions(id),
              batch_id TEXT NOT NULL,
              change_kind TEXT NOT NULL CHECK (
                change_kind IN ('BASELINE_IMPORT','MANUAL_OVERRIDE','CANDIDATE_PROMOTION','ROLLBACK')
              ),
              candidate_content_sha256 TEXT,
              validation_report_sha256 TEXT,
              operator_note TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE (source_key, source_revision)
            );

            CREATE INDEX IF NOT EXISTS idx_official_source_url_versions_source_revision
              ON official_source_url_versions (source_key, source_revision DESC);
            CREATE INDEX IF NOT EXISTS idx_official_source_url_versions_batch_id
              ON official_source_url_versions (batch_id);
            CREATE INDEX IF NOT EXISTS idx_official_source_url_versions_parent_version_id
              ON official_source_url_versions (parent_version_id);

            CREATE TABLE IF NOT EXISTS official_source_url_current (
              source_key TEXT PRIMARY KEY,
              current_version_id INTEGER NOT NULL REFERENCES official_source_url_versions(id),
              revision INTEGER NOT NULL CHECK (revision >= 1),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS official_source_review_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              schema_version INTEGER NOT NULL CHECK (schema_version = 1),
              source_key TEXT NOT NULL,
              source_id TEXT NOT NULL,
              source_role TEXT NOT NULL,
              base_version_id INTEGER NOT NULL REFERENCES official_source_url_versions(id),
              base_revision INTEGER NOT NULL,
              current_url TEXT NOT NULL,
              candidate_url TEXT,
              candidate_final_url TEXT,
              candidate_content_sha256 TEXT,
              validation_report_json TEXT,
              validation_report_sha256 TEXT,
              review_fingerprint TEXT NOT NULL,
              decision TEXT NOT NULL CHECK (
                decision IN ('KEEP_CURRENT','REJECT_CANDIDATE','APPROVE_PROMOTION','ROLLBACK_APPROVED')
              ),
              result_version_id INTEGER REFERENCES official_source_url_versions(id),
              result_status TEXT NOT NULL CHECK (
                result_status IN (
                  'RECORDED',
                  'PROMOTED',
                  'PROMOTED_HEALTHY',
                  'PROMOTED_HEALTH_CHECK_FAILED',
                  'ROLLBACK_COMPLETED',
                  'ROLLBACK_HEALTHY',
                  'ROLLBACK_HEALTH_CHECK_FAILED'
                )
              ),
              operator_note TEXT,
              post_health_configuration_fingerprint TEXT,
              post_health_report_json TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              completed_at TEXT
            );
            ",
        )
        .map_err(|error| error.to_string())
}

fn url_for_config_field<'a>(urls: &'a OfficialSourceUrls, field: &str) -> Result<&'a str, String> {
    match field {
        "nseSecuritiesAvailablePageUrl" => Ok(&urls.nse_securities_available_page_url),
        "nseEquityMasterUrl" => Ok(&urls.nse_equity_master_url),
        "nseSmeMasterUrl" => Ok(&urls.nse_sme_master_url),
        "nseSymbolChangeUrl" => Ok(&urls.nse_symbol_change_url),
        "nseCompanyNameChangeUrl" => Ok(&urls.nse_company_name_change_url),
        "nseDelistedPageUrl" => Ok(&urls.nse_delisted_page_url),
        "nseDelistedWorkbookUrl" => Ok(&urls.nse_delisted_workbook_url),
        "bseListScripsUrlPrefix" => Ok(&urls.bse_list_scrips_url_prefix),
        "bseListScripsReferer" => Ok(&urls.bse_list_scrips_referer),
        _ => Err(format!(
            "{ER4_LEDGER_CORRUPT}: unknown config field '{field}'."
        )),
    }
}

fn set_url_for_config_field(
    urls: &mut OfficialSourceUrls,
    field: &str,
    value: String,
) -> Result<(), String> {
    match field {
        "nseSecuritiesAvailablePageUrl" => urls.nse_securities_available_page_url = value,
        "nseEquityMasterUrl" => urls.nse_equity_master_url = value,
        "nseSmeMasterUrl" => urls.nse_sme_master_url = value,
        "nseSymbolChangeUrl" => urls.nse_symbol_change_url = value,
        "nseCompanyNameChangeUrl" => urls.nse_company_name_change_url = value,
        "nseDelistedPageUrl" => urls.nse_delisted_page_url = value,
        "nseDelistedWorkbookUrl" => urls.nse_delisted_workbook_url = value,
        "bseListScripsUrlPrefix" => urls.bse_list_scrips_url_prefix = value,
        "bseListScripsReferer" => urls.bse_list_scrips_referer = value,
        _ => {
            return Err(format!(
                "{ER4_LEDGER_CORRUPT}: unknown config field '{field}'."
            ))
        }
    }
    Ok(())
}

fn normalize_manual_urls(mut urls: OfficialSourceUrls) -> OfficialSourceUrls {
    let defaults = OfficialSourceUrls::defaults();
    let normalize = |value: &mut String, fallback: &str| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            *value = fallback.to_string();
        } else if trimmed.len() != value.len() {
            *value = trimmed.to_string();
        }
    };
    normalize(
        &mut urls.nse_securities_available_page_url,
        &defaults.nse_securities_available_page_url,
    );
    normalize(
        &mut urls.nse_equity_master_url,
        &defaults.nse_equity_master_url,
    );
    normalize(&mut urls.nse_sme_master_url, &defaults.nse_sme_master_url);
    normalize(
        &mut urls.nse_symbol_change_url,
        &defaults.nse_symbol_change_url,
    );
    normalize(
        &mut urls.nse_company_name_change_url,
        &defaults.nse_company_name_change_url,
    );
    normalize(
        &mut urls.nse_delisted_page_url,
        &defaults.nse_delisted_page_url,
    );
    normalize(
        &mut urls.nse_delisted_workbook_url,
        &defaults.nse_delisted_workbook_url,
    );
    normalize(
        &mut urls.bse_list_scrips_url_prefix,
        &defaults.bse_list_scrips_url_prefix,
    );
    normalize(
        &mut urls.bse_list_scrips_referer,
        &defaults.bse_list_scrips_referer,
    );
    urls
}

pub(crate) fn validate_official_source_ledger_integrity(
    connection: &Connection,
) -> Result<(), String> {
    let current_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM official_source_url_current",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if current_count != ER4_SOURCE_REGISTRY.len() as i64 {
        return Err(format!(
            "{ER4_LEDGER_CORRUPT}: expected {} current rows, found {current_count}.",
            ER4_SOURCE_REGISTRY.len()
        ));
    }

    for entry in ER4_SOURCE_REGISTRY {
        let row = connection
            .query_row(
                "
                SELECT
                  v.source_key,
                  v.exchange,
                  v.source_id,
                  v.source_role,
                  v.source_revision,
                  c.revision
                FROM official_source_url_current c
                JOIN official_source_url_versions v
                  ON v.id = c.current_version_id
                WHERE c.source_key = ?
                ",
                params![entry.source_key],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| {
                format!(
                    "{ER4_LEDGER_CORRUPT}: missing current source '{}'.",
                    entry.source_key
                )
            })?;

        if row.0 != entry.source_key
            || row.1 != entry.exchange
            || row.2.as_deref() != entry.source_id
            || row.3.as_deref() != entry.source_role
            || row.4 != row.5
            || row.4 < 1
        {
            return Err(format!(
                "{ER4_LEDGER_CORRUPT}: invalid current pointer for '{}'.",
                entry.source_key
            ));
        }
    }

    Ok(())
}

pub(crate) fn ensure_official_source_baseline(connection: &Connection) -> Result<(), String> {
    ensure_official_source_version_schema(connection)?;

    let current_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM official_source_url_current",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if current_count == ER4_SOURCE_REGISTRY.len() as i64 {
        return validate_official_source_ledger_integrity(connection);
    }
    if current_count != 0 {
        return Err(format!(
            "{ER4_LEDGER_CORRUPT}: partial current ledger has {current_count} rows."
        ));
    }

    let legacy_urls = load_legacy_official_source_urls(Some(connection));
    let mirror_json = serde_json::to_string(&legacy_urls).map_err(|error| error.to_string())?;
    let batch_id = format!("ER4-BASELINE-{}", now_iso());

    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let result = (|| -> Result<(), String> {
        let versions_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if versions_count != 0 {
            return Err(format!(
                "{ER4_LEDGER_CORRUPT}: baseline requested with {versions_count} existing version rows."
            ));
        }

        for entry in ER4_SOURCE_REGISTRY {
            let url = url_for_config_field(&legacy_urls, entry.config_field)?;
            connection
                .execute(
                    "
                    INSERT INTO official_source_url_versions (
                      schema_version,
                      source_key,
                      exchange,
                      source_id,
                      source_role,
                      source_revision,
                      url,
                      parent_version_id,
                      batch_id,
                      change_kind
                    )
                    VALUES (1, ?, ?, ?, ?, 1, ?, NULL, ?, ?)
                    ",
                    params![
                        entry.source_key,
                        entry.exchange,
                        entry.source_id,
                        entry.source_role,
                        url,
                        batch_id,
                        CHANGE_BASELINE
                    ],
                )
                .map_err(|error| error.to_string())?;
            let version_id = connection.last_insert_rowid();

            connection
                .execute(
                    "
                    INSERT INTO official_source_url_current (
                      source_key,
                      current_version_id,
                      revision,
                      updated_at
                    )
                    VALUES (?, ?, 1, datetime('now'))
                    ",
                    params![entry.source_key, version_id],
                )
                .map_err(|error| error.to_string())?;
        }

        write_setting_value(connection, OFFICIAL_SOURCE_URLS_SETTING_KEY, &mirror_json)?;
        validate_official_source_ledger_integrity(connection)?;
        Ok(())
    })();

    match result {
        Ok(()) => connection
            .execute_batch("COMMIT")
            .map_err(|error| error.to_string()),
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub(crate) fn ensure_official_source_version_bootstrap(
    connection: &Connection,
) -> Result<(), String> {
    ensure_official_source_version_schema(connection)?;
    ensure_official_source_baseline(connection)?;
    validate_official_source_ledger_integrity(connection)
}

fn read_internal_authority_sources(
    connection: &Connection,
) -> Result<Vec<Er4CurrentSourceAuthority>, String> {
    let current_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM official_source_url_current",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if current_count == 0 {
        return Ok(Vec::new());
    }
    validate_official_source_ledger_integrity(connection)?;

    let mut sources = Vec::with_capacity(ER4_SOURCE_REGISTRY.len());
    for entry in ER4_SOURCE_REGISTRY {
        let row = connection
            .query_row(
                "
                SELECT
                  v.id,
                  c.revision,
                  v.url
                FROM official_source_url_current c
                JOIN official_source_url_versions v
                  ON v.id = c.current_version_id
                WHERE c.source_key = ?
                ",
                params![entry.source_key],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .map_err(|error| error.to_string())?;

        sources.push(Er4CurrentSourceAuthority {
            source_key: entry.source_key.to_string(),
            exchange: entry.exchange.to_string(),
            source_id: entry.source_id.map(str::to_string),
            source_role: entry.source_role.map(str::to_string),
            config_field: entry.config_field.to_string(),
            candidate_promotion_eligible: entry.candidate_promotion_eligible,
            current_version_id: row.0,
            revision: row.1,
            current_url: row.2,
        });
    }
    Ok(sources)
}

pub(crate) fn try_load_official_source_urls_from_ledger(
    connection: &Connection,
) -> Result<Option<OfficialSourceUrls>, String> {
    let table_exists: i64 = connection
        .query_row(
            "
            SELECT COUNT(*)
            FROM sqlite_master
            WHERE type = 'table' AND name = 'official_source_url_current'
            ",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if table_exists == 0 {
        return Ok(None);
    }

    let sources = read_internal_authority_sources(connection)?;
    if sources.is_empty() {
        return Ok(None);
    }

    let mut urls = OfficialSourceUrls::defaults();
    for source in sources {
        set_url_for_config_field(&mut urls, &source.config_field, source.current_url)?;
    }
    Ok(Some(urls))
}

pub(crate) fn read_official_source_configuration_authority(
    connection: &Connection,
) -> Result<OfficialSourceConfigurationAuthority, String> {
    validate_official_source_ledger_integrity(connection)?;
    let internal_sources = read_internal_authority_sources(connection)?;
    if internal_sources.len() != ER4_SOURCE_REGISTRY.len() {
        return Err(format!(
            "{ER4_LEDGER_CORRUPT}: current authority is incomplete."
        ));
    }
    let configuration_fingerprint = compute_er4_configuration_fingerprint(&internal_sources)?;
    let urls = try_load_official_source_urls_from_ledger(connection)?
        .ok_or_else(|| format!("{ER4_LEDGER_CORRUPT}: ledger authority is unavailable."))?;
    let sources = internal_sources
        .into_iter()
        .map(|source| OfficialSourceAuthorityEntry {
            source_key: source.source_key,
            exchange: source.exchange,
            source_id: source.source_id,
            source_role: source.source_role,
            config_field: source.config_field,
            candidate_promotion_eligible: source.candidate_promotion_eligible,
            current_version_id: source.current_version_id,
            revision: source.revision,
            current_url: source.current_url,
        })
        .collect();

    Ok(OfficialSourceConfigurationAuthority {
        schema_version: ER4_REVIEW_SCHEMA_VERSION,
        configuration_fingerprint,
        urls,
        sources,
    })
}

pub(crate) fn read_er4_current_source_authority(
    connection: &Connection,
    source_key: &str,
) -> Result<Er4CurrentSourceAuthority, String> {
    let sources = read_internal_authority_sources(connection)?;
    sources
        .into_iter()
        .find(|source| source.source_key == source_key)
        .ok_or_else(|| format!("ER4_SOURCE_NOT_FOUND: '{source_key}'."))
}

#[tauri::command]
pub fn get_official_source_configuration_authority(
    app: AppHandle,
) -> AppResult<OfficialSourceConfigurationAuthority> {
    with_active_connection(&app, read_official_source_configuration_authority)?
        .ok_or_else(|| "Open a database before reading official source authority.".to_string())
}

fn expected_revision_map(
    input: &[ExpectedOfficialSourceRevision],
) -> Result<BTreeMap<&str, i64>, String> {
    if input.len() != ER4_SOURCE_REGISTRY.len() {
        return Err(ER4_STALE_REJECTED.to_string());
    }

    let expected_keys = ER4_SOURCE_REGISTRY
        .iter()
        .map(|entry| entry.source_key)
        .collect::<BTreeSet<_>>();
    let mut values = BTreeMap::new();
    for item in input {
        if !expected_keys.contains(item.source_key.as_str()) {
            return Err(ER4_STALE_REJECTED.to_string());
        }
        if values
            .insert(item.source_key.as_str(), item.revision)
            .is_some()
        {
            return Err(ER4_STALE_REJECTED.to_string());
        }
    }
    if values.len() != expected_keys.len() {
        return Err(ER4_STALE_REJECTED.to_string());
    }
    Ok(values)
}

fn save_official_source_urls_reviewed_internal(
    connection: &Connection,
    input: &SaveOfficialSourceUrlsReviewedInput,
    inject_failure_before_mirror: bool,
) -> Result<SaveOfficialSourceUrlsReviewedResult, String> {
    ensure_official_source_version_schema(connection)?;
    let proposed_urls = normalize_manual_urls(input.urls.clone());
    let expected_revisions = expected_revision_map(&input.expected_source_revisions)?;
    let operator_note = input
        .operator_note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let result = (|| -> Result<SaveOfficialSourceUrlsReviewedResult, String> {
        let current_authority = read_official_source_configuration_authority(connection)?;
        if current_authority.configuration_fingerprint != input.expected_configuration_fingerprint {
            return Err(ER4_STALE_REJECTED.to_string());
        }
        for source in &current_authority.sources {
            if expected_revisions.get(source.source_key.as_str()).copied() != Some(source.revision)
            {
                return Err(ER4_STALE_REJECTED.to_string());
            }
        }

        let batch_id = format!("ER4-MANUAL-{}", now_iso());
        let mut changed_source_keys = Vec::new();

        for entry in ER4_SOURCE_REGISTRY {
            let current = current_authority
                .sources
                .iter()
                .find(|source| source.source_key == entry.source_key)
                .ok_or_else(|| format!("{ER4_LEDGER_CORRUPT}: missing current source."))?;
            let proposed = url_for_config_field(&proposed_urls, entry.config_field)?;
            if proposed == current.current_url.as_str() {
                continue;
            }

            let next_revision = current.revision + 1;
            connection
                .execute(
                    "
                    INSERT INTO official_source_url_versions (
                      schema_version,
                      source_key,
                      exchange,
                      source_id,
                      source_role,
                      source_revision,
                      url,
                      parent_version_id,
                      batch_id,
                      change_kind,
                      operator_note
                    )
                    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ",
                    params![
                        entry.source_key,
                        entry.exchange,
                        entry.source_id,
                        entry.source_role,
                        next_revision,
                        proposed,
                        current.current_version_id,
                        batch_id,
                        CHANGE_MANUAL,
                        operator_note.as_deref()
                    ],
                )
                .map_err(|error| error.to_string())?;
            let version_id = connection.last_insert_rowid();

            connection
                .execute(
                    "
                    UPDATE official_source_url_current
                    SET current_version_id = ?, revision = ?, updated_at = datetime('now')
                    WHERE source_key = ?
                    ",
                    params![version_id, next_revision, entry.source_key],
                )
                .map_err(|error| error.to_string())?;
            changed_source_keys.push(entry.source_key.to_string());
        }

        if inject_failure_before_mirror {
            return Err("ER4_TEST_INJECTED_FAILURE".to_string());
        }

        let refreshed = read_official_source_configuration_authority(connection)?;
        let mirror_json =
            serde_json::to_string(&refreshed.urls).map_err(|error| error.to_string())?;
        write_setting_value(connection, OFFICIAL_SOURCE_URLS_SETTING_KEY, &mirror_json)?;

        Ok(SaveOfficialSourceUrlsReviewedResult {
            success: true,
            changed_source_keys,
            authority: refreshed,
        })
    })();

    match result {
        Ok(value) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| error.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

#[tauri::command]
pub fn save_official_source_urls_reviewed(
    app: AppHandle,
    input: SaveOfficialSourceUrlsReviewedInput,
) -> AppResult<SaveOfficialSourceUrlsReviewedResult> {
    with_active_connection(&app, |connection| {
        save_official_source_urls_reviewed_internal(connection, &input, false)
    })?
    .ok_or_else(|| "Open a database before changing source URLs.".to_string())
}

fn er4_test_inject(inject_after: Option<&str>, marker: &str) -> Result<(), String> {
    if inject_after == Some(marker) {
        return Err(format!("ER4_TEST_INJECTED_FAILURE:{marker}"));
    }
    Ok(())
}

pub(crate) fn promote_official_source_candidate_internal(
    connection: &Connection,
    review: &OfficialSourceCandidateReviewPlan,
    revalidation: &PromotionRevalidationEvidence,
    operator_note: Option<&str>,
    inject_after: Option<&str>,
) -> Result<CommittedOfficialSourceMutation, String> {
    let trimmed_note = operator_note
        .map(str::trim)
        .filter(|value| !value.is_empty());

    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let result = (|| -> Result<CommittedOfficialSourceMutation, String> {
        let current = read_er4_current_source_authority(connection, &review.source_key)?;
        if current.current_version_id != review.base_version_id
            || current.revision != review.base_revision
            || current.current_url != review.current_url
        {
            return Err(ER4_STALE_REJECTED.to_string());
        }

        validate_er4_candidate_review_plan_integrity(review)?;
        if !review.promotable || review.classification != "VALIDATED_CANDIDATE_NOT_PROMOTED" {
            return Err("ER4_PROMOTION_NOT_ELIGIBLE".to_string());
        }
        let reviewed_sha = review
            .candidate_content_sha256
            .as_deref()
            .ok_or_else(|| "ER4_REVIEW_PLAN_INVALID".to_string())?;
        if reviewed_sha != revalidation.candidate_content_sha256
            || review.validation_report_sha256 != revalidation.validation_report_sha256
        {
            return Err("ER4_REVALIDATION_MISMATCH".to_string());
        }
        let validation_json = validation_report_json_from_review(review)?;

        connection
            .execute(
                "
                INSERT INTO official_source_review_events (
                  schema_version, source_key, source_id, source_role,
                  base_version_id, base_revision, current_url,
                  candidate_url, candidate_final_url, candidate_content_sha256,
                  validation_report_json, validation_report_sha256,
                  review_fingerprint, decision, result_version_id,
                  result_status, operator_note, completed_at
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                ",
                params![
                    review.source_key,
                    review.source_id,
                    review.source_role,
                    review.base_version_id,
                    review.base_revision,
                    review.current_url,
                    review.candidate_url,
                    review.candidate_final_url,
                    review.candidate_content_sha256,
                    validation_json,
                    review.validation_report_sha256,
                    review.review_fingerprint,
                    DECISION_APPROVE_PROMOTION,
                    RESULT_PROMOTED,
                    trimmed_note,
                ],
            )
            .map_err(|error| error.to_string())?;
        let review_event_id = connection.last_insert_rowid();
        er4_test_inject(inject_after, "AFTER_REVIEW_EVENT")?;

        let next_revision = current.revision + 1;
        let batch_id = format!("ER4-PROMOTION-{}", now_iso());
        connection
            .execute(
                "
                INSERT INTO official_source_url_versions (
                  schema_version, source_key, exchange, source_id, source_role,
                  source_revision, url, parent_version_id, batch_id, change_kind,
                  candidate_content_sha256, validation_report_sha256, operator_note
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    current.source_key,
                    current.exchange,
                    current.source_id,
                    current.source_role,
                    next_revision,
                    review.candidate_url,
                    current.current_version_id,
                    batch_id,
                    CHANGE_PROMOTION,
                    revalidation.candidate_content_sha256,
                    revalidation.validation_report_sha256,
                    trimmed_note,
                ],
            )
            .map_err(|error| error.to_string())?;
        let result_version_id = connection.last_insert_rowid();
        er4_test_inject(inject_after, "AFTER_VERSION")?;

        connection
            .execute(
                "UPDATE official_source_url_current SET current_version_id=?, revision=?, updated_at=datetime('now') WHERE source_key=?",
                params![result_version_id, next_revision, review.source_key],
            )
            .map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "AFTER_CURRENT_POINTER")?;

        let authority = read_official_source_configuration_authority(connection)?;
        let mirror_json =
            serde_json::to_string(&authority.urls).map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "BEFORE_MIRROR")?;
        write_setting_value(connection, OFFICIAL_SOURCE_URLS_SETTING_KEY, &mirror_json)?;
        er4_test_inject(inject_after, "AFTER_MIRROR")?;

        connection
            .execute(
                "UPDATE official_source_review_events SET result_version_id=?, post_health_configuration_fingerprint=? WHERE id=?",
                params![result_version_id, authority.configuration_fingerprint, review_event_id],
            )
            .map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "AFTER_EVENT_LINK")?;

        Ok(CommittedOfficialSourceMutation {
            review_event_id,
            result_version_id,
            authority,
        })
    })();

    match result {
        Ok(value) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| error.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub(crate) fn read_official_source_version_for_rollback(
    connection: &Connection,
    source_key: &str,
    version_id: i64,
) -> Result<OfficialSourceVersionRecord, String> {
    let row = connection
        .query_row(
            "
            SELECT id, source_key, exchange, source_id, source_role,
                   source_revision, url, parent_version_id, change_kind
            FROM official_source_url_versions
            WHERE id=?
            ",
            params![version_id],
            |row| {
                Ok(OfficialSourceVersionRecord {
                    version_id: row.get(0)?,
                    source_key: row.get(1)?,
                    exchange: row.get(2)?,
                    source_id: row.get(3)?,
                    source_role: row.get(4)?,
                    revision: row.get(5)?,
                    url: row.get(6)?,
                    parent_version_id: row.get(7)?,
                    change_kind: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "ER4_ROLLBACK_TARGET_NOT_FOUND".to_string())?;
    if row.source_key != source_key {
        return Err("ER4_ROLLBACK_TARGET_SOURCE_MISMATCH".to_string());
    }
    Ok(row)
}

pub(crate) fn apply_official_source_rollback_internal(
    connection: &Connection,
    review: &OfficialSourceRollbackReview,
    revalidation: &RollbackRevalidationEvidence,
    operator_note: Option<&str>,
    inject_after: Option<&str>,
) -> Result<CommittedOfficialSourceMutation, String> {
    if review.target_validation_sha256 != revalidation.target_validation_sha256 {
        return Err("ER4_REVALIDATION_MISMATCH".to_string());
    }
    let trimmed_note = operator_note
        .map(str::trim)
        .filter(|value| !value.is_empty());

    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let result = (|| -> Result<CommittedOfficialSourceMutation, String> {
        let current = read_er4_current_source_authority(connection, &review.source_key)?;
        if current.current_version_id != review.current_version_id
            || current.revision != review.current_revision
            || current.current_url != review.current_url
        {
            return Err(ER4_STALE_REJECTED.to_string());
        }
        if !current.candidate_promotion_eligible || current.exchange != "NSE" {
            return Err("ER4_ROLLBACK_NOT_ELIGIBLE".to_string());
        }
        if review.target_version_id == current.current_version_id {
            return Err("ER4_ROLLBACK_TARGET_IS_CURRENT".to_string());
        }
        let target = read_official_source_version_for_rollback(
            connection,
            &review.source_key,
            review.target_version_id,
        )?;
        if target.url != review.target_url
            || target.source_id != current.source_id
            || target.source_role != current.source_role
        {
            return Err("ER4_ROLLBACK_TARGET_CHANGED".to_string());
        }

        connection
            .execute(
                "
                INSERT INTO official_source_review_events (
                  schema_version, source_key, source_id, source_role,
                  base_version_id, base_revision, current_url,
                  candidate_url, candidate_final_url, candidate_content_sha256,
                  validation_report_json, validation_report_sha256,
                  review_fingerprint, decision, result_version_id,
                  result_status, operator_note, completed_at
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, NULL)
                ",
                params![
                    review.source_key,
                    current.source_id.as_deref().unwrap_or_default(),
                    current.source_role.as_deref().unwrap_or_default(),
                    current.current_version_id,
                    current.revision,
                    current.current_url,
                    review.target_url,
                    review.target_url,
                    revalidation.target_content_sha256,
                    revalidation.target_validation_sha256,
                    review.rollback_fingerprint,
                    DECISION_ROLLBACK_APPROVED,
                    RESULT_ROLLBACK_COMPLETED,
                    trimmed_note,
                ],
            )
            .map_err(|error| error.to_string())?;
        let review_event_id = connection.last_insert_rowid();
        er4_test_inject(inject_after, "ROLLBACK_AFTER_REVIEW_EVENT")?;

        let next_revision = current.revision + 1;
        let batch_id = format!("ER4-ROLLBACK-{}", now_iso());
        connection
            .execute(
                "
                INSERT INTO official_source_url_versions (
                  schema_version, source_key, exchange, source_id, source_role,
                  source_revision, url, parent_version_id, batch_id, change_kind,
                  candidate_content_sha256, validation_report_sha256, operator_note
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    current.source_key,
                    current.exchange,
                    current.source_id,
                    current.source_role,
                    next_revision,
                    review.target_url,
                    current.current_version_id,
                    batch_id,
                    CHANGE_ROLLBACK,
                    revalidation.target_content_sha256,
                    revalidation.target_validation_sha256,
                    trimmed_note,
                ],
            )
            .map_err(|error| error.to_string())?;
        let result_version_id = connection.last_insert_rowid();
        er4_test_inject(inject_after, "ROLLBACK_AFTER_VERSION")?;

        connection
            .execute(
                "UPDATE official_source_url_current SET current_version_id=?, revision=?, updated_at=datetime('now') WHERE source_key=?",
                params![result_version_id, next_revision, review.source_key],
            )
            .map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "ROLLBACK_AFTER_CURRENT_POINTER")?;

        let authority = read_official_source_configuration_authority(connection)?;
        let mirror_json =
            serde_json::to_string(&authority.urls).map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "ROLLBACK_BEFORE_MIRROR")?;
        write_setting_value(connection, OFFICIAL_SOURCE_URLS_SETTING_KEY, &mirror_json)?;
        er4_test_inject(inject_after, "ROLLBACK_AFTER_MIRROR")?;

        connection
            .execute(
                "UPDATE official_source_review_events SET result_version_id=?, post_health_configuration_fingerprint=? WHERE id=?",
                params![result_version_id, authority.configuration_fingerprint, review_event_id],
            )
            .map_err(|error| error.to_string())?;
        er4_test_inject(inject_after, "ROLLBACK_AFTER_EVENT_LINK")?;

        Ok(CommittedOfficialSourceMutation {
            review_event_id,
            result_version_id,
            authority,
        })
    })();

    match result {
        Ok(value) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| error.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub(crate) fn read_post_health_retry_context(
    connection: &Connection,
    source_key: &str,
    result_version_id: i64,
) -> Result<PostHealthRetryContext, String> {
    let event = connection
        .query_row(
            "
            SELECT id, decision, result_status, post_health_configuration_fingerprint
            FROM official_source_review_events
            WHERE source_key=? AND result_version_id=?
            ORDER BY id DESC
            LIMIT 1
            ",
            params![source_key, result_version_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "ER4_POST_HEALTH_EVENT_NOT_FOUND".to_string())?;

    if !matches!(
        event.2.as_str(),
        "PROMOTED"
            | "PROMOTED_HEALTH_CHECK_FAILED"
            | "ROLLBACK_COMPLETED"
            | "ROLLBACK_HEALTH_CHECK_FAILED"
    ) {
        return Err("ER4_POST_HEALTH_RETRY_NOT_ALLOWED".to_string());
    }

    let current = read_er4_current_source_authority(connection, source_key)?;
    if current.current_version_id != result_version_id {
        return Err(ER4_STALE_REJECTED.to_string());
    }
    let authority = read_official_source_configuration_authority(connection)?;
    if event.3.as_deref() != Some(authority.configuration_fingerprint.as_str()) {
        return Err(ER4_STALE_REJECTED.to_string());
    }

    Ok(PostHealthRetryContext {
        review_event_id: event.0,
        decision: event.1,
        result_version_id,
        authority,
    })
}

pub(crate) fn update_review_event_post_health_internal(
    connection: &Connection,
    review_event_id: i64,
    configuration_fingerprint: &str,
    report_json: Option<&str>,
    result_status: &str,
) -> Result<(), String> {
    if !matches!(
        result_status,
        "PROMOTED_HEALTHY"
            | "PROMOTED_HEALTH_CHECK_FAILED"
            | "ROLLBACK_HEALTHY"
            | "ROLLBACK_HEALTH_CHECK_FAILED"
    ) {
        return Err("ER4_POST_HEALTH_STATUS_INVALID".to_string());
    }
    let changed = connection
        .execute(
            "
            UPDATE official_source_review_events
            SET result_status=?,
                post_health_configuration_fingerprint=?,
                post_health_report_json=?,
                completed_at=datetime('now')
            WHERE id=?
            ",
            params![
                result_status,
                configuration_fingerprint,
                report_json,
                review_event_id
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("ER4_REVIEW_EVENT_NOT_FOUND".to_string());
    }
    Ok(())
}

pub(crate) fn record_candidate_decision_internal(
    connection: &Connection,
    review: &OfficialSourceCandidateReviewPlan,
    decision: &str,
    operator_note: Option<&str>,
) -> Result<(), String> {
    if decision != DECISION_KEEP_CURRENT && decision != DECISION_REJECT_CANDIDATE {
        return Err("ER4_DECISION_UNSUPPORTED".to_string());
    }
    let trimmed_note = operator_note
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if decision == DECISION_REJECT_CANDIDATE && trimmed_note.is_none() {
        return Err("ER4_REJECTION_NOTE_REQUIRED".to_string());
    }
    let validation_json = validation_report_json_from_review(review)?;

    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let result = (|| -> Result<(), String> {
        let current = read_er4_current_source_authority(connection, &review.source_key)?;
        if current.current_version_id != review.base_version_id
            || current.revision != review.base_revision
            || current.current_url != review.current_url
        {
            return Err(ER4_STALE_REJECTED.to_string());
        }

        validate_er4_candidate_review_plan_integrity(review)?;

        connection
            .execute(
                "
                INSERT INTO official_source_review_events (
                  schema_version,
                  source_key,
                  source_id,
                  source_role,
                  base_version_id,
                  base_revision,
                  current_url,
                  candidate_url,
                  candidate_final_url,
                  candidate_content_sha256,
                  validation_report_json,
                  validation_report_sha256,
                  review_fingerprint,
                  decision,
                  result_version_id,
                  result_status,
                  operator_note,
                  completed_at
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
                ",
                params![
                    review.source_key,
                    review.source_id,
                    review.source_role,
                    review.base_version_id,
                    review.base_revision,
                    review.current_url,
                    review.candidate_url,
                    review.candidate_final_url,
                    review.candidate_content_sha256,
                    validation_json,
                    review.validation_report_sha256,
                    review.review_fingerprint,
                    decision,
                    RESULT_RECORDED,
                    trimmed_note
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    })();

    match result {
        Ok(()) => connection
            .execute_batch("COMMIT")
            .map_err(|error| error.to_string()),
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub(crate) fn list_official_source_history_internal(
    connection: &Connection,
    source_key: &str,
) -> Result<Vec<OfficialSourceHistoryEntry>, String> {
    if !ER4_SOURCE_REGISTRY
        .iter()
        .any(|entry| entry.source_key == source_key)
    {
        return Err(format!("ER4_SOURCE_NOT_FOUND: '{source_key}'."));
    }
    validate_official_source_ledger_integrity(connection)?;

    let active_version_id: i64 = connection
        .query_row(
            "SELECT current_version_id FROM official_source_url_current WHERE source_key = ?",
            params![source_key],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let mut entries: Vec<(String, i64, OfficialSourceHistoryEntry)> = Vec::new();

    {
        let mut statement = connection
            .prepare(
                "
                SELECT
                  id,
                  source_revision,
                  url,
                  change_kind,
                  parent_version_id,
                  created_at,
                  candidate_content_sha256,
                  operator_note
                FROM official_source_url_versions
                WHERE source_key = ?
                ORDER BY source_revision DESC, id DESC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![source_key], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        for row in rows {
            let row = row.map_err(|error| error.to_string())?;
            entries.push((
                row.5.clone(),
                row.0,
                OfficialSourceHistoryEntry {
                    entry_kind: "VERSION".to_string(),
                    version_id: row.0,
                    revision: row.1,
                    active: row.0 == active_version_id,
                    url: row.2,
                    change_kind: row.3,
                    parent_version_id: row.4,
                    created_at: row.5,
                    candidate_content_sha256: row.6,
                    review_decision: None,
                    review_result_status: None,
                    result_version_id: None,
                    operator_note: row.7,
                    post_health_status: None,
                },
            ));
        }
    }

    {
        let mut statement = connection
            .prepare(
                "
                SELECT
                  e.id,
                  e.base_version_id,
                  e.base_revision,
                  e.current_url,
                  e.created_at,
                  e.candidate_content_sha256,
                  e.decision,
                  e.result_status,
                  e.operator_note,
                  e.result_version_id,
                  v.source_revision,
                  v.url
                FROM official_source_review_events e
                LEFT JOIN official_source_url_versions v ON v.id = e.result_version_id
                WHERE e.source_key = ?
                ORDER BY e.id DESC
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![source_key], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<i64>>(9)?,
                    row.get::<_, Option<i64>>(10)?,
                    row.get::<_, Option<String>>(11)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        for row in rows {
            let row = row.map_err(|error| error.to_string())?;
            let post_health_status = if row.7.contains("HEALTH") {
                Some(row.7.clone())
            } else if row.7 == "PROMOTED" || row.7 == "ROLLBACK_COMPLETED" {
                Some("POST_HEALTH_PENDING".to_string())
            } else {
                None
            };
            let result_version_id = row.9;
            let display_version_id = result_version_id.unwrap_or(row.1);
            let display_revision = row.10.unwrap_or(row.2);
            let display_url = row.11.unwrap_or(row.3);
            entries.push((
                row.4.clone(),
                1_000_000_000_i64 + row.0,
                OfficialSourceHistoryEntry {
                    entry_kind: "REVIEW".to_string(),
                    version_id: display_version_id,
                    revision: display_revision,
                    active: result_version_id == Some(active_version_id),
                    url: display_url,
                    change_kind: "REVIEW_EVENT".to_string(),
                    parent_version_id: None,
                    created_at: row.4,
                    candidate_content_sha256: row.5,
                    review_decision: Some(row.6),
                    review_result_status: Some(row.7),
                    result_version_id,
                    operator_note: row.8,
                    post_health_status,
                },
            ));
        }
    }

    entries.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| right.1.cmp(&left.1)));
    Ok(entries.into_iter().map(|(_, _, entry)| entry).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::NamedTempFile;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
            PRAGMA foreign_keys = ON;
            CREATE TABLE settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            ",
            )
            .unwrap();
        connection
    }

    fn authority_input(
        authority: &OfficialSourceConfigurationAuthority,
        urls: OfficialSourceUrls,
    ) -> SaveOfficialSourceUrlsReviewedInput {
        SaveOfficialSourceUrlsReviewedInput {
            expected_configuration_fingerprint: authority.configuration_fingerprint.clone(),
            expected_source_revisions: authority
                .sources
                .iter()
                .map(|source| ExpectedOfficialSourceRevision {
                    source_key: source.source_key.clone(),
                    revision: source.revision,
                })
                .collect(),
            urls,
            operator_note: Some("manual test".to_string()),
        }
    }

    #[test]
    fn er4b_baseline_clean_db_creates_exact_nine_versions_pointers_and_full_mirror() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            9
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_current",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            9
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(DISTINCT batch_id) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            1
        );
        assert_eq!(
            connection.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='official_source_review_events'",
                [],
                |row| row.get::<_, i64>(0),
            ).unwrap(),
            1
        );
        let mirror = super::super::settings::read_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
        )
        .unwrap()
        .unwrap();
        let parsed: OfficialSourceUrls = serde_json::from_str(&mirror).unwrap();
        assert_eq!(parsed, OfficialSourceUrls::defaults());
        validate_official_source_ledger_integrity(&connection).unwrap();
    }

    #[test]
    fn er4b_bootstrap_installs_ledger_and_preserves_default_seeding() {
        let connection = Connection::open_in_memory().unwrap();
        super::super::bootstrap::prepare_database_connection(&connection).unwrap();

        validate_official_source_ledger_integrity(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        assert_eq!(authority.sources.len(), 9);
        assert!(authority.sources.iter().all(|source| source.revision == 1));
        assert_eq!(
            super::super::settings::read_setting_value(&connection, "price_storage_mode")
                .unwrap()
                .as_deref(),
            Some("hybrid")
        );
    }

    #[test]
    fn er4b_baseline_preserves_partial_legacy_override_and_malformed_uses_defaults() {
        let connection = test_connection();
        write_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
            r#"{"nseEquityMasterUrl":" https://example.invalid/custom.csv "}"#,
        )
        .unwrap();
        ensure_official_source_baseline(&connection).unwrap();
        let urls = try_load_official_source_urls_from_ledger(&connection)
            .unwrap()
            .unwrap();
        assert_eq!(
            urls.nse_equity_master_url,
            "https://example.invalid/custom.csv"
        );
        assert_eq!(
            urls.nse_symbol_change_url,
            OfficialSourceUrls::defaults().nse_symbol_change_url
        );

        let malformed = test_connection();
        write_setting_value(&malformed, OFFICIAL_SOURCE_URLS_SETTING_KEY, "{bad json").unwrap();
        ensure_official_source_baseline(&malformed).unwrap();
        assert_eq!(
            try_load_official_source_urls_from_ledger(&malformed)
                .unwrap()
                .unwrap(),
            OfficialSourceUrls::defaults()
        );
    }

    #[test]
    fn er4b_baseline_is_idempotent_and_partial_current_state_fails_closed() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        ensure_official_source_baseline(&connection).unwrap();
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            9
        );

        let corrupt = test_connection();
        ensure_official_source_version_schema(&corrupt).unwrap();
        corrupt.execute(
            "INSERT INTO official_source_url_versions (schema_version,source_key,exchange,source_revision,url,batch_id,change_kind) VALUES (1,'NSE_SECURITIES_AVAILABLE_PAGE','NSE',1,'x','b','BASELINE_IMPORT')",
            [],
        ).unwrap();
        let id = corrupt.last_insert_rowid();
        corrupt.execute(
            "INSERT INTO official_source_url_current (source_key,current_version_id,revision) VALUES ('NSE_SECURITIES_AVAILABLE_PAGE',?,1)",
            params![id],
        ).unwrap();
        let error = ensure_official_source_baseline(&corrupt).unwrap_err();
        assert!(error.contains(ER4_LEDGER_CORRUPT));
        assert_eq!(
            corrupt
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_current",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            1
        );
    }

    #[test]
    fn er4b_authority_read_is_registry_ordered_deterministic_and_ledger_preferred() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let first = read_official_source_configuration_authority(&connection).unwrap();
        let second = read_official_source_configuration_authority(&connection).unwrap();
        assert_eq!(first.sources.len(), 9);
        assert_eq!(
            first.configuration_fingerprint,
            second.configuration_fingerprint
        );
        assert_eq!(
            first
                .sources
                .iter()
                .map(|item| item.source_key.as_str())
                .collect::<Vec<_>>(),
            ER4_SOURCE_REGISTRY
                .iter()
                .map(|item| item.source_key)
                .collect::<Vec<_>>()
        );

        write_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
            r#"{"nseEquityMasterUrl":"https://example.invalid/mirror-only.csv"}"#,
        )
        .unwrap();
        let loaded = try_load_official_source_urls_from_ledger(&connection)
            .unwrap()
            .unwrap();
        assert_eq!(
            loaded.nse_equity_master_url,
            OfficialSourceUrls::defaults().nse_equity_master_url
        );
    }

    #[test]
    fn er4b_manual_noop_creates_no_new_version_or_revision() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let result = save_official_source_urls_reviewed_internal(
            &connection,
            &authority_input(&authority, authority.urls.clone()),
            false,
        )
        .unwrap();
        assert!(result.changed_source_keys.is_empty());
        let after: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(before, after);
        assert!(result
            .authority
            .sources
            .iter()
            .all(|source| source.revision == 1));
    }

    #[test]
    fn er4b_manual_one_and_multi_field_edits_are_versioned_atomically_with_one_batch() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let mut urls = authority.urls.clone();
        urls.nse_equity_master_url = "https://example.invalid/equity.csv".to_string();
        let one = save_official_source_urls_reviewed_internal(
            &connection,
            &authority_input(&authority, urls),
            false,
        )
        .unwrap();
        assert_eq!(one.changed_source_keys, vec!["NSE_CURRENT_EQUITY_MASTER"]);
        let equity = one
            .authority
            .sources
            .iter()
            .find(|source| source.source_key == "NSE_CURRENT_EQUITY_MASTER")
            .unwrap();
        assert_eq!(equity.revision, 2);

        let authority = one.authority;
        let mut urls = authority.urls.clone();
        urls.nse_symbol_change_url = "https://example.invalid/symbol.csv".to_string();
        urls.nse_company_name_change_url = "https://example.invalid/name.csv".to_string();
        let multi = save_official_source_urls_reviewed_internal(
            &connection,
            &authority_input(&authority, urls),
            false,
        )
        .unwrap();
        assert_eq!(multi.changed_source_keys.len(), 2);
        let distinct_batches: i64 = connection.query_row(
            "SELECT COUNT(DISTINCT batch_id) FROM official_source_url_versions WHERE source_revision = 2 AND source_key IN ('NSE_SYMBOL_CHANGE_HISTORY','NSE_COMPANY_NAME_CHANGE_HISTORY')",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(distinct_batches, 1);
        let mirror = super::super::settings::read_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            serde_json::from_str::<OfficialSourceUrls>(&mirror).unwrap(),
            multi.authority.urls
        );
    }

    #[test]
    fn er4b_manual_stale_revision_or_fingerprint_rejects_with_zero_write() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let mut stale = authority_input(&authority, authority.urls.clone());
        stale.expected_configuration_fingerprint = "STALE".to_string();
        assert_eq!(
            save_official_source_urls_reviewed_internal(&connection, &stale, false).unwrap_err(),
            ER4_STALE_REJECTED
        );
        let mut stale_revision = authority_input(&authority, authority.urls.clone());
        stale_revision.expected_source_revisions[0].revision += 1;
        assert_eq!(
            save_official_source_urls_reviewed_internal(&connection, &stale_revision, false)
                .unwrap_err(),
            ER4_STALE_REJECTED
        );
        let after: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn er4b_manual_failure_injection_rolls_back_versions_pointers_and_mirror() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let mirror_before = super::super::settings::read_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
        )
        .unwrap()
        .unwrap();
        let before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let mut urls = authority.urls.clone();
        urls.nse_equity_master_url = "https://example.invalid/fail.csv".to_string();
        let error = save_official_source_urls_reviewed_internal(
            &connection,
            &authority_input(&authority, urls),
            true,
        )
        .unwrap_err();
        assert_eq!(error, "ER4_TEST_INJECTED_FAILURE");
        let after: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(before, after);
        assert_eq!(
            super::super::settings::read_setting_value(
                &connection,
                OFFICIAL_SOURCE_URLS_SETTING_KEY
            )
            .unwrap()
            .unwrap(),
            mirror_before
        );
        assert_eq!(
            read_official_source_configuration_authority(&connection)
                .unwrap()
                .configuration_fingerprint,
            authority.configuration_fingerprint
        );
    }

    #[test]
    fn er4b_manual_save_preserves_existing_manual_acceptance_without_new_provenance_gate() {
        let connection = test_connection();
        ensure_official_source_baseline(&connection).unwrap();
        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let mut urls = authority.urls.clone();
        urls.nse_equity_master_url = "http://not-official.example/manual.csv".to_string();
        let result = save_official_source_urls_reviewed_internal(
            &connection,
            &authority_input(&authority, urls),
            false,
        )
        .unwrap();
        assert_eq!(
            result.authority.urls.nse_equity_master_url,
            "http://not-official.example/manual.csv"
        );
    }

    #[test]
    fn er4b_restart_persists_lineage_current_pointer_and_mirror() {
        let file = NamedTempFile::new().unwrap();
        {
            let connection = Connection::open(file.path()).unwrap();
            connection.execute_batch(
                "PRAGMA foreign_keys=ON; CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));"
            ).unwrap();
            ensure_official_source_baseline(&connection).unwrap();
            let authority = read_official_source_configuration_authority(&connection).unwrap();
            let mut urls = authority.urls.clone();
            urls.nse_sme_master_url = "https://example.invalid/sme.csv".to_string();
            save_official_source_urls_reviewed_internal(
                &connection,
                &authority_input(&authority, urls),
                false,
            )
            .unwrap();
        }
        let reopened = Connection::open(file.path()).unwrap();
        reopened.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        validate_official_source_ledger_integrity(&reopened).unwrap();
        let authority = read_official_source_configuration_authority(&reopened).unwrap();
        let source = authority
            .sources
            .iter()
            .find(|source| source.source_key == "NSE_CURRENT_SME_MASTER")
            .unwrap();
        assert_eq!(source.revision, 2);
        assert_eq!(
            authority.urls.nse_sme_master_url,
            "https://example.invalid/sme.csv"
        );
    }
}

#[cfg(test)]
mod er4c_decision_tests {
    use super::super::official_source_candidate_review::build_er4_candidate_review_plan;
    use super::super::official_source_candidate_validation::{
        Er3bCandidateValidationResult, ER3B_CLASS_VALIDATED,
    };
    use super::*;
    use rusqlite::Connection;
    use tempfile::NamedTempFile;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
            PRAGMA foreign_keys = ON;
            CREATE TABLE settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            ",
            )
            .unwrap();
        ensure_official_source_baseline(&connection).unwrap();
        connection
    }

    fn review_for(connection: &Connection) -> OfficialSourceCandidateReviewPlan {
        let base =
            read_er4_current_source_authority(connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let candidate = Er3bCandidateValidationResult {
            source_id: base.source_id.clone().unwrap(),
            source_role: base.source_role.clone().unwrap(),
            configured_url: base.current_url.clone(),
            landing_page_url:
                "https://www.nseindia.com/static/market-data/securities-available-for-trading"
                    .to_string(),
            candidate_url:
                "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                    .to_string(),
            discovery_reason: "SOURCE_ROLE_MATCH".to_string(),
            request_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                .to_string(),
            final_url: Some(
                "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                    .to_string(),
            ),
            http_status: Some(200),
            content_type: Some("text/csv".to_string()),
            response_bytes: Some(1024),
            content_sha256: Some("ABCDEF0123456789".to_string()),
            parser_status: "PASS".to_string(),
            schema_status: "PASS".to_string(),
            population_status: "PASS".to_string(),
            population_count: Some(2000),
            freshness_status: "NOT_APPLICABLE".to_string(),
            validation_reason: "ER3B_SOURCE_CONTRACT_VALIDATED".to_string(),
            classification: ER3B_CLASS_VALIDATED.to_string(),
        };
        build_er4_candidate_review_plan(&base, &candidate).unwrap()
    }

    #[test]
    fn er4c_keep_current_persists_one_event_without_version_or_mirror_change() {
        let connection = test_connection();
        let review = review_for(&connection);
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let mirror_before = super::super::settings::read_setting_value(
            &connection,
            OFFICIAL_SOURCE_URLS_SETTING_KEY,
        )
        .unwrap()
        .unwrap();

        record_candidate_decision_internal(
            &connection,
            &review,
            DECISION_KEEP_CURRENT,
            Some("keep current"),
        )
        .unwrap();

        let events: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_review_events WHERE decision='KEEP_CURRENT'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(events, 1);
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            versions_before
        );
        assert_eq!(
            super::super::settings::read_setting_value(
                &connection,
                OFFICIAL_SOURCE_URLS_SETTING_KEY
            )
            .unwrap()
            .unwrap(),
            mirror_before
        );
    }

    #[test]
    fn er4c_reject_requires_nonempty_note_and_persists_no_url_version() {
        let connection = test_connection();
        let review = review_for(&connection);
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            record_candidate_decision_internal(
                &connection,
                &review,
                DECISION_REJECT_CANDIDATE,
                Some("   ")
            )
            .unwrap_err(),
            "ER4_REJECTION_NOTE_REQUIRED"
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_review_events",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );

        record_candidate_decision_internal(
            &connection,
            &review,
            DECISION_REJECT_CANDIDATE,
            Some("bad candidate"),
        )
        .unwrap();
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            versions_before
        );
        let note: String = connection.query_row(
            "SELECT operator_note FROM official_source_review_events WHERE decision='REJECT_CANDIDATE'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(note, "bad candidate");
    }

    #[test]
    fn er4c_stale_decision_rejects_with_zero_review_event() {
        let connection = test_connection();
        let mut review = review_for(&connection);
        review.base_revision += 1;
        assert_eq!(
            record_candidate_decision_internal(&connection, &review, DECISION_KEEP_CURRENT, None)
                .unwrap_err(),
            ER4_STALE_REJECTED
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_review_events",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn er4c_history_returns_versions_and_review_events_newest_first() {
        let connection = test_connection();
        let review = review_for(&connection);
        record_candidate_decision_internal(
            &connection,
            &review,
            DECISION_KEEP_CURRENT,
            Some("evidence reviewed"),
        )
        .unwrap();

        let history =
            list_official_source_history_internal(&connection, "NSE_CURRENT_EQUITY_MASTER")
                .unwrap();
        assert!(history.iter().any(|entry| {
            entry.entry_kind == "VERSION" && entry.change_kind == "BASELINE_IMPORT"
        }));
        assert!(history.iter().any(|entry| {
            entry.entry_kind == "REVIEW"
                && entry.review_decision.as_deref() == Some("KEEP_CURRENT")
                && entry.review_result_status.as_deref() == Some("RECORDED")
        }));
        assert!(history.iter().all(|entry| !entry.url.is_empty()));
    }

    #[test]
    fn er4c_decision_and_history_survive_reopen() {
        let file = NamedTempFile::new().unwrap();
        {
            let connection = Connection::open(file.path()).unwrap();
            connection.execute_batch(
                "PRAGMA foreign_keys=ON; CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));"
            ).unwrap();
            ensure_official_source_baseline(&connection).unwrap();
            let review = review_for(&connection);
            record_candidate_decision_internal(
                &connection,
                &review,
                DECISION_REJECT_CANDIDATE,
                Some("persistent rejection"),
            )
            .unwrap();
        }
        let reopened = Connection::open(file.path()).unwrap();
        reopened.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        let history =
            list_official_source_history_internal(&reopened, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        assert!(history.iter().any(|entry| {
            entry.review_decision.as_deref() == Some("REJECT_CANDIDATE")
                && entry.operator_note.as_deref() == Some("persistent rejection")
        }));
    }
}

#[cfg(test)]
mod er4d_promotion_tests {
    use super::super::official_source_candidate_review::build_er4_candidate_review_plan;
    use super::super::official_source_candidate_validation::{
        Er3bCandidateValidationResult, ER3B_CLASS_VALIDATED,
    };
    use super::*;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "PRAGMA foreign_keys=ON; CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));"
        ).unwrap();
        ensure_official_source_baseline(&connection).unwrap();
        connection
    }

    fn validated_review(connection: &Connection) -> OfficialSourceCandidateReviewPlan {
        let base =
            read_er4_current_source_authority(connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        build_er4_candidate_review_plan(
            &base,
            &Er3bCandidateValidationResult {
                source_id: base.source_id.clone().unwrap(),
                source_role: base.source_role.clone().unwrap(),
                configured_url: base.current_url.clone(),
                landing_page_url:
                    "https://www.nseindia.com/static/market-data/securities-available-for-trading"
                        .to_string(),
                candidate_url:
                    "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                        .to_string(),
                discovery_reason: "SOURCE_ROLE_MATCH".to_string(),
                request_url:
                    "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                        .to_string(),
                final_url: Some(
                    "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv"
                        .to_string(),
                ),
                http_status: Some(200),
                content_type: Some("text/csv".to_string()),
                response_bytes: Some(4096),
                content_sha256: Some("ABCD0123456789EF".to_string()),
                parser_status: "PASS".to_string(),
                schema_status: "PASS".to_string(),
                population_status: "PASS".to_string(),
                population_count: Some(2000),
                freshness_status: "NOT_APPLICABLE".to_string(),
                validation_reason: "ER3B_SOURCE_CONTRACT_VALIDATED".to_string(),
                classification: ER3B_CLASS_VALIDATED.to_string(),
            },
        )
        .unwrap()
    }

    #[test]
    fn er4d_atomic_promotion_creates_one_version_updates_pointer_and_mirror() {
        let connection = connection();
        let review = validated_review(&connection);
        let result = promote_official_source_candidate_internal(
            &connection,
            &review,
            &PromotionRevalidationEvidence {
                candidate_content_sha256: review.candidate_content_sha256.clone().unwrap(),
                validation_report_sha256: review.validation_report_sha256.clone(),
            },
            Some("approved replacement"),
            None,
        )
        .unwrap();

        assert_eq!(
            result.authority.urls.nse_equity_master_url,
            review.candidate_url
        );
        let current = read_er4_current_source_authority(&connection, &review.source_key).unwrap();
        assert_eq!(current.revision, review.base_revision + 1);
        assert_eq!(current.current_version_id, result.result_version_id);
        let change_kind: String = connection
            .query_row(
                "SELECT change_kind FROM official_source_url_versions WHERE id=?",
                params![result.result_version_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(change_kind, "CANDIDATE_PROMOTION");
    }

    #[test]
    fn er4d_changed_candidate_sha_rejects_before_write() {
        let connection = connection();
        let review = validated_review(&connection);
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let error = promote_official_source_candidate_internal(
            &connection,
            &review,
            &PromotionRevalidationEvidence {
                candidate_content_sha256: "CHANGED".to_string(),
                validation_report_sha256: review.validation_report_sha256.clone(),
            },
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(error, "ER4_REVALIDATION_MISMATCH");
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            versions_before
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_review_events",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn er4d_stale_promotion_rejects_with_zero_write() {
        let connection = connection();
        let mut review = validated_review(&connection);
        review.base_revision += 1;
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let error = promote_official_source_candidate_internal(
            &connection,
            &review,
            &PromotionRevalidationEvidence {
                candidate_content_sha256: review.candidate_content_sha256.clone().unwrap(),
                validation_report_sha256: review.validation_report_sha256.clone(),
            },
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(error, ER4_STALE_REJECTED);
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            versions_before
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_review_events",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn er4d_promotion_failure_injection_rolls_back_every_boundary() {
        for marker in [
            "AFTER_REVIEW_EVENT",
            "AFTER_VERSION",
            "AFTER_CURRENT_POINTER",
            "BEFORE_MIRROR",
            "AFTER_MIRROR",
            "AFTER_EVENT_LINK",
        ] {
            let connection = connection();
            let review = validated_review(&connection);
            let versions_before: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            let authority_before =
                read_official_source_configuration_authority(&connection).unwrap();
            let mirror_before = super::super::settings::read_setting_value(
                &connection,
                OFFICIAL_SOURCE_URLS_SETTING_KEY,
            )
            .unwrap()
            .unwrap();

            let error = promote_official_source_candidate_internal(
                &connection,
                &review,
                &PromotionRevalidationEvidence {
                    candidate_content_sha256: review.candidate_content_sha256.clone().unwrap(),
                    validation_report_sha256: review.validation_report_sha256.clone(),
                },
                None,
                Some(marker),
            )
            .unwrap_err();
            assert!(error.contains("ER4_TEST_INJECTED_FAILURE"));
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM official_source_url_versions",
                        [],
                        |row| row.get::<_, i64>(0)
                    )
                    .unwrap(),
                versions_before
            );
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM official_source_review_events",
                        [],
                        |row| row.get::<_, i64>(0)
                    )
                    .unwrap(),
                0
            );
            assert_eq!(
                read_official_source_configuration_authority(&connection).unwrap(),
                authority_before
            );
            assert_eq!(
                super::super::settings::read_setting_value(
                    &connection,
                    OFFICIAL_SOURCE_URLS_SETTING_KEY
                )
                .unwrap()
                .unwrap(),
                mirror_before
            );
        }
    }

    #[test]
    fn er4d_changed_validation_report_hash_rejects_before_write() {
        let connection = connection();
        let review = validated_review(&connection);
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let error = promote_official_source_candidate_internal(
            &connection,
            &review,
            &PromotionRevalidationEvidence {
                candidate_content_sha256: review.candidate_content_sha256.clone().unwrap(),
                validation_report_sha256: "CHANGED_VALIDATION_REPORT_SHA".to_string(),
            },
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(error, "ER4_REVALIDATION_MISMATCH");
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
            versions_before
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_review_events",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
            0
        );
    }
}

#[cfg(test)]
mod er4e_rollback_tests {
    use super::super::official_source_candidate_review::OfficialSourceRollbackReview;
    use super::*;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "PRAGMA foreign_keys=ON; CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));"
        ).unwrap();
        ensure_official_source_baseline(&connection).unwrap();
        connection
    }

    fn make_manual_version(connection: &Connection) -> (i64, i64, String, i64) {
        let baseline = read_official_source_configuration_authority(connection).unwrap();
        let source = baseline
            .sources
            .iter()
            .find(|entry| entry.source_key == "NSE_CURRENT_EQUITY_MASTER")
            .unwrap();
        let target_version_id = source.current_version_id;
        let target_url = source.current_url.clone();
        let mut urls = baseline.urls.clone();
        urls.nse_equity_master_url =
            "https://nsearchives.nseindia.com/content/equities/EQUITY_ALT.csv".to_string();
        let input = SaveOfficialSourceUrlsReviewedInput {
            expected_configuration_fingerprint: baseline.configuration_fingerprint.clone(),
            expected_source_revisions: baseline
                .sources
                .iter()
                .map(|entry| ExpectedOfficialSourceRevision {
                    source_key: entry.source_key.clone(),
                    revision: entry.revision,
                })
                .collect(),
            urls,
            operator_note: Some("test manual version".to_string()),
        };
        let changed =
            save_official_source_urls_reviewed_internal(connection, &input, false).unwrap();
        let current = changed
            .authority
            .sources
            .iter()
            .find(|entry| entry.source_key == "NSE_CURRENT_EQUITY_MASTER")
            .unwrap();
        (
            target_version_id,
            current.current_version_id,
            target_url,
            current.revision,
        )
    }

    #[test]
    fn er4e_rollback_creates_new_version_and_preserves_target_and_current_history() {
        let connection = connection();
        let (target_version_id, current_version_id, target_url, current_revision) =
            make_manual_version(&connection);
        let current =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let review = OfficialSourceRollbackReview {
            schema_version: 1,
            source_key: current.source_key.clone(),
            current_version_id,
            current_revision,
            current_url: current.current_url.clone(),
            target_version_id,
            target_url: target_url.clone(),
            target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            rollback_fingerprint: "ROLLBACK_FINGERPRINT".to_string(),
        };
        let result = apply_official_source_rollback_internal(
            &connection,
            &review,
            &RollbackRevalidationEvidence {
                target_content_sha256: "TARGET_CONTENT_SHA".to_string(),
                target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            },
            Some("operator rollback"),
            None,
        )
        .unwrap();
        let current_after =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        assert_eq!(current_after.current_version_id, result.result_version_id);
        assert_eq!(current_after.revision, current_revision + 1);
        assert_eq!(current_after.current_url, target_url);
        let old_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions WHERE id IN (?, ?)",
                params![target_version_id, current_version_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(old_count, 2);
        let kind: String = connection
            .query_row(
                "SELECT change_kind FROM official_source_url_versions WHERE id=?",
                params![result.result_version_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(kind, "ROLLBACK");
    }

    #[test]
    fn er4e_stale_rollback_rejects_zero_write() {
        let connection = connection();
        let (target_version_id, current_version_id, target_url, current_revision) =
            make_manual_version(&connection);
        let current =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let review = OfficialSourceRollbackReview {
            schema_version: 1,
            source_key: current.source_key.clone(),
            current_version_id,
            current_revision: current_revision + 1,
            current_url: current.current_url.clone(),
            target_version_id,
            target_url,
            target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            rollback_fingerprint: "ROLLBACK_FINGERPRINT".to_string(),
        };
        let versions_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM official_source_url_versions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let error = apply_official_source_rollback_internal(
            &connection,
            &review,
            &RollbackRevalidationEvidence {
                target_content_sha256: "TARGET_CONTENT_SHA".to_string(),
                target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            },
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(error, ER4_STALE_REJECTED);
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            versions_before
        );
    }

    #[test]
    fn er4e_rollback_failure_injection_rolls_back_every_boundary() {
        for marker in [
            "ROLLBACK_AFTER_REVIEW_EVENT",
            "ROLLBACK_AFTER_VERSION",
            "ROLLBACK_AFTER_CURRENT_POINTER",
            "ROLLBACK_BEFORE_MIRROR",
            "ROLLBACK_AFTER_MIRROR",
            "ROLLBACK_AFTER_EVENT_LINK",
        ] {
            let connection = connection();
            let (target_version_id, current_version_id, target_url, current_revision) =
                make_manual_version(&connection);
            let current =
                read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER")
                    .unwrap();
            let review = OfficialSourceRollbackReview {
                schema_version: 1,
                source_key: current.source_key.clone(),
                current_version_id,
                current_revision,
                current_url: current.current_url.clone(),
                target_version_id,
                target_url,
                target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
                rollback_fingerprint: "ROLLBACK_FINGERPRINT".to_string(),
            };
            let versions_before: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM official_source_url_versions",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            let authority_before =
                read_official_source_configuration_authority(&connection).unwrap();
            let mirror_before = super::super::settings::read_setting_value(
                &connection,
                OFFICIAL_SOURCE_URLS_SETTING_KEY,
            )
            .unwrap()
            .unwrap();

            let error = apply_official_source_rollback_internal(
                &connection,
                &review,
                &RollbackRevalidationEvidence {
                    target_content_sha256: "TARGET_CONTENT_SHA".to_string(),
                    target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
                },
                None,
                Some(marker),
            )
            .unwrap_err();
            assert!(error.contains("ER4_TEST_INJECTED_FAILURE"));
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM official_source_url_versions",
                        [],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap(),
                versions_before
            );
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM official_source_review_events",
                        [],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap(),
                0
            );
            assert_eq!(
                read_official_source_configuration_authority(&connection).unwrap(),
                authority_before
            );
            assert_eq!(
                super::super::settings::read_setting_value(
                    &connection,
                    OFFICIAL_SOURCE_URLS_SETTING_KEY,
                )
                .unwrap()
                .unwrap(),
                mirror_before
            );
        }
    }

    #[test]
    fn er4e_post_health_retry_requires_exact_resulting_current_configuration() {
        let connection = connection();
        let (target_version_id, current_version_id, target_url, current_revision) =
            make_manual_version(&connection);
        let current =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let review = OfficialSourceRollbackReview {
            schema_version: 1,
            source_key: current.source_key.clone(),
            current_version_id,
            current_revision,
            current_url: current.current_url.clone(),
            target_version_id,
            target_url,
            target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            rollback_fingerprint: "ROLLBACK_FINGERPRINT".to_string(),
        };
        let committed = apply_official_source_rollback_internal(
            &connection,
            &review,
            &RollbackRevalidationEvidence {
                target_content_sha256: "TARGET_CONTENT_SHA".to_string(),
                target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            },
            None,
            None,
        )
        .unwrap();

        let context = read_post_health_retry_context(
            &connection,
            "NSE_CURRENT_EQUITY_MASTER",
            committed.result_version_id,
        )
        .unwrap();
        assert_eq!(context.result_version_id, committed.result_version_id);

        let authority = read_official_source_configuration_authority(&connection).unwrap();
        let mut urls = authority.urls.clone();
        urls.nse_sme_master_url =
            "https://nsearchives.nseindia.com/emerge/corporates/content/SME_ALT.csv".to_string();
        let changed = save_official_source_urls_reviewed_internal(
            &connection,
            &SaveOfficialSourceUrlsReviewedInput {
                expected_configuration_fingerprint: authority.configuration_fingerprint.clone(),
                expected_source_revisions: authority
                    .sources
                    .iter()
                    .map(|entry| ExpectedOfficialSourceRevision {
                        source_key: entry.source_key.clone(),
                        revision: entry.revision,
                    })
                    .collect(),
                urls,
                operator_note: Some("change unrelated source after rollback".to_string()),
            },
            false,
        )
        .unwrap();
        assert!(changed
            .changed_source_keys
            .contains(&"NSE_CURRENT_SME_MASTER".to_string()));

        let error = read_post_health_retry_context(
            &connection,
            "NSE_CURRENT_EQUITY_MASTER",
            committed.result_version_id,
        )
        .unwrap_err();
        assert_eq!(error, ER4_STALE_REJECTED);
    }
}
