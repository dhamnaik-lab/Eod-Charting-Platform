//! NS-01/NS-02: database-backed, read-only data source for the native scanner.
//!
//! This deliberately reuses the accepted EOD resolution and adjustment code instead of
//! reimplementing it:
//! - [`crate::database::eod_data::read_scan_bars_for_folder`] performs canonical identity
//!   resolution (aliases/ISIN/symbol transitions), unified binary/Hybrid reads and the
//!   approved corporate-action projection.
//! - Every worker thread gets **its own** read-only connection (`mode=ro` +
//!   `query_only`). A `rusqlite::Connection` is never shared across threads (P1-08).
//!
//! NS-03 owns the database-use permit lifetime and the background job; this module is a
//! plain read-only consumer so it can be unit tested without Tauri state.

use super::ast::PriceBasisV1;
use super::reader::NativeBar;
use super::scan::{ScanDataSource, ScanTarget};
use crate::database::read_scan_bars_for_folder;
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread::ThreadId;

/// Read-only scan source bound to one resolved database folder.
///
/// Per-thread connections are cached so a worker reuses its own handle across targets
/// instead of re-opening the database for every symbol.
pub struct ReadOnlyDatabaseSource {
    folder: PathBuf,
    identity: String,
    connections: Mutex<HashMap<ThreadId, Connection>>,
}

impl ReadOnlyDatabaseSource {
    /// Prepares a read-only source for an already-resolved active database folder.
    ///
    /// The caller must hold the database-use permit for the whole scan lifetime (NS-03).
    /// The first connection is opened here so an unusable database fails at start time
    /// rather than halfway through a run.
    pub fn open(folder: PathBuf) -> Result<Self, String> {
        let identity = format!(
            "{}#{}",
            folder.display(),
            std::fs::metadata(&folder)
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos())
                .unwrap_or(0)
        );
        let first = crate::database::open_read_only_connection_for_folder(&folder)?;
        let mut connections = HashMap::new();
        connections.insert(std::thread::current().id(), first);
        Ok(Self {
            folder,
            identity,
            connections: Mutex::new(connections),
        })
    }

    pub fn identity(&self) -> &str {
        &self.identity
    }

    /// Runs `f` against the calling thread's own connection, opening one on first use.
    fn with_connection<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let thread = std::thread::current().id();
        let mut guard = self
            .connections
            .lock()
            .map_err(|_| "The scan connection registry is poisoned.".to_string())?;
        if !guard.contains_key(&thread) {
            let connection = crate::database::open_read_only_connection_for_folder(&self.folder)?;
            guard.insert(thread, connection);
        }
        let connection = guard
            .get(&thread)
            .ok_or_else(|| "Unable to obtain a read-only scan connection.".to_string())?;
        f(connection)
    }
}

impl ScanDataSource for ReadOnlyDatabaseSource {
    fn database_identity(&self) -> &str {
        &self.identity
    }

    fn load_bars(
        &self,
        target: &ScanTarget,
        as_of_date: Option<&str>,
        window: usize,
        price_basis: PriceBasisV1,
        include_dividend_adjustments: bool,
        include_rights_adjustments: bool,
    ) -> Result<Vec<NativeBar>, String> {
        let bars = self.with_connection(|connection| {
            read_scan_bars_for_folder(
                &self.folder,
                connection,
                &target.symbol,
                &target.exchange,
                as_of_date,
                window,
                price_basis == PriceBasisV1::Adjusted,
                include_dividend_adjustments,
                include_rights_adjustments,
            )
        })?;
        Ok(bars
            .into_iter()
            .map(|bar| NativeBar {
                date: bar.date,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                prev_close: bar.prev_close,
                volume: bar.volume,
                open_interest: bar.open_interest,
            })
            .collect())
    }
}
