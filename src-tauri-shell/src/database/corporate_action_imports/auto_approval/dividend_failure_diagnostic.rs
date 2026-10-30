//! Opt-in diagnosis only: production writer on a marked copy, always rolled back.
use super::*;
use std::{cell::RefCell, collections::BTreeMap, fs};

fn state(c: &Connection) -> BTreeMap<String, String> {
    let tables: Vec<String> = c.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").unwrap()
        .query_map([], |r| r.get(0)).unwrap().collect::<Result<_, _>>().unwrap();
    let mut result = BTreeMap::new();
    for table in tables {
        let quoted = format!("\"{}\"", table.replace('"', "\"\""));
        let info: Vec<(String, i64)> = c
            .prepare(&format!("PRAGMA table_info({quoted})"))
            .unwrap()
            .query_map([], |r| Ok((r.get(1)?, r.get(5)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        let mut keys: Vec<_> = info.iter().filter(|(_, position)| *position > 0).collect();
        keys.sort_by_key(|(_, position)| *position);
        let order = if keys.is_empty() {
            "rowid".into()
        } else {
            keys.iter()
                .map(|(name, _)| format!("\"{}\"", name.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(",")
        };
        let mut s = c
            .prepare(&format!("SELECT * FROM {quoted} ORDER BY {order}"))
            .unwrap();
        let width = s.column_count();
        let mut rows = s.query([]).unwrap();
        let mut h = Sha256::new();
        while let Some(row) = rows.next().unwrap() {
            for i in 0..width {
                h.update(format!("{:?}\n", row.get_ref(i).unwrap()).as_bytes());
            }
        }
        result.insert(table, format!("{:x}", h.finalize()));
    }
    result
}

#[test]
#[ignore = "Explicit first-All-Ready-batch diagnosis; marked SQL copy and copied prices; no live writes"]
fn dividend_all_ready_first_batch_copy_diagnostic() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .canonicalize()
        .unwrap();
    let folder = std::path::PathBuf::from(std::env::var("CA_DIVIDEND_FAILURE_COPY").unwrap())
        .canonicalize()
        .unwrap();
    assert_eq!(
        folder,
        repo.join("tmp/ca-dividend-approval-diagnostic-20261024")
            .canonicalize()
            .unwrap()
    );
    assert_eq!(
        fs::read_to_string(folder.join("AUDIT.txt")).unwrap().trim(),
        "CA_DIVIDEND_APPROVAL_COPY_ONLY"
    );
    let output = folder.join("diagnostic.json");
    assert!(!output.exists());
    let source = repo.join("EOD DATABASE/Nse").canonicalize().unwrap();
    assert_ne!(folder, source);
    let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
    c.execute_batch("PRAGMA query_only=ON").unwrap();
    let before = state(&c);
    // Normal loading preserves descending ex-date order; UI column sorting is
    // presentation-only. Each selected write batch is then ID-sorted by protocol.
    let candidates: Vec<i64> = c.prepare("SELECT id FROM corporate_action_imports
        WHERE exchange='NSE' AND source='NSE_API' AND action_type='DIVIDEND'
        AND parse_status='PARSED' AND review_status='PENDING' AND approved_corporate_action_id IS NULL
        ORDER BY COALESCE(ex_date,record_date,imported_at) DESC,imported_at DESC,id DESC").unwrap()
        .query_map([], |r| r.get(0)).unwrap().collect::<Result<_, _>>().unwrap();
    let mut ids = Vec::new();
    let mut inspected = 0;
    let mut preflight = Vec::new();
    for id in candidates {
        inspected += 1;
        // BinaryEodFile::open is read-only. Only this evaluator sees the source
        // price folder; the production writer below receives the copy folder.
        if matches!(
            evaluate_simple_cash_dividend_policy_r1(&c, &source, id).unwrap(),
            SimpleCashDividendPolicyEligibility::Eligible(_)
        ) {
            ids.push(id);
            let row = get_import_row(&c, id).unwrap();
            if let Err(error) = super::super::ensure_official_import_eod_ready(
                &c,
                &source,
                &row,
                row.symbol.as_deref().unwrap(),
                row.ex_date.as_deref().unwrap(),
            ) {
                preflight
                    .push(serde_json::json!({"importId":id,"symbol":row.symbol,"reason":error}));
            }
        }
        if ids.len() == 100 {
            break;
        }
    }
    assert_eq!(
        ids.len(),
        100,
        "Could not reconstruct a complete first batch"
    );
    let dir = folder.join("eod_data/NSE");
    fs::create_dir_all(&dir).unwrap();
    let mut copied = BTreeMap::new();
    for id in &ids {
        let row = get_import_row(&c, *id).unwrap();
        let context = crate::database::eod_data::resolve_instrument_context(
            &c,
            row.symbol.as_deref().unwrap(),
            "NSE",
        )
        .unwrap()
        .unwrap();
        for symbol in context.related_symbols {
            assert_eq!(Path::new(&symbol).components().count(), 1);
            if copied.contains_key(&symbol) {
                continue;
            }
            let from = source.join("eod_data/NSE").join(format!("{symbol}.eod"));
            if !from.is_file() {
                continue;
            }
            let hash = format!("{:x}", Sha256::digest(fs::read(&from).unwrap()));
            let to = dir.join(format!("{symbol}.eod"));
            assert!(!to.exists());
            fs::copy(&from, &to).unwrap();
            assert_eq!(
                hash,
                format!("{:x}", Sha256::digest(fs::read(&to).unwrap()))
            );
            copied.insert(symbol, hash);
        }
    }
    let copied_policy_eligible = ids
        .iter()
        .filter(|id| {
            matches!(
                evaluate_simple_cash_dividend_policy_r1(&c, &folder, **id).unwrap(),
                SimpleCashDividendPolicyEligibility::Eligible(_)
            )
        })
        .count();
    let expected_database_path = folder.display().to_string();
    let input = SimpleCashDividendWriteStageInput {
        import_ids: ids.clone(),
        expected_database_path: expected_database_path.clone(),
        expected_policy_version: SIMPLE_CASH_DIVIDEND_POLICY_VERSION.into(),
        expected_scope_version: SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION.into(),
        expected_write_stage_version: SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION.into(),
        expected_scope_fingerprint: simple_cash_dividend_prepared_scope_fingerprint(
            &expected_database_path,
            &ids,
        ),
    };
    c.execute_batch("PRAGMA query_only=OFF").unwrap();
    let observed = RefCell::new(None);
    let outer = super::super::run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &c,
        &folder,
        &input,
        |c, folder, input| {
            let result = execute_simple_cash_dividend_write_stage_in_connection(c, folder, input)?;
            observed.replace(Some(result.clone()));
            if result.failed == 0 && result.complete {
                // Even a successful diagnostic must never commit approval data.
                return Err("DIAGNOSTIC_ALWAYS_ROLLBACK".into());
            }
            Ok(result)
        },
    );
    assert!(outer.is_err());
    assert_eq!(
        before,
        state(&c),
        "Diagnostic failed to roll back every main table"
    );
    for (symbol, hash) in &copied {
        assert_eq!(
            hash,
            &format!(
                "{:x}",
                Sha256::digest(fs::read(dir.join(format!("{symbol}.eod"))).unwrap())
            )
        );
        assert_eq!(
            hash,
            &format!(
                "{:x}",
                Sha256::digest(
                    fs::read(source.join("eod_data/NSE").join(format!("{symbol}.eod"))).unwrap()
                )
            )
        );
    }
    let observed = observed.into_inner();
    let failed_rows: Vec<_> = observed.as_ref().into_iter().flat_map(|r| r.dispositions.iter()).filter(|d| d.disposition == "FAILED")
        .map(|d| {
            let row = get_import_row(&c, d.import_id).unwrap();
            serde_json::json!({"importId":d.import_id,"symbol":row.symbol,"exDate":row.ex_date,"cashAmount":row.cash_amount,"reason":d.reason})
        }).collect();
    let result = serde_json::json!({"scope":"reconstructed first 100 eligible dividends in normal All Ready load order; original IPC request was not retained",
        "inspected":inspected,"ids":ids,"copyPolicyEligible":copied_policy_eligible,
        "priceFilesCopied":copied.len(),"writerReadinessFailures":preflight,"failedRows":failed_rows,
        "observed":observed.as_ref().map(|r|serde_json::json!({"requested":r.requested,"approvedBeforeRollback":r.auto_approved,"failed":r.failed,"ineligible":r.ineligible,"complete":r.complete})),
        "outerError":outer.err(),"allCopyMainTablesUnchanged":true,"priceHashesUnchanged":true,"liveWrites":false});
    fs::write(&output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    println!("DIVIDEND_DIAGNOSTIC {}", result);
}
