//! NS-R3: Native Rust implementations of the remaining 50 chart-pattern detectors,
//! setups, primitives, and overlay geometry builders matching `src/features/chartPatterns/`.
//!
//! The 4 accepted gap detectors (`chart_common_gap`, `chart_breakaway_gap`,
//! `chart_runaway_gap`, `chart_exhaustion_gap`) continue to live in `scanner_*_gap.rs`.
//! This module implements exact behavioral, metadata, and geometry parity for the other 50
//! built-in chart patterns using the same `EodBarV1` and `ScannerResultV1` contract types.

use crate::scanner_breakaway_gap::{
    format_js_number, normalize_zero, round_js, scalar_number_v1, CHART_GAP_CATEGORY_ID,
    CHART_GAP_CATEGORY_NAME, CHART_PATTERN_SCANNER_SOURCE,
};
use crate::scanner_contract::{
    ChartPatternFamilyV1, ChartPatternGeometryFamilyV1, ChartPatternGeometryLabelV1,
    ChartPatternGeometryPivotMarkerV1, ChartPatternGeometryPointV1,
    ChartPatternGeometryTrendLineV1, ChartPatternGeometryV1, ChartPatternGeometryZoneV1,
    ChartPatternMarkerKindV1, ChartPatternPivotKindV1, ChartPatternPivotV1,
    ChartPatternResultDetailsV1, ChartPatternTrendLineRoleV1, ChartPatternZoneRoleV1, EodBarV1,
    ScannerDirectionV1, ScannerResultV1, ScannerRunTargetV1, ScannerScalarValueV1,
};
use std::collections::BTreeMap;

const CHART_REVERSAL_CATEGORY_ID: &str = "chart_patterns_reversal";
const CHART_REVERSAL_CATEGORY_NAME: &str = "Chart Patterns - Reversals";
const CHART_COMPLEX_CATEGORY_ID: &str = "chart_patterns_complex";
const CHART_COMPLEX_CATEGORY_NAME: &str = "Chart Patterns - Complex Bases";
const CHART_STRUCTURE_CATEGORY_ID: &str = "chart_patterns_structure";
const CHART_STRUCTURE_CATEGORY_NAME: &str = "Chart Patterns - Structures";

const MIN_GAP_PCT: f64 = 0.25;
const REVERSAL_LOOKBACK_BARS: usize = 180;
const STRUCTURE_LOOKBACK_BARS: usize = 120;
const CUP_HANDLE_LOOKBACK_BARS: usize = 160;

// ---------------------------------------------------------------------------
// Primitives & shared helpers (`primitives.ts` & `shared.ts`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PivotKind {
    High,
    Low,
}

impl From<PivotKind> for ChartPatternPivotKindV1 {
    fn from(kind: PivotKind) -> Self {
        match kind {
            PivotKind::High => Self::High,
            PivotKind::Low => Self::Low,
        }
    }
}

impl From<PivotKind> for ChartPatternMarkerKindV1 {
    fn from(kind: PivotKind) -> Self {
        match kind {
            PivotKind::High => Self::High,
            PivotKind::Low => Self::Low,
        }
    }
}

#[derive(Debug, Clone)]
struct Pivot {
    index: usize,
    date: String,
    price: f64,
    kind: PivotKind,
}

impl Pivot {
    fn to_contract(&self) -> ChartPatternPivotV1 {
        ChartPatternPivotV1 {
            index: self.index,
            date: self.date.clone(),
            price: normalize_zero(self.price),
            kind: self.kind.into(),
        }
    }

    fn to_point(&self) -> ChartPatternGeometryPointV1 {
        ChartPatternGeometryPointV1 {
            index: Some(self.index),
            date: self.date.clone(),
            price: normalize_zero(self.price),
        }
    }
}

fn tail_slice(bars: &[EodBarV1], count: usize) -> &[EodBarV1] {
    &bars[bars.len().saturating_sub(count)..]
}

fn bar_is_finite(bar: &EodBarV1) -> bool {
    bar.open.is_finite()
        && bar.high.is_finite()
        && bar.low.is_finite()
        && bar.close.is_finite()
        && bar.volume.is_finite()
}

fn candle_range(bar: &EodBarV1) -> f64 {
    (bar.high - bar.low).max(0.0)
}

fn average_range(bars: &[EodBarV1], period: usize, exclude_current: bool) -> Option<f64> {
    let source = if exclude_current {
        bars.get(..bars.len().checked_sub(1)?)?
    } else {
        bars
    };
    if period == 0 || source.len() < period {
        return None;
    }
    let window = &source[source.len() - period..];
    let sum: f64 = window.iter().map(candle_range).sum();
    let avg = sum / (period as f64);
    avg.is_finite().then_some(avg)
}

fn average_volume(bars: &[EodBarV1], period: usize, exclude_current: bool) -> Option<f64> {
    let source = if exclude_current {
        bars.get(..bars.len().checked_sub(1)?)?
    } else {
        bars
    };
    if period == 0 || source.len() < period {
        return None;
    }
    let window = &source[source.len() - period..];
    let sum: f64 = window.iter().map(|b| b.volume).sum();
    let avg = sum / (period as f64);
    avg.is_finite().then_some(avg)
}

fn gap_up_pct(today: &EodBarV1, previous: &EodBarV1) -> Option<f64> {
    if !today.open.is_finite() || !previous.high.is_finite() {
        return None;
    }
    if previous.high <= 0.0 || today.open <= previous.high {
        return None;
    }
    let pct = round_js((today.open / previous.high - 1.0) * 100.0, 2);
    pct.is_finite().then_some(pct)
}

fn gap_down_pct(today: &EodBarV1, previous: &EodBarV1) -> Option<f64> {
    if !today.open.is_finite() || !previous.low.is_finite() {
        return None;
    }
    if previous.low <= 0.0 || today.open >= previous.low {
        return None;
    }
    let pct = round_js((1.0 - today.open / previous.low) * 100.0, 2);
    pct.is_finite().then_some(pct)
}

fn highest_high(bars: &[EodBarV1]) -> Option<f64> {
    if bars.is_empty() {
        return None;
    }
    let mut best = f64::NEG_INFINITY;
    for bar in bars {
        if !bar.high.is_finite() {
            return None;
        }
        if bar.high > best {
            best = bar.high;
        }
    }
    Some(normalize_zero(best))
}

fn lowest_low(bars: &[EodBarV1]) -> Option<f64> {
    if bars.is_empty() {
        return None;
    }
    let mut best = f64::INFINITY;
    for bar in bars {
        if !bar.low.is_finite() {
            return None;
        }
        if bar.low < best {
            best = bar.low;
        }
    }
    Some(normalize_zero(best))
}

fn index_of_highest_high(bars: &[EodBarV1]) -> usize {
    let mut best_index = 0usize;
    for (index, bar) in bars.iter().enumerate() {
        if bar.high > bars[best_index].high {
            best_index = index;
        }
    }
    best_index
}

fn index_of_lowest_low(bars: &[EodBarV1]) -> usize {
    let mut best_index = 0usize;
    for (index, bar) in bars.iter().enumerate() {
        if bar.low < bars[best_index].low {
            best_index = index;
        }
    }
    best_index
}

fn is_range_bound(bars: &[EodBarV1], max_width_pct: f64) -> bool {
    let (Some(high), Some(low)) = (highest_high(bars), lowest_low(bars)) else {
        return false;
    };
    if high <= 0.0 || low <= 0.0 {
        return false;
    }
    let midpoint = (high + low) / 2.0;
    midpoint > 0.0 && ((high - low) / midpoint) * 100.0 <= max_width_pct
}

fn has_up_trend(bars: &[EodBarV1], min_move_pct: f64) -> bool {
    if bars.len() < 2 {
        return false;
    }
    let first = &bars[0];
    let last = &bars[bars.len() - 1];
    first.close > 0.0 && ((last.close / first.close - 1.0) * 100.0) >= min_move_pct
}

fn has_down_trend(bars: &[EodBarV1], min_move_pct: f64) -> bool {
    if bars.len() < 2 {
        return false;
    }
    let first = &bars[0];
    let last = &bars[bars.len() - 1];
    first.close > 0.0 && ((1.0 - last.close / first.close) * 100.0) >= min_move_pct
}

fn find_local_pivots(bars: &[EodBarV1], strength: usize) -> Vec<Pivot> {
    if strength < 1 || bars.len() < strength * 2 + 1 {
        return Vec::new();
    }
    let mut pivots = Vec::new();
    for index in strength..(bars.len() - strength) {
        let bar = &bars[index];
        let left = &bars[index - strength..index];
        let right = &bars[index + 1..index + strength + 1];
        if left.iter().chain(right.iter()).all(|n| bar.high > n.high) {
            pivots.push(Pivot {
                index,
                date: bar.date.clone(),
                price: bar.high,
                kind: PivotKind::High,
            });
        }
        if left.iter().chain(right.iter()).all(|n| bar.low < n.low) {
            pivots.push(Pivot {
                index,
                date: bar.date.clone(),
                price: bar.low,
                kind: PivotKind::Low,
            });
        }
    }
    pivots
}

fn linear_slope_values(values: &[f64]) -> Option<f64> {
    if values.len() < 2 {
        return None;
    }
    let points: Vec<(f64, f64)> = values
        .iter()
        .enumerate()
        .map(|(i, &y)| (i as f64, y))
        .collect();
    linear_slope_points(&points)
}

fn linear_slope_points(points: &[(f64, f64)]) -> Option<f64> {
    if points.len() < 2 {
        return None;
    }
    let n = points.len() as f64;
    let mut sum_x = 0.0_f64;
    let mut sum_y = 0.0_f64;
    let mut sum_xy = 0.0_f64;
    let mut sum_xx = 0.0_f64;
    for &(x, y) in points {
        sum_x += x;
        sum_y += y;
        sum_xy += x * y;
        sum_xx += x * x;
    }
    let denominator = n * sum_xx - sum_x * sum_x;
    if denominator == 0.0 {
        return None;
    }
    let slope = (n * sum_xy - sum_x * sum_y) / denominator;
    slope.is_finite().then_some(slope)
}

fn retracement_depth_pct(extreme1: f64, extreme2: f64, intervening: f64) -> f64 {
    let avg_extreme = (extreme1 + extreme2) / 2.0;
    if avg_extreme <= 0.0 {
        return 0.0;
    }
    round_js(((avg_extreme - intervening).abs() / avg_extreme) * 100.0, 2)
}

fn move_pct(bars: &[EodBarV1]) -> f64 {
    if bars.len() < 2 || bars[0].close <= 0.0 {
        return 0.0;
    }
    (bars[bars.len() - 1].close / bars[0].close - 1.0) * 100.0
}

fn average_close(bars: &[EodBarV1]) -> f64 {
    bars.iter().map(|b| b.close).sum::<f64>() / (bars.len() as f64)
}

fn average_segment_range(bars: &[EodBarV1]) -> f64 {
    if bars.is_empty() {
        return 0.0;
    }
    bars.iter().map(candle_range).sum::<f64>() / (bars.len() as f64)
}

fn segment_width(bars: &[EodBarV1]) -> Option<f64> {
    Some(highest_high(bars)? - lowest_low(bars)?)
}

fn is_long_directional_candle(bar: &EodBarV1, bullish: bool) -> bool {
    let range = candle_range(bar);
    let body = (bar.close - bar.open).abs();
    if range <= 0.0 || body / range < 0.55 {
        return false;
    }
    if bullish {
        bar.close > bar.open
    } else {
        bar.close < bar.open
    }
}

fn is_sharp_pivot(bars: &[EodBarV1], pivot: &Pivot, bottom: bool) -> bool {
    if pivot.index == 0 || pivot.index + 1 >= bars.len() || pivot.price <= 0.0 {
        return false;
    }
    let previous = &bars[pivot.index - 1];
    let next = &bars[pivot.index + 1];
    if bottom {
        previous.low > pivot.price * 1.07 && next.low > pivot.price * 1.07
    } else {
        previous.high < pivot.price * 0.93 && next.high < pivot.price * 0.93
    }
}

fn is_rounded_pivot(bars: &[EodBarV1], pivot: &Pivot, bottom: bool) -> bool {
    if pivot.price <= 0.0 {
        return false;
    }
    let start = pivot.index.saturating_sub(2);
    let end = (pivot.index + 3).min(bars.len());
    let window = &bars[start..end];
    if window.len() < 5 {
        return false;
    }
    if bottom {
        window
            .iter()
            .filter(|b| b.low <= pivot.price * 1.08)
            .count()
            >= 3
    } else {
        window
            .iter()
            .filter(|b| b.high >= pivot.price * 0.92)
            .count()
            >= 3
    }
}

fn count_touches(bars: &[EodBarV1], use_high: bool, level: f64, tolerance_pct: f64) -> usize {
    if level <= 0.0 {
        return 0;
    }
    bars.iter()
        .filter(|bar| {
            let value = if use_high { bar.high } else { bar.low };
            ((value - level).abs() / level) * 100.0 <= tolerance_pct
        })
        .count()
}

fn prices_comparable(prices: &[f64], tolerance_pct: f64) -> bool {
    if prices.is_empty() {
        return false;
    }
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &p in prices {
        if p < min {
            min = p;
        }
        if p > max {
            max = p;
        }
    }
    let midpoint = (min + max) / 2.0;
    midpoint > 0.0 && ((max - min) / midpoint) * 100.0 <= tolerance_pct
}

fn pivots_comparable(pivots: &[Pivot], tolerance_pct: f64) -> bool {
    let prices: Vec<f64> = pivots.iter().map(|p| p.price).collect();
    prices_comparable(&prices, tolerance_pct)
}

fn pivots_have_spacing(pivots: &[Pivot], min_spacing: usize) -> bool {
    pivots
        .windows(2)
        .all(|w| w[1].index - w[0].index >= min_spacing)
}

fn average_pivot_price(pivots: &[Pivot]) -> f64 {
    pivots.iter().map(|p| p.price).sum::<f64>() / (pivots.len() as f64)
}

// ---------------------------------------------------------------------------
// Setups (`src/features/chartPatterns/setups.ts`)
// ---------------------------------------------------------------------------

struct ComparablePivotSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    pivots: Vec<Pivot>,
}

fn latest_comparable_pivot_setup(
    bars: &[EodBarV1],
    kind: PivotKind,
    count: usize,
) -> Option<ComparablePivotSetup<'_>> {
    if bars.len() < 12 {
        return None;
    }
    let pattern_bars = tail_slice(bars, REVERSAL_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let pivot_source = &pattern_bars[..pattern_bars.len() - 1];
    let mut pivots: Vec<Pivot> = find_local_pivots(pivot_source, 2)
        .into_iter()
        .filter(|p| p.kind == kind)
        .collect();
    if pivots.len() < count {
        return None;
    }
    pivots = pivots.split_off(pivots.len() - count);
    let tolerance = if count == 3 { 2.5 } else { 3.0 };
    if !pivots_comparable(&pivots, tolerance) {
        return None;
    }
    if !pivots_have_spacing(&pivots, 3) {
        return None;
    }
    if pivots[pivots.len() - 1].index - pivots[0].index > 140 {
        return None;
    }
    if pattern_bars.len() - 1 - pivots[pivots.len() - 1].index > 8 {
        return None;
    }
    let mut reactions = Vec::new();
    for i in 0..pivots.len() - 1 {
        let seg = &pattern_bars[pivots[i].index + 1..pivots[i + 1].index];
        let reaction = match kind {
            PivotKind::High => lowest_low(seg)?,
            PivotKind::Low => highest_high(seg)?,
        };
        if kind == PivotKind::High && reaction >= pivots[i].price.min(pivots[i + 1].price) {
            return None;
        }
        if kind == PivotKind::Low && reaction <= pivots[i].price.max(pivots[i + 1].price) {
            return None;
        }
        if retracement_depth_pct(pivots[i].price, pivots[i + 1].price, reaction) < 2.5 {
            return None;
        }
        let seg_height = ((pivots[i].price + pivots[i + 1].price) / 2.0 - reaction).abs();
        let symmetry_ratio = if seg_height > 0.0 {
            (pivots[i].price - pivots[i + 1].price).abs() / seg_height
        } else {
            1.0
        };
        if symmetry_ratio > 0.35 {
            return None;
        }
        reactions.push(reaction);
    }
    if reactions.len() == 2 && !prices_comparable(&reactions, 6.0) {
        return None;
    }

    let bars_between = &pattern_bars[pivots[0].index..=pivots[pivots.len() - 1].index];
    if bars_between.len() >= 3 {
        let intervening = match kind {
            PivotKind::High => lowest_low(bars_between),
            PivotKind::Low => highest_high(bars_between),
        };
        if let Some(val) = intervening {
            if retracement_depth_pct(pivots[0].price, pivots[pivots.len() - 1].price, val) < 2.0 {
                return None;
            }
        }
    }

    Some(ComparablePivotSetup {
        pattern_bars,
        latest,
        pivots,
    })
}

struct VReversalSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    previous: &'a EodBarV1,
    extreme: &'a EodBarV1,
    extreme_index: usize,
    move_pct: f64,
}

fn latest_v_reversal_setup(bars: &[EodBarV1], bottom: bool) -> Option<VReversalSetup<'_>> {
    if bars.len() < 15 {
        return None;
    }
    let pattern_bars = tail_slice(bars, 25);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let previous = &pattern_bars[pattern_bars.len() - 2];
    let source = &pattern_bars[..pattern_bars.len() - 1];
    let extreme_index = if bottom {
        index_of_lowest_low(source)
    } else {
        index_of_highest_high(source)
    };
    if extreme_index < source.len().saturating_sub(8) || extreme_index > source.len() - 1 {
        return None;
    }
    let extreme = &source[extreme_index];
    let first = &pattern_bars[0];
    if first.close <= 0.0 {
        return None;
    }
    if bottom {
        let decline_pct = (1.0 - extreme.low / first.close) * 100.0;
        if decline_pct < 10.0 || latest.close <= previous.high || latest.close <= latest.open {
            return None;
        }
        return Some(VReversalSetup {
            pattern_bars,
            latest,
            previous,
            extreme,
            extreme_index,
            move_pct: round_js(decline_pct, 2),
        });
    }
    let advance_pct = (extreme.high / first.close - 1.0) * 100.0;
    if advance_pct < 10.0 || latest.close >= previous.low || latest.close >= latest.open {
        return None;
    }
    Some(VReversalSetup {
        pattern_bars,
        latest,
        previous,
        extreme,
        extreme_index,
        move_pct: round_js(advance_pct, 2),
    })
}

struct HornSetup {
    pivots: Vec<Pivot>,
    level: f64,
}

fn latest_horn_setup(bars: &[EodBarV1], bottom: bool) -> Option<HornSetup> {
    let pivot_kind = if bottom {
        PivotKind::Low
    } else {
        PivotKind::High
    };
    let setup = latest_comparable_pivot_setup(bars, pivot_kind, 2)?;
    let first = &setup.pivots[0];
    let second = &setup.pivots[1];
    if second.index - first.index > 8 {
        return None;
    }
    let avg_range_period = 14usize.min((setup.pattern_bars.len() - 1).max(2));
    let avg_range = average_range(setup.pattern_bars, avg_range_period, true)?;
    if avg_range == 0.0 {
        return None;
    }
    let first_bar = &setup.pattern_bars[first.index];
    let second_bar = &setup.pattern_bars[second.index];
    if candle_range(first_bar) < avg_range * 1.15 || candle_range(second_bar) < avg_range * 1.15 {
        return None;
    }
    let bars_between = &setup.pattern_bars[first.index + 1..second.index];
    let level = if bottom {
        highest_high(bars_between)?
    } else {
        lowest_low(bars_between)?
    };
    if bottom && setup.latest.close <= level {
        return None;
    }
    if !bottom && setup.latest.close >= level {
        return None;
    }
    Some(HornSetup {
        pivots: setup.pivots,
        level,
    })
}

struct RangeSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    support: f64,
    resistance: f64,
    width_pct: f64,
}

fn latest_range_setup(bars: &[EodBarV1], period: usize) -> Option<RangeSetup<'_>> {
    if bars.len() < period + 1 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let base_bars = &bars[bars.len() - (period + 1)..bars.len() - 1];
    let resistance = highest_high(base_bars)?;
    let support = lowest_low(base_bars)?;
    if resistance <= support {
        return None;
    }
    let midpoint = (resistance + support) / 2.0;
    let width_pct = if midpoint > 0.0 {
        ((resistance - support) / midpoint) * 100.0
    } else {
        0.0
    };
    if !(3.0..=18.0).contains(&width_pct) {
        return None;
    }
    if !is_range_bound(base_bars, 18.0) {
        return None;
    }
    Some(RangeSetup {
        base_bars,
        latest,
        support,
        resistance,
        width_pct: round_js(width_pct, 2),
    })
}

struct TriangleSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    resistance: f64,
    support: f64,
    high_pivots: Vec<Pivot>,
    low_pivots: Vec<Pivot>,
    high_slope: f64,
    low_slope: f64,
    resistance_touches: usize,
    support_touches: usize,
}

fn latest_triangle_setup(bars: &[EodBarV1], ascending: bool) -> Option<TriangleSetup<'_>> {
    if bars.len() < 12 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(STRUCTURE_LOOKBACK_BARS + 1);
    let base_bars = &bars[start..bars.len() - 1];
    if base_bars.len() < 12 {
        return None;
    }
    let resistance = highest_high(base_bars)?;
    let support = lowest_low(base_bars)?;
    let pivots = find_local_pivots(base_bars, 1);
    let mut high_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::High)
        .cloned()
        .collect();
    if high_pivots.len() > 4 {
        high_pivots = high_pivots.split_off(high_pivots.len() - 4);
    }
    let mut low_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::Low)
        .cloned()
        .collect();
    if low_pivots.len() > 4 {
        low_pivots = low_pivots.split_off(low_pivots.len() - 4);
    }
    let high_slope = if high_pivots.len() >= 2 {
        let pts: Vec<(f64, f64)> = high_pivots
            .iter()
            .map(|p| (p.index as f64, p.price))
            .collect();
        linear_slope_points(&pts)?
    } else {
        0.0
    };
    let low_slope = if low_pivots.len() >= 2 {
        let pts: Vec<(f64, f64)> = low_pivots
            .iter()
            .map(|p| (p.index as f64, p.price))
            .collect();
        linear_slope_points(&pts)?
    } else {
        0.0
    };
    let resistance_touches = count_touches(base_bars, true, resistance, 2.0);
    let support_touches = count_touches(base_bars, false, support, 2.0);

    if ascending {
        if low_pivots.len() < 2 || resistance_touches < 2 || low_slope <= 0.0 {
            return None;
        }
        let init_width = resistance - low_pivots[0].price;
        let final_width = resistance - low_pivots[low_pivots.len() - 1].price;
        if init_width <= 0.0 || (init_width - final_width) / init_width < 0.2 {
            return None;
        }
    } else {
        if high_pivots.len() < 2 || support_touches < 2 || high_slope >= 0.0 {
            return None;
        }
        let init_width = high_pivots[0].price - support;
        let final_width = high_pivots[high_pivots.len() - 1].price - support;
        if init_width <= 0.0 || (init_width - final_width) / init_width < 0.2 {
            return None;
        }
    }

    Some(TriangleSetup {
        base_bars,
        latest,
        resistance,
        support,
        high_pivots,
        low_pivots,
        high_slope,
        low_slope,
        resistance_touches,
        support_touches,
    })
}

struct SymmetricalTriangleSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    high_pivots: Vec<Pivot>,
    low_pivots: Vec<Pivot>,
    high_slope: f64,
    low_slope: f64,
    upper_level: f64,
    lower_level: f64,
}

fn latest_symmetrical_triangle_setup(bars: &[EodBarV1]) -> Option<SymmetricalTriangleSetup<'_>> {
    if bars.len() < 12 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(STRUCTURE_LOOKBACK_BARS + 1);
    let base_bars = &bars[start..bars.len() - 1];
    let pivots = find_local_pivots(base_bars, 1);
    let mut high_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::High)
        .cloned()
        .collect();
    if high_pivots.len() > 4 {
        high_pivots = high_pivots.split_off(high_pivots.len() - 4);
    }
    let mut low_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::Low)
        .cloned()
        .collect();
    if low_pivots.len() > 4 {
        low_pivots = low_pivots.split_off(low_pivots.len() - 4);
    }
    if high_pivots.len() < 2 || low_pivots.len() < 2 {
        return None;
    }
    let high_pts: Vec<(f64, f64)> = high_pivots
        .iter()
        .map(|p| (p.index as f64, p.price))
        .collect();
    let low_pts: Vec<(f64, f64)> = low_pivots
        .iter()
        .map(|p| (p.index as f64, p.price))
        .collect();
    let high_slope = linear_slope_points(&high_pts)?;
    let low_slope = linear_slope_points(&low_pts)?;
    if high_slope >= 0.0 || low_slope <= 0.0 {
        return None;
    }
    let upper_level = high_pivots[high_pivots.len() - 1].price;
    let lower_level = low_pivots[low_pivots.len() - 1].price;
    if upper_level <= lower_level {
        return None;
    }
    let init_width = high_pivots[0].price - low_pivots[0].price;
    let final_width = upper_level - lower_level;
    if init_width <= 0.0 || (init_width - final_width) / init_width < 0.2 {
        return None;
    }
    Some(SymmetricalTriangleSetup {
        base_bars,
        latest,
        high_pivots,
        low_pivots,
        high_slope,
        low_slope,
        upper_level,
        lower_level,
    })
}

struct WedgeSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    upper_level: f64,
    lower_level: f64,
    high_slope: f64,
    low_slope: f64,
    range_ratio: f64,
}

fn latest_wedge_setup(bars: &[EodBarV1], falling: bool) -> Option<WedgeSetup<'_>> {
    if bars.len() < 14 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(18);
    let base_bars = &bars[start..bars.len() - 1];
    if base_bars.len() < 12 {
        return None;
    }
    let highs: Vec<f64> = base_bars.iter().map(|b| b.high).collect();
    let lows: Vec<f64> = base_bars.iter().map(|b| b.low).collect();
    let high_slope = linear_slope_values(&highs)?;
    let low_slope = linear_slope_values(&lows)?;
    let first_range = average_segment_range(&base_bars[..5]);
    let last_range = average_segment_range(&base_bars[base_bars.len() - 5..]);
    if first_range <= 0.0 || last_range <= 0.0 {
        return None;
    }
    let range_ratio = last_range / first_range;
    if range_ratio > 0.75 {
        return None;
    }
    let upper_level = highest_high(&base_bars[base_bars.len() - 5..])?;
    let lower_level = lowest_low(&base_bars[base_bars.len() - 5..])?;
    if upper_level <= lower_level {
        return None;
    }

    let pivots = find_local_pivots(base_bars, 1);
    let high_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::High)
        .cloned()
        .collect();
    let low_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::Low)
        .cloned()
        .collect();
    let (upper_start_idx, upper_end_idx, upper_start_price, upper_end_price) =
        if high_pivots.len() >= 2 {
            let first = &high_pivots[0];
            let last = &high_pivots[high_pivots.len() - 1];
            (first.index, last.index, first.price, last.price)
        } else {
            (0, base_bars.len() - 1, base_bars[0].high, upper_level)
        };
    let (lower_start_idx, lower_end_idx, lower_start_price, lower_end_price) =
        if low_pivots.len() >= 2 {
            let first = &low_pivots[0];
            let last = &low_pivots[low_pivots.len() - 1];
            (first.index, last.index, first.price, last.price)
        } else {
            (0, base_bars.len() - 1, base_bars[0].low, lower_level)
        };
    if upper_end_idx <= upper_start_idx || lower_end_idx <= lower_start_idx {
        return None;
    }
    let upper_line_slope =
        (upper_end_price - upper_start_price) / ((upper_end_idx - upper_start_idx) as f64);
    let lower_line_slope =
        (lower_end_price - lower_start_price) / ((lower_end_idx - lower_start_idx) as f64);
    if falling {
        if !(upper_line_slope < 0.0
            && lower_line_slope < 0.0
            && upper_line_slope < lower_line_slope)
        {
            return None;
        }
    } else if !(upper_line_slope > 0.0
        && lower_line_slope > 0.0
        && lower_line_slope > upper_line_slope)
    {
        return None;
    }

    for (i, bar) in base_bars.iter().enumerate() {
        let upper_at =
            upper_start_price + upper_line_slope * ((i as isize - upper_start_idx as isize) as f64);
        let lower_at =
            lower_start_price + lower_line_slope * ((i as isize - lower_start_idx as isize) as f64);
        if upper_at <= lower_at {
            return None;
        }
        if bar.high > upper_at * 1.005 || bar.low < lower_at * 0.995 {
            return None;
        }
    }

    if falling {
        if !(high_slope < 0.0 && low_slope < 0.0 && high_slope < low_slope) {
            return None;
        }
    } else if !(high_slope > 0.0 && low_slope > 0.0 && low_slope > high_slope) {
        return None;
    }

    Some(WedgeSetup {
        base_bars,
        latest,
        upper_level,
        lower_level,
        high_slope,
        low_slope,
        range_ratio: round_js(range_ratio, 4),
    })
}

struct DiamondSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    support: f64,
    resistance: f64,
    middle_width: f64,
    final_width: f64,
}

fn latest_diamond_setup(bars: &[EodBarV1]) -> Option<DiamondSetup<'_>> {
    if bars.len() < 19 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let base_bars = &bars[bars.len() - 19..bars.len() - 1];
    if base_bars.len() < 18 {
        return None;
    }
    let early = &base_bars[0..6];
    let middle = &base_bars[6..12];
    let final_seg = &base_bars[12..];
    let early_width = segment_width(early)?;
    let middle_width = segment_width(middle)?;
    let final_width = segment_width(final_seg)?;
    if middle_width < early_width * 1.25 || final_width > middle_width * 0.75 {
        return None;
    }
    if final_width < early_width * 0.55 {
        return None;
    }
    let support = lowest_low(final_seg)?;
    let resistance = highest_high(final_seg)?;
    if resistance <= support {
        return None;
    }
    Some(DiamondSetup {
        base_bars,
        latest,
        support,
        resistance,
        middle_width: round_js(middle_width, 4),
        final_width: round_js(final_width, 4),
    })
}

struct BroadeningSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    support: f64,
    resistance: f64,
    high_slope: f64,
    low_slope: f64,
    range_ratio: f64,
}

fn latest_broadening_setup(bars: &[EodBarV1]) -> Option<BroadeningSetup<'_>> {
    if bars.len() < 14 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(18);
    let base_bars = &bars[start..bars.len() - 1];
    if base_bars.len() < 12 {
        return None;
    }
    let highs: Vec<f64> = base_bars.iter().map(|b| b.high).collect();
    let lows: Vec<f64> = base_bars.iter().map(|b| b.low).collect();
    let high_slope = linear_slope_values(&highs)?;
    let low_slope = linear_slope_values(&lows)?;
    if high_slope <= 0.0 || low_slope >= 0.0 {
        return None;
    }
    let first_range = average_segment_range(&base_bars[..5]);
    let last_range = average_segment_range(&base_bars[base_bars.len() - 5..]);
    if first_range <= 0.0 || last_range <= 0.0 {
        return None;
    }
    let range_ratio = last_range / first_range;
    if range_ratio < 1.25 {
        return None;
    }
    let support = lowest_low(base_bars)?;
    let resistance = highest_high(base_bars)?;
    if resistance <= support {
        return None;
    }
    Some(BroadeningSetup {
        base_bars,
        latest,
        support,
        resistance,
        high_slope,
        low_slope,
        range_ratio: round_js(range_ratio, 4),
    })
}

struct BumpRunSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    lead_slope: f64,
    bump_slope: f64,
    breakout_level: f64,
    extreme: f64,
}

fn latest_bump_run_setup(bars: &[EodBarV1], bottom: bool) -> Option<BumpRunSetup<'_>> {
    if bars.len() < 20 {
        return None;
    }
    let pattern_bars = &bars[bars.len() - 20..];
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let source = &pattern_bars[..pattern_bars.len() - 1];
    let lead = &source[0..7];
    let bump = &source[7..14];
    let run = &source[14..];
    if lead.len() < 6 || bump.len() < 6 || run.len() < 4 {
        return None;
    }
    let lead_closes: Vec<f64> = lead.iter().map(|b| b.close).collect();
    let bump_closes: Vec<f64> = bump.iter().map(|b| b.close).collect();
    let lead_slope = linear_slope_values(&lead_closes)?;
    let bump_slope = linear_slope_values(&bump_closes)?;
    let extreme_slice = &source[7..];

    if bottom {
        let breakout_level = highest_high(run)?;
        let extreme = lowest_low(extreme_slice)?;
        if !(lead_slope < 0.0 && bump_slope < lead_slope * 1.6) {
            return None;
        }
        if latest.close <= breakout_level || latest.close <= latest.open {
            return None;
        }
        return Some(BumpRunSetup {
            pattern_bars,
            latest,
            lead_slope,
            bump_slope,
            breakout_level,
            extreme,
        });
    }

    let breakout_level = lowest_low(run)?;
    let extreme = highest_high(extreme_slice)?;
    if !(lead_slope > 0.0 && bump_slope > lead_slope * 1.6) {
        return None;
    }
    if latest.close >= breakout_level || latest.close >= latest.open {
        return None;
    }
    Some(BumpRunSetup {
        pattern_bars,
        latest,
        lead_slope,
        bump_slope,
        breakout_level,
        extreme,
    })
}

struct BlowOffTopSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    advance_pct: f64,
    volume_ratio: Option<f64>,
    spike_high: f64,
    previous_low: f64,
}

fn latest_blow_off_top_setup(bars: &[EodBarV1]) -> Option<BlowOffTopSetup<'_>> {
    if bars.len() < 16 {
        return None;
    }
    let pattern_bars = &bars[bars.len() - 16..];
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let previous = &pattern_bars[pattern_bars.len() - 2];
    let prior = &pattern_bars[..pattern_bars.len() - 1];
    if !has_up_trend(prior, 18.0) {
        return None;
    }
    let avg_range = average_range(pattern_bars, 10, true)?;
    let avg_volume = average_volume(pattern_bars, 10, true);
    if candle_range(latest) < avg_range * 1.45 {
        return None;
    }
    let volume_ratio = avg_volume.filter(|&v| v > 0.0).map(|v| latest.volume / v);
    if let Some(ratio) = volume_ratio {
        if ratio < 1.7 {
            return None;
        }
    }
    if latest.high <= previous.high || latest.close >= latest.open || latest.close >= previous.low {
        return None;
    }
    Some(BlowOffTopSetup {
        pattern_bars,
        latest,
        advance_pct: round_js(move_pct(prior), 2),
        volume_ratio: volume_ratio.map(|r| round_js(r, 2)),
        spike_high: latest.high,
        previous_low: previous.low,
    })
}

struct ThreeMethodsSetup<'a> {
    first: &'a EodBarV1,
    middle: &'a [EodBarV1],
    latest: &'a EodBarV1,
}

fn latest_three_methods_setup(bars: &[EodBarV1], bullish: bool) -> Option<ThreeMethodsSetup<'_>> {
    if bars.len() < 5 {
        return None;
    }
    let pattern_bars = &bars[bars.len() - 5..];
    let first = &pattern_bars[0];
    let middle = &pattern_bars[1..4];
    let latest = &pattern_bars[4];
    if !is_long_directional_candle(first, bullish) {
        return None;
    }
    let first_range = candle_range(first);
    let contained = middle
        .iter()
        .all(|b| b.high < first.high && b.low > first.low && candle_range(b) < first_range * 0.7);
    if !contained {
        return None;
    }
    if bullish {
        if latest.close <= latest.open || latest.close <= first.high {
            return None;
        }
    } else if latest.close >= latest.open || latest.close >= first.low {
        return None;
    }
    Some(ThreeMethodsSetup {
        first,
        middle,
        latest,
    })
}

struct MatHoldSetup<'a> {
    first: &'a EodBarV1,
    middle: &'a [EodBarV1],
    latest: &'a EodBarV1,
    breakout_level: f64,
    hold_level: f64,
}

fn latest_mat_hold_setup(bars: &[EodBarV1], bullish: bool) -> Option<MatHoldSetup<'_>> {
    if bars.len() < 5 {
        return None;
    }
    let pattern_bars = &bars[bars.len() - 5..];
    let first = &pattern_bars[0];
    let middle = &pattern_bars[1..4];
    let latest = &pattern_bars[4];
    if !is_long_directional_candle(first, bullish) {
        return None;
    }
    if bullish {
        let breakout_level = highest_high(&pattern_bars[0..4])?;
        let hold_level = first.open.max(first.low);
        if !middle
            .iter()
            .all(|b| b.low >= hold_level && b.close >= first.open)
        {
            return None;
        }
        if latest.close <= latest.open || latest.close <= breakout_level {
            return None;
        }
        return Some(MatHoldSetup {
            first,
            middle,
            latest,
            breakout_level,
            hold_level,
        });
    }
    let breakout_level = lowest_low(&pattern_bars[0..4])?;
    let hold_level = first.open.min(first.high);
    if !middle
        .iter()
        .all(|b| b.high <= hold_level && b.close <= first.open)
    {
        return None;
    }
    if latest.close >= latest.open || latest.close >= breakout_level {
        return None;
    }
    Some(MatHoldSetup {
        first,
        middle,
        latest,
        breakout_level,
        hold_level,
    })
}

struct ContinuationSetup<'a> {
    pole_bars: &'a [EodBarV1],
    consolidation_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    pole_move_pct: f64,
    breakout_level: f64,
    close_slope: f64,
    high_slope: f64,
    low_slope: f64,
}

fn latest_continuation_setup(
    bars: &[EodBarV1],
    bullish: bool,
    flag: bool,
) -> Option<ContinuationSetup<'_>> {
    if bars.len() < 13 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let pattern_bars = tail_slice(bars, 18);
    let source = &pattern_bars[..pattern_bars.len() - 1];
    if source.len() < 12 {
        return None;
    }
    let pole_bars = &source[..7];
    let consolidation_bars = &source[7..];
    if pole_bars.len() < 5 || consolidation_bars.len() < 5 {
        return None;
    }
    let raw_pole_move = move_pct(pole_bars);
    if bullish && raw_pole_move < 8.0 {
        return None;
    }
    if !bullish && raw_pole_move > -8.0 {
        return None;
    }
    let closes: Vec<f64> = consolidation_bars.iter().map(|b| b.close).collect();
    let highs: Vec<f64> = consolidation_bars.iter().map(|b| b.high).collect();
    let lows: Vec<f64> = consolidation_bars.iter().map(|b| b.low).collect();
    let close_slope = linear_slope_values(&closes)?;
    let high_slope = linear_slope_values(&highs)?;
    let low_slope = linear_slope_values(&lows)?;
    let high = highest_high(consolidation_bars)?;
    let low = lowest_low(consolidation_bars)?;
    let pole_height = (pole_bars[pole_bars.len() - 1].close - pole_bars[0].close).abs();
    if pole_height <= 0.0 || high - low > pole_height * 0.8 {
        return None;
    }
    if flag {
        if bullish && close_slope > 0.0 {
            return None;
        }
        if !bullish && close_slope < 0.0 {
            return None;
        }
    } else if !(high_slope < 0.0 && low_slope > 0.0) {
        return None;
    }
    if bullish {
        if latest.close <= high {
            return None;
        }
        return Some(ContinuationSetup {
            pole_bars,
            consolidation_bars,
            latest,
            pole_move_pct: round_js(raw_pole_move, 2),
            breakout_level: high,
            close_slope,
            high_slope,
            low_slope,
        });
    }
    if latest.close >= low {
        return None;
    }
    Some(ContinuationSetup {
        pole_bars,
        consolidation_bars,
        latest,
        pole_move_pct: round_js(raw_pole_move, 2),
        breakout_level: low,
        close_slope,
        high_slope,
        low_slope,
    })
}

fn pivot_slope(first: &Pivot, second: &Pivot) -> f64 {
    let span = second.index as isize - first.index as isize;
    if span == 0 {
        return 0.0;
    }
    (second.price - first.price) / (span as f64)
}

fn projected_pivot_line_price(first: &Pivot, second: &Pivot, target_index: usize) -> f64 {
    first.price
        + pivot_slope(first, second) * ((target_index as isize - first.index as isize) as f64)
}

fn latest_directional_pivot_pair(pivots: &[Pivot], rising: bool) -> Option<(Pivot, Pivot)> {
    if pivots.len() < 2 {
        return None;
    }
    for end_index in (1..pivots.len()).rev() {
        for start_index in (0..end_index).rev() {
            let first = &pivots[start_index];
            let second = &pivots[end_index];
            if second.index - first.index < 5 {
                continue;
            }
            let slope = pivot_slope(first, second);
            if (rising && slope > 0.0) || (!rising && slope < 0.0) {
                return Some((first.clone(), second.clone()));
            }
        }
    }
    None
}

struct ChannelSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    high_slope: f64,
    low_slope: f64,
    support: f64,
    resistance: f64,
    support_pivots: [Pivot; 2],
    resistance_pivots: [Pivot; 2],
}

fn latest_channel_setup(bars: &[EodBarV1], rising: bool) -> Option<ChannelSetup<'_>> {
    if bars.len() < 20 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(140);
    let base_bars = &bars[start..bars.len() - 1];
    if base_bars.len() < 18 {
        return None;
    }
    let pivots = find_local_pivots(base_bars, 2);
    let lows: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::Low)
        .cloned()
        .collect();
    let highs: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::High)
        .cloned()
        .collect();
    let (s0, s1) = latest_directional_pivot_pair(&lows, rising)?;
    let (r0, r1) = latest_directional_pivot_pair(&highs, rising)?;
    let low_slope = pivot_slope(&s0, &s1);
    let high_slope = pivot_slope(&r0, &r1);
    if rising {
        if high_slope <= 0.0 || low_slope <= 0.0 {
            return None;
        }
    } else if high_slope >= 0.0 || low_slope >= 0.0 {
        return None;
    }
    let max_abs = high_slope.abs().max(low_slope.abs());
    if max_abs == 0.0 {
        return None;
    }
    let slope_ratio = high_slope.abs().min(low_slope.abs()) / max_abs;
    if !slope_ratio.is_finite() || slope_ratio < 0.8 {
        return None;
    }
    let support = projected_pivot_line_price(&s0, &s1, base_bars.len());
    let resistance = projected_pivot_line_price(&r0, &r1, base_bars.len());
    if resistance <= support {
        return None;
    }
    let start_index = s0.index.min(r0.index);
    let start_width = projected_pivot_line_price(&r0, &r1, start_index)
        - projected_pivot_line_price(&s0, &s1, start_index);
    let end_width = resistance - support;
    if start_width <= 0.0
        || (start_width - end_width).abs() > ((start_width + end_width) / 2.0) * 0.25
    {
        return None;
    }
    let mean_price = average_close(&base_bars[start_index..]);
    if mean_price <= 0.0 {
        return None;
    }
    let containment_tol = (end_width * 0.12).max(mean_price * 0.015);
    let mut contained_bars = 0usize;
    let span_bars = base_bars.len() - start_index;
    for (i, bar) in base_bars.iter().enumerate().skip(start_index) {
        let upper_at = projected_pivot_line_price(&r0, &r1, i);
        let lower_at = projected_pivot_line_price(&s0, &s1, i);
        if bar.high <= upper_at + containment_tol && bar.low >= lower_at - containment_tol {
            contained_bars += 1;
        }
    }
    if span_bars == 0 || (contained_bars as f64) / (span_bars as f64) < 0.8 {
        return None;
    }
    let tolerance = ((resistance - support) * 0.1).max(latest.close.abs() * 0.005);
    if latest.close < support - tolerance || latest.close > resistance + tolerance {
        return None;
    }
    Some(ChannelSetup {
        base_bars,
        latest,
        high_slope,
        low_slope,
        support: round_js(support, 4),
        resistance: round_js(resistance, 4),
        support_pivots: [s0, s1],
        resistance_pivots: [r0, r1],
    })
}

struct HighTightFlagSetup<'a> {
    rally_bars: &'a [EodBarV1],
    pullback_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    rally_pct: f64,
    pullback_pct: f64,
    breakout_level: f64,
    pullback_low: f64,
}

fn latest_high_tight_flag_setup(bars: &[EodBarV1]) -> Option<HighTightFlagSetup<'_>> {
    if bars.len() < 15 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(21);
    let source = &bars[start..bars.len() - 1];
    if source.len() < 14 {
        return None;
    }
    let rally_bars = &source[..10];
    let pullback_bars = &source[10..];
    if rally_bars.len() < 8 || pullback_bars.len() < 4 {
        return None;
    }
    let rally_start = rally_bars[0].close;
    let rally_high = highest_high(rally_bars)?;
    let pullback_high = highest_high(pullback_bars)?;
    let pullback_low = lowest_low(pullback_bars)?;
    if rally_start <= 0.0 || rally_high <= 0.0 {
        return None;
    }
    let rally_pct = (rally_high / rally_start - 1.0) * 100.0;
    let pullback_pct = (1.0 - pullback_low / rally_high) * 100.0;
    if rally_pct < 100.0 || !(8.0..=35.0).contains(&pullback_pct) {
        return None;
    }
    if latest.close <= pullback_high {
        return None;
    }
    Some(HighTightFlagSetup {
        rally_bars,
        pullback_bars,
        latest,
        rally_pct: round_js(rally_pct, 2),
        pullback_pct: round_js(pullback_pct, 2),
        breakout_level: pullback_high,
        pullback_low,
    })
}

struct CoilSetup<'a> {
    base_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    first_range: f64,
    latest_range: f64,
    range_ratio: f64,
    support: f64,
    resistance: f64,
}

fn latest_coil_setup(bars: &[EodBarV1]) -> Option<CoilSetup<'_>> {
    if bars.len() < 8 {
        return None;
    }
    let latest = &bars[bars.len() - 1];
    let start = bars.len().saturating_sub(9);
    let base_bars = &bars[start..bars.len() - 1];
    if base_bars.len() < 7 {
        return None;
    }
    let ranges: Vec<f64> = base_bars.iter().map(candle_range).collect();
    let range_slope = linear_slope_values(&ranges)?;
    let first_range = ranges[0];
    let latest_range = ranges[ranges.len() - 1];
    if range_slope >= 0.0 || first_range <= 0.0 {
        return None;
    }
    let range_ratio = latest_range / first_range;
    if range_ratio > 0.65 {
        return None;
    }
    let support = lowest_low(base_bars)?;
    let resistance = highest_high(base_bars)?;
    if latest.close > resistance || latest.close < support {
        return None;
    }
    Some(CoilSetup {
        base_bars,
        latest,
        first_range: round_js(first_range, 4),
        latest_range: round_js(latest_range, 4),
        range_ratio: round_js(range_ratio, 4),
        support,
        resistance,
    })
}

struct ThreePivotSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    pivots: Vec<Pivot>,
    level: f64,
}

fn latest_three_pivot_setup(
    bars: &[EodBarV1],
    rising_valleys: bool,
) -> Option<ThreePivotSetup<'_>> {
    if bars.len() < 14 {
        return None;
    }
    let pattern_bars = tail_slice(bars, REVERSAL_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let pivot_source = &pattern_bars[..pattern_bars.len() - 1];
    let pivot_kind = if rising_valleys {
        PivotKind::Low
    } else {
        PivotKind::High
    };
    let mut pivots: Vec<Pivot> = find_local_pivots(pivot_source, 2)
        .into_iter()
        .filter(|p| p.kind == pivot_kind)
        .collect();
    if pivots.len() < 3 {
        return None;
    }
    pivots = pivots.split_off(pivots.len() - 3);
    if !pivots_have_spacing(&pivots, 3) || pattern_bars.len() - 1 - pivots[2].index > 6 {
        return None;
    }
    let seg1 = &pattern_bars[pivots[0].index + 1..pivots[1].index];
    let seg2 = &pattern_bars[pivots[1].index + 1..pivots[2].index];
    if rising_valleys {
        if !(pivots[1].price >= pivots[0].price * 1.008
            && pivots[2].price >= pivots[1].price * 1.008)
        {
            return None;
        }
        let peak1 = highest_high(seg1)?;
        let peak2 = highest_high(seg2)?;
        if retracement_depth_pct(pivots[0].price, pivots[1].price, peak1) < 2.0
            || retracement_depth_pct(pivots[1].price, pivots[2].price, peak2) < 2.0
        {
            return None;
        }
        if !(pivots[0].price < pivots[1].price && pivots[1].price < pivots[2].price) {
            return None;
        }
        let resistance = highest_high(&pattern_bars[pivots[0].index + 1..pivots[2].index])?;
        if latest.close <= resistance {
            return None;
        }
        return Some(ThreePivotSetup {
            pattern_bars,
            latest,
            pivots,
            level: resistance,
        });
    }

    if !(pivots[1].price <= pivots[0].price * 0.992 && pivots[2].price <= pivots[1].price * 0.992) {
        return None;
    }
    let valley1 = lowest_low(seg1)?;
    let valley2 = lowest_low(seg2)?;
    if retracement_depth_pct(pivots[0].price, pivots[1].price, valley1) < 2.0
        || retracement_depth_pct(pivots[1].price, pivots[2].price, valley2) < 2.0
    {
        return None;
    }
    if !(pivots[0].price > pivots[1].price && pivots[1].price > pivots[2].price) {
        return None;
    }
    let support = lowest_low(&pattern_bars[pivots[0].index + 1..pivots[2].index])?;
    if latest.close >= support {
        return None;
    }
    Some(ThreePivotSetup {
        pattern_bars,
        latest,
        pivots,
        level: support,
    })
}

struct MeasuredMoveSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    latest: &'a EodBarV1,
    first_leg_pct: f64,
    second_leg_pct: f64,
    leg_ratio: f64,
    correction_extreme: f64,
}

fn latest_measured_move_setup(bars: &[EodBarV1], up: bool) -> Option<MeasuredMoveSetup<'_>> {
    if bars.len() < 15 {
        return None;
    }
    let pattern_bars = &bars[bars.len() - 15..];
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let first_leg = &pattern_bars[0..5];
    let correction = &pattern_bars[5..10];
    let second_leg = &pattern_bars[10..];
    let first_leg_pct = move_pct(first_leg);
    let second_leg_pct = move_pct(second_leg);
    let first_abs = first_leg_pct.abs();
    let second_abs = second_leg_pct.abs();
    if first_abs < 8.0 || second_abs < 6.0 {
        return None;
    }
    let leg_ratio = second_abs / first_abs;
    if !(0.65..=1.45).contains(&leg_ratio) {
        return None;
    }
    if up {
        let correction_low = lowest_low(correction)?;
        if first_leg_pct <= 0.0 || second_leg_pct <= 0.0 {
            return None;
        }
        if !has_up_trend(second_leg, 6.0) || latest.close <= second_leg[second_leg.len() - 2].high {
            return None;
        }
        return Some(MeasuredMoveSetup {
            pattern_bars,
            latest,
            first_leg_pct: round_js(first_leg_pct, 2),
            second_leg_pct: round_js(second_leg_pct, 2),
            leg_ratio: round_js(leg_ratio, 4),
            correction_extreme: correction_low,
        });
    }
    let correction_high = highest_high(correction)?;
    if first_leg_pct >= 0.0 || second_leg_pct >= 0.0 {
        return None;
    }
    if !has_down_trend(second_leg, 6.0) || latest.close >= second_leg[second_leg.len() - 2].low {
        return None;
    }
    Some(MeasuredMoveSetup {
        pattern_bars,
        latest,
        first_leg_pct: round_js(first_leg_pct, 2),
        second_leg_pct: round_js(second_leg_pct, 2),
        leg_ratio: round_js(leg_ratio, 4),
        correction_extreme: correction_high,
    })
}

struct HeadShouldersSetup {
    left_shoulder: Pivot,
    trough1: Option<Pivot>,
    head: Pivot,
    trough2: Option<Pivot>,
    right_shoulder: Pivot,
    neckline: f64,
}

fn latest_head_shoulders_setup(bars: &[EodBarV1], top: bool) -> Option<HeadShouldersSetup> {
    if bars.len() < 16 {
        return None;
    }
    let pattern_bars = tail_slice(bars, REVERSAL_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let pivot_source = &pattern_bars[..pattern_bars.len() - 1];
    let pivot_kind = if top { PivotKind::High } else { PivotKind::Low };
    let mut candidates: Vec<Pivot> = find_local_pivots(pivot_source, 2)
        .into_iter()
        .filter(|p| p.kind == pivot_kind)
        .collect();
    if candidates.len() < 3 {
        return None;
    }
    candidates = candidates.split_off(candidates.len() - 3);
    if !pivots_have_spacing(&candidates, 3) {
        return None;
    }
    let left_shoulder = candidates[0].clone();
    let head = candidates[1].clone();
    let right_shoulder = candidates[2].clone();
    if !prices_comparable(&[left_shoulder.price, right_shoulder.price], 6.0) {
        return None;
    }
    let time1 = head.index - left_shoulder.index;
    let time2 = right_shoulder.index - head.index;
    if time1 > 0 && time2 > 0 {
        let symmetry = (time1 as f64) / (time2 as f64);
        if !(0.35..=2.8).contains(&symmetry) {
            return None;
        }
    }

    if top {
        if !(head.price > left_shoulder.price * 1.04 && head.price > right_shoulder.price * 1.04) {
            return None;
        }
        let neck1_rel = index_of_lowest_low(&pattern_bars[left_shoulder.index + 1..head.index]);
        let neck2_rel = index_of_lowest_low(&pattern_bars[head.index + 1..right_shoulder.index]);
        let neck1_idx = left_shoulder.index + 1 + neck1_rel;
        let neck2_idx = head.index + 1 + neck2_rel;
        let trough1 = pattern_bars.get(neck1_idx).map(|b| Pivot {
            index: neck1_idx,
            date: b.date.clone(),
            price: b.low,
            kind: PivotKind::Low,
        });
        let trough2 = pattern_bars.get(neck2_idx).map(|b| Pivot {
            index: neck2_idx,
            date: b.date.clone(),
            price: b.low,
            kind: PivotKind::Low,
        });
        let slope = match (&trough1, &trough2) {
            (Some(t1), Some(t2)) => {
                linear_slope_points(&[(t1.index as f64, t1.price), (t2.index as f64, t2.price)])
                    .unwrap_or(0.0)
            }
            _ => 0.0,
        };
        let projected_neckline = match &trough1 {
            Some(t1) => round_js(
                t1.price + slope * ((pattern_bars.len() - 1 - t1.index) as f64),
                4,
            ),
            None => 0.0,
        };
        let avg_neckline = match (&trough1, &trough2) {
            (Some(t1), Some(t2)) => round_js((t1.price + t2.price) / 2.0, 4),
            _ => 0.0,
        };
        let neckline = if projected_neckline.is_finite() && projected_neckline > 0.0 {
            projected_neckline
        } else {
            avg_neckline
        };
        let head_height = head.price
            - if avg_neckline > 0.0 {
                avg_neckline
            } else {
                neckline
            };
        if head_height <= 0.0
            || (left_shoulder.price - right_shoulder.price).abs() / head_height > 0.35
        {
            return None;
        }
        if neckline <= 0.0 || latest.close >= neckline {
            return None;
        }
        return Some(HeadShouldersSetup {
            left_shoulder,
            trough1,
            head,
            trough2,
            right_shoulder,
            neckline,
        });
    }

    if !(head.price < left_shoulder.price * 0.96 && head.price < right_shoulder.price * 0.96) {
        return None;
    }
    let neck1_rel = index_of_highest_high(&pattern_bars[left_shoulder.index + 1..head.index]);
    let neck2_rel = index_of_highest_high(&pattern_bars[head.index + 1..right_shoulder.index]);
    let neck1_idx = left_shoulder.index + 1 + neck1_rel;
    let neck2_idx = head.index + 1 + neck2_rel;
    let trough1 = pattern_bars.get(neck1_idx).map(|b| Pivot {
        index: neck1_idx,
        date: b.date.clone(),
        price: b.high,
        kind: PivotKind::High,
    });
    let trough2 = pattern_bars.get(neck2_idx).map(|b| Pivot {
        index: neck2_idx,
        date: b.date.clone(),
        price: b.high,
        kind: PivotKind::High,
    });
    let slope = match (&trough1, &trough2) {
        (Some(t1), Some(t2)) => {
            linear_slope_points(&[(t1.index as f64, t1.price), (t2.index as f64, t2.price)])
                .unwrap_or(0.0)
        }
        _ => 0.0,
    };
    let projected_neckline = match &trough1 {
        Some(t1) => round_js(
            t1.price + slope * ((pattern_bars.len() - 1 - t1.index) as f64),
            4,
        ),
        None => 0.0,
    };
    let avg_neckline = match (&trough1, &trough2) {
        (Some(t1), Some(t2)) => round_js((t1.price + t2.price) / 2.0, 4),
        _ => 0.0,
    };
    let neckline = if projected_neckline.is_finite() && projected_neckline > 0.0 {
        projected_neckline
    } else {
        avg_neckline
    };
    let head_depth = if avg_neckline > 0.0 {
        avg_neckline
    } else {
        neckline
    } - head.price;
    if head_depth <= 0.0 || (left_shoulder.price - right_shoulder.price).abs() / head_depth > 0.35 {
        return None;
    }
    if neckline <= 0.0 || latest.close <= neckline {
        return None;
    }
    Some(HeadShouldersSetup {
        left_shoulder,
        trough1,
        head,
        trough2,
        right_shoulder,
        neckline,
    })
}

struct CupHandleSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    rim_level: f64,
    cup_extreme: f64,
    handle_pullback_pct: f64,
}

fn latest_cup_handle_setup(bars: &[EodBarV1], bullish: bool) -> Option<CupHandleSetup<'_>> {
    if bars.len() < 18 {
        return None;
    }
    let pattern_bars = tail_slice(bars, CUP_HANDLE_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let cup_bars = &pattern_bars[..pattern_bars.len() - 5];
    let handle_bars = &pattern_bars[pattern_bars.len() - 5..pattern_bars.len() - 1];
    if cup_bars.len() < 12 || handle_bars.len() < 3 {
        return None;
    }
    let left = &cup_bars[0];
    let right = &cup_bars[cup_bars.len() - 1];
    let rim_level = round_js((left.close + right.close) / 2.0, 4);
    if rim_level <= 0.0 {
        return None;
    }
    if bullish {
        let cup_low = lowest_low(cup_bars)?;
        let handle_low = lowest_low(handle_bars)?;
        let handle_high = highest_high(handle_bars)?;
        let cup_depth = rim_level - cup_low;
        if cup_depth <= 0.0 || (left.close - right.close).abs() / rim_level > 0.08 {
            return None;
        }
        if handle_low < right.close - cup_depth * 0.45 {
            return None;
        }
        if latest.close <= handle_high || latest.close <= rim_level {
            return None;
        }
        return Some(CupHandleSetup {
            pattern_bars,
            rim_level,
            cup_extreme: cup_low,
            handle_pullback_pct: round_js(((right.close - handle_low) / right.close) * 100.0, 2),
        });
    }
    let cup_high = highest_high(cup_bars)?;
    let handle_high = highest_high(handle_bars)?;
    let handle_low = lowest_low(handle_bars)?;
    let cup_height = cup_high - rim_level;
    if cup_height <= 0.0 || (left.close - right.close).abs() / rim_level > 0.08 {
        return None;
    }
    if handle_high > right.close + cup_height * 0.45 {
        return None;
    }
    if latest.close >= handle_low || latest.close >= rim_level {
        return None;
    }
    Some(CupHandleSetup {
        pattern_bars,
        rim_level,
        cup_extreme: cup_high,
        handle_pullback_pct: round_js(((handle_high - right.close) / right.close) * 100.0, 2),
    })
}

struct RoundingSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    rim_level: f64,
    extreme: f64,
}

fn latest_rounding_setup(bars: &[EodBarV1], bottom: bool) -> Option<RoundingSetup<'_>> {
    if bars.len() < 18 {
        return None;
    }
    let pattern_bars = tail_slice(bars, 24);
    let len = pattern_bars.len();
    let latest = &pattern_bars[len - 1];
    let left = &pattern_bars[..6];
    let middle = &pattern_bars[6..len - 6];
    let right = &pattern_bars[len - 6..len - 1];
    if left.len() < 4 || middle.len() < 6 || right.len() < 4 {
        return None;
    }
    let left_avg = average_close(left);
    let right_avg = average_close(right);
    if left_avg <= 0.0
        || right_avg <= 0.0
        || (left_avg - right_avg).abs() / ((left_avg + right_avg) / 2.0) > 0.12
    {
        return None;
    }
    let rim_level = round_js((left_avg + right_avg) / 2.0, 4);
    if rim_level <= 0.0 {
        return None;
    }
    if bottom {
        let bowl_low = lowest_low(middle)?;
        if (rim_level - bowl_low) / rim_level < 0.12 {
            return None;
        }
        let middle_avg = average_close(middle);
        let middle_high = highest_high(middle)?;
        let right_high = highest_high(right)?;
        if middle_avg >= left_avg.min(right_avg) * 0.95 {
            return None;
        }
        if middle_high > rim_level * 1.04 || right_high > rim_level * 1.08 {
            return None;
        }
        if latest.close <= rim_level || latest.close <= right[right.len() - 1].close {
            return None;
        }
        return Some(RoundingSetup {
            pattern_bars,
            rim_level,
            extreme: bowl_low,
        });
    }
    let arch_high = highest_high(middle)?;
    if (arch_high - rim_level) / rim_level < 0.12 {
        return None;
    }
    let middle_avg = average_close(middle);
    let middle_low = lowest_low(middle)?;
    let right_low = lowest_low(right)?;
    if middle_avg <= left_avg.max(right_avg) * 1.05 {
        return None;
    }
    if middle_low < rim_level * 0.96 || right_low < rim_level * 0.92 {
        return None;
    }
    if latest.close >= rim_level || latest.close >= right[right.len() - 1].close {
        return None;
    }
    Some(RoundingSetup {
        pattern_bars,
        rim_level,
        extreme: arch_high,
    })
}

struct AdamEveSetup {
    adam: Pivot,
    eve: Pivot,
    neckline: f64,
}

fn latest_adam_eve_setup(bars: &[EodBarV1], bottom: bool) -> Option<AdamEveSetup> {
    if bars.len() < 16 {
        return None;
    }
    let pattern_bars = tail_slice(bars, REVERSAL_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let pivot_source = &pattern_bars[..pattern_bars.len() - 1];
    let pivot_kind = if bottom {
        PivotKind::Low
    } else {
        PivotKind::High
    };
    let mut pivots: Vec<Pivot> = find_local_pivots(pivot_source, 2)
        .into_iter()
        .filter(|p| p.kind == pivot_kind)
        .collect();
    if pivots.len() < 2 {
        return None;
    }
    pivots = pivots.split_off(pivots.len() - 2);
    if !pivots_have_spacing(&pivots, 4) {
        return None;
    }
    let adam = pivots[0].clone();
    let eve = pivots[1].clone();
    if !prices_comparable(&[adam.price, eve.price], 8.0) {
        return None;
    }
    if !is_sharp_pivot(pattern_bars, &adam, bottom) || !is_rounded_pivot(pattern_bars, &eve, bottom)
    {
        return None;
    }
    let between = &pattern_bars[adam.index + 1..eve.index];
    if bottom {
        let neckline = highest_high(between)?;
        if latest.close <= neckline {
            return None;
        }
        return Some(AdamEveSetup {
            adam,
            eve,
            neckline,
        });
    }
    let neckline = lowest_low(between)?;
    if latest.close >= neckline {
        return None;
    }
    Some(AdamEveSetup {
        adam,
        eve,
        neckline,
    })
}

struct ScallopHandleSetup<'a> {
    pattern_bars: &'a [EodBarV1],
    scallop_low: f64,
    right_rim: f64,
    breakout_level: f64,
    advance_pct: f64,
    handle_pullback_pct: f64,
}

fn latest_scallop_handle_setup(bars: &[EodBarV1]) -> Option<ScallopHandleSetup<'_>> {
    if bars.len() < 18 {
        return None;
    }
    let pattern_bars = tail_slice(bars, 24);
    let len = pattern_bars.len();
    let latest = &pattern_bars[len - 1];
    let base_bars = &pattern_bars[..len - 5];
    let handle_bars = &pattern_bars[len - 5..len - 1];
    if base_bars.len() < 12 || handle_bars.len() < 3 {
        return None;
    }
    let left = &base_bars[0];
    let right = &base_bars[base_bars.len() - 1];
    let low_index = index_of_lowest_low(base_bars);
    let scallop_low = base_bars[low_index].low;
    if low_index < 2 || low_index > base_bars.len() - 4 {
        return None;
    }
    if left.close <= 0.0 || right.close < left.close * 1.08 {
        return None;
    }
    if scallop_low > left.close * 0.92 {
        return None;
    }
    let handle_low = lowest_low(handle_bars)?;
    let handle_high = highest_high(handle_bars)?;
    let scallop_depth = right.close - scallop_low;
    if scallop_depth <= 0.0 || handle_low < right.close - scallop_depth * 0.45 {
        return None;
    }
    if latest.close <= handle_high || latest.close <= right.high {
        return None;
    }
    Some(ScallopHandleSetup {
        pattern_bars,
        scallop_low,
        right_rim: right.close,
        breakout_level: handle_high,
        advance_pct: round_js((right.close / scallop_low - 1.0) * 100.0, 2),
        handle_pullback_pct: round_js(((right.close - handle_low) / right.close) * 100.0, 2),
    })
}

struct ComplexHeadShouldersSetup {
    direction: ScannerDirectionV1,
    pivots: Vec<Pivot>,
    head: Pivot,
    head_idx: usize,
    neckline: f64,
}

fn latest_complex_head_shoulders_setup(
    bars: &[EodBarV1],
    top: bool,
) -> Option<ComplexHeadShouldersSetup> {
    if bars.len() < 22 {
        return None;
    }
    let pattern_bars = tail_slice(bars, REVERSAL_LOOKBACK_BARS);
    let latest = &pattern_bars[pattern_bars.len() - 1];
    let pivot_source = &pattern_bars[..pattern_bars.len() - 1];
    let pivot_kind = if top { PivotKind::High } else { PivotKind::Low };
    let mut pivots: Vec<Pivot> = find_local_pivots(pivot_source, 2)
        .into_iter()
        .filter(|p| p.kind == pivot_kind)
        .collect();
    if pivots.len() < 5 {
        return None;
    }
    pivots = pivots.split_off(pivots.len() - 5);
    if !pivots_have_spacing(&pivots, 2) {
        return None;
    }
    let mut head_pos = 0usize;
    for i in 1..pivots.len() {
        let better = if top {
            pivots[i].price > pivots[head_pos].price
        } else {
            pivots[i].price < pivots[head_pos].price
        };
        if better {
            head_pos = i;
        }
    }
    if head_pos == 0 || head_pos == pivots.len() - 1 {
        return None;
    }
    let head = pivots[head_pos].clone();
    let shoulder_prices: Vec<f64> = pivots
        .iter()
        .enumerate()
        .filter(|&(i, _)| i != head_pos)
        .map(|(_, p)| p.price)
        .collect();
    if !prices_comparable(&shoulder_prices, 8.0) {
        return None;
    }
    let between = &pattern_bars[pivots[0].index + 1..pivots[pivots.len() - 1].index];
    if top {
        let shoulder_high = shoulder_prices
            .iter()
            .copied()
            .fold(f64::NEG_INFINITY, f64::max);
        if head.price <= shoulder_high * 1.04 {
            return None;
        }
        let neckline = lowest_low(between)?;
        if latest.close >= neckline {
            return None;
        }
        return Some(ComplexHeadShouldersSetup {
            direction: ScannerDirectionV1::Bearish,
            pivots,
            head,
            head_idx: head_pos,
            neckline,
        });
    }
    let shoulder_low = shoulder_prices
        .iter()
        .copied()
        .fold(f64::INFINITY, f64::min);
    if head.price >= shoulder_low * 0.96 {
        return None;
    }
    let neckline = highest_high(between)?;
    if latest.close <= neckline {
        return None;
    }
    Some(ComplexHeadShouldersSetup {
        direction: ScannerDirectionV1::Bullish,
        pivots,
        head,
        head_idx: head_pos,
        neckline,
    })
}

// ---------------------------------------------------------------------------
// Geometry builders (`src/features/chartPatterns/geometry.ts`)
// ---------------------------------------------------------------------------

fn pt(date: &str, price: f64, index: Option<usize>) -> ChartPatternGeometryPointV1 {
    ChartPatternGeometryPointV1 {
        index,
        date: date.to_string(),
        price: normalize_zero(price),
    }
}

fn line(
    id: &str,
    label: &str,
    role: ChartPatternTrendLineRoleV1,
    start: ChartPatternGeometryPointV1,
    end: ChartPatternGeometryPointV1,
    extend_right: Option<bool>,
) -> ChartPatternGeometryTrendLineV1 {
    ChartPatternGeometryTrendLineV1 {
        id: id.to_string(),
        label: Some(label.to_string()),
        role,
        start,
        end,
        extend_right,
    }
}

fn zone(
    id: &str,
    label: Option<&str>,
    role: ChartPatternZoneRoleV1,
    start_date: &str,
    end_date: &str,
    low: f64,
    high: f64,
    fill_opacity: Option<f64>,
) -> ChartPatternGeometryZoneV1 {
    ChartPatternGeometryZoneV1 {
        id: id.to_string(),
        label: label.map(ToOwned::to_owned),
        role,
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        low: normalize_zero(low),
        high: normalize_zero(high),
        fill_opacity,
    }
}

fn pattern_label(
    text: &str,
    point: ChartPatternGeometryPointV1,
) -> Vec<ChartPatternGeometryLabelV1> {
    vec![ChartPatternGeometryLabelV1 {
        id: "pattern".to_string(),
        text: text.to_string(),
        point,
    }]
}

fn build_pivot_markers(pivots: &[Pivot]) -> Vec<ChartPatternGeometryPivotMarkerV1> {
    pivots
        .iter()
        .enumerate()
        .map(|(i, pivot)| ChartPatternGeometryPivotMarkerV1 {
            id: format!("pivot-{}", i + 1),
            label: format!(
                "{}{}",
                if pivot.kind == PivotKind::High {
                    "H"
                } else {
                    "L"
                },
                i + 1
            ),
            kind: pivot.kind.into(),
            role: None,
            index: Some(pivot.index),
            date: pivot.date.clone(),
            price: normalize_zero(pivot.price),
        })
        .collect()
}

fn build_island_geometry(
    name: &str,
    pre_gap: &EodBarV1,
    first_island: &EodBarV1,
    middle_island: &[EodBarV1],
    latest: &EodBarV1,
    top: bool,
    island_boundary: f64,
) -> ChartPatternGeometryV1 {
    let mut island_bars = Vec::with_capacity(1 + middle_island.len());
    island_bars.push(first_island.clone());
    island_bars.extend_from_slice(middle_island);
    let island_low = lowest_low(&island_bars).unwrap_or(island_boundary);
    let island_high = highest_high(&island_bars).unwrap_or(island_boundary);
    let last_island = &middle_island[middle_island.len() - 1];
    let (entry_low, entry_high) = if top {
        (pre_gap.high, first_island.low)
    } else {
        (first_island.high, pre_gap.low)
    };
    let (escape_low, escape_high) = if top {
        (latest.open, island_boundary)
    } else {
        (island_boundary, latest.open)
    };
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::GapZone,
        pivot_markers: None,
        trend_lines: None,
        zones: Some(vec![
            zone(
                "entry-gap",
                Some("Entry gap"),
                ChartPatternZoneRoleV1::Gap,
                &pre_gap.date,
                &first_island.date,
                entry_low.min(entry_high),
                entry_low.max(entry_high),
                None,
            ),
            zone(
                "island-range",
                Some("Island range"),
                ChartPatternZoneRoleV1::Island,
                &first_island.date,
                &last_island.date,
                island_low,
                island_high,
                None,
            ),
            zone(
                "escape-gap",
                Some("Escape gap"),
                ChartPatternZoneRoleV1::Gap,
                &last_island.date,
                &latest.date,
                escape_low.min(escape_high),
                escape_low.max(escape_high),
                None,
            ),
        ]),
        labels: Some(pattern_label(name, pt(&latest.date, latest.close, None))),
        target_projection: None,
    }
}

fn build_double_or_triple_geometry(
    setup: &ComparablePivotSetup<'_>,
    confirmation_level: f64,
    top: bool,
    name: &str,
    triple: bool,
) -> ChartPatternGeometryV1 {
    let first_pivot = &setup.pivots[0];
    let last_pivot = &setup.pivots[setup.pivots.len() - 1];
    let confirmation_role = if top {
        ChartPatternTrendLineRoleV1::Support
    } else {
        ChartPatternTrendLineRoleV1::Neckline
    };
    let latest_point = pt(
        &setup.latest.date,
        confirmation_level,
        Some(setup.pattern_bars.len() - 1),
    );
    let mut zone_low = confirmation_level;
    let mut zone_high = confirmation_level;
    for p in &setup.pivots {
        if p.price < zone_low {
            zone_low = p.price;
        }
        if p.price > zone_high {
            zone_high = p.price;
        }
    }
    ChartPatternGeometryV1 {
        family: if triple {
            ChartPatternGeometryFamilyV1::TripleTopBottom
        } else {
            ChartPatternGeometryFamilyV1::DoubleTopBottom
        },
        zones: Some(vec![zone(
            "reversal-base",
            None,
            ChartPatternZoneRoleV1::Base,
            &first_pivot.date,
            &last_pivot.date,
            round_js(zone_low, 4),
            round_js(zone_high, 4),
            Some(0.08),
        )]),
        pivot_markers: Some(build_pivot_markers(&setup.pivots)),
        trend_lines: Some(vec![line(
            "confirmation-level",
            if top { "Support" } else { "Neckline" },
            confirmation_role,
            pt(
                &first_pivot.date,
                confirmation_level,
                Some(first_pivot.index),
            ),
            latest_point.clone(),
            Some(true),
        )]),
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_v_reversal_geometry(
    setup: &VReversalSetup<'_>,
    bottom: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let extreme_price = if bottom {
        setup.extreme.low
    } else {
        setup.extreme.high
    };
    let extreme_point = pt(
        &setup.extreme.date,
        extreme_price,
        Some(setup.extreme_index),
    );
    let start_point = pt(
        &setup.pattern_bars[0].date,
        setup.pattern_bars[0].close,
        None,
    );
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::VReversal,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "extreme".to_string(),
            label: if bottom { "V Low" } else { "V High" }.to_string(),
            kind: if bottom {
                ChartPatternMarkerKindV1::Low
            } else {
                ChartPatternMarkerKindV1::High
            },
            role: None,
            index: Some(setup.extreme_index),
            date: setup.extreme.date.clone(),
            price: normalize_zero(extreme_price),
        }]),
        trend_lines: Some(vec![
            line(
                "approach",
                if bottom { "Decline" } else { "Advance" },
                ChartPatternTrendLineRoleV1::Generic,
                start_point,
                extreme_point.clone(),
                None,
            ),
            line(
                "reversal",
                "Reversal",
                ChartPatternTrendLineRoleV1::Generic,
                extreme_point,
                latest_point.clone(),
                None,
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_horn_geometry(
    setup: &HornSetup,
    top: bool,
    name: &str,
    latest_date: &str,
) -> ChartPatternGeometryV1 {
    let first_pivot = &setup.pivots[0];
    let confirmation_role = if top {
        ChartPatternTrendLineRoleV1::Support
    } else {
        ChartPatternTrendLineRoleV1::Neckline
    };
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Horn,
        pivot_markers: Some(build_pivot_markers(&setup.pivots)),
        trend_lines: Some(vec![line(
            "confirmation-level",
            if top { "Support" } else { "Neckline" },
            confirmation_role,
            pt(&first_pivot.date, setup.level, Some(first_pivot.index)),
            pt(latest_date, setup.level, None),
            Some(true),
        )]),
        zones: None,
        labels: Some(pattern_label(name, pt(latest_date, setup.level, None))),
        target_projection: None,
    }
}

fn build_bump_run_geometry(
    setup: &BumpRunSetup<'_>,
    bottom: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let lead = &setup.pattern_bars[0..7];
    let bump = &setup.pattern_bars[7..14];
    let run = &setup.pattern_bars[14..setup.pattern_bars.len() - 1];
    let extreme_bars = &setup.pattern_bars[7..setup.pattern_bars.len() - 1];
    let extreme_local_idx = if bottom {
        index_of_lowest_low(extreme_bars)
    } else {
        index_of_highest_high(extreme_bars)
    };
    let extreme_index = extreme_local_idx + 7;
    let extreme_bar = &setup.pattern_bars[extreme_index];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::BumpAndRun,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "extreme".to_string(),
            label: if bottom { "Bump Low" } else { "Bump High" }.to_string(),
            kind: if bottom {
                ChartPatternMarkerKindV1::Low
            } else {
                ChartPatternMarkerKindV1::High
            },
            role: None,
            index: Some(extreme_index),
            date: extreme_bar.date.clone(),
            price: normalize_zero(setup.extreme),
        }]),
        trend_lines: Some(vec![
            line(
                "lead-in",
                "Lead-in",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&lead[0].date, lead[0].close, None),
                pt(&lead[lead.len() - 1].date, lead[lead.len() - 1].close, None),
                None,
            ),
            line(
                "bump",
                "Bump",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&bump[0].date, bump[0].close, None),
                pt(&bump[bump.len() - 1].date, bump[bump.len() - 1].close, None),
                None,
            ),
            line(
                "run",
                "Run",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&run[0].date, run[0].close, None),
                pt(&setup.latest.date, setup.latest.close, None),
                None,
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.breakout_level, None),
        )),
        target_projection: None,
    }
}

fn build_blow_off_geometry(setup: &BlowOffTopSetup<'_>, name: &str) -> ChartPatternGeometryV1 {
    let first = &setup.pattern_bars[0];
    let previous = &setup.pattern_bars[setup.pattern_bars.len() - 2];
    let spike_point = pt(
        &setup.latest.date,
        setup.spike_high,
        Some(setup.pattern_bars.len() - 1),
    );
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::BlowOff,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "spike-high".to_string(),
            label: "Spike High".to_string(),
            kind: ChartPatternMarkerKindV1::High,
            role: None,
            index: Some(setup.pattern_bars.len() - 1),
            date: setup.latest.date.clone(),
            price: normalize_zero(setup.spike_high),
        }]),
        trend_lines: Some(vec![
            line(
                "advance",
                "Advance",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&first.date, first.close, None),
                spike_point.clone(),
                None,
            ),
            line(
                "reversal",
                "Reversal",
                ChartPatternTrendLineRoleV1::Generic,
                spike_point,
                pt(&setup.latest.date, setup.latest.close, None),
                None,
            ),
            line(
                "breakdown-support",
                "Breakdown support",
                ChartPatternTrendLineRoleV1::Support,
                pt(&previous.date, setup.previous_low, None),
                pt(&setup.latest.date, setup.previous_low, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.latest.close, None),
        )),
        target_projection: None,
    }
}

fn build_range_geometry(setup: &RangeSetup<'_>, name: &str) -> ChartPatternGeometryV1 {
    let first = &setup.base_bars[0];
    let last = &setup.base_bars[setup.base_bars.len() - 1];
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Range,
        pivot_markers: None,
        trend_lines: Some(vec![
            line(
                "support",
                "Range support",
                ChartPatternTrendLineRoleV1::Support,
                pt(&first.date, setup.support, None),
                pt(&latest_point.date, setup.support, None),
                Some(true),
            ),
            line(
                "resistance",
                "Range resistance",
                ChartPatternTrendLineRoleV1::Resistance,
                pt(&first.date, setup.resistance, None),
                pt(&latest_point.date, setup.resistance, None),
                Some(true),
            ),
        ]),
        zones: Some(vec![zone(
            "range-base",
            Some("Range base"),
            ChartPatternZoneRoleV1::Base,
            &first.date,
            &last.date,
            setup.support,
            setup.resistance,
            None,
        )]),
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_ascending_triangle_geometry(setup: &TriangleSetup<'_>) -> ChartPatternGeometryV1 {
    let first_bar = &setup.base_bars[0];
    let last_bar = &setup.base_bars[setup.base_bars.len() - 1];
    let first_low = &setup.low_pivots[0];
    let last_low = &setup.low_pivots[setup.low_pivots.len() - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Triangle,
        pivot_markers: Some(build_pivot_markers(&setup.low_pivots)),
        trend_lines: Some(vec![
            line(
                "resistance",
                "Resistance",
                ChartPatternTrendLineRoleV1::Resistance,
                pt(&first_bar.date, setup.resistance, None),
                pt(&last_bar.date, setup.resistance, None),
                Some(false),
            ),
            line(
                "rising-support",
                "Rising lows",
                ChartPatternTrendLineRoleV1::Lower,
                first_low.to_point(),
                last_low.to_point(),
                Some(false),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            "Ascending Triangle",
            pt(&setup.latest.date, setup.resistance, None),
        )),
        target_projection: None,
    }
}

fn build_descending_triangle_geometry(setup: &TriangleSetup<'_>) -> ChartPatternGeometryV1 {
    let first_bar = &setup.base_bars[0];
    let last_bar = &setup.base_bars[setup.base_bars.len() - 1];
    let first_high = &setup.high_pivots[0];
    let last_high = &setup.high_pivots[setup.high_pivots.len() - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Triangle,
        pivot_markers: Some(build_pivot_markers(&setup.high_pivots)),
        trend_lines: Some(vec![
            line(
                "falling-resistance",
                "Falling highs",
                ChartPatternTrendLineRoleV1::Upper,
                first_high.to_point(),
                last_high.to_point(),
                Some(false),
            ),
            line(
                "support",
                "Support",
                ChartPatternTrendLineRoleV1::Support,
                pt(&first_bar.date, setup.support, None),
                pt(&last_bar.date, setup.support, None),
                Some(false),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            "Descending Triangle",
            pt(&setup.latest.date, setup.support, None),
        )),
        target_projection: None,
    }
}

fn build_symmetrical_triangle_geometry(
    setup: &SymmetricalTriangleSetup<'_>,
) -> ChartPatternGeometryV1 {
    let mut combined = Vec::with_capacity(setup.high_pivots.len() + setup.low_pivots.len());
    combined.extend(setup.high_pivots.iter().cloned());
    combined.extend(setup.low_pivots.iter().cloned());
    combined.sort_by_key(|p| p.index);
    let first_high = &setup.high_pivots[0];
    let last_high = &setup.high_pivots[setup.high_pivots.len() - 1];
    let first_low = &setup.low_pivots[0];
    let last_low = &setup.low_pivots[setup.low_pivots.len() - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Triangle,
        pivot_markers: Some(build_pivot_markers(&combined)),
        trend_lines: Some(vec![
            line(
                "falling-resistance",
                "Falling highs",
                ChartPatternTrendLineRoleV1::Upper,
                first_high.to_point(),
                last_high.to_point(),
                Some(false),
            ),
            line(
                "rising-support",
                "Rising lows",
                ChartPatternTrendLineRoleV1::Lower,
                first_low.to_point(),
                last_low.to_point(),
                Some(false),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            "Symmetrical Triangle",
            pt(&setup.latest.date, setup.latest.close, None),
        )),
        target_projection: None,
    }
}

fn build_wedge_geometry(
    setup: &WedgeSetup<'_>,
    name: &str,
    breakout_level: f64,
) -> ChartPatternGeometryV1 {
    let pivots = find_local_pivots(setup.base_bars, 1);
    let high_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::High)
        .cloned()
        .collect();
    let low_pivots: Vec<Pivot> = pivots
        .iter()
        .filter(|p| p.kind == PivotKind::Low)
        .cloned()
        .collect();
    let (upper_start, upper_end) = if high_pivots.len() >= 2 {
        (
            pt(&high_pivots[0].date, high_pivots[0].price, None),
            pt(
                &high_pivots[high_pivots.len() - 1].date,
                high_pivots[high_pivots.len() - 1].price,
                None,
            ),
        )
    } else {
        (
            pt(&setup.base_bars[0].date, setup.base_bars[0].high, None),
            pt(
                &setup.base_bars[setup.base_bars.len() - 1].date,
                setup.upper_level,
                None,
            ),
        )
    };
    let (lower_start, lower_end) = if low_pivots.len() >= 2 {
        (
            pt(&low_pivots[0].date, low_pivots[0].price, None),
            pt(
                &low_pivots[low_pivots.len() - 1].date,
                low_pivots[low_pivots.len() - 1].price,
                None,
            ),
        )
    } else {
        (
            pt(&setup.base_bars[0].date, setup.base_bars[0].low, None),
            pt(
                &setup.base_bars[setup.base_bars.len() - 1].date,
                setup.lower_level,
                None,
            ),
        )
    };
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Wedge,
        pivot_markers: None,
        trend_lines: Some(vec![
            line(
                "upper-boundary",
                "Upper wedge boundary",
                ChartPatternTrendLineRoleV1::Upper,
                upper_start,
                upper_end,
                Some(false),
            ),
            line(
                "lower-boundary",
                "Lower wedge boundary",
                ChartPatternTrendLineRoleV1::Lower,
                lower_start,
                lower_end,
                Some(false),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, breakout_level, None),
        )),
        target_projection: None,
    }
}

fn build_diamond_geometry(setup: &DiamondSetup<'_>, name: &str) -> ChartPatternGeometryV1 {
    let early = &setup.base_bars[0..6];
    let middle = &setup.base_bars[6..12];
    let final_seg = &setup.base_bars[12..];
    let middle_high = &middle[index_of_highest_high(middle)];
    let middle_low = &middle[index_of_lowest_low(middle)];
    let final_bar = &final_seg[final_seg.len() - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Diamond,
        pivot_markers: Some(vec![
            ChartPatternGeometryPivotMarkerV1 {
                id: "middle-high".to_string(),
                label: "Diamond High".to_string(),
                kind: ChartPatternMarkerKindV1::High,
                role: None,
                index: None,
                date: middle_high.date.clone(),
                price: normalize_zero(middle_high.high),
            },
            ChartPatternGeometryPivotMarkerV1 {
                id: "middle-low".to_string(),
                label: "Diamond Low".to_string(),
                kind: ChartPatternMarkerKindV1::Low,
                role: None,
                index: None,
                date: middle_low.date.clone(),
                price: normalize_zero(middle_low.low),
            },
        ]),
        trend_lines: Some(vec![
            line(
                "upper-expansion",
                "Upper expansion",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&early[0].date, early[0].high, None),
                pt(&middle_high.date, middle_high.high, None),
                None,
            ),
            line(
                "upper-contraction",
                "Upper contraction",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&middle_high.date, middle_high.high, None),
                pt(&final_bar.date, final_bar.high, None),
                Some(true),
            ),
            line(
                "lower-expansion",
                "Lower expansion",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&early[0].date, early[0].low, None),
                pt(&middle_low.date, middle_low.low, None),
                None,
            ),
            line(
                "lower-contraction",
                "Lower contraction",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&middle_low.date, middle_low.low, None),
                pt(&final_bar.date, final_bar.low, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.latest.close, None),
        )),
        target_projection: None,
    }
}

fn build_broadening_geometry(setup: &BroadeningSetup<'_>, name: &str) -> ChartPatternGeometryV1 {
    let first_bar = &setup.base_bars[0];
    let last_bar = &setup.base_bars[setup.base_bars.len() - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Broadening,
        pivot_markers: None,
        trend_lines: Some(vec![
            line(
                "rising-resistance",
                "Rising resistance",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&first_bar.date, first_bar.high, None),
                pt(&last_bar.date, last_bar.high, None),
                Some(true),
            ),
            line(
                "falling-support",
                "Falling support",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&first_bar.date, first_bar.low, None),
                pt(&last_bar.date, last_bar.low, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.latest.close, None),
        )),
        target_projection: None,
    }
}

fn build_three_methods_geometry(
    setup: &ThreeMethodsSetup<'_>,
    bullish: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let first = setup.first;
    let mid_first = &setup.middle[0];
    let mid_last = &setup.middle[setup.middle.len() - 1];
    let breakout_level = if bullish { first.high } else { first.low };
    let conf_role = if bullish {
        ChartPatternTrendLineRoleV1::Resistance
    } else {
        ChartPatternTrendLineRoleV1::Support
    };
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::CandleContinuation,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "impulse-extreme".to_string(),
            label: if bullish {
                "Impulse High"
            } else {
                "Impulse Low"
            }
            .to_string(),
            kind: if bullish {
                ChartPatternMarkerKindV1::High
            } else {
                ChartPatternMarkerKindV1::Low
            },
            role: None,
            index: None,
            date: first.date.clone(),
            price: normalize_zero(if bullish { first.high } else { first.low }),
        }]),
        trend_lines: Some(vec![
            line(
                "impulse",
                "Impulse candle",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&first.date, first.open, None),
                pt(&first.date, first.close, None),
                None,
            ),
            line(
                "consolidation-upper",
                "Consolidation upper boundary",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&mid_first.date, mid_first.high, None),
                pt(&mid_last.date, mid_last.high, None),
                None,
            ),
            line(
                "consolidation-lower",
                "Consolidation lower boundary",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&mid_first.date, mid_first.low, None),
                pt(&mid_last.date, mid_last.low, None),
                None,
            ),
            line(
                "confirmation",
                if bullish { "Breakout" } else { "Breakdown" },
                conf_role,
                pt(&first.date, breakout_level, None),
                pt(&latest_point.date, breakout_level, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_mat_hold_geometry(
    setup: &MatHoldSetup<'_>,
    bullish: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let first = setup.first;
    let mid_first = &setup.middle[0];
    let mid_last = &setup.middle[setup.middle.len() - 1];
    let conf_role = if bullish {
        ChartPatternTrendLineRoleV1::Resistance
    } else {
        ChartPatternTrendLineRoleV1::Support
    };
    let hold_role = if bullish {
        ChartPatternTrendLineRoleV1::Support
    } else {
        ChartPatternTrendLineRoleV1::Resistance
    };
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::CandleContinuation,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "impulse-extreme".to_string(),
            label: if bullish {
                "Impulse High"
            } else {
                "Impulse Low"
            }
            .to_string(),
            kind: if bullish {
                ChartPatternMarkerKindV1::High
            } else {
                ChartPatternMarkerKindV1::Low
            },
            role: None,
            index: None,
            date: first.date.clone(),
            price: normalize_zero(if bullish { first.high } else { first.low }),
        }]),
        trend_lines: Some(vec![
            line(
                "impulse",
                "Impulse candle",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&first.date, first.open, None),
                pt(&first.date, first.close, None),
                None,
            ),
            line(
                "hold-level",
                "Hold level",
                hold_role,
                pt(&first.date, setup.hold_level, None),
                pt(&latest_point.date, setup.hold_level, None),
                Some(true),
            ),
            line(
                "consolidation-upper",
                "Mat upper boundary",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&mid_first.date, mid_first.high, None),
                pt(&mid_last.date, mid_last.high, None),
                None,
            ),
            line(
                "consolidation-lower",
                "Mat lower boundary",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&mid_first.date, mid_first.low, None),
                pt(&mid_last.date, mid_last.low, None),
                None,
            ),
            line(
                "confirmation",
                if bullish { "Breakout" } else { "Breakdown" },
                conf_role,
                pt(&first.date, setup.breakout_level, None),
                pt(&latest_point.date, setup.breakout_level, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_continuation_geometry(
    setup: &ContinuationSetup<'_>,
    flag: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let pole_start = &setup.pole_bars[0];
    let pole_end = &setup.pole_bars[setup.pole_bars.len() - 1];
    let cons_start = &setup.consolidation_bars[0];
    let cons_end = &setup.consolidation_bars[setup.consolidation_bars.len() - 1];
    let zone_low = lowest_low(setup.consolidation_bars).unwrap_or(cons_start.low.min(cons_end.low));
    let zone_high =
        highest_high(setup.consolidation_bars).unwrap_or(cons_start.high.max(cons_end.high));
    ChartPatternGeometryV1 {
        family: if flag {
            ChartPatternGeometryFamilyV1::Flag
        } else {
            ChartPatternGeometryFamilyV1::Pennant
        },
        pivot_markers: None,
        zones: Some(vec![zone(
            "consolidation-zone",
            Some(if flag {
                "Flag consolidation"
            } else {
                "Pennant compression"
            }),
            ChartPatternZoneRoleV1::Base,
            &cons_start.date,
            &cons_end.date,
            zone_low,
            zone_high,
            None,
        )]),
        trend_lines: Some(vec![
            line(
                "pole",
                "Pole",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&pole_start.date, pole_start.open, None),
                pt(&pole_end.date, pole_end.close, None),
                None,
            ),
            line(
                "upper-boundary",
                if flag {
                    "Flag resistance"
                } else {
                    "Pennant upper boundary"
                },
                ChartPatternTrendLineRoleV1::Upper,
                pt(&cons_start.date, cons_start.high, None),
                pt(&cons_end.date, cons_end.high, None),
                Some(true),
            ),
            line(
                "lower-boundary",
                if flag {
                    "Flag support"
                } else {
                    "Pennant lower boundary"
                },
                ChartPatternTrendLineRoleV1::Lower,
                pt(&cons_start.date, cons_start.low, None),
                pt(&cons_end.date, cons_end.low, None),
                Some(true),
            ),
        ]),
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.breakout_level, None),
        )),
        target_projection: None,
    }
}

fn build_channel_geometry(setup: &ChannelSetup<'_>, rising: bool) -> ChartPatternGeometryV1 {
    let start_index = setup.support_pivots[0]
        .index
        .min(setup.resistance_pivots[0].index);
    let start_support = projected_pivot_line_price(
        &setup.support_pivots[0],
        &setup.support_pivots[1],
        start_index,
    );
    let start_resistance = projected_pivot_line_price(
        &setup.resistance_pivots[0],
        &setup.resistance_pivots[1],
        start_index,
    );
    let midline_start_date = setup
        .base_bars
        .get(start_index)
        .map(|b| b.date.as_str())
        .unwrap_or(&setup.support_pivots[0].date);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Channel,
        pivot_markers: None,
        trend_lines: Some(vec![
            line(
                "support",
                "Channel support",
                ChartPatternTrendLineRoleV1::Support,
                setup.support_pivots[0].to_point(),
                setup.support_pivots[1].to_point(),
                Some(true),
            ),
            line(
                "resistance",
                "Channel resistance",
                ChartPatternTrendLineRoleV1::Resistance,
                setup.resistance_pivots[0].to_point(),
                setup.resistance_pivots[1].to_point(),
                Some(true),
            ),
            line(
                "midline",
                "Channel midline",
                ChartPatternTrendLineRoleV1::Midline,
                pt(
                    midline_start_date,
                    round_js((start_support + start_resistance) / 2.0, 4),
                    None,
                ),
                pt(
                    &setup.latest.date,
                    round_js((setup.support + setup.resistance) / 2.0, 4),
                    None,
                ),
                Some(false),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            if rising {
                "Rising Channel"
            } else {
                "Falling Channel"
            },
            pt(
                &setup.latest.date,
                if rising {
                    setup.resistance
                } else {
                    setup.support
                },
                None,
            ),
        )),
        target_projection: None,
    }
}

fn build_high_tight_flag_geometry(
    setup: &HighTightFlagSetup<'_>,
    name: &str,
) -> ChartPatternGeometryV1 {
    let rally_start = &setup.rally_bars[0];
    let rally_end = &setup.rally_bars[setup.rally_bars.len() - 1];
    let pb_start = &setup.pullback_bars[0];
    let pb_end = &setup.pullback_bars[setup.pullback_bars.len() - 1];
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    let pb_low_idx = index_of_lowest_low(setup.pullback_bars);
    let pb_low_bar = &setup.pullback_bars[pb_low_idx];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::HighTightFlag,
        zones: Some(vec![zone(
            "flag-consolidation",
            Some("Flag consolidation"),
            ChartPatternZoneRoleV1::Base,
            &pb_start.date,
            &pb_end.date,
            setup.pullback_low,
            setup.breakout_level,
            None,
        )]),
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "pullback-low".to_string(),
            label: "Pullback Low".to_string(),
            kind: ChartPatternMarkerKindV1::Low,
            role: None,
            index: Some(pb_low_idx),
            date: pb_low_bar.date.clone(),
            price: normalize_zero(setup.pullback_low),
        }]),
        trend_lines: Some(vec![
            line(
                "rally",
                "High-tight rally",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&rally_start.date, rally_start.open, None),
                pt(&rally_end.date, rally_end.close, None),
                None,
            ),
            line(
                "pullback-upper",
                "Flag upper boundary",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&pb_start.date, pb_start.high, None),
                pt(&pb_end.date, pb_end.high, None),
                Some(true),
            ),
            line(
                "pullback-lower",
                "Flag lower boundary",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&pb_start.date, pb_start.low, None),
                pt(&pb_end.date, pb_end.low, None),
                Some(true),
            ),
            line(
                "breakout",
                "Breakout",
                ChartPatternTrendLineRoleV1::Resistance,
                pt(&pb_start.date, setup.breakout_level, None),
                pt(&latest_point.date, setup.breakout_level, None),
                Some(true),
            ),
        ]),
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_coil_geometry(setup: &CoilSetup<'_>, name: &str) -> ChartPatternGeometryV1 {
    let first = &setup.base_bars[0];
    let last = &setup.base_bars[setup.base_bars.len() - 1];
    let latest_point = pt(&setup.latest.date, setup.latest.close, None);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Coil,
        pivot_markers: None,
        trend_lines: Some(vec![
            line(
                "upper-boundary",
                "Coil upper boundary",
                ChartPatternTrendLineRoleV1::Upper,
                pt(&first.date, first.high, None),
                pt(&last.date, last.high, None),
                Some(true),
            ),
            line(
                "lower-boundary",
                "Coil lower boundary",
                ChartPatternTrendLineRoleV1::Lower,
                pt(&first.date, first.low, None),
                pt(&last.date, last.low, None),
                Some(true),
            ),
        ]),
        zones: Some(vec![zone(
            "coil-base",
            Some("Contracting range"),
            ChartPatternZoneRoleV1::Base,
            &first.date,
            &last.date,
            setup.support,
            setup.resistance,
            None,
        )]),
        labels: Some(pattern_label(name, latest_point)),
        target_projection: None,
    }
}

fn build_three_pivot_geometry(
    setup: &ThreePivotSetup<'_>,
    rising_valleys: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let first = &setup.pivots[0];
    let second = &setup.pivots[1];
    let third = &setup.pivots[2];
    let progression_role = if rising_valleys {
        ChartPatternTrendLineRoleV1::Lower
    } else {
        ChartPatternTrendLineRoleV1::Upper
    };
    let confirmation_role = if rising_valleys {
        ChartPatternTrendLineRoleV1::Resistance
    } else {
        ChartPatternTrendLineRoleV1::Support
    };
    let latest_idx = Some(setup.pattern_bars.len() - 1);
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::ThreePivot,
        pivot_markers: Some(
            setup
                .pivots
                .iter()
                .enumerate()
                .map(|(i, pivot)| ChartPatternGeometryPivotMarkerV1 {
                    id: format!("pivot-{}", i + 1),
                    label: format!(
                        "{} {}",
                        if rising_valleys { "Valley" } else { "Peak" },
                        i + 1
                    ),
                    kind: pivot.kind.into(),
                    role: None,
                    index: Some(pivot.index),
                    date: pivot.date.clone(),
                    price: normalize_zero(pivot.price),
                })
                .collect(),
        ),
        trend_lines: Some(vec![
            line(
                "progression-1",
                if rising_valleys {
                    "Rising valley support"
                } else {
                    "Falling peak resistance"
                },
                progression_role,
                first.to_point(),
                second.to_point(),
                None,
            ),
            line(
                "progression-2",
                if rising_valleys {
                    "Rising valley continuation"
                } else {
                    "Falling peak continuation"
                },
                progression_role,
                second.to_point(),
                third.to_point(),
                None,
            ),
            line(
                "confirmation",
                if rising_valleys {
                    "Breakout resistance"
                } else {
                    "Breakdown support"
                },
                confirmation_role,
                pt(&first.date, setup.level, Some(first.index)),
                pt(&setup.latest.date, setup.level, latest_idx),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&setup.latest.date, setup.level, latest_idx),
        )),
        target_projection: None,
    }
}

fn build_measured_move_geometry(
    setup: &MeasuredMoveSetup<'_>,
    up: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let first_leg = &setup.pattern_bars[0..5];
    let correction = &setup.pattern_bars[5..10];
    let second_leg = &setup.pattern_bars[10..];
    let first_start = &first_leg[0];
    let first_end = &first_leg[first_leg.len() - 1];
    let second_start = &second_leg[0];
    let latest = setup.latest;
    let corr_idx = if up {
        index_of_lowest_low(correction)
    } else {
        index_of_highest_high(correction)
    };
    let corr_bar = &correction[corr_idx];
    let corr_price = setup.correction_extreme;
    let first_move = (first_end.close - first_start.close).abs();
    let target = if up {
        corr_price + first_move
    } else {
        corr_price - first_move
    };
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::MeasuredMove,
        pivot_markers: Some(vec![
            ChartPatternGeometryPivotMarkerV1 {
                id: "leg-a".to_string(),
                label: "A".to_string(),
                kind: if up {
                    ChartPatternMarkerKindV1::Low
                } else {
                    ChartPatternMarkerKindV1::High
                },
                role: None,
                index: Some(0),
                date: first_start.date.clone(),
                price: normalize_zero(first_start.close),
            },
            ChartPatternGeometryPivotMarkerV1 {
                id: "leg-b".to_string(),
                label: "B".to_string(),
                kind: if up {
                    ChartPatternMarkerKindV1::High
                } else {
                    ChartPatternMarkerKindV1::Low
                },
                role: None,
                index: Some(4),
                date: first_end.date.clone(),
                price: normalize_zero(first_end.close),
            },
            ChartPatternGeometryPivotMarkerV1 {
                id: "correction".to_string(),
                label: "C".to_string(),
                kind: if up {
                    ChartPatternMarkerKindV1::Low
                } else {
                    ChartPatternMarkerKindV1::High
                },
                role: None,
                index: Some(corr_idx + 5),
                date: corr_bar.date.clone(),
                price: normalize_zero(corr_price),
            },
            ChartPatternGeometryPivotMarkerV1 {
                id: "leg-d".to_string(),
                label: "D".to_string(),
                kind: if up {
                    ChartPatternMarkerKindV1::High
                } else {
                    ChartPatternMarkerKindV1::Low
                },
                role: None,
                index: Some(setup.pattern_bars.len() - 1),
                date: latest.date.clone(),
                price: normalize_zero(latest.close),
            },
        ]),
        trend_lines: Some(vec![
            line(
                "first-leg",
                "First leg",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&first_start.date, first_start.close, None),
                pt(&first_end.date, first_end.close, None),
                None,
            ),
            line(
                "correction",
                "Correction",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&first_end.date, first_end.close, None),
                pt(&second_start.date, second_start.close, None),
                None,
            ),
            line(
                "second-leg",
                "Second leg",
                ChartPatternTrendLineRoleV1::Pole,
                pt(&second_start.date, second_start.close, None),
                pt(&latest.date, latest.close, None),
                None,
            ),
            line(
                "measured-target",
                "Measured target",
                if up {
                    ChartPatternTrendLineRoleV1::Resistance
                } else {
                    ChartPatternTrendLineRoleV1::Support
                },
                pt(&second_start.date, target, None),
                pt(&latest.date, target, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(name, pt(&latest.date, target, None))),
        target_projection: None,
    }
}

fn build_head_shoulders_geometry(
    setup: &HeadShouldersSetup,
    name: &str,
    latest_date: &str,
) -> ChartPatternGeometryV1 {
    let mut markers = Vec::new();
    let mut push_marker = |id: &str, label: &str, pivot: &Pivot| {
        markers.push(ChartPatternGeometryPivotMarkerV1 {
            id: id.to_string(),
            label: label.to_string(),
            kind: pivot.kind.into(),
            role: None,
            index: Some(pivot.index),
            date: pivot.date.clone(),
            price: normalize_zero(pivot.price),
        });
    };
    push_marker("left-shoulder", "LS", &setup.left_shoulder);
    if let Some(t1) = &setup.trough1 {
        push_marker("neckline-1", "N1", t1);
    }
    push_marker("head", "H", &setup.head);
    if let Some(t2) = &setup.trough2 {
        push_marker("neckline-2", "N2", t2);
    }
    push_marker("right-shoulder", "RS", &setup.right_shoulder);

    let trend_lines = match (&setup.trough1, &setup.trough2) {
        (Some(t1), Some(t2)) => vec![line(
            "neckline",
            "Neckline",
            ChartPatternTrendLineRoleV1::Neckline,
            t1.to_point(),
            t2.to_point(),
            Some(true),
        )],
        _ => Vec::new(),
    };
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::HeadAndShoulders,
        pivot_markers: Some(markers),
        trend_lines: Some(trend_lines),
        zones: None,
        labels: Some(pattern_label(name, pt(latest_date, setup.neckline, None))),
        target_projection: None,
    }
}

fn build_complex_head_shoulders_geometry(
    setup: &ComplexHeadShouldersSetup,
    name: &str,
    latest_date: &str,
) -> ChartPatternGeometryV1 {
    let first_pivot = &setup.pivots[0];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::ComplexHeadAndShoulders,
        pivot_markers: Some(
            setup
                .pivots
                .iter()
                .enumerate()
                .map(|(i, pivot)| ChartPatternGeometryPivotMarkerV1 {
                    id: format!("pivot-{}", i + 1),
                    label: if i == setup.head_idx {
                        "Head".to_string()
                    } else {
                        format!("P{}", i + 1)
                    },
                    kind: pivot.kind.into(),
                    role: None,
                    index: Some(pivot.index),
                    date: pivot.date.clone(),
                    price: normalize_zero(pivot.price),
                })
                .collect(),
        ),
        trend_lines: Some(vec![line(
            "neckline",
            "Neckline",
            ChartPatternTrendLineRoleV1::Neckline,
            pt(&first_pivot.date, setup.neckline, Some(first_pivot.index)),
            pt(latest_date, setup.neckline, None),
            Some(true),
        )]),
        zones: None,
        labels: Some(pattern_label(name, pt(latest_date, setup.neckline, None))),
        target_projection: None,
    }
}

fn build_cup_handle_geometry(
    setup: &CupHandleSetup<'_>,
    bullish: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let len = setup.pattern_bars.len();
    let cup_bars = &setup.pattern_bars[..len - 5];
    let handle_bars = &setup.pattern_bars[len - 5..len - 1];
    let extreme_idx = if bullish {
        index_of_lowest_low(cup_bars)
    } else {
        index_of_highest_high(cup_bars)
    };
    let extreme_bar = &cup_bars[extreme_idx];
    let extreme_point = pt(&extreme_bar.date, setup.cup_extreme, Some(extreme_idx));
    let left = &cup_bars[0];
    let right = &cup_bars[cup_bars.len() - 1];
    let handle_start = &handle_bars[0];
    let handle_last = &handle_bars[handle_bars.len() - 1];
    let latest = &setup.pattern_bars[len - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::CupHandle,
        zones: Some(vec![zone(
            "cup-base",
            Some("Handle consolidation"),
            ChartPatternZoneRoleV1::Base,
            &handle_start.date,
            &handle_last.date,
            lowest_low(handle_bars).unwrap_or(handle_start.low),
            highest_high(handle_bars).unwrap_or(handle_start.high),
            None,
        )]),
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "cup-extreme".to_string(),
            label: if bullish { "Cup Low" } else { "Cup High" }.to_string(),
            kind: if bullish {
                ChartPatternMarkerKindV1::Low
            } else {
                ChartPatternMarkerKindV1::High
            },
            role: None,
            index: Some(extreme_idx),
            date: extreme_bar.date.clone(),
            price: normalize_zero(setup.cup_extreme),
        }]),
        trend_lines: Some(vec![
            line(
                "cup-left",
                "Cup left rim",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&left.date, setup.rim_level, None),
                extreme_point.clone(),
                None,
            ),
            line(
                "cup-right",
                "Cup right rim",
                ChartPatternTrendLineRoleV1::Generic,
                extreme_point,
                pt(&right.date, setup.rim_level, None),
                None,
            ),
            line(
                "handle",
                "Handle",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&handle_start.date, handle_start.close, None),
                pt(&latest.date, latest.close, None),
                None,
            ),
        ]),
        labels: Some(pattern_label(name, pt(&latest.date, latest.close, None))),
        target_projection: None,
    }
}

fn build_rounding_geometry(
    setup: &RoundingSetup<'_>,
    bottom: bool,
    name: &str,
) -> ChartPatternGeometryV1 {
    let len = setup.pattern_bars.len();
    let left = &setup.pattern_bars[..6];
    let middle = &setup.pattern_bars[6..len - 6];
    let right = &setup.pattern_bars[len - 6..len - 1];
    let extreme_idx = if bottom {
        index_of_lowest_low(middle)
    } else {
        index_of_highest_high(middle)
    };
    let abs_extreme_idx = extreme_idx + 6;
    let extreme_bar = &setup.pattern_bars[abs_extreme_idx];
    let extreme_point = pt(&extreme_bar.date, setup.extreme, Some(abs_extreme_idx));
    let right_bar = &right[right.len() - 1];
    let latest_bar = &setup.pattern_bars[len - 1];
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::Rounding,
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "rounding-extreme".to_string(),
            label: if bottom { "Bowl Low" } else { "Arch High" }.to_string(),
            kind: if bottom {
                ChartPatternMarkerKindV1::Low
            } else {
                ChartPatternMarkerKindV1::High
            },
            role: None,
            index: Some(abs_extreme_idx),
            date: extreme_bar.date.clone(),
            price: normalize_zero(setup.extreme),
        }]),
        trend_lines: Some(vec![
            line(
                "left-curve",
                "Left curve",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&left[0].date, setup.rim_level, None),
                extreme_point.clone(),
                None,
            ),
            line(
                "right-curve",
                "Right curve",
                ChartPatternTrendLineRoleV1::Generic,
                extreme_point,
                pt(&right_bar.date, setup.rim_level, None),
                None,
            ),
            line(
                "rim-confirmation",
                "Rim confirmation",
                if bottom {
                    ChartPatternTrendLineRoleV1::Resistance
                } else {
                    ChartPatternTrendLineRoleV1::Support
                },
                pt(&right_bar.date, setup.rim_level, None),
                pt(&latest_bar.date, setup.rim_level, None),
                Some(true),
            ),
        ]),
        zones: None,
        labels: Some(pattern_label(
            name,
            pt(&latest_bar.date, setup.rim_level, None),
        )),
        target_projection: None,
    }
}

fn build_adam_eve_geometry(
    setup: &AdamEveSetup,
    bottom: bool,
    name: &str,
    latest_date: &str,
) -> ChartPatternGeometryV1 {
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::AdamEve,
        pivot_markers: Some(vec![
            ChartPatternGeometryPivotMarkerV1 {
                id: "adam".to_string(),
                label: "Adam".to_string(),
                kind: setup.adam.kind.into(),
                role: None,
                index: Some(setup.adam.index),
                date: setup.adam.date.clone(),
                price: normalize_zero(setup.adam.price),
            },
            ChartPatternGeometryPivotMarkerV1 {
                id: "eve".to_string(),
                label: "Eve".to_string(),
                kind: setup.eve.kind.into(),
                role: None,
                index: Some(setup.eve.index),
                date: setup.eve.date.clone(),
                price: normalize_zero(setup.eve.price),
            },
        ]),
        trend_lines: Some(vec![line(
            "confirmation-level",
            if bottom { "Neckline" } else { "Support" },
            if bottom {
                ChartPatternTrendLineRoleV1::Neckline
            } else {
                ChartPatternTrendLineRoleV1::Support
            },
            pt(&setup.adam.date, setup.neckline, Some(setup.adam.index)),
            pt(latest_date, setup.neckline, None),
            Some(true),
        )]),
        zones: None,
        labels: Some(pattern_label(name, pt(latest_date, setup.neckline, None))),
        target_projection: None,
    }
}

fn build_scallop_handle_geometry(
    setup: &ScallopHandleSetup<'_>,
    name: &str,
) -> ChartPatternGeometryV1 {
    let len = setup.pattern_bars.len();
    let base_bars = &setup.pattern_bars[..len - 5];
    let handle_bars = &setup.pattern_bars[len - 5..len - 1];
    let low_index = index_of_lowest_low(base_bars);
    let low_bar = &base_bars[low_index];
    let left = &base_bars[0];
    let right = &base_bars[base_bars.len() - 1];
    let handle_start = &handle_bars[0];
    let handle_last = &handle_bars[handle_bars.len() - 1];
    let latest = &setup.pattern_bars[len - 1];
    let scallop_low_point = pt(&low_bar.date, setup.scallop_low, Some(low_index));
    ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::ScallopHandle,
        zones: Some(vec![zone(
            "scallop-base",
            Some("Handle consolidation"),
            ChartPatternZoneRoleV1::Base,
            &handle_start.date,
            &handle_last.date,
            lowest_low(handle_bars).unwrap_or(handle_start.low),
            highest_high(handle_bars).unwrap_or(handle_start.high),
            None,
        )]),
        pivot_markers: Some(vec![ChartPatternGeometryPivotMarkerV1 {
            id: "scallop-low".to_string(),
            label: "Scallop Low".to_string(),
            kind: ChartPatternMarkerKindV1::Low,
            role: None,
            index: Some(low_index),
            date: low_bar.date.clone(),
            price: normalize_zero(setup.scallop_low),
        }]),
        trend_lines: Some(vec![
            line(
                "scallop-left",
                "Scallop left rim",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&left.date, setup.right_rim, None),
                scallop_low_point.clone(),
                None,
            ),
            line(
                "scallop-right",
                "Scallop right rim",
                ChartPatternTrendLineRoleV1::Generic,
                scallop_low_point,
                pt(&right.date, setup.right_rim, None),
                None,
            ),
            line(
                "handle",
                "Handle",
                ChartPatternTrendLineRoleV1::Generic,
                pt(&handle_start.date, handle_start.close, None),
                pt(&latest.date, latest.close, None),
                None,
            ),
            line(
                "breakout",
                "Handle breakout",
                ChartPatternTrendLineRoleV1::Resistance,
                pt(&handle_start.date, setup.breakout_level, None),
                pt(&latest.date, setup.breakout_level, None),
                Some(true),
            ),
        ]),
        labels: Some(pattern_label(
            name,
            pt(&latest.date, setup.breakout_level, None),
        )),
        target_projection: None,
    }
}

// ---------------------------------------------------------------------------
// Result builder (`createChartPatternResult`) & metadata table
// ---------------------------------------------------------------------------

struct PatternSpec {
    id: &'static str,
    name: &'static str,
    category_id: &'static str,
    category_name: &'static str,
    family: ChartPatternFamilyV1,
    min_bars: usize,
}

const fn spec(
    id: &'static str,
    name: &'static str,
    category_id: &'static str,
    category_name: &'static str,
    family: ChartPatternFamilyV1,
    min_bars: usize,
) -> PatternSpec {
    PatternSpec {
        id,
        name,
        category_id,
        category_name,
        family,
        min_bars,
    }
}

const PATTERN_SPECS: &[PatternSpec] = &[
    spec(
        "chart_island_reversal_top",
        "Island Reversal (Top)",
        CHART_GAP_CATEGORY_ID,
        CHART_GAP_CATEGORY_NAME,
        ChartPatternFamilyV1::Gap,
        5,
    ),
    spec(
        "chart_island_reversal_bottom",
        "Island Reversal (Bottom)",
        CHART_GAP_CATEGORY_ID,
        CHART_GAP_CATEGORY_NAME,
        ChartPatternFamilyV1::Gap,
        5,
    ),
    spec(
        "chart_double_bottom",
        "Double Bottom (W)",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_double_top",
        "Double Top (M)",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_triple_bottom",
        "Triple Bottom",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_triple_top",
        "Triple Top",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_v_bottom",
        "V-Bottom",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        15,
    ),
    spec(
        "chart_spike_top",
        "Spike Top (V-Top)",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        15,
    ),
    spec(
        "chart_horn_bottom",
        "Horn Bottom",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_horn_top",
        "Horn Top",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        12,
    ),
    spec(
        "chart_bump_run_bottom",
        "Bump-and-Run Bottom",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        20,
    ),
    spec(
        "chart_bump_run_top",
        "Bump-and-Run Top",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        20,
    ),
    spec(
        "chart_blow_off_top",
        "Blow-off Top",
        CHART_REVERSAL_CATEGORY_ID,
        CHART_REVERSAL_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        16,
    ),
    spec(
        "chart_rectangle_range",
        "Rectangle / Range",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        21,
    ),
    spec(
        "chart_ascending_triangle",
        "Ascending Triangle",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_descending_triangle",
        "Descending Triangle",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_symmetrical_triangle",
        "Symmetrical Triangle",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        12,
    ),
    spec(
        "chart_falling_wedge_bottom",
        "Falling Wedge (Bottom)",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        14,
    ),
    spec(
        "chart_rising_wedge_top",
        "Rising Wedge (Top)",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        14,
    ),
    spec(
        "chart_diamond_bottom",
        "Diamond Bottom",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        19,
    ),
    spec(
        "chart_diamond_top",
        "Diamond Top",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        19,
    ),
    spec(
        "chart_diamond_pattern",
        "Diamond Pattern",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        19,
    ),
    spec(
        "chart_broadening_bottom",
        "Broadening Bottom",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        14,
    ),
    spec(
        "chart_broadening_formation",
        "Broadening Formation",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        14,
    ),
    spec(
        "chart_rising_three_methods",
        "Rising Three Methods",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        5,
    ),
    spec(
        "chart_falling_three_methods",
        "Falling Three Methods",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        5,
    ),
    spec(
        "chart_mat_hold_bullish",
        "Mat Hold (Bullish)",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        5,
    ),
    spec(
        "chart_mat_hold_bearish",
        "Mat Hold (Bearish)",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        5,
    ),
    spec(
        "chart_bull_flag",
        "Bull Flag",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_bear_flag",
        "Bear Flag",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_bull_pennant",
        "Bull Pennant",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_bear_pennant",
        "Bear Pennant",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        13,
    ),
    spec(
        "chart_rising_channel",
        "Rising Channel",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        20,
    ),
    spec(
        "chart_falling_channel",
        "Falling Channel",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        20,
    ),
    spec(
        "chart_high_tight_flag",
        "High Tight Flag",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        15,
    ),
    spec(
        "chart_coil_volatility_squeeze",
        "Coil / Volatility Squeeze",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        8,
    ),
    spec(
        "chart_three_rising_valleys",
        "Three Rising Valleys",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        14,
    ),
    spec(
        "chart_three_falling_peaks",
        "Three Falling Peaks",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        14,
    ),
    spec(
        "chart_measured_move_up",
        "Measured Move Up",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        15,
    ),
    spec(
        "chart_measured_move_down",
        "Measured Move Down",
        CHART_STRUCTURE_CATEGORY_ID,
        CHART_STRUCTURE_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        15,
    ),
    spec(
        "chart_head_shoulders",
        "Head & Shoulders",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        16,
    ),
    spec(
        "chart_inverse_head_shoulders",
        "Inv. Head & Shoulders",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        16,
    ),
    spec(
        "chart_complex_head_shoulders",
        "Complex H&S",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::NeutralBilateral,
        22,
    ),
    spec(
        "chart_cup_handle",
        "Cup and Handle",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        18,
    ),
    spec(
        "chart_inverted_cup_handle",
        "Inverted Cup & Handle",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        18,
    ),
    spec(
        "chart_rounding_bottom",
        "Rounding Bottom",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        18,
    ),
    spec(
        "chart_adam_eve_bottom",
        "Adam & Eve Bottom",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        16,
    ),
    spec(
        "chart_adam_eve_top",
        "Adam & Eve Top",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        16,
    ),
    spec(
        "chart_scallop_handle",
        "Scallop & Handle",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Continuation,
        18,
    ),
    spec(
        "chart_rounding_top",
        "Rounding Top (Arch)",
        CHART_COMPLEX_CATEGORY_ID,
        CHART_COMPLEX_CATEGORY_NAME,
        ChartPatternFamilyV1::Reversal,
        18,
    ),
];

pub fn minimum_bars_for_migrated_pattern(pattern_id: &str) -> Option<usize> {
    PATTERN_SPECS
        .iter()
        .find(|s| s.id == pattern_id)
        .map(|s| s.min_bars)
}

#[derive(Default)]
struct PatternExtras {
    pattern_start_date: Option<String>,
    breakout_level: Option<f64>,
    support_level: Option<f64>,
    resistance_level: Option<f64>,
    neckline_level: Option<f64>,
    pivots: Option<Vec<ChartPatternPivotV1>>,
    geometry: Option<ChartPatternGeometryV1>,
}

fn create_result(
    target: &ScannerRunTargetV1,
    latest_date: &str,
    spec: &PatternSpec,
    direction: ScannerDirectionV1,
    confidence: f64,
    reasons: Vec<String>,
    values: BTreeMap<String, Option<ScannerScalarValueV1>>,
    extras: PatternExtras,
    generated_at: &str,
) -> ScannerResultV1 {
    ScannerResultV1 {
        symbol: target.symbol.clone(),
        exchange: target.exchange.clone(),
        scanner_id: spec.id.to_string(),
        scanner_name: spec.name.to_string(),
        category_id: spec.category_id.to_string(),
        category_name: spec.category_name.to_string(),
        date: latest_date.to_string(),
        matched: true,
        direction: Some(direction),
        score: Some(confidence),
        reasons: Some(reasons),
        values: Some(values),
        chart_pattern: Some(ChartPatternResultDetailsV1 {
            family: spec.family,
            confidence,
            pattern_start_date: extras.pattern_start_date,
            pattern_end_date: latest_date.to_string(),
            breakout_level: extras.breakout_level.map(normalize_zero),
            support_level: extras.support_level.map(normalize_zero),
            resistance_level: extras.resistance_level.map(normalize_zero),
            neckline_level: extras.neckline_level.map(normalize_zero),
            target_price: None,
            stop_loss_price: None,
            potential_gain_pct: None,
            risk_reward_ratio: None,
            pivots: extras.pivots,
            geometry: extras.geometry,
        }),
        warnings: Some(Vec::new()),
        source: Some(CHART_PATTERN_SCANNER_SOURCE.to_string()),
        history: None,
        generated_at: generated_at.to_string(),
    }
}

fn num_val(v: f64) -> Option<ScannerScalarValueV1> {
    Some(scalar_number_v1(v))
}

fn num_opt(v: Option<f64>) -> Option<ScannerScalarValueV1> {
    v.map(scalar_number_v1)
}

fn usize_val(v: usize) -> Option<ScannerScalarValueV1> {
    Some(ScannerScalarValueV1::Integer(v as i64))
}

pub fn detect_chart_pattern(
    pattern_id: &str,
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<ScannerResultV1> {
    let spec = PATTERN_SPECS.iter().find(|s| s.id == pattern_id)?;
    if bars.len() < spec.min_bars || bars.is_empty() || bars.iter().any(|b| !bar_is_finite(b)) {
        return None;
    }
    let latest_date = &bars[bars.len() - 1].date;
    let mut vals: BTreeMap<String, Option<ScannerScalarValueV1>> = BTreeMap::new();

    match pattern_id {
        "chart_island_reversal_top" => {
            let n = bars.len();
            let pre_gap = &bars[n - 5];
            let first_island = &bars[n - 4];
            let middle_island = &bars[n - 3..n - 1];
            let latest = &bars[n - 1];
            let first_gap_pct = gap_up_pct(first_island, pre_gap)?;
            if first_gap_pct < MIN_GAP_PCT || !middle_island.iter().all(|b| b.low > pre_gap.high) {
                return None;
            }
            let island_bars = [
                first_island.clone(),
                middle_island[0].clone(),
                middle_island[1].clone(),
            ];
            let island_low = lowest_low(&island_bars)?;
            if island_low <= 0.0 || latest.open >= island_low || latest.close >= island_low {
                return None;
            }
            vals.insert("gap_up_pct".into(), num_val(first_gap_pct));
            vals.insert(
                "gap_down_pct".into(),
                num_val(round_js((1.0 - latest.open / island_low) * 100.0, 2)),
            );
            vals.insert("island_low".into(), num_val(island_low));
            vals.insert("pre_gap_high".into(), num_val(pre_gap.high));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                82.0,
                vec![format!(
                    "Gap-down escape below island low ({}) after prior gap-up island",
                    format_js_number(island_low)
                )],
                vals,
                PatternExtras {
                    support_level: Some(island_low),
                    pattern_start_date: Some(first_island.date.clone()),
                    pivots: Some(vec![
                        ChartPatternPivotV1 {
                            index: n - 5,
                            date: pre_gap.date.clone(),
                            price: normalize_zero(pre_gap.high),
                            kind: ChartPatternPivotKindV1::High,
                        },
                        ChartPatternPivotV1 {
                            index: n - 1,
                            date: latest.date.clone(),
                            price: normalize_zero(latest.open),
                            kind: ChartPatternPivotKindV1::Low,
                        },
                    ]),
                    geometry: Some(build_island_geometry(
                        spec.name,
                        pre_gap,
                        first_island,
                        middle_island,
                        latest,
                        true,
                        island_low,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_island_reversal_bottom" => {
            let n = bars.len();
            let pre_gap = &bars[n - 5];
            let first_island = &bars[n - 4];
            let middle_island = &bars[n - 3..n - 1];
            let latest = &bars[n - 1];
            let first_gap_pct = gap_down_pct(first_island, pre_gap)?;
            if first_gap_pct < MIN_GAP_PCT || !middle_island.iter().all(|b| b.high < pre_gap.low) {
                return None;
            }
            let island_bars = [
                first_island.clone(),
                middle_island[0].clone(),
                middle_island[1].clone(),
            ];
            let island_high = highest_high(&island_bars)?;
            if island_high <= 0.0 || latest.open <= island_high || latest.close <= island_high {
                return None;
            }
            vals.insert("gap_down_pct".into(), num_val(first_gap_pct));
            vals.insert(
                "gap_up_pct".into(),
                num_val(round_js((latest.open / island_high - 1.0) * 100.0, 2)),
            );
            vals.insert("island_high".into(), num_val(island_high));
            vals.insert("pre_gap_low".into(), num_val(pre_gap.low));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                82.0,
                vec![format!(
                    "Gap-up escape above island high ({}) after prior gap-down island",
                    format_js_number(island_high)
                )],
                vals,
                PatternExtras {
                    resistance_level: Some(island_high),
                    pattern_start_date: Some(first_island.date.clone()),
                    pivots: Some(vec![
                        ChartPatternPivotV1 {
                            index: n - 5,
                            date: pre_gap.date.clone(),
                            price: normalize_zero(pre_gap.low),
                            kind: ChartPatternPivotKindV1::Low,
                        },
                        ChartPatternPivotV1 {
                            index: n - 1,
                            date: latest.date.clone(),
                            price: normalize_zero(latest.open),
                            kind: ChartPatternPivotKindV1::High,
                        },
                    ]),
                    geometry: Some(build_island_geometry(
                        spec.name,
                        pre_gap,
                        first_island,
                        middle_island,
                        latest,
                        false,
                        island_high,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_double_bottom" => {
            let setup = latest_comparable_pivot_setup(bars, PivotKind::Low, 2)?;
            let l1 = &setup.pivots[0];
            let l2 = &setup.pivots[1];
            let between = &setup.pattern_bars[l1.index + 1..l2.index];
            let neckline = highest_high(between)?;
            if setup.latest.close <= neckline {
                return None;
            }
            if !has_down_trend(&setup.pattern_bars[..=l1.index], 5.0) {
                return None;
            }
            vals.insert("first_low".into(), num_val(l1.price));
            vals.insert("second_low".into(), num_val(l2.price));
            vals.insert("neckline".into(), num_val(neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                76.0,
                vec![format!(
                    "Two comparable lows broke above neckline resistance ({})",
                    format_js_number(neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(neckline),
                    neckline_level: Some(neckline),
                    support_level: Some(round_js((l1.price + l2.price) / 2.0, 4)),
                    pattern_start_date: Some(l1.date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_double_or_triple_geometry(
                        &setup, neckline, false, spec.name, false,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_double_top" => {
            let setup = latest_comparable_pivot_setup(bars, PivotKind::High, 2)?;
            let h1 = &setup.pivots[0];
            let h2 = &setup.pivots[1];
            let between = &setup.pattern_bars[h1.index + 1..h2.index];
            let support = lowest_low(between)?;
            if setup.latest.close >= support {
                return None;
            }
            if !has_up_trend(&setup.pattern_bars[..=h1.index], 5.0) {
                return None;
            }
            vals.insert("first_high".into(), num_val(h1.price));
            vals.insert("second_high".into(), num_val(h2.price));
            vals.insert("support".into(), num_val(support));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                76.0,
                vec![format!(
                    "Two comparable highs broke below support ({})",
                    format_js_number(support)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(support),
                    support_level: Some(support),
                    resistance_level: Some(round_js((h1.price + h2.price) / 2.0, 4)),
                    pattern_start_date: Some(h1.date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_double_or_triple_geometry(
                        &setup, support, true, spec.name, false,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_triple_bottom" => {
            let setup = latest_comparable_pivot_setup(bars, PivotKind::Low, 3)?;
            let l1 = &setup.pivots[0];
            let l3 = &setup.pivots[2];
            let between = &setup.pattern_bars[l1.index + 1..l3.index];
            let neckline = highest_high(between)?;
            if setup.latest.close <= neckline {
                return None;
            }
            if !has_down_trend(&setup.pattern_bars[..=l1.index], 5.0) {
                return None;
            }
            let support_avg = round_js(average_pivot_price(&setup.pivots), 4);
            vals.insert("support".into(), num_val(support_avg));
            vals.insert("neckline".into(), num_val(neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                82.0,
                vec![format!(
                    "Three comparable lows confirmed support and broke above neckline ({})",
                    format_js_number(neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(neckline),
                    neckline_level: Some(neckline),
                    support_level: Some(support_avg),
                    pattern_start_date: Some(l1.date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_double_or_triple_geometry(
                        &setup, neckline, false, spec.name, true,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_triple_top" => {
            let setup = latest_comparable_pivot_setup(bars, PivotKind::High, 3)?;
            let h1 = &setup.pivots[0];
            let h3 = &setup.pivots[2];
            let between = &setup.pattern_bars[h1.index + 1..h3.index];
            let support = lowest_low(between)?;
            if setup.latest.close >= support {
                return None;
            }
            if !has_up_trend(&setup.pattern_bars[..=h1.index], 5.0) {
                return None;
            }
            let resistance_avg = round_js(average_pivot_price(&setup.pivots), 4);
            vals.insert("resistance".into(), num_val(resistance_avg));
            vals.insert("support".into(), num_val(support));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                82.0,
                vec![format!(
                    "Three comparable highs confirmed resistance and broke below support ({})",
                    format_js_number(support)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(support),
                    support_level: Some(support),
                    resistance_level: Some(resistance_avg),
                    pattern_start_date: Some(h1.date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_double_or_triple_geometry(
                        &setup, support, true, spec.name, true,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_v_bottom" => {
            let setup = latest_v_reversal_setup(bars, true)?;
            vals.insert("decline_pct".into(), num_val(setup.move_pct));
            vals.insert("extreme_low".into(), num_val(setup.extreme.low));
            vals.insert("confirmation_close".into(), num_val(setup.latest.close));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                68.0,
                vec![format!(
                    "Sharp decline into {} reversed with a close above the prior bar high ({})",
                    setup.extreme.date,
                    format_js_number(setup.previous.high)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.previous.high),
                    support_level: Some(setup.extreme.low),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    pivots: Some(vec![ChartPatternPivotV1 {
                        index: setup.extreme_index,
                        date: setup.extreme.date.clone(),
                        price: normalize_zero(setup.extreme.low),
                        kind: ChartPatternPivotKindV1::Low,
                    }]),
                    geometry: Some(build_v_reversal_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_spike_top" => {
            let setup = latest_v_reversal_setup(bars, false)?;
            vals.insert("advance_pct".into(), num_val(setup.move_pct));
            vals.insert("extreme_high".into(), num_val(setup.extreme.high));
            vals.insert("confirmation_close".into(), num_val(setup.latest.close));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                68.0,
                vec![format!(
                    "Sharp advance into {} reversed with a close below the prior bar low ({})",
                    setup.extreme.date,
                    format_js_number(setup.previous.low)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.previous.low),
                    resistance_level: Some(setup.extreme.high),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    pivots: Some(vec![ChartPatternPivotV1 {
                        index: setup.extreme_index,
                        date: setup.extreme.date.clone(),
                        price: normalize_zero(setup.extreme.high),
                        kind: ChartPatternPivotKindV1::High,
                    }]),
                    geometry: Some(build_v_reversal_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_horn_bottom" => {
            let setup = latest_horn_setup(bars, true)?;
            vals.insert("first_low".into(), num_val(setup.pivots[0].price));
            vals.insert("second_low".into(), num_val(setup.pivots[1].price));
            vals.insert("neckline".into(), num_val(setup.level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                72.0,
                vec![format!(
                    "Two sharp lows held support and broke above intervening high ({})",
                    format_js_number(setup.level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.level),
                    neckline_level: Some(setup.level),
                    support_level: Some(round_js(average_pivot_price(&setup.pivots), 4)),
                    pattern_start_date: Some(setup.pivots[0].date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_horn_geometry(&setup, false, spec.name, latest_date)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_horn_top" => {
            let setup = latest_horn_setup(bars, false)?;
            vals.insert("first_high".into(), num_val(setup.pivots[0].price));
            vals.insert("second_high".into(), num_val(setup.pivots[1].price));
            vals.insert("support".into(), num_val(setup.level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                72.0,
                vec![format!(
                    "Two sharp highs held resistance and broke below intervening low ({})",
                    format_js_number(setup.level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.level),
                    support_level: Some(setup.level),
                    resistance_level: Some(round_js(average_pivot_price(&setup.pivots), 4)),
                    pattern_start_date: Some(setup.pivots[0].date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_horn_geometry(&setup, true, spec.name, latest_date)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bump_run_bottom" => {
            let setup = latest_bump_run_setup(bars, true)?;
            vals.insert("lead_slope".into(), num_val(round_js(setup.lead_slope, 4)));
            vals.insert("bump_slope".into(), num_val(round_js(setup.bump_slope, 4)));
            vals.insert("breakout_level".into(), num_val(setup.breakout_level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                72.0,
                vec![format!(
                    "Downtrend accelerated into a bump then reversed above run level ({})",
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    support_level: Some(setup.extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_bump_run_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bump_run_top" => {
            let setup = latest_bump_run_setup(bars, false)?;
            vals.insert("lead_slope".into(), num_val(round_js(setup.lead_slope, 4)));
            vals.insert("bump_slope".into(), num_val(round_js(setup.bump_slope, 4)));
            vals.insert("breakdown_level".into(), num_val(setup.breakout_level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                72.0,
                vec![format!(
                    "Uptrend accelerated into a bump then reversed below run level ({})",
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_bump_run_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_blow_off_top" => {
            let setup = latest_blow_off_top_setup(bars)?;
            vals.insert("advance_pct".into(), num_val(setup.advance_pct));
            vals.insert("volume_ratio".into(), num_opt(setup.volume_ratio));
            vals.insert("spike_high".into(), num_val(setup.spike_high));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                78.0,
                vec![format!(
                    "Late advance of {}% ended with high-volume reversal below prior low",
                    format_js_number(setup.advance_pct)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.previous_low),
                    resistance_level: Some(setup.spike_high),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_blow_off_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rectangle_range" => {
            let setup = latest_range_setup(bars, 20)?;
            let resistance_touches = count_touches(setup.base_bars, true, setup.resistance, 2.0);
            let support_touches = count_touches(setup.base_bars, false, setup.support, 2.0);
            if resistance_touches < 2
                || support_touches < 2
                || setup.latest.close > setup.resistance
                || setup.latest.close < setup.support
            {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("range_width_pct".into(), num_val(setup.width_pct));
            vals.insert("support_touches".into(), usize_val(support_touches));
            vals.insert("resistance_touches".into(), usize_val(resistance_touches));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Neutral,
                62.0,
                vec![format!(
                    "Price is range-bound between support ({}) and resistance ({})",
                    format_js_number(setup.support),
                    format_js_number(setup.resistance)
                )],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_range_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_ascending_triangle" => {
            let setup = latest_triangle_setup(bars, true)?;
            if setup.latest.close <= setup.resistance {
                return None;
            }
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert(
                "support_slope".into(),
                num_val(round_js(setup.low_slope, 4)),
            );
            vals.insert(
                "resistance_touches".into(),
                usize_val(setup.resistance_touches),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                76.0,
                vec![format!(
                    "Flat resistance ({}) broke after rising lows compressed the range",
                    format_js_number(setup.resistance)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.resistance),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    pivots: Some(setup.low_pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_ascending_triangle_geometry(&setup)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_descending_triangle" => {
            let setup = latest_triangle_setup(bars, false)?;
            if setup.latest.close >= setup.support {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert(
                "resistance_slope".into(),
                num_val(round_js(setup.high_slope, 4)),
            );
            vals.insert("support_touches".into(), usize_val(setup.support_touches));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                76.0,
                vec![format!(
                    "Flat support ({}) broke after falling highs compressed the range",
                    format_js_number(setup.support)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.support),
                    support_level: Some(setup.support),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    pivots: Some(setup.high_pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_descending_triangle_geometry(&setup)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_symmetrical_triangle" => {
            let setup = latest_symmetrical_triangle_setup(bars)?;
            let bullish_break = setup.latest.close > setup.upper_level;
            let bearish_break = setup.latest.close < setup.lower_level;
            if !bullish_break && !bearish_break {
                return None;
            }
            let mut combined = Vec::with_capacity(setup.high_pivots.len() + setup.low_pivots.len());
            combined.extend(setup.high_pivots.iter().cloned());
            combined.extend(setup.low_pivots.iter().cloned());
            combined.sort_by_key(|p| p.index);
            vals.insert("upper_level".into(), num_val(setup.upper_level));
            vals.insert("lower_level".into(), num_val(setup.lower_level));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            let reason = if bullish_break {
                format!(
                    "Close broke above converging upper pivot level ({})",
                    format_js_number(setup.upper_level)
                )
            } else {
                format!(
                    "Close broke below converging lower pivot level ({})",
                    format_js_number(setup.lower_level)
                )
            };
            Some(create_result(
                target,
                latest_date,
                spec,
                if bullish_break {
                    ScannerDirectionV1::Bullish
                } else {
                    ScannerDirectionV1::Bearish
                },
                72.0,
                vec![reason],
                vals,
                PatternExtras {
                    breakout_level: Some(if bullish_break {
                        setup.upper_level
                    } else {
                        setup.lower_level
                    }),
                    support_level: Some(setup.lower_level),
                    resistance_level: Some(setup.upper_level),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    pivots: Some(combined.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_symmetrical_triangle_geometry(&setup)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_falling_wedge_bottom" => {
            let setup = latest_wedge_setup(bars, true)?;
            if setup.latest.close <= setup.upper_level {
                return None;
            }
            vals.insert("upper_level".into(), num_val(setup.upper_level));
            vals.insert("lower_level".into(), num_val(setup.lower_level));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("range_ratio".into(), num_val(setup.range_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                74.0,
                vec![format!(
                    "Falling wedge converged downward and closed above upper level ({})",
                    format_js_number(setup.upper_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.upper_level),
                    support_level: Some(setup.lower_level),
                    resistance_level: Some(setup.upper_level),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_wedge_geometry(&setup, spec.name, setup.upper_level)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rising_wedge_top" => {
            let setup = latest_wedge_setup(bars, false)?;
            if setup.latest.close >= setup.lower_level {
                return None;
            }
            vals.insert("upper_level".into(), num_val(setup.upper_level));
            vals.insert("lower_level".into(), num_val(setup.lower_level));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("range_ratio".into(), num_val(setup.range_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                74.0,
                vec![format!(
                    "Rising wedge converged upward and closed below lower level ({})",
                    format_js_number(setup.lower_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.lower_level),
                    support_level: Some(setup.lower_level),
                    resistance_level: Some(setup.upper_level),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_wedge_geometry(&setup, spec.name, setup.lower_level)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_diamond_bottom" => {
            let setup = latest_diamond_setup(bars)?;
            if setup.latest.close <= setup.resistance {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("middle_width".into(), num_val(setup.middle_width));
            vals.insert("final_width".into(), num_val(setup.final_width));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                72.0,
                vec![format!(
                    "Diamond base expanded then contracted before breaking above {}",
                    format_js_number(setup.resistance)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.resistance),
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_diamond_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_diamond_top" => {
            let setup = latest_diamond_setup(bars)?;
            if setup.latest.close >= setup.support {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("middle_width".into(), num_val(setup.middle_width));
            vals.insert("final_width".into(), num_val(setup.final_width));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                72.0,
                vec![format!(
                    "Diamond top expanded then contracted before breaking below {}",
                    format_js_number(setup.support)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.support),
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_diamond_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_diamond_pattern" => {
            let setup = latest_diamond_setup(bars)?;
            if setup.latest.close > setup.resistance || setup.latest.close < setup.support {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("middle_width".into(), num_val(setup.middle_width));
            vals.insert("final_width".into(), num_val(setup.final_width));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Neutral,
                64.0,
                vec![format!(
                    "Diamond pattern expanded then contracted between {} and {}",
                    format_js_number(setup.support),
                    format_js_number(setup.resistance)
                )],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_diamond_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_broadening_bottom" => {
            let setup = latest_broadening_setup(bars)?;
            if setup.latest.close <= setup.resistance {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("range_ratio".into(), num_val(setup.range_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                70.0,
                vec![format!(
                    "Broadening base made expanding swings and broke above {}",
                    format_js_number(setup.resistance)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.resistance),
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_broadening_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_broadening_formation" => {
            let setup = latest_broadening_setup(bars)?;
            if setup.latest.close > setup.resistance || setup.latest.close < setup.support {
                return None;
            }
            vals.insert("support".into(), num_val(setup.support));
            vals.insert("resistance".into(), num_val(setup.resistance));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("range_ratio".into(), num_val(setup.range_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Neutral,
                62.0,
                vec![
                    "Broadening formation has rising highs and falling lows without confirmed breakout"
                        .to_string(),
                ],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_broadening_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rising_three_methods" => {
            let setup = latest_three_methods_setup(bars, true)?;
            vals.insert("first_high".into(), num_val(setup.first.high));
            vals.insert("first_low".into(), num_val(setup.first.low));
            vals.insert("breakout_close".into(), num_val(setup.latest.close));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                70.0,
                vec![
                    "Bullish long candle held three small pullback bars before continuation breakout"
                        .to_string(),
                ],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.first.high),
                    support_level: Some(setup.first.low),
                    pattern_start_date: Some(setup.first.date.clone()),
                    geometry: Some(build_three_methods_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_falling_three_methods" => {
            let setup = latest_three_methods_setup(bars, false)?;
            vals.insert("first_high".into(), num_val(setup.first.high));
            vals.insert("first_low".into(), num_val(setup.first.low));
            vals.insert("breakdown_close".into(), num_val(setup.latest.close));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                70.0,
                vec![
                    "Bearish long candle held three small recovery bars before continuation breakdown"
                        .to_string(),
                ],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.first.low),
                    resistance_level: Some(setup.first.high),
                    pattern_start_date: Some(setup.first.date.clone()),
                    geometry: Some(build_three_methods_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_mat_hold_bullish" => {
            let setup = latest_mat_hold_setup(bars, true)?;
            vals.insert("breakout_level".into(), num_val(setup.breakout_level));
            vals.insert("hold_level".into(), num_val(setup.hold_level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                72.0,
                vec![format!(
                    "Bullish mat hold kept consolidation above support and broke above {}",
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    support_level: Some(setup.hold_level),
                    pattern_start_date: Some(setup.first.date.clone()),
                    geometry: Some(build_mat_hold_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_mat_hold_bearish" => {
            let setup = latest_mat_hold_setup(bars, false)?;
            vals.insert("breakdown_level".into(), num_val(setup.breakout_level));
            vals.insert("hold_level".into(), num_val(setup.hold_level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                72.0,
                vec![format!(
                    "Bearish mat hold kept consolidation below resistance and broke below {}",
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.hold_level),
                    pattern_start_date: Some(setup.first.date.clone()),
                    geometry: Some(build_mat_hold_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bull_flag" => {
            let setup = latest_continuation_setup(bars, true, true)?;
            vals.insert("pole_move_pct".into(), num_val(setup.pole_move_pct));
            vals.insert("breakout_level".into(), num_val(setup.breakout_level));
            vals.insert(
                "consolidation_slope".into(),
                num_val(round_js(setup.close_slope, 4)),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                74.0,
                vec![format!(
                    "Bullish pole advanced {}% before a shallow flag breakout above {}",
                    format_js_number(setup.pole_move_pct),
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.breakout_level),
                    pattern_start_date: Some(setup.pole_bars[0].date.clone()),
                    geometry: Some(build_continuation_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bear_flag" => {
            let setup = latest_continuation_setup(bars, false, true)?;
            vals.insert("pole_move_pct".into(), num_val(setup.pole_move_pct));
            vals.insert("breakout_level".into(), num_val(setup.breakout_level));
            vals.insert(
                "consolidation_slope".into(),
                num_val(round_js(setup.close_slope, 4)),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                74.0,
                vec![format!(
                    "Bearish pole declined {}% before a flag breakdown below {}",
                    format_js_number(setup.pole_move_pct.abs()),
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    support_level: Some(setup.breakout_level),
                    pattern_start_date: Some(setup.pole_bars[0].date.clone()),
                    geometry: Some(build_continuation_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bull_pennant" => {
            let setup = latest_continuation_setup(bars, true, false)?;
            vals.insert("pole_move_pct".into(), num_val(setup.pole_move_pct));
            vals.insert("upper_level".into(), num_val(setup.breakout_level));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                76.0,
                vec![format!(
                    "Bullish pole advanced {}% before a converging pennant breakout",
                    format_js_number(setup.pole_move_pct)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.breakout_level),
                    pattern_start_date: Some(setup.pole_bars[0].date.clone()),
                    geometry: Some(build_continuation_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_bear_pennant" => {
            let setup = latest_continuation_setup(bars, false, false)?;
            vals.insert("pole_move_pct".into(), num_val(setup.pole_move_pct));
            vals.insert("lower_level".into(), num_val(setup.breakout_level));
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                76.0,
                vec![format!(
                    "Bearish pole declined {}% before a converging pennant breakdown",
                    format_js_number(setup.pole_move_pct.abs())
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    support_level: Some(setup.breakout_level),
                    pattern_start_date: Some(setup.pole_bars[0].date.clone()),
                    geometry: Some(build_continuation_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rising_channel" => {
            let setup = latest_channel_setup(bars, true)?;
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("channel_support".into(), num_val(setup.support));
            vals.insert("channel_resistance".into(), num_val(setup.resistance));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                66.0,
                vec!["Rising channel detected with parallel upward high/low slopes".to_string()],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_channel_geometry(&setup, true)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_falling_channel" => {
            let setup = latest_channel_setup(bars, false)?;
            vals.insert("high_slope".into(), num_val(round_js(setup.high_slope, 4)));
            vals.insert("low_slope".into(), num_val(round_js(setup.low_slope, 4)));
            vals.insert("channel_support".into(), num_val(setup.support));
            vals.insert("channel_resistance".into(), num_val(setup.resistance));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                66.0,
                vec!["Falling channel detected with parallel downward high/low slopes".to_string()],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_channel_geometry(&setup, false)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_high_tight_flag" => {
            let setup = latest_high_tight_flag_setup(bars)?;
            vals.insert("rally_pct".into(), num_val(setup.rally_pct));
            vals.insert("pullback_pct".into(), num_val(setup.pullback_pct));
            vals.insert("breakout_level".into(), num_val(setup.breakout_level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                82.0,
                vec![format!(
                    "Price rallied {}% before a tight pullback breakout above {}",
                    format_js_number(setup.rally_pct),
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.breakout_level),
                    support_level: Some(setup.pullback_low),
                    pattern_start_date: Some(setup.rally_bars[0].date.clone()),
                    geometry: Some(build_high_tight_flag_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_coil_volatility_squeeze" => {
            let setup = latest_coil_setup(bars)?;
            vals.insert("first_range".into(), num_val(setup.first_range));
            vals.insert("latest_range".into(), num_val(setup.latest_range));
            vals.insert("range_ratio".into(), num_val(setup.range_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Neutral,
                64.0,
                vec![format!(
                    "Recent ranges contracted from {} to {}",
                    format_js_number(setup.first_range),
                    format_js_number(setup.latest_range)
                )],
                vals,
                PatternExtras {
                    support_level: Some(setup.support),
                    resistance_level: Some(setup.resistance),
                    pattern_start_date: Some(setup.base_bars[0].date.clone()),
                    geometry: Some(build_coil_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_three_rising_valleys" => {
            let setup = latest_three_pivot_setup(bars, true)?;
            vals.insert("first_low".into(), num_val(setup.pivots[0].price));
            vals.insert("second_low".into(), num_val(setup.pivots[1].price));
            vals.insert("third_low".into(), num_val(setup.pivots[2].price));
            vals.insert("breakout_level".into(), num_val(setup.level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                78.0,
                vec![format!(
                    "Three rising valleys confirmed higher lows and broke above {}",
                    format_js_number(setup.level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.level),
                    support_level: Some(setup.pivots[2].price),
                    pattern_start_date: Some(setup.pivots[0].date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_three_pivot_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_three_falling_peaks" => {
            let setup = latest_three_pivot_setup(bars, false)?;
            vals.insert("first_high".into(), num_val(setup.pivots[0].price));
            vals.insert("second_high".into(), num_val(setup.pivots[1].price));
            vals.insert("third_high".into(), num_val(setup.pivots[2].price));
            vals.insert("breakdown_level".into(), num_val(setup.level));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                78.0,
                vec![format!(
                    "Three falling peaks confirmed lower highs and broke below {}",
                    format_js_number(setup.level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.level),
                    resistance_level: Some(setup.pivots[2].price),
                    pattern_start_date: Some(setup.pivots[0].date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_three_pivot_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_measured_move_up" => {
            let setup = latest_measured_move_setup(bars, true)?;
            vals.insert("first_leg_pct".into(), num_val(setup.first_leg_pct));
            vals.insert("second_leg_pct".into(), num_val(setup.second_leg_pct));
            vals.insert("leg_ratio".into(), num_val(setup.leg_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                70.0,
                vec![format!(
                    "Second bullish leg ({}%) is similar to first leg ({}%)",
                    format_js_number(setup.second_leg_pct),
                    format_js_number(setup.first_leg_pct)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.latest.close),
                    support_level: Some(setup.correction_extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_measured_move_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_measured_move_down" => {
            let setup = latest_measured_move_setup(bars, false)?;
            vals.insert("first_leg_pct".into(), num_val(setup.first_leg_pct));
            vals.insert("second_leg_pct".into(), num_val(setup.second_leg_pct));
            vals.insert("leg_ratio".into(), num_val(setup.leg_ratio));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                70.0,
                vec![format!(
                    "Second bearish leg ({}%) is similar to first leg ({}%)",
                    format_js_number(setup.second_leg_pct.abs()),
                    format_js_number(setup.first_leg_pct.abs())
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.latest.close),
                    resistance_level: Some(setup.correction_extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_measured_move_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_head_shoulders" => {
            let setup = latest_head_shoulders_setup(bars, true)?;
            vals.insert("left_shoulder".into(), num_val(setup.left_shoulder.price));
            vals.insert("head".into(), num_val(setup.head.price));
            vals.insert("right_shoulder".into(), num_val(setup.right_shoulder.price));
            vals.insert("neckline".into(), num_val(setup.neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                82.0,
                vec![format!(
                    "Head ({}) is above both shoulders and close broke neckline ({})",
                    format_js_number(setup.head.price),
                    format_js_number(setup.neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.neckline),
                    neckline_level: Some(setup.neckline),
                    resistance_level: Some(setup.head.price),
                    pattern_start_date: Some(setup.left_shoulder.date.clone()),
                    pivots: Some(vec![
                        setup.left_shoulder.to_contract(),
                        setup.head.to_contract(),
                        setup.right_shoulder.to_contract(),
                    ]),
                    geometry: Some(build_head_shoulders_geometry(
                        &setup,
                        spec.name,
                        latest_date,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_inverse_head_shoulders" => {
            let setup = latest_head_shoulders_setup(bars, false)?;
            vals.insert("left_shoulder".into(), num_val(setup.left_shoulder.price));
            vals.insert("head".into(), num_val(setup.head.price));
            vals.insert("right_shoulder".into(), num_val(setup.right_shoulder.price));
            vals.insert("neckline".into(), num_val(setup.neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                82.0,
                vec![format!(
                    "Head ({}) is below both shoulders and close broke neckline ({})",
                    format_js_number(setup.head.price),
                    format_js_number(setup.neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.neckline),
                    neckline_level: Some(setup.neckline),
                    support_level: Some(setup.head.price),
                    pattern_start_date: Some(setup.left_shoulder.date.clone()),
                    pivots: Some(vec![
                        setup.left_shoulder.to_contract(),
                        setup.head.to_contract(),
                        setup.right_shoulder.to_contract(),
                    ]),
                    geometry: Some(build_head_shoulders_geometry(
                        &setup,
                        spec.name,
                        latest_date,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_complex_head_shoulders" => {
            let setup = latest_complex_head_shoulders_setup(bars, true)
                .or_else(|| latest_complex_head_shoulders_setup(bars, false))?;
            vals.insert("head".into(), num_val(setup.head.price));
            vals.insert("neckline".into(), num_val(setup.neckline));
            vals.insert("pivot_count".into(), usize_val(setup.pivots.len()));
            let is_bearish = setup.direction == ScannerDirectionV1::Bearish;
            Some(create_result(
                target,
                latest_date,
                spec,
                setup.direction,
                76.0,
                vec![format!(
                    "Complex H&S {} broke neckline ({})",
                    if is_bearish { "top" } else { "bottom" },
                    format_js_number(setup.neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.neckline),
                    neckline_level: Some(setup.neckline),
                    support_level: Some(if is_bearish {
                        setup.neckline
                    } else {
                        setup.head.price
                    }),
                    resistance_level: Some(if is_bearish {
                        setup.head.price
                    } else {
                        setup.neckline
                    }),
                    pattern_start_date: Some(setup.pivots[0].date.clone()),
                    pivots: Some(setup.pivots.iter().map(Pivot::to_contract).collect()),
                    geometry: Some(build_complex_head_shoulders_geometry(
                        &setup,
                        spec.name,
                        latest_date,
                    )),
                },
                generated_at,
            ))
        }
        "chart_cup_handle" => {
            let setup = latest_cup_handle_setup(bars, true)?;
            vals.insert("rim_level".into(), num_val(setup.rim_level));
            vals.insert("cup_low".into(), num_val(setup.cup_extreme));
            vals.insert(
                "handle_pullback_pct".into(),
                num_val(setup.handle_pullback_pct),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                78.0,
                vec![format!(
                    "Rounded base recovered toward rim ({}) and broke out after shallow handle",
                    format_js_number(setup.rim_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.rim_level),
                    resistance_level: Some(setup.rim_level),
                    support_level: Some(setup.cup_extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_cup_handle_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_inverted_cup_handle" => {
            let setup = latest_cup_handle_setup(bars, false)?;
            vals.insert("rim_level".into(), num_val(setup.rim_level));
            vals.insert("cup_high".into(), num_val(setup.cup_extreme));
            vals.insert(
                "handle_pullback_pct".into(),
                num_val(setup.handle_pullback_pct),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                78.0,
                vec![format!(
                    "Inverted rounded base returned toward rim ({}) and broke down after handle bounce",
                    format_js_number(setup.rim_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.rim_level),
                    support_level: Some(setup.rim_level),
                    resistance_level: Some(setup.cup_extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_cup_handle_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rounding_bottom" => {
            let setup = latest_rounding_setup(bars, true)?;
            vals.insert("rim_level".into(), num_val(setup.rim_level));
            vals.insert("bowl_low".into(), num_val(setup.extreme));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                70.0,
                vec![format!(
                    "Gradual rounded bottom recovered above rim level ({})",
                    format_js_number(setup.rim_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.rim_level),
                    resistance_level: Some(setup.rim_level),
                    support_level: Some(setup.extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_rounding_geometry(&setup, true, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_adam_eve_bottom" => {
            let setup = latest_adam_eve_setup(bars, true)?;
            vals.insert("adam_low".into(), num_val(setup.adam.price));
            vals.insert("eve_low".into(), num_val(setup.eve.price));
            vals.insert("neckline".into(), num_val(setup.neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                74.0,
                vec![format!(
                    "Sharp Adam low ({}) and rounded Eve low ({}) broke neckline ({})",
                    format_js_number(setup.adam.price),
                    format_js_number(setup.eve.price),
                    format_js_number(setup.neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.neckline),
                    neckline_level: Some(setup.neckline),
                    support_level: Some(setup.adam.price.min(setup.eve.price)),
                    pattern_start_date: Some(setup.adam.date.clone()),
                    pivots: Some(vec![setup.adam.to_contract(), setup.eve.to_contract()]),
                    geometry: Some(build_adam_eve_geometry(
                        &setup,
                        true,
                        spec.name,
                        latest_date,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_adam_eve_top" => {
            let setup = latest_adam_eve_setup(bars, false)?;
            vals.insert("adam_high".into(), num_val(setup.adam.price));
            vals.insert("eve_high".into(), num_val(setup.eve.price));
            vals.insert("support".into(), num_val(setup.neckline));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                74.0,
                vec![format!(
                    "Sharp Adam high ({}) and rounded Eve high ({}) broke support ({})",
                    format_js_number(setup.adam.price),
                    format_js_number(setup.eve.price),
                    format_js_number(setup.neckline)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.neckline),
                    neckline_level: Some(setup.neckline),
                    resistance_level: Some(setup.adam.price.max(setup.eve.price)),
                    pattern_start_date: Some(setup.adam.date.clone()),
                    pivots: Some(vec![setup.adam.to_contract(), setup.eve.to_contract()]),
                    geometry: Some(build_adam_eve_geometry(
                        &setup,
                        false,
                        spec.name,
                        latest_date,
                    )),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_scallop_handle" => {
            let setup = latest_scallop_handle_setup(bars)?;
            vals.insert("scallop_low".into(), num_val(setup.scallop_low));
            vals.insert("right_rim".into(), num_val(setup.right_rim));
            vals.insert("advance_pct".into(), num_val(setup.advance_pct));
            vals.insert(
                "handle_pullback_pct".into(),
                num_val(setup.handle_pullback_pct),
            );
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bullish,
                72.0,
                vec![format!(
                    "Rising scallop recovered {}% and broke above handle high ({})",
                    format_js_number(setup.advance_pct),
                    format_js_number(setup.breakout_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.breakout_level),
                    resistance_level: Some(setup.breakout_level),
                    support_level: Some(setup.scallop_low),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_scallop_handle_geometry(&setup, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        "chart_rounding_top" => {
            let setup = latest_rounding_setup(bars, false)?;
            vals.insert("rim_level".into(), num_val(setup.rim_level));
            vals.insert("arch_high".into(), num_val(setup.extreme));
            Some(create_result(
                target,
                latest_date,
                spec,
                ScannerDirectionV1::Bearish,
                70.0,
                vec![format!(
                    "Gradual rounded top broke below rim level ({})",
                    format_js_number(setup.rim_level)
                )],
                vals,
                PatternExtras {
                    breakout_level: Some(setup.rim_level),
                    support_level: Some(setup.rim_level),
                    resistance_level: Some(setup.extreme),
                    pattern_start_date: Some(setup.pattern_bars[0].date.clone()),
                    geometry: Some(build_rounding_geometry(&setup, false, spec.name)),
                    ..Default::default()
                },
                generated_at,
            ))
        }
        _ => None,
    }
}
