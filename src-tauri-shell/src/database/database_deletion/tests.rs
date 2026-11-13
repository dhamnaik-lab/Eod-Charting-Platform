use super::*;
use crate::database::{
    connection_registry::verify_deletion_ownership, prepare_database_connection,
};
use rusqlite::Connection;
use std::process::Command;

fn fixture() -> tempfile::TempDir {
    let parent = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tmp/fixtures/db-safe-01");
    fs::create_dir_all(&parent).unwrap();
    tempfile::tempdir_in(parent).unwrap()
}

fn create_database(folder: &Path, name: &str) {
    fs::create_dir(folder).unwrap();
    let connection = Connection::open(folder.join(name)).unwrap();
    prepare_database_connection(&connection).unwrap();
}

fn remove(tree: PinnedTree, fail_on: Option<&Path>) -> Result<(), RemovalFailure> {
    let (db, id, evidence) = verify_deletion_ownership(&tree.path, true).unwrap();
    tree.preflight(&db).unwrap();
    let pin = tree.pin_database(&db, id).unwrap();
    drop(evidence);
    tree.remove((&db, pin), |entry| {
        if fail_on.is_some_and(|failure| entry.ends_with(failure)) {
            return Err(io::Error::other("injected before disposition"));
        }
        Ok(())
    })
}

#[test]
fn legacy_fixture_deletes_with_handle_bound_walk() {
    let sandbox = fixture();
    let target = sandbox.path().join("database");
    create_database(&target, "market-data.sqlite3");
    fs::create_dir(target.join("eod_data")).unwrap();
    fs::write(target.join("eod_data/SBIN.eod"), b"fixture").unwrap();
    remove(PinnedTree::open(&target).unwrap(), None).unwrap();
    assert!(!target.exists());
    assert!(sandbox.path().exists());
}

#[test]
fn database_root_accepts_managed_evidence_directories() {
    let sandbox = fixture();
    let target = sandbox.path().join("database");
    create_database(&target, "market-data.sqlite3");
    for relative_path in [
        "bhavcopy_admission/security-fixture.json",
        "bhavcopy_index_evidence/response-fixture.json",
        "historical_index_review/review-fixture/original.json",
    ] {
        let evidence = target.join(relative_path);
        fs::create_dir_all(evidence.parent().unwrap()).unwrap();
        fs::write(evidence, b"{}").unwrap();
    }

    remove(PinnedTree::open(&target).unwrap(), None).unwrap();
    assert!(!target.exists());
    assert!(sandbox.path().is_dir());
}

#[test]
fn database_root_rejects_admission_file_and_junction() {
    let sandbox = fixture();
    let target = sandbox.path().join("database");
    create_database(&target, "market-data.sqlite3");
    let admission = target.join("bhavcopy_admission");
    fs::write(&admission, b"must survive").unwrap();
    let tree = PinnedTree::open(&target).unwrap();
    let (database, _, _evidence) = verify_deletion_ownership(&tree.path, true).unwrap();
    let refusal = tree.preflight(&database).unwrap_err();
    assert!(refusal.to_string().contains("Unrecognized entry"), "{refusal}");
    assert_eq!(fs::read(&admission).unwrap(), b"must survive");
    fs::remove_file(&admission).unwrap();

    let outside = sandbox.path().join("outside");
    fs::create_dir(&outside).unwrap();
    let evidence = outside.join("security-fixture.json");
    fs::write(&evidence, b"must survive").unwrap();
    let output = Command::new("cmd")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(&admission)
        .arg(&outside)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );

    assert!(tree.preflight(&database).is_err());
    assert_eq!(fs::read(&evidence).unwrap(), b"must survive");
    fs::remove_dir(&admission).unwrap();
}

#[test]
fn preflight_refuses_mixed_use_folders_and_nested_database_boundaries() {
    let sandbox = fixture();
    let target = sandbox.path().join("database");
    create_database(&target, "market-data.sqlite3");
    let extra = target.join("personal.txt");
    fs::write(&extra, b"must survive").unwrap();
    let tree = PinnedTree::open(&target).unwrap();
    let (database, _, _evidence) = verify_deletion_ownership(&tree.path, true).unwrap();
    let refusal = tree.preflight(&database).unwrap_err();
    assert!(refusal.to_string().contains("Unrecognized entry"), "{refusal}");
    assert_eq!(fs::read(&extra).unwrap(), b"must survive");
    fs::remove_file(&extra).unwrap();
    let nested = target.join("reference-data/another-db");
    fs::create_dir(target.join("reference-data")).unwrap();
    create_database(&nested, "market-data.sqlite3");
    let refusal = tree.preflight(&database).unwrap_err();
    assert!(refusal.to_string().contains("nested database"), "{refusal}");
    assert!(nested.join("market-data.sqlite3").exists());
}

#[test]
fn strict_manifest_and_schema_verify_without_creating_a_database() {
    let sandbox = fixture();
    let target = sandbox.path().join("database");
    create_database(&target, "market-data.sqlite3");
    for invalid in [
        "broken",
        r#"{"format":"eod-chart-db","version":1,"name":"db","dbFile":"../outside.db","createdAt":""}"#,
    ] {
        fs::write(target.join("database.json"), invalid).unwrap();
        assert!(verify_deletion_ownership(&target, true).is_err());
    }
    let custom = sandbox.path().join("custom");
    create_database(&custom, "data.custom");
    fs::write(custom.join("database.json"), r#"{"format":"eod-chart-db","version":1,"name":"db","dbFile":"data.custom","createdAt":""}"#).unwrap();
    assert!(verify_deletion_ownership(&custom, true).is_ok());
    let foreign = sandbox.path().join("foreign");
    fs::create_dir(&foreign).unwrap();
    Connection::open(foreign.join("market-data.sqlite3"))
        .unwrap()
        .execute_batch("CREATE TABLE unrelated(id INTEGER);")
        .unwrap();
    assert!(verify_deletion_ownership(&foreign, true).is_err());
    let arbitrary = sandbox.path().join("arbitrary");
    fs::create_dir(&arbitrary).unwrap();
    assert!(verify_deletion_ownership(&arbitrary, true).is_err());
    assert_eq!(fs::read_dir(arbitrary).unwrap().count(), 0);
}

#[test]
fn refuses_malformed_roots_and_intermediate_junctions() {
    for invalid in [
        "",
        "  ",
        "bad\0name",
        "market-data.sqlite3",
        r"E:\",
        r"E:\safe\..\escape",
    ] {
        assert!(validate_path(invalid).is_err(), "{invalid:?}");
    }
    let sandbox = fixture();
    let real = sandbox.path().join("real");
    fs::create_dir(&real).unwrap();
    create_database(&real.join("database"), "market-data.sqlite3");
    let junction = sandbox.path().join("junction");
    let output = Command::new("cmd")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(&junction)
        .arg(&real)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(PinnedTree::open(&junction).is_err());
    assert!(PinnedTree::open(&junction.join("database")).is_err());
    fs::remove_dir(junction).unwrap();
    assert!(real.join("database/market-data.sqlite3").is_file());
}

#[test]
fn rejects_actual_windows_symlink_when_available() {
    use std::os::windows::fs::symlink_dir;
    let sandbox = fixture();
    let real = sandbox.path().join("real");
    create_database(&real, "market-data.sqlite3");
    let symlink = sandbox.path().join("link");
    match symlink_dir(&real, &symlink) {
        Err(error) if error.raw_os_error() == Some(1314) => {
            println!("SKIP Windows symlink fixture: host lacks symlink privilege");
            return;
        }
        result => result.unwrap(),
    }
    assert!(PinnedTree::open(&symlink).is_err());
    fs::remove_dir(symlink).unwrap();
}

#[test]
fn pinned_root_and_intermediate_cannot_be_replaced_and_sqlite_handles_are_detected() {
    let sandbox = fixture();
    let parent = sandbox.path().join("parent");
    fs::create_dir(&parent).unwrap();
    let target = parent.join("database");
    create_database(&target, "market-data.sqlite3");
    let tree = PinnedTree::open(&target).unwrap();
    assert!(fs::rename(&target, parent.join("moved")).is_err());
    assert!(fs::rename(&parent, sandbox.path().join("moved")).is_err());
    let db = target.join("market-data.sqlite3");
    let connection = Connection::open(&db).unwrap();
    assert!(tree.pin_database(&db, identity(&db).unwrap()).is_err());
    drop(connection);
    assert!(tree.pin_database(&db, identity(&db).unwrap()).is_ok());
    drop(tree);
    fs::rename(&target, parent.join("moved")).unwrap();
}

#[test]
fn marker_survives_failure_before_removal_and_partial_loss_with_or_without_sqlite() {
    let sandbox = fixture();
    for (failure, binary_survives, sqlite_survives) in [
        ("binary.eod", true, true),
        ("market-data.sqlite3", false, true),
        ("database", false, false),
    ] {
        let iteration = tempfile::tempdir_in(sandbox.path()).unwrap();
        let state = iteration.path().join("state");
        fs::create_dir(&state).unwrap();
        let target = iteration.path().join("database");
        create_database(&target, "market-data.sqlite3");
        fs::create_dir_all(target.join("eod_data/NSE")).unwrap();
        fs::write(target.join("eod_data/NSE/binary.eod"), b"fixture").unwrap();
        let tree = PinnedTree::open(&target).unwrap();
        write_markers(
            &state,
            &[Marker {
                id: tree.id,
                path: target.canonicalize().unwrap(),
            }],
        )
        .unwrap();
        let result = remove(tree, Some(Path::new(failure))).unwrap_err();
        assert_eq!(result.removed == 0, binary_survives);
        assert_eq!(
            target.join("eod_data/NSE/binary.eod").exists(),
            binary_survives
        );
        assert_eq!(target.join("market-data.sqlite3").exists(), sqlite_survives);
        assert!(blocked_in(&state, &target).unwrap());
        let renamed = iteration.path().join("renamed");
        fs::rename(&target, &renamed).unwrap();
        assert!(blocked_in(&state, &renamed).unwrap());
        assert!(!blocked_in(&state, &state).unwrap());
    }
}

#[test]
fn use_permit_survives_handoff_and_excludes_other_processes() {
    let sandbox = fixture();
    if let Some(dir) = std::env::var_os("EOD_DB_SAFE_LOCK_FIXTURE") {
        assert_eq!(
            database_use::acquire_in(Path::new(&dir), true).unwrap_err(),
            database_use::BUSY
        );
        return;
    }
    let state = sandbox.path();
    let path = database_use::DatabasePath::new(
        state.to_path_buf(),
        database_use::acquire_in(state, false).unwrap(),
    );
    let queued = path.clone();
    let second_reader = database_use::acquire_in(state, false).unwrap();
    drop(path);
    let child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "database::database_deletion::tests::use_permit_survives_handoff_and_excludes_other_processes"])
        .env("EOD_DB_SAFE_LOCK_FIXTURE", state).output().unwrap();
    assert!(
        child.status.success(),
        "{}",
        String::from_utf8_lossy(&child.stdout)
    );
    assert_eq!(
        database_use::acquire_in(state, true).unwrap_err(),
        database_use::BUSY
    );
    drop(second_reader);
    drop(queued);
    let exclusive = database_use::acquire_in(state, true).unwrap();
    assert_eq!(
        database_use::acquire_in(state, false).unwrap_err(),
        database_use::BUSY
    );
    drop(exclusive);
    assert!(database_use::acquire_in(state, false).is_ok());
}

#[test]
fn fresh_process_refuses_marked_roots_and_descendants() {
    if let Some(state) = std::env::var_os("EOD_DB_SAFE_MARKER_FIXTURE") {
        let root = PathBuf::from(state);
        assert!(blocked_in(&root, &root.join("damaged")).unwrap());
        assert!(blocked_in(&root, &root.join("damaged/reference-data/nested")).unwrap());
        assert!(!blocked_in(&root, &root.join("healthy")).unwrap());
        return;
    }
    let sandbox = fixture();
    let root = sandbox.path();
    let damaged = root.join("damaged");
    create_database(&damaged, "market-data.sqlite3");
    fs::create_dir(damaged.join("reference-data")).unwrap();
    create_database(&damaged.join("reference-data/nested"), "market-data.sqlite3");
    create_database(&root.join("healthy"), "market-data.sqlite3");
    write_markers(root, &[Marker { id: identity(&damaged).unwrap(), path: damaged.canonicalize().unwrap() }]).unwrap();
    let child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "database::database_deletion::tests::fresh_process_refuses_marked_roots_and_descendants"])
        .env("EOD_DB_SAFE_MARKER_FIXTURE", root).output().unwrap();
    assert!(child.status.success(), "{}", String::from_utf8_lossy(&child.stdout));
}
