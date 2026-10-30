//! Bounded, opt-in read-only profiling on the marked disposable real-data copy.
use super::*;
use std::collections::BTreeMap;
use std::time::Instant;

fn measured<T>(timings: &mut BTreeMap<String, f64>, name: &str, work: impl FnOnce() -> T) -> T {
    let start = Instant::now();
    let value = work();
    timings.insert(name.to_string(), start.elapsed().as_secs_f64() * 1_000.0);
    value
}

#[test]
#[ignore = "bounded component profile; requires CA_BENCH_DISPOSABLE_ROOT pointing to a marked copy"]
fn ca_dividend_component_profile() {
    let root = super::super::real_data_performance_tests::disposable_root();
    let folder = root.join("snapshot");
    let variant =
        std::env::var("CA_BENCH_PROFILE_VARIANT").unwrap_or_else(|_| "baseline".to_string());
    assert!(matches!(
        variant.as_str(),
        "baseline"
            | "baseline-verify"
            | "indexed"
            | "indexed-analyzed"
            | "stats-only"
            | "query-fix"
    ));
    let sql_folder = if variant == "stats-only" {
        root.join("dividend-statistics")
    } else if variant.starts_with("indexed") {
        root.join("dividend-indexed")
    } else {
        folder.clone()
    };
    let output = root.join(format!("dividend-component-profile-{variant}.json"));
    assert!(!output.exists(), "Keep existing measurement evidence");
    let connection = crate::database::open_read_only_connection_for_folder(&sql_folder).unwrap();
    let before = super::super::real_data_performance_tests::protected_state(&connection);
    let mut statement = connection
        .prepare(
            "SELECT id FROM corporate_action_imports WHERE action_type='DIVIDEND'
         AND parse_status='PARSED' AND review_status='PENDING'
         ORDER BY COALESCE(ex_date,record_date,imported_at) DESC, imported_at DESC,id DESC",
        )
        .unwrap();
    let ids = statement
        .query_map([], |row| row.get::<_, i64>(0))
        .unwrap()
        .collect::<rusqlite::Result<Vec<_>>>()
        .unwrap();
    assert!(ids.len() >= 12);
    let positions = [
        0,
        1,
        2,
        ids.len() / 8,
        ids.len() / 4,
        ids.len() / 3,
        ids.len() / 2,
        2 * ids.len() / 3,
        3 * ids.len() / 4,
        ids.len() - 3,
        ids.len() - 2,
        ids.len() - 1,
    ];
    let mut totals = BTreeMap::<String, f64>::new();
    let mut samples = Vec::new();
    for position in positions {
        let import_id = ids[position];
        let mut timings = BTreeMap::new();
        let eligibility = measured(&mut timings, "full_policy", || {
            evaluate_simple_cash_dividend_policy_r1(&connection, &folder, import_id)
        })
        .unwrap();
        let policy_result = format!("{eligibility:?}");
        let outcome = match eligibility {
            SimpleCashDividendPolicyEligibility::Eligible(_) => "ELIGIBLE".to_string(),
            SimpleCashDividendPolicyEligibility::Ineligible(reason) => {
                format!("INELIGIBLE: {reason}")
            }
            SimpleCashDividendPolicyEligibility::AlreadyApproved => "ALREADY_APPROVED".to_string(),
        };
        let row = measured(&mut timings, "import_lookup", || {
            get_import_row(&connection, import_id)
        })
        .unwrap();
        measured(&mut timings, "official_evidence", || {
            load_exact_simple_cash_dividend_official_evidence(&connection, &row)
        })
        .unwrap();
        measured(&mut timings, "forbidden_decision", || {
            has_forbidden_decision(&connection, import_id)
        })
        .unwrap();
        let conflict = measured(&mut timings, "legacy_identity_conflict", || {
            has_legacy_manual_raw_event_identity_conflict(&connection, &row)
        })
        .unwrap();
        measured(&mut timings, "identity_proof", || {
            machine_identity_proof(&connection, &row, conflict)
        })
        .unwrap();
        measured(&mut timings, "same_date_exclusion", || {
            same_date_automatic_exclusion_peer(&connection, &row)
        })
        .unwrap();
        measured(&mut timings, "canonical_duplicate", || {
            find_existing_corporate_action(&connection, &row)
        })
        .unwrap();
        let context = measured(&mut timings, "instrument_context", || {
            crate::database::eod_data::resolve_instrument_context(
                &connection,
                row.symbol.as_deref().unwrap(),
                &row.exchange,
            )
        })
        .unwrap();
        if let Some(context) = context {
            // A policy ineligibility is a valid result; this diagnostic does not approve anything.
            let _basis = measured(&mut timings, "dividend_price_basis", || {
                crate::database::instrument_mutations::load_dividend_adjustment_basis(
                    &connection,
                    Some(&folder),
                    &context,
                    row.ex_date.as_deref().unwrap(),
                    row.cash_amount,
                )
            });
        }
        for (name, milliseconds) in &timings {
            *totals.entry(name.clone()).or_default() += milliseconds;
        }
        println!("CA_DIV_PROFILE id={import_id} position={position} outcome={outcome} milliseconds={timings:?}");
        samples.push(serde_json::json!({"import_id":import_id,"position":position,"outcome":outcome,"policy_result":policy_result,"milliseconds":timings}));
    }
    assert_eq!(
        before,
        super::super::real_data_performance_tests::protected_state(&connection)
    );
    let result = serde_json::json!({"variant":variant,"sample_count":samples.len(),"pending_dividend_count":ids.len(),
        "method":"Each full policy call timed first; component calls timed separately afterward, including functions an ineligible full policy may short-circuit. Component totals are diagnostic, not an exclusive breakdown of full_policy.",
        "samples":samples,"component_totals_ms":totals,"protected_state_unchanged":true});
    std::fs::write(output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    println!(
        "CA_DIV_PROFILE COMPLETE samples={} totals_ms={totals:?} protected_state=PASS",
        positions.len()
    );
}
