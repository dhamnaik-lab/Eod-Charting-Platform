//! NS-R1 — complete candidate metadata for ten built-in core OHLCV scanner rules.
//!
//! This is deliberately not a new production scanner selection. The renderer keeps
//! core OHLCV execution on TypeScript until cross-language value/reason parity and
//! end-to-end native acceptance pass. Rule identity alone never authorizes metadata:
//! the supplied numeric AST must equal the accepted predicate for that ID.

use super::ast::{BinaryOpV1, ExprV1, IndicatorNameV1, OhlcvFieldV1, RuleV1};
use super::reader::NativeBar;
use super::scan::{ScanMatchRecord, ScanTarget};
use crate::scanner_breakaway_gap::{format_js_number, round_js, scalar_number_v1};
use crate::scanner_contract::ScannerScalarValueV1 as Scalar;
use std::collections::BTreeMap;

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

fn candle_range(lookback: usize) -> ExprV1 {
    binary(
        BinaryOpV1::Sub,
        field(OhlcvFieldV1::High, lookback),
        field(OhlcvFieldV1::Low, lookback),
    )
}

fn conjunction(left: ExprV1, right: ExprV1) -> ExprV1 {
    binary(BinaryOpV1::And, left, right)
}

/// Only accepted, built-in core scanner IDs have a corresponding expression.
fn expected_expression(id: &str) -> Option<ExprV1> {
    use BinaryOpV1::{Add, Gt, Gte, Lt, Lte, Mul, Sub};
    use OhlcvFieldV1::{Close, High, Low, Open};

    let expression = match id {
        "prev_day_high_break" => binary(Gt, field(Close, 0), field(High, 1)),
        "prev_day_low_break" => binary(Lt, field(Close, 0), field(Low, 1)),
        "inside_bar" => conjunction(
            binary(Lt, field(High, 0), field(High, 1)),
            binary(Gt, field(Low, 0), field(Low, 1)),
        ),
        "outside_bar" => conjunction(
            binary(Gt, field(High, 0), field(High, 1)),
            binary(Lt, field(Low, 0), field(Low, 1)),
        ),
        "close_near_high" => conjunction(
            binary(Gt, candle_range(0), number(0.0)),
            binary(
                Gte,
                field(Close, 0),
                binary(
                    Sub,
                    field(High, 0),
                    binary(Mul, candle_range(0), number(0.1)),
                ),
            ),
        ),
        "close_near_low" => conjunction(
            binary(Gt, candle_range(0), number(0.0)),
            binary(
                Lte,
                field(Close, 0),
                binary(
                    Add,
                    field(Low, 0),
                    binary(Mul, candle_range(0), number(0.1)),
                ),
            ),
        ),
        "gap_up" => binary(Gt, field(Open, 0), field(High, 1)),
        "gap_down" => binary(Lt, field(Open, 0), field(Low, 1)),
        "nr7" => {
            let mut expr = binary(Lt, candle_range(0), candle_range(1));
            for lookback in 2..=6 {
                expr = conjunction(expr, binary(Lt, candle_range(0), candle_range(lookback)));
            }
            expr
        }
        "wide_range_candle" => binary(
            Gt,
            candle_range(0),
            binary(
                Mul,
                number(1.5),
                ExprV1::Indicator {
                    name: IndicatorNameV1::Sma,
                    period: 14,
                    input: Some(Box::new(candle_range(1))),
                },
            ),
        ),
        _ => return None,
    };
    Some(expression)
}

pub fn is_core_id(id: &str) -> bool {
    expected_expression(id).is_some()
}

pub fn validate_core_rule(rule: &RuleV1, evaluate_history: bool) -> Result<(), String> {
    let Some(expected) = expected_expression(&rule.id) else {
        return Ok(());
    };
    if rule.expression != expected {
        return Err(format!(
            "Core scanner {} does not use the accepted numeric predicate.",
            rule.id
        ));
    }
    // The TypeScript core scanner produces one latest-endpoint result regardless of
    // the Chart Pattern All History setting. Fail closed rather than silently emit
    // 1,000 historical core rows with different semantics.
    if evaluate_history {
        return Err(format!(
            "Core scanner {} requires latest-only native evaluation until historical parity is approved.",
            rule.id
        ));
    }
    Ok(())
}

fn add_number(values: &mut BTreeMap<String, Scalar>, key: &str, value: f64) -> Result<(), String> {
    if !value.is_finite() {
        return Err(format!("Non-finite numeric metadata for {key}."));
    }
    values.insert(key.to_string(), scalar_number_v1(value));
    Ok(())
}

fn add_nullable_number(
    values: &mut BTreeMap<String, Scalar>,
    key: &str,
    value: Option<f64>,
) -> Result<(), String> {
    match value {
        Some(number) => add_number(values, key, number),
        None => {
            values.insert(key.to_string(), Scalar::Null);
            Ok(())
        }
    }
}

fn bar_range(bar: &NativeBar) -> f64 {
    (bar.high - bar.low).max(0.0)
}

fn previous_average_range(bars: &[NativeBar], length: usize) -> Option<f64> {
    if bars.len() <= length {
        return None;
    }
    let previous = &bars[bars.len() - length - 1..bars.len() - 1];
    Some(previous.iter().map(bar_range).sum::<f64>() / length as f64)
}

/// Returns `Ok(None)` for a non-core rule. A matched core rule only receives
/// complete legacy metadata when the rule predicate is the exact accepted AST.
/// This function cannot be used as evidence of numeric/locale parity without
/// independent Rust-vs-TypeScript fixture comparisons.
pub fn core_match_record(
    rule: &RuleV1,
    bars: &[NativeBar],
    target: &ScanTarget,
    date: &str,
    value: Option<f64>,
) -> Result<Option<ScanMatchRecord>, String> {
    if !is_core_id(&rule.id) {
        return Ok(None);
    }
    validate_core_rule(rule, false)?;
    let today = bars
        .last()
        .ok_or_else(|| "Core metadata requires a completed bar.".to_string())?;
    let yesterday = bars.get(bars.len().saturating_sub(2));
    let mut values: BTreeMap<String, Scalar> = BTreeMap::new();
    let name: &str;
    let category: &str;
    let direction: &str;
    let reason: String;

    match rule.id.as_str() {
        "prev_day_high_break" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Previous Day High Break";
            category = "Price Action";
            direction = "bullish";
            reason = format!(
                "Close ({}) broke above yesterday high ({})",
                format_js_number(today.close),
                format_js_number(previous.high)
            );
            add_number(&mut values, "close", today.close)?;
            add_number(&mut values, "prev_high", previous.high)?;
            add_number(
                &mut values,
                "high_diff",
                round_js(today.close - previous.high, 4),
            )?;
        }
        "prev_day_low_break" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Previous Day Low Break";
            category = "Price Action";
            direction = "bearish";
            reason = format!(
                "Close ({}) broke below yesterday low ({})",
                format_js_number(today.close),
                format_js_number(previous.low)
            );
            add_number(&mut values, "close", today.close)?;
            add_number(&mut values, "prev_low", previous.low)?;
            add_number(
                &mut values,
                "low_diff",
                round_js(previous.low - today.close, 4),
            )?;
        }
        "inside_bar" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Inside Bar";
            category = "Price Action";
            direction = "neutral";
            reason = "Today range is completely inside yesterday range".to_string();
            add_number(&mut values, "high", today.high)?;
            add_number(&mut values, "prev_high", previous.high)?;
            add_number(&mut values, "low", today.low)?;
            add_number(&mut values, "prev_low", previous.low)?;
            let ratio = previous_average_range(bars, 10)
                .filter(|average| *average > 0.0)
                .map(|average| round_js(bar_range(today) / average, 4));
            add_nullable_number(&mut values, "range_ratio", ratio)?;
        }
        "outside_bar" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Outside Bar";
            category = "Price Action";
            direction = "neutral";
            reason = "Today range engulfs yesterday range".to_string();
            add_number(&mut values, "high", today.high)?;
            add_number(&mut values, "prev_high", previous.high)?;
            add_number(&mut values, "low", today.low)?;
            add_number(&mut values, "prev_low", previous.low)?;
        }
        "close_near_high" => {
            name = "Close Near High";
            category = "Price Action";
            direction = "bullish";
            reason = format!(
                "Close ({}) is near the session high ({})",
                format_js_number(today.close),
                format_js_number(today.high)
            );
            add_number(&mut values, "close", today.close)?;
            add_number(&mut values, "high", today.high)?;
            add_number(&mut values, "low", today.low)?;
            let candle = bar_range(today);
            add_nullable_number(
                &mut values,
                "clv",
                (candle != 0.0).then(|| round_js((today.close - today.low) / candle, 4)),
            )?;
        }
        "close_near_low" => {
            name = "Close Near Low";
            category = "Price Action";
            direction = "bearish";
            reason = format!(
                "Close ({}) is near the session low ({})",
                format_js_number(today.close),
                format_js_number(today.low)
            );
            add_number(&mut values, "close", today.close)?;
            add_number(&mut values, "high", today.high)?;
            add_number(&mut values, "low", today.low)?;
            let candle = bar_range(today);
            add_nullable_number(
                &mut values,
                "clv",
                (candle != 0.0).then(|| round_js((today.close - today.low) / candle, 4)),
            )?;
        }
        "gap_up" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Gap Up";
            category = "Price Action";
            direction = "bullish";
            reason = format!(
                "Today opened at {}, gapping up above yesterday high ({})",
                format_js_number(today.open),
                format_js_number(previous.high)
            );
            add_number(&mut values, "open", today.open)?;
            add_number(&mut values, "prev_high", previous.high)?;
            if previous.high == 0.0 {
                return Err("Gap Up cannot encode a non-finite percentage.".to_string());
            }
            add_number(
                &mut values,
                "gap_pct",
                round_js((today.open / previous.high - 1.0) * 100.0, 2),
            )?;
        }
        "gap_down" => {
            let previous = yesterday.ok_or_else(|| "Previous bar unavailable.".to_string())?;
            name = "Gap Down";
            category = "Price Action";
            direction = "bearish";
            reason = format!(
                "Today opened at {}, gapping down below yesterday low ({})",
                format_js_number(today.open),
                format_js_number(previous.low)
            );
            add_number(&mut values, "open", today.open)?;
            add_number(&mut values, "prev_low", previous.low)?;
            if previous.low == 0.0 {
                return Err("Gap Down cannot encode a non-finite percentage.".to_string());
            }
            add_number(
                &mut values,
                "gap_pct",
                round_js((1.0 - today.open / previous.low) * 100.0, 2),
            )?;
        }
        "nr7" => {
            if bars.len() < 7 {
                return Err("NR7 requires seven completed bars.".to_string());
            }
            name = "NR7 (Narrow Range 7)";
            category = "Price Action";
            direction = "neutral";
            let width = bar_range(today);
            let previous_min = bars[bars.len() - 7..bars.len() - 1]
                .iter()
                .map(bar_range)
                .fold(f64::INFINITY, f64::min);
            reason = format!("Today range ({width:.4}) is the narrowest in 7 days");
            add_number(&mut values, "range", round_js(width, 4))?;
            add_number(&mut values, "prev_min_range", round_js(previous_min, 4))?;
        }
        "wide_range_candle" => {
            name = "Wide Range Candle";
            category = "Volatility";
            direction = "neutral";
            let width = bar_range(today);
            let average = previous_average_range(bars, 14)
                .ok_or_else(|| "Wide range requires fifteen completed bars.".to_string())?;
            if average == 0.0 {
                return Err("Wide range average is zero.".to_string());
            }
            reason =
                format!("Today range ({width:.2}) is wider than the 14-day average ({average:.2})");
            add_number(&mut values, "range", round_js(width, 4))?;
            add_number(&mut values, "avg_range_14", round_js(average, 4))?;
            add_number(&mut values, "range_ratio", round_js(width / average, 4))?;
        }
        _ => unreachable!("is_core_id already checked the accepted ID set"),
    }

    Ok(Some(ScanMatchRecord {
        exchange: target.exchange.clone(),
        symbol: target.symbol.clone(),
        rule_id: rule.id.clone(),
        date: date.to_string(),
        value,
        scanner_name: Some(name.to_string()),
        category_id: Some(
            if category == "Volatility" {
                "volatility"
            } else {
                "price_action"
            }
            .to_string(),
        ),
        category_name: Some(category.to_string()),
        direction: Some(direction.to_string()),
        reasons: Some(vec![reason]),
        values: Some(values),
        source: Some("EODScannerPlugin_v1".to_string()),
        ..ScanMatchRecord::default()
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_bar(index: u32) -> NativeBar {
        NativeBar {
            date: 20260101 + index,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 100.0,
            prev_close: None,
            volume: 1000.0,
            open_interest: 0.0,
        }
    }

    #[test]
    fn rejects_forged_core_id_and_historical_core_calls() {
        let valid = RuleV1 {
            id: "inside_bar".to_string(),
            expression: expected_expression("inside_bar").unwrap(),
        };
        assert!(validate_core_rule(&valid, false).is_ok());
        assert!(validate_core_rule(&valid, true).is_err());
        let forged = RuleV1 {
            id: valid.id.clone(),
            expression: ExprV1::Number { value: 1.0 },
        };
        assert!(validate_core_rule(&forged, false).is_err());
        let generic = RuleV1 {
            id: "custom_rule_abc".into(),
            expression: ExprV1::Number { value: 1.0 },
        };
        assert!(validate_core_rule(&generic, true).is_ok());
    }

    #[test]
    fn inside_bar_retains_null_ratio_before_optional_ten_bar_warmup() {
        let rule = RuleV1 {
            id: "inside_bar".into(),
            expression: expected_expression("inside_bar").unwrap(),
        };
        let mut bars = vec![make_bar(0), make_bar(1)];
        bars[1].high = 109.0;
        bars[1].low = 91.0;
        let target = ScanTarget {
            exchange: "NSE".into(),
            symbol: "TEST".into(),
        };
        let result = core_match_record(&rule, &bars, &target, "2026-01-02", None)
            .unwrap()
            .unwrap();
        let values = result.values.unwrap();
        assert_eq!(values.get("range_ratio"), Some(&Scalar::Null));
        assert_eq!(
            serde_json::to_value(&Scalar::Null).unwrap(),
            serde_json::Value::Null
        );
        assert_eq!(result.source.as_deref(), Some("EODScannerPlugin_v1"));
        assert_eq!(result.direction.as_deref(), Some("neutral"));
    }

    #[test]
    fn wide_range_uses_previous_fourteen_bars_not_current() {
        let rule = RuleV1 {
            id: "wide_range_candle".into(),
            expression: expected_expression("wide_range_candle").unwrap(),
        };
        let mut bars: Vec<NativeBar> = (0..15).map(make_bar).collect();
        bars[14].high = 130.0;
        bars[14].low = 70.0;
        let target = ScanTarget {
            exchange: "BSE".into(),
            symbol: "TEST".into(),
        };
        let result = core_match_record(&rule, &bars, &target, "2026-01-15", None)
            .unwrap()
            .unwrap();
        let values = result.values.unwrap();
        assert_eq!(values.get("avg_range_14"), Some(&Scalar::Integer(20)));
        assert_eq!(values.get("range_ratio"), Some(&Scalar::Integer(3)));
        assert_eq!(result.category_id.as_deref(), Some("volatility"));
    }

    #[test]
    fn all_ten_core_result_records_include_the_expected_legacy_metadata() {
        let samples = [
            (
                "prev_day_high_break",
                "Previous Day High Break",
                "Price Action",
                "bullish",
                3,
            ),
            (
                "prev_day_low_break",
                "Previous Day Low Break",
                "Price Action",
                "bearish",
                3,
            ),
            ("inside_bar", "Inside Bar", "Price Action", "neutral", 5),
            ("outside_bar", "Outside Bar", "Price Action", "neutral", 4),
            (
                "close_near_high",
                "Close Near High",
                "Price Action",
                "bullish",
                4,
            ),
            (
                "close_near_low",
                "Close Near Low",
                "Price Action",
                "bearish",
                4,
            ),
            ("gap_up", "Gap Up", "Price Action", "bullish", 3),
            ("gap_down", "Gap Down", "Price Action", "bearish", 3),
            ("nr7", "NR7 (Narrow Range 7)", "Price Action", "neutral", 2),
            (
                "wide_range_candle",
                "Wide Range Candle",
                "Volatility",
                "neutral",
                3,
            ),
        ];
        for (id, expected_name, expected_category, expected_direction, count) in samples {
            let mut bars: Vec<NativeBar> = (0..20).map(make_bar).collect();
            let today = bars.last_mut().unwrap();
            match id {
                "prev_day_high_break" => {
                    today.open = 108.0;
                    today.high = 115.0;
                    today.low = 105.0;
                    today.close = 112.0;
                }
                "prev_day_low_break" => {
                    today.open = 92.0;
                    today.high = 95.0;
                    today.low = 85.0;
                    today.close = 89.0;
                }
                "inside_bar" => {
                    today.high = 109.0;
                    today.low = 91.0;
                }
                "outside_bar" => {
                    today.high = 111.0;
                    today.low = 89.0;
                }
                "close_near_high" => {
                    today.close = 109.0;
                }
                "close_near_low" => {
                    today.close = 91.0;
                }
                "gap_up" => {
                    today.open = 115.0;
                    today.high = 120.0;
                    today.low = 111.0;
                    today.close = 118.0;
                }
                "gap_down" => {
                    today.open = 85.0;
                    today.high = 89.0;
                    today.low = 80.0;
                    today.close = 83.0;
                }
                "nr7" => {
                    today.high = 105.0;
                    today.low = 95.0;
                }
                "wide_range_candle" => {
                    today.high = 130.0;
                    today.low = 70.0;
                }
                _ => unreachable!(),
            }
            let rule = RuleV1 {
                id: id.into(),
                expression: expected_expression(id).unwrap(),
            };
            let target = ScanTarget {
                exchange: "NSE".into(),
                symbol: "TEST".into(),
            };
            let result = core_match_record(&rule, &bars, &target, "2026-01-20", None)
                .unwrap()
                .unwrap();
            assert_eq!(result.scanner_name.as_deref(), Some(expected_name), "{id}");
            assert_eq!(
                result.category_name.as_deref(),
                Some(expected_category),
                "{id}"
            );
            assert_eq!(
                result.direction.as_deref(),
                Some(expected_direction),
                "{id}"
            );
            assert_eq!(
                result.source.as_deref(),
                Some("EODScannerPlugin_v1"),
                "{id}"
            );
            assert_eq!(result.reasons.as_ref().map(Vec::len), Some(1), "{id}");
            assert_eq!(
                result.values.as_ref().map(BTreeMap::len),
                Some(count),
                "{id}"
            );
            assert!(result.pattern.is_none() && result.history.is_none(), "{id}");
            assert!(result.score.is_none(), "{id}");
        }
    }

    #[test]
    fn every_core_id_has_an_exact_predicate_but_external_ids_do_not() {
        let ids = [
            "prev_day_high_break",
            "prev_day_low_break",
            "inside_bar",
            "outside_bar",
            "close_near_high",
            "close_near_low",
            "gap_up",
            "gap_down",
            "nr7",
            "wide_range_candle",
        ];
        assert_eq!(
            ids.iter()
                .filter(|id| expected_expression(id).is_some())
                .count(),
            10
        );
        assert!(expected_expression("chart_breakaway_gap").is_none());
        assert!(expected_expression("plugin_external").is_none());
    }
}
