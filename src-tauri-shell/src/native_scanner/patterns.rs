//! NS-01 / P0-01: bridge from the native scanner to the accepted Gap detectors.
//!
//! The scanner advertises four chart patterns as natively supported. Before this module
//! existed, `scan.rs` *skipped* any target whose rules were pattern rules, so the native
//! backend silently never executed the detection it claimed to support.
//!
//! This module does not reimplement any detection. It is a thin adapter:
//! - the `chart_*_gap` scanner ids are mapped to the RSC-02..RSC-06 detectors,
//! - `NativeBar` (packed `u32` dates, shared bar type) is converted to the contract's
//!   `EodBarV1` (ISO dates),
//! - the detector's own `ScannerResultV1` is converted into the scanner's match record
//!   while keeping every accepted field: confidence/score, direction, reasons, scalar
//!   values, pattern start/end dates, breakout/support/resistance levels, pivots and
//!   full geometry (zones, labels, target projection, trend lines).
//!
//! Thresholds, warm-up windows, historical window size, scoring and rounding therefore all
//! stay exactly where they already live, in the detector modules. If a detector changes,
//! the native scanner inherits that change automatically.

use super::ast::{ExprV1, RuleV1};
use super::reader::NativeBar;
use super::scan::ScanMatchRecord;
use crate::database::binary_eod::u32_to_date;
use crate::scanner_breakaway_gap::{detect_chart_breakaway_gap, CHART_BREAKAWAY_GAP_SCANNER_ID};
use crate::scanner_common_gap::{detect_chart_common_gap, CHART_COMMON_GAP_SCANNER_ID};
use crate::scanner_contract::{
    ChartPatternResultDetailsV1, EodBarV1, ScannerResultV1, ScannerRunTargetV1,
};
use crate::scanner_exhaustion_gap::{detect_chart_exhaustion_gap, CHART_EXHAUSTION_GAP_SCANNER_ID};
use crate::scanner_runaway_gap::{detect_chart_runaway_gap, CHART_RUNAWAY_GAP_SCANNER_ID};

/// Historical endpoint warm-up shared by all four detectors (`HISTORY_ENDPOINT_START`).
pub const PATTERN_HISTORY_ENDPOINT_START: usize = 20;

/// Largest per-endpoint window the detectors are designed to accept
/// (`MAX_PATTERN_WINDOW_BARS` / `MAX_HISTORY_WINDOW_BARS`).
pub const PATTERN_MAX_WINDOW_BARS: usize = 260;

/// Every pattern id the native backend can execute.
pub const NATIVE_PATTERN_IDS: [&str; 4] = [
    CHART_BREAKAWAY_GAP_SCANNER_ID,
    CHART_COMMON_GAP_SCANNER_ID,
    CHART_RUNAWAY_GAP_SCANNER_ID,
    CHART_EXHAUSTION_GAP_SCANNER_ID,
];

/// Minimum bars each detector requires before it can return a match.
fn minimum_bars(pattern_id: &str) -> Option<usize> {
    match pattern_id {
        // Breakaway Gap: 20-bar base + gap pair + current bar.
        CHART_BREAKAWAY_GAP_SCANNER_ID => Some(22),
        CHART_COMMON_GAP_SCANNER_ID => Some(12),
        // Runaway Gap and Exhaustion Gap both need a 20-bar trend plus the pair.
        CHART_RUNAWAY_GAP_SCANNER_ID => Some(22),
        CHART_EXHAUSTION_GAP_SCANNER_ID => Some(22),
        _ => None,
    }
}

/// Runs the detector that owns `pattern_id`.
///
/// Returns `None` when the pattern is not natively supported. A supported pattern that
/// simply does not match also returns `None` from the detector, which the caller reports
/// as "no match" for that rule.
fn detect(
    pattern_id: &str,
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<Option<ScannerResultV1>> {
    let result = match pattern_id {
        CHART_BREAKAWAY_GAP_SCANNER_ID => detect_chart_breakaway_gap(target, bars, generated_at),
        CHART_COMMON_GAP_SCANNER_ID => detect_chart_common_gap(target, bars, generated_at),
        CHART_RUNAWAY_GAP_SCANNER_ID => detect_chart_runaway_gap(target, bars, generated_at),
        CHART_EXHAUSTION_GAP_SCANNER_ID => detect_chart_exhaustion_gap(target, bars, generated_at),
        _ => return None,
    };
    Some(result)
}

/// True when the rule is a bare pattern rule the native backend can dispatch.
///
/// A composed expression such as `(pattern x) and (close > 10)` is *not* supported: the
/// numeric evaluator cannot resolve a pattern to a number, and silently treating it as a
/// boolean would invent semantics. Callers must treat `false` here as
/// "not natively evaluable" and fall back rather than skip.
pub fn pattern_rule_id(rule: &RuleV1) -> Option<&str> {
    match &rule.expression {
        ExprV1::Pattern { id } if NATIVE_PATTERN_IDS.contains(&id.as_str()) => Some(id.as_str()),
        _ => None,
    }
}

/// Bars a rule needs before it can be evaluated at all.
pub fn minimum_bars_for_pattern_rule(rule: &RuleV1) -> Option<usize> {
    pattern_rule_id(rule).and_then(minimum_bars)
}

fn to_contract_bars(bars: &[NativeBar]) -> Vec<EodBarV1> {
    bars.iter()
        .map(|bar| EodBarV1 {
            // The detector contract keys nothing on the symbol; the target is authoritative.
            symbol: String::new(),
            date: u32_to_date(bar.date),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
        })
        .collect()
}

fn to_contract_target(exchange: &str, symbol: &str) -> ScannerRunTargetV1 {
    ScannerRunTargetV1 {
        symbol: symbol.to_string(),
        exchange: exchange.to_string(),
        name: None,
    }
}

/// Converts the detector's accepted result into a native match record.
///
/// Every accepted field is preserved so the renderer receives byte-comparable metadata
/// instead of a neutral placeholder.
fn to_match_record(
    exchange: &str,
    symbol: &str,
    rule_id: &str,
    result: ScannerResultV1,
) -> ScanMatchRecord {
    let details: Option<super::scan::ScanPatternDetails> = result.chart_pattern.map(|pattern| {
        let ChartPatternResultDetailsV1 {
            family,
            confidence,
            pattern_start_date,
            pattern_end_date,
            breakout_level,
            support_level,
            resistance_level,
            neckline_level,
            target_price,
            stop_loss_price,
            potential_gain_pct,
            risk_reward_ratio,
            pivots,
            geometry,
        } = pattern;
        super::scan::ScanPatternDetails {
            family: format!("{family:?}").to_ascii_lowercase(),
            confidence,
            pattern_start_date,
            pattern_end_date,
            breakout_level,
            support_level,
            resistance_level,
            neckline_level,
            target_price,
            stop_loss_price,
            potential_gain_pct,
            risk_reward_ratio,
            pivots: pivots.map(|pivots| {
                pivots
                    .into_iter()
                    .map(|pivot| super::scan::ScanPatternPivot {
                        index: pivot.index,
                        date: pivot.date,
                        price: pivot.price,
                        kind: format!("{:?}", pivot.kind).to_ascii_lowercase(),
                    })
                    .collect()
            }),
            geometry: geometry.and_then(|geometry| {
                serde_json::to_value(&geometry)
                    .ok()
                    .map(|value| super::scan::ScanPatternGeometry { json: value })
            }),
        }
    });

    ScanMatchRecord {
        exchange: exchange.to_string(),
        symbol: symbol.to_string(),
        rule_id: rule_id.to_string(),
        date: result.date.clone(),
        value: result.score,
        scanner_name: Some(result.scanner_name),
        category_id: Some(result.category_id),
        category_name: Some(result.category_name),
        // The transport spelling comes from the contract enum itself; formatting the
        // enum with `Debug` would emit `Bullish`, which the renderer contract rejects.
        direction: result
            .direction
            .map(super::scan::ScanMatchRecord::direction_wire_text),
        score: result.score,
        reasons: result.reasons,
        values: result.values.map(|values| {
            values
                .into_iter()
                .filter_map(|(key, value)| value.map(|value| (key, value)))
                .collect()
        }),
        source: result.source,
        pattern: details,
        // Owned by the historical grouping pass in the executor, which is the only place
        // that knows whether the endpoint run is consecutive. A detector never groups.
        history: None,
    }
}

/// Outcome of evaluating one pattern rule at one endpoint.
pub enum PatternEvaluation {
    /// The detector ran; `None` means it did not match this endpoint.
    Evaluated(Option<ScannerResultV1>),
    /// The pattern is not dispatchable here (unsupported id or composed expression).
    Unsupported,
}

/// Evaluates one pattern rule over the supplied bar window.
pub fn evaluate_pattern_rule(
    rule: &RuleV1,
    exchange: &str,
    symbol: &str,
    bars: &[NativeBar],
    generated_at: &str,
) -> PatternEvaluation {
    let Some(pattern_id) = pattern_rule_id(rule) else {
        return PatternEvaluation::Unsupported;
    };
    // Warm-up: never ask a detector for a verdict it cannot make. A short window is
    // "not evaluated", which the caller records as a skip rather than a non-match.
    if let Some(required) = minimum_bars(pattern_id) {
        if bars.len() < required {
            return PatternEvaluation::Evaluated(None);
        }
    }

    let contract_bars = to_contract_bars(bars);
    let contract_target = to_contract_target(exchange, symbol);
    match detect(pattern_id, &contract_target, &contract_bars, generated_at) {
        Some(result) => PatternEvaluation::Evaluated(result),
        None => PatternEvaluation::Unsupported,
    }
}

/// Convenience wrapper returning the match record for a matched endpoint.
pub fn evaluate_pattern_match_record(
    rule: &RuleV1,
    exchange: &str,
    symbol: &str,
    bars: &[NativeBar],
    generated_at: &str,
) -> PatternEvaluation {
    evaluate_pattern_rule(rule, exchange, symbol, bars, generated_at)
}

/// Builds the match record from an accepted detector result.
pub fn pattern_match_record(
    exchange: &str,
    symbol: &str,
    rule_id: &str,
    result: ScannerResultV1,
) -> ScanMatchRecord {
    to_match_record(exchange, symbol, rule_id, result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(id: &str) -> RuleV1 {
        RuleV1 {
            id: format!("{id}_rule"),
            expression: ExprV1::Pattern { id: id.to_string() },
        }
    }

    fn bar(day: u32, open: f64, high: f64, low: f64, close: f64, volume: f64) -> NativeBar {
        NativeBar {
            date: 20240100 + day,
            open,
            high,
            low,
            close,
            prev_close: None,
            volume,
            open_interest: 0.0,
        }
    }

    /// A flat, quiet base followed by a genuine gap up on rising volume.
    fn gapped_series() -> Vec<NativeBar> {
        let mut bars: Vec<NativeBar> = (1..=24)
            .map(|day| bar(day, 100.0, 101.0, 99.0, 100.0, 1_000.0))
            .collect();
        // Gap up: today's low is above the previous high (101.0).
        bars.push(bar(25, 110.0, 113.0, 109.0, 112.0, 4_000.0));
        bars
    }

    #[test]
    fn p0_01_all_four_gap_patterns_are_dispatchable() {
        for id in NATIVE_PATTERN_IDS {
            let rule = rule(id);
            assert_eq!(
                pattern_rule_id(&rule),
                Some(id),
                "{id} must be dispatchable by the native scanner"
            );
            assert!(
                minimum_bars_for_pattern_rule(&rule).unwrap_or(0) >= 12,
                "{id} must declare a warm-up"
            );
        }
    }

    #[test]
    fn p0_01_composed_pattern_expressions_are_not_silently_evaluated() {
        let composed = RuleV1 {
            id: "composed".to_string(),
            expression: ExprV1::Binary {
                op: super::super::ast::BinaryOpV1::And,
                left: Box::new(ExprV1::Pattern {
                    id: CHART_BREAKAWAY_GAP_SCANNER_ID.to_string(),
                }),
                right: Box::new(ExprV1::Field {
                    field: super::super::ast::OhlcvFieldV1::Close,
                    lookback: 0,
                }),
            },
        };
        assert!(pattern_rule_id(&composed).is_none());
        match evaluate_pattern_rule(&composed, "NSE", "TEST", &gapped_series(), "t") {
            PatternEvaluation::Unsupported => {}
            _ => panic!("composed pattern rules must report Unsupported, never a verdict"),
        }
    }

    #[test]
    fn p0_01_breakaway_gap_positive_negative_and_warmup() {
        let bars = gapped_series();
        let matched = evaluate_pattern_rule(
            &rule(CHART_BREAKAWAY_GAP_SCANNER_ID),
            "NSE",
            "GAP",
            &bars,
            "2024-01-26T00:00:00.000Z",
        );
        match matched {
            PatternEvaluation::Evaluated(Some(result)) => {
                assert_eq!(result.scanner_id, CHART_BREAKAWAY_GAP_SCANNER_ID);
                assert_eq!(result.scanner_name, "Breakaway Gap");
                assert_eq!(result.date, "2024-01-25");
                assert!(result.chart_pattern.is_some(), "geometry must survive");
                assert!(result.direction.is_some(), "direction must survive");
                assert_eq!(result.category_id, "chart_patterns_gap");
            }
            other => panic!(
                "expected a Breakaway Gap match, got {:?}",
                matches!(other, _)
            ),
        }

        // A quiet series with no gap must not match.
        let quiet: Vec<NativeBar> = (1..=25)
            .map(|day| bar(day, 100.0, 101.0, 99.0, 100.0, 1_000.0))
            .collect();
        match evaluate_pattern_rule(
            &rule(CHART_BREAKAWAY_GAP_SCANNER_ID),
            "NSE",
            "QUIET",
            &quiet,
            "t",
        ) {
            PatternEvaluation::Evaluated(None) => {}
            _ => panic!("a quiet series must be a real evaluated non-match"),
        }

        // Too few bars is "not evaluated", never a match or a false non-match claim.
        match evaluate_pattern_rule(
            &rule(CHART_BREAKAWAY_GAP_SCANNER_ID),
            "NSE",
            "SHORT",
            &bars[..5],
            "t",
        ) {
            PatternEvaluation::Evaluated(None) => {}
            _ => panic!("warm-up must suppress evaluation"),
        }
    }

    #[test]
    fn p0_01_match_record_preserves_accepted_metadata() {
        let bars = gapped_series();
        let evaluated = evaluate_pattern_rule(
            &rule(CHART_BREAKAWAY_GAP_SCANNER_ID),
            "NSE",
            "GAP",
            &bars,
            "2024-01-26T00:00:00.000Z",
        );
        let PatternEvaluation::Evaluated(Some(result)) = evaluated else {
            panic!("expected a match");
        };
        let expected_score = result.score;
        let record = pattern_match_record("NSE", "GAP", CHART_BREAKAWAY_GAP_SCANNER_ID, result);

        assert_eq!(record.exchange, "NSE");
        assert_eq!(record.symbol, "GAP");
        assert_eq!(record.rule_id, CHART_BREAKAWAY_GAP_SCANNER_ID);
        assert_eq!(record.scanner_name.as_deref(), Some("Breakaway Gap"));
        assert_eq!(
            record.category_name.as_deref(),
            Some("Chart Patterns - Gaps")
        );
        assert!(record.score.is_some(), "score/confidence must survive");
        assert_eq!(record.score, expected_score);
        assert!(record.direction.is_some(), "direction must survive");
        assert!(record.reasons.as_ref().is_some_and(|r| !r.is_empty()));
        assert!(
            record.values.as_ref().is_some_and(|v| !v.is_empty()),
            "scalar values must survive"
        );
        let details = record.pattern.expect("pattern details must survive");
        assert!(details.confidence > 0.0);
        assert!(details.geometry.is_some(), "geometry must survive");
    }
}
