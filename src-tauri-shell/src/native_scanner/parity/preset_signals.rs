//! Cross-language fixture coverage for the runtime WP-04 signal presets.

use super::{assert_json_semantically_eq, pack_date, InlineScanSource};
use crate::native_scanner::{
    ast::{EvaluationV1, NativeScanRequestV1, PriceBasisV1, RuleV1, UniverseSourceV1, UniverseV1},
    preset_signals,
    reader::NativeBar,
    scan::{execute_scan, ScanExecutionOptions, ScanMatchRecord, ScanTarget, TargetStatus},
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
    bar_sets: BTreeMap<String, Vec<u32>>,
    cases: Vec<Case>,
    rounding: Vec<RoundingCase>,
}

#[derive(Deserialize)]
struct Target {
    exchange: String,
    symbol: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    case_id: String,
    target: Target,
    scanner_ids: Vec<String>,
    bar_set: String,
    as_of_date: Option<String>,
    lookback_bars: usize,
    expected: Expected,
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
    threshold: f64,
    comparison: i8,
}

fn load_fixture() -> Fixture {
    serde_json::from_str(include_str!(
        "../../../../src/features/scanner/fixtures/nativePresetSignalParityFixtures.v1.json"
    ))
    .expect("WP-04 TypeScript preset parity fixture must parse")
}

fn fixture_bars(start: NaiveDate, scale: u32, ticks: &[u32]) -> Vec<NativeBar> {
    ticks
        .iter()
        .enumerate()
        .map(|(index, &price)| {
            let date = start
                .checked_add_days(Days::new(index as u64))
                .expect("fixture date");
            let decode = |ticks| f64::from(ticks) / f64::from(scale);
            let close = decode(price);
            NativeBar {
                date: pack_date(&date.to_string()),
                open: close,
                high: decode(price + scale),
                low: decode(price - scale),
                close,
                prev_close: None,
                volume: 10_000.0,
                open_interest: 0.0,
            }
        })
        .collect()
}

fn comparable_result(result: ScanMatchRecord) -> Value {
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
fn wp04_preset_signal_results_match_corrected_typescript_fixtures() {
    let fixture = load_fixture();
    assert_eq!(fixture.version, 1);
    let start = NaiveDate::parse_from_str(&fixture.start_date, "%Y-%m-%d").expect("fixture start");
    for case in fixture.cases {
        let target = ScanTarget {
            exchange: case.target.exchange,
            symbol: case.target.symbol,
        };
        assert!(
            case.scanner_ids
                .iter()
                .all(|id| preset_signals::is_preset_id(id)),
            "{}",
            case.case_id
        );

        let data = fixture_bars(start, fixture.price_scale, &fixture.bar_sets[&case.bar_set]);
        let source = InlineScanSource {
            identity: "wp04-fixture".to_owned(),
            bars_by_key: BTreeMap::from([(target.key(), data)]),
            errors_by_key: BTreeMap::new(),
        };
        let request = NativeScanRequestV1 {
            schema_version: 1,
            requested_run_id: "wp04-fixture".to_owned(),
            universe: UniverseV1 {
                source: UniverseSourceV1::ExplicitTargets,
                targets: vec![(target.exchange.clone(), target.symbol.clone())],
            },
            evaluation: EvaluationV1 {
                as_of_date: case.as_of_date,
                lookback_bars: Some(case.lookback_bars),
                evaluate_history: false,
                price_basis: PriceBasisV1::Raw,
                include_dividend_adjustments: false,
                include_rights_adjustments: false,
            },
            rules: case
                .scanner_ids
                .iter()
                .map(|id| RuleV1 {
                    id: id.clone(),
                    expression: preset_signals::canonical_expression(id).expect("fixture preset"),
                })
                .collect(),
        };
        let cancel = AtomicBool::new(false);
        let targets = [target];
        let report = execute_scan(
            &source,
            &request,
            &targets,
            &cancel,
            ScanExecutionOptions::default(),
            |_| {},
        );
        let expected_status = if !case.expected.errors.is_empty() {
            TargetStatus::Skipped
        } else if case.expected.matches.is_empty() {
            TargetStatus::NoMatch
        } else {
            TargetStatus::Match
        };
        assert_eq!(
            report.outcomes[0].status, expected_status,
            "{}",
            case.case_id
        );
        if case.case_id == "golden-cross-with-exact-trailing-51" {
            let limited = execute_scan(
                &source,
                &request,
                &targets,
                &cancel,
                ScanExecutionOptions {
                    max_window_bars: 50,
                    ..ScanExecutionOptions::default()
                },
                |_| {},
            );
            assert_eq!(limited.outcomes[0].status, TargetStatus::Error);
            assert!(limited.matches.is_empty());
        }

        let mut matches = report.matches;
        matches.sort_by(|left, right| left.scanner_name.cmp(&right.scanner_name));
        let actual: Vec<_> = matches.into_iter().map(comparable_result).collect();
        assert_json_semantically_eq(
            &case.case_id,
            &Value::Array(actual),
            &Value::Array(case.expected.matches),
        );
    }
}

#[test]
fn wp04_chart_rsi_threshold_comparisons_match_javascript_to_fixed() {
    let rounding = load_fixture().rounding;
    assert_eq!(rounding.len(), 12);
    for case in rounding {
        let value = f64::from_bits(u64::from_str_radix(&case.value_bits, 16).expect("RSI bits"));
        assert_eq!(
            preset_signals::compare_chart_rsi(value, case.threshold),
            Some(case.comparison.cmp(&0)),
            "RSI threshold {}, binary value {}",
            case.threshold,
            case.value_bits
        );
    }
}
