use super::*;
use chrono::{Days, NaiveDate};
use rusqlite::{params, Connection};
use std::cell::Cell;

fn request() -> NativeScanRequestV1 {
    use super::super::ast::{EvaluationV1, PriceBasisV1, RuleV1, UniverseSourceV1, UniverseV1};
    NativeScanRequestV1 {
        schema_version: 1,
        requested_run_id: "fixture".into(),
        universe: UniverseV1 {
            source: UniverseSourceV1::ExplicitTargets,
            targets: vec![("NSE".into(), "TEST".into())],
        },
        evaluation: EvaluationV1 {
            as_of_date: None,
            lookback_bars: None,
            evaluate_history: true,
            price_basis: PriceBasisV1::Raw,
            include_dividend_adjustments: false,
            include_rights_adjustments: false,
        },
        rules: vec![
            RuleV1 {
                id: "always".into(),
                expression: ExprV1::Number { value: 1.0 },
            },
            RuleV1 {
                id: "never".into(),
                expression: ExprV1::Number { value: 0.0 },
            },
        ],
    }
}

#[test]
fn nsr7_v2_validates_only_explicit_raw_generic_requests() {
    let base = json!({
        "schemaVersion": 2, "requestedRunId": "fixture",
        "targets": [{"exchange": "NSE", "symbol": "TEST"}],
        "rules": [{"id": "r", "expression": {"kind": "number", "value": 1}}]
    });
    assert!(parse_request(base.clone()).is_ok());
    let mut adjusted = base.clone();
    adjusted["priceBasis"] = json!("adjusted");
    assert!(parse_request(adjusted).is_err());
    let mut duplicate = base.clone();
    duplicate["targets"] =
        json!([{"exchange":"NSE","symbol":"TEST"}, {"exchange":"nse","symbol":"test"}]);
    assert!(parse_request(duplicate).is_err());
    let mut reserved = base;
    reserved["rules"][0]["id"] = json!("top_gainers");
    assert!(parse_request(reserved).is_err());
}

#[test]
fn nsr7_v2_admits_only_one_trailing_settlement_suffix_on_bse_targets() {
    use super::super::ast::parse_native_scan_request_v1;

    let base = json!({
        "schemaVersion": 2, "requestedRunId": "settlement",
        "targets": [{"exchange": "bse", "symbol": "TCS#"}],
        "rules": [{"id": "r", "expression": {"kind": "number", "value": 1}}]
    });
    assert_eq!(
        parse_request(base.clone()).unwrap().universe.targets,
        [("bse".to_owned(), "TCS#".to_owned())]
    );
    let mut legacy = json!({
        "schemaVersion": 1, "requestedRunId": "settlement",
        "universe": {"source": "explicitTargets", "targets": base["targets"]},
        "evaluation": {"priceBasis": "raw", "evaluateHistory": true}, "rules": base["rules"]
    });
    assert!(parse_native_scan_request_v1(&legacy)
        .unwrap_err()
        .iter()
        .any(|issue| issue.path == "request.universe.targets[0].symbol"));
    legacy["universe"]["targets"][0]["symbol"] = json!("TCS");
    assert!(parse_native_scan_request_v1(&legacy).is_ok());
    let mut max_length = base.clone();
    max_length["targets"][0]["symbol"] = json!(format!("{}#", "A".repeat(127)));
    assert!(parse_request(max_length).is_ok());
    for (exchange, symbol) in [
        ("NSE", "TCS#"),
        ("BSE_INDEX", "TCS#"),
        ("BSE", "#"),
        ("BSE", "TCS##"),
        ("BSE", "TC#S"),
        ("BSE", "TCS #"),
        ("BSE", &format!("{}#", "A".repeat(128))),
    ] {
        let mut invalid = base.clone();
        invalid["targets"] = json!([{"exchange": exchange, "symbol": symbol}]);
        assert!(parse_request(invalid)
            .unwrap_err()
            .contains("targets[0].symbol"));
    }
    let mut duplicate = base.clone();
    duplicate["targets"] =
        json!([{"exchange":"BSE","symbol":"TCS#"}, {"exchange":"bse","symbol":"tcs#"}]);
    assert!(parse_request(duplicate).unwrap_err().contains("duplicate"));
    let mut invalid_rule = base.clone();
    invalid_rule["rules"][0]["id"] = json!("r#");
    assert!(parse_request(invalid_rule)
        .unwrap_err()
        .contains("rules[0].id"));
    let mut invalid_run = base;
    invalid_run["requestedRunId"] = json!("settlement#");
    assert!(parse_request(invalid_run)
        .unwrap_err()
        .contains("requestedRunId"));
}

#[test]
fn nsr7_v2_publishes_distinct_bse_regular_and_settlement_matches() {
    let fixture = tempfile::tempdir().unwrap();
    let folder = fixture.path();
    let connection = Connection::open(folder.join("market-data.sqlite3")).unwrap();
    crate::database::prepare_database_connection(&connection).unwrap();
    connection
        .execute_batch(
            "INSERT INTO instruments(symbol,exchange,isin) VALUES
             ('TCS','BSE','INE467B01029'), ('TCS#','BSE','INE467B01029');
             INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume) VALUES
             ('TCS','BSE','2026-11-19',9,9,9,9,1),
             ('TCS','BSE','2026-11-20',10,10,10,10,1),
             ('TCS#','BSE','2026-11-20',20,20,20,20,1);",
        )
        .unwrap();
    drop(connection);
    let input = parse_request(json!({
        "schemaVersion": 2, "requestedRunId": "settlement", "asOfDate": "2026-11-20",
        "targets": [{"exchange":"BSE","symbol":"TCS"}, {"exchange":"BSE","symbol":"TCS#"}],
        "rules": [{"id":"close","expression":{"kind":"field","field":"close","lookback":0}}]
    }))
    .unwrap();
    let source = ForwardSource::in_namespace(folder, folder).unwrap();
    let (spool, complete) =
        evaluate(&source, &input, "fixture#1".into(), || Ok(()), || false).unwrap();
    assert_eq!(
        (complete.bars, complete.matches, complete.coverage_rows),
        (3, 3, 2)
    );
    let matches = spool
        .page("settlement", "generation", PageKind::Matches, None)
        .unwrap();
    assert_eq!(
        matches.items,
        [
            json!({"date":20261120,"exchange":"BSE","symbol":"TCS","ruleId":"close","value":10.0}),
            json!({"date":20261120,"exchange":"BSE","symbol":"TCS#","ruleId":"close","value":20.0}),
            json!({"date":20261119,"exchange":"BSE","symbol":"TCS","ruleId":"close","value":9.0}),
        ]
    );
    let coverage = spool
        .page("settlement", "generation", PageKind::Coverage, None)
        .unwrap();
    assert_eq!(
        (
            &coverage.items[0]["symbol"],
            &coverage.items[0]["sourceBars"]
        ),
        (&json!("TCS"), &json!(2))
    );
    assert_eq!(
        (
            &coverage.items[1]["symbol"],
            &coverage.items[1]["sourceBars"]
        ),
        (&json!("TCS#"), &json!(1))
    );
}

#[cfg(all(windows, feature = "wp02-acceptance"))]
#[test]
fn wp02_acceptance_evaluates_from_the_guarded_source() {
    let fixture = fixture(700);
    let db = fixture.path().join("market-data.sqlite3");
    let before = std::fs::read(&db).unwrap();
    let source = ForwardSource::open_wp02_acceptance(fixture.path()).unwrap();
    let (_, complete) =
        evaluate(&source, &request(), "fixture#1".into(), || Ok(()), || false).unwrap();
    assert_eq!((complete.bars, complete.matches), (700, 700));
    drop(source);
    assert_eq!(std::fs::read(db).unwrap(), before);
    assert_eq!(std::fs::read_dir(fixture.path()).unwrap().count(), 1);
}

fn fixture(bars: usize) -> tempfile::TempDir {
    let fixture = tempfile::tempdir().unwrap();
    let mut connection = Connection::open(fixture.path().join("market-data.sqlite3")).unwrap();
    crate::database::prepare_database_connection(&connection).unwrap();
    connection
        .execute(
            "INSERT INTO instruments(symbol,exchange) VALUES('TEST','NSE')",
            [],
        )
        .unwrap();
    let transaction = connection.transaction().unwrap();
    let start = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
    {
        let mut insert = transaction.prepare("INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume) VALUES('TEST','NSE',?1,?2,?2,?2,?2,10)").unwrap();
        for day in 0..bars {
            let date = (start + Days::new(day as u64))
                .format("%Y-%m-%d")
                .to_string();
            insert.execute(params![date, day + 1]).unwrap();
        }
    }
    transaction.commit().unwrap();
    fixture
}

#[test]
fn nsr7_v2_evaluates_older_history_and_pages_exact_matches_and_coverage() {
    let fixture = fixture(5_103);
    let source = ForwardSource::in_namespace(fixture.path(), fixture.path()).unwrap();
    let (spool, completion) =
        evaluate(&source, &request(), "example#1".into(), || Ok(()), || false).unwrap();
    assert_eq!(
        (
            completion.bars,
            completion.matches,
            completion.evaluated_endpoints,
            completion.coverage_rows
        ),
        (5_103, 5_103, 10_206, 2)
    );
    let coverage = spool
        .page("fixture", "generation", PageKind::Coverage, None)
        .unwrap();
    assert_eq!(coverage.items[1]["ruleId"], "never");
    assert_eq!(coverage.items[1]["evaluatedEndpoints"], 5_103);
    let mut dates = Vec::new();
    let mut token = None;
    loop {
        let page = spool
            .page("fixture", "generation", PageKind::Matches, token.as_deref())
            .unwrap();
        let replay = spool
            .page("fixture", "generation", PageKind::Matches, token.as_deref())
            .unwrap();
        assert_eq!(
            serde_json::to_vec(&page).unwrap(),
            serde_json::to_vec(&replay).unwrap()
        );
        assert!(page.items.len() <= 1000);
        dates.extend(page.items.iter().map(|item| item["date"].as_u64().unwrap()));
        token = page.next_page_token;
        if token.is_none() {
            break;
        }
        assert!(spool
            .page(
                "fixture",
                "different generation",
                PageKind::Matches,
                token.as_deref()
            )
            .is_err());
        assert!(spool
            .page(
                "fixture",
                "generation",
                PageKind::Coverage,
                token.as_deref()
            )
            .is_err());
    }
    assert_eq!(dates.len(), 5_103);
    assert!(dates.windows(2).all(|pair| pair[0] > pair[1]));
    assert_eq!(dates.last(), Some(&20000101));
}

#[test]
fn nsr7_v2_dense_pages_are_bounded_by_serialized_bytes() {
    let spool = Spool::open().unwrap();
    for index in 0..150 {
        let id = format!("rule-{index:03}");
        spool
            .push(
                PageKind::Matches,
                20261120,
                ("NSE", "TEST", &id),
                &json!({ "id": id, "payload": "x".repeat(4_000) }),
            )
            .unwrap();
    }
    spool.finish().unwrap();
    let first = spool
        .page("fixture", "generation", PageKind::Matches, None)
        .unwrap();
    assert!(first.items.len() < 150 && first.items.len() > 1);
    assert!(serde_json::to_vec(&first).unwrap().len() <= 256 * 1024);
    let second = spool
        .page(
            "fixture",
            "generation",
            PageKind::Matches,
            first.next_page_token.as_deref(),
        )
        .unwrap();
    assert_ne!(first.items.last(), second.items.first());
}

#[test]
fn nsr7_v2_cancel_discards_staged_results_and_releases_the_slot() {
    let fixture = fixture(700);
    let source = ForwardSource::in_namespace(fixture.path(), fixture.path()).unwrap();
    let state = NumericHistoryState::default();
    let ticket = state.begin("fixture".into()).unwrap();
    let checks = Cell::new(0);
    let check = || {
        checks.set(checks.get() + 1);
        if checks.get() == 4 {
            state.close(Some("fixture"))?;
        }
        if ticket.stopped() {
            Err("cancelled".into())
        } else {
            Ok(())
        }
    };
    let result = evaluate(&source, &request(), "example#1".into(), check, || {
        ticket.stopped()
    });
    assert_eq!(result.err().as_deref(), Some("cancelled"));
    assert!(matches!(&*state.slot().unwrap(), Some(Slot::Running(_))));
    state.abandon(&ticket.key);
    assert!(state.slot().unwrap().is_none());
    assert!(state.begin("replacement".into()).is_ok());
    assert!(!AVAILABLE);
}

#[test]
fn nsr7_v2_publication_and_page_retrieval_respect_cancellation_and_reselection() {
    let fixture = fixture(1);
    let selected = NativeScanSelection::fixture(fixture.path(), 1).unwrap();
    let reselected = NativeScanSelection::fixture(fixture.path(), 3).unwrap();
    let state = NumericHistoryState::default();
    let ticket = state.begin("cancelled".into()).unwrap();
    let spool = Spool::open().unwrap();
    spool.finish().unwrap();
    assert!(state.close(Some("cancelled")).unwrap());
    assert!(state
        .publish(
            &ticket,
            selected.clone(),
            spool,
            Instant::now() + RESULT_TTL
        )
        .is_err());
    assert!(state
        .page_ready(Some(&selected), "cancelled", PageKind::Matches, None)
        .is_err());
    state.abandon(&ticket.key);

    let ticket = state.begin("complete".into()).unwrap();
    let spool = Spool::open().unwrap();
    spool
        .push(
            PageKind::Matches,
            20261120,
            ("NSE", "TEST", "always"),
            &json!({"value": 1}),
        )
        .unwrap();
    spool.finish().unwrap();
    state
        .publish(
            &ticket,
            selected.clone(),
            spool,
            Instant::now() + RESULT_TTL,
        )
        .unwrap();
    assert_eq!(
        state
            .page_ready(Some(&selected), "complete", PageKind::Matches, None)
            .unwrap()
            .items
            .len(),
        1
    );
    assert_eq!(
        state
            .page_ready(Some(&reselected), "complete", PageKind::Matches, None)
            .err()
            .as_deref(),
        Some(SELECTION_CHANGED)
    );
    assert!(state.slot().unwrap().is_none());
}

#[test]
fn nsr7_v2_spool_storage_quota_fails_explicitly() {
    let spool = Spool::open_with_page_limit(4).unwrap();
    let failure = spool
        .push(
            PageKind::Matches,
            20261120,
            ("NSE", "TEST", "always"),
            &json!({"payload": "x".repeat(128 * 1024)}),
        )
        .unwrap_err();
    assert!(failure.contains("storage limit exceeded"), "{failure}");
}

#[test]
fn nsr7_v2_expiry_releases_the_private_spool_without_an_ipc_request() {
    let fixture = fixture(1);
    let selected = NativeScanSelection::fixture(fixture.path(), 1).unwrap();
    let state = NumericHistoryState::default();
    let ticket = state.begin("expiring".into()).unwrap();
    let spool = Spool::open().unwrap();
    spool.finish().unwrap();
    state
        .publish(
            &ticket,
            selected,
            spool,
            Instant::now() + Duration::from_millis(20),
        )
        .unwrap();
    // Wait on the underlying condvar instead of the accessor, so the expiry
    // worker must actually release the idle spool.
    let guard = state.0.slot.lock().unwrap();
    let (guard, _) = state
        .0
        .changed
        .wait_timeout_while(guard, Duration::from_secs(2), |slot| slot.is_some())
        .unwrap();
    assert!(guard.is_none());
}

#[test]
fn nsr7_v2_thirty_two_rules_share_lookback_and_keep_ema_state_across_pages() {
    use super::super::ast::{IndicatorNameV1, OhlcvFieldV1, RuleV1};

    let fixture = fixture(640);
    let source = ForwardSource::in_namespace(fixture.path(), fixture.path()).unwrap();
    let mut request = request();
    request.rules = (0..32)
        .map(|lookback| RuleV1 {
            id: format!("ema-{lookback:02}"),
            expression: ExprV1::Indicator {
                name: IndicatorNameV1::Ema,
                period: 3,
                input: Some(Box::new(ExprV1::Field {
                    field: OhlcvFieldV1::Close,
                    lookback,
                })),
            },
        })
        .collect();
    let (spool, complete) =
        evaluate(&source, &request, "fixture#1".into(), || Ok(()), || false).unwrap();
    assert_eq!(complete.coverage_rows, 32);
    assert_eq!(
        complete.matches,
        (0..32).map(|lookback| 640 - 2 - lookback).sum::<usize>()
    );
    let page = spool
        .page("fixture", "generation", PageKind::Matches, None)
        .unwrap();
    for (lookback, item) in page.items.iter().take(32).enumerate() {
        assert_eq!(item["ruleId"], format!("ema-{lookback:02}"));
        assert_eq!(item["value"].as_f64(), Some((639 - lookback) as f64));
    }
}
