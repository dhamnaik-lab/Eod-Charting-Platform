use crate::database::{
    AppResult, CorporateActionEventIdentity, CorporateActionEventIdentityListInput,
    CorporateActionEventIdentityListResult,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;

use super::event_identity_authority::{
    compute_v114e_resolution_fingerprint, load_v114e_event_identity_authority, V114ECandidate,
    V114E_RESOLUTION_AUTHORITY, V114E_RESOLUTION_TYPE, V114E_V114D1_EVIDENCE_SHA256,
};

pub(super) const V114E_EVENT_IDENTITY_MAX_LIST_IDS: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum V114EResolutionInsertOutcome {
    Inserted,
    AlreadySatisfied,
}

#[derive(Clone, Debug)]
struct StoredResolution {
    exchange: String,
    raw_symbol: String,
    raw_isin: Option<String>,
    event_symbol: String,
    event_isin: Option<String>,
    resolution_type: String,
    resolution_authority: String,
    chain_id: String,
    transition_old_symbol: String,
    transition_new_symbol: String,
    transition_effective_date: String,
    raw_identity_source_ref: String,
    raw_identity_source_sha256: String,
    raw_identity_source_line_number: i64,
    v114d1_evidence_sha256: String,
    resolution_fingerprint: String,
}

#[derive(Clone, Debug)]
pub(super) struct VerifiedV114EEventIdentityResolution {
    pub candidate: V114ECandidate,
    pub resolution_fingerprint: String,
}

pub(super) fn event_identity_resolution_table_exists(connection: &Connection) -> AppResult<bool> {
    connection
        .query_row(
            "
              SELECT EXISTS(
                SELECT 1
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'corporate_action_event_identity_resolutions'
              )
            ",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}

fn corporate_action_imports_has_column(
    connection: &Connection,
    column_name: &str,
) -> AppResult<bool> {
    let mut statement = connection
        .prepare("PRAGMA table_info(corporate_action_imports)")
        .map_err(|error| error.to_string())?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(names.iter().any(|name| name == column_name))
}

pub(super) fn create_event_identity_resolution_schema_for_controlled_apply(
    connection: &Connection,
) -> AppResult<()> {
    connection
        .execute_batch(
            "
              CREATE TABLE IF NOT EXISTS corporate_action_event_identity_resolutions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id INTEGER NOT NULL UNIQUE
                  REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
                exchange TEXT NOT NULL,
                raw_symbol TEXT NOT NULL,
                raw_isin TEXT,
                event_symbol TEXT NOT NULL,
                event_isin TEXT,
                resolution_type TEXT NOT NULL,
                resolution_authority TEXT NOT NULL,
                chain_id TEXT NOT NULL,
                transition_old_symbol TEXT NOT NULL,
                transition_new_symbol TEXT NOT NULL,
                transition_effective_date TEXT NOT NULL,
                raw_identity_source_ref TEXT NOT NULL,
                raw_identity_source_sha256 TEXT NOT NULL,
                raw_identity_source_line_number INTEGER NOT NULL,
                v114d1_evidence_sha256 TEXT NOT NULL,
                resolution_fingerprint TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
              );

              CREATE INDEX IF NOT EXISTS idx_ca_event_identity_event_symbol
              ON corporate_action_event_identity_resolutions(
                exchange,
                event_symbol,
                transition_effective_date
              );
            ",
        )
        .map_err(|error| error.to_string())
}

fn load_stored_resolution(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<StoredResolution>> {
    if !event_identity_resolution_table_exists(connection)? {
        return Ok(None);
    }

    connection
        .query_row(
            "
              SELECT exchange,
                     raw_symbol,
                     raw_isin,
                     event_symbol,
                     event_isin,
                     resolution_type,
                     resolution_authority,
                     chain_id,
                     transition_old_symbol,
                     transition_new_symbol,
                     transition_effective_date,
                     raw_identity_source_ref,
                     raw_identity_source_sha256,
                     raw_identity_source_line_number,
                     v114d1_evidence_sha256,
                     resolution_fingerprint
              FROM corporate_action_event_identity_resolutions
              WHERE import_id = ?
            ",
            params![import_id],
            |row| {
                Ok(StoredResolution {
                    exchange: row.get(0)?,
                    raw_symbol: row.get(1)?,
                    raw_isin: row.get(2)?,
                    event_symbol: row.get(3)?,
                    event_isin: row.get(4)?,
                    resolution_type: row.get(5)?,
                    resolution_authority: row.get(6)?,
                    chain_id: row.get(7)?,
                    transition_old_symbol: row.get(8)?,
                    transition_new_symbol: row.get(9)?,
                    transition_effective_date: row.get(10)?,
                    raw_identity_source_ref: row.get(11)?,
                    raw_identity_source_sha256: row.get(12)?,
                    raw_identity_source_line_number: row.get(13)?,
                    v114d1_evidence_sha256: row.get(14)?,
                    resolution_fingerprint: row.get(15)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

pub(super) fn load_effective_event_identity(
    connection: &Connection,
    import_id: i64,
) -> AppResult<CorporateActionEventIdentity> {
    let has_isin = corporate_action_imports_has_column(connection, "isin")?;
    let (exchange, raw_symbol, raw_isin) = if has_isin {
        connection
            .query_row(
                "SELECT exchange, symbol, isin FROM corporate_action_imports WHERE id = ?",
                params![import_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .map_err(|error| error.to_string())?
    } else {
        let (exchange, raw_symbol) = connection
            .query_row(
                "SELECT exchange, symbol FROM corporate_action_imports WHERE id = ?",
                params![import_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .map_err(|error| error.to_string())?;
        (exchange, raw_symbol, None)
    };

    let Some(stored) = load_stored_resolution(connection, import_id)? else {
        return Ok(CorporateActionEventIdentity {
            import_id,
            exchange,
            raw_symbol: raw_symbol.clone(),
            raw_isin: raw_isin.clone(),
            event_symbol: raw_symbol,
            event_isin: raw_isin,
            resolved: false,
            resolution_type: None,
            resolution_authority: None,
            chain_id: None,
            transition_old_symbol: None,
            transition_new_symbol: None,
            transition_effective_date: None,
            raw_identity_source_ref: None,
            raw_identity_source_sha256: None,
            raw_identity_source_line_number: None,
            resolution_fingerprint: None,
        });
    };

    if stored.exchange != exchange
        || Some(stored.raw_symbol.as_str()) != raw_symbol.as_deref()
        || stored.raw_isin.as_deref() != raw_isin.as_deref()
    {
        return Err(format!(
            "V1.14E resolution/raw-import drift for import {}.",
            import_id
        ));
    }

    Ok(CorporateActionEventIdentity {
        import_id,
        exchange: stored.exchange,
        raw_symbol,
        raw_isin,
        event_symbol: Some(stored.event_symbol),
        event_isin: stored.event_isin,
        resolved: true,
        resolution_type: Some(stored.resolution_type),
        resolution_authority: Some(stored.resolution_authority),
        chain_id: Some(stored.chain_id),
        transition_old_symbol: Some(stored.transition_old_symbol),
        transition_new_symbol: Some(stored.transition_new_symbol),
        transition_effective_date: Some(stored.transition_effective_date),
        raw_identity_source_ref: Some(stored.raw_identity_source_ref),
        raw_identity_source_sha256: Some(stored.raw_identity_source_sha256),
        raw_identity_source_line_number: Some(stored.raw_identity_source_line_number),
        resolution_fingerprint: Some(stored.resolution_fingerprint),
    })
}

pub(super) fn validate_event_identity_import_ids(import_ids: &[i64]) -> AppResult<Vec<i64>> {
    if import_ids.is_empty() {
        return Err("Select at least one Corporate Action import.".to_string());
    }
    if import_ids.len() > V114E_EVENT_IDENTITY_MAX_LIST_IDS {
        return Err(format!(
            "Corporate Action event-identity lookup is limited to {} IDs per request.",
            V114E_EVENT_IDENTITY_MAX_LIST_IDS
        ));
    }

    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for import_id in import_ids {
        if *import_id <= 0 {
            return Err("Corporate Action import IDs must be positive integers.".to_string());
        }
        if seen.insert(*import_id) {
            normalized.push(*import_id);
        }
    }
    Ok(normalized)
}

pub(super) fn list_effective_event_identities(
    connection: &Connection,
    input: &CorporateActionEventIdentityListInput,
) -> AppResult<CorporateActionEventIdentityListResult> {
    let import_ids = validate_event_identity_import_ids(&input.import_ids)?;
    let mut identities = Vec::with_capacity(import_ids.len());
    for import_id in import_ids {
        identities.push(load_effective_event_identity(connection, import_id)?);
    }

    Ok(CorporateActionEventIdentityListResult {
        requested: input.import_ids.len() as u32,
        identities,
        message: "Corporate Action event identities loaded without mutation.".to_string(),
    })
}

fn stored_resolution_matches_candidate(
    stored: &StoredResolution,
    candidate: &V114ECandidate,
    resolution_fingerprint: &str,
    v114d1_evidence_sha256: &str,
) -> bool {
    stored.exchange == candidate.exchange
        && stored.raw_symbol == candidate.raw_symbol
        && stored.raw_isin == candidate.raw_isin
        && stored.event_symbol == candidate.event_symbol
        && stored.event_isin == candidate.event_isin
        && stored.resolution_type == V114E_RESOLUTION_TYPE
        && stored.resolution_authority == V114E_RESOLUTION_AUTHORITY
        && stored.chain_id == candidate.chain_id
        && stored.transition_old_symbol == candidate.event_symbol
        && stored.transition_new_symbol == candidate.raw_symbol
        && stored.transition_effective_date == candidate.transition_date
        && stored.raw_identity_source_ref == candidate.raw_identity_source_ref
        && stored.raw_identity_source_sha256 == candidate.raw_identity_source_sha256
        && stored.raw_identity_source_line_number == candidate.raw_identity_source_line_number
        && stored.v114d1_evidence_sha256 == v114d1_evidence_sha256
        && stored.resolution_fingerprint == resolution_fingerprint
}

pub(super) fn load_verified_v114e_event_identity_resolution(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<VerifiedV114EEventIdentityResolution>> {
    let Some(stored) = load_stored_resolution(connection, import_id)? else {
        return Ok(None);
    };
    if stored.resolution_type != V114E_RESOLUTION_TYPE
        || stored.resolution_authority != V114E_RESOLUTION_AUTHORITY
    {
        return Ok(None);
    }

    let authority = load_v114e_event_identity_authority()?;
    let Some(candidate) = authority
        .candidates
        .iter()
        .find(|candidate| candidate.import_id == import_id)
    else {
        return Err(format!(
            "Persisted V1.14E event-identity resolution is not present in the embedded authority for import {}.",
            import_id
        ));
    };
    let resolution_fingerprint = compute_v114e_resolution_fingerprint(candidate)?;
    if !stored_resolution_matches_candidate(
        &stored,
        candidate,
        &resolution_fingerprint,
        V114E_V114D1_EVIDENCE_SHA256,
    ) {
        return Err(format!(
            "Persisted V1.14E event-identity resolution failed exact authority/fingerprint verification for import {}.",
            import_id
        ));
    }

    Ok(Some(VerifiedV114EEventIdentityResolution {
        candidate: candidate.clone(),
        resolution_fingerprint,
    }))
}

pub(super) fn insert_v114e_resolution_strict(
    connection: &Connection,
    candidate: &V114ECandidate,
    resolution_fingerprint: &str,
    v114d1_evidence_sha256: &str,
) -> AppResult<V114EResolutionInsertOutcome> {
    if candidate.event_isin.is_some() {
        return Err(format!(
            "V1.14E first-tranche event ISIN must remain null for import {}.",
            candidate.import_id
        ));
    }

    if let Some(stored) = load_stored_resolution(connection, candidate.import_id)? {
        if stored_resolution_matches_candidate(
            &stored,
            candidate,
            resolution_fingerprint,
            v114d1_evidence_sha256,
        ) {
            return Ok(V114EResolutionInsertOutcome::AlreadySatisfied);
        }
        return Err(format!(
            "CONFLICTING_PRIOR_RESOLUTION for import {}.",
            candidate.import_id
        ));
    }

    connection
        .execute(
            "
              INSERT INTO corporate_action_event_identity_resolutions (
                import_id,
                exchange,
                raw_symbol,
                raw_isin,
                event_symbol,
                event_isin,
                resolution_type,
                resolution_authority,
                chain_id,
                transition_old_symbol,
                transition_new_symbol,
                transition_effective_date,
                raw_identity_source_ref,
                raw_identity_source_sha256,
                raw_identity_source_line_number,
                v114d1_evidence_sha256,
                resolution_fingerprint
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                candidate.import_id,
                candidate.exchange,
                candidate.raw_symbol,
                candidate.raw_isin,
                candidate.event_symbol,
                candidate.event_isin,
                V114E_RESOLUTION_TYPE,
                V114E_RESOLUTION_AUTHORITY,
                candidate.chain_id,
                candidate.event_symbol,
                candidate.raw_symbol,
                candidate.transition_date,
                candidate.raw_identity_source_ref,
                candidate.raw_identity_source_sha256,
                candidate.raw_identity_source_line_number,
                v114d1_evidence_sha256,
                resolution_fingerprint
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(V114EResolutionInsertOutcome::Inserted)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_import_fixture(
        connection: &Connection,
        import_id: i64,
        symbol: &str,
        isin: Option<&str>,
        ex_date: &str,
    ) {
        connection
            .execute_batch(
                "
                  PRAGMA foreign_keys = ON;
                  CREATE TABLE corporate_action_imports (
                    id INTEGER PRIMARY KEY,
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
                    imported_at TEXT NOT NULL,
                    approved_at TEXT
                  );
                  CREATE TABLE corporate_action_import_evidence (
                    id INTEGER PRIMARY KEY,
                    import_id INTEGER NOT NULL,
                    source_code TEXT NOT NULL,
                    source_locator TEXT,
                    captured_at TEXT NOT NULL,
                    note TEXT
                  );
                ",
            )
            .unwrap();
        connection
            .execute(
                "
                  INSERT INTO corporate_action_imports (
                    id, exchange, source, symbol, isin, company_name, purpose_raw,
                    ex_date, action_type, factor, parse_status, review_status, imported_at
                  )
                  VALUES (?, 'NSE', 'NSE_CA', ?, ?, 'NAVA LIMITED', 'fixture',
                          ?, 'BONUS', 2.0, 'PARSED', 'UNRESOLVED', '2026-08-19T00:00:00Z')
                ",
                params![import_id, symbol, isin, ex_date],
            )
            .unwrap();
    }

    #[test]
    fn v114e_effective_identity_falls_back_to_raw_import_when_table_is_absent() {
        let connection = Connection::open_in_memory().unwrap();
        create_import_fixture(
            &connection,
            22969,
            "NAVA",
            Some("INE725A01022"),
            "2016-09-01",
        );

        let identity = load_effective_event_identity(&connection, 22969).unwrap();

        assert_eq!(identity.raw_symbol.as_deref(), Some("NAVA"));
        assert_eq!(identity.event_symbol.as_deref(), Some("NAVA"));
        assert_eq!(identity.raw_isin.as_deref(), Some("INE725A01022"));
        assert_eq!(identity.event_isin.as_deref(), Some("INE725A01022"));
        assert!(!identity.resolved);
        assert!(identity.resolution_type.is_none());
    }

    #[test]
    fn v114e_effective_identity_returns_structured_resolution_without_rewriting_raw_import() {
        let connection = Connection::open_in_memory().unwrap();
        create_import_fixture(
            &connection,
            22969,
            "NAVA",
            Some("INE725A01022"),
            "2016-09-01",
        );
        create_event_identity_resolution_schema_for_controlled_apply(&connection).unwrap();
        connection
            .execute(
                "
                  INSERT INTO corporate_action_event_identity_resolutions (
                    import_id, exchange, raw_symbol, raw_isin, event_symbol, event_isin,
                    resolution_type, resolution_authority, chain_id,
                    transition_old_symbol, transition_new_symbol, transition_effective_date,
                    raw_identity_source_ref, raw_identity_source_sha256,
                    raw_identity_source_line_number, v114d1_evidence_sha256,
                    resolution_fingerprint
                  )
                  VALUES (
                    22969, 'NSE', 'NAVA', 'INE725A01022', 'NBVENTURES', NULL,
                    'NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL',
                    'V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH',
                    'CHAIN-3070AD0C1A094900',
                    'NBVENTURES', 'NAVA', '2022-07-29',
                    'raw-symbol-changes.csv',
                    '921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6',
                    532,
                    'd5a072eb85d7398556641e82a1a507daf63d82e56882ae663e094293f3ece1b2',
                    'fingerprint'
                  )
                ",
                [],
            )
            .unwrap();

        let before = connection
            .query_row(
                "SELECT symbol, isin, company_name, review_status, message FROM corporate_action_imports WHERE id=22969",
                [],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                },
            )
            .unwrap();

        let identity = load_effective_event_identity(&connection, 22969).unwrap();
        assert_eq!(identity.raw_symbol.as_deref(), Some("NAVA"));
        assert_eq!(identity.event_symbol.as_deref(), Some("NBVENTURES"));
        assert_eq!(identity.raw_isin.as_deref(), Some("INE725A01022"));
        assert_eq!(identity.event_isin, None);
        assert!(identity.resolved);

        let after = connection
            .query_row(
                "SELECT symbol, isin, company_name, review_status, message FROM corporate_action_imports WHERE id=22969",
                [],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn v114e_event_identity_list_input_rejects_empty_zero_and_over_500() {
        assert!(validate_event_identity_import_ids(&[]).is_err());
        assert!(validate_event_identity_import_ids(&[0]).is_err());
        assert!(validate_event_identity_import_ids(&(1..=501).collect::<Vec<_>>()).is_err());
        assert_eq!(
            validate_event_identity_import_ids(&[3, 1, 3, 2]).unwrap(),
            vec![3, 1, 2]
        );
    }
}
