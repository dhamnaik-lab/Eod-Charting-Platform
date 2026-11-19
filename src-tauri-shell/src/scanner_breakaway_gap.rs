use crate::scanner_contract::{
    sort_scanner_results_v1, ChartPatternFamilyV1, ChartPatternGeometryFamilyV1,
    ChartPatternGeometryLabelV1, ChartPatternGeometryPointV1, ChartPatternGeometryV1,
    ChartPatternGeometryZoneV1, ChartPatternResultDetailsV1, ChartPatternZoneRoleV1, EodBarV1,
    RustScannerEvaluationRequestV1, RustScannerEvaluationResponseV1, RustScannerProgressEventV1,
    ScannerDirectionV1, ScannerResultHistoryV1, ScannerResultV1, ScannerRunTargetV1,
    ScannerScalarValueV1, RUST_SCANNER_CONTRACT_VERSION,
};
use std::collections::BTreeMap;

pub const CHART_BREAKAWAY_GAP_SCANNER_ID: &str = "chart_breakaway_gap";
pub const CHART_BREAKAWAY_GAP_SCANNER_NAME: &str = "Breakaway Gap";
pub const CHART_GAP_CATEGORY_ID: &str = "chart_patterns_gap";
pub const CHART_GAP_CATEGORY_NAME: &str = "Chart Patterns - Gaps";
pub const CHART_PATTERN_SCANNER_SOURCE: &str = "EODChartPatternScanner_v1";

const MIN_GAP_PCT: f64 = 0.25;
const BREAKAWAY_BASE_BARS: usize = 20;
const BREAKAWAY_MIN_BARS: usize = 22;
const BREAKAWAY_VOLUME_MULTIPLIER: f64 = 1.5;
const BREAKAWAY_CONFIDENCE: f64 = 80.0;
const MIN_HISTORICAL_ENDPOINT_BARS: usize = 20;
const MAX_PATTERN_WINDOW_BARS: usize = 260;
const HISTORY_PROGRESS_STEP: usize = 50;
const I64_MIN_F64: f64 = -9_223_372_036_854_775_808.0;
const I64_MAX_EXCLUSIVE_F64: f64 = 9_223_372_036_854_775_808.0;

fn normalize_zero(value: f64) -> f64 {
    if value == 0.0 {
        0.0
    } else {
        value
    }
}

fn js_math_round(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    let rounded = if value >= 0.0 {
        value.round()
    } else {
        let floor_val = value.floor();
        if (value - floor_val) >= 0.5 {
            value.ceil()
        } else {
            floor_val
        }
    };
    normalize_zero(rounded)
}

fn round_js(value: f64, digits: i32) -> f64 {
    let factor = 10f64.powi(digits);
    normalize_zero(js_math_round(value * factor) / factor)
}

fn scalar_number_v1(value: f64) -> ScannerScalarValueV1 {
    let normalized = normalize_zero(value);
    if normalized.is_finite()
        && normalized.fract() == 0.0
        && (I64_MIN_F64..I64_MAX_EXCLUSIVE_F64).contains(&normalized)
    {
        ScannerScalarValueV1::Integer(normalized as i64)
    } else {
        ScannerScalarValueV1::Float(normalized)
    }
}

fn format_js_number(value: f64) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value == 0.0 {
        return "0".to_string();
    }
    if value.is_infinite() {
        return if value.is_sign_negative() {
            "-Infinity".to_string()
        } else {
            "Infinity".to_string()
        };
    }

    let sign = if value.is_sign_negative() { "-" } else { "" };
    let abs = value.abs();
    let exp_formatted = format!("{abs:e}");
    let (mantissa, exp_str) = exp_formatted
        .split_once('e')
        .expect("LowerExp format must contain 'e'");
    let exp: i32 = exp_str
        .parse()
        .expect("LowerExp exponent must parse as i32");

    if (-6..=20).contains(&exp) {
        format!("{sign}{abs}")
    } else if exp >= 0 {
        format!("{sign}{mantissa}e+{exp}")
    } else {
        format!("{sign}{mantissa}e{exp}")
    }
}

fn gap_up_pct(today: &EodBarV1, previous: &EodBarV1) -> Option<f64> {
    if !previous.high.is_finite() || !today.open.is_finite() {
        return None;
    }
    if previous.high <= 0.0 || today.open <= previous.high {
        return None;
    }
    let pct = round_js((today.open / previous.high - 1.0) * 100.0, 2);
    if pct.is_finite() {
        Some(pct)
    } else {
        None
    }
}

fn highest_high(bars: &[EodBarV1]) -> Option<f64> {
    if bars.is_empty() {
        return None;
    }
    let mut max_high = f64::NEG_INFINITY;
    for bar in bars {
        if !bar.high.is_finite() {
            return None;
        }
        if bar.high > max_high {
            max_high = bar.high;
        }
    }
    Some(normalize_zero(max_high))
}

fn average_volume_excluding_current(bars: &[EodBarV1], period: usize) -> Option<f64> {
    if period == 0 || bars.len() <= period {
        return None;
    }
    let end = bars.len() - 1;
    let start = end - period;
    let mut sum = 0.0_f64;
    for bar in &bars[start..end] {
        if !bar.volume.is_finite() {
            return None;
        }
        sum += bar.volume;
    }
    let avg = sum / (period as f64);
    if avg.is_finite() {
        Some(avg)
    } else {
        None
    }
}

fn is_volume_spike(volume: f64, average: Option<f64>, multiplier: f64) -> bool {
    match average {
        Some(avg) if volume.is_finite() && avg.is_finite() && avg > 0.0 => {
            volume >= avg * multiplier
        }
        _ => false,
    }
}

pub fn detect_chart_breakaway_gap(
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<ScannerResultV1> {
    if bars.len() < BREAKAWAY_MIN_BARS {
        return None;
    }
    let len = bars.len();
    let today = &bars[len - 1];
    let previous = &bars[len - 2];

    if !today.low.is_finite() || !today.close.is_finite() || !today.volume.is_finite() {
        return None;
    }

    let gap_pct = gap_up_pct(today, previous)?;
    if gap_pct < MIN_GAP_PCT {
        return None;
    }

    let base = &bars[len - BREAKAWAY_MIN_BARS..len - 2];
    let resistance = highest_high(base)?;
    let avg_volume = average_volume_excluding_current(bars, BREAKAWAY_BASE_BARS)?;

    if today.open <= resistance || today.close <= resistance {
        return None;
    }
    if !is_volume_spike(today.volume, Some(avg_volume), BREAKAWAY_VOLUME_MULTIPLIER) {
        return None;
    }

    let avg_volume_rounded = round_js(avg_volume, 0);
    let volume_ratio_rounded = round_js(today.volume / avg_volume, 2);

    let mut values = BTreeMap::new();
    values.insert("gap_pct".to_string(), Some(scalar_number_v1(gap_pct)));
    values.insert("resistance".to_string(), Some(scalar_number_v1(resistance)));
    values.insert(
        "avg_volume_20".to_string(),
        Some(scalar_number_v1(avg_volume_rounded)),
    );
    values.insert(
        "volume_ratio".to_string(),
        Some(scalar_number_v1(volume_ratio_rounded)),
    );

    let gap_low = normalize_zero(previous.high.min(today.low));
    let gap_high = normalize_zero(previous.high.max(today.low));
    let close_price = normalize_zero(today.close);

    let geometry = ChartPatternGeometryV1 {
        family: ChartPatternGeometryFamilyV1::GapZone,
        pivot_markers: None,
        trend_lines: None,
        zones: Some(vec![ChartPatternGeometryZoneV1 {
            id: "gap".to_string(),
            label: Some("Gap".to_string()),
            role: ChartPatternZoneRoleV1::Gap,
            start_date: previous.date.clone(),
            end_date: today.date.clone(),
            low: gap_low,
            high: gap_high,
            fill_opacity: None,
        }]),
        labels: Some(vec![ChartPatternGeometryLabelV1 {
            id: "pattern".to_string(),
            text: CHART_BREAKAWAY_GAP_SCANNER_NAME.to_string(),
            point: ChartPatternGeometryPointV1 {
                index: None,
                date: today.date.clone(),
                price: close_price,
            },
        }]),
        target_projection: None,
    };

    let chart_pattern = ChartPatternResultDetailsV1 {
        family: ChartPatternFamilyV1::Gap,
        confidence: BREAKAWAY_CONFIDENCE,
        pattern_start_date: Some(base[0].date.clone()),
        pattern_end_date: today.date.clone(),
        breakout_level: Some(resistance),
        support_level: None,
        resistance_level: Some(resistance),
        neckline_level: None,
        target_price: None,
        stop_loss_price: None,
        potential_gain_pct: None,
        risk_reward_ratio: None,
        pivots: None,
        geometry: Some(geometry),
    };

    Some(ScannerResultV1 {
        symbol: target.symbol.clone(),
        exchange: target.exchange.clone(),
        scanner_id: CHART_BREAKAWAY_GAP_SCANNER_ID.to_string(),
        scanner_name: CHART_BREAKAWAY_GAP_SCANNER_NAME.to_string(),
        category_id: CHART_GAP_CATEGORY_ID.to_string(),
        category_name: CHART_GAP_CATEGORY_NAME.to_string(),
        date: today.date.clone(),
        matched: true,
        direction: Some(ScannerDirectionV1::Bullish),
        score: Some(BREAKAWAY_CONFIDENCE),
        reasons: Some(vec![format!(
            "Gap opened above 20-bar resistance ({}) with volume expansion",
            format_js_number(resistance)
        )]),
        values: Some(values),
        chart_pattern: Some(chart_pattern),
        warnings: Some(Vec::new()),
        source: Some(CHART_PATTERN_SCANNER_SOURCE.to_string()),
        history: None,
        generated_at: generated_at.to_string(),
    })
}

pub fn evaluate_chart_breakaway_gap_request_v1(
    request: &RustScannerEvaluationRequestV1,
) -> Result<RustScannerEvaluationResponseV1, String> {
    if request.contract_version != RUST_SCANNER_CONTRACT_VERSION {
        return Err(format!(
            "Unsupported scanner contract version: {}",
            request.contract_version
        ));
    }

    for scanner_id in &request.scanner_ids {
        if scanner_id != CHART_BREAKAWAY_GAP_SCANNER_ID {
            return Err(format!(
                "Unsupported scannerId for RSC-02 isolated Breakaway Gap evaluator: {scanner_id}"
            ));
        }
    }

    let has_breakaway_gap = !request.scanner_ids.is_empty();
    let generated_at = request
        .generated_at
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));

    let latest_results = if has_breakaway_gap {
        detect_chart_breakaway_gap(&request.target, &request.bars, &generated_at)
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    if !request.evaluate_history || !has_breakaway_gap {
        let mut results = latest_results.clone();
        sort_scanner_results_v1(&mut results);
        return Ok(RustScannerEvaluationResponseV1 {
            contract_version: request.contract_version.clone(),
            request_id: request.request_id.clone(),
            target: request.target.clone(),
            latest_results,
            historical_results: Vec::new(),
            results,
            scanned_bars: request.bars.len(),
            cancelled: false,
            errors: Vec::new(),
            progress_events: None,
        });
    }

    let history_total = if request.bars.len() >= MIN_HISTORICAL_ENDPOINT_BARS {
        request.bars.len() - MIN_HISTORICAL_ENDPOINT_BARS + 1
    } else {
        0
    };

    let mut completed_groups: Vec<ScannerResultV1> = Vec::new();
    let mut active_group: Option<ScannerResultV1> = None;
    let mut progress_events: Vec<RustScannerProgressEventV1> = Vec::new();

    for end_index in MIN_HISTORICAL_ENDPOINT_BARS..=request.bars.len() {
        let window_start = end_index.saturating_sub(MAX_PATTERN_WINDOW_BARS);
        let endpoint_bars = &request.bars[window_start..end_index];

        match detect_chart_breakaway_gap(&request.target, endpoint_bars, &generated_at) {
            Some(matched) => {
                if let Some(active) = active_group.as_mut() {
                    if let Some(history) = active.history.as_mut() {
                        history.last_matched_date = matched.date;
                        history.match_count += 1;
                    }
                } else {
                    let mut initial = matched;
                    initial.history = Some(ScannerResultHistoryV1 {
                        first_matched_date: initial.date.clone(),
                        last_matched_date: initial.date.clone(),
                        match_count: 1,
                    });
                    active_group = Some(initial);
                }
            }
            None => {
                if let Some(finished) = active_group.take() {
                    completed_groups.push(finished);
                }
            }
        }

        let history_completed = end_index - MIN_HISTORICAL_ENDPOINT_BARS + 1;
        if history_completed % HISTORY_PROGRESS_STEP == 0 || history_completed == history_total {
            progress_events.push(RustScannerProgressEventV1 {
                contract_version: RUST_SCANNER_CONTRACT_VERSION.to_string(),
                request_id: request.request_id.clone(),
                completed: 1,
                total: 1,
                symbol: request.target.symbol.clone(),
                exchange: request.target.exchange.clone(),
                history_completed: Some(history_completed),
                history_total: Some(history_total),
                result_count: Some(completed_groups.len() + usize::from(active_group.is_some())),
            });
        }
    }

    if let Some(remaining) = active_group.take() {
        completed_groups.push(remaining);
    }

    let mut results = completed_groups.clone();
    sort_scanner_results_v1(&mut results);

    Ok(RustScannerEvaluationResponseV1 {
        contract_version: request.contract_version.clone(),
        request_id: request.request_id.clone(),
        target: request.target.clone(),
        latest_results,
        historical_results: completed_groups,
        results,
        scanned_bars: request.bars.len(),
        cancelled: false,
        errors: Vec::new(),
        progress_events: if progress_events.is_empty() {
            None
        } else {
            Some(progress_events)
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner_contract::{
        ChartPatternGeometryTrendLineV1, ChartPatternTargetProjectionV1,
        RustScannerContractFixtureBundleV1,
    };
    use crate::scanner_contract::parity_harness::{
        assert_json_semantically_equal, assert_parity_fixture_bundle,
    };

    const FLOAT_TOLERANCE: f64 = 1e-12;

    const RSC_01_FIXTURE_JSON: &str =
        include_str!("../../src/features/scanner/fixtures/rustScannerContractFixtures.v1.json");
    const RSC_02_FIXTURE_JSON: &str =
        include_str!("../../src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json");

    fn assert_f64_close(expected: f64, actual: f64, path: &str) {
        assert!(
            (expected - actual).abs() <= FLOAT_TOLERANCE,
            "float mismatch at {path}: expected {expected}, got {actual}"
        );
    }

    fn assert_opt_f64_close(expected: Option<f64>, actual: Option<f64>, path: &str) {
        match (expected, actual) {
            (None, None) => {}
            (Some(e), Some(a)) => assert_f64_close(e, a, path),
            _ => panic!(
                "optional float presence mismatch at {path}: expected {expected:?}, got {actual:?}"
            ),
        }
    }

    fn assert_scalar_parity(
        expected: &Option<ScannerScalarValueV1>,
        actual: &Option<ScannerScalarValueV1>,
        path: &str,
    ) {
        match (expected, actual) {
            (None, None) => {}
            (Some(ScannerScalarValueV1::Bool(e)), Some(ScannerScalarValueV1::Bool(a))) => {
                assert_eq!(e, a, "bool mismatch at {path}");
            }
            (Some(ScannerScalarValueV1::Text(e)), Some(ScannerScalarValueV1::Text(a))) => {
                assert_eq!(e, a, "text mismatch at {path}");
            }
            (Some(ScannerScalarValueV1::Integer(e)), Some(ScannerScalarValueV1::Integer(a))) => {
                assert_eq!(e, a, "integer mismatch at {path}");
            }
            (Some(ScannerScalarValueV1::Float(e)), Some(ScannerScalarValueV1::Float(a))) => {
                assert_f64_close(*e, *a, path);
            }
            _ => panic!(
                "scalar value variant/presence mismatch at {path}: expected {expected:?}, got {actual:?}"
            ),
        }
    }

    fn assert_point_parity(
        expected: &ChartPatternGeometryPointV1,
        actual: &ChartPatternGeometryPointV1,
        path: &str,
    ) {
        assert_eq!(expected.index, actual.index, "index mismatch at {path}");
        assert_eq!(expected.date, actual.date, "date mismatch at {path}");
        assert_f64_close(expected.price, actual.price, &format!("{path}.price"));
    }

    fn assert_trend_line_parity(
        expected: &ChartPatternGeometryTrendLineV1,
        actual: &ChartPatternGeometryTrendLineV1,
        path: &str,
    ) {
        assert_eq!(expected.id, actual.id, "id mismatch at {path}");
        assert_eq!(expected.label, actual.label, "label mismatch at {path}");
        assert_eq!(expected.role, actual.role, "role mismatch at {path}");
        assert_point_parity(&expected.start, &actual.start, &format!("{path}.start"));
        assert_point_parity(&expected.end, &actual.end, &format!("{path}.end"));
        assert_eq!(
            expected.extend_right, actual.extend_right,
            "extend_right mismatch at {path}"
        );
    }

    fn assert_target_projection_parity(
        expected: &ChartPatternTargetProjectionV1,
        actual: &ChartPatternTargetProjectionV1,
        path: &str,
    ) {
        assert_f64_close(
            expected.breakout_price,
            actual.breakout_price,
            &format!("{path}.breakout_price"),
        );
        assert_f64_close(
            expected.target_price,
            actual.target_price,
            &format!("{path}.target_price"),
        );
        assert_f64_close(
            expected.stop_loss_price,
            actual.stop_loss_price,
            &format!("{path}.stop_loss_price"),
        );
        assert_f64_close(
            expected.pattern_height,
            actual.pattern_height,
            &format!("{path}.pattern_height"),
        );
        assert_f64_close(
            expected.potential_gain_pct,
            actual.potential_gain_pct,
            &format!("{path}.potential_gain_pct"),
        );
        assert_f64_close(
            expected.risk_reward_ratio,
            actual.risk_reward_ratio,
            &format!("{path}.risk_reward_ratio"),
        );
        match (&expected.projection_line, &actual.projection_line) {
            (None, None) => {}
            (Some(e), Some(a)) => {
                assert_trend_line_parity(e, a, &format!("{path}.projection_line"))
            }
            _ => panic!("projection_line presence mismatch at {path}"),
        }
    }

    fn assert_geometry_parity(
        expected: &ChartPatternGeometryV1,
        actual: &ChartPatternGeometryV1,
        path: &str,
    ) {
        assert_eq!(
            expected.family, actual.family,
            "geometry family mismatch at {path}"
        );
        match (&expected.pivot_markers, &actual.pivot_markers) {
            (None, None) => {}
            (Some(em), Some(am)) => {
                assert_eq!(
                    em.len(),
                    am.len(),
                    "pivot_markers length mismatch at {path}"
                );
                for (idx, (e, a)) in em.iter().zip(am.iter()).enumerate() {
                    let mpath = format!("{path}.pivot_markers[{idx}]");
                    assert_eq!(e.id, a.id, "marker id mismatch at {mpath}");
                    assert_eq!(e.label, a.label, "marker label mismatch at {mpath}");
                    assert_eq!(e.kind, a.kind, "marker kind mismatch at {mpath}");
                    assert_eq!(e.role, a.role, "marker role mismatch at {mpath}");
                    assert_eq!(e.index, a.index, "marker index mismatch at {mpath}");
                    assert_eq!(e.date, a.date, "marker date mismatch at {mpath}");
                    assert_f64_close(e.price, a.price, &format!("{mpath}.price"));
                }
            }
            _ => panic!("pivot_markers presence mismatch at {path}"),
        }

        match (&expected.trend_lines, &actual.trend_lines) {
            (None, None) => {}
            (Some(et), Some(at)) => {
                assert_eq!(et.len(), at.len(), "trend_lines length mismatch at {path}");
                for (idx, (e, a)) in et.iter().zip(at.iter()).enumerate() {
                    assert_trend_line_parity(e, a, &format!("{path}.trend_lines[{idx}]"));
                }
            }
            _ => panic!("trend_lines presence mismatch at {path}"),
        }

        match (&expected.zones, &actual.zones) {
            (None, None) => {}
            (Some(ez), Some(az)) => {
                assert_eq!(ez.len(), az.len(), "zones length mismatch at {path}");
                for (idx, (e, a)) in ez.iter().zip(az.iter()).enumerate() {
                    let zpath = format!("{path}.zones[{idx}]");
                    assert_eq!(e.id, a.id, "zone id mismatch at {zpath}");
                    assert_eq!(e.label, a.label, "zone label mismatch at {zpath}");
                    assert_eq!(e.role, a.role, "zone role mismatch at {zpath}");
                    assert_eq!(
                        e.start_date, a.start_date,
                        "zone start_date mismatch at {zpath}"
                    );
                    assert_eq!(e.end_date, a.end_date, "zone end_date mismatch at {zpath}");
                    assert_f64_close(e.low, a.low, &format!("{zpath}.low"));
                    assert_f64_close(e.high, a.high, &format!("{zpath}.high"));
                    assert_opt_f64_close(
                        e.fill_opacity,
                        a.fill_opacity,
                        &format!("{zpath}.fill_opacity"),
                    );
                }
            }
            _ => panic!("zones presence mismatch at {path}"),
        }

        match (&expected.labels, &actual.labels) {
            (None, None) => {}
            (Some(el), Some(al)) => {
                assert_eq!(el.len(), al.len(), "labels length mismatch at {path}");
                for (idx, (e, a)) in el.iter().zip(al.iter()).enumerate() {
                    let lpath = format!("{path}.labels[{idx}]");
                    assert_eq!(e.id, a.id, "label id mismatch at {lpath}");
                    assert_eq!(e.text, a.text, "label text mismatch at {lpath}");
                    assert_point_parity(&e.point, &a.point, &format!("{lpath}.point"));
                }
            }
            _ => panic!("labels presence mismatch at {path}"),
        }

        match (&expected.target_projection, &actual.target_projection) {
            (None, None) => {}
            (Some(ep), Some(ap)) => {
                assert_target_projection_parity(ep, ap, &format!("{path}.target_projection"))
            }
            _ => panic!("target_projection presence mismatch at {path}"),
        }
    }

    fn assert_result_parity(expected: &ScannerResultV1, actual: &ScannerResultV1, path: &str) {
        assert_eq!(expected.symbol, actual.symbol, "symbol mismatch at {path}");
        assert_eq!(
            expected.exchange, actual.exchange,
            "exchange mismatch at {path}"
        );
        assert_eq!(
            expected.scanner_id, actual.scanner_id,
            "scanner_id mismatch at {path}"
        );
        assert_eq!(
            expected.scanner_name, actual.scanner_name,
            "scanner_name mismatch at {path}"
        );
        assert_eq!(
            expected.category_id, actual.category_id,
            "category_id mismatch at {path}"
        );
        assert_eq!(
            expected.category_name, actual.category_name,
            "category_name mismatch at {path}"
        );
        assert_eq!(expected.date, actual.date, "date mismatch at {path}");
        assert_eq!(
            expected.matched, actual.matched,
            "matched mismatch at {path}"
        );
        assert_eq!(
            expected.direction, actual.direction,
            "direction mismatch at {path}"
        );
        assert_opt_f64_close(expected.score, actual.score, &format!("{path}.score"));
        assert_eq!(
            expected.reasons, actual.reasons,
            "reasons mismatch at {path}"
        );

        match (&expected.values, &actual.values) {
            (None, None) => {}
            (Some(ev), Some(av)) => {
                let e_keys: Vec<&String> = ev.keys().collect();
                let a_keys: Vec<&String> = av.keys().collect();
                assert_eq!(e_keys, a_keys, "values keys mismatch at {path}");
                for key in e_keys {
                    assert_scalar_parity(&ev[key], &av[key], &format!("{path}.values.{key}"));
                }
            }
            _ => panic!("values presence mismatch at {path}"),
        }

        match (&expected.chart_pattern, &actual.chart_pattern) {
            (None, None) => {}
            (Some(ep), Some(ap)) => {
                let ppath = format!("{path}.chart_pattern");
                assert_eq!(ep.family, ap.family, "family mismatch at {ppath}");
                assert_f64_close(ep.confidence, ap.confidence, &format!("{ppath}.confidence"));
                assert_eq!(
                    ep.pattern_start_date, ap.pattern_start_date,
                    "pattern_start_date mismatch at {ppath}"
                );
                assert_eq!(
                    ep.pattern_end_date, ap.pattern_end_date,
                    "pattern_end_date mismatch at {ppath}"
                );
                assert_opt_f64_close(
                    ep.breakout_level,
                    ap.breakout_level,
                    &format!("{ppath}.breakout_level"),
                );
                assert_opt_f64_close(
                    ep.support_level,
                    ap.support_level,
                    &format!("{ppath}.support_level"),
                );
                assert_opt_f64_close(
                    ep.resistance_level,
                    ap.resistance_level,
                    &format!("{ppath}.resistance_level"),
                );
                assert_opt_f64_close(
                    ep.neckline_level,
                    ap.neckline_level,
                    &format!("{ppath}.neckline_level"),
                );
                assert_opt_f64_close(
                    ep.target_price,
                    ap.target_price,
                    &format!("{ppath}.target_price"),
                );
                assert_opt_f64_close(
                    ep.stop_loss_price,
                    ap.stop_loss_price,
                    &format!("{ppath}.stop_loss_price"),
                );
                assert_opt_f64_close(
                    ep.potential_gain_pct,
                    ap.potential_gain_pct,
                    &format!("{ppath}.potential_gain_pct"),
                );
                assert_opt_f64_close(
                    ep.risk_reward_ratio,
                    ap.risk_reward_ratio,
                    &format!("{ppath}.risk_reward_ratio"),
                );
                assert_eq!(ep.pivots, ap.pivots, "pivots mismatch at {ppath}");
                match (&ep.geometry, &ap.geometry) {
                    (None, None) => {}
                    (Some(eg), Some(ag)) => {
                        assert_geometry_parity(eg, ag, &format!("{ppath}.geometry"))
                    }
                    _ => panic!("geometry presence mismatch at {ppath}"),
                }
            }
            _ => panic!("chart_pattern presence mismatch at {path}"),
        }

        assert_eq!(
            expected.warnings, actual.warnings,
            "warnings mismatch at {path}"
        );
        assert_eq!(expected.source, actual.source, "source mismatch at {path}");
        assert_eq!(
            expected.history, actual.history,
            "history mismatch at {path}"
        );
        assert_eq!(
            expected.generated_at, actual.generated_at,
            "generated_at mismatch at {path}"
        );
    }

    fn assert_response_parity(
        expected: &RustScannerEvaluationResponseV1,
        actual: &RustScannerEvaluationResponseV1,
        scenario_id: &str,
    ) {
        assert_eq!(
            expected.contract_version, actual.contract_version,
            "contract_version mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.request_id, actual.request_id,
            "request_id mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.target, actual.target,
            "target mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.scanned_bars, actual.scanned_bars,
            "scanned_bars mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.cancelled, actual.cancelled,
            "cancelled mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.errors, actual.errors,
            "errors mismatch in {scenario_id}"
        );
        assert_eq!(
            expected.progress_events, actual.progress_events,
            "progress_events mismatch in {scenario_id}"
        );

        assert_eq!(
            expected.latest_results.len(),
            actual.latest_results.len(),
            "latest_results length mismatch in {scenario_id}"
        );
        for (idx, (e, a)) in expected
            .latest_results
            .iter()
            .zip(actual.latest_results.iter())
            .enumerate()
        {
            assert_result_parity(e, a, &format!("{scenario_id}.latest_results[{idx}]"));
        }

        assert_eq!(
            expected.historical_results.len(),
            actual.historical_results.len(),
            "historical_results length mismatch in {scenario_id}"
        );
        for (idx, (e, a)) in expected
            .historical_results
            .iter()
            .zip(actual.historical_results.iter())
            .enumerate()
        {
            assert_result_parity(e, a, &format!("{scenario_id}.historical_results[{idx}]"));
        }

        assert_eq!(
            expected.results.len(),
            actual.results.len(),
            "results length mismatch in {scenario_id}"
        );
        for (idx, (e, a)) in expected
            .results
            .iter()
            .zip(actual.results.iter())
            .enumerate()
        {
            assert_result_parity(e, a, &format!("{scenario_id}.results[{idx}]"));
        }
    }

    #[test]
    fn rsc_02_matches_rsc_01_gap_breakaway_match_fixture() {
        let bundle: RustScannerContractFixtureBundleV1 = serde_json::from_str(RSC_01_FIXTURE_JSON)
            .expect("RSC-01 fixture JSON must deserialize");
        let scenario = bundle
            .scenarios
            .iter()
            .find(|item| item.id == "gap_breakaway_match")
            .expect("RSC-01 gap_breakaway_match fixture must exist");

        let generated_at = scenario
            .request
            .generated_at
            .as_deref()
            .expect("fixture request must supply generatedAt");
        let actual = detect_chart_breakaway_gap(
            &scenario.request.target,
            &scenario.request.bars,
            generated_at,
        )
        .expect("Rust Breakaway Gap detector must match RSC-01 gap_breakaway_match");

        assert_eq!(scenario.response.latest_results.len(), 1);
        assert_result_parity(
            &scenario.response.latest_results[0],
            &actual,
            "gap_breakaway_match",
        );

        let raw_bundle: serde_json::Value =
            serde_json::from_str(RSC_01_FIXTURE_JSON).expect("raw RSC-01 JSON must parse");
        let raw_expected_result = &raw_bundle["scenarios"][0]["response"]["latestResults"][0];
        let actual_value =
            serde_json::to_value(&actual).expect("actual result must serialize to JSON");
        assert_json_semantically_equal(raw_expected_result, &actual_value, "$.gap_breakaway_match");

        let err = evaluate_chart_breakaway_gap_request_v1(&scenario.request)
            .expect_err("mixed scannerIds containing unmigrated chart_common_gap must fail closed");
        assert!(err.contains("chart_common_gap"));
    }

    #[test]
    fn rsc_02_parity_across_all_breakaway_gap_fixtures() {
        assert_parity_fixture_bundle(
            RSC_02_FIXTURE_JSON,
            CHART_BREAKAWAY_GAP_SCANNER_ID,
            24,
            &["positive", "boundary", "negative", "historical"],
            evaluate_chart_breakaway_gap_request_v1,
            assert_response_parity,
        );
    }

    #[test]
    fn rsc_02_direct_detector_edge_cases_and_float_rounding() {
        let target = ScannerRunTargetV1 {
            symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            name: None,
        };

        assert!(detect_chart_breakaway_gap(&target, &[], "2026-11-18T12:30:00.000Z").is_none());

        let one_bar = vec![EodBarV1 {
            symbol: "TEST".to_string(),
            date: "2026-01-01".to_string(),
            open: 100.0,
            high: 110.0,
            low: 95.0,
            close: 104.0,
            volume: 100_000.0,
        }];
        assert!(
            detect_chart_breakaway_gap(&target, &one_bar, "2026-11-18T12:30:00.000Z").is_none()
        );

        let mut nan_bars: Vec<EodBarV1> = (1..=21)
            .map(|day| EodBarV1 {
                symbol: "TEST".to_string(),
                date: format!("2026-01-{day:02}"),
                open: 100.0,
                high: 110.0,
                low: 95.0,
                close: 104.0,
                volume: 100_000.0,
            })
            .collect();
        nan_bars.push(EodBarV1 {
            symbol: "TEST".to_string(),
            date: "2026-01-22".to_string(),
            open: f64::NAN,
            high: 121.0,
            low: 115.0,
            close: 120.0,
            volume: 180_000.0,
        });
        assert!(
            detect_chart_breakaway_gap(&target, &nan_bars, "2026-11-18T12:30:00.000Z").is_none()
        );

        nan_bars[21].open = 116.0;
        nan_bars[21].volume = f64::INFINITY;
        assert!(
            detect_chart_breakaway_gap(&target, &nan_bars, "2026-11-18T12:30:00.000Z").is_none()
        );

        assert_eq!(js_math_round(0.5), 1.0);
        assert_eq!(js_math_round(0.499_999_999_999_999_94), 0.0);
        assert_eq!(js_math_round(-0.5), 0.0);
        assert!(!js_math_round(-0.5).is_sign_negative());
        assert_eq!(js_math_round(-1.5), -1.0);
        assert_eq!(js_math_round(-1.51), -2.0);
        assert_eq!(format_js_number(-0.0), "0");
        assert_eq!(format_js_number(0.0), "0");
        assert_eq!(format_js_number(1e-6), "0.000001");
        assert_eq!(
            format_js_number(9.999_999_999_999_997e-7),
            "9.999999999999997e-7"
        );
        assert_eq!(format_js_number(5e-7), "5e-7");
        assert_eq!(format_js_number(-5e-7), "-5e-7");
        assert_eq!(
            format_js_number(9.999_999_999_999_999e20),
            "999999999999999900000"
        );
        assert_eq!(format_js_number(1e21), "1e+21");
        assert_eq!(format_js_number(-1.23e21), "-1.23e+21");
        assert_eq!(format_js_number(f64::NAN), "NaN");
        assert_eq!(format_js_number(f64::INFINITY), "Infinity");
        assert_eq!(format_js_number(f64::NEG_INFINITY), "-Infinity");

        assert_eq!(scalar_number_v1(-0.0), ScannerScalarValueV1::Integer(0));
        assert_eq!(scalar_number_v1(110.0), ScannerScalarValueV1::Integer(110));
        assert_eq!(scalar_number_v1(110.5), ScannerScalarValueV1::Float(110.5));
        assert_eq!(
            scalar_number_v1(9_007_199_254_740_991.0),
            ScannerScalarValueV1::Integer(9_007_199_254_740_991)
        );
        assert_eq!(
            scalar_number_v1(9_007_199_254_740_992.0),
            ScannerScalarValueV1::Integer(9_007_199_254_740_992)
        );
        assert_eq!(
            scalar_number_v1(10_000_000_000_000_000.0),
            ScannerScalarValueV1::Integer(10_000_000_000_000_000)
        );
        assert_eq!(
            scalar_number_v1(I64_MIN_F64),
            ScannerScalarValueV1::Integer(i64::MIN)
        );
        assert_eq!(
            scalar_number_v1(I64_MAX_EXCLUSIVE_F64),
            ScannerScalarValueV1::Float(I64_MAX_EXCLUSIVE_F64)
        );
        assert_eq!(scalar_number_v1(1e20), ScannerScalarValueV1::Float(1e20));

        let missing_ts_request = RustScannerEvaluationRequestV1 {
            contract_version: RUST_SCANNER_CONTRACT_VERSION.to_string(),
            request_id: "req-missing-ts".to_string(),
            target: target.clone(),
            bars: (1..=22)
                .map(|day| EodBarV1 {
                    symbol: "TEST".to_string(),
                    date: format!("2026-01-{day:02}"),
                    open: if day == 22 { 116.0 } else { 100.0 },
                    high: if day == 22 { 121.0 } else { 110.0 },
                    low: if day == 22 { 115.0 } else { 95.0 },
                    close: if day == 22 { 120.0 } else { 104.0 },
                    volume: if day == 22 { 180_000.0 } else { 100_000.0 },
                })
                .collect(),
            scanner_ids: vec![CHART_BREAKAWAY_GAP_SCANNER_ID.to_string()],
            lookback_bars: Some(800),
            evaluate_history: false,
            execution_mode: crate::scanner_contract::ScannerExecutionModeV1::Fast,
            to_date: None,
            generated_at: None,
        };
        let missing_ts_resp = evaluate_chart_breakaway_gap_request_v1(&missing_ts_request)
            .expect("omitted generatedAt must succeed");
        assert_eq!(missing_ts_resp.latest_results.len(), 1);
        let fallback_ts = &missing_ts_resp.latest_results[0].generated_at;
        assert!(fallback_ts.len() == 24 && fallback_ts.ends_with('Z'));

        let empty_ts_request = RustScannerEvaluationRequestV1 {
            generated_at: Some(String::new()),
            ..missing_ts_request
        };
        let empty_ts_resp = evaluate_chart_breakaway_gap_request_v1(&empty_ts_request)
            .expect("empty generatedAt must fall back identically to TypeScript");
        assert_eq!(empty_ts_resp.latest_results.len(), 1);
        let empty_fallback_ts = &empty_ts_resp.latest_results[0].generated_at;
        assert!(empty_fallback_ts.len() == 24 && empty_fallback_ts.ends_with('Z'));

        let bad_version_request = RustScannerEvaluationRequestV1 {
            contract_version: "eod-scanner-contract-v99".to_string(),
            request_id: "req-bad-version".to_string(),
            target,
            bars: Vec::new(),
            scanner_ids: vec![CHART_BREAKAWAY_GAP_SCANNER_ID.to_string()],
            lookback_bars: Some(800),
            evaluate_history: false,
            execution_mode: crate::scanner_contract::ScannerExecutionModeV1::Fast,
            to_date: None,
            generated_at: Some("2026-11-18T12:30:00.000Z".to_string()),
        };
        assert!(evaluate_chart_breakaway_gap_request_v1(&bad_version_request).is_err());
    }
}
