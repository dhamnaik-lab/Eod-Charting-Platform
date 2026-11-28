use super::binary_eod::{BinaryEodFile, HEADER_SIZE, RECORD_SIZE};
use chrono::Utc;
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(test)]
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const SIDECAR_FILE_NAME: &str = "eod_binary_state.sqlite";
const SCHEMA_VERSION: i64 = 1;
#[cfg(test)]
const SUPPORTED_EXCHANGES: [&str; 4] = ["NSE", "BSE", "NSE_INDEX", "BSE_INDEX"];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BinaryStateStatus {
    Verified,
    Dirty,
    Unknown,
}

impl BinaryStateStatus {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "VERIFIED" => Ok(Self::Verified),
            "DIRTY" => Ok(Self::Dirty),
            "UNKNOWN" => Ok(Self::Unknown),
            other => Err(format!("Unsupported binary state status: {other}")),
        }
    }
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EodBinaryStorageMode {
    Auto,
    Fast,
    FullVerify,
}

#[cfg(test)]
impl EodBinaryStorageMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "AUTO",
            Self::Fast => "FAST",
            Self::FullVerify => "FULL_VERIFY",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_uppercase().as_str() {
            "AUTO" => Ok(Self::Auto),
            "FAST" => Ok(Self::Fast),
            "FULL_VERIFY" => Ok(Self::FullVerify),
            other => Err(format!("Unsupported EOD binary storage mode: {other}")),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BootstrapStatus {
    Incomplete,
    Complete,
}

impl BootstrapStatus {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "INCOMPLETE" => Ok(Self::Incomplete),
            "COMPLETE" => Ok(Self::Complete),
            other => Err(format!(
                "Unsupported binary state bootstrap status: {other}"
            )),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryStateKey {
    pub exchange: String,
    pub symbol: String,
}

impl BinaryStateKey {
    pub fn new(exchange: impl Into<String>, symbol: impl Into<String>) -> Self {
        Self {
            exchange: exchange.into(),
            symbol: symbol.into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CanonicalBinaryState {
    pub key: BinaryStateKey,
    pub relative_path: String,
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub first_date: Option<u32>,
    pub last_date: Option<u32>,
    pub file_mtime_ns: i64,
}

impl CanonicalBinaryState {
    #[cfg(test)]
    fn into_verified(self, state_generation: i64) -> VerifiedBinaryState {
        VerifiedBinaryState {
            key: self.key,
            relative_path: self.relative_path,
            record_count: self.record_count,
            price_scale: self.price_scale,
            file_length: self.file_length,
            first_date: self.first_date,
            last_date: self.last_date,
            file_mtime_ns: self.file_mtime_ns,
            state_generation,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedBinaryState {
    pub key: BinaryStateKey,
    pub relative_path: String,
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub first_date: Option<u32>,
    pub last_date: Option<u32>,
    pub file_mtime_ns: i64,
    pub state_generation: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct StoredBinaryState {
    state: VerifiedBinaryState,
    status: BinaryStateStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryStateIndexStatus {
    pub healthy: bool,
    pub bootstrap_complete: bool,
    pub indexed: usize,
    pub verified: usize,
    pub dirty: usize,
    pub unknown: usize,
    pub generation: i64,
    pub sidecar_path: String,
}

#[cfg(test)]
#[derive(Clone, Debug)]
pub struct BinaryFileCensusEntry {
    pub key: BinaryStateKey,
    pub relative_path: String,
    pub file_length: u64,
    pub file_mtime_ns: i64,
}

#[cfg(test)]
#[derive(Clone, Debug)]
pub struct BinaryStateSnapshot {
    pub verified: HashMap<BinaryStateKey, VerifiedBinaryState>,
    pub status: BinaryStateIndexStatus,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BinaryStateMetadata {
    pub schema_version: i64,
    pub index_generation: i64,
    pub bootstrap_status: BootstrapStatus,
    pub bootstrap_completed_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BinaryStatePublicationResult {
    pub published: usize,
    pub removed: usize,
    pub generation: i64,
}

pub struct BinaryStateIndex {
    connection: Connection,
    database_folder: PathBuf,
    sidecar_path: PathBuf,
}

impl BinaryStateIndex {
    pub fn sidecar_path_for(database_folder: &Path) -> PathBuf {
        database_folder.join(SIDECAR_FILE_NAME)
    }

    #[cfg(test)]
    pub fn sidecar_path(&self) -> &Path {
        &self.sidecar_path
    }

    #[cfg(test)]
    pub fn open(database_folder: &Path) -> Result<Self, String> {
        if !database_folder.is_dir() {
            return Err(format!(
                "EOD binary state database folder not found: {}",
                database_folder.display()
            ));
        }

        let sidecar_path = Self::sidecar_path_for(database_folder);
        let connection = Connection::open(&sidecar_path).map_err(|error| {
            format!(
                "Failed to open EOD binary state sidecar {}: {error}",
                sidecar_path.display()
            )
        })?;

        connection
            .execute_batch(
                "
                PRAGMA foreign_keys = ON;
                PRAGMA synchronous = FULL;

                CREATE TABLE IF NOT EXISTS eod_binary_state_meta (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    schema_version INTEGER NOT NULL,
                    index_generation INTEGER NOT NULL,
                    bootstrap_status TEXT NOT NULL
                        CHECK (bootstrap_status IN ('INCOMPLETE','COMPLETE')),
                    bootstrap_completed_at TEXT
                );

                CREATE TABLE IF NOT EXISTS eod_binary_state (
                    exchange TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    record_count INTEGER NOT NULL,
                    price_scale INTEGER NOT NULL,
                    file_length INTEGER NOT NULL,
                    first_date INTEGER,
                    last_date INTEGER,
                    file_mtime_ns INTEGER NOT NULL,
                    state_status TEXT NOT NULL
                        CHECK (state_status IN ('VERIFIED','DIRTY','UNKNOWN')),
                    state_generation INTEGER NOT NULL,
                    verified_at TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (exchange, symbol)
                );
                ",
            )
            .map_err(|error| format!("Failed to initialize EOD binary state schema: {error}"))?;

        connection
            .execute(
                "
                INSERT OR IGNORE INTO eod_binary_state_meta (
                    id,
                    schema_version,
                    index_generation,
                    bootstrap_status,
                    bootstrap_completed_at
                )
                VALUES (1, ?1, 0, 'INCOMPLETE', NULL)
                ",
                params![SCHEMA_VERSION],
            )
            .map_err(|error| format!("Failed to initialize EOD binary state metadata: {error}"))?;

        let index = Self {
            connection,
            database_folder: database_folder.to_path_buf(),
            sidecar_path,
        };

        let metadata = index.read_metadata()?;
        if metadata.schema_version != SCHEMA_VERSION {
            return Err(format!(
                "Unsupported EOD binary state schema version: expected {}, found {}",
                SCHEMA_VERSION, metadata.schema_version
            ));
        }

        Ok(index)
    }

    pub fn open_existing_read_only(database_folder: &Path) -> Result<Self, String> {
        if !database_folder.is_dir() {
            return Err(format!(
                "EOD binary state database folder not found: {}",
                database_folder.display()
            ));
        }

        let sidecar_path = Self::sidecar_path_for(database_folder);
        if !sidecar_path.is_file() {
            return Err(format!(
                "EOD binary state sidecar not found: {}",
                sidecar_path.display()
            ));
        }

        let connection =
            Connection::open_with_flags(&sidecar_path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(
                |error| {
                    format!(
                        "Failed to open EOD binary state sidecar read-only {}: {error}",
                        sidecar_path.display()
                    )
                },
            )?;

        let index = Self {
            connection,
            database_folder: database_folder.to_path_buf(),
            sidecar_path,
        };

        let metadata = index.read_metadata()?;
        if metadata.schema_version != SCHEMA_VERSION {
            return Err(format!(
                "Unsupported EOD binary state schema version: expected {}, found {}",
                SCHEMA_VERSION, metadata.schema_version
            ));
        }

        Ok(index)
    }

    pub fn open_existing_read_write(database_folder: &Path) -> Result<Self, String> {
        if !database_folder.is_dir() {
            return Err(format!(
                "EOD binary state database folder not found: {}",
                database_folder.display()
            ));
        }

        let sidecar_path = Self::sidecar_path_for(database_folder);
        if !sidecar_path.is_file() {
            return Err(format!(
                "EOD binary state sidecar not found: {}",
                sidecar_path.display()
            ));
        }

        let connection =
            Connection::open_with_flags(&sidecar_path, OpenFlags::SQLITE_OPEN_READ_WRITE).map_err(
                |error| {
                    format!(
                        "Failed to open EOD binary state sidecar read-write {}: {error}",
                        sidecar_path.display()
                    )
                },
            )?;

        connection
            .execute_batch(
                "
                PRAGMA foreign_keys = ON;
                PRAGMA synchronous = FULL;
                ",
            )
            .map_err(|error| format!("Failed to configure EOD binary state sidecar: {error}"))?;

        let index = Self {
            connection,
            database_folder: database_folder.to_path_buf(),
            sidecar_path,
        };

        let metadata = index.read_metadata()?;
        if metadata.schema_version != SCHEMA_VERSION {
            return Err(format!(
                "Unsupported EOD binary state schema version: expected {}, found {}",
                SCHEMA_VERSION, metadata.schema_version
            ));
        }

        Ok(index)
    }

    pub fn read_metadata(&self) -> Result<BinaryStateMetadata, String> {
        let raw = self
            .connection
            .query_row(
                "
                SELECT
                    schema_version,
                    index_generation,
                    bootstrap_status,
                    bootstrap_completed_at
                FROM eod_binary_state_meta
                WHERE id = 1
                ",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .map_err(|error| format!("Failed to read EOD binary state metadata: {error}"))?;

        Ok(BinaryStateMetadata {
            schema_version: raw.0,
            index_generation: raw.1,
            bootstrap_status: BootstrapStatus::parse(&raw.2)?,
            bootstrap_completed_at: raw.3,
        })
    }

    pub fn status(&self) -> Result<BinaryStateIndexStatus, String> {
        let metadata = self.read_metadata()?;
        let counts = self
            .connection
            .query_row(
                "
                SELECT
                    COUNT(*),
                    COALESCE(SUM(CASE WHEN state_status = 'VERIFIED' THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state_status = 'DIRTY' THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state_status = 'UNKNOWN' THEN 1 ELSE 0 END), 0)
                FROM eod_binary_state
                ",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                },
            )
            .map_err(|error| format!("Failed to read EOD binary state counters: {error}"))?;

        let indexed = usize_from_i64(counts.0, "indexed row count")?;
        let verified = usize_from_i64(counts.1, "verified row count")?;
        let dirty = usize_from_i64(counts.2, "dirty row count")?;
        let unknown = usize_from_i64(counts.3, "unknown row count")?;
        let bootstrap_complete = metadata.bootstrap_status == BootstrapStatus::Complete;

        Ok(BinaryStateIndexStatus {
            healthy: bootstrap_complete && dirty == 0 && unknown == 0,
            bootstrap_complete,
            indexed,
            verified,
            dirty,
            unknown,
            generation: metadata.index_generation,
            sidecar_path: self.sidecar_path.to_string_lossy().to_string(),
        })
    }

    #[cfg(test)]
    pub fn rebuild(&mut self) -> Result<BinaryStateIndexStatus, String> {
        self.mark_bootstrap_incomplete()?;

        let candidates = enumerate_eod_files(&self.database_folder)?;
        let metadata = self.read_metadata()?;
        let next_generation = metadata
            .index_generation
            .checked_add(1)
            .ok_or_else(|| "EOD binary state generation overflow".to_string())?;

        let mut states = Vec::with_capacity(candidates.len());
        for (key, path) in &candidates {
            let observed = inspect_canonical_file_at_path(&self.database_folder, key, path)?;
            states.push(observed.into_verified(next_generation));
        }

        if states.len() != candidates.len() {
            return Err(format!(
                "EOD binary state rebuild count mismatch: enumerated {}, inspected {}",
                candidates.len(),
                states.len()
            ));
        }

        let completed_at = Utc::now().to_rfc3339();
        let transaction = self.connection.transaction().map_err(|error| {
            format!("Failed to start EOD binary state rebuild transaction: {error}")
        })?;

        transaction
            .execute("DELETE FROM eod_binary_state", [])
            .map_err(|error| format!("Failed to clear EOD binary state rows: {error}"))?;

        {
            let mut statement = transaction
                .prepare(
                    "
                    INSERT INTO eod_binary_state (
                        exchange,
                        symbol,
                        relative_path,
                        record_count,
                        price_scale,
                        file_length,
                        first_date,
                        last_date,
                        file_mtime_ns,
                        state_status,
                        state_generation,
                        verified_at,
                        updated_at
                    )
                    VALUES (
                        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                        'VERIFIED', ?10, ?11, ?11
                    )
                    ",
                )
                .map_err(|error| format!("Failed to prepare EOD binary state insert: {error}"))?;

            for state in &states {
                statement
                    .execute(params![
                        &state.key.exchange,
                        &state.key.symbol,
                        &state.relative_path,
                        i64::from(state.record_count),
                        i64::from(state.price_scale),
                        i64_from_u64(state.file_length, "file length")?,
                        state.first_date.map(i64::from),
                        state.last_date.map(i64::from),
                        state.file_mtime_ns,
                        state.state_generation,
                        &completed_at,
                    ])
                    .map_err(|error| {
                        format!(
                            "Failed to insert EOD binary state {}:{}: {error}",
                            state.key.exchange, state.key.symbol
                        )
                    })?;
            }
        }

        transaction
            .execute(
                "
                UPDATE eod_binary_state_meta
                SET
                    schema_version = ?1,
                    index_generation = ?2,
                    bootstrap_status = 'COMPLETE',
                    bootstrap_completed_at = ?3
                WHERE id = 1
                ",
                params![SCHEMA_VERSION, next_generation, &completed_at],
            )
            .map_err(|error| format!("Failed to publish EOD binary state bootstrap: {error}"))?;

        transaction
            .commit()
            .map_err(|error| format!("Failed to commit EOD binary state rebuild: {error}"))?;

        self.status()
    }

    pub fn load_verified(&self) -> Result<HashMap<BinaryStateKey, VerifiedBinaryState>, String> {
        if self.read_metadata()?.bootstrap_status != BootstrapStatus::Complete {
            return Ok(HashMap::new());
        }

        let mut result = HashMap::new();
        for stored in self.load_stored_rows()? {
            if stored.status == BinaryStateStatus::Verified {
                result.insert(stored.state.key.clone(), stored.state);
            }
        }
        Ok(result)
    }

    pub fn publish_verified_keys(
        &mut self,
        keys: &[BinaryStateKey],
    ) -> Result<BinaryStatePublicationResult, String> {
        let metadata = self.read_metadata()?;
        let generation = metadata.index_generation;
        if metadata.bootstrap_status != BootstrapStatus::Complete || keys.is_empty() {
            return Ok(BinaryStatePublicationResult {
                published: 0,
                removed: 0,
                generation,
            });
        }

        let keys = sorted_unique_keys(keys);
        let mut observed = Vec::<CanonicalBinaryState>::with_capacity(keys.len());
        let mut missing = Vec::<BinaryStateKey>::new();

        for key in keys {
            let path = self
                .database_folder
                .join("eod_data")
                .join(&key.exchange)
                .join(format!("{}.eod", key.symbol));
            match fs::metadata(&path) {
                Ok(metadata) => {
                    if !metadata.is_file() {
                        return Err(format!(
                            "Canonical .eod path is not a file: {}",
                            path.display()
                        ));
                    }
                    observed.push(inspect_canonical_file_at_path(
                        &self.database_folder,
                        &key,
                        &path,
                    )?);
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    missing.push(key);
                }
                Err(error) => {
                    return Err(format!(
                        "Failed to stat incremental EOD binary state target {}:{}: {error}",
                        key.exchange, key.symbol
                    ));
                }
            }
        }

        let updated_at = Utc::now().to_rfc3339();
        let transaction = self.connection.transaction().map_err(|error| {
            format!("Failed to start incremental EOD binary state publication: {error}")
        })?;

        {
            let mut statement = transaction
                .prepare(
                    "
                    INSERT INTO eod_binary_state (
                        exchange,
                        symbol,
                        relative_path,
                        record_count,
                        price_scale,
                        file_length,
                        first_date,
                        last_date,
                        file_mtime_ns,
                        state_status,
                        state_generation,
                        verified_at,
                        updated_at
                    )
                    VALUES (
                        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                        'VERIFIED', ?10, ?11, ?11
                    )
                    ON CONFLICT(exchange, symbol) DO UPDATE SET
                        relative_path = excluded.relative_path,
                        record_count = excluded.record_count,
                        price_scale = excluded.price_scale,
                        file_length = excluded.file_length,
                        first_date = excluded.first_date,
                        last_date = excluded.last_date,
                        file_mtime_ns = excluded.file_mtime_ns,
                        state_status = 'VERIFIED',
                        state_generation = excluded.state_generation,
                        verified_at = excluded.verified_at,
                        updated_at = excluded.updated_at
                    ",
                )
                .map_err(|error| {
                    format!("Failed to prepare incremental EOD binary state upsert: {error}")
                })?;

            for state in &observed {
                statement
                    .execute(params![
                        &state.key.exchange,
                        &state.key.symbol,
                        &state.relative_path,
                        i64::from(state.record_count),
                        i64::from(state.price_scale),
                        i64_from_u64(state.file_length, "file length")?,
                        state.first_date.map(i64::from),
                        state.last_date.map(i64::from),
                        state.file_mtime_ns,
                        generation,
                        &updated_at,
                    ])
                    .map_err(|error| {
                        format!(
                            "Failed to publish incremental EOD binary state {}:{}: {error}",
                            state.key.exchange, state.key.symbol
                        )
                    })?;
            }
        }

        let mut removed = 0_usize;
        if !missing.is_empty() {
            let mut statement = transaction
                .prepare(
                    "
                    DELETE FROM eod_binary_state
                    WHERE exchange = ?1
                      AND symbol = ?2
                    ",
                )
                .map_err(|error| {
                    format!("Failed to prepare missing EOD binary state delete: {error}")
                })?;
            for key in &missing {
                removed += statement
                    .execute(params![&key.exchange, &key.symbol])
                    .map_err(|error| {
                        format!(
                            "Failed to remove missing EOD binary state {}:{}: {error}",
                            key.exchange, key.symbol
                        )
                    })?;
            }
        }

        transaction.commit().map_err(|error| {
            format!("Failed to commit incremental EOD binary state publication: {error}")
        })?;

        Ok(BinaryStatePublicationResult {
            published: observed.len(),
            removed,
            generation,
        })
    }

    pub fn remove_keys(&mut self, keys: &[BinaryStateKey]) -> Result<usize, String> {
        if keys.is_empty() {
            return Ok(0);
        }

        let keys = sorted_unique_keys(keys);
        let transaction = self.connection.transaction().map_err(|error| {
            format!("Failed to start localized EOD binary state invalidation: {error}")
        })?;
        let mut removed = 0_usize;

        {
            let mut statement = transaction
                .prepare(
                    "
                    DELETE FROM eod_binary_state
                    WHERE exchange = ?1
                      AND symbol = ?2
                    ",
                )
                .map_err(|error| {
                    format!("Failed to prepare localized EOD binary state invalidation: {error}")
                })?;
            for key in &keys {
                removed += statement
                    .execute(params![&key.exchange, &key.symbol])
                    .map_err(|error| {
                        format!(
                            "Failed to invalidate localized EOD binary state {}:{}: {error}",
                            key.exchange, key.symbol
                        )
                    })?;
            }
        }

        transaction.commit().map_err(|error| {
            format!("Failed to commit localized EOD binary state invalidation: {error}")
        })?;
        Ok(removed)
    }

    #[cfg(test)]
    pub fn reconcile_census(&mut self) -> Result<BinaryStateSnapshot, String> {
        if self.read_metadata()?.bootstrap_status != BootstrapStatus::Complete {
            return Ok(BinaryStateSnapshot {
                verified: HashMap::new(),
                status: self.status()?,
            });
        }

        let census_entries = enumerate_eod_census(&self.database_folder)?;
        let census = census_entries
            .into_iter()
            .map(|entry| (entry.key.clone(), entry))
            .collect::<HashMap<_, _>>();

        let stored_rows = self.load_stored_rows()?;
        let stored_count = stored_rows.len();
        let mut trusted = HashMap::new();
        let mut mismatched_keys = Vec::new();

        for stored in stored_rows {
            if stored.status != BinaryStateStatus::Verified {
                continue;
            }

            let Some(observed) = census.get(&stored.state.key) else {
                mismatched_keys.push(stored.state.key.clone());
                continue;
            };

            if observed.relative_path == stored.state.relative_path
                && observed.file_length == stored.state.file_length
                && observed.file_mtime_ns == stored.state.file_mtime_ns
            {
                trusted.insert(stored.state.key.clone(), stored.state);
            } else {
                mismatched_keys.push(stored.state.key.clone());
            }
        }

        if !mismatched_keys.is_empty() {
            let updated_at = Utc::now().to_rfc3339();
            let transaction = self
                .connection
                .transaction()
                .map_err(|error| format!("Failed to start census reconciliation: {error}"))?;

            {
                let mut statement = transaction
                    .prepare(
                        "
                        UPDATE eod_binary_state
                        SET state_status = 'UNKNOWN', updated_at = ?1
                        WHERE exchange = ?2
                          AND symbol = ?3
                          AND state_status = 'VERIFIED'
                        ",
                    )
                    .map_err(|error| {
                        format!("Failed to prepare census invalidation statement: {error}")
                    })?;

                for key in &mismatched_keys {
                    statement
                        .execute(params![&updated_at, &key.exchange, &key.symbol])
                        .map_err(|error| {
                            format!(
                                "Failed to invalidate mismatched state {}:{}: {error}",
                                key.exchange, key.symbol
                            )
                        })?;
                }
            }

            transaction
                .commit()
                .map_err(|error| format!("Failed to commit census invalidation: {error}"))?;

            for key in mismatched_keys {
                trusted.remove(&key);
            }
        }

        let mut status = self.status()?;
        if census.len() != stored_count {
            status.healthy = false;
        }

        Ok(BinaryStateSnapshot {
            verified: trusted,
            status,
        })
    }

    #[cfg(test)]
    fn mark_bootstrap_incomplete(&mut self) -> Result<(), String> {
        let transaction = self
            .connection
            .transaction()
            .map_err(|error| format!("Failed to start bootstrap invalidation: {error}"))?;

        transaction
            .execute(
                "
                UPDATE eod_binary_state_meta
                SET bootstrap_status = 'INCOMPLETE',
                    bootstrap_completed_at = NULL
                WHERE id = 1
                ",
                [],
            )
            .map_err(|error| {
                format!("Failed to mark EOD binary state bootstrap incomplete: {error}")
            })?;

        transaction
            .commit()
            .map_err(|error| format!("Failed to persist bootstrap invalidation: {error}"))
    }

    fn load_stored_rows(&self) -> Result<Vec<StoredBinaryState>, String> {
        let mut statement = self
            .connection
            .prepare(
                "
                SELECT
                    exchange,
                    symbol,
                    relative_path,
                    record_count,
                    price_scale,
                    file_length,
                    first_date,
                    last_date,
                    file_mtime_ns,
                    state_status,
                    state_generation
                FROM eod_binary_state
                ",
            )
            .map_err(|error| format!("Failed to prepare EOD binary state query: {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                    row.get::<_, Option<i64>>(7)?,
                    row.get::<_, i64>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, i64>(10)?,
                ))
            })
            .map_err(|error| format!("Failed to read EOD binary state rows: {error}"))?;

        let mut result = Vec::new();
        for row in rows {
            let raw =
                row.map_err(|error| format!("Failed to decode EOD binary state row: {error}"))?;
            let status = BinaryStateStatus::parse(&raw.9)?;
            result.push(StoredBinaryState {
                status,
                state: VerifiedBinaryState {
                    key: BinaryStateKey::new(raw.0, raw.1),
                    relative_path: raw.2,
                    record_count: u32_from_i64(raw.3, "record_count")?,
                    price_scale: u32_from_i64(raw.4, "price_scale")?,
                    file_length: u64_from_i64(raw.5, "file_length")?,
                    first_date: option_u32_from_i64(raw.6, "first_date")?,
                    last_date: option_u32_from_i64(raw.7, "last_date")?,
                    file_mtime_ns: raw.8,
                    state_generation: raw.10,
                },
            });
        }

        Ok(result)
    }
}

fn sorted_unique_keys(keys: &[BinaryStateKey]) -> Vec<BinaryStateKey> {
    let mut keys = keys.to_vec();
    keys.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    keys.dedup_by(|left, right| left.exchange == right.exchange && left.symbol == right.symbol);
    keys
}

#[cfg(test)]
pub fn inspect_canonical_file(
    database_folder: &Path,
    key: &BinaryStateKey,
) -> Result<CanonicalBinaryState, String> {
    let path = database_folder
        .join("eod_data")
        .join(&key.exchange)
        .join(format!("{}.eod", key.symbol));
    inspect_canonical_file_at_path(database_folder, key, &path)
}

fn inspect_canonical_file_at_path(
    database_folder: &Path,
    key: &BinaryStateKey,
    path: &Path,
) -> Result<CanonicalBinaryState, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to stat canonical .eod {}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!(
            "Canonical .eod path is not a file: {}",
            path.display()
        ));
    }

    let binary = BinaryEodFile::open(path)
        .map_err(|error| format!("Failed to open canonical .eod {}: {error}", path.display()))?;

    let record_bytes = (binary.header.record_count as u64)
        .checked_mul(RECORD_SIZE as u64)
        .ok_or_else(|| format!("Canonical .eod length overflow: {}", path.display()))?;
    let expected_length = (HEADER_SIZE as u64)
        .checked_add(record_bytes)
        .ok_or_else(|| format!("Canonical .eod length overflow: {}", path.display()))?;

    if metadata.len() != expected_length {
        return Err(format!(
            "Structurally inconsistent .eod {}:{}: header count {} expects {} bytes, found {} bytes",
            key.exchange,
            key.symbol,
            binary.header.record_count,
            expected_length,
            metadata.len()
        ));
    }

    let (first_date, last_date) = read_boundary_dates(path, binary.header.record_count)?;
    if let (Some(first), Some(last)) = (first_date, last_date) {
        if first > last {
            return Err(format!(
                "Canonical .eod date order invalid {}:{}: first {} > last {}",
                key.exchange, key.symbol, first, last
            ));
        }
    }

    let relative_path =
        normalize_relative_path(path.strip_prefix(database_folder).map_err(|error| {
            format!(
                "Canonical .eod {} is outside database folder {}: {error}",
                path.display(),
                database_folder.display()
            )
        })?)?;

    Ok(CanonicalBinaryState {
        key: key.clone(),
        relative_path,
        record_count: binary.header.record_count,
        price_scale: binary.header.price_scale,
        file_length: metadata.len(),
        first_date,
        last_date,
        file_mtime_ns: modified_time_ns(&metadata)?,
    })
}

#[cfg(test)]
fn enumerate_eod_files(database_folder: &Path) -> Result<Vec<(BinaryStateKey, PathBuf)>, String> {
    let eod_root = database_folder.join("eod_data");
    if !eod_root.exists() {
        return Ok(Vec::new());
    }
    if !eod_root.is_dir() {
        return Err(format!(
            "EOD data root is not a directory: {}",
            eod_root.display()
        ));
    }

    let mut rows = Vec::new();
    let mut seen = HashSet::new();

    for exchange in SUPPORTED_EXCHANGES {
        let exchange_dir = eod_root.join(exchange);
        if !exchange_dir.exists() {
            continue;
        }
        if !exchange_dir.is_dir() {
            return Err(format!(
                "EOD exchange path is not a directory: {}",
                exchange_dir.display()
            ));
        }

        let entries = fs::read_dir(&exchange_dir).map_err(|error| {
            format!(
                "Failed to enumerate EOD exchange directory {}: {error}",
                exchange_dir.display()
            )
        })?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                format!(
                    "Failed to read EOD directory entry under {}: {error}",
                    exchange_dir.display()
                )
            })?;
            let file_type = entry.file_type().map_err(|error| {
                format!(
                    "Failed to inspect EOD directory entry {}: {error}",
                    entry.path().display()
                )
            })?;
            if !file_type.is_file() {
                continue;
            }

            let path = entry.path();
            let is_eod = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case("eod"))
                .unwrap_or(false);
            if !is_eod {
                continue;
            }

            let symbol = path
                .file_stem()
                .and_then(|value| value.to_str())
                .filter(|value| !value.is_empty())
                .ok_or_else(|| format!("Invalid EOD filename: {}", path.display()))?
                .to_string();

            let key = BinaryStateKey::new(exchange, symbol);
            if !seen.insert(key.clone()) {
                return Err(format!(
                    "Duplicate EOD binary state key discovered: {}:{}",
                    key.exchange, key.symbol
                ));
            }
            rows.push((key, path));
        }
    }

    rows.sort_by(|left, right| left.1.cmp(&right.1));
    Ok(rows)
}

#[cfg(test)]
fn enumerate_eod_census(database_folder: &Path) -> Result<Vec<BinaryFileCensusEntry>, String> {
    let files = enumerate_eod_files(database_folder)?;
    let mut result = Vec::with_capacity(files.len());

    for (key, path) in files {
        let metadata = fs::metadata(&path).map_err(|error| {
            format!("Failed to stat EOD census file {}: {error}", path.display())
        })?;
        let relative_path =
            normalize_relative_path(path.strip_prefix(database_folder).map_err(|error| {
                format!(
                    "EOD census path {} is outside database folder {}: {error}",
                    path.display(),
                    database_folder.display()
                )
            })?)?;

        result.push(BinaryFileCensusEntry {
            key,
            relative_path,
            file_length: metadata.len(),
            file_mtime_ns: modified_time_ns(&metadata)?,
        });
    }

    Ok(result)
}

fn read_boundary_dates(
    path: &Path,
    record_count: u32,
) -> Result<(Option<u32>, Option<u32>), String> {
    if record_count == 0 {
        return Ok((None, None));
    }

    let mut file = File::open(path).map_err(|error| {
        format!(
            "Failed to open .eod boundary reader {}: {error}",
            path.display()
        )
    })?;

    let first_date = read_date_at_offset(&mut file, HEADER_SIZE as u64)?;
    let last_offset = (HEADER_SIZE as u64)
        .checked_add(
            (record_count as u64 - 1)
                .checked_mul(RECORD_SIZE as u64)
                .ok_or_else(|| format!("EOD last-date offset overflow: {}", path.display()))?,
        )
        .ok_or_else(|| format!("EOD last-date offset overflow: {}", path.display()))?;
    let last_date = read_date_at_offset(&mut file, last_offset)?;

    Ok((Some(first_date), Some(last_date)))
}

fn read_date_at_offset(file: &mut File, offset: u64) -> Result<u32, String> {
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| format!("Failed to seek EOD date field: {error}"))?;
    let mut date = [0_u8; 4];
    file.read_exact(&mut date)
        .map_err(|error| format!("Failed to read EOD date field: {error}"))?;
    Ok(u32::from_le_bytes(date))
}

pub(crate) fn modified_time_ns(metadata: &fs::Metadata) -> Result<i64, String> {
    let modified = metadata
        .modified()
        .map_err(|error| format!("Failed to read EOD file modified time: {error}"))?;
    system_time_ns(modified)
}

fn system_time_ns(value: SystemTime) -> Result<i64, String> {
    let duration = value
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("EOD file modified time predates Unix epoch: {error}"))?;
    i64::try_from(duration.as_nanos())
        .map_err(|_| "EOD file modified timestamp exceeds SQLite INTEGER range".to_string())
}

fn normalize_relative_path(path: &Path) -> Result<String, String> {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                let text = value
                    .to_str()
                    .ok_or_else(|| format!("Non-Unicode EOD relative path: {}", path.display()))?;
                components.push(text.to_string());
            }
            Component::CurDir => {}
            other => {
                return Err(format!(
                    "Unsupported component {other:?} in EOD relative path {}",
                    path.display()
                ));
            }
        }
    }
    Ok(components.join("/"))
}

fn i64_from_u64(value: u64, label: &str) -> Result<i64, String> {
    i64::try_from(value).map_err(|_| format!("{label} exceeds SQLite INTEGER range"))
}

fn u64_from_i64(value: i64, label: &str) -> Result<u64, String> {
    u64::try_from(value).map_err(|_| format!("{label} is negative or out of range: {value}"))
}

fn u32_from_i64(value: i64, label: &str) -> Result<u32, String> {
    u32::try_from(value).map_err(|_| format!("{label} is out of range: {value}"))
}

fn option_u32_from_i64(value: Option<i64>, label: &str) -> Result<Option<u32>, String> {
    value.map(|value| u32_from_i64(value, label)).transpose()
}

fn usize_from_i64(value: i64, label: &str) -> Result<usize, String> {
    usize::try_from(value).map_err(|_| format!("{label} is out of range: {value}"))
}

#[cfg(test)]
mod v16_incremental_publication_tests {
    use super::*;
    use crate::database::binary_eod::{BinaryEodFile, EodRecord, DEFAULT_SCALE};
    use std::fs;
    use tempfile::tempdir;

    fn write_symbol(base: &Path, symbol: &str, dates: &[u32]) {
        let eod_dir = base.join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join(format!("{symbol}.eod"));
        let mut records = dates
            .iter()
            .enumerate()
            .map(|(offset, date)| EodRecord {
                date: *date,
                flags: 0,
                open: 10_000 + offset as i64,
                high: 11_000 + offset as i64,
                low: 9_000 + offset as i64,
                close: 10_500 + offset as i64,
                prev_close: 9_500 + offset as i64,
                volume: 1_000 + offset as u64,
                oi: 0,
            })
            .collect::<Vec<_>>();
        BinaryEodFile::write_all(&path, symbol, "NSE", DEFAULT_SCALE, &mut records).unwrap();
    }

    #[test]
    fn v16_incremental_publication_creates_new_verified_row_without_generation_bump() {
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "BASE", &[20260820]);
        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        assert_eq!(index.rebuild().unwrap().generation, 1);

        write_symbol(dir.path(), "NEW", &[20260821]);
        let result = index
            .publish_verified_keys(&[BinaryStateKey::new("NSE", "NEW")])
            .unwrap();
        assert_eq!(result.published, 1);
        assert_eq!(result.removed, 0);
        assert_eq!(result.generation, 1);
        assert_eq!(index.read_metadata().unwrap().index_generation, 1);

        let verified = index.load_verified().unwrap();
        let state = verified.get(&BinaryStateKey::new("NSE", "NEW")).unwrap();
        assert_eq!(state.record_count, 1);
        assert_eq!(state.last_date, Some(20260821));
        assert_eq!(state.state_generation, 1);
    }

    #[test]
    fn v16_incremental_publication_removes_row_when_physical_file_is_missing() {
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20260820]);
        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        assert_eq!(index.rebuild().unwrap().generation, 1);
        fs::remove_file(dir.path().join("eod_data").join("NSE").join("TEST.eod")).unwrap();

        let result = index
            .publish_verified_keys(&[BinaryStateKey::new("NSE", "TEST")])
            .unwrap();
        assert_eq!(result.published, 0);
        assert_eq!(result.removed, 1);
        assert_eq!(result.generation, 1);
        assert!(!index
            .load_verified()
            .unwrap()
            .contains_key(&BinaryStateKey::new("NSE", "TEST")));
        assert!(index.status().unwrap().healthy);
    }
}

#[cfg(test)]
mod tests;
