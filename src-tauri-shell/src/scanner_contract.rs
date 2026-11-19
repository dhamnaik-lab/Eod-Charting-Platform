use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const RUST_SCANNER_CONTRACT_VERSION: &str = "eod-scanner-contract-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScannerDirectionV1 {
    Bullish,
    Bearish,
    Neutral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScannerExecutionModeV1 {
    Responsive,
    Fast,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChartPatternFamilyV1 {
    Gap,
    Reversal,
    Continuation,
    NeutralBilateral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChartPatternFixtureFamilyCoverageV1 {
    Gap,
    Reversal,
    Continuation,
    NeutralBilateral,
    Mixed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChartPatternPivotKindV1 {
    High,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChartPatternMarkerKindV1 {
    High,
    Low,
    Neutral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChartPatternMarkerRoleV1 {
    Swing,
    Breakout,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChartPatternTrendLineRoleV1 {
    Upper,
    Lower,
    Neckline,
    Support,
    Resistance,
    Pole,
    Midline,
    Generic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChartPatternZoneRoleV1 {
    PatternSpan,
    Gap,
    Island,
    Base,
    Breakout,
    Generic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChartPatternGeometryFamilyV1 {
    Triangle,
    Wedge,
    Channel,
    HeadAndShoulders,
    DoubleTopBottom,
    TripleTopBottom,
    Flag,
    Pennant,
    CupHandle,
    GapZone,
    VReversal,
    Horn,
    BumpAndRun,
    BlowOff,
    Diamond,
    Broadening,
    ComplexHeadAndShoulders,
    Rounding,
    AdamEve,
    ScallopHandle,
    ThreePivot,
    MeasuredMove,
    Range,
    Coil,
    HighTightFlag,
    CandleContinuation,
    Generic,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ScannerScalarValueV1 {
    Bool(bool),
    Integer(i64),
    Float(f64),
    Text(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EodBarV1 {
    pub symbol: String,
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScannerRunTargetV1 {
    pub symbol: String,
    pub exchange: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternPivotV1 {
    pub index: usize,
    pub date: String,
    pub price: f64,
    pub kind: ChartPatternPivotKindV1,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryPointV1 {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
    pub date: String,
    pub price: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryPivotMarkerV1 {
    pub id: String,
    pub label: String,
    pub kind: ChartPatternMarkerKindV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<ChartPatternMarkerRoleV1>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
    pub date: String,
    pub price: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryTrendLineV1 {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub role: ChartPatternTrendLineRoleV1,
    pub start: ChartPatternGeometryPointV1,
    pub end: ChartPatternGeometryPointV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extend_right: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryZoneV1 {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub role: ChartPatternZoneRoleV1,
    pub start_date: String,
    pub end_date: String,
    pub low: f64,
    pub high: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill_opacity: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryLabelV1 {
    pub id: String,
    pub text: String,
    pub point: ChartPatternGeometryPointV1,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternTargetProjectionV1 {
    pub breakout_price: f64,
    pub target_price: f64,
    pub stop_loss_price: f64,
    pub pattern_height: f64,
    pub potential_gain_pct: f64,
    pub risk_reward_ratio: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub projection_line: Option<ChartPatternGeometryTrendLineV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternGeometryV1 {
    pub family: ChartPatternGeometryFamilyV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pivot_markers: Option<Vec<ChartPatternGeometryPivotMarkerV1>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trend_lines: Option<Vec<ChartPatternGeometryTrendLineV1>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zones: Option<Vec<ChartPatternGeometryZoneV1>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<ChartPatternGeometryLabelV1>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_projection: Option<ChartPatternTargetProjectionV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartPatternResultDetailsV1 {
    pub family: ChartPatternFamilyV1,
    pub confidence: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern_start_date: Option<String>,
    pub pattern_end_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breakout_level: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub support_level: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resistance_level: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub neckline_level: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop_loss_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub potential_gain_pct: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk_reward_ratio: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pivots: Option<Vec<ChartPatternPivotV1>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub geometry: Option<ChartPatternGeometryV1>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScannerResultHistoryV1 {
    pub first_matched_date: String,
    pub last_matched_date: String,
    pub match_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScannerResultV1 {
    pub symbol: String,
    pub exchange: String,
    pub scanner_id: String,
    pub scanner_name: String,
    pub category_id: String,
    pub category_name: String,
    pub date: String,
    pub matched: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub direction: Option<ScannerDirectionV1>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasons: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub values: Option<BTreeMap<String, Option<ScannerScalarValueV1>>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chart_pattern: Option<ChartPatternResultDetailsV1>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history: Option<ScannerResultHistoryV1>,
    pub generated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerEvaluationRequestV1 {
    pub contract_version: String,
    pub request_id: String,
    pub target: ScannerRunTargetV1,
    pub bars: Vec<EodBarV1>,
    pub scanner_ids: Vec<String>,
    pub lookback_bars: Option<usize>,
    pub evaluate_history: bool,
    pub execution_mode: ScannerExecutionModeV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerProgressEventV1 {
    pub contract_version: String,
    pub request_id: String,
    pub completed: usize,
    pub total: usize,
    pub symbol: String,
    pub exchange: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history_completed: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history_total: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_count: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerCancelRequestV1 {
    pub contract_version: String,
    pub request_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerEvaluationResponseV1 {
    pub contract_version: String,
    pub request_id: String,
    pub target: ScannerRunTargetV1,
    pub latest_results: Vec<ScannerResultV1>,
    pub historical_results: Vec<ScannerResultV1>,
    pub results: Vec<ScannerResultV1>,
    pub scanned_bars: usize,
    pub cancelled: bool,
    pub errors: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress_events: Option<Vec<RustScannerProgressEventV1>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerContractFixtureScenarioV1 {
    pub id: String,
    pub description: String,
    pub family_coverage: ChartPatternFixtureFamilyCoverageV1,
    pub engine_derived: bool,
    pub request: RustScannerEvaluationRequestV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancel_request: Option<RustScannerCancelRequestV1>,
    pub response: RustScannerEvaluationResponseV1,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RustScannerContractFixtureBundleV1 {
    pub contract_version: String,
    pub fixed_generated_at: String,
    pub scenarios: Vec<RustScannerContractFixtureScenarioV1>,
    pub ordered_results_sample: Vec<ScannerResultV1>,
}

pub fn sort_scanner_results_v1(results: &mut [ScannerResultV1]) {
    results.sort_by(|first, second| {
        second
            .date
            .cmp(&first.date)
            .then_with(|| first.scanner_name.cmp(&second.scanner_name))
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE_JSON: &str =
        include_str!("../../src/features/scanner/fixtures/rustScannerContractFixtures.v1.json");

    fn assert_json_semantically_equal(
        expected: &serde_json::Value,
        actual: &serde_json::Value,
        path: &str,
    ) {
        match (expected, actual) {
            (serde_json::Value::Null, serde_json::Value::Null) => {}
            (serde_json::Value::Bool(a), serde_json::Value::Bool(b)) => {
                assert_eq!(a, b, "boolean mismatch at {path}");
            }
            (serde_json::Value::String(a), serde_json::Value::String(b)) => {
                assert_eq!(a, b, "string mismatch at {path}");
            }
            (serde_json::Value::Number(a), serde_json::Value::Number(b)) => {
                if let (Some(ai), Some(bi)) = (a.as_i64(), b.as_i64()) {
                    assert_eq!(ai, bi, "integer mismatch at {path}");
                } else if let (Some(au), Some(bu)) = (a.as_u64(), b.as_u64()) {
                    assert_eq!(au, bu, "unsigned integer mismatch at {path}");
                } else {
                    let af = a.as_f64().expect("expected number should convert to f64");
                    let bf = b.as_f64().expect("actual number should convert to f64");
                    assert!(
                        (af - bf).abs() <= 1e-12,
                        "float mismatch at {path}: expected {af}, got {bf}"
                    );
                }
            }
            (serde_json::Value::Array(a), serde_json::Value::Array(b)) => {
                assert_eq!(
                    a.len(),
                    b.len(),
                    "array length mismatch at {path}: expected {}, got {}",
                    a.len(),
                    b.len()
                );
                for (idx, (ea, eb)) in a.iter().zip(b.iter()).enumerate() {
                    assert_json_semantically_equal(ea, eb, &format!("{path}[{idx}]"));
                }
            }
            (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                let mut keys_a: Vec<&str> = a.keys().map(String::as_str).collect();
                let mut keys_b: Vec<&str> = b.keys().map(String::as_str).collect();
                keys_a.sort_unstable();
                keys_b.sort_unstable();
                assert_eq!(keys_a, keys_b, "object keys mismatch at {path}");
                for key in keys_a {
                    assert_json_semantically_equal(&a[key], &b[key], &format!("{path}.{key}"));
                }
            }
            _ => panic!("type mismatch at {path}: expected {expected:?}, got {actual:?}"),
        }
    }

    #[test]
    fn rsc_01_scanner_contract_deserializes_typescript_fixture_bundle_and_round_trips() {
        let bundle: RustScannerContractFixtureBundleV1 =
            serde_json::from_str(FIXTURE_JSON).expect("TypeScript fixture JSON must deserialize");
        assert_eq!(bundle.contract_version, RUST_SCANNER_CONTRACT_VERSION);

        let serialized =
            serde_json::to_string(&bundle).expect("Rust contract bundle must serialize");
        let round_tripped: RustScannerContractFixtureBundleV1 =
            serde_json::from_str(&serialized).expect("Serialized bundle must deserialize");
        assert_eq!(round_tripped, bundle);

        let raw_value: serde_json::Value =
            serde_json::from_str(FIXTURE_JSON).expect("Raw fixture JSON must parse as Value");
        let round_tripped_value: serde_json::Value =
            serde_json::from_str(&serialized).expect("Round-tripped JSON must parse as Value");
        assert_json_semantically_equal(&raw_value, &round_tripped_value, "$");
    }

    #[test]
    fn rsc_01_scanner_contract_covers_all_pattern_families_history_and_optional_fields() {
        let bundle: RustScannerContractFixtureBundleV1 =
            serde_json::from_str(FIXTURE_JSON).expect("TypeScript fixture JSON must deserialize");

        assert_eq!(bundle.scenarios.len(), 5);
        let coverages: Vec<ChartPatternFixtureFamilyCoverageV1> = bundle
            .scenarios
            .iter()
            .map(|scenario| scenario.family_coverage)
            .collect();
        assert_eq!(
            coverages,
            vec![
                ChartPatternFixtureFamilyCoverageV1::Gap,
                ChartPatternFixtureFamilyCoverageV1::Reversal,
                ChartPatternFixtureFamilyCoverageV1::Continuation,
                ChartPatternFixtureFamilyCoverageV1::NeutralBilateral,
                ChartPatternFixtureFamilyCoverageV1::Mixed,
            ]
        );

        let history_scenario = bundle
            .scenarios
            .iter()
            .find(|scenario| scenario.id == "neutral_bilateral_range_history_match")
            .expect("history scenario must exist");
        assert!(history_scenario.request.lookback_bars.is_none());
        assert_eq!(history_scenario.response.historical_results.len(), 1);
        let history_entry = history_scenario.response.historical_results[0]
            .history
            .as_ref()
            .expect("historical result must include history summary");
        assert_eq!(history_entry.first_matched_date, "2027-02-21");
        assert_eq!(history_entry.last_matched_date, "2027-02-23");
        assert_eq!(history_entry.match_count, 3);
        let progress = history_scenario
            .response
            .progress_events
            .as_ref()
            .expect("history scenario must include progress events");
        assert_eq!(progress.len(), 1);
        assert_eq!(progress[0].history_completed, Some(4));
        assert_eq!(progress[0].history_total, Some(4));
        assert_eq!(progress[0].result_count, Some(1));

        let envelope_scenario = bundle
            .scenarios
            .iter()
            .find(|scenario| scenario.id == "nonmatch_and_cancelled_optional_envelope")
            .expect("optional envelope scenario must exist");
        assert!(!envelope_scenario.engine_derived);
        assert_eq!(
            envelope_scenario
                .cancel_request
                .as_ref()
                .map(|c| c.request_id.as_str()),
            Some("req-optional-envelope-005")
        );
        assert!(envelope_scenario.response.cancelled);

        let result = &envelope_scenario.response.results[0];
        assert!(!result.matched);
        assert_eq!(
            result.warnings.as_deref(),
            Some(&["Partial scan completed before cancellation".to_string()][..])
        );
        let values = result
            .values
            .as_ref()
            .expect("envelope result must include scalar values");
        assert_eq!(values.get("flag_active"), Some(&Some(ScannerScalarValueV1::Bool(true))));
        assert_eq!(
            values.get("gap_direction"),
            Some(&Some(ScannerScalarValueV1::Text("up".to_string())))
        );
        assert_eq!(values.get("touch_count"), Some(&Some(ScannerScalarValueV1::Integer(4))));
        assert_eq!(
            values.get("slope_ratio"),
            Some(&Some(ScannerScalarValueV1::Float(-0.375)))
        );
        assert_eq!(values.get("optional_metric"), Some(&None));

        let pattern = result
            .chart_pattern
            .as_ref()
            .expect("envelope result must include chartPattern details");
        assert_eq!(pattern.target_price, Some(1565.5));
        assert_eq!(pattern.stop_loss_price, Some(1479.75));
        assert_eq!(pattern.potential_gain_pct, Some(2.98));
        assert_eq!(pattern.risk_reward_ratio, Some(1.12));

        let geometry = pattern
            .geometry
            .as_ref()
            .expect("envelope details must include geometry");
        assert_eq!(geometry.family, ChartPatternGeometryFamilyV1::Generic);
        let markers = geometry
            .pivot_markers
            .as_ref()
            .expect("geometry must include pivot markers");
        assert_eq!(markers[0].kind, ChartPatternMarkerKindV1::Neutral);
        assert_eq!(markers[0].role, Some(ChartPatternMarkerRoleV1::Breakout));
        let projection = geometry
            .target_projection
            .as_ref()
            .expect("geometry must include target projection");
        assert!(projection.projection_line.is_some());
        assert!(geometry.trend_lines.is_some());
        assert!(geometry.zones.is_some());
        assert!(geometry.labels.is_some());
    }

    #[test]
    fn rsc_01_scanner_contract_preserves_canonical_result_ordering_and_rejects_unknown_fields() {
        let bundle: RustScannerContractFixtureBundleV1 =
            serde_json::from_str(FIXTURE_JSON).expect("TypeScript fixture JSON must deserialize");

        let expected = &bundle.ordered_results_sample;
        let mut reordered = vec![
            expected[4].clone(),
            expected[2].clone(),
            expected[0].clone(),
            expected[3].clone(),
            expected[1].clone(),
        ];
        sort_scanner_results_v1(&mut reordered);
        assert_eq!(&reordered, expected);

        let unknown_bar_json = r#"{
            "symbol": "ABC",
            "date": "2026-11-18",
            "open": 100,
            "high": 102,
            "low": 99,
            "close": 101,
            "volume": 1000,
            "unexpectedField": true
        }"#;
        assert!(serde_json::from_str::<EodBarV1>(unknown_bar_json).is_err());

        let unknown_result_json = r#"{
            "symbol": "ABC",
            "exchange": "NSE",
            "scannerId": "chart_breakaway_gap",
            "scannerName": "Breakaway Gap",
            "categoryId": "chart_patterns_gap",
            "categoryName": "Chart Patterns - Gaps",
            "date": "2026-11-18",
            "matched": true,
            "generatedAt": "2026-11-18T12:30:00.000Z",
            "unexpectedField": 123
        }"#;
        assert!(serde_json::from_str::<ScannerResultV1>(unknown_result_json).is_err());

        let nullable_request_json = r#"{
            "contractVersion": "eod-scanner-contract-v1",
            "requestId": "req-null-check",
            "target": { "symbol": "ABC", "exchange": "NSE", "name": null },
            "bars": [],
            "scannerIds": [],
            "lookbackBars": null,
            "evaluateHistory": false,
            "executionMode": "fast",
            "toDate": null
        }"#;
        let nullable_req: RustScannerEvaluationRequestV1 =
            serde_json::from_str(nullable_request_json).expect("nullable fields must deserialize");
        assert!(nullable_req.target.name.is_none());
        assert!(nullable_req.lookback_bars.is_none());
        assert!(nullable_req.to_date.is_none());
    }
}
