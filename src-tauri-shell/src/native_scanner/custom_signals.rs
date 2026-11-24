//! Bounded latest-bar evaluator for the Scanner's configured signal rules.

use super::{
    ast::{ema, rsi, NativeScanRequestV1, PriceBasisV1, UniverseSourceV1, MAX_RULES},
    preset_signals::{chart_sma_pair, MIN_LOOKBACK_BARS},
    reader::NativeBar,
    scan::{ScanMatchRecord, ScanTarget},
};
use crate::{
    database::binary_eod::u32_to_date,
    scanner_contract::ScannerScalarValueV1::{Float, Text},
};
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};

pub(super) const SCANNER_ID: &str = "signal_active_custom_rules";
pub(super) const EVALUATOR_VERSION: u32 = 1;
pub(super) const MAX_POSSIBLE_RESULTS: usize = 4096;
pub(super) const MAX_RULE_ID_BYTES: usize = 128;
pub(super) const MAX_LABEL_BYTES: usize = 256;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct CustomSignalBatch {
    pub evaluator_version: u32,
    pub database_identity: String,
    pub rules: Vec<CustomSignalRule>,
}

impl CustomSignalBatch {
    pub(super) fn validate(
        &self,
        request: &NativeScanRequestV1,
        requested_targets: usize,
    ) -> Result<(), &'static str> {
        if self.evaluator_version != EVALUATOR_VERSION || self.database_identity.trim().is_empty() {
            return Err("Unsupported custom signal evaluator or missing database identity.");
        }
        let evaluation = &request.evaluation;
        if request.universe.source != UniverseSourceV1::ExplicitTargets
            || request.universe.targets.len() != requested_targets
            || requested_targets == 0
            || evaluation.evaluate_history
            || evaluation.price_basis != PriceBasisV1::Raw
            || evaluation.include_dividend_adjustments
            || evaluation.include_rights_adjustments
            || !evaluation
                .lookback_bars
                .is_some_and(|bars| bars >= MIN_LOOKBACK_BARS)
        {
            return Err(
                "Custom signals require distinct explicit targets and a bounded raw latest window.",
            );
        }
        if self.rules.is_empty()
            || self.rules.len() > MAX_RULES
            || requested_targets.saturating_mul(self.rules.len()) > MAX_POSSIBLE_RESULTS
        {
            return Err("The custom signal selection exceeds the native rule or result limit.");
        }
        let mut ids = HashSet::new();
        for rule in &self.rules {
            if rule.id.trim().is_empty()
                || rule.id.len() > MAX_RULE_ID_BYTES
                || rule.label.len() > MAX_LABEL_BYTES
                || !ids.insert(rule.id.as_str())
                || !rule.series_a.is_valid()
                || !rule.series_b.is_valid()
            {
                return Err(
                    "A custom signal rule has an invalid or duplicate ID, label or target.",
                );
            }
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Condition {
    CrossesAbove,
    CrossesBelow,
    GreaterThan,
    LessThan,
}

impl Condition {
    fn is_up(self) -> bool {
        matches!(self, Self::CrossesAbove | Self::GreaterThan)
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::CrossesAbove => "crosses_above",
            Self::CrossesBelow => "crosses_below",
            Self::GreaterThan => "greater_than",
            Self::LessThan => "less_than",
        }
    }

    fn direction(self, shape: Option<Shape>) -> &'static str {
        match (self, shape) {
            (Self::CrossesAbove, _) | (Self::GreaterThan, Some(Shape::ArrowUp)) => "bullish",
            (Self::CrossesBelow, _) | (Self::LessThan, Some(Shape::ArrowDown)) => "bearish",
            _ => "neutral",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Shape {
    ArrowUp,
    ArrowDown,
    Circle,
    Square,
    Cross,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Position {
    AboveBar,
    BelowBar,
    OnSeries,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum OhlcSource {
    Close,
    Open,
    High,
    Low,
    Hl2,
    Hlc3,
    Ohlc4,
}

impl OhlcSource {
    fn value(self, bar: &NativeBar) -> f64 {
        match self {
            Self::Close => bar.close,
            Self::Open => bar.open,
            Self::High => bar.high,
            Self::Low => bar.low,
            Self::Hl2 => (bar.high + bar.low) / 2.0,
            Self::Hlc3 => (bar.high + bar.low + bar.close) / 3.0,
            Self::Ohlc4 => (bar.open + bar.high + bar.low + bar.close) / 4.0,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Plot {
    Ema20,
    Sma50,
    Sma200,
    Rsi14,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
enum Binding {
    Constant { value: f64 },
    Indicator { plot: Plot },
    Ohlc { source: OhlcSource },
}

impl Binding {
    fn is_valid(self) -> bool {
        !matches!(self, Self::Constant { value } if !value.is_finite())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct CustomSignalRule {
    pub id: String,
    label: String,
    condition_type: Condition,
    series_a: Binding,
    series_b: Binding,
    shape: Option<Shape>,
    position: Option<Position>,
}

type EndpointPair = (f64, f64);

fn endpoint_pair(values: &[Option<f64>]) -> Option<EndpointPair> {
    match values {
        [.., Some(previous), Some(latest)] => Some((*previous, *latest)),
        _ => None,
    }
}

pub(super) fn round_chart_rsi(value: f64) -> f64 {
    // For positive finite RSI, the exactly representable half-cent ties are odd
    // eighths. JS toFixed chooses the larger cent at ties. Rust formatting uses
    // ties-to-even, but correctly distinguishes neighboring floats from ties.
    if (value * 8.0) % 2.0 == 1.0 {
        return (value * 100.0 + 0.5) / 100.0;
    }
    format!("{value:.2}").parse().expect("formatted chart RSI")
}

struct SignalEndpoints<'a> {
    previous: &'a NativeBar,
    latest: &'a NativeBar,
    ema_20: Option<EndpointPair>,
    sma_50: Option<EndpointPair>,
    sma_200: Option<EndpointPair>,
    rsi_14: Option<EndpointPair>,
}

impl SignalEndpoints<'_> {
    fn resolve(&self, binding: Binding) -> Option<EndpointPair> {
        match binding {
            Binding::Constant { value } => Some((value, value)),
            Binding::Indicator { plot: Plot::Ema20 } => self.ema_20,
            Binding::Indicator { plot: Plot::Sma50 } => self.sma_50,
            Binding::Indicator { plot: Plot::Sma200 } => self.sma_200,
            Binding::Indicator { plot: Plot::Rsi14 } => self.rsi_14,
            Binding::Ohlc { source } => {
                Some((source.value(self.previous), source.value(self.latest)))
            }
        }
    }

    fn evaluate(&self, target: &ScanTarget, rule: &CustomSignalRule) -> Option<ScanMatchRecord> {
        let (previous_a, latest_a) = self.resolve(rule.series_a)?;
        let (previous_b, latest_b) = self.resolve(rule.series_b)?;
        let upward = rule.condition_type.is_up();
        let matched = if upward {
            previous_a <= previous_b && latest_a > latest_b
        } else {
            previous_a >= previous_b && latest_a < latest_b
        };
        if !matched {
            return None;
        }

        let default_position = if upward {
            Position::BelowBar
        } else {
            Position::AboveBar
        };
        let trigger_price = match rule.position.unwrap_or(default_position) {
            Position::AboveBar => self.latest.high,
            Position::BelowBar => self.latest.low,
            Position::OnSeries => latest_a,
        };
        let date = u32_to_date(self.latest.date);
        let label = &rule.label;
        let name = if label.is_empty() {
            "Custom Signal Rule"
        } else {
            label
        };
        let direction = rule.condition_type.direction(rule.shape);
        Some(ScanMatchRecord {
            symbol: target.symbol.clone(),
            exchange: target.exchange.clone(),
            rule_id: SCANNER_ID.to_string(),
            scanner_name: Some(format!("{name} ({label})")),
            category_id: Some("visual_signals".to_string()),
            category_name: Some("Visual Signals & Crossovers".to_string()),
            reasons: Some(vec![format!("Triggered {label} on {date}")]),
            date,
            direction: Some(direction.to_string()),
            score: Some(if direction == "bullish" { 85.0 } else { 80.0 }),
            values: Some(BTreeMap::from([
                ("close".to_string(), Float(self.latest.close)),
                ("trigger_price".to_string(), Float(trigger_price)),
                (
                    "condition".to_string(),
                    Text(rule.condition_type.as_str().to_string()),
                ),
                ("rule_id".to_string(), Text(rule.id.clone())),
            ])),
            value: None,
            source: None,
            pattern: None,
            history: None,
        })
    }
}

pub(super) fn evaluate_target(
    target: &ScanTarget,
    bars: &[NativeBar],
    rules: &[CustomSignalRule],
) -> Result<Vec<ScanMatchRecord>, String> {
    let [.., previous, latest] = bars else {
        return Err(format!("{} has fewer than 2 completed bars.", target.key()));
    };
    if bars.windows(2).any(|pair| pair[0].date >= pair[1].date)
        || bars.iter().any(|bar| {
            [bar.open, bar.high, bar.low, bar.close]
                .iter()
                .any(|price| !price.is_finite() || *price <= 0.0)
        })
    {
        return Err(format!(
            "{} has invalid or non-chronological raw bars.",
            target.key()
        ));
    }
    let closes: Vec<_> = bars.iter().map(|bar| Some(bar.close)).collect();
    let endpoints = SignalEndpoints {
        previous,
        latest,
        ema_20: endpoint_pair(&ema(&closes, 20)),
        sma_50: chart_sma_pair(bars, 50),
        sma_200: chart_sma_pair(bars, 200),
        rsi_14: endpoint_pair(&rsi(&closes, 14))
            .map(|(previous, latest)| (round_chart_rsi(previous), round_chart_rsi(latest))),
    };
    Ok(rules
        .iter()
        .filter_map(|rule| endpoints.evaluate(target, rule))
        .collect())
}
