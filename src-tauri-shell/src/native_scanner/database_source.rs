//! NS-01/NS-02: database-backed, read-only data source for the native scanner.
//!
//! This deliberately reuses the accepted EOD resolution and adjustment code instead of
//! reimplementing it:
//! - [`crate::database::eod_data::read_scan_bars_for_folder`] performs canonical identity
//!   resolution (aliases/ISIN/symbol transitions), unified binary/Hybrid reads and the
//!   approved corporate-action projection.
//! - The connection is opened read-only (`mode=ro` + `query_only`), one per scan, and is
//!   never shared across worker threads.
//!
//! NS-03 owns the database-use permit lifetime and the background job; this module is a
//! plain read-only consumer so it can be unit tested without Tauri state.

use super::ast::PriceBasisV1;
use super::reader::NativeBar;
use super::scan::{ScanDataSource, ScanTarget};
use crate::database::read_scan_bars_for_folder;
use rusqlite::Connection;
use std::path::PathBuf;

/// Read-only scan source bound to one resolved database folder.
pub struct ReadOnlyDatabaseSource {
    folder: PathBuf,
    identity: String,
    connection: Connection,
}

impl ReadOnlyDatabaseSource {
    /// Opens a read-only connection for an already-resolved active database folder.
    ///
    /// The caller must hold the database-use permit for the whole scan lifetime (NS-03).
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
        let connection = crate::database::open_read_only_connection_for_folder(&folder)?;
        Ok(Self {
            folder,
            identity,
            connection,
        })
    }

    pub fn identity(&self) -> &str {
        &self.identity
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
        let bars = read_scan_bars_for_folder(
            &self.folder,
            &self.connection,
            &target.symbol,
            &target.exchange,
            as_of_date,
            window,
            price_basis == PriceBasisV1::Adjusted,
            include_dividend_adjustments,
            include_rights_adjustments,
        )?;
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
