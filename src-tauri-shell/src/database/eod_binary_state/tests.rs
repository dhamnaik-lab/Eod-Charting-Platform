use super::super::binary_eod::EodRecord;
use super::*;
use std::fs;

fn mock_record(date: u32, close: i64) -> EodRecord {
    EodRecord {
        date,
        flags: 0,
        open: close,
        high: close,
        low: close,
        close,
        prev_close: close,
        volume: 1,
        oi: 0,
    }
}

fn write_symbol(
    database_folder: &Path,
    exchange: &str,
    symbol: &str,
    records: &mut [EodRecord],
) -> PathBuf {
    let path = database_folder
        .join("eod_data")
        .join(exchange)
        .join(format!("{symbol}.eod"));
    BinaryEodFile::write_all(&path, symbol, exchange, 100, records).unwrap();
    path
}

#[test]
fn state_index_open_creates_schema_without_marking_bootstrap_complete() {
    let dir = tempfile::tempdir().unwrap();
    let index = BinaryStateIndex::open(dir.path()).unwrap();

    assert_eq!(
        index.sidecar_path(),
        dir.path().join(SIDECAR_FILE_NAME).as_path()
    );

    let metadata = index.read_metadata().unwrap();
    assert_eq!(metadata.schema_version, SCHEMA_VERSION);
    assert_eq!(metadata.index_generation, 0);
    assert_eq!(metadata.bootstrap_status, BootstrapStatus::Incomplete);
    assert_eq!(metadata.bootstrap_completed_at, None);

    let status = index.status().unwrap();
    assert!(!status.healthy);
    assert!(!status.bootstrap_complete);
    assert_eq!(status.indexed, 0);
}

#[test]
fn storage_mode_roundtrips_expected_persisted_values() {
    assert_eq!(EodBinaryStorageMode::Auto.as_str(), "AUTO");
    assert_eq!(EodBinaryStorageMode::Fast.as_str(), "FAST");
    assert_eq!(EodBinaryStorageMode::FullVerify.as_str(), "FULL_VERIFY");

    assert_eq!(
        EodBinaryStorageMode::parse("FULL_VERIFY").unwrap(),
        EodBinaryStorageMode::FullVerify
    );
    assert!(EodBinaryStorageMode::parse("FORCE_UNSAFE").is_err());
}

#[test]
fn rebuild_indexes_real_eod_files_and_publishes_complete_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let mut aaa = vec![mock_record(20260818, 1000)];
    let mut bbb = vec![mock_record(20260817, 2000), mock_record(20260818, 2100)];
    write_symbol(dir.path(), "NSE", "AAA", &mut aaa);
    write_symbol(dir.path(), "BSE", "BBB", &mut bbb);

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    let status = index.rebuild().unwrap();

    assert!(status.healthy);
    assert!(status.bootstrap_complete);
    assert_eq!(status.indexed, 2);
    assert_eq!(status.verified, 2);
    assert_eq!(status.dirty, 0);
    assert_eq!(status.unknown, 0);
    assert_eq!(status.generation, 1);

    let rows = index.load_verified().unwrap();
    assert_eq!(
        rows[&BinaryStateKey::new("NSE", "AAA")].last_date,
        Some(20260818)
    );
    assert_eq!(
        rows[&BinaryStateKey::new("BSE", "BBB")].first_date,
        Some(20260817)
    );
    assert_eq!(rows[&BinaryStateKey::new("BSE", "BBB")].record_count, 2);
}

#[test]
fn rebuild_with_missing_eod_root_publishes_complete_empty_index() {
    let dir = tempfile::tempdir().unwrap();
    let mut index = BinaryStateIndex::open(dir.path()).unwrap();

    let status = index.rebuild().unwrap();

    assert!(status.healthy);
    assert!(status.bootstrap_complete);
    assert_eq!(status.indexed, 0);
    assert_eq!(status.verified, 0);
}

#[test]
fn failed_rebuild_leaves_bootstrap_incomplete_and_rows_untrusted() {
    let dir = tempfile::tempdir().unwrap();
    let mut aaa = vec![mock_record(20260818, 1000)];
    let path = write_symbol(dir.path(), "NSE", "AAA", &mut aaa);

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();
    assert_eq!(index.load_verified().unwrap().len(), 1);

    fs::write(&path, b"corrupt").unwrap();
    let error = index.rebuild().unwrap_err();
    assert!(error.contains("Failed to open canonical .eod"));

    let metadata = index.read_metadata().unwrap();
    assert_eq!(metadata.bootstrap_status, BootstrapStatus::Incomplete);
    assert!(index.load_verified().unwrap().is_empty());
}

#[test]
fn census_keeps_matching_verified_row_and_rejects_changed_file_identity() {
    let dir = tempfile::tempdir().unwrap();
    let mut aaa = vec![mock_record(20260818, 1000)];
    let path = write_symbol(dir.path(), "NSE", "AAA", &mut aaa);

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();

    let first = index.reconcile_census().unwrap();
    assert!(first.status.healthy);
    assert!(first
        .verified
        .contains_key(&BinaryStateKey::new("NSE", "AAA")));

    BinaryEodFile::append_or_merge_records(
        &path,
        "AAA",
        "NSE",
        100,
        vec![mock_record(20260819, 1100)],
    )
    .unwrap();

    let second = index.reconcile_census().unwrap();
    assert!(!second.status.healthy);
    assert!(!second
        .verified
        .contains_key(&BinaryStateKey::new("NSE", "AAA")));
    assert_eq!(second.status.verified, 0);
    assert_eq!(second.status.unknown, 1);
}

#[test]
fn census_marks_status_unhealthy_when_new_physical_file_is_unindexed() {
    let dir = tempfile::tempdir().unwrap();
    let mut aaa = vec![mock_record(20260818, 1000)];
    write_symbol(dir.path(), "NSE", "AAA", &mut aaa);

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();

    let mut bbb = vec![mock_record(20260818, 2000)];
    write_symbol(dir.path(), "NSE", "BBB", &mut bbb);

    let snapshot = index.reconcile_census().unwrap();
    assert!(!snapshot.status.healthy);
    assert_eq!(snapshot.status.indexed, 1);
    assert_eq!(snapshot.verified.len(), 1);
}

#[test]
fn inspect_canonical_file_reads_path_key_and_physical_boundaries() {
    let dir = tempfile::tempdir().unwrap();
    let mut records = vec![mock_record(20260817, 900), mock_record(20260818, 1000)];
    let path = write_symbol(dir.path(), "NSE", "AAA", &mut records);

    let state = inspect_canonical_file(dir.path(), &BinaryStateKey::new("NSE", "AAA")).unwrap();

    assert_eq!(state.key, BinaryStateKey::new("NSE", "AAA"));
    assert_eq!(state.relative_path, "eod_data/NSE/AAA.eod");
    assert_eq!(state.record_count, 2);
    assert_eq!(state.price_scale, 100);
    assert_eq!(state.first_date, Some(20260817));
    assert_eq!(state.last_date, Some(20260818));
    assert_eq!(state.file_length, fs::metadata(path).unwrap().len());
}
#[test]
#[ignore = "requires explicit EOD_BINARY_STATE_AUDIT_FOLDER"]
fn v11_real_database_bootstrap_audit() {
    let database_folder = std::env::var("EOD_BINARY_STATE_AUDIT_FOLDER")
        .expect("EOD_BINARY_STATE_AUDIT_FOLDER must point to the active database folder");
    let database_folder = PathBuf::from(database_folder);

    let expected_files = std::env::var("EOD_BINARY_STATE_EXPECTED_FILES")
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .expect("EOD_BINARY_STATE_EXPECTED_FILES must be an unsigned integer")
        });

    let mut index = BinaryStateIndex::open(&database_folder).unwrap();
    let rebuilt = index.rebuild().unwrap();
    let snapshot = index.reconcile_census().unwrap();

    assert!(rebuilt.bootstrap_complete);
    assert!(snapshot.status.bootstrap_complete);
    assert!(snapshot.status.healthy);
    assert_eq!(snapshot.status.indexed, snapshot.status.verified);
    assert_eq!(snapshot.status.dirty, 0);
    assert_eq!(snapshot.status.unknown, 0);
    assert_eq!(snapshot.verified.len(), snapshot.status.verified);

    if let Some(expected_files) = expected_files {
        assert_eq!(snapshot.status.indexed, expected_files);
    }

    println!(
            "V1.1_REAL_DATABASE_BOOTSTRAP indexed={} verified={} dirty={} unknown={} generation={} sidecar={}",
            snapshot.status.indexed,
            snapshot.status.verified,
            snapshot.status.dirty,
            snapshot.status.unknown,
            snapshot.status.generation,
            snapshot.status.sidecar_path
        );
}

#[test]
fn read_only_open_requires_existing_sidecar_and_preserves_bytes() {
    let dir = tempfile::tempdir().unwrap();
    let sidecar = BinaryStateIndex::sidecar_path_for(dir.path());

    let missing = BinaryStateIndex::open_existing_read_only(dir.path())
        .err()
        .expect("missing sidecar must fail read-only open");
    assert!(missing.contains("sidecar"));
    assert!(!sidecar.exists());

    let mut records = vec![mock_record(20260818, 1000)];
    write_symbol(dir.path(), "NSE", "AAA", &mut records);

    let mut writable = BinaryStateIndex::open(dir.path()).unwrap();
    writable.rebuild().unwrap();
    drop(writable);

    let before = fs::read(&sidecar).unwrap();
    let read_only = BinaryStateIndex::open_existing_read_only(dir.path()).unwrap();
    let status = read_only.status().unwrap();
    let rows = read_only.load_verified().unwrap();
    drop(read_only);
    let after = fs::read(&sidecar).unwrap();

    assert!(status.bootstrap_complete);
    assert_eq!(status.verified, 1);
    assert_eq!(rows.len(), 1);
    assert_eq!(before, after);
}
