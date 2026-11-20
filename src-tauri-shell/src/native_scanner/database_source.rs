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
use std::sync::{Arc, Mutex};
use std::thread::ThreadId;

/// Read-only scan source bound to one resolved database folder.
///
/// Per-thread connections are cached so a worker reuses its own handle across targets
/// instead of re-opening the database for every symbol.
///
/// ### Concurrency (P1-08)
///
/// The registry `Mutex` guards **only the map**, never a database read. Each worker
/// reserves its own `Arc<Mutex<Connection>>` in a short critical section and then drops
/// the registry lock before touching the database, so 1-4 workers read in parallel
/// instead of being serialized behind one global lock.
///
/// The per-connection `Mutex` is held for the duration of one `load_bars` call. A given
/// connection is only ever used by the thread that owns it, so this lock is uncontended
/// in practice; it exists purely to prove `&Connection` cannot alias across threads
/// without an `unsafe` impl.
pub struct ReadOnlyDatabaseSource {
    folder: PathBuf,
    identity: String,
    connections: Mutex<HashMap<ThreadId, Arc<Mutex<Connection>>>>,
    #[cfg(test)]
    pub(crate) test_probe: test_probe::Probe,
}

/// Test-only instrumentation proving the registry lock is not held across a read.
///
/// Compiled out entirely in non-test builds, so production carries no counter, no
/// atomics and no delay. A read counts as "active" from the moment `f` is entered until
/// it returns; if the registry mutex were still held across that span (the P1-08 defect)
/// this could never exceed 1 regardless of worker count.
#[cfg(test)]
pub(crate) mod test_probe {
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

    /// Per-source counters prevent parallel test fixtures from resetting each other.
    /// Completely absent from non-test binaries.
    #[derive(Default)]
    pub(crate) struct Probe {
        active_reads: AtomicUsize,
        max_active_reads: AtomicUsize,
        read_section_delay_ms: AtomicU64,
    }

    impl Probe {
        pub(crate) fn reset(&self, delay_ms: u64) {
            self.active_reads.store(0, Ordering::SeqCst);
            self.max_active_reads.store(0, Ordering::SeqCst);
            self.read_section_delay_ms.store(delay_ms, Ordering::SeqCst);
        }

        pub(crate) fn peak(&self) -> usize {
            self.max_active_reads.load(Ordering::SeqCst)
        }

        pub(crate) fn enter(&self) {
            let current = self.active_reads.fetch_add(1, Ordering::SeqCst) + 1;
            self.max_active_reads.fetch_max(current, Ordering::SeqCst);
            let delay = self.read_section_delay_ms.load(Ordering::SeqCst);
            if delay > 0 {
                std::thread::sleep(std::time::Duration::from_millis(delay));
            }
        }

        pub(crate) fn leave(&self) {
            self.active_reads.fetch_sub(1, Ordering::SeqCst);
        }
    }
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
        let first = Arc::new(Mutex::new(
            crate::database::open_read_only_connection_for_folder(&folder)?,
        ));
        let mut connections = HashMap::new();
        connections.insert(std::thread::current().id(), first);
        Ok(Self {
            folder,
            identity,
            connections: Mutex::new(connections),
            #[cfg(test)]
            test_probe: test_probe::Probe::default(),
        })
    }

    pub fn identity(&self) -> &str {
        &self.identity
    }

    /// Bind production event identity to the verified active registry selection.
    pub(crate) fn bind_selection_identity(&mut self, identity: String) {
        self.identity = identity;
    }

    /// Runs `f` against the calling thread's own connection, opening one on first use.
    ///
    /// The registry lock is released before `f` runs. Previously the guard was held for
    /// the whole read, which serialized every worker behind one mutex no matter how many
    /// worker threads were configured.
    fn with_connection<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let connection = self.connection_for_current_thread()?;
        let guard = connection
            .lock()
            .map_err(|_| "The scan connection is poisoned.".to_string())?;
        #[cfg(test)]
        self.test_probe.enter();
        let result = f(&guard);
        #[cfg(test)]
        self.test_probe.leave();
        result
    }

    /// Resolves this thread's connection in a short critical section and returns an
    /// owned handle. The registry lock is **not** held while the database is read.
    pub(crate) fn connection_for_current_thread(&self) -> Result<Arc<Mutex<Connection>>, String> {
        let thread = std::thread::current().id();
        let mut registry = self
            .connections
            .lock()
            .map_err(|_| "The scan connection registry is poisoned.".to_string())?;
        if let Some(existing) = registry.get(&thread) {
            return Ok(Arc::clone(existing));
        }
        let connection = Arc::new(Mutex::new(
            crate::database::open_read_only_connection_for_folder(&self.folder)?,
        ));
        registry.insert(thread, Arc::clone(&connection));
        Ok(connection)
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
        // Defense in depth: a direct executor caller must not bypass the IPC gate.
        // Chart projections remain unchanged; only native adjusted scans are blocked.
        if price_basis == PriceBasisV1::Adjusted {
            return Err("CA-01 HOLD: adjusted native scanning is disabled until Split/Bonus event ownership and BSE T+0 applicability have an approved, verified rule. Use raw native scanning; existing chart adjustment behavior is unchanged.".to_string());
        }
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
