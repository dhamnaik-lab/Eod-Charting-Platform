//! Opt-in headless preparation timing on an explicitly marked disposable snapshot.
//! No Fetch, AppHandle, IPC, rendering, or financial approval is exercised.
use super::*;
use std::collections::BTreeMap;
use std::hash::{Hash, Hasher};
use std::time::Instant;

// Bounded before/after comparison of the two read commands' connection lifetimes.
fn sample_read_batches(
    folder: &Path,
    hint_batches: &[Vec<i64>],
    reuse: bool,
) -> (Value, Vec<Value>) {
    let started = Instant::now();
    let cached = reuse.then(|| open_connection_for_folder(folder, false).unwrap());
    let initialization_seconds = started.elapsed().as_secs_f64();
    let mut outcomes = Vec::new();
    let started = Instant::now();
    for offset in [0, 16_000, 32_000] {
        let reopened;
        let connection = match cached.as_ref() {
            Some(connection) => connection,
            None => {
                reopened = open_connection_for_folder(folder, true).unwrap();
                &reopened
            }
        };
        let rows = list_import_rows(
            connection,
            Some(&CorporateActionImportListInput {
                review_status: None,
                action_types: None,
                search_query: None,
                exclude_approved: Some(true),
                limit: Some(1_000),
                offset: Some(offset),
            }),
        )
        .unwrap();
        outcomes.push(serde_json::to_value(rows).unwrap());
    }
    let enumeration_seconds = started.elapsed().as_secs_f64();
    let started = Instant::now();
    for ids in hint_batches {
        let reopened;
        let connection = match cached.as_ref() {
            Some(connection) => connection,
            None => {
                reopened = open_connection_for_folder(folder, true).unwrap();
                &reopened
            }
        };
        let result = list_corporate_action_import_resolution_hints_internal(
            connection,
            &CorporateActionImportResolutionHintsInput {
                import_ids: ids.clone(),
            },
        )
        .unwrap();
        outcomes.push(serde_json::to_value(result).unwrap());
    }
    let hints_seconds = started.elapsed().as_secs_f64();
    (
        serde_json::json!({
            "initialization_seconds": initialization_seconds,
            "enumeration_seconds": enumeration_seconds, "hints_seconds": hints_seconds,
            "total_seconds": initialization_seconds + enumeration_seconds + hints_seconds,
        }),
        outcomes,
    )
}

#[test]
#[ignore = "bounded read-command benchmark; requires a marked disposable real-data snapshot"]
fn ca_queue_hint_connection_reuse_benchmark() {
    let root = disposable_root();
    let snapshot = root.join("snapshot");
    let database_name = super::super::DATABASE_FILE_NAME;
    let output = root.join("queue-hint-reuse-results.json");
    assert!(!output.exists(), "Preserve existing benchmark evidence");
    // Only copy a quiescent disposable snapshot, never the live operator DB.
    let wal = snapshot.join(format!("{database_name}-wal"));
    assert!(fs::metadata(wal).map(|m| m.len() == 0).unwrap_or(true));
    let source_bytes = fs::read(snapshot.join(database_name)).unwrap();
    let source = open_read_only_connection_for_folder(&snapshot).unwrap();
    let before = protected_state(&source);
    let ids = source
        .prepare(
            "SELECT id FROM corporate_action_imports
        WHERE review_status IN ('UNRESOLVED','PENDING_ISIN_MISMATCH') ORDER BY id",
        )
        .unwrap()
        .query_map([], |row| row.get::<_, i64>(0))
        .unwrap()
        .collect::<rusqlite::Result<Vec<_>>>()
        .unwrap();
    assert!(ids.len() >= 300);
    let batches = [0, ids.len() / 2, ids.len() - 100].map(|start| ids[start..start + 100].to_vec());
    let mut measurements = Vec::new();
    for round in 0..2 {
        let old = root.join(format!("read-reopen-{round}"));
        let new = root.join(format!("read-reuse-{round}"));
        for folder in [&old, &new] {
            fs::create_dir(folder).unwrap();
            fs::copy(snapshot.join(database_name), folder.join(database_name)).unwrap();
            let connection = Connection::open(folder.join(database_name)).unwrap();
            // The snapshot already contains the financial-write guards installed
            // by the earlier preparation benchmark; require them on each copy.
            let guards: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                WHERE type='trigger' AND name LIKE 'ca_bench_no_%'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(guards, 7);
            assert_eq!(before, protected_state(&connection));
        }
        let (old_result, new_result) = if round == 0 {
            (
                sample_read_batches(&old, &batches, false),
                sample_read_batches(&new, &batches, true),
            )
        } else {
            let new_result = sample_read_batches(&new, &batches, true);
            (sample_read_batches(&old, &batches, false), new_result)
        };
        assert_eq!(
            old_result.1, new_result.1,
            "Exact page rows and identity-hint parity"
        );
        for folder in [&old, &new] {
            let connection = open_read_only_connection_for_folder(folder).unwrap();
            assert_eq!(before, protected_state(&connection));
        }
        println!(
            "CA_READ round={} reopen={} reuse={} parity=PASS",
            round + 1,
            old_result.0,
            new_result.0
        );
        measurements.push(
            serde_json::json!({"round":round + 1,"reopen":old_result.0,"reuse":new_result.0}),
        );
    }
    assert_eq!(before, protected_state(&source));
    assert_eq!(
        source_bytes,
        fs::read(snapshot.join(database_name)).unwrap()
    );
    fs::write(
        output,
        serde_json::to_vec_pretty(&serde_json::json!({
            "pages_per_strategy_per_round":3,"hints_per_strategy_per_round":300,
            "measurements":measurements,"exact_parity":true,"protected_state_unchanged":true,
            "snapshot_main_file_unchanged":true,
        }))
        .unwrap(),
    )
    .unwrap();
}

pub(super) fn protected_state(connection: &Connection) -> u64 {
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    for sql in [
        "SELECT * FROM corporate_actions ORDER BY id",
        "SELECT * FROM eod_prices ORDER BY rowid",
        "SELECT id,review_status,approved_corporate_action_id,approved_at FROM corporate_action_imports WHERE review_status='APPROVED' OR approved_corporate_action_id IS NOT NULL ORDER BY id",
    ] {
        let mut statement = connection.prepare(sql).unwrap();
        let columns = statement.column_count();
        let mut rows = statement.query([]).unwrap();
        while let Some(row) = rows.next().unwrap() {
            for column in 0..columns {
                format!("{:?}", row.get_ref(column).unwrap()).hash(&mut hash);
            }
        }
    }
    hash.finish()
}

fn protect_financial_tables(connection: &Connection) {
    for table in ["corporate_actions", "eod_prices"] {
        for operation in ["INSERT", "UPDATE", "DELETE"] {
            connection.execute_batch(&format!(
                "CREATE TRIGGER ca_bench_no_{table}_{operation} BEFORE {operation} ON {table}
                 BEGIN SELECT RAISE(ABORT,'Financial/price writes forbidden in preparation benchmark'); END;"
            )).unwrap();
        }
    }
    connection
        .execute_batch(
            "CREATE TRIGGER ca_bench_no_approval BEFORE UPDATE ON corporate_action_imports
         WHEN (NEW.review_status='APPROVED' AND OLD.review_status<>'APPROVED')
           OR NEW.approved_corporate_action_id IS NOT OLD.approved_corporate_action_id
           OR NEW.approved_at IS NOT OLD.approved_at
         BEGIN SELECT RAISE(ABORT,'Approval forbidden in preparation benchmark'); END;",
        )
        .unwrap();
}

fn sample_matches(folder: &Path, ids: &[i64], reuse: bool) -> (f64, Vec<Value>) {
    let started = Instant::now();
    let cached = reuse.then(|| open_connection_for_folder(folder, false).unwrap());
    let mut outcomes = Vec::new();
    for &import_id in ids {
        let reopened;
        let connection = match cached.as_ref() {
            Some(connection) => connection,
            None => {
                reopened = open_connection_for_folder(folder, false).unwrap();
                &reopened
            }
        };
        let result = run_connection_transaction(connection, |connection| {
            quick_resolve_corporate_action_import_internal(
                connection,
                &CorporateActionImportQuickResolveInput { import_id },
            )
        })
        .unwrap();
        let row = result.import_record;
        assert!(row.approved_corporate_action_id.is_none());
        outcomes.push(serde_json::json!([
            row.id,
            row.review_status,
            row.symbol,
            row.exchange,
            row.isin
        ]));
    }
    (started.elapsed().as_secs_f64(), outcomes)
}

pub(super) fn disposable_root() -> std::path::PathBuf {
    // Canonicalize for containment checks only. Windows canonical paths carry
    // a verbatim prefix that the application's SQLite URI encoder cannot use.
    let operational = std::path::PathBuf::from(std::env::var("CA_BENCH_DISPOSABLE_ROOT").unwrap());
    assert!(operational.is_absolute());
    assert!(!operational.to_string_lossy().starts_with(r"\\?\"));
    let root = fs::canonicalize(&operational).unwrap();
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    assert!(root.starts_with(fs::canonicalize(project.join("tmp")).unwrap()));
    assert!(root
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("ca-real-data-"));
    let marker: Value =
        serde_json::from_slice(&fs::read(root.join("CA_BENCH_DISPOSABLE.json")).unwrap()).unwrap();
    let source = fs::canonicalize(marker["source"].as_str().unwrap()).unwrap();
    assert!(!root.starts_with(&source) && !source.starts_with(&root));
    let folder = operational.join("snapshot");
    assert!(folder.join("database.json").is_file() && folder.join("eod_data").is_dir());
    assert!(
        !root.join("real-data-results.json").exists(),
        "Use a fresh copy for every run"
    );
    operational
}

#[test]
#[ignore = "requires CA_BENCH_DISPOSABLE_ROOT pointing to a marked copy under this project's tmp folder"]
fn ca_real_data_preparation_benchmark() {
    let root = disposable_root();
    let folder = root.join("snapshot");

    let connection = open_connection_for_folder(&folder, false).unwrap();
    let before = protected_state(&connection);
    protect_financial_tables(&connection);
    drop(connection);
    let mut timings = BTreeMap::<&str, f64>::new();
    let mut errors = Vec::<String>::new();

    // Match the renderer's 1,000-row pagination and each command's connection lifetime.
    let start = Instant::now();
    let mut rows = Vec::new();
    let mut offset = 0;
    loop {
        let connection = open_connection_for_folder(&folder, true).unwrap();
        let page = list_import_rows(
            &connection,
            Some(&CorporateActionImportListInput {
                review_status: None,
                action_types: None,
                search_query: None,
                exclude_approved: Some(true),
                limit: Some(1_000),
                offset: Some(offset),
            }),
        )
        .unwrap();
        let count = page.len();
        rows.extend(page);
        if count < 1_000 {
            break;
        }
        offset += 1_000;
    }
    timings.insert("enumeration", start.elapsed().as_secs_f64());
    println!(
        "CA_REAL enumeration rows={} seconds={:.3}",
        rows.len(),
        timings["enumeration"]
    );
    let unresolved = rows
        .iter()
        .filter(|row| {
            matches!(
                row.review_status.as_str(),
                "UNRESOLVED" | "PENDING_ISIN_MISMATCH"
            )
        })
        .map(|row| row.id)
        .collect::<Vec<_>>();
    let start = Instant::now();
    let mut hints = HashMap::new();
    for batch in unresolved.chunks(100) {
        let connection = open_connection_for_folder(&folder, true).unwrap();
        let result = list_corporate_action_import_resolution_hints_internal(
            &connection,
            &CorporateActionImportResolutionHintsInput {
                import_ids: batch.to_vec(),
            },
        )
        .unwrap();
        hints.extend(result.hints.into_iter().map(|hint| (hint.import_id, hint)));
        println!(
            "CA_REAL hints {}/{} elapsed_seconds={:.3}",
            hints.len(),
            unresolved.len(),
            start.elapsed().as_secs_f64()
        );
    }
    timings.insert("hints", start.elapsed().as_secs_f64());
    let resolvable = unresolved
        .iter()
        .copied()
        .filter(|id| {
            hints.get(id).is_some_and(|hint| {
                hint.quick_resolvable
                    && hint.status == "ONE_ACTIVE"
                    && hint
                        .top_suggestion_symbol
                        .as_ref()
                        .is_some_and(|s| !s.is_empty())
                    && hint
                        .top_suggestion_exchange
                        .as_ref()
                        .is_some_and(|s| !s.is_empty())
            })
        })
        .collect::<Vec<_>>();

    // Paired samples on identical DB copies; deliberately excluded from pipeline time.
    let mut samples = Vec::new();
    for round in 0..3 {
        let sample_start = round * resolvable.len() / 3;
        let ids = &resolvable[sample_start..(sample_start + 10).min(resolvable.len())];
        assert!(
            !ids.is_empty(),
            "No matching candidates available for paired timing"
        );
        let old = root.join(format!("reopen-{round}"));
        let new = root.join(format!("reuse-{round}"));
        for path in [&old, &new] {
            fs::create_dir(path).unwrap();
            fs::copy(
                folder.join(super::super::DATABASE_FILE_NAME),
                path.join(super::super::DATABASE_FILE_NAME),
            )
            .unwrap();
        }
        let (old_result, new_result) = if round % 2 == 0 {
            (
                sample_matches(&old, ids, false),
                sample_matches(&new, ids, true),
            )
        } else {
            let new_result = sample_matches(&new, ids, true);
            (sample_matches(&old, ids, false), new_result)
        };
        assert_eq!(
            old_result.1, new_result.1,
            "Matching identity/status parity"
        );
        for path in [&old, &new] {
            let connection = Connection::open(path.join(super::super::DATABASE_FILE_NAME)).unwrap();
            assert_eq!(before, protected_state(&connection));
        }
        println!(
            "CA_REAL sample round={} count={} reopen_seconds={:.3} reuse_seconds={:.3} parity=PASS",
            round + 1,
            ids.len(),
            old_result.0,
            new_result.0
        );
        samples.push(serde_json::json!({"round":round+1,"count":ids.len(),"reopen_seconds":old_result.0,"reuse_seconds":new_result.0}));
    }

    let start = Instant::now();
    let connection = open_connection_for_folder(&folder, false).unwrap();
    let mut positions = rows
        .iter()
        .enumerate()
        .map(|(index, row)| (row.id, index))
        .collect::<HashMap<_, _>>();
    for (index, &import_id) in resolvable.iter().enumerate() {
        match run_connection_transaction(&connection, |connection| {
            quick_resolve_corporate_action_import_internal(
                connection,
                &CorporateActionImportQuickResolveInput { import_id },
            )
        }) {
            Ok(result) => rows[*positions.get_mut(&import_id).unwrap()] = result.import_record,
            Err(error) => errors.push(format!("match {import_id}: {error}")),
        }
        if (index + 1) % 100 == 0 || index + 1 == resolvable.len() {
            println!(
                "CA_REAL matching {}/{} elapsed_seconds={:.3} errors={}",
                index + 1,
                resolvable.len(),
                start.elapsed().as_secs_f64(),
                errors.len()
            );
        }
    }
    drop(connection);
    timings.insert("matching", start.elapsed().as_secs_f64());

    // Identity hints are already present for every remaining ISIN-review row.
    assert!(rows
        .iter()
        .filter(|row| row.review_status == "PENDING_ISIN_MISMATCH")
        .all(|row| hints.contains_key(&row.id)));
    let validation_ids = rows
        .iter()
        .filter(|row| {
            row.parse_status == "PARSED"
                && row.review_status != "APPROVED"
                && row.symbol.as_ref().is_some_and(|s| !s.is_empty())
                && row.ex_date.as_ref().is_some_and(|s| !s.is_empty())
                && (matches!(row.action_type.as_str(), "DIVIDEND" | "RIGHTS")
                    || (matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
                        && row.factor.is_some()))
        })
        .map(|row| row.id)
        .collect::<Vec<_>>();
    let start = Instant::now();
    let mut scanned = 0;
    for batch in validation_ids.chunks(500) {
        let connection = open_connection_for_folder(&folder, false).unwrap();
        match run_corporate_action_scan_internal(
            &connection,
            &folder,
            Some(&CorporateActionScanInput {
                scope: Some("official_imports".into()),
                import_ids: Some(batch.to_vec()),
            }),
        ) {
            Ok(result) => scanned += result.results.len(),
            Err(error) => errors.push(format!("scan: {error}")),
        }
        println!(
            "CA_REAL scan results={scanned} targets={} elapsed_seconds={:.3}",
            validation_ids.len(),
            start.elapsed().as_secs_f64()
        );
    }
    timings.insert("eod_scan", start.elapsed().as_secs_f64());

    let dividends = rows
        .iter()
        .filter(|row| {
            row.action_type == "DIVIDEND"
                && row.parse_status == "PARSED"
                && row.review_status == "PENDING"
        })
        .map(|row| row.id)
        .collect::<Vec<_>>();
    let start = Instant::now();
    let mut dispositions = BTreeMap::<String, usize>::new();
    let mut reasons = BTreeMap::<String, usize>::new();
    let mut verified = 0;
    for batch in dividends.chunks(100) {
        let connection = open_read_only_connection_for_folder(&folder).unwrap();
        let result = auto_approval::evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &auto_approval::SimpleCashDividendPreparedScopeInput {
                import_ids: batch.to_vec(),
                expected_database_path: folder.to_string_lossy().into_owned(),
            },
        )
        .unwrap();
        assert!(result.complete);
        for item in result.dispositions {
            *dispositions.entry(item.disposition).or_default() += 1;
            *reasons.entry(item.reason).or_default() += 1;
        }
        verified += batch.len();
        println!(
            "CA_REAL dividend {verified}/{} elapsed_seconds={:.3}",
            dividends.len(),
            start.elapsed().as_secs_f64()
        );
    }
    timings.insert("dividend_verification", start.elapsed().as_secs_f64());
    let connection = open_read_only_connection_for_folder(&folder).unwrap();
    assert_eq!(
        before,
        protected_state(&connection),
        "Financial/price/approval state must remain unchanged"
    );
    let result = serde_json::json!({"profile":"unoptimized Rust test; headless; approval disabled",
        "pending_rows":rows.len(),"unresolved_rows":unresolved.len(),"matching_targets":resolvable.len(),
        "scan_targets":validation_ids.len(),"scan_results":scanned,"dividend_targets":dividends.len(),
        "stage_seconds":timings,"pipeline_seconds":timings.values().sum::<f64>(),"paired_matching_samples":samples,
        "dividend_dispositions":dispositions,"dividend_reasons":reasons,"errors":errors,"protected_state_unchanged":true});
    fs::write(
        root.join("real-data-results.json"),
        serde_json::to_vec_pretty(&result).unwrap(),
    )
    .unwrap();
    println!("CA_REAL COMPLETE pipeline_seconds={:.3} stages={timings:?} dispositions={dispositions:?} errors={} protected_state=PASS",timings.values().sum::<f64>(),errors.len());
    assert!(
        errors.is_empty(),
        "See disposable real-data-results.json for preparation errors"
    );
}

/// Finish the read-only stage after a harness-only interruption, without replaying
/// matching or discarding completed timings. Requires a checkpoint recovered from
/// the saved log and independently checked against the completed scan-run records.
#[test]
#[ignore = "requires a marked disposable copy and preparation-checkpoint.json"]
fn ca_real_data_dividend_benchmark_resume() {
    let root = disposable_root();
    let folder = root.join("snapshot");
    let mut result: Value =
        serde_json::from_slice(&fs::read(root.join("preparation-checkpoint.json")).unwrap())
            .unwrap();
    let baseline = open_read_only_connection_for_folder(&root.join("reopen-0")).unwrap();
    let before = protected_state(&baseline);
    drop(baseline);
    let connection = open_read_only_connection_for_folder(&folder).unwrap();
    assert_eq!(
        before,
        protected_state(&connection),
        "Completed preparation preserved financial state"
    );
    let mut ids = Vec::new();
    let mut offset = 0;
    loop {
        let page = list_import_rows(
            &connection,
            Some(&CorporateActionImportListInput {
                review_status: Some("PENDING".into()),
                action_types: Some(vec!["DIVIDEND".into()]),
                search_query: None,
                exclude_approved: Some(true),
                limit: Some(1_000),
                offset: Some(offset),
            }),
        )
        .unwrap();
        let count = page.len();
        ids.extend(
            page.into_iter()
                .filter(|row| row.parse_status == "PARSED")
                .map(|row| row.id),
        );
        if count < 1_000 {
            break;
        }
        offset += 1_000;
    }
    assert_eq!(
        ids.len() as u64,
        result["dividend_targets"].as_u64().unwrap()
    );
    drop(connection);
    let start = Instant::now();
    let mut dispositions = BTreeMap::<String, usize>::new();
    let mut reasons = BTreeMap::<String, usize>::new();
    let mut verified = 0;
    for batch in ids.chunks(100) {
        let connection = open_read_only_connection_for_folder(&folder).unwrap();
        let evaluated = auto_approval::evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &connection,
            &folder,
            &auto_approval::SimpleCashDividendPreparedScopeInput {
                import_ids: batch.to_vec(),
                expected_database_path: folder.to_string_lossy().into_owned(),
            },
        )
        .unwrap();
        assert!(evaluated.complete);
        for item in evaluated.dispositions {
            *dispositions.entry(item.disposition).or_default() += 1;
            *reasons.entry(item.reason).or_default() += 1;
        }
        verified += batch.len();
        println!(
            "CA_REAL_RESUME dividend {verified}/{} elapsed_seconds={:.3}",
            ids.len(),
            start.elapsed().as_secs_f64()
        );
    }
    let seconds = start.elapsed().as_secs_f64();
    let connection = open_read_only_connection_for_folder(&folder).unwrap();
    assert_eq!(
        before,
        protected_state(&connection),
        "Dividend verification preserved financial state"
    );
    result["stage_seconds"]["dividend_verification"] = serde_json::json!(seconds);
    let total = result["stage_seconds"]
        .as_object()
        .unwrap()
        .values()
        .map(|v| v.as_f64().unwrap())
        .sum::<f64>();
    result["pipeline_seconds"] = serde_json::json!(total);
    result["dividend_dispositions"] = serde_json::json!(dispositions);
    result["dividend_reasons"] = serde_json::json!(reasons);
    result["protected_state_unchanged"] = serde_json::json!(true);
    fs::write(
        root.join("real-data-results.json"),
        serde_json::to_vec_pretty(&result).unwrap(),
    )
    .unwrap();
    println!("CA_REAL_RESUME COMPLETE combined_stage_seconds={total:.3} dividend_seconds={seconds:.3} dispositions={dispositions:?} protected_state=PASS");
}
