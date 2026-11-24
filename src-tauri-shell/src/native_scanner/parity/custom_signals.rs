//! TypeScript fixture coverage through the bounded V1 custom-signal executor.

use super::{assert_json_semantically_eq, pack_date, InlineScanSource};
use crate::native_scanner::{
    custom_signals,
    ipc::validate_start_request,
    reader::NativeBar,
    scan::{
        execute_scan_with_signals, ScanExecutionOptions, ScanMatchRecord, ScanTarget, TargetStatus,
    },
};
use chrono::{Days, NaiveDate};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::atomic::AtomicBool};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    version: u32,
    price_scale: u32,
    start_date: String,
    bar_sets: BTreeMap<String, Vec<(u32, usize)>>,
    cases: Vec<Case>,
    rounding: Vec<RoundingCase>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    case_id: String,
    target: Instrument,
    bar_set: String,
    as_of_date: Option<String>,
    lookback_bars: usize,
    resolved_rules: Vec<Value>,
    expected: Expected,
}

#[derive(Deserialize)]
struct Instrument {
    exchange: String,
    symbol: String,
}

#[derive(Deserialize)]
struct Expected {
    matches: Vec<Value>,
    errors: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoundingCase {
    value_bits: String,
    expected: f64,
}

fn load_fixture() -> Fixture {
    serde_json::from_str(include_str!(
        "../../../../src/features/scanner/fixtures/nativeCustomSignalParityFixtures.v1.json"
    ))
    .expect("WP-04 TypeScript custom signal parity fixture must parse")
}

fn fixture_bars(fixture: &Fixture, case: &Case) -> Vec<NativeBar> {
    let start = NaiveDate::parse_from_str(&fixture.start_date, "%Y-%m-%d").expect("fixture start");
    let decode = |ticks| f64::from(ticks) / f64::from(fixture.price_scale);
    fixture.bar_sets[&case.bar_set]
        .iter()
        .flat_map(|&(ticks, count)| std::iter::repeat_n(ticks, count))
        .enumerate()
        .map(|(index, ticks)| {
            let date = start
                .checked_add_days(Days::new(index as u64))
                .expect("fixture date");
            NativeBar {
                date: pack_date(&date.to_string()),
                open: decode(ticks - 2_500),
                high: decode(ticks + 7_500),
                low: decode(ticks - 12_500),
                close: decode(ticks),
                prev_close: None,
                volume: 10_000.0,
                open_interest: 0.0,
            }
        })
        .collect()
}

fn comparable_result(result: &ScanMatchRecord) -> Value {
    assert!(result.history.is_none() && result.pattern.is_none());
    assert!(result.value.is_none() && result.source.is_none());
    json!({
        "exchange": result.exchange,
        "symbol": result.symbol,
        "scannerId": result.rule_id,
        "scannerName": result.scanner_name,
        "categoryId": result.category_id,
        "categoryName": result.category_name,
        "date": result.date,
        "matched": true,
        "direction": result.direction,
        "score": result.score,
        "reasons": result.reasons,
        "values": result.values,
    })
}

#[test]
fn wp04_custom_signal_matches_typescript_results() {
    let fixture = load_fixture();
    assert_eq!(fixture.version, 1);
    assert!(!fixture.cases.is_empty());
    for case in &fixture.cases {
        let target = ScanTarget {
            symbol: case.target.symbol.clone(),
            exchange: case.target.exchange.clone(),
        };
        let source = InlineScanSource {
            identity: "fixture#1".to_string(),
            bars_by_key: BTreeMap::from([(target.key(), fixture_bars(&fixture, case))]),
            errors_by_key: BTreeMap::new(),
        };
        let wire = json!({
            "schemaVersion": 1,
            "requestedRunId": "custom-fixture",
            "universe": {"source": "explicitTargets", "targets": [{
                "exchange": target.exchange, "symbol": target.symbol
            }]},
            "evaluation": {
                "asOfDate": case.as_of_date, "lookbackBars": case.lookback_bars,
                "evaluateHistory": false, "priceBasis": "raw"
            },
            "customSignals": {
                "evaluatorVersion": 1, "databaseIdentity": "fixture#1", "rules": case.resolved_rules,
            }
        });
        let parsed = validate_start_request(&wire);
        if case.resolved_rules.is_empty() {
            assert!(parsed.is_err(), "{}", case.case_id);
            assert!(case.expected.matches.is_empty() && case.expected.errors.is_empty());
            continue;
        }
        let (request, batch) = parsed.unwrap_or_else(|error| panic!("{}: {error:?}", case.case_id));
        let targets = [target];
        let report = execute_scan_with_signals(
            &source,
            &request,
            &targets,
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            batch.as_ref(),
            |_| {},
        );
        let status = if !case.expected.errors.is_empty() {
            TargetStatus::Skipped
        } else if case.expected.matches.is_empty() {
            TargetStatus::NoMatch
        } else {
            TargetStatus::Match
        };
        assert_eq!(report.outcomes[0].status, status, "{}", case.case_id);
        assert_eq!(
            report.custom_signal_result_count,
            Some(case.expected.matches.len())
        );
        assert_eq!(
            report.outcomes[0].message.iter().collect::<Vec<_>>(),
            case.expected.errors.iter().collect::<Vec<_>>(),
            "{}",
            case.case_id
        );
        assert_json_semantically_eq(
            &case.case_id,
            &Value::Array(
                report.outcomes[0]
                    .matches
                    .iter()
                    .map(comparable_result)
                    .collect(),
            ),
            &json!(case.expected.matches),
        );
    }
}

#[test]
fn wp04_custom_signal_payload_measures_the_admitted_result_ceiling() {
    use crate::native_scanner::job::{EventEmitter, RecordingSink, DEFAULT_EVENT_BATCH_SIZE};
    use std::sync::{atomic::AtomicU64, Arc};

    let symbols: Vec<_> = (0..128).map(|index| format!("SYM{index:03}")).collect();
    let wire_targets: Vec<_> = symbols
        .iter()
        .map(|symbol| json!({"exchange": "NSE", "symbol": symbol}))
        .collect();
    let rules: Vec<_> = (0..32)
        .map(|index| {
            json!({
                "id": format!("rule{index:02}{}", "\0".repeat(122)),
                "label": "\0".repeat(256),
                "conditionType": "crosses_above",
                "seriesA": {"kind": "ohlc", "source": "close"},
                "seriesB": {"kind": "constant", "value": 30}
            })
        })
        .collect();
    let wire = json!({
        "schemaVersion": 1, "requestedRunId": "custom-payload-fixture",
        "universe": {"source": "explicitTargets", "targets": wire_targets},
        "evaluation": {"evaluateHistory": false, "lookbackBars": 20, "priceBasis": "raw"},
        "customSignals": {"evaluatorVersion": 1, "databaseIdentity": "fixture#1", "rules": rules}
    });
    let mut oversized = wire.clone();
    oversized["universe"]["targets"]
        .as_array_mut()
        .unwrap()
        .push(json!({"exchange": "NSE", "symbol": "EXTRA"}));
    assert!(validate_start_request(&oversized).is_err());

    let (request, batch) = validate_start_request(&wire).expect("maximum-cardinality request");
    let fixture = load_fixture();
    let case = &fixture.cases[0];
    let bars = fixture_bars(&fixture, case)[..3].to_vec();
    let targets: Vec<_> = symbols
        .into_iter()
        .map(|symbol| ScanTarget {
            symbol,
            exchange: "NSE".to_string(),
        })
        .collect();
    let source = InlineScanSource {
        identity: "fixture#1".to_string(),
        bars_by_key: targets
            .iter()
            .map(|target| (target.key(), bars.clone()))
            .collect(),
        errors_by_key: BTreeMap::new(),
    };
    let sink = RecordingSink::default();
    let mut emitter = EventEmitter::new(
        &sink,
        &request.requested_run_id,
        "fixture#1",
        Arc::new(AtomicU64::new(0)),
    );
    let report = execute_scan_with_signals(
        &source,
        &request,
        &targets,
        &AtomicBool::new(false),
        ScanExecutionOptions::default(),
        batch.as_ref(),
        |progress| emitter.on_progress(progress, false),
    );
    let duration = report.duration_ms;
    emitter.finalize_complete(report, duration);
    let match_events = sink.matches.lock().unwrap();
    let complete = sink.complete.lock().unwrap();
    assert_eq!(complete[0].counts.matched, targets.len());
    assert_eq!(
        complete[0].custom_signal_result_count,
        Some(custom_signals::MAX_POSSIBLE_RESULTS)
    );
    assert_eq!(
        match_events
            .iter()
            .map(|event| event.matches.len())
            .sum::<usize>(),
        custom_signals::MAX_POSSIBLE_RESULTS
    );
    assert!(match_events
        .iter()
        .all(|event| event.matches.len() <= DEFAULT_EVENT_BATCH_SIZE));
    let request_bytes = serde_json::to_vec(&wire).unwrap().len();
    let event_bytes = match_events
        .iter()
        .map(|event| serde_json::to_vec(event).unwrap().len())
        .max()
        .unwrap();
    println!("WP-04 4096-result fixture: request {request_bytes} bytes; largest match event {event_bytes} bytes");
}

#[test]
fn wp04_custom_signal_rsi_rounding_matches_javascript_to_fixed() {
    let fixture = load_fixture();
    assert!(!fixture.rounding.is_empty());
    for case in fixture.rounding {
        let bits = u64::from_str_radix(&case.value_bits, 16).expect("RSI f64 hex");
        assert_eq!(
            custom_signals::round_chart_rsi(f64::from_bits(bits)),
            case.expected,
            "RSI bits {}",
            case.value_bits
        );
    }
}
