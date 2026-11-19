//! RSC-05: isolated Runaway Gap parity detector; no Tauri IPC or live dispatch.
use crate::scanner_breakaway_gap::{
    average_volume_excluding_current, format_js_number, gap_up_pct, normalize_zero, round_js,
    scalar_number_v1, CHART_GAP_CATEGORY_ID, CHART_GAP_CATEGORY_NAME,
    CHART_PATTERN_SCANNER_SOURCE,
};
use crate::scanner_contract::{
    sort_scanner_results_v1, ChartPatternFamilyV1, ChartPatternGeometryFamilyV1,
    ChartPatternGeometryLabelV1, ChartPatternGeometryPointV1, ChartPatternGeometryV1,
    ChartPatternGeometryZoneV1, ChartPatternResultDetailsV1, ChartPatternZoneRoleV1, EodBarV1,
    RustScannerEvaluationRequestV1, RustScannerEvaluationResponseV1, RustScannerProgressEventV1,
    ScannerDirectionV1, ScannerResultHistoryV1, ScannerResultV1, ScannerRunTargetV1,
    RUST_SCANNER_CONTRACT_VERSION,
};
use std::collections::BTreeMap;

pub const CHART_RUNAWAY_GAP_SCANNER_ID: &str = "chart_runaway_gap";
pub const CHART_RUNAWAY_GAP_SCANNER_NAME: &str = "Runaway Gap";
const MIN_RUNAWAY_BARS: usize = 22;
const TREND_BARS: usize = 20;
const MIN_GAP_PCT: f64 = 0.25;
const MIN_UPTREND_PCT: f64 = 8.0;
const HIGH_VOLUME_MULTIPLIER: f64 = 1.2;
const HIGH_VOLUME_SCORE: f64 = 75.0;
const BASE_SCORE: f64 = 68.0;
const HISTORY_ENDPOINT_START: usize = 20;
const MAX_HISTORY_WINDOW_BARS: usize = 260;
const HISTORY_PROGRESS_STEP: usize = 50;

fn move_pct(bars: &[EodBarV1]) -> f64 {
    if bars.len() < 2 || bars[0].close <= 0.0 {
        return 0.0;
    }
    (bars[bars.len() - 1].close / bars[0].close - 1.0) * 100.0
}

pub fn detect_chart_runaway_gap(
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<ScannerResultV1> {
    if bars.len() < MIN_RUNAWAY_BARS {
        return None;
    }
    let len = bars.len();
    let previous = &bars[len - 2];
    let today = &bars[len - 1];
    if !today.low.is_finite()
        || !today.close.is_finite()
        || !today.volume.is_finite()
        || !previous.high.is_finite()
    {
        return None;
    }

    let gap_pct = gap_up_pct(today, previous)?;
    if gap_pct < MIN_GAP_PCT {
        return None;
    }
    let trend_bars = &bars[len - MIN_RUNAWAY_BARS..len - 2];
    let trend_move_pct = move_pct(trend_bars);
    if !trend_move_pct.is_finite()
        || trend_bars[0].close <= 0.0
        || trend_move_pct < MIN_UPTREND_PCT
    {
        return None;
    }
    if today.low < previous.high || today.close <= today.open {
        return None;
    }
    let avg_volume = average_volume_excluding_current(bars, TREND_BARS)?;
    let has_volume = avg_volume != 0.0;
    let confidence = if has_volume && today.volume >= avg_volume * HIGH_VOLUME_MULTIPLIER {
        HIGH_VOLUME_SCORE
    } else {
        BASE_SCORE
    };

    let mut values = BTreeMap::new();
    values.insert("gap_pct".to_string(), Some(scalar_number_v1(gap_pct)));
    values.insert(
        "trend_move_pct".to_string(),
        Some(scalar_number_v1(round_js(trend_move_pct, 2))),
    );
    values.insert(
        "avg_volume_20".to_string(),
        if has_volume {
            Some(scalar_number_v1(round_js(avg_volume, 0)))
        } else {
            None
        },
    );
    values.insert(
        "volume_ratio".to_string(),
        if has_volume {
            Some(scalar_number_v1(round_js(today.volume / avg_volume, 2)))
        } else {
            None
        },
    );

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
            low: normalize_zero(previous.high.min(today.low)),
            high: normalize_zero(previous.high.max(today.low)),
            fill_opacity: None,
        }]),
        labels: Some(vec![ChartPatternGeometryLabelV1 {
            id: "pattern".to_string(),
            text: CHART_RUNAWAY_GAP_SCANNER_NAME.to_string(),
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
        confidence,
        pattern_start_date: Some(trend_bars[0].date.clone()),
        pattern_end_date: today.date.clone(),
        breakout_level: Some(normalize_zero(previous.high)),
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
        scanner_id: CHART_RUNAWAY_GAP_SCANNER_ID.to_string(),
        scanner_name: CHART_RUNAWAY_GAP_SCANNER_NAME.to_string(),
        category_id: CHART_GAP_CATEGORY_ID.to_string(),
        category_name: CHART_GAP_CATEGORY_NAME.to_string(),
        date: today.date.clone(),
        matched: true,
        direction: Some(ScannerDirectionV1::Bullish),
        score: Some(confidence),
        reasons: Some(vec![format!(
            "Gap held above yesterday high ({}) after a {}% prior uptrend",
            format_js_number(previous.high),
            format_js_number(round_js(trend_move_pct, 2))
        )]),
        values: Some(values),
        chart_pattern: Some(details),
        warnings: Some(Vec::new()),
        source: Some(CHART_PATTERN_SCANNER_SOURCE.to_string()),
        history: None,
        generated_at: generated_at.to_string(),
    })
}

pub fn evaluate_chart_runaway_gap_request_v1(
    request: &RustScannerEvaluationRequestV1,
) -> Result<RustScannerEvaluationResponseV1, String> {
    if request.contract_version != RUST_SCANNER_CONTRACT_VERSION {
        return Err(format!(
            "Unsupported scanner contract version: {}",
            request.contract_version
        ));
    }
    for scanner_id in &request.scanner_ids {
        if scanner_id != CHART_RUNAWAY_GAP_SCANNER_ID {
            return Err(format!(
                "Unsupported scannerId for RSC-05 isolated Runaway Gap evaluator: {scanner_id}"
            ));
        }
    }

    let has_runaway_gap = !request.scanner_ids.is_empty();
    let generated_at = request
        .generated_at
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    let latest_results = if has_runaway_gap {
        detect_chart_runaway_gap(&request.target, &request.bars, &generated_at)
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    if !request.evaluate_history || !has_runaway_gap {
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
        match detect_chart_runaway_gap(&request.target, endpoint_bars, &generated_at) {
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
        include_str!("../../src/features/scanner/fixtures/runawayGapParityFixtures.v1.json");

    #[test]
    fn rsc_05_runaway_gap_matches_typescript_fixtures() {
        assert_parity_fixture_bundle(
            FIXTURE_JSON,
            CHART_RUNAWAY_GAP_SCANNER_ID,
            11,
            &["positive", "boundary", "negative", "historical"],
            evaluate_chart_runaway_gap_request_v1,
            |expected, actual, scenario| {
                assert_eq!(expected.request_id, actual.request_id, "{scenario}");
                assert_eq!(
                    expected.latest_results.len(),
                    actual.latest_results.len(),
                    "{scenario}"
                );
                assert_eq!(
                    expected.historical_results.len(),
                    actual.historical_results.len(),
                    "{scenario}"
                );
            },
        );
    }

    #[test]
    fn rsc_05_rejects_unmigrated_scanners_and_wrong_contract() {
        let raw: serde_json::Value = serde_json::from_str(FIXTURE_JSON).expect("fixture JSON");
        let mut request: RustScannerEvaluationRequestV1 =
            serde_json::from_value(raw["scenarios"][0]["request"].clone()).expect("request");
        request.scanner_ids = vec!["chart_exhaustion_gap".to_string()];
        assert!(evaluate_chart_runaway_gap_request_v1(&request).is_err());
        request.scanner_ids = vec![CHART_RUNAWAY_GAP_SCANNER_ID.to_string()];
        request.contract_version = "unsupported-v2".to_string();
        assert!(evaluate_chart_runaway_gap_request_v1(&request).is_err());
    }
}
