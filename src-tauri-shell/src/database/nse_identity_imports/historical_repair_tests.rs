use super::*;

#[test]
#[ignore = "requires a pinned retained fixture, never the active database"]
fn guarded_historical_fixture_replay() {
    let root = PathBuf::from(
        std::env::var("EOD_NSE_HISTORICAL_REPAIR_FIXTURE").expect("fixture env required"),
    );
    let canonical = root.canonicalize().unwrap();
    let project = Path::new(r"E:\TA Projects\EOD Charting Platform")
        .canonicalize()
        .unwrap();
    assert!(canonical.starts_with(project.join("tmp")));
    assert!(root
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("nse-historical-repair-"));
    assert!(root.join("HISTORICAL_REPAIR_FIXTURE_ONLY.txt").is_file());
    let db = root.join("fixture.sqlite3");
    let before_hash = sha256_hex_bytes(&std::fs::read(&db).unwrap());
    let connection = Connection::open(&db).unwrap();
    let before_history: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM instrument_identity_history",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let input = NseHistoricalIdentityPreviewInput {
        archive_root_path: Some(root.join("sources").display().to_string()),
    };
    let preview = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
    let after_history: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM instrument_identity_history",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(before_history, after_history, "preview must roll back");
    assert_eq!(
        before_hash,
        sha256_hex_bytes(&std::fs::read(&db).unwrap()),
        "preview changed fixture DB bytes"
    );
    let baseline =
        std::env::var("EOD_NSE_HISTORICAL_REPAIR_STAGE").unwrap_or_default() == "baseline";
    let report_path = root.join(if baseline {
        "baseline-preview.json"
    } else {
        "repaired-preview.json"
    });
    std::fs::write(report_path, serde_json::to_vec_pretty(&preview).unwrap()).unwrap();
    println!("HISTORICAL_FIXTURE_RESULT can_apply={} new_symbol={} new_name={} new_both={} duplicate={} skipped={} errors={} details={:?}",
        preview.can_apply, preview.new_symbol_changes, preview.new_name_changes, preview.new_combined_changes,
        preview.duplicate_rows, preview.skipped_rows, preview.error_rows, preview.errors);
    if baseline {
        assert!(preview.error_rows > 0);
        return;
    }
    assert!(
        preview.can_apply,
        "repaired preview remains blocked: {:?}",
        preview.errors
    );
    if std::env::var("EOD_NSE_HISTORICAL_REPAIR_STAGE").unwrap_or_default() != "apply" {
        return;
    }
    drop(connection);
    let tag = chrono::Utc::now()
        .timestamp_nanos_opt()
        .unwrap()
        .to_string();
    let applied_db = root.join(format!("applied-{tag}.sqlite3"));
    assert!(!applied_db.exists());
    std::fs::copy(&db, &applied_db).unwrap();
    let connection = Connection::open(&applied_db).unwrap();
    let financial_before = financial_digest(&connection);
    let raw_before = raw_hashes(&root);
    let inactive_before = inactive_symbols(&connection);
    let snapshot = load_nse_historical_identity_source_snapshot(&input).unwrap();
    let current_symbols = snapshot
        .current_universe_rows
        .iter()
        .map(|r| r.symbol.clone())
        .collect::<HashSet<_>>();
    let prior = super::super::eod_data::resolve_instrument_context(&connection, "AMIRCHAND", "NSE")
        .unwrap()
        .unwrap();
    assert_eq!(prior.current_symbol, "AMIRCHAND");
    assert!(
        super::super::eod_data::resolve_instrument_context(&connection, "SGBNOV23", "NSE").is_err()
    );
    println!("HISTORICAL_FIXTURE_APPLY starting on second retained DB only");
    let applied = apply_nse_historical_identity_archive_internal(
        &connection,
        &NseHistoricalIdentityApplyInput {
            archive_root_path: input.archive_root_path.clone(),
            expected_plan_sha256: preview.plan_sha256.clone(),
        },
    )
    .unwrap();
    assert!(applied.applied);
    let run_id = applied
        .run_id
        .as_deref()
        .expect("Apply must save a receipt");
    let report = historical_reporting::read_report(&connection, run_id).unwrap();
    assert_eq!(report["applied"], true);
    assert_eq!(report["planSha256"], applied.plan_sha256);
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM historical_identity_apply_run_rows WHERE run_id=?",
                params![run_id],
                |r| r.get::<_, u32>(0)
            )
            .unwrap(),
        applied.new_symbol_changes + applied.new_name_changes + applied.new_combined_changes
    );
    let history = historical_reporting::read_history(&connection).unwrap();
    assert_eq!(history["runs"].as_array().unwrap().len(), 1);
    assert!(history["runs"][0].get("historyRows").is_none());
    let mut category_counts = std::collections::BTreeMap::<String, usize>::new();
    for evidence in applied.category_evidence.as_ref().unwrap().values() {
        *category_counts
            .entry(evidence.category.clone())
            .or_default() += 1;
    }
    println!(
        "HISTORICAL_REPORTING_RECEIPT run_id={} linked_changes={} categories={:?}",
        run_id,
        applied.new_symbol_changes + applied.new_name_changes + applied.new_combined_changes,
        category_counts
    );
    let context =
        super::super::eod_data::resolve_instrument_context(&connection, "AMIRCHAND", "NSE")
            .unwrap()
            .unwrap();
    assert_eq!(context.current_symbol, "AEROPLANE");
    assert!(context.resolved_from_alias);
    assert!(context
        .symbol_transitions
        .iter()
        .any(|t| t.old_symbol.as_deref() == Some("AMIRCHAND")
            && t.new_symbol.as_deref() == Some("AEROPLANE")
            && t.effective_date == "2026-07-20"));
    let bars = super::super::eod_data::load_unified_price_rows(
        &root,
        &connection,
        &context,
        "1900-01-01",
        "2100-12-31",
    )
    .unwrap();
    assert_eq!(bars.len(), 140);
    assert_eq!(bars.last().unwrap().date, "2026-10-26");
    assert!((bars.last().unwrap().close - 206.15).abs() < 0.0001);
    let old_active: i64 = connection
        .query_row(
            "SELECT is_active FROM instruments WHERE symbol='AMIRCHAND' AND exchange='NSE'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let old_lifecycle: String = connection
        .query_row(
            "SELECT lifecycle_status FROM instruments WHERE symbol='AMIRCHAND' AND exchange='NSE'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let current_active: i64 = connection
        .query_row(
            "SELECT is_active FROM instruments WHERE symbol='AEROPLANE' AND exchange='NSE'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!((old_active, current_active), (0, 1));
    assert_eq!(old_lifecycle, "OLD_SYMBOL");
    assert_eq!(financial_before, financial_digest(&connection));
    assert_eq!(raw_before, raw_hashes(&root));
    let inactive_after = inactive_symbols(&connection);
    let unsupported_reactivations = inactive_before
        .difference(&inactive_after)
        .filter(|symbol| !current_symbols.contains(*symbol))
        .collect::<Vec<_>>();
    assert!(
        unsupported_reactivations.is_empty(),
        "historical metadata reactivated absent rows: {:?}",
        unsupported_reactivations
    );
    assert!(
        super::super::eod_data::resolve_instrument_context(&connection, "SGBNOV23", "NSE").is_err(),
        "same-day chronology guard must remain strict"
    );
    let applied_hash = sha256_hex_bytes(&std::fs::read(&applied_db).unwrap());
    println!("HISTORICAL_FIXTURE_APPLY committed; testing unchanged repeat preview");
    let repeat = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
    assert!(repeat.can_apply);
    assert_eq!(repeat.error_rows, 0);
    assert_eq!(
        repeat.new_symbol_changes + repeat.new_name_changes + repeat.new_combined_changes,
        0,
        "repeat must not propose the same events again"
    );
    assert_eq!(
        applied_hash,
        sha256_hex_bytes(&std::fs::read(&applied_db).unwrap())
    );
    let proof = serde_json::json!({ "appliedDatabase": applied_db, "applied": applied,
        "repeat": repeat, "oldActive": old_active, "currentActive": current_active, "oldLifecycle": old_lifecycle,
        "chartCurrentSymbol": context.current_symbol, "chartBars": bars.len(), "latestClose": bars.last().unwrap().close,
        "financialDigestUnchanged": true, "rawHashesUnchanged": true, "sameDayGuardStillRejects": true });
    std::fs::write(
        root.join(format!("apply-proof-{tag}.json")),
        serde_json::to_vec_pretty(&proof).unwrap(),
    )
    .unwrap();
    println!("HISTORICAL_FIXTURE_PROOF old_active={old_active} old_lifecycle={old_lifecycle} current_active={current_active} canonical={} bars={} repeat_new=0 financial/raw unchanged", context.current_symbol, bars.len());
}

fn inactive_symbols(connection: &Connection) -> HashSet<String> {
    connection
        .prepare("SELECT symbol FROM instruments WHERE exchange='NSE' AND is_active=0")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<HashSet<_>, _>>()
        .unwrap()
}

fn financial_digest(connection: &Connection) -> String {
    let mut bytes = String::new();
    for table in [
        "corporate_actions",
        "corporate_action_import_decisions",
        "corporate_action_event_identity_resolutions",
    ] {
        let mut statement = connection
            .prepare(&format!("SELECT * FROM {table} ORDER BY rowid"))
            .unwrap();
        let columns = statement.column_count();
        let mut rows = statement.query([]).unwrap();
        while let Some(row) = rows.next().unwrap() {
            for column in 0..columns {
                bytes.push_str(&format!("{:?}|", row.get_ref(column).unwrap()));
            }
            bytes.push('\n');
        }
    }
    sha256_hex_bytes(bytes.as_bytes())
}

fn raw_hashes(root: &Path) -> Vec<String> {
    ["AMIRCHAND", "AEROPLANE"]
        .iter()
        .map(|symbol| {
            sha256_hex_bytes(
                &std::fs::read(root.join("eod_data/NSE").join(format!("{symbol}.eod"))).unwrap(),
            )
        })
        .collect()
}
