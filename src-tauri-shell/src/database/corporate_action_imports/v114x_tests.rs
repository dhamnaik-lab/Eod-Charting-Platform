use std::fs;
use std::path::PathBuf;

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read_source(relative: &str) -> String {
    let path = manifest_dir().join(relative);
    fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()))
}

#[test]
fn v114x_red_live_apply_path_is_registered_end_to_end() {
    let corporate = read_source("src/database/corporate_action_imports.rs");
    let database = read_source("src/database.rs");
    let main = read_source("src/main.rs");
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation_apply.rs");

    let mut missing = Vec::<String>::new();

    if !module_path.is_file() {
        missing.push("five_pair_consolidation_apply.rs does not exist".to_string());
    }
    if !corporate.contains("mod five_pair_consolidation_apply;") {
        missing.push(
            "corporate_action_imports.rs does not register the V1.14X Apply module".to_string(),
        );
    }
    if !corporate.contains(
        "five_pair_consolidation_apply::try_run_five_pair_consolidation_apply_maintenance",
    ) {
        missing.push(
            "corporate_action_imports.rs does not re-export the V1.14X Apply runner".to_string(),
        );
    }
    if !database.contains("try_run_five_pair_consolidation_apply_maintenance") {
        missing.push("database.rs does not re-export the V1.14X Apply runner".to_string());
    }
    if !main.contains("try_run_five_pair_consolidation_apply_maintenance(std::env::args())") {
        missing.push("main.rs does not dispatch the V1.14X Apply runner".to_string());
    }

    assert!(
        missing.is_empty(),
        "V1.14X live Apply path is not implemented: {}",
        missing.join("; ")
    );
}

#[test]
fn v114x_red_apply_contract_is_exact_plan_locked_and_explicitly_authorized() {
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation_apply.rs");

    let source = fs::read_to_string(&module_path).unwrap_or_else(|_| {
        panic!(
            "V1.14X live Apply module is missing: {}",
            module_path.display()
        )
    });

    for required in [
        "--maintenance-corporate-action-v114x",
        "--mode",
        "apply",
        "--v114w-apply-plan",
        "--backup-manifest",
        "--live-apply-ack",
        "V1.14X_LIVE_APPLY_AUTHORIZED",
        "B926042A76323C273C48BFD5A21C60D609F78091EC6B3111EE47DE788EC4CB96",
        "8953723E83FE67351C6463A9D856A4B28C230D7088C22C638A815B44E110967B",
        "1094511FFFAA18AA338A1A45EBAB3D2D2641AA68A210069E7CF3FF412D929E7B",
        "C700F5B8622FFEA89569E6B5AF514A189229E3F338BE46056DC15CF8D6D173D7",
    ] {
        assert!(
            source.contains(required),
            "V1.14X Apply source is missing required exact authorization contract: {required}"
        );
    }
}

#[test]
fn v114x_red_apply_requires_verified_backup_and_immediate_transaction() {
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation_apply.rs");

    let source = fs::read_to_string(&module_path).unwrap_or_else(|_| {
        panic!(
            "V1.14X live Apply module is missing: {}",
            module_path.display()
        )
    });

    for required in [
        "TransactionBehavior::Immediate",
        "verified",
        "source_database_family",
        "backup_directory",
        "created_at",
        "main_sha256",
        "wal_sha256",
        "shm_sha256",
        "quick_check",
        "foreign_key_check",
    ] {
        assert!(
            source.contains(required),
            "V1.14X Apply source is missing required backup/transaction safety contract: {required}"
        );
    }
}

#[test]
fn v114x_red_apply_contract_names_exact_five_pairs_and_protected_state() {
    let apply_source_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation_apply.rs");
    let common_source =
        read_source("src/database/corporate_action_imports/five_pair_consolidation.rs");
    let apply_source = fs::read_to_string(&apply_source_path).unwrap_or_else(|_| {
        panic!(
            "V1.14X live Apply module is missing: {}",
            apply_source_path.display()
        )
    });

    let combined = format!("{common_source}\n{apply_source}");
    for required in [
        "42737",
        "1232",
        "42779",
        "3799",
        "42818",
        "6362",
        "42855",
        "9005",
        "42863",
        "9582",
        "10947",
        "1736",
        "4670",
        "5353",
        "corporate_action_import_evidence",
        "DELETE FROM corporate_action_imports",
    ] {
        assert!(
            combined.contains(required),
            "V1.14X exact-pair/protected-state contract missing: {required}"
        );
    }
}
