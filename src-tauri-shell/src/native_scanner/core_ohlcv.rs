//! Native predicates and accepted result metadata for six simple core OHLCV scans.
//!
//! Keep these predicates in exact lockstep with coreOhlcvScanners.ts. The backend
//! rejects a claimed core id with a noncanonical expression, so clients cannot
//! attach accepted scanner metadata to an unrelated arbitrary numeric rule.

use std::collections::BTreeMap;

use super::ast::{BinaryOpV1, ExprV1, OhlcvFieldV1, RuleV1};
use super::reader::NativeBar;
use super::scan::ScanMatchRecord;
use crate::scanner_contract::ScannerScalarValueV1;

pub const NATIVE_CORE_IDS: [&str; 6] = [
    "prev_day_high_break",
    "prev_day_low_break",
    "close_near_high",
    "close_near_low",
    "gap_up",
    "gap_down",
];

fn field(field: OhlcvFieldV1, lookback: usize) -> ExprV1 {
    ExprV1::Field { field, lookback }
}
fn number(value: f64) -> ExprV1 {
    ExprV1::Number { value }
}
fn binary(op: BinaryOpV1, left: ExprV1, right: ExprV1) -> ExprV1 {
    ExprV1::Binary {
        op,
        left: Box::new(left),
        right: Box::new(right),
    }
}

/// Returns the one accepted AST for a core rule. Everything not listed here
/// must remain on the TypeScript path.
pub fn canonical_expression(id: &str) -> Option<ExprV1> {
    use BinaryOpV1::{Add, And, Gt, Gte, Lt, Lte, Mul, Sub};
    use OhlcvFieldV1::{Close, High, Low, Open};
    let high = || field(High, 0);
    let low = || field(Low, 0);
    let close = || field(Close, 0);
    let open = || field(Open, 0);
    let range = || binary(Sub, high(), low());
    match id {
        "prev_day_high_break" => Some(binary(Gt, close(), field(High, 1))),
        "prev_day_low_break" => Some(binary(Lt, close(), field(Low, 1))),
        "gap_up" => Some(binary(Gt, open(), field(High, 1))),
        "gap_down" => Some(binary(Lt, open(), field(Low, 1))),
        "close_near_high" => Some(binary(
            And,
            binary(Gt, high(), low()),
            binary(
                Gte,
                close(),
                binary(Sub, high(), binary(Mul, range(), number(0.1))),
            ),
        )),
        "close_near_low" => Some(binary(
            And,
            binary(Gt, high(), low()),
            binary(
                Lte,
                close(),
                binary(Add, low(), binary(Mul, range(), number(0.1))),
            ),
        )),
        _ => None,
    }
}

pub fn is_canonical_core_rule(rule: &RuleV1) -> bool {
    match canonical_expression(&rule.id) {
        Some(expected) => expected == rule.expression,
        None => true,
    }
}

fn float(value: f64) -> ScannerScalarValueV1 {
    ScannerScalarValueV1::Float(value)
}
fn round(value: f64, places: i32) -> f64 {
    let factor = 10_f64.powi(places);
    (value * factor).round() / factor
}
fn put(values: &mut BTreeMap<String, ScannerScalarValueV1>, key: &str, value: f64) {
    values.insert(key.to_string(), float(value));
}

/// Decorates the already-accepted numeric verdict with the exact TypeScript
/// scanner result shape: name, direction, reasons and scalar values.
/// Does not change the verdict or mutate price data.
pub fn decorate_match(record: &mut ScanMatchRecord, bars: &[NativeBar]) {
    if !NATIVE_CORE_IDS.contains(&record.rule_id.as_str()) {
        return;
    }
    let Some(today) = bars.last() else {
        return;
    };
    let yesterday = bars.get(bars.len().saturating_sub(2));
    let mut values = BTreeMap::new();
    let (name, direction, reason) = match record.rule_id.as_str() {
        "prev_day_high_break" => {
            let Some(prior) = yesterday else { return };
            put(&mut values, "close", today.close);
            put(&mut values, "prev_high", prior.high);
            put(&mut values, "high_diff", round(today.close - prior.high, 4));
            (
                "Previous Day High Break",
                "bullish",
                format!(
                    "Close ({}) broke above yesterday high ({})",
                    today.close, prior.high
                ),
            )
        }
        "prev_day_low_break" => {
            let Some(prior) = yesterday else { return };
            put(&mut values, "close", today.close);
            put(&mut values, "prev_low", prior.low);
            put(&mut values, "low_diff", round(prior.low - today.close, 4));
            (
                "Previous Day Low Break",
                "bearish",
                format!(
                    "Close ({}) broke below yesterday low ({})",
                    today.close, prior.low
                ),
            )
        }
        "gap_up" => {
            let Some(prior) = yesterday else { return };
            put(&mut values, "open", today.open);
            put(&mut values, "prev_high", prior.high);
            put(
                &mut values,
                "gap_pct",
                round((today.open / prior.high - 1.0) * 100.0, 2),
            );
            (
                "Gap Up",
                "bullish",
                format!(
                    "Today opened at {}, gapping up above yesterday high ({})",
                    today.open, prior.high
                ),
            )
        }
        "gap_down" => {
            let Some(prior) = yesterday else { return };
            put(&mut values, "open", today.open);
            put(&mut values, "prev_low", prior.low);
            put(
                &mut values,
                "gap_pct",
                round((1.0 - today.open / prior.low) * 100.0, 2),
            );
            (
                "Gap Down",
                "bearish",
                format!(
                    "Today opened at {}, gapping down below yesterday low ({})",
                    today.open, prior.low
                ),
            )
        }
        "close_near_high" => {
            let range = today.high - today.low;
            if range <= 0.0 {
                return;
            }
            put(&mut values, "close", today.close);
            put(&mut values, "high", today.high);
            put(&mut values, "low", today.low);
            put(&mut values, "clv", round((today.close - today.low) / range, 4));
            (
                "Close Near High",
                "bullish",
                format!(
                    "Close ({}) is near the session high ({})",
                    today.close, today.high
                ),
            )
        }
        "close_near_low" => {
            let range = today.high - today.low;
            if range <= 0.0 {
                return;
            }
            put(&mut values, "close", today.close);
            put(&mut values, "high", today.high);
            put(&mut values, "low", today.low);
            put(&mut values, "clv", round((today.close - today.low) / range, 4));
            (
                "Close Near Low",
                "bearish",
                format!(
                    "Close ({}) is near the session low ({})",
                    today.close, today.low
                ),
            )
        }
        _ => return,
    };

    record.scanner_name = Some(name.to_string());
    record.category_id = Some("price_action".to_string());
    record.category_name = Some("Price Action".to_string());
    record.direction = Some(direction.to_string());
    record.reasons = Some(vec![reason]);
    record.values = Some(values);
    record.source = Some("EODScannerPlugin_v1".to_string());
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_scanner::ast::evaluate_rule_latest;

    fn bar(date: u32, open: f64, high: f64, low: f64, close: f64) -> NativeBar {
        NativeBar {
            date,
            open,
            high,
            low,
            close,
            prev_close: None,
            volume: 1000.0,
            open_interest: 0.0,
        }
    }
    fn eval_bars(input: &[NativeBar]) -> Vec<crate::native_scanner::ast::EvalBar> {
        input
            .iter()
            .map(|bar| crate::native_scanner::ast::EvalBar {
                date: bar.date,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
            })
            .collect()
    }

    #[test]
    fn core_01_six_native_predicates_match_accepted_latest_eod_cases() {
        let positive = vec![
            ("prev_day_high_break", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 101.0, 112.0, 99.0, 110.0)]),
            ("prev_day_low_break", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 77.0, 80.0, 69.0, 75.0)]),
            ("gap_up", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 101.0, 111.0, 100.0, 107.0)]),
            ("gap_down", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 79.0, 85.0, 70.0, 80.0)]),
            ("close_near_high", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 101.0, 110.0, 100.0, 109.5)]),
            ("close_near_low", vec![bar(20240101, 90.0, 100.0, 80.0, 95.0), bar(20240102, 101.0, 110.0, 100.0, 100.5)]),
        ];

        for (id, bars) in positive {
            let expression = canonical_expression(id).unwrap();
            let outcome = evaluate_rule_latest(&expression, &eval_bars(&bars)).unwrap();
            assert!(outcome.matched, "{id}: expected positive");

            let mut record = ScanMatchRecord {
                rule_id: id.to_string(),
                ..ScanMatchRecord::default()
            };
            decorate_match(&mut record, &bars);
            assert_eq!(record.category_id.as_deref(), Some("price_action"));
            assert!(record.scanner_name.is_some(), "{id}: name missing");
            assert!(record.direction.is_some(), "{id}: direction missing");
            assert!(record.reasons.as_ref().is_some_and(|values| !values.is_empty()));
            assert!(record.values.as_ref().is_some_and(|values| !values.is_empty()));
            assert_eq!(record.source.as_deref(), Some("EODScannerPlugin_v1"));
        }
    }

    #[test]
    fn core_01_flat_or_nonmatching_bars_never_invent_results() {
        let bars = vec![
            bar(20240101, 90.0, 100.0, 80.0, 95.0),
            bar(20240102, 90.0, 100.0, 80.0, 95.0),
        ];
        for id in NATIVE_CORE_IDS {
            let result = evaluate_rule_latest(
                &canonical_expression(id).unwrap(),
                &eval_bars(&bars),
            )
            .unwrap();
            assert!(!result.matched, "{id}: should not match");
        }
    }

    #[test]
    fn core_01_canonical_rules_cannot_be_spoofed() {
        for id in NATIVE_CORE_IDS {
            let good = RuleV1 {
                id: id.to_string(),
                expression: canonical_expression(id).unwrap(),
            };
            assert!(is_canonical_core_rule(&good));
            let spoof = RuleV1 {
                id: id.to_string(),
                expression: ExprV1::Number { value: 1.0 },
            };
            assert!(!is_canonical_core_rule(&spoof));
        }
        let custom = RuleV1 {
            id: "user_expression".to_string(),
            expression: ExprV1::Number { value: 1.0 },
        };
        assert!(is_canonical_core_rule(&custom));
    }

    #[test]
    fn core_01_result_metrics_are_precise_and_match_expected_keys() {
        let bars = vec![
            bar(20240101, 90.0, 100.0, 80.0, 95.0),
            bar(20240102, 101.0, 110.0, 100.0, 109.5),
        ];
        let mut result = ScanMatchRecord {
            rule_id: "gap_up".to_string(),
            ..ScanMatchRecord::default()
        };
        decorate_match(&mut result, &bars);
        let values = result.values.unwrap();
        assert_eq!(values["gap_pct"], float(1.0));
        assert_eq!(values["prev_high"], float(100.0));
        assert_eq!(result.direction.as_deref(), Some("bullish"));
    }
}
