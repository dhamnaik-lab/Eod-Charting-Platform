use std::fs;
use std::path::{Path, PathBuf};

fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri-shell must have a project-root parent")
        .to_path_buf()
}

fn read_project_file(relative: &str) -> String {
    fs::read_to_string(project_root().join(relative))
        .unwrap_or_else(|error| panic!("Could not read {relative}: {error}"))
}

#[test]
fn v114y_red_targeted_latest_official_scan_list_contract_is_declared() {
    let database = read_project_file("src-tauri-shell/src/database.rs");
    let backend = read_project_file("src-tauri-shell/src/database/corporate_action_imports.rs");

    assert!(
        database.contains("pub import_ids: Option<Vec<i64>>"),
        "V1.14Y-A requires CorporateActionScanListInput.import_ids for targeted read-only validation hydration"
    );
    assert!(
        backend.contains("fn normalize_scan_list_import_ids("),
        "V1.14Y-A requires explicit targeted scan-list import-ID validation"
    );
    assert!(
        backend.contains("fn list_latest_completed_official_scan_results("),
        "V1.14Y-A requires authoritative latest completed official_imports scan lookup"
    );
    assert!(
        backend.contains("candidate_run.scope = 'official_imports'")
            && backend.contains("candidate_run.status = 'COMPLETED'"),
        "V1.14Y-A targeted lookup must ignore blind/incomplete scan runs"
    );
}

#[test]
fn v114y_red_approved_view_hydrates_and_replaces_validation_cache() {
    let desktop = read_project_file("src/types/desktop.ts");
    let ui = read_project_file("src/components/DatabaseToolsDialogs.tsx");

    assert!(
        desktop.contains("importIds?: number[] | null;"),
        "V1.14Y-A renderer contract must expose targeted scan-list import IDs"
    );
    // The batched hydration loop now lives in the shared import-operations module.
    let operations = read_project_file(
        "src/features/corporateActions/legacy/corporateActionImportOperations.ts",
    );
    assert!(
        ui.contains("loadCorporateActionImportRows(")
            && ui.contains("includeApprovedValidation: view === 'approved'")
            && operations.contains("const APPROVED_VALIDATION_BATCH_SIZE = 500;")
            && operations.contains(
                "for (let start = 0; start < validationImportIds.length; start += APPROVED_VALIDATION_BATCH_SIZE)"
            )
            && operations.contains("listCorporateActionScanResults({ importIds: batch })"),
        "V1.14Y-A Approved view must hydrate validation evidence in backend-safe targeted batches"
    );
    assert!(
        ui.contains("mergeOfficialValidationRows(validationRows, validationImportIds)"),
        "V1.14Y-A Approved view must replace cached validation rows for every requested import ID, including missing results"
    );
}
