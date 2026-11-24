//! Chart-compatible latest evaluation for the four built-in Scanner signal presets.

use super::{
    ast::{
        ema, rsi, CrossKindV1, ExprV1, IndicatorNameV1, NativeScanRequestV1, OhlcvFieldV1,
        PriceBasisV1, UniverseSourceV1,
    },
    reader::{NativeBar, MAX_WINDOW_BARS},
    scan::{ScanMatchRecord, ScanTarget},
};
use crate::database::binary_eod::u32_to_date;
use crate::scanner_contract::ScannerScalarValueV1::{Float, Text};
use std::{cmp::Ordering, collections::BTreeMap};

enum IndicatorPair {
    MovingAverages,
    RsiThreshold(f64),
}

struct Preset {
    scanner_id: &'static str,
    name: &'static str,
    rule_id: &'static str,
    label: &'static str,
    bullish: bool,
    indicators: IndicatorPair,
}

const PRESETS: [Preset; 4] = [
    Preset {
        scanner_id: "signal_golden_cross",
        name: "Golden Cross (MA Cross Above)",
        rule_id: "preset_golden_cross",
        label: "Golden Cross (EMA 20 / SMA 50)",
        bullish: true,
        indicators: IndicatorPair::MovingAverages,
    },
    Preset {
        scanner_id: "signal_death_cross",
        name: "Death Cross (MA Cross Below)",
        rule_id: "preset_death_cross",
        label: "Death Cross (EMA 20 / SMA 50)",
        bullish: false,
        indicators: IndicatorPair::MovingAverages,
    },
    Preset {
        scanner_id: "signal_rsi_oversold_bounce",
        name: "RSI Oversold Bounce (> 30)",
        rule_id: "preset_rsi_oversold",
        label: "RSI Oversold Bounce (> 30)",
        bullish: true,
        indicators: IndicatorPair::RsiThreshold(30.0),
    },
    Preset {
        scanner_id: "signal_rsi_overbought_drop",
        name: "RSI Overbought Drop (< 70)",
        rule_id: "preset_rsi_overbought",
        label: "RSI Overbought Drop (< 70)",
        bullish: false,
        indicators: IndicatorPair::RsiThreshold(70.0),
    },
];

fn last_indicator_pair(values: &[Option<f64>]) -> Option<(f64, f64)> {
    let previous = values.len().checked_sub(2)?;
    Some((values[previous]?, values[previous + 1]?))
}

pub(super) fn chart_sma_pair(bars: &[NativeBar], period: usize) -> Option<(f64, f64)> {
    let seed = bars.get(..period)?;
    let mut sum = seed.iter().map(|bar| bar.close).sum::<f64>();
    let mut previous_sum = None;
    for (outgoing, incoming) in bars.iter().zip(&bars[period..]) {
        previous_sum = Some(sum);
        // technicalindicators advances its SMA sum by subtracting before adding.
        sum = (sum - outgoing.close) + incoming.close;
    }
    Some((previous_sum? / period as f64, sum / period as f64))
}

pub(super) fn compare_chart_rsi(value: f64, threshold: f64) -> Option<Ordering> {
    // For the fixed 30 and 70 thresholds, their decimal half-cent boundaries
    // are not representable as f64. Rust and JS tie rules give the same ordering.
    let rounded = format!("{value:.2}").parse::<f64>().ok()?;
    rounded.partial_cmp(&threshold)
}

fn endpoint_comparisons(preset: &Preset, bars: &[NativeBar]) -> Option<(Ordering, Ordering)> {
    match preset.indicators {
        IndicatorPair::MovingAverages => {
            let (previous_sma, latest_sma) = chart_sma_pair(bars, 50)?;
            let closes: Vec<_> = bars.iter().map(|bar| Some(bar.close)).collect();
            let (previous_ema, latest_ema) = last_indicator_pair(&ema(&closes, 20))?;
            Some((
                previous_ema.partial_cmp(&previous_sma)?,
                latest_ema.partial_cmp(&latest_sma)?,
            ))
        }
        IndicatorPair::RsiThreshold(threshold) => {
            let closes: Vec<_> = bars.iter().map(|bar| Some(bar.close)).collect();
            let (previous, latest) = last_indicator_pair(&rsi(&closes, 14))?;
            Some((
                compare_chart_rsi(previous, threshold)?,
                compare_chart_rsi(latest, threshold)?,
            ))
        }
    }
}

fn evaluate_preset(
    preset: &Preset,
    target: &ScanTarget,
    bars: &[NativeBar],
) -> Option<ScanMatchRecord> {
    let (previous, latest) = endpoint_comparisons(preset, bars)?;
    let bar = bars.last()?;
    let (direction, score, condition, trigger_price) = if preset.bullish {
        if previous == Ordering::Greater || latest != Ordering::Greater {
            return None;
        }
        ("bullish", 85.0, "crosses_above", bar.low)
    } else {
        if previous == Ordering::Less || latest != Ordering::Less {
            return None;
        }
        ("bearish", 80.0, "crosses_below", bar.high)
    };
    let date = u32_to_date(bar.date);
    Some(ScanMatchRecord {
        exchange: target.exchange.clone(),
        symbol: target.symbol.clone(),
        rule_id: preset.scanner_id.to_owned(),
        scanner_name: Some(format!("{} ({})", preset.name, preset.label)),
        category_id: Some("visual_signals".to_owned()),
        category_name: Some("Visual Signals & Crossovers".to_owned()),
        direction: Some(direction.to_owned()),
        score: Some(score),
        reasons: Some(vec![format!("Triggered {} on {date}", preset.label)]),
        date,
        values: Some(BTreeMap::from([
            ("close".to_owned(), Float(bar.close)),
            ("trigger_price".to_owned(), Float(trigger_price)),
            ("condition".to_owned(), Text(condition.to_owned())),
            ("rule_id".to_owned(), Text(preset.rule_id.to_owned())),
        ])),
        ..ScanMatchRecord::default()
    })
}

pub(super) const EVALUATOR_VERSION: u32 = 1;
pub(super) const MIN_LOOKBACK_BARS: usize = 20;

fn definition(id: &str) -> Option<&'static Preset> {
    PRESETS.iter().find(|preset| preset.scanner_id == id)
}

pub(super) fn supported_ids() -> impl Iterator<Item = &'static str> {
    PRESETS.iter().map(|preset| preset.scanner_id)
}

pub(super) fn is_preset_id(id: &str) -> bool {
    definition(id).is_some()
}

pub(super) fn uses_presets(request: &NativeScanRequestV1) -> bool {
    request.rules.iter().any(|rule| is_preset_id(&rule.id))
}

pub(super) fn canonical_expression(id: &str) -> Option<ExprV1> {
    let preset = definition(id)?;
    let indicator = |name, period| ExprV1::Indicator {
        name,
        period,
        input: Some(Box::new(ExprV1::Field {
            field: OhlcvFieldV1::Close,
            lookback: 0,
        })),
    };
    let (left, right) = match preset.indicators {
        IndicatorPair::MovingAverages => (
            indicator(IndicatorNameV1::Ema, 20),
            indicator(IndicatorNameV1::Sma, 50),
        ),
        IndicatorPair::RsiThreshold(value) => (
            indicator(IndicatorNameV1::Rsi, 14),
            ExprV1::Number { value },
        ),
    };
    Some(ExprV1::Cross {
        kind: if preset.bullish {
            CrossKindV1::Over
        } else {
            CrossKindV1::Under
        },
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub(super) fn validate_request(
    request: &NativeScanRequestV1,
) -> Result<(), (&'static str, &'static str)> {
    if !uses_presets(request) {
        return Ok(());
    }
    if request.universe.source != UniverseSourceV1::ExplicitTargets
        || request.universe.targets.is_empty()
    {
        return Err((
            "request.universe",
            "Native signal presets require explicit targets.",
        ));
    }
    let evaluation = &request.evaluation;
    if evaluation.evaluate_history
        || evaluation.price_basis != PriceBasisV1::Raw
        || evaluation.include_dividend_adjustments
        || evaluation.include_rights_adjustments
    {
        return Err((
            "request.evaluation",
            "Native signal presets require raw latest evaluation.",
        ));
    }
    if !evaluation
        .lookback_bars
        .is_some_and(|bars| (MIN_LOOKBACK_BARS..=MAX_WINDOW_BARS).contains(&bars))
    {
        return Err((
            "request.evaluation.lookbackBars",
            "Native signal presets require a lookback from 20 to 5,000 bars.",
        ));
    }
    if !request
        .rules
        .iter()
        .all(|rule| canonical_expression(&rule.id).as_ref() == Some(&rule.expression))
    {
        return Err((
            "request.rules",
            "Native signal preset batches must contain only canonical built-in signal rules.",
        ));
    }
    Ok(())
}

/// Evaluate the preset-specific indicators on the exact window loaded by the caller.
pub(super) fn evaluate(
    id: &str,
    target: &ScanTarget,
    bars: &[NativeBar],
) -> Option<ScanMatchRecord> {
    evaluate_preset(definition(id)?, target, bars)
}
