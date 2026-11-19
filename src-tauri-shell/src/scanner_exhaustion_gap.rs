//! RSC-06: isolated Exhaustion Gap parity detector; no Tauri IPC or live dispatch.
use crate::scanner_breakaway_gap::{
    average_volume_excluding_current, format_js_number, gap_up_pct, normalize_zero, round_js,
    scalar_number_v1, CHART_GAP_CATEGORY_ID, CHART_GAP_CATEGORY_NAME, CHART_PATTERN_SCANNER_SOURCE,
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

pub const CHART_EXHAUSTION_GAP_SCANNER_ID: &str = "chart_exhaustion_gap";
pub const CHART_EXHAUSTION_GAP_SCANNER_NAME: &str = "Exhaustion Gap";
const MIN_EXHAUSTION_BARS: usize = 22;
const TREND_BARS: usize = 20;
const MIN_GAP_PCT: f64 = 0.25;
const MIN_UPTREND_PCT: f64 = 12.0;
const VOLUME_SPIKE_MULTIPLIER: f64 = 2.0;
const EXHAUSTION_CONFIDENCE: f64 = 70.0;
const HISTORY_ENDPOINT_START: usize = 20;
const MAX_HISTORY_WINDOW_BARS: usize = 260;
const HISTORY_PROGRESS_STEP: usize = 50;

fn move_pct(bars: &[EodBarV1]) -> f64 {
    if bars.len() < 2 || bars[0].close <= 0.0 {
        return 0.0;
    }
    (bars[bars.len() - 1].close / bars[0].close - 1.0) * 100.0
}

pub fn detect_chart_exhaustion_gap(
    target: &ScannerRunTargetV1,
    bars: &[EodBarV1],
    generated_at: &str,
) -> Option<ScannerResultV1> {
    if bars.len() < MIN_EXHAUSTION_BARS {
        return None;
    }
    let len = bars.len();
    let previous = &bars[len - 2];
    let today = &bars[len - 1];
    if !today.open.is_finite()
        || !today.high.is_finite()
        || !today.low.is_finite()
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

    let trend_bars = &bars[len - MIN_EXHAUSTION_BARS..len - 2];
    let trend_move_pct = move_pct(trend_bars);
    if !trend_move_pct.is_finite()
        || !trend_bars[0].close.is_finite()
        || trend_bars[0].close <= 0.0
        || trend_move_pct < MIN_UPTREND_PCT
    {
        return None;
    }

    let avg_volume = average_volume_excluding_current(bars, TREND_BARS)?;
    if avg_volume <= 0.0 || today.volume < avg_volume * VOLUME_SPIKE_MULTIPLIER {
        return None;
    }
    if today.close >= today.open {
        return None;
    }

    let trend_move_rounded = round_js(trend_move_pct, 2);
    let volume_ratio = today.volume / avg_volume;
    if !trend_move_rounded.is_finite() || !volume_ratio.is_finite() {
        return None;
    }

    let mut values = BTreeMap::new();
    values.insert("gap_pct".to_string(), Some(scalar_number_v1(gap_pct)));
    values.insert(
        "trend_move_pct".to_string(),
        Some(scalar_number_v1(trend_move_rounded)),
    );
    values.insert(
        "avg_volume_20".to_string(),
        Some(scalar_number_v1(round_js(avg_volume, 0))),
    );
    values.insert(
        "volume_ratio".to_string(),
        Some(scalar_number_v1(round_js(volume_ratio, 2))),
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
            text: CHART_EXHAUSTION_GAP_SCANNER_NAME.to_string(),
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
        confidence: EXHAUSTION_CONFIDENCE,
        pattern_start_date: Some(trend_bars[0].date.clone()),
        pattern_end_date: today.date.clone(),
        breakout_level: None,
        support_level: None,
        resistance_level: Some(normalize_zero(today.high)),
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
        scanner_id: CHART_EXHAUSTION_GAP_SCANNER_ID.to_string(),
        scanner_name: CHART_EXHAUSTION_GAP_SCANNER_NAME.to_string(),
        category_id: CHART_GAP_CATEGORY_ID.to_string(),
        category_name: CHART_GAP_CATEGORY_NAME.to_string(),
        date: today.date.clone(),
        matched: true,
        direction: Some(ScannerDirectionV1::Bearish),
        score: Some(EXHAUSTION_CONFIDENCE),
        reasons: Some(vec![format!(
            "High-volume gap up after a {}% prior uptrend closed with bearish rejection",
            format_js_number(trend_move_rounded)
        )]),
        values: Some(values),
        chart_pattern: Some(details),
        warnings: Some(Vec::new()),
        source: Some(CHART_PATTERN_SCANNER_SOURCE.to_string()),
        history: None,
        generated_at: generated_at.to_string(),
    })
}

pub fn evaluate_chart_exhaustion_gap_request_v1(
    request: &RustScannerEvaluationRequestV1,
) -> Result<RustScannerEvaluationResponseV1, String> {
    evaluate_chart_exhaustion_gap_request_with_cancel(request, || false)
}

fn evaluate_chart_exhaustion_gap_request_with_cancel<F>(
    request: &RustScannerEvaluationRequestV1,
    mut should_cancel: F,
) -> Result<RustScannerEvaluationResponseV1, String>
where
    F: FnMut() -> bool,
{
    if request.contract_version != RUST_SCANNER_CONTRACT_VERSION {
        return Err(format!(
            "Unsupported scanner contract version: {}",
            request.contract_version
        ));
    }
    for scanner_id in &request.scanner_ids {
        if scanner_id != CHART_EXHAUSTION_GAP_SCANNER_ID {
            return Err(format!(
                "Unsupported scannerId for RSC-06 isolated Exhaustion Gap evaluator: {scanner_id}"
            ));
        }
    }

    let has_exhaustion_gap = !request.scanner_ids.is_empty();
    let generated_at = request
        .generated_at
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    let latest_results = if has_exhaustion_gap {
        detect_chart_exhaustion_gap(&request.target, &request.bars, &generated_at)
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    if !request.evaluate_history || !has_exhaustion_gap {
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
        if should_cancel() {
            if let Some(remaining) = active_group.take() {
                completed_groups.push(remaining);
            }
            let mut results = completed_groups.clone();
            sort_scanner_results_v1(&mut results);
            return Ok(RustScannerEvaluationResponseV1 {
                contract_version: request.contract_version.clone(),
                request_id: request.request_id.clone(),
                target: request.target.clone(),
                latest_results,
                historical_results: completed_groups,
                results,
                scanned_bars: request.bars.len(),
                cancelled: true,
                errors: Vec::new(),
                progress_events: if progress_events.is_empty() {
                    None
                } else {
                    Some(progress_events)
                },
            });
        }
        let window_start = end_index.saturating_sub(MAX_HISTORY_WINDOW_BARS);
        let endpoint_bars = &request.bars[window_start..end_index];
        match detect_chart_exhaustion_gap(&request.target, endpoint_bars, &generated_at) {
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
        include_str!("../../src/features/scanner/fixtures/exhaustionGapParityFixtures.v1.json");

    #[test]
    fn rsc_06_exhaustion_gap_matches_typescript_fixtures() {
        assert_parity_fixture_bundle(
            FIXTURE_JSON,
            CHART_EXHAUSTION_GAP_SCANNER_ID,
            17,
            &["positive", "boundary", "negative", "historical"],
            evaluate_chart_exhaustion_gap_request_v1,
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
    fn rsc_06_rejects_unmigrated_scanners_and_wrong_contract() {
        let raw: serde_json::Value = serde_json::from_str(FIXTURE_JSON).expect("fixture JSON");
        let mut request: RustScannerEvaluationRequestV1 =
            serde_json::from_value(raw["scenarios"][0]["request"].clone()).expect("request");
        for bad_id in [
            "chart_runaway_gap",
            "chart_breakaway_gap",
            "unknown_scanner",
        ] {
            request.scanner_ids = vec![bad_id.to_string()];
            assert!(evaluate_chart_exhaustion_gap_request_v1(&request).is_err());
        }
        request.scanner_ids = vec![CHART_EXHAUSTION_GAP_SCANNER_ID.to_string()];
        request.contract_version = "unsupported-v2".to_string();
        assert!(evaluate_chart_exhaustion_gap_request_v1(&request).is_err());
    }

    #[test]
    fn rsc_06_direct_edge_cases_generated_at_fallback_and_cancellation() {
        let raw: serde_json::Value = serde_json::from_str(FIXTURE_JSON).expect("fixture JSON");
        let base_request: RustScannerEvaluationRequestV1 =
            serde_json::from_value(raw["scenarios"][0]["request"].clone()).expect("request");
        let target = &base_request.target;

        assert!(detect_chart_exhaustion_gap(target, &[], "2026-11-20T00:00:00.000Z").is_none());
        assert!(detect_chart_exhaustion_gap(
            target,
            &base_request.bars[..1],
            "2026-11-20T00:00:00.000Z"
        )
        .is_none());

        let mut bad_bars = base_request.bars.clone();
        bad_bars[21].open = f64::NAN;
        assert!(
            detect_chart_exhaustion_gap(target, &bad_bars, "2026-11-20T00:00:00.000Z").is_none()
        );

        bad_bars = base_request.bars.clone();
        bad_bars[21].volume = f64::INFINITY;
        assert!(
            detect_chart_exhaustion_gap(target, &bad_bars, "2026-11-20T00:00:00.000Z").is_none()
        );

        bad_bars = base_request.bars.clone();
        bad_bars[10].volume = f64::NAN;
        assert!(
            detect_chart_exhaustion_gap(target, &bad_bars, "2026-11-20T00:00:00.000Z").is_none()
        );

        bad_bars = base_request.bars.clone();
        bad_bars[20].high = 0.0;
        assert!(
            detect_chart_exhaustion_gap(target, &bad_bars, "2026-11-20T00:00:00.000Z").is_none()
        );

        bad_bars = base_request.bars.clone();
        bad_bars[0].close = 0.0;
        assert!(
            detect_chart_exhaustion_gap(target, &bad_bars, "2026-11-20T00:00:00.000Z").is_none()
        );

        for fallback in [None, Some(String::new())] {
            let mut req = base_request.clone();
            req.generated_at = fallback;
            let resp = evaluate_chart_exhaustion_gap_request_v1(&req)
                .expect("generatedAt fallback must succeed");
            assert_eq!(resp.latest_results.len(), 1);
            let ts = &resp.latest_results[0].generated_at;
            assert!(ts.len() == 24 && ts.ends_with('Z'));
        }

        let grouped_scenario = raw["scenarios"]
            .as_array()
            .expect("scenarios array")
            .iter()
            .find(|item| item["id"] == "historical_grouped_episodes_and_progress")
            .expect("grouped scenario");
        let grouped_req: RustScannerEvaluationRequestV1 =
            serde_json::from_value(grouped_scenario["request"].clone()).expect("grouped request");
        // Cancel at end_index = 25 (6th iteration: end_index 20,21,22,23,24 ran; 24 matched!)
        let mut checks = 0usize;
        let cancelled_resp =
            evaluate_chart_exhaustion_gap_request_with_cancel(&grouped_req, || {
                checks += 1;
                checks >= 6
            })
            .expect("cancelled evaluation must succeed");
        assert!(cancelled_resp.cancelled);
        assert_eq!(cancelled_resp.historical_results.len(), 1);
        let partial_history = cancelled_resp.historical_results[0]
            .history
            .as_ref()
            .expect("partial history must be preserved");
        assert_eq!(partial_history.match_count, 1);
        assert_eq!(cancelled_resp.results, cancelled_resp.historical_results);
    }

    #[test]
    fn rsc_06_cancellation_dedup_progress_boundaries_and_scientific_parity() {
        let raw: serde_json::Value = serde_json::from_str(FIXTURE_JSON).expect("fixture JSON");
        let base_request: RustScannerEvaluationRequestV1 =
            serde_json::from_value(raw["scenarios"][0]["request"].clone()).expect("request");
        let target = &base_request.target;

        // Duplicate scannerIds must deduplicate identically to TypeScript Set(scannerIds).
        let mut dup_req = base_request.clone();
        dup_req.scanner_ids = vec![
            CHART_EXHAUSTION_GAP_SCANNER_ID.to_string(),
            CHART_EXHAUSTION_GAP_SCANNER_ID.to_string(),
        ];
        let dup_resp = evaluate_chart_exhaustion_gap_request_v1(&dup_req)
            .expect("duplicate scannerIds must deduplicate");
        assert_eq!(dup_resp.latest_results.len(), 1);
        assert_eq!(dup_resp.results.len(), 1);

        // Non-empty whitespace generatedAt is preserved verbatim (matches JS truthiness).
        let mut ws_req = base_request.clone();
        ws_req.generated_at = Some("   ".to_string());
        let ws_resp = evaluate_chart_exhaustion_gap_request_v1(&ws_req)
            .expect("whitespace generatedAt must succeed");
        assert_eq!(ws_resp.latest_results[0].generated_at, "   ");

        // Negative previous.high fails; negative-zero today.low/close normalize to +0.0.
        let mut neg_prev = base_request.bars.clone();
        neg_prev[20].high = -10.0;
        assert!(
            detect_chart_exhaustion_gap(target, &neg_prev, "2026-11-20T00:00:00.000Z").is_none()
        );

        let mut neg_zero = base_request.bars.clone();
        neg_zero[21].low = -0.0;
        neg_zero[21].close = -0.0;
        let nz_res = detect_chart_exhaustion_gap(target, &neg_zero, "2026-11-20T00:00:00.000Z")
            .expect("negative-zero close/low must match");
        let nz_geom = nz_res
            .chart_pattern
            .as_ref()
            .and_then(|cp| cp.geometry.as_ref())
            .expect("geometry present");
        let nz_low = nz_geom.zones.as_ref().unwrap()[0].low;
        let nz_price = nz_geom.labels.as_ref().unwrap()[0].point.price;
        assert_eq!(nz_low, 0.0);
        assert!(!nz_low.is_sign_negative());
        assert_eq!(nz_price, 0.0);
        assert!(!nz_price.is_sign_negative());

        // Scientific-notation threshold parity at 1e20 vs >= 1e21.
        let mut big_20 = base_request.bars.clone();
        big_20[0].close = 1.0;
        big_20[19].close = 1e19;
        big_20[20].high = 1e19;
        big_20[21].open = 1.1e19;
        big_20[21].high = 1.2e19;
        big_20[21].low = 1.05e19;
        big_20[21].close = 1.08e19;
        let res_20 = detect_chart_exhaustion_gap(target, &big_20, "2026-11-20T00:00:00.000Z")
            .expect("1e20 trend must match");
        assert!(res_20.reasons.as_ref().unwrap()[0].contains("999999999999999900000%"));

        let mut big_22 = big_20;
        big_22[19].close = 1e20;
        let res_22 = detect_chart_exhaustion_gap(target, &big_22, "2026-11-20T00:00:00.000Z")
            .expect("1e22 trend must match");
        assert!(res_22.reasons.as_ref().unwrap()[0].contains("1e+22%"));

        // Exact 20-bar history (history_total=1) and 69-bar history (history_total=50, single event).
        let mut h20_req = base_request.clone();
        h20_req.bars = base_request.bars[..20].to_vec();
        h20_req.evaluate_history = true;
        let h20_resp = evaluate_chart_exhaustion_gap_request_v1(&h20_req)
            .expect("20-bar history must succeed");
        let h20_prog = h20_resp.progress_events.expect("20-bar emits 1 progress");
        assert_eq!(h20_prog.len(), 1);
        assert_eq!(h20_prog[0].history_completed, Some(1));
        assert_eq!(h20_prog[0].history_total, Some(1));
        assert_eq!(h20_prog[0].result_count, Some(0));

        let flat_69: Vec<EodBarV1> = (0..69)
            .map(|idx| EodBarV1 {
                symbol: "TCS".to_string(),
                date: format!("2025-01-{:02}", (idx % 28) + 1),
                open: 100.0,
                high: 101.0,
                low: 99.0,
                close: 100.0,
                volume: 1000.0,
            })
            .collect();
        let h69_req = RustScannerEvaluationRequestV1 {
            bars: flat_69,
            evaluate_history: true,
            ..base_request
        };
        let h69_resp = evaluate_chart_exhaustion_gap_request_v1(&h69_req)
            .expect("69-bar history must succeed");
        let h69_prog = h69_resp.progress_events.expect("69-bar emits progress");
        assert_eq!(h69_prog.len(), 1);
        assert_eq!(h69_prog[0].history_completed, Some(50));
        assert_eq!(h69_prog[0].history_total, Some(50));

        // Cancel after step 50 & 2 episodes: preserves progress event and descending results order.
        let grouped_scenario = raw["scenarios"]
            .as_array()
            .expect("scenarios array")
            .iter()
            .find(|item| item["id"] == "historical_grouped_episodes_and_progress")
            .expect("grouped scenario");
        let grouped_req: RustScannerEvaluationRequestV1 =
            serde_json::from_value(grouped_scenario["request"].clone()).expect("grouped request");
        let mut checks_52 = 0usize;
        let resp_52 = evaluate_chart_exhaustion_gap_request_with_cancel(&grouped_req, || {
            checks_52 += 1;
            checks_52 >= 52
        })
        .expect("mid-scan cancel after step 50 must succeed");
        assert!(resp_52.cancelled);
        assert_eq!(resp_52.historical_results.len(), 2);
        assert_eq!(resp_52.historical_results[0].date, "2025-01-24");
        assert_eq!(
            resp_52.historical_results[0]
                .history
                .as_ref()
                .unwrap()
                .match_count,
            2
        );
        assert_eq!(resp_52.historical_results[1].date, "2025-03-01");
        assert_eq!(resp_52.results[0].date, "2025-03-01");
        assert_eq!(resp_52.results[1].date, "2025-01-24");
        let cancel_prog = resp_52
            .progress_events
            .expect("progress before cancel preserved");
        assert_eq!(cancel_prog.len(), 1);
        assert_eq!(cancel_prog[0].history_completed, Some(50));
        assert_eq!(cancel_prog[0].history_total, Some(56));
        assert_eq!(cancel_prog[0].result_count, Some(2));

        // Cancel on first history iteration keeps latest_results and leaves history empty.
        let window_scenario = raw["scenarios"]
            .as_array()
            .expect("scenarios array")
            .iter()
            .find(|item| item["id"] == "historical_275_bars_260_window")
            .expect("window scenario");
        let window_req: RustScannerEvaluationRequestV1 =
            serde_json::from_value(window_scenario["request"].clone()).expect("window request");
        let mut checks_1 = 0usize;
        let resp_1 = evaluate_chart_exhaustion_gap_request_with_cancel(&window_req, || {
            checks_1 += 1;
            checks_1 >= 1
        })
        .expect("iteration-1 cancel must succeed");
        assert!(resp_1.cancelled);
        assert_eq!(resp_1.latest_results.len(), 1);
        assert!(resp_1.historical_results.is_empty());
        assert!(resp_1.results.is_empty());
        assert!(resp_1.progress_events.is_none());
    }
}
