//! NS-01: strict, versioned AST validation and native evaluation.
//!
//! Rust is not the formula compiler: TypeScript compiles scanner-only formula text into
//! a closed JSON AST (see `src/features/scanner/nativeScanAst.ts`) and this module
//! re-validates every node before a single bar is read. Unknown fields, unknown node
//! kinds, non-finite numbers, negative/oversized lookbacks, oversized or deeply nested
//! trees, duplicate rule ids and unsupported pattern ids are all rejected up front.
//!
//! Indicator, comparison, cross and division semantics intentionally mirror the existing
//! TypeScript formula engine (`src/modules/formulaEngine/customFormulaEngine.ts`):
//! SMA warm-up at `period - 1`, EMA seeded from an SMA of the first `period` values, RSI
//! seeded from the first `period` average gains/losses, `null` propagation, and `null`
//! (never `Infinity`) for division by zero. Parity is proven by fixtures in
//! `src/features/scanner/fixtures/nativeScannerAstParityFixtures.v1.json`.

use serde_json::{Map, Value};

mod forward;

pub(super) use forward::{ForwardRuleEvaluator, ForwardRuleSet};

pub const MAX_AST_DEPTH: usize = 24;
pub const MAX_AST_NODES: usize = 512;
pub const MAX_RULES: usize = 32;
pub const MAX_INDICATOR_PERIOD: usize = 400;
pub const MAX_LOOKBACK: usize = 2000;
pub const MAX_LOOKBACK_BARS: usize = 5000;
pub const MAX_EXPLICIT_TARGETS: usize = 5000;
pub const MAX_ID_LENGTH: usize = 128;

/// All 54 built-in chart patterns with accepted, fixture-backed Rust parity.
/// Other scanner rules (unmigrated plugins/signals/custom formulas) stay on the preserved TypeScript path.
pub const SUPPORTED_PATTERN_IDS: [&str; 54] = [
    "chart_common_gap",
    "chart_breakaway_gap",
    "chart_runaway_gap",
    "chart_exhaustion_gap",
    "chart_island_reversal_top",
    "chart_island_reversal_bottom",
    "chart_double_bottom",
    "chart_double_top",
    "chart_triple_bottom",
    "chart_triple_top",
    "chart_v_bottom",
    "chart_spike_top",
    "chart_horn_bottom",
    "chart_horn_top",
    "chart_bump_run_bottom",
    "chart_bump_run_top",
    "chart_blow_off_top",
    "chart_rectangle_range",
    "chart_ascending_triangle",
    "chart_descending_triangle",
    "chart_symmetrical_triangle",
    "chart_falling_wedge_bottom",
    "chart_rising_wedge_top",
    "chart_diamond_bottom",
    "chart_diamond_top",
    "chart_diamond_pattern",
    "chart_broadening_bottom",
    "chart_broadening_formation",
    "chart_rising_three_methods",
    "chart_falling_three_methods",
    "chart_mat_hold_bullish",
    "chart_mat_hold_bearish",
    "chart_bull_flag",
    "chart_bear_flag",
    "chart_bull_pennant",
    "chart_bear_pennant",
    "chart_rising_channel",
    "chart_falling_channel",
    "chart_high_tight_flag",
    "chart_coil_volatility_squeeze",
    "chart_three_rising_valleys",
    "chart_three_falling_peaks",
    "chart_measured_move_up",
    "chart_measured_move_down",
    "chart_head_shoulders",
    "chart_inverse_head_shoulders",
    "chart_complex_head_shoulders",
    "chart_cup_handle",
    "chart_inverted_cup_handle",
    "chart_rounding_bottom",
    "chart_adam_eve_bottom",
    "chart_adam_eve_top",
    "chart_scallop_handle",
    "chart_rounding_top",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OhlcvFieldV1 {
    Open,
    High,
    Low,
    Close,
    Volume,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOpV1 {
    Add,
    Sub,
    Mul,
    Div,
    Gt,
    Gte,
    Lt,
    Lte,
    Eq,
    Neq,
    And,
    Or,
}

impl BinaryOpV1 {
    fn is_comparison(self) -> bool {
        matches!(
            self,
            Self::Gt | Self::Gte | Self::Lt | Self::Lte | Self::Eq | Self::Neq
        )
    }

    fn is_logical(self) -> bool {
        matches!(self, Self::And | Self::Or)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndicatorNameV1 {
    Sma,
    Ema,
    Rsi,
    Atr,
    VolumeSma,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrossKindV1 {
    Over,
    Under,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExprV1 {
    Number {
        value: f64,
    },
    Field {
        field: OhlcvFieldV1,
        lookback: usize,
    },
    Binary {
        op: BinaryOpV1,
        left: Box<ExprV1>,
        right: Box<ExprV1>,
    },
    Indicator {
        name: IndicatorNameV1,
        period: usize,
        input: Option<Box<ExprV1>>,
    },
    Cross {
        kind: CrossKindV1,
        left: Box<ExprV1>,
        right: Box<ExprV1>,
    },
    Pattern {
        id: String,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct RuleV1 {
    pub id: String,
    pub expression: ExprV1,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UniverseSourceV1 {
    ExplicitTargets,
    ActiveNseEq,
    ActiveBse,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UniverseV1 {
    pub source: UniverseSourceV1,
    /// Populated only for `explicitTargets`; deduplicated, order-preserving.
    pub targets: Vec<(String, String)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PriceBasisV1 {
    Raw,
    Adjusted,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EvaluationV1 {
    pub as_of_date: Option<String>,
    pub lookback_bars: Option<usize>,
    pub evaluate_history: bool,
    pub price_basis: PriceBasisV1,
    pub include_dividend_adjustments: bool,
    pub include_rights_adjustments: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NativeScanRequestV1 {
    pub schema_version: u32,
    pub requested_run_id: String,
    pub universe: UniverseV1,
    pub evaluation: EvaluationV1,
    pub rules: Vec<RuleV1>,
}

/// One validation issue with a JSON path so the UI can point at the offending node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationIssue {
    pub path: String,
    pub code: String,
    pub message: String,
}

impl ValidationIssue {
    fn new(path: impl Into<String>, code: &str, message: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            code: code.to_string(),
            message: message.into(),
        }
    }
}

struct ValidationState {
    nodes: usize,
    issues: Vec<ValidationIssue>,
}

fn reject_unknown_keys(
    object: &Map<String, Value>,
    allowed: &[&str],
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) {
    for key in object.keys() {
        if !allowed.contains(&key.as_str()) {
            issues.push(ValidationIssue::new(
                format!("{path}.{key}"),
                "unknown-field",
                format!("{path} contains unsupported field \"{key}\"."),
            ));
        }
    }
}

/// Look up a required key, recording a structured issue when it is absent.
///
/// `Value::get` returning `None` is deliberately distinguished from a present value of
/// the wrong type: absence is a `missing-field` error, wrong type is reported by the
/// downstream coercion (`as_object`, `not-an-array`, ...).
fn require_key<'a>(
    root: &'a Map<String, Value>,
    key: &str,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<&'a Value> {
    let value = root.get(key);
    if value.is_none() {
        issues.push(ValidationIssue::new(
            path,
            "missing-field",
            format!("{path} is required."),
        ));
    }
    value
}

fn as_object<'a>(
    value: &'a Value,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<&'a Map<String, Value>> {
    match value {
        Value::Object(object) => Some(object),
        _ => {
            issues.push(ValidationIssue::new(
                path,
                "not-an-object",
                format!("{path} must be an object."),
            ));
            None
        }
    }
}

fn as_identifier(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<String> {
    as_identifier_with_suffix(value, path, issues, false)
}

fn as_identifier_with_suffix(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
    allow_bse_settlement_suffix: bool,
) -> Option<String> {
    let Some(value) = value else {
        issues.push(ValidationIssue::new(
            path,
            "missing-identifier",
            format!("{path} must be a non-empty string."),
        ));
        return None;
    };
    let Some(text) = value.as_str() else {
        issues.push(ValidationIssue::new(
            path,
            "missing-identifier",
            format!("{path} must be a non-empty string."),
        ));
        return None;
    };
    let base = if allow_bse_settlement_suffix {
        text.strip_suffix('#').unwrap_or(text)
    } else {
        text
    };
    let valid = !base.trim().is_empty()
        && text.len() <= MAX_ID_LENGTH
        && base
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b':' | b'-'));
    if !valid {
        issues.push(ValidationIssue::new(
            path,
            "invalid-identifier",
            format!("{path} must be a non-empty identifier of at most {MAX_ID_LENGTH} characters."),
        ));
        return None;
    }
    Some(text.to_string())
}

fn as_bounded_integer(
    value: Option<&Value>,
    path: &str,
    minimum: usize,
    maximum: usize,
    issues: &mut Vec<ValidationIssue>,
) -> Option<usize> {
    let Some(value) = value else {
        issues.push(ValidationIssue::new(
            path,
            "not-an-integer",
            format!("{path} must be an integer."),
        ));
        return None;
    };
    let Some(number) = value.as_i64() else {
        issues.push(ValidationIssue::new(
            path,
            "not-an-integer",
            format!("{path} must be an integer."),
        ));
        return None;
    };
    if number < 0 {
        issues.push(ValidationIssue::new(
            path,
            "out-of-range",
            format!("{path} must be between {minimum} and {maximum}; received {number}."),
        ));
        return None;
    }
    let number = number as usize;
    if number < minimum || number > maximum {
        issues.push(ValidationIssue::new(
            path,
            "out-of-range",
            format!("{path} must be between {minimum} and {maximum}; received {number}."),
        ));
        return None;
    }
    Some(number)
}

fn as_iso_date(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<String> {
    let Some(text) = value.and_then(Value::as_str) else {
        issues.push(ValidationIssue::new(
            path,
            "invalid-date",
            format!("{path} must be a YYYY-MM-DD date."),
        ));
        return None;
    };
    let bytes = text.as_bytes();
    let shaped = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());
    if !shaped {
        issues.push(ValidationIssue::new(
            path,
            "invalid-date",
            format!("{path} must be a YYYY-MM-DD date."),
        ));
        return None;
    }
    let month = text[5..7].parse::<u32>().unwrap_or(0);
    let day = text[8..10].parse::<u32>().unwrap_or(0);
    let year = text[0..4].parse::<u32>().unwrap_or(0);
    // Month/day ranges alone accept impossible dates such as 2024-02-31, which would then
    // be silently compared as a string. Validate against the real calendar instead.
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    if year == 0 || !(1..=12).contains(&month) || day == 0 || day > max_day {
        issues.push(ValidationIssue::new(
            path,
            "invalid-date",
            format!("{path} is not a real calendar date."),
        ));
        return None;
    }
    Some(text.to_string())
}

fn parse_field(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<OhlcvFieldV1> {
    match value.and_then(Value::as_str) {
        Some("open") => Some(OhlcvFieldV1::Open),
        Some("high") => Some(OhlcvFieldV1::High),
        Some("low") => Some(OhlcvFieldV1::Low),
        Some("close") => Some(OhlcvFieldV1::Close),
        Some("volume") => Some(OhlcvFieldV1::Volume),
        _ => {
            issues.push(ValidationIssue::new(
                path,
                "unsupported-field",
                format!("{path} must be one of open, high, low, close, volume."),
            ));
            None
        }
    }
}

fn parse_binary_op(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<BinaryOpV1> {
    let op = match value.and_then(Value::as_str) {
        Some("add") => BinaryOpV1::Add,
        Some("sub") => BinaryOpV1::Sub,
        Some("mul") => BinaryOpV1::Mul,
        Some("div") => BinaryOpV1::Div,
        Some("gt") => BinaryOpV1::Gt,
        Some("gte") => BinaryOpV1::Gte,
        Some("lt") => BinaryOpV1::Lt,
        Some("lte") => BinaryOpV1::Lte,
        Some("eq") => BinaryOpV1::Eq,
        Some("neq") => BinaryOpV1::Neq,
        Some("and") => BinaryOpV1::And,
        Some("or") => BinaryOpV1::Or,
        _ => {
            issues.push(ValidationIssue::new(
                path,
                "unsupported-operator",
                format!("{path} must be a supported arithmetic, comparison or logical operator."),
            ));
            return None;
        }
    };
    Some(op)
}

fn parse_indicator_name(
    value: Option<&Value>,
    path: &str,
    issues: &mut Vec<ValidationIssue>,
) -> Option<IndicatorNameV1> {
    match value.and_then(Value::as_str) {
        Some("sma") => Some(IndicatorNameV1::Sma),
        Some("ema") => Some(IndicatorNameV1::Ema),
        Some("rsi") => Some(IndicatorNameV1::Rsi),
        Some("atr") => Some(IndicatorNameV1::Atr),
        Some("volumeSma") => Some(IndicatorNameV1::VolumeSma),
        _ => {
            issues.push(ValidationIssue::new(
                path,
                "unsupported-indicator",
                format!("{path} must be one of sma, ema, rsi, atr, volumeSma."),
            ));
            None
        }
    }
}

fn parse_expr(
    value: &Value,
    path: &str,
    depth: usize,
    state: &mut ValidationState,
) -> Option<ExprV1> {
    if depth > MAX_AST_DEPTH {
        state.issues.push(ValidationIssue::new(
            path,
            "max-depth",
            format!("{path} exceeds the maximum AST depth of {MAX_AST_DEPTH}."),
        ));
        return None;
    }
    state.nodes += 1;
    if state.nodes > MAX_AST_NODES {
        state.issues.push(ValidationIssue::new(
            path,
            "max-nodes",
            format!("{path} exceeds the maximum AST node count of {MAX_AST_NODES}."),
        ));
        return None;
    }

    let object = as_object(value, path, &mut state.issues)?;
    let Some(kind) = object.get("kind").and_then(Value::as_str) else {
        state.issues.push(ValidationIssue::new(
            format!("{path}.kind"),
            "unsupported-node",
            format!("{path}.kind is missing."),
        ));
        return None;
    };

    match kind {
        "number" => {
            reject_unknown_keys(object, &["kind", "value"], path, &mut state.issues);
            let Some(number) = object.get("value").and_then(Value::as_f64) else {
                state.issues.push(ValidationIssue::new(
                    format!("{path}.value"),
                    "non-finite-number",
                    format!("{path}.value must be a finite number."),
                ));
                return None;
            };
            if !number.is_finite() {
                state.issues.push(ValidationIssue::new(
                    format!("{path}.value"),
                    "non-finite-number",
                    format!("{path}.value must be a finite number."),
                ));
                return None;
            }
            Some(ExprV1::Number { value: number })
        }
        "field" => {
            reject_unknown_keys(
                object,
                &["kind", "field", "lookback"],
                path,
                &mut state.issues,
            );
            let field = parse_field(
                object.get("field"),
                &format!("{path}.field"),
                &mut state.issues,
            )?;
            let lookback = as_bounded_integer(
                object.get("lookback"),
                &format!("{path}.lookback"),
                0,
                MAX_LOOKBACK,
                &mut state.issues,
            )?;
            Some(ExprV1::Field { field, lookback })
        }
        "binary" => {
            reject_unknown_keys(
                object,
                &["kind", "op", "left", "right"],
                path,
                &mut state.issues,
            );
            let op = parse_binary_op(object.get("op"), &format!("{path}.op"), &mut state.issues)?;
            let left_value = object.get("left")?;
            let right_value = object.get("right")?;
            let left = parse_expr(left_value, &format!("{path}.left"), depth + 1, state)?;
            let right = parse_expr(right_value, &format!("{path}.right"), depth + 1, state)?;
            Some(ExprV1::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
            })
        }
        "indicator" => {
            reject_unknown_keys(
                object,
                &["kind", "name", "period", "input"],
                path,
                &mut state.issues,
            );
            let name = parse_indicator_name(
                object.get("name"),
                &format!("{path}.name"),
                &mut state.issues,
            )?;
            let period = as_bounded_integer(
                object.get("period"),
                &format!("{path}.period"),
                2,
                MAX_INDICATOR_PERIOD,
                &mut state.issues,
            )?;
            let accepts_input = matches!(
                name,
                IndicatorNameV1::Sma | IndicatorNameV1::Ema | IndicatorNameV1::Rsi
            );
            let input = match object.get("input") {
                None => None,
                Some(_) if !accepts_input => {
                    state.issues.push(ValidationIssue::new(
                        format!("{path}.input"),
                        "unsupported-input",
                        format!("{path}.input is not supported for this indicator."),
                    ));
                    return None;
                }
                Some(input_value) => Some(Box::new(parse_expr(
                    input_value,
                    &format!("{path}.input"),
                    depth + 1,
                    state,
                )?)),
            };
            Some(ExprV1::Indicator {
                name,
                period,
                input,
            })
        }
        "crossover" | "crossunder" => {
            reject_unknown_keys(object, &["kind", "left", "right"], path, &mut state.issues);
            let left = parse_expr(
                object.get("left")?,
                &format!("{path}.left"),
                depth + 1,
                state,
            )?;
            let right = parse_expr(
                object.get("right")?,
                &format!("{path}.right"),
                depth + 1,
                state,
            )?;
            Some(ExprV1::Cross {
                kind: if kind == "crossover" {
                    CrossKindV1::Over
                } else {
                    CrossKindV1::Under
                },
                left: Box::new(left),
                right: Box::new(right),
            })
        }
        "pattern" => {
            reject_unknown_keys(object, &["kind", "id"], path, &mut state.issues);
            let Some(id) = object.get("id").and_then(Value::as_str) else {
                state.issues.push(ValidationIssue::new(
                    format!("{path}.id"),
                    "unsupported-pattern",
                    format!("{path}.id must be a supported chart-pattern id."),
                ));
                return None;
            };
            if !SUPPORTED_PATTERN_IDS.contains(&id) {
                state.issues.push(ValidationIssue::new(
                    format!("{path}.id"),
                    "unsupported-pattern",
                    format!(
                        "{path}.id \"{id}\" is not natively supported; it stays on the TypeScript path."
                    ),
                ));
                return None;
            }
            Some(ExprV1::Pattern { id: id.to_string() })
        }
        other => {
            state.issues.push(ValidationIssue::new(
                format!("{path}.kind"),
                "unsupported-node",
                format!("{path} has unsupported AST node kind \"{other}\"."),
            ));
            None
        }
    }
}

/// Validates and parses an untrusted JSON payload into `NativeScanRequestV1`.
pub fn parse_native_scan_request_v1(
    value: &Value,
) -> Result<NativeScanRequestV1, Vec<ValidationIssue>> {
    parse_native_scan_request(value, false, false)
}

pub(super) fn parse_native_numeric_history_request(
    value: &Value,
) -> Result<NativeScanRequestV1, Vec<ValidationIssue>> {
    parse_native_scan_request(value, true, false)
}

pub(super) fn parse_native_custom_signal_envelope(
    value: &Value,
) -> Result<NativeScanRequestV1, Vec<ValidationIssue>> {
    parse_native_scan_request(value, false, true)
}

fn parse_native_scan_request(
    value: &Value,
    allow_bse_settlement_suffix: bool,
    custom_signals: bool,
) -> Result<NativeScanRequestV1, Vec<ValidationIssue>> {
    let mut issues: Vec<ValidationIssue> = Vec::new();
    let Some(root) = as_object(value, "request", &mut issues) else {
        return Err(issues);
    };
    reject_unknown_keys(
        root,
        &[
            "schemaVersion",
            "requestedRunId",
            "universe",
            "evaluation",
            if custom_signals {
                "customSignals"
            } else {
                "rules"
            },
        ],
        "request",
        &mut issues,
    );

    if root.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        issues.push(ValidationIssue::new(
            "request.schemaVersion",
            "unsupported-schema",
            "request.schemaVersion must be 1.",
        ));
    }
    let requested_run_id = as_identifier(
        root.get("requestedRunId"),
        "request.requestedRunId",
        &mut issues,
    );

    // -- universe -----------------------------------------------------------
    // A missing container must be reported here. Without this, `None` can reach the
    // construction site with no issue recorded, and the old `expect()` panicked instead
    // of returning a structured validation error.
    let universe = require_key(root, "universe", "request.universe", &mut issues)
        .and_then(|value| as_object(value, "request.universe", &mut issues))
        .and_then(|universe| {
            let source = universe.get("source").and_then(Value::as_str);
            match source {
                Some("explicitTargets") => {
                    reject_unknown_keys(universe, &["source", "targets"], "request.universe", &mut issues);
                    let Some(targets) = universe.get("targets").and_then(Value::as_array) else {
                        issues.push(ValidationIssue::new(
                            "request.universe.targets",
                            "missing-targets",
                            "request.universe.targets must be a non-empty array for explicitTargets.",
                        ));
                        return None;
                    };
                    if targets.is_empty() || targets.len() > MAX_EXPLICIT_TARGETS {
                        issues.push(ValidationIssue::new(
                            "request.universe.targets",
                            "missing-targets",
                            format!(
                                "request.universe.targets must contain 1 to {MAX_EXPLICIT_TARGETS} entries."
                            ),
                        ));
                        return None;
                    }
                    let mut seen = std::collections::BTreeSet::new();
                    let mut parsed = Vec::with_capacity(targets.len());
                    for (index, entry) in targets.iter().enumerate() {
                        let path = format!("request.universe.targets[{index}]");
                        let Some(target) = as_object(entry, &path, &mut issues) else {
                            continue;
                        };
                        reject_unknown_keys(target, &["exchange", "symbol"], &path, &mut issues);
                        let exchange =
                            as_identifier(target.get("exchange"), &format!("{path}.exchange"), &mut issues);
                        let symbol = as_identifier_with_suffix(
                            target.get("symbol"),
                            &format!("{path}.symbol"),
                            &mut issues,
                            allow_bse_settlement_suffix
                                && exchange.as_deref().is_some_and(|name| name.eq_ignore_ascii_case("BSE")),
                        );
                        if let (Some(exchange), Some(symbol)) = (exchange, symbol) {
                            let key = format!(
                                "{}:{}",
                                exchange.to_ascii_uppercase(),
                                symbol.to_ascii_uppercase()
                            );
                            if !seen.insert(key) {
                                issues.push(ValidationIssue::new(
                                    path,
                                    "duplicate-target",
                                    "request.universe.targets contains a duplicate exchange/symbol pair.",
                                ));
                                continue;
                            }
                            parsed.push((exchange, symbol));
                        }
                    }
                    if parsed.len() != targets.len() {
                        return None;
                    }
                    Some(UniverseV1 {
                        source: UniverseSourceV1::ExplicitTargets,
                        targets: parsed,
                    })
                }
                Some("activeNseEq") | Some("activeBse") => {
                    reject_unknown_keys(universe, &["source"], "request.universe", &mut issues);
                    Some(UniverseV1 {
                        source: if source == Some("activeNseEq") {
                            UniverseSourceV1::ActiveNseEq
                        } else {
                            UniverseSourceV1::ActiveBse
                        },
                        targets: Vec::new(),
                    })
                }
                _ => {
                    issues.push(ValidationIssue::new(
                        "request.universe.source",
                        "unsupported-universe",
                        "request.universe.source must be explicitTargets, activeNseEq or activeBse.",
                    ));
                    None
                }
            }
        });

    // -- evaluation ---------------------------------------------------------
    let evaluation = require_key(root, "evaluation", "request.evaluation", &mut issues)
        .and_then(|value| as_object(value, "request.evaluation", &mut issues))
        .and_then(|evaluation| {
            reject_unknown_keys(
                evaluation,
                &[
                    "asOfDate",
                    "lookbackBars",
                    "evaluateHistory",
                    "priceBasis",
                    "includeDividendAdjustments",
                    "includeRightsAdjustments",
                ],
                "request.evaluation",
                &mut issues,
            );
            let as_of_date = match evaluation.get("asOfDate") {
                None | Some(Value::Null) => None,
                Some(value) => Some(as_iso_date(
                    Some(value),
                    "request.evaluation.asOfDate",
                    &mut issues,
                )?),
            };
            let lookback_bars = match evaluation.get("lookbackBars") {
                None | Some(Value::Null) => None,
                Some(value) => Some(as_bounded_integer(
                    Some(value),
                    "request.evaluation.lookbackBars",
                    1,
                    MAX_LOOKBACK_BARS,
                    &mut issues,
                )?),
            };
            let Some(evaluate_history) = evaluation.get("evaluateHistory").and_then(Value::as_bool)
            else {
                issues.push(ValidationIssue::new(
                    "request.evaluation.evaluateHistory",
                    "not-a-boolean",
                    "request.evaluation.evaluateHistory must be a boolean.",
                ));
                return None;
            };
            let price_basis = match evaluation.get("priceBasis").and_then(Value::as_str) {
                Some("raw") => PriceBasisV1::Raw,
                Some("adjusted") => PriceBasisV1::Adjusted,
                _ => {
                    issues.push(ValidationIssue::new(
                        "request.evaluation.priceBasis",
                        "unsupported-price-basis",
                        "request.evaluation.priceBasis must be \"raw\" or \"adjusted\".",
                    ));
                    return None;
                }
            };
            let mut read_flag = |key: &str| -> Option<bool> {
                match evaluation.get(key) {
                    None => Some(false),
                    Some(Value::Bool(value)) => Some(*value),
                    Some(_) => {
                        issues.push(ValidationIssue::new(
                            format!("request.evaluation.{key}"),
                            "not-a-boolean",
                            format!("request.evaluation.{key} must be a boolean when present."),
                        ));
                        None
                    }
                }
            };
            let include_dividend_adjustments = read_flag("includeDividendAdjustments")?;
            let include_rights_adjustments = read_flag("includeRightsAdjustments")?;
            if price_basis == PriceBasisV1::Raw
                && (include_dividend_adjustments || include_rights_adjustments)
            {
                issues.push(ValidationIssue::new(
                    "request.evaluation.priceBasis",
                    "basis-flag-conflict",
                    "Dividend/rights adjustments require priceBasis \"adjusted\".",
                ));
                return None;
            }
            Some(EvaluationV1 {
                as_of_date,
                lookback_bars,
                evaluate_history,
                price_basis,
                include_dividend_adjustments,
                include_rights_adjustments,
            })
        });

    // -- rules --------------------------------------------------------------
    let empty_rules = Value::Array(Vec::new());
    let rule_input = if custom_signals {
        Some(&empty_rules)
    } else {
        require_key(root, "rules", "request.rules", &mut issues)
    };
    let rules = rule_input
        .and_then(|value| match value.as_array() {
            Some(rules) => Some(rules),
            None => {
                issues.push(ValidationIssue::new(
                    "request.rules",
                    "not-an-array",
                    "request.rules must be an array.",
                ));
                None
            }
        })
        .and_then(|rules| {
            if (!custom_signals && rules.is_empty()) || rules.len() > MAX_RULES {
                issues.push(ValidationIssue::new(
                    "request.rules",
                    "missing-rules",
                    format!("request.rules must contain 1 to {MAX_RULES} entries."),
                ));
                return None;
            }
            let mut state = ValidationState {
                nodes: 0,
                issues: Vec::new(),
            };
            let mut seen = std::collections::BTreeSet::new();
            let mut parsed = Vec::with_capacity(rules.len());
            for (index, rule) in rules.iter().enumerate() {
                let path = format!("request.rules[{index}]");
                let Some(object) = as_object(rule, &path, &mut state.issues) else {
                    continue;
                };
                reject_unknown_keys(object, &["id", "expression"], &path, &mut state.issues);
                let Some(id) =
                    as_identifier(object.get("id"), &format!("{path}.id"), &mut state.issues)
                else {
                    continue;
                };
                if id == super::custom_signals::SCANNER_ID {
                    state.issues.push(ValidationIssue::new(
                        format!("{path}.id"),
                        "reserved-custom-signal",
                        "The custom signal Scanner ID requires the separate V1 custom signal envelope.",
                    ));
                    continue;
                }
                if !seen.insert(id.clone()) {
                    state.issues.push(ValidationIssue::new(
                        format!("{path}.id"),
                        "duplicate-rule",
                        format!("{path}.id \"{id}\" is duplicated."),
                    ));
                    continue;
                }
                let Some(expression) = object.get("expression").and_then(|value| {
                    parse_expr(value, &format!("{path}.expression"), 1, &mut state)
                }) else {
                    continue;
                };
                parsed.push(RuleV1 { id, expression });
            }
            let failed = parsed.len() != rules.len();
            issues.extend(state.issues);
            if failed {
                return None;
            }
            Some(parsed)
        });

    if !issues.is_empty() {
        return Err(issues);
    }
    let Some(requested_run_id) = requested_run_id else {
        return Err(vec![ValidationIssue::new(
            "request.requestedRunId",
            "missing-identifier",
            "request.requestedRunId is required.",
        )]);
    };
    // No `expect()`/`unwrap()` may guard construction: every path that yields `None`
    // here must already have pushed an issue, so fail closed with a structured error.
    let (Some(universe), Some(evaluation), Some(rules)) = (universe, evaluation, rules) else {
        if issues.is_empty() {
            issues.push(ValidationIssue::new(
                "request",
                "incomplete-request",
                "request is missing a required section and could not be validated.",
            ));
        }
        return Err(issues);
    };
    Ok(NativeScanRequestV1 {
        schema_version: 1,
        requested_run_id,
        universe,
        evaluation,
        rules,
    })
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/// A completed bar in real price units. `date` is packed `YYYYMMDD`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EvalBar {
    pub date: u32,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// Series-aligned value: `None` models the TypeScript `null` used for warm-up and
/// undefined arithmetic (for example division by zero).
pub type Series = Vec<Option<f64>>;

#[derive(Debug, Clone, PartialEq)]
pub enum EvalValue {
    Numeric(Series),
    Boolean(Vec<Option<bool>>),
}

impl EvalValue {
    pub fn numeric(&self) -> Series {
        match self {
            Self::Numeric(values) => values.clone(),
            Self::Boolean(values) => values
                .iter()
                .map(|value| value.map(|flag| if flag { 1.0 } else { 0.0 }))
                .collect(),
        }
    }

    #[cfg(test)]
    pub fn boolean(&self) -> Vec<Option<bool>> {
        match self {
            Self::Boolean(values) => values.clone(),
            Self::Numeric(values) => values
                .iter()
                .map(|value| value.map(|number| number != 0.0))
                .collect(),
        }
    }
}

/// Retains the input window in the original summation order.
struct SmaState {
    period: usize,
    window: std::collections::VecDeque<Option<f64>>,
}

impl SmaState {
    fn new(period: usize) -> Self {
        Self {
            period,
            window: std::collections::VecDeque::new(),
        }
    }

    fn advance(&mut self, input: Option<f64>) -> Option<f64> {
        if self.period == 0 {
            return None;
        }
        if self.window.len() == self.period {
            self.window.pop_front();
        }
        self.window.push_back(input);
        if self.window.len() < self.period {
            return None;
        }

        let mut sum = 0.0;
        for &value in &self.window {
            sum += value?;
        }
        Some(sum / self.period as f64)
    }
}

/// SMA matching the TypeScript engine: first value at `period - 1`, `None` while any
/// window entry is undefined.
pub fn sma(values: &[Option<f64>], period: usize) -> Series {
    let mut state = SmaState::new(period);
    values.iter().map(|&value| state.advance(value)).collect()
}

struct EmaState {
    period: usize,
    multiplier: f64,
    seed_count: usize,
    seed_sum: f64,
    current: Option<f64>,
}

impl EmaState {
    fn new(period: usize) -> Self {
        Self {
            period,
            multiplier: 2.0 / (period as f64 + 1.0),
            seed_count: 0,
            seed_sum: 0.0,
            current: None,
        }
    }

    fn advance(&mut self, input: Option<f64>) -> Option<f64> {
        if self.period == 0 {
            return None;
        }
        let Some(value) = input else {
            self.seed_count = 0;
            self.seed_sum = 0.0;
            self.current = None;
            return None;
        };

        if let Some(previous) = self.current {
            self.current = Some((value - previous) * self.multiplier + previous);
        } else {
            self.seed_sum += value;
            self.seed_count += 1;
            if self.seed_count == self.period {
                self.current = Some(self.seed_sum / self.period as f64);
            }
        }
        self.current
    }
}

/// EMA matching the TypeScript engine: seeded with the SMA of the first `period` valid
/// values, then `(value - ema) * multiplier + ema`. A `None` block resets the seed.
pub fn ema(values: &[Option<f64>], period: usize) -> Series {
    let mut state = EmaState::new(period);
    values.iter().map(|&value| state.advance(value)).collect()
}

struct RsiState {
    period: usize,
    previous: Option<f64>,
    seed: Vec<(f64, f64)>,
    averages: Option<(f64, f64)>,
}

impl RsiState {
    fn new(period: usize) -> Self {
        Self {
            period,
            previous: None,
            seed: Vec::new(),
            averages: None,
        }
    }

    fn advance(&mut self, input: Option<f64>) -> Option<f64> {
        if self.period == 0 {
            return None;
        }
        let previous = std::mem::replace(&mut self.previous, input);
        let (Some(current), Some(previous)) = (input, previous) else {
            self.seed.clear();
            self.averages = None;
            return None;
        };

        let change = current - previous;
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);
        let period = self.period as f64;
        let averages = if let Some((average_gain, average_loss)) = self.averages {
            (
                (average_gain * (period - 1.0) + gain) / period,
                (average_loss * (period - 1.0) + loss) / period,
            )
        } else {
            self.seed.push((gain, loss));
            if self.seed.len() < self.period {
                return None;
            }
            let average_gain = self.seed.iter().map(|&(gain, _)| gain).sum::<f64>() / period;
            let average_loss = self.seed.iter().map(|&(_, loss)| loss).sum::<f64>() / period;
            self.seed.clear();
            (average_gain, average_loss)
        };
        self.averages = Some(averages);
        Some(rsi_value(averages.0, averages.1))
    }
}

/// RSI matching the TypeScript engine's seed/averaging rules.
pub fn rsi(values: &[Option<f64>], period: usize) -> Series {
    let mut state = RsiState::new(period);
    values.iter().map(|&value| state.advance(value)).collect()
}

fn rsi_value(average_gain: f64, average_loss: f64) -> f64 {
    if average_loss == 0.0 {
        return 100.0;
    }
    let relative_strength = average_gain / average_loss;
    100.0 - (100.0 / (1.0 + relative_strength))
}

struct AtrState {
    previous_close: Option<f64>,
    average: SmaState,
}

impl AtrState {
    fn new(period: usize) -> Self {
        Self {
            previous_close: None,
            average: SmaState::new(period),
        }
    }

    fn advance(&mut self, high: f64, low: f64, close: f64) -> Option<f64> {
        let range = high - low;
        let true_range = match self.previous_close.replace(close) {
            Some(previous) => range
                .max((high - previous).abs())
                .max((low - previous).abs()),
            None => range,
        };
        self.average.advance(Some(true_range))
    }
}

/// True range with the first bar's range as its seed value, then a plain SMA.
pub fn atr(bars: &[EvalBar], period: usize) -> Series {
    let mut state = AtrState::new(period);
    bars.iter()
        .map(|bar| state.advance(bar.high, bar.low, bar.close))
        .collect()
}

fn read_field(bar: &EvalBar, field: OhlcvFieldV1) -> f64 {
    match field {
        OhlcvFieldV1::Open => bar.open,
        OhlcvFieldV1::High => bar.high,
        OhlcvFieldV1::Low => bar.low,
        OhlcvFieldV1::Close => bar.close,
        OhlcvFieldV1::Volume => bar.volume,
    }
}

fn field_series(bars: &[EvalBar], field: OhlcvFieldV1, lookback: usize) -> Series {
    (0..bars.len())
        .map(|index| {
            index
                .checked_sub(lookback)
                .map(|index| read_field(&bars[index], field))
        })
        .collect()
}

fn binary_point(op: BinaryOpV1, left: Option<f64>, right: Option<f64>) -> Option<f64> {
    if op.is_logical() {
        let logical_or = matches!(op, BinaryOpV1::Or);
        let left = left.map(|value| value != 0.0);
        let right = right.map(|value| value != 0.0);
        // True determines OR and false determines AND, including with an undefined operand.
        let result = if left == Some(logical_or) || right == Some(logical_or) {
            logical_or
        } else {
            left?;
            right?;
            !logical_or
        };
        return Some(result as u8 as f64);
    }
    let (left, right) = (left?, right?);
    use BinaryOpV1::*;
    Some(match op {
        Add => left + right,
        Sub => left - right,
        Mul => left * right,
        Div if right == 0.0 => return None,
        Div => left / right,
        Gt => (left > right) as u8 as f64,
        Gte => (left >= right) as u8 as f64,
        Lt => (left < right) as u8 as f64,
        Lte => (left <= right) as u8 as f64,
        Eq => (left == right) as u8 as f64,
        Neq => (left != right) as u8 as f64,
        And | Or => unreachable!("logical operations are handled above"),
    })
}

fn cross_point(
    kind: CrossKindV1,
    previous: (Option<f64>, Option<f64>),
    current: (Option<f64>, Option<f64>),
) -> Option<bool> {
    let (previous_left, previous_right) = (previous.0?, previous.1?);
    let (current_left, current_right) = (current.0?, current.1?);
    Some(match kind {
        CrossKindV1::Over => previous_left <= previous_right && current_left > current_right,
        CrossKindV1::Under => previous_left >= previous_right && current_left < current_right,
    })
}

/// Evaluates an AST over a window of completed bars.
pub fn evaluate_expression(expression: &ExprV1, bars: &[EvalBar]) -> Result<EvalValue, String> {
    let length = bars.len();
    match expression {
        ExprV1::Number { value } => Ok(EvalValue::Numeric(vec![Some(*value); length])),
        ExprV1::Field { field, lookback } => {
            Ok(EvalValue::Numeric(field_series(bars, *field, *lookback)))
        }
        ExprV1::Pattern { id } => Err(format!(
            "Pattern rule {id} must be evaluated by its dedicated detector, not the numeric evaluator."
        )),
        ExprV1::Indicator {
            name,
            period,
            input,
        } => {
            let values = match name {
                IndicatorNameV1::Atr => atr(bars, *period),
                IndicatorNameV1::VolumeSma => {
                    let volumes: Series = bars.iter().map(|bar| Some(bar.volume)).collect();
                    sma(&volumes, *period)
                }
                _ => {
                    let Some(input) = input else {
                        return Err("SMA/EMA/RSI require an input expression.".to_string());
                    };
                    let series = evaluate_expression(input, bars)?.numeric();
                    match name {
                        IndicatorNameV1::Sma => sma(&series, *period),
                        IndicatorNameV1::Ema => ema(&series, *period),
                        IndicatorNameV1::Rsi => rsi(&series, *period),
                        _ => unreachable!("ATR/volumeSma handled above"),
                    }
                }
            };
            Ok(EvalValue::Numeric(values))
        }
        ExprV1::Cross { kind, left, right } => {
            let left = evaluate_expression(left, bars)?.numeric();
            let right = evaluate_expression(right, bars)?.numeric();
            let mut values = vec![None; length];
            for index in 1..length {
                values[index] = cross_point(
                    *kind,
                    (left[index - 1], right[index - 1]),
                    (left[index], right[index]),
                );
            }
            Ok(EvalValue::Boolean(values))
        }
        ExprV1::Binary { op, left, right } => {
            let left = evaluate_expression(left, bars)?.numeric();
            let right = evaluate_expression(right, bars)?.numeric();
            let values = left
                .into_iter()
                .zip(right)
                .map(|(left, right)| binary_point(*op, left, right));
            if op.is_logical() || op.is_comparison() {
                return Ok(EvalValue::Boolean(
                    values.map(|value| value.map(|flag| flag != 0.0)).collect(),
                ));
            }
            Ok(EvalValue::Numeric(values.collect()))
        }
    }
}

/// Result of evaluating one rule over the window's final completed bar.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LatestRuleOutcome {
    pub matched: bool,
    pub value: Option<f64>,
}

/// Evaluates a rule on the most recent completed bar only. `None` is "no match".
pub fn evaluate_rule_latest(
    expression: &ExprV1,
    bars: &[EvalBar],
) -> Result<LatestRuleOutcome, String> {
    if bars.is_empty() {
        return Ok(LatestRuleOutcome {
            matched: false,
            value: None,
        });
    }
    let index = bars.len() - 1;
    match evaluate_expression(expression, bars)? {
        EvalValue::Boolean(values) => Ok(LatestRuleOutcome {
            matched: values[index].unwrap_or(false),
            value: values[index].map(|flag| if flag { 1.0 } else { 0.0 }),
        }),
        EvalValue::Numeric(values) => Ok(match values[index] {
            Some(number) => LatestRuleOutcome {
                matched: number != 0.0,
                value: Some(number),
            },
            None => LatestRuleOutcome {
                matched: false,
                value: None,
            },
        }),
    }
}

/// Minimum bar count a rule needs before it can produce a non-`None` result.
pub fn minimum_bars_for_expression(expression: &ExprV1) -> usize {
    match expression {
        ExprV1::Number { .. } => 0,
        ExprV1::Field { lookback, .. } => lookback + 1,
        ExprV1::Pattern { .. } => 22,
        ExprV1::Indicator {
            name,
            period,
            input,
        } => {
            let input_bars = input
                .as_ref()
                .map(|input| minimum_bars_for_expression(input))
                .unwrap_or(0);
            match name {
                IndicatorNameV1::Atr => *period,
                IndicatorNameV1::VolumeSma => *period,
                IndicatorNameV1::Rsi => input_bars + period,
                _ => input_bars + period.saturating_sub(1),
            }
        }
        ExprV1::Cross { left, right, .. } => {
            minimum_bars_for_expression(left).max(minimum_bars_for_expression(right)) + 1
        }
        ExprV1::Binary { left, right, .. } => {
            minimum_bars_for_expression(left).max(minimum_bars_for_expression(right))
        }
    }
}

/// True when the AST needs the chart-pattern detectors rather than the numeric evaluator.
pub fn contains_pattern(expression: &ExprV1) -> bool {
    match expression {
        ExprV1::Pattern { .. } => true,
        ExprV1::Binary { left, right, .. } | ExprV1::Cross { left, right, .. } => {
            contains_pattern(left) || contains_pattern(right)
        }
        ExprV1::Indicator { input, .. } => input.as_deref().map(contains_pattern).unwrap_or(false),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn bars_from_closes(closes: &[f64]) -> Vec<EvalBar> {
        closes
            .iter()
            .enumerate()
            .map(|(index, close)| EvalBar {
                date: 20240101 + index as u32,
                open: *close - 0.5,
                high: *close + 1.0,
                low: *close - 1.0,
                close: *close,
                volume: 1_000.0 + index as f64,
            })
            .collect()
    }

    fn request_value(rules: serde_json::Value) -> serde_json::Value {
        json!({
            "schemaVersion": 1,
            "requestedRunId": "run-1",
            "universe": { "source": "explicitTargets", "targets": [{ "exchange": "NSE", "symbol": "INFY" }] },
            "evaluation": { "evaluateHistory": false, "priceBasis": "raw" },
            "rules": rules
        })
    }

    /// Every omitted required section must produce a structured error, never a panic.
    ///
    /// Regression: these inputs previously reached `expect("validated ...")` with an
    /// empty issue list, because `Value::get` returning `None` recorded nothing.
    #[test]
    fn ns01_validator_reports_missing_top_level_sections_instead_of_panicking() {
        let cases: [(&str, &str); 3] = [
            ("universe", "request.universe"),
            ("evaluation", "request.evaluation"),
            ("rules", "request.rules"),
        ];
        for (missing, expected_path) in cases {
            let mut value =
                request_value(serde_json::json!([{ "id": "rule-1", "kind": "expression" }]));
            value.as_object_mut().unwrap().remove(missing);
            let error = parse_native_scan_request_v1(&value)
                .expect_err("a missing required section must be rejected");
            assert!(
                error
                    .iter()
                    .any(|issue| issue.path == expected_path && issue.code == "missing-field"),
                "missing `{missing}` must report missing-field at {expected_path}, got {error:?}"
            );
        }
    }

    /// A request missing all three containers at once must still fail closed with
    /// structured errors and must not panic.
    #[test]
    fn ns01_validator_rejects_a_request_with_every_section_missing() {
        let value = serde_json::json!({ "schemaVersion": 1, "requestedRunId": "run-1" });
        let error = parse_native_scan_request_v1(&value)
            .expect_err("a request with no sections must be rejected");
        for expected_path in ["request.universe", "request.evaluation", "request.rules"] {
            assert!(
                error.iter().any(|issue| issue.path == expected_path),
                "expected an issue at {expected_path}, got {error:?}"
            );
        }
    }

    /// `rules` present with a non-array type is distinct from `rules` absent, and must
    /// report `not-an-array` rather than silently yielding `None`.
    #[test]
    fn ns01_validator_reports_rules_that_are_not_an_array() {
        let mut value = request_value(serde_json::json!([]));
        value["rules"] = serde_json::json!({ "unexpected": "object" });
        let error = parse_native_scan_request_v1(&value).expect_err("non-array rules rejected");
        assert!(
            error
                .iter()
                .any(|issue| issue.path == "request.rules" && issue.code == "not-an-array"),
            "expected not-an-array at request.rules, got {error:?}"
        );
    }

    /// Non-object containers must be reported by the object coercion, not skipped.
    #[test]
    fn ns01_validator_reports_non_object_sections() {
        for section in ["universe", "evaluation"] {
            let mut value =
                request_value(serde_json::json!([{ "id": "rule-1", "kind": "expression" }]));
            value[section] = serde_json::json!("not-an-object");
            let error = parse_native_scan_request_v1(&value)
                .expect_err("non-object section must be rejected");
            assert!(
                error.iter().any(|issue| {
                    issue.path == format!("request.{section}") && issue.code == "not-an-object"
                }),
                "expected not-an-object at request.{section}, got {error:?}"
            );
        }
    }

    /// Deeply malformed input must return an error rather than unwind.
    #[test]
    fn ns01_validator_never_panics_on_malformed_input() {
        let cases = [
            serde_json::json!(null),
            serde_json::json!([]),
            serde_json::json!("request"),
            serde_json::json!(0),
            serde_json::json!({}),
            serde_json::json!({ "schemaVersion": 1 }),
            serde_json::json!({ "schemaVersion": 1, "universe": null, "evaluation": null, "rules": null }),
            serde_json::json!({ "schemaVersion": 2, "requestedRunId": "", "rules": [] }),
        ];
        for value in cases {
            // The contract under test is "returns Err or Ok, never panics".
            let _ = parse_native_scan_request_v1(&value);
        }
    }

    #[test]
    fn ns01_validator_accepts_a_minimal_request_and_dedups_targets() {
        let request = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "field", "field": "close", "lookback": 0 } }
        ])))
        .expect("valid request");
        assert_eq!(request.schema_version, 1);
        assert_eq!(request.requested_run_id, "run-1");
        assert_eq!(
            request.universe.targets,
            vec![("NSE".to_string(), "INFY".to_string())]
        );
        assert_eq!(request.evaluation.price_basis, PriceBasisV1::Raw);
        assert_eq!(request.rules.len(), 1);
    }

    #[test]
    fn ns01_validator_rejects_unknown_fields_bad_numbers_and_oversized_trees() {
        let mut payload = request_value(json!([
            { "id": "r1", "expression": { "kind": "field", "field": "close", "lookback": 0 } }
        ]));
        payload["extra"] = json!(true);
        let issues = parse_native_scan_request_v1(&payload).expect_err("unknown root field");
        assert!(issues.iter().any(|issue| issue.code == "unknown-field"));

        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "number", "value": "NaN" } }
        ])))
        .expect_err("string number");
        assert!(issues.iter().any(|issue| issue.code == "non-finite-number"));

        let mut deep = json!({ "kind": "number", "value": 1.0 });
        for _ in 0..MAX_AST_DEPTH + 2 {
            deep = json!({ "kind": "binary", "op": "add", "left": deep, "right": { "kind": "number", "value": 1.0 } });
        }
        let issues = parse_native_scan_request_v1(&request_value(
            json!([{ "id": "r1", "expression": deep }]),
        ))
        .expect_err("too deep");
        assert!(issues.iter().any(|issue| issue.code == "max-depth"));
    }

    #[test]
    fn ns01_validator_rejects_negative_lookback_unsupported_pattern_and_duplicate_rules() {
        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "field", "field": "close", "lookback": -1 } }
        ])))
        .expect_err("negative lookback");
        // A negative lookback is a valid integer that is outside the permitted range, so
        // the validator reports `out-of-range` (never `not-an-integer`). The original
        // assertion expected the wrong code and had never executed.
        assert!(
            issues.iter().any(|issue| issue.code == "out-of-range"
                && issue.path == "request.rules[0].expression.lookback"),
            "unexpected issues: {issues:?}"
        );

        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "pattern", "id": "chart_unknown_pattern" } }
        ])))
        .expect_err("unsupported pattern");
        assert!(issues
            .iter()
            .any(|issue| issue.code == "unsupported-pattern"));

        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "number", "value": 1.0 } },
            { "id": "r1", "expression": { "kind": "number", "value": 2.0 } }
        ])))
        .expect_err("duplicate rule");
        assert!(issues.iter().any(|issue| issue.code == "duplicate-rule"));
    }

    #[test]
    fn ns01_validator_rejects_raw_basis_with_adjustment_flags_and_bad_dates() {
        let mut payload = request_value(json!([
            { "id": "r1", "expression": { "kind": "number", "value": 1.0 } }
        ]));
        payload["evaluation"] = json!({
            "evaluateHistory": false,
            "priceBasis": "raw",
            "includeDividendAdjustments": true
        });
        let issues = parse_native_scan_request_v1(&payload).expect_err("basis conflict");
        assert!(issues
            .iter()
            .any(|issue| issue.code == "basis-flag-conflict"));

        let mut payload = request_value(json!([
            { "id": "r1", "expression": { "kind": "number", "value": 1.0 } }
        ]));
        payload["evaluation"] = json!({
            "evaluateHistory": false,
            "priceBasis": "adjusted",
            "asOfDate": "2024-02-31"
        });
        let issues = parse_native_scan_request_v1(&payload).expect_err("bad day");
        assert!(issues.iter().any(|issue| issue.code == "invalid-date"));
    }

    #[test]
    fn ns01_evaluator_matches_sma_ema_rsi_warmup_and_null_propagation() {
        let bars = bars_from_closes(&[10.0, 11.0, 12.0, 13.0, 12.0, 11.0]);
        let closes: Series = bars.iter().map(|bar| Some(bar.close)).collect();

        assert_eq!(
            sma(&closes, 3),
            vec![
                None,
                None,
                Some(11.0),
                Some(12.0),
                Some(37.0 / 3.0),
                Some(12.0)
            ]
        );
        assert_eq!(sma(&closes, 10), vec![None; 6]);

        let ema_values = ema(&closes, 3);
        assert_eq!(ema_values[0], None);
        assert_eq!(ema_values[1], None);
        let expected_seed = 11.0;
        assert!((ema_values[2].unwrap() - expected_seed).abs() < 1e-12);
        let expected_next = (13.0 - expected_seed) * 0.5 + expected_seed;
        assert!((ema_values[3].unwrap() - expected_next).abs() < 1e-12);

        let rsi_values = rsi(&closes, 3);
        assert_eq!(rsi_values[0], None);
        assert_eq!(rsi_values[1], None);
        assert_eq!(rsi_values[2], None);
        assert!((rsi_values[3].unwrap() - 100.0).abs() < 1e-12);
        assert!(rsi_values[4].unwrap() < 100.0);

        let gapped = vec![Some(1.0), None, Some(2.0)];
        assert_eq!(sma(&gapped, 2), vec![None, None, None]);
    }

    #[derive(Default)]
    struct FixtureEmaState {
        seed_count: usize,
        seed_sum: f64,
        current: Option<f64>,
    }

    impl FixtureEmaState {
        fn advance(&mut self, input: Option<f64>, period: usize) -> Option<f64> {
            let Some(input) = input else {
                *self = Self::default();
                return None;
            };

            if let Some(previous) = self.current {
                let multiplier = 2.0 / (period as f64 + 1.0);
                self.current = Some((input - previous) * multiplier + previous);
            } else {
                self.seed_count += 1;
                self.seed_sum += input;
                if self.seed_count == period {
                    self.current = Some(self.seed_sum / period as f64);
                }
            }
            self.current
        }
    }

    #[test]
    fn nsr7_ema_page_seam_preserves_exact_values_through_seed_and_reset() {
        // With two-value pages, seams split the initial seed, the running series,
        // the undefined block and the next seed.
        let input = [
            Some(2.0),
            Some(6.0),
            Some(4.0),
            Some(12.0),
            Some(5.0),
            None,
            None,
            Some(3.0),
            Some(8.0),
            Some(2.0),
            Some(16.0),
            Some(1.0),
        ];

        for period in [1, 3, 5] {
            let expected = ema(&input, period);
            for page_size in [1, 2, 4, 7, 12] {
                let mut state = FixtureEmaState::default();
                let mut actual = Vec::new();
                for page in input.chunks(page_size) {
                    actual.extend(page.iter().map(|&value| state.advance(value, period)));
                }
                assert_eq!(actual, expected, "period {period}, page size {page_size}");
            }
        }
    }

    #[test]
    fn nsr7_ema_page_seam_visits_every_eligible_endpoint_and_emits_exact_match_dates() {
        let period = 5;
        let threshold = 100.0;
        let rule = ExprV1::Binary {
            op: BinaryOpV1::Gt,
            left: Box::new(ExprV1::Indicator {
                name: IndicatorNameV1::Ema,
                period,
                input: Some(Box::new(ExprV1::Field {
                    field: OhlcvFieldV1::Close,
                    lookback: 0,
                })),
            }),
            right: Box::new(ExprV1::Number { value: threshold }),
        };
        let warmup = minimum_bars_for_expression(&rule).max(1);
        assert_eq!(warmup, period);

        let first_date = chrono::NaiveDate::from_ymd_opt(1990, 1, 1).unwrap();
        for eligible_count in [999, 1_000, 1_001, 5_000, 5_001] {
            let closes: Vec<_> = (0..eligible_count + period - 1)
                .map(|index| if index / 1_000 % 2 == 0 { 120.0 } else { 99.0 })
                .collect();
            let mut bars = bars_from_closes(&closes);
            for (index, bar) in bars.iter_mut().enumerate() {
                let date = first_date + chrono::Duration::days(index as i64);
                bar.date = date.format("%Y%m%d").to_string().parse().unwrap();
            }

            let verdicts = evaluate_expression(&rule, &bars)
                .expect("evaluate the whole fixture")
                .boolean();
            let expected_endpoints: Vec<_> = bars
                .iter()
                .zip(verdicts)
                .enumerate()
                .skip(period - 1)
                .map(|(index, (bar, verdict))| (index + 1, bar.date, verdict))
                .collect();
            let expected_dates: Vec<_> = expected_endpoints
                .iter()
                .filter_map(|&(_, date, verdict)| (verdict == Some(true)).then_some(date))
                .collect();
            assert_eq!(expected_endpoints.len(), eligible_count);
            if bars.len() >= 1_005 {
                // At the fifth bar on page two, both EMA variants have a value.
                // Carrying page one's EMA still matches. Seeding page two at 99 does not.
                assert!(evaluate_rule_latest(&rule, &bars[..1_005]).unwrap().matched);
                let restarted = evaluate_rule_latest(&rule, &bars[1_000..1_005]).unwrap();
                assert_eq!(restarted.value, Some(0.0));
                assert!(!restarted.matched);
            }

            for page_size in [1, 17, 1_000, 5_000] {
                let mut evaluator = ForwardRuleEvaluator::new(&rule).unwrap();
                let mut endpoints = Vec::new();
                let mut match_dates = Vec::new();
                let mut ordinal = 0;
                for page in bars.chunks(page_size) {
                    for bar in page {
                        ordinal += 1;
                        let verdict = evaluator.advance(*bar).value.map(|value| value != 0.0);
                        if ordinal >= warmup {
                            endpoints.push((ordinal, bar.date, verdict));
                            if verdict == Some(true) {
                                match_dates.push(bar.date);
                            }
                        }
                    }
                }

                let case = format!("{eligible_count} eligible endpoints, page size {page_size}");
                assert_eq!(endpoints, expected_endpoints, "{case}");
                assert_eq!(match_dates, expected_dates, "{case}");
            }
        }
    }

    #[test]
    fn ns01_evaluator_division_by_zero_is_null_not_infinity() {
        let bars = bars_from_closes(&[10.0, 11.0]);
        let expression = ExprV1::Binary {
            op: BinaryOpV1::Div,
            left: Box::new(ExprV1::Field {
                field: OhlcvFieldV1::Close,
                lookback: 0,
            }),
            right: Box::new(ExprV1::Number { value: 0.0 }),
        };
        let value = evaluate_expression(&expression, &bars).expect("evaluate");
        assert_eq!(value.numeric(), vec![None, None]);
    }

    #[test]
    fn ns01_evaluator_cross_semantics_match_the_engine() {
        let bars = bars_from_closes(&[9.0, 10.0, 11.0, 12.0]);
        let close = ExprV1::Field {
            field: OhlcvFieldV1::Close,
            lookback: 0,
        };
        let previous = ExprV1::Field {
            field: OhlcvFieldV1::Close,
            lookback: 1,
        };
        // `crossover(close, close[1])` can never fire: a series never crosses its own
        // previous value upward by a full bar. The original expectation was therefore
        // wrong. Compare against a real level so this test exercises the accepted
        // engine semantics instead (`previous <= level && current > level`, ties
        // included), exactly like `calculateCross` in the TypeScript formula engine.
        let level = ExprV1::Number { value: 10.5 };
        let over = ExprV1::Cross {
            kind: CrossKindV1::Over,
            left: Box::new(close.clone()),
            right: Box::new(level.clone()),
        };
        assert_eq!(
            evaluate_expression(&over, &bars).unwrap().boolean(),
            vec![None, Some(false), Some(true), Some(false)],
            "close 9,10,11,12 crossing up through 10.5"
        );

        // A tie followed by a higher value counts as a cross-over.
        let level = ExprV1::Number { value: 10.0 };
        let over = ExprV1::Cross {
            kind: CrossKindV1::Over,
            left: Box::new(close.clone()),
            right: Box::new(level.clone()),
        };
        assert_eq!(
            evaluate_expression(&over, &bars).unwrap().boolean(),
            vec![None, Some(false), Some(true), Some(false)],
            "10 ties the level and 11 clears it, so the cross fires at index 2"
        );

        let under = ExprV1::Cross {
            kind: CrossKindV1::Under,
            left: Box::new(close),
            right: Box::new(level),
        };
        assert_eq!(
            evaluate_expression(&under, &bars).unwrap().boolean(),
            vec![None, Some(false), Some(false), Some(false)],
            "a rising series never crosses under the level"
        );

        // A series can never cross its own one-bar-lagged copy upward: the lagged copy is
        // always <= the current value, so the strict `current > right` half never holds.
        // Index 1 is null because the lagged side has no value there yet.
        let shifted = ExprV1::Cross {
            kind: CrossKindV1::Over,
            left: Box::new(ExprV1::Field {
                field: OhlcvFieldV1::Close,
                lookback: 0,
            }),
            right: Box::new(previous),
        };
        assert_eq!(
            evaluate_expression(&shifted, &bars).unwrap().boolean(),
            vec![None, None, Some(false), Some(false)]
        );
    }

    #[test]
    fn ns01_field_lookback_is_completed_bar_semantics() {
        let bars = bars_from_closes(&[10.0, 20.0, 30.0]);
        let prior = ExprV1::Field {
            field: OhlcvFieldV1::Close,
            lookback: 1,
        };
        assert_eq!(
            evaluate_expression(&prior, &bars).unwrap().numeric(),
            vec![None, Some(10.0), Some(20.0)]
        );
        assert_eq!(minimum_bars_for_expression(&prior), 2);
    }

    #[test]
    fn ns01_atr_seeds_from_the_first_true_range() {
        let bars = bars_from_closes(&[10.0, 12.0, 11.0]);
        let value = atr(&bars, 2);
        assert_eq!(value[0], None);
        let first_range = 2.0;
        let second_range = (3.0f64)
            .max((12.0 - 10.0f64).abs())
            .max((10.0 - 10.0f64).abs());
        assert!((value[1].unwrap() - (first_range + second_range) / 2.0).abs() < 1e-12);
        assert!(value[2].is_some());
    }

    #[test]
    fn ns01_pattern_nodes_are_never_silently_approximated() {
        let expression = ExprV1::Pattern {
            id: "chart_common_gap".to_string(),
        };
        assert!(contains_pattern(&expression));
        let error = evaluate_expression(&expression, &bars_from_closes(&[1.0]))
            .expect_err("pattern must not evaluate numerically");
        assert!(error.contains("dedicated detector"));
    }
}
