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
fn v114w_red_rust_maintenance_path_is_registered_end_to_end() {
    let corporate = read_source("src/database/corporate_action_imports.rs");
    let database = read_source("src/database.rs");
    let main = read_source("src/main.rs");
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation.rs");

    let mut missing = Vec::<String>::new();

    if !module_path.is_file() {
        missing.push("five_pair_consolidation.rs does not exist".to_string());
    }
    if !corporate.contains("mod five_pair_consolidation;") {
        missing.push("corporate_action_imports.rs does not register five_pair_consolidation".to_string());
    }
    if !corporate.contains(
        "five_pair_consolidation::try_run_five_pair_consolidation_maintenance",
    ) {
        missing.push("corporate_action_imports.rs does not re-export the V1.14W maintenance runner".to_string());
    }
    if !database.contains("try_run_five_pair_consolidation_maintenance") {
        missing.push("database.rs does not re-export the V1.14W maintenance runner".to_string());
    }
    if !main.contains("try_run_five_pair_consolidation_maintenance(std::env::args())") {
        missing.push("main.rs does not dispatch the V1.14W maintenance runner".to_string());
    }

    assert!(
        missing.is_empty(),
        "V1.14W Rust maintenance path is not implemented: {}",
        missing.join("; ")
    );
}

#[test]
fn v114w_red_maintenance_contract_is_dry_run_only_and_fingerprint_locked() {
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation.rs");

    let source = fs::read_to_string(&module_path).unwrap_or_else(|_| {
        panic!(
            "V1.14W dry-run maintenance module is missing: {}",
            module_path.display()
        )
    });

    for required in [
        "--maintenance-corporate-action-v114w",
        "dry-run",
        "6D6F6B15FE86C7D31A333F8097D69E5AF970F0E7A3981E9930A59CB10DF53C95",
        "1094511FFFAA18AA338A1A45EBAB3D2D2641AA68A210069E7CF3FF412D929E7B",
        "40297583AC3B77F4C36C4689A9B13A5F56897D76A5F30FFE5E4C2DC12A3CB218",
        "C700F5B8622FFEA89569E6B5AF514A189229E3F338BE46056DC15CF8D6D173D7",
    ] {
        assert!(
            source.contains(required),
            "V1.14W maintenance source is missing required locked contract: {required}"
        );
    }

    assert!(
        !source.contains("MaintenanceMode::Apply") && !source.contains("\"apply\" =>"),
        "V1.14W must not expose a live Apply mode"
    );
}

#[test]
fn v114w_red_exact_pair_and_transaction_safety_contract_is_declared() {
    let module_path = manifest_dir()
        .join("src/database/corporate_action_imports/five_pair_consolidation.rs");
    let source = fs::read_to_string(&module_path).unwrap_or_else(|_| {
        panic!(
            "V1.14W consolidation module is missing: {}",
            module_path.display()
        )
    });

    for required in [
        "42737", "1232",
        "42779", "3799",
        "42818", "6362",
        "42855", "9005",
        "42863", "9582",
        "10947", "1736", "4670", "5353",
        "corporate_action_import_evidence",
        "DELETE FROM corporate_action_imports",
        "foreign_key_check",
        "quick_check",
    ] {
        assert!(
            source.contains(required),
            "V1.14W source is missing required exact-pair/safety contract: {required}"
        );
    }
}

#[test]
fn v114w_sha256_file_uses_heap_buffer_for_real_maintenance_path() {
    let source = read_source("src/database/corporate_action_imports/five_pair_consolidation.rs");

    assert!(
        !source.contains("let mut buffer = [0u8; 1024 * 1024];"),
        "V1.14W sha256_file must not allocate a 1 MiB fixed array on the maintenance thread stack"
    );
    assert!(
        source.contains("let mut buffer = vec![0u8; 1024 * 1024];"),
        "V1.14W sha256_file must keep the 1 MiB hash buffer on the heap"
    );
}