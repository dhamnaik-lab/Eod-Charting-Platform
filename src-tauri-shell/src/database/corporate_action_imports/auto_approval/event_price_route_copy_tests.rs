//! Explicit opt-in, marked copy only. Every simulated financial write rolls back.
use super::*;
use std::{cell::RefCell, collections::BTreeMap, fs};

fn state(c: &Connection) -> BTreeMap<String, String> {
    let tables: Vec<String> = c.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").unwrap()
        .query_map([],|r|r.get(0)).unwrap().collect::<Result<_,_>>().unwrap();
    let mut result = BTreeMap::new();
    for name in tables {
        let table = format!("\"{}\"", name.replace('"', "\"\""));
        let mut keys: Vec<(String, i64)> = c
            .prepare(&format!("PRAGMA table_info({table})"))
            .unwrap()
            .query_map([], |r| Ok((r.get(1)?, r.get(5)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        keys.retain(|(_, position)| *position > 0);
        keys.sort_by_key(|(_, position)| *position);
        let order = if keys.is_empty() {
            "rowid".to_string()
        } else {
            keys.iter()
                .map(|(key, _)| format!("\"{}\"", key.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(",")
        };
        let mut statement = c
            .prepare(&format!("SELECT * FROM {table} ORDER BY {order}"))
            .unwrap();
        let width = statement.column_count();
        let mut rows = statement.query([]).unwrap();
        let mut hash = Sha256::new();
        while let Some(row) = rows.next().unwrap() {
            for i in 0..width {
                hash.update(format!("{:?}\n", row.get_ref(i).unwrap()).as_bytes());
            }
        }
        result.insert(name, format!("{:x}", hash.finalize()));
    }
    result
}

#[test]
#[ignore = "Explicit marked-copy event-price-route audit; forced rollback, no live writer"]
fn event_price_route_guarded_copy_acceptance() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .canonicalize()
        .unwrap();
    let folder = std::path::PathBuf::from(std::env::var("CA_EVENT_PRICE_ROUTE_COPY").unwrap())
        .canonicalize()
        .unwrap();
    assert_eq!(
        folder,
        repo.join("tmp/ca-event-price-route-20261025-r1")
            .canonicalize()
            .unwrap()
    );
    assert_eq!(
        fs::read_to_string(folder.join("AUDIT.txt")).unwrap(),
        "CA_EVENT_PRICE_ROUTE_COPY_R1"
    );
    let receipt =
        std::env::var("CA_EVENT_PRICE_ROUTE_RECEIPT").unwrap_or_else(|_| "acceptance.json".into());
    assert!(matches!(
        receipt.as_str(),
        "acceptance.json" | "acceptance-final.json"
    ));
    let output = folder.join(receipt);
    assert!(!output.exists(), "Do not overwrite an acceptance receipt");
    let manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(folder.join("manifest.json")).unwrap()).unwrap();
    let source = repo.join("EOD DATABASE/Nse").canonicalize().unwrap();
    assert_ne!(folder, source);
    let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
    c.execute_batch("PRAGMA query_only=ON").unwrap();
    let before = state(&c);
    let mut eligible = Vec::new();
    let mut rows = Vec::new();
    for id in manifest["ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_i64().unwrap())
    {
        let row = get_import_row(&c, id).unwrap();
        let route = super::super::event_price_route::resolve(&c, &folder, &row);
        let route_result = match route {
            Ok(Some(route)) => format!("VERIFIED:{}", route.fingerprint()),
            Ok(None) => "EXISTING_ROUTE_OR_NO_NEW_PROOF".into(),
            Err(reason) => reason,
        };
        let policy = if row.action_type == "DIVIDEND" {
            match evaluate_simple_cash_dividend_policy_r1(&c, &folder, id).unwrap() {
                SimpleCashDividendPolicyEligibility::Eligible(_) => {
                    eligible.push(id);
                    "ELIGIBLE".to_string()
                }
                SimpleCashDividendPolicyEligibility::Ineligible(reason) => reason,
                SimpleCashDividendPolicyEligibility::AlreadyApproved => "ALREADY_APPROVED".into(),
            }
        } else {
            "NON_DIVIDEND_FINANCIAL_FLOW_NOT_EXECUTED".into()
        };
        rows.push(serde_json::json!({"importId":id,"symbol":row.symbol,"date":row.ex_date,"action":row.action_type,"route":route_result,"policy":policy}));
    }
    assert!(
        !eligible.is_empty(),
        "No newly routed production-eligible dividends; do not claim acceptance"
    );
    assert!(
        eligible.contains(&44439),
        "HEGAM July dividend must have a verified route and pass all R1 gates on the copy"
    );
    assert!(eligible.len() <= 100);
    let expected_database_path = folder.to_string_lossy().to_string();
    let input = SimpleCashDividendWriteStageInput {
        import_ids: eligible.clone(),
        expected_database_path: expected_database_path.clone(),
        expected_policy_version: SIMPLE_CASH_DIVIDEND_POLICY_VERSION.into(),
        expected_scope_version: SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION.into(),
        expected_write_stage_version: SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION.into(),
        expected_scope_fingerprint: simple_cash_dividend_prepared_scope_fingerprint(
            &expected_database_path,
            &eligible,
        ),
    };
    c.execute_batch("PRAGMA query_only=OFF").unwrap();
    let observed = RefCell::new(None);
    let error = super::super::run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &c,
        &folder,
        &input,
        |c, folder, input| {
            let result = execute_simple_cash_dividend_write_stage_in_connection(c, folder, input)?;
            if result.failed == 0 {
                let import = get_import_row(c, 44439)?;
                let context =
                    crate::database::eod_data::resolve_instrument_context(c, "HEGAM", "NSE")?
                        .unwrap();
                let action = context
                    .corporate_actions
                    .iter()
                    .find(|a| Some(a.id) == import.approved_corporate_action_id)
                    .unwrap();
                let raw = crate::database::eod_data::load_unified_price_rows(
                    folder,
                    c,
                    &context,
                    "2026-07-21",
                    "2026-07-22",
                )?;
                assert_eq!(raw.len(), 2);
                assert_eq!(raw[0].symbol, "HEG");
                assert_eq!(raw[0].close, 604.95);
                let adjusted = crate::database::eod_data::apply_corporate_adjustments(
                    raw.clone(),
                    &[action.clone()],
                    true,
                    false,
                )?;
                assert_eq!(
                    adjusted[0].close,
                    crate::database::round_price(raw[0].close / action.factor)
                );
                assert_eq!(adjusted[1].close, raw[1].close);
                assert!(!crate::database::eod_data::build_chart_events(
                    &context,
                    "2026-07-22",
                    "2026-07-22"
                )
                .is_empty());
            }
            observed.replace(Some(result));
            Err("EVENT_PRICE_ROUTE_AUDIT_ALWAYS_ROLLBACK".into())
        },
    )
    .unwrap_err();
    assert!(error.starts_with("CA_DIVIDEND_ROLLBACK_CONFIRMED:"));
    let observed = observed.into_inner().unwrap();
    assert_eq!(observed.failed, 0, "{:?}", observed.dispositions);
    assert_eq!(observed.auto_approved as usize, eligible.len());
    assert_eq!(
        before,
        state(&c),
        "All main tables must be unchanged after rollback"
    );
    for (symbol, digest) in manifest["priceHashes"].as_object().unwrap() {
        for root in [&folder, &source] {
            let actual = format!(
                "{:x}",
                Sha256::digest(
                    fs::read(root.join("eod_data/NSE").join(format!("{symbol}.eod"))).unwrap()
                )
            );
            assert_eq!(digest.as_str().unwrap(), actual);
        }
    }
    let result = serde_json::json!({"rows":rows,"candidateEvents":manifest["ids"].as_array().unwrap().len(),"eligibleDividends":eligible,
        "simulatedApprovalsBeforeForcedRollback":observed.auto_approved,"writerFailures":observed.failed,"allCopyMainTablesUnchanged":true,"sourceAndCopyPriceHashesUnchanged":true,"liveWrites":false,
        "hegamProductionChartPathChecked":true,
        "scope":"Actual candidate copy; no live approvals. Non-Dividend financial approval not exercised."});
    fs::write(&output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    println!(
        "EVENT_PRICE_ROUTE_COPY {}",
        serde_json::json!({"candidateEvents":result["candidateEvents"],"eligibleDividends":observed.auto_approved,"writerFailures":observed.failed,"allCopyMainTablesUnchanged":true,"sourceAndCopyPriceHashesUnchanged":true,"liveWrites":false})
    );
}
