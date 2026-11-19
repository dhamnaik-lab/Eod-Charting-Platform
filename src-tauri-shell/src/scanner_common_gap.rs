//! RSC-04: isolated Common Gap parity detector. Not registered as a Tauri command.
use crate::scanner_breakaway_gap::{
    average_volume_excluding_current, gap_up_pct, normalize_zero, round_js, scalar_number_v1,
    CHART_GAP_CATEGORY_ID, CHART_GAP_CATEGORY_NAME, CHART_PATTERN_SCANNER_SOURCE,
};
use crate::scanner_contract::{
    sort_scanner_results_v1, ChartPatternFamilyV1, ChartPatternGeometryFamilyV1,
    ChartPatternGeometryLabelV1, ChartPatternGeometryPointV1, ChartPatternGeometryV1,
    ChartPatternGeometryZoneV1, ChartPatternResultDetailsV1, ChartPatternZoneRoleV1, EodBarV1,
    RustScannerEvaluationRequestV1, RustScannerEvaluationResponseV1, RustScannerProgressEventV1,
    ScannerDirectionV1, ScannerResultHistoryV1, ScannerResultV1, ScannerRunTargetV1,
    ScannerScalarValueV1, RUST_SCANNER_CONTRACT_VERSION,
};
use std::collections::BTreeMap;

pub const CHART_COMMON_GAP_SCANNER_ID: &str = "chart_common_gap";
pub const CHART_COMMON_GAP_SCANNER_NAME: &str = "Common Gap";
const MIN_COMMON_GAP_BARS: usize = 12;
const PRIOR_RANGE_BARS: usize = 10;
const MAX_RANGE_WIDTH_PCT: f64 = 12.0;
const MIN_GAP_PCT: f64 = 0.25;
const MAX_VOLUME_MULTIPLIER: f64 = 1.2;
const COMMON_GAP_CONFIDENCE: f64 = 45.0;
const HISTORY_ENDPOINT_START: usize = 20;
const MAX_HISTORY_WINDOW_BARS: usize = 260;
const HISTORY_PROGRESS_STEP: usize = 50;

fn gap_down_pct(today: &EodBarV1, previous: &EodBarV1) -> Option<f64> {
    if !today.open.is_finite() || !previous.low.is_finite() {
        return None;
    }
    if previous.low <= 0.0 || today.open >= previous.low {
        return None;
    }
    let pct = round_js((1.0 - today.open / previous.low) * 100.0, 2);
    if pct.is_finite() {
        Some(pct)
    } else {
        None
    }
}

fn prior_bars_range_bound(bars: &[EodBarV1]) -> bool {
    if bars.is_empty() {
        return false;
    }
    let mut highest = f64::NEG_INFINITY;
    let mut lowest = f64::INFINITY;
    for bar in bars {
        if !bar.high.is_finite() || !bar.low.is_finite() {
            return false;
        }
        highest = highest.max(bar.high);
        lowest = lowest.min(bar.low);
    }
    if highest <= 0.0 || lowest <= 0.0 {
        return false;
    }
    let midpoint = (highest + lowest) / 2.0;
    midpoint > 0.0 && (highest - lowest) / midpoint * 100.0 <= MAX_RANGE_WIDTH_PCT
}

pub fn detect_chart_common_gap(
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<ScannerResultV1> {
    if bars.len() < MIN_COMMON_GAP_BARS {
        return None;
    }
    let len = bars.len();
    let today = &bars[len - 1];
    let previous = &bars[len - 2];
    if !today.high.is_finite() || !today.low.is_finite() || !today.close.is_finite()
        || !today.volume.is_finite()
    {
        return None;
    }

    let up_pct = gap_up_pct(today, previous);
    let down_pct = gap_down_pct(today, previous);
    let gap_pct = up_pct.or(down_pct)?;
    if gap_pct < MIN_GAP_PCT {
        return None;
    }

    let prior_range = &bars[len - MIN_COMMON_GAP_BARS..len - 2];
    if !prior_bars_range_bound(prior_range) {
        return None;
    }
    let avg_volume = average_volume_excluding_current(bars, PRIOR_RANGE_BARS)?;
    if today.volume > avg_volume * MAX_VOLUME_MULTIPLIER {
        return None;
    }

    let is_up = up_pct.is_some();
    let gap_direction = if is_up { "up" } else { "down" };
    let mut values = BTreeMap::new();
    values.insert(
        "gap_direction".to_string(),
        Some(ScannerScalarValueV1::Text(gap_direction.to_string())),
    );
    values.insert("gap_pct".to_string(), Some(scalar_number_v1(gap_pct)));
    values.insert(
        "avg_volume_10".to_string(),
        if avg_volume != 0.0 {
            Some(scalar_number_v1(round_js(avg_volume, 0)))
        } else {
            None
        },
    );
    values.insert(
        "volume_ratio".to_string(),
        if avg_volume != 0.0 {
            Some(scalar_number_v1(round_js(today.volume / avg_volume, 2)))
        } else {
            None
        },
    );

    let (first_boundary, second_boundary) = if is_up {
        (previous.high, today.low)
    } else {
        (today.high, previous.low)
    };
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
            low: normalize_zero(first_boundary.min(second_boundary)),
            high: normalize_zero(first_boundary.max(second_boundary)),
            fill_opacity: None,
        }]),
        labels: Some(vec![ChartPatternGeometryLabelV1 {
            id: "pattern".to_string(),
            text: CHART_COMMON_GAP_SCANNER_NAME.to_string(),
            point: ChartPatternGeometryPointV1 {
                index: None,
                date: today.date.clone(),
                price: normalize_zero(today.close),
            },
        }]),
        target_projection: None,
    };
    let details = ChartPatternResultDetailsV1 {
        family: ChartPatternFamilyV1::Gap,
        confidence: COMMON_GAP_CONFIDENCE,
        pattern_start_date: Some(prior_range[0].date.clone()),
        pattern_end_date: today.date.clone(),
        breakout_level: None,
        support_level: None,
        resistance_level: None,
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
        scanner_id: CHART_COMMON_GAP_SCANNER_ID.to_string(),
        scanner_name: CHART_COMMON_GAP_SCANNER_NAME.to_string(),
        category_id: CHART_GAP_CATEGORY_ID.to_string(),
        category_name: CHART_GAP_CATEGORY_NAME.to_string(),
        date: today.date.clone(),
        matched: true,
        direction: Some(ScannerDirectionV1::Neutral),
        score: Some(COMMON_GAP_CONFIDENCE),
        reasons: Some(vec![format!(
            "Gap {gap_direction} occurred inside a range-bound 10-bar context"
        )]),
        values: Some(values),
        chart_pattern: Some(details),
        warnings: Some(Vec::new()),
        source: Some(CHART_PATTERN_SCANNER_SOURCE.to_string()),
        history: None,
        generated_at: generated_at.to_string(),
    })
}

pub fn evaluate_chart_common_gap_request_v1(
    request: &RustScannerEvaluationRequestV1,
) -> Result<RustScannerEvaluationResponseV1, String> {
    if request.contract_version != RUST_SCANNER_CONTRACT_VERSION {
        return Err(format!(
            "Unsupported scanner contract version: {}",
            request.contract_version
        ));
    }
    for scanner_id in &request.scanner_ids {
        if scanner_id != CHART_COMMON_GAP_SCANNER_ID {
            return Err(format!(
                "Unsupported scannerId for RSC-04 isolated Common Gap evaluator: {scanner_id}"
            ));
        }
    }

    let has_common_gap = !request.scanner_ids.is_empty();
    let generated_at = request
        .generated_at
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    let latest_results = if has_common_gap {
        detect_chart_common_gap(&request.target, &request.bars, &generated_at)
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    if !request.evaluate_history || !has_common_gap {
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

    let history_total = if request.bars.len() >= HISTORY_ENDPOINT_START {
        request.bars.len() - HISTORY_ENDPOINT_START + 1
    } else {
        0
    };
    let mut completed_groups: Vec<ScannerResultV1> = Vec::new();
    let mut active_group: Option<ScannerResultV1> = None;
    let mut progress_events: Vec<RustScannerProgressEventV1> = Vec::new();

    for end_index in HISTORY_ENDPOINT_START..=request.bars.len() {
        let window_start = end_index.saturating_sub(MAX_HISTORY_WINDOW_BARS);
        let endpoint_bars = &request.bars[window_start..end_index];
        match detect_chart_common_gap(&request.target, endpoint_bars, &generated_at) {
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
        let history_completed = end_index - HISTORY_ENDPOINT_START + 1;
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
    use crate::scanner_contract::parity_harness::assert_parity_fixture_bundle;

    const FIXTURE_JSON: &str =
        include_str!("../../src/features/scanner/fixtures/commonGapParityFixtures.v1.json");

    #[test]
    fn rsc_04_common_gap_maintains_eight_typescript_parity_scenarios() {
        assert_parity_fixture_bundle(
            FIXTURE_JSON,
            CHART_COMMON_GAP_SCANNER_ID,
            8,
            &["positive", "boundary", "negative", "historical"],
            evaluate_chart_common_gap_request_v1,
            |expected, actual, scenario| {
                assert_eq!(expected.request_id, actual.request_id, "{scenario}");
                assert_eq!(expected.latest_results.len(), actual.latest_results.len(), "{scenario}");
                assert_eq!(
                    expected.historical_results.len(),
                    actual.historical_results.len(),
                    "{scenario}"
                );
            },
        );
    }

    #[test]
    fn rsc_04_rejects_unmigrated_scanners_and_wrong_contract_versions() {
        let raw: serde_json::Value = serde_json::from_str(FIXTURE_JSON).expect("fixture JSON");
        let mut request: RustScannerEvaluationRequestV1 =
            serde_json::from_value(raw["scenarios"][0]["request"].clone()).expect("request");
        request.scanner_ids = vec!["chart_runaway_gap".to_string()];
        assert!(evaluate_chart_common_gap_request_v1(&request).is_err());
        request.scanner_ids = vec![CHART_COMMON_GAP_SCANNER_ID.to_string()];
        request.contract_version = "unsupported-v2".to_string();
        assert!(evaluate_chart_common_gap_request_v1(&request).is_err());
    }
}
