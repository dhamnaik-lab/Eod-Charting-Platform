//! Batch-scoped worker lifetime and bounded SQLite log-write retries.
use rusqlite::{Connection, Error, ErrorCode, OpenFlags};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

/// The batch owner prepares the database once before workers start. Workers must
/// not rerun migrations, bootstrap, or seeding while other connections write logs.
pub(super) fn open_staging_connection(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)
        .map_err(|e| e.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(15))
        .map_err(|e| e.to_string())?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    Ok(connection)
}

pub(super) fn retry_busy<T>(
    mut operation: impl FnMut() -> rusqlite::Result<T>,
) -> Result<T, String> {
    for attempt in 0..=2 {
        match operation() {
            Ok(value) => return Ok(value),
            Err(Error::SqliteFailure(error, _))
                if matches!(
                    error.code,
                    ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked
                ) && attempt < 2 =>
            {
                thread::sleep(Duration::from_millis(100 * (attempt + 1)));
            }
            Err(error) => return Err(error.to_string()),
        }
    }
    unreachable!()
}

#[derive(Default)]
pub(super) struct DownloadWorkers {
    stop: Arc<AtomicBool>,
    handles: Vec<JoinHandle<()>>,
}

impl DownloadWorkers {
    pub(super) fn spawn(&mut self, work: impl FnOnce(Arc<AtomicBool>) + Send + 'static) {
        let stop = self.stop.clone();
        self.handles.push(thread::spawn(move || work(stop)));
    }
    pub(super) fn finish(&mut self) -> Result<(), String> {
        self.stop.store(true, Ordering::SeqCst);
        let mut panicked = false;
        for handle in self.handles.drain(..) {
            panicked |= handle.join().is_err();
        }
        if panicked {
            Err("Bhavcopy download worker panicked; all workers have stopped.".into())
        } else {
            Ok(())
        }
    }
}
impl Drop for DownloadWorkers {
    fn drop(&mut self) {
        let _ = self.finish();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    #[test]
    fn error_unwind_stops_and_joins_workers_before_returning() {
        let (ready, started) = mpsc::channel();
        let (done, finished) = mpsc::channel();
        let fail = || -> Result<(), String> {
            let mut workers = DownloadWorkers::default();
            workers.spawn(move |stop| {
                ready.send(()).unwrap();
                while !stop.load(Ordering::SeqCst) {
                    thread::yield_now();
                }
                done.send(()).unwrap();
            });
            started.recv_timeout(Duration::from_secs(2)).unwrap();
            Err("simulated result-log failure".into())
        };
        assert!(fail().is_err());
        finished
            .try_recv()
            .expect("worker must be finished before error returns");
    }
    #[test]
    fn lightweight_connection_does_not_create_or_migrate_a_database() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("fixture.sqlite3");
        assert!(open_staging_connection(&path).is_err());
        assert!(!path.exists());
        let seed = Connection::open(&path).unwrap();
        seed.execute_batch("CREATE TABLE sentinel(value INTEGER); INSERT INTO sentinel VALUES(7)")
            .unwrap();
        drop(seed);
        let worker = open_staging_connection(&path).unwrap();
        let tables: i64 = worker
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tables, 1);
        assert_eq!(
            worker
                .query_row("SELECT value FROM sentinel", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            7
        );
    }
    #[test]
    fn lightweight_connection_keeps_foreign_key_enforcement() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("foreign-keys.sqlite3");
        let seed = Connection::open(&path).unwrap();
        seed.execute_batch("CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id));").unwrap();
        drop(seed);
        let worker = open_staging_connection(&path).unwrap();
        assert!(worker.execute("INSERT INTO child VALUES(99)", []).is_err());
        assert_eq!(
            worker
                .query_row("SELECT count(*) FROM child", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn failed_source_result_is_logged_without_running_schema_bootstrap() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("CREATE TABLE download_log (id INTEGER PRIMARY KEY,trade_date TEXT,exchange TEXT,rows_inserted INTEGER,max_volume INTEGER,status TEXT,note TEXT,downloaded_at TEXT,UNIQUE(trade_date,exchange)); CREATE TABLE protected(value TEXT); INSERT INTO protected VALUES('unchanged')").unwrap();
        let result = crate::bhavcopy::calendar::failed_download_result(
            "BSE",
            "1991-02-14",
            "source transport error",
        );
        crate::bhavcopy::ingestion::upsert_download_log_entry(&connection, &result).unwrap();
        let row: (String, String, i64) = connection
            .query_row(
                "SELECT status,note,rows_inserted FROM download_log",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(row, ("error".into(), "source transport error".into(), 0));
        assert_eq!(
            connection
                .query_row("SELECT value FROM protected", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "unchanged"
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table'",
                    [],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            2
        );
    }
    #[test]
    fn transient_busy_retries_but_persistent_lock_and_other_errors_fail() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("lock.sqlite3");
        let owner = Connection::open(&path).unwrap();
        owner
            .execute_batch("CREATE TABLE log(value INTEGER); BEGIN IMMEDIATE")
            .unwrap();
        let writer = open_staging_connection(&path).unwrap();
        writer.busy_timeout(Duration::from_millis(1)).unwrap();
        let mut attempts = 0;
        retry_busy(|| {
            attempts += 1;
            let result = writer.execute("INSERT INTO log VALUES(1)", []);
            if attempts == 1 {
                owner.execute_batch("ROLLBACK").unwrap();
            }
            result
        })
        .unwrap();
        assert_eq!(attempts, 2);
        owner.execute_batch("BEGIN IMMEDIATE").unwrap();
        attempts = 0;
        assert!(retry_busy(|| {
            attempts += 1;
            writer.execute("INSERT INTO log VALUES(2)", [])
        })
        .is_err());
        assert_eq!(attempts, 3);
        owner.execute_batch("ROLLBACK").unwrap();
        attempts = 0;
        assert!(retry_busy(|| {
            attempts += 1;
            writer.execute("INSERT INTO missing VALUES(1)", [])
        })
        .is_err());
        assert_eq!(attempts, 1);
        assert_eq!(
            writer
                .query_row("SELECT count(*) FROM log", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}
