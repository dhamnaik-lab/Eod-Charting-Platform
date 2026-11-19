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

pub const MAX_AST_DEPTH: usize = 24;
pub const MAX_AST_NODES: usize = 512;
pub const MAX_RULES: usize = 32;
pub const MAX_INDICATOR_PERIOD: usize = 400;
pub const MAX_LOOKBACK: usize = 2000;
pub const MAX_LOOKBACK_BARS: usize = 5000;
pub const MAX_EXPLICIT_TARGETS: usize = 5000;
pub const MAX_ID_LENGTH: usize = 128;

/// Chart patterns with accepted, fixture-backed Rust parity. Everything else stays on
/// the preserved TypeScript worker path.
pub const SUPPORTED_PATTERN_IDS: [&str; 4] = [
    "chart_breakaway_gap",
    "chart_common_gap",
    "chart_runaway_gap",
    "chart_exhaustion_gap",
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

fn as_identifier(value: Option<&Value>, path: &str, issues: &mut Vec<ValidationIssue>) -> Option<String> {
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
    let valid = !text.trim().is_empty()
        && text.len() <= MAX_ID_LENGTH
        && text
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

fn as_iso_date(value: Option<&Value>, path: &str, issues: &mut Vec<ValidationIssue>) -> Option<String> {
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
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        issues.push(ValidationIssue::new(
            path,
            "invalid-date",
            format!("{path} is not a real calendar date."),
        ));
        return None;
    }
    Some(text.to_string())
}

fn parse_field(value: Option<&Value>, path: &str, issues: &mut Vec<ValidationIssue>) -> Option<OhlcvFieldV1> {
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

fn parse_binary_op(value: Option<&Value>, path: &str, issues: &mut Vec<ValidationIssue>) -> Option<BinaryOpV1> {
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
            reject_unknown_keys(object, &["kind", "field", "lookback"], path, &mut state.issues);
            let field = parse_field(object.get("field"), &format!("{path}.field"), &mut state.issues)?;
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
            let left = parse_expr(object.get("left")?, &format!("{path}.left"), depth + 1, state)?;
            let right =
                parse_expr(object.get("right")?, &format!("{path}.right"), depth + 1, state)?;
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
pub fn parse_native_scan_request_v1(value: &Value) -> Result<NativeScanRequestV1, Vec<ValidationIssue>> {
    let mut issues: Vec<ValidationIssue> = Vec::new();
    let Some(root) = as_object(value, "request", &mut issues) else {
        return Err(issues);
    };
    reject_unknown_keys(
        root,
        &["schemaVersion", "requestedRunId", "universe", "evaluation", "rules"],
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
    let universe = root
        .get("universe")
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
                        let symbol =
                            as_identifier(target.get("symbol"), &format!("{path}.symbol"), &mut issues);
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
    let evaluation = root
        .get("evaluation")
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
    let rules = root.get("rules").and_then(Value::as_array).and_then(|rules| {
        if rules.is_empty() || rules.len() > MAX_RULES {
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
            let Some(id) = as_identifier(object.get("id"), &format!("{path}.id"), &mut state.issues)
            else {
                continue;
            };
            if !seen.insert(id.clone()) {
                state.issues.push(ValidationIssue::new(
                    format!("{path}.id"),
                    "duplicate-rule",
                    format!("{path}.id \"{id}\" is duplicated."),
                ));
                continue;
            }
            let Some(expression) = object
                .get("expression")
                .and_then(|value| parse_expr(value, &format!("{path}.expression"), 1, &mut state))
            else {
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
    Ok(NativeScanRequestV1 {
        schema_version: 1,
        requested_run_id,
        universe: universe.expect("validated universe"),
        evaluation: evaluation.expect("validated evaluation"),
        rules: rules.expect("validated rules"),
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

/// SMA matching the TypeScript engine: first value at `period - 1`, `None` while any
/// window entry is undefined.
pub fn sma(values: &[Option<f64>], period: usize) -> Series {
    let mut result: Series = vec![None; values.len()];
    if period == 0 || values.len() < period {
        return result;
    }
    for index in (period - 1)..values.len() {
        let mut sum = 0.0;
        let mut valid = true;
        for offset in (index + 1 - period)..=index {
            match values[offset] {
                Some(value) => sum += value,
                None => {
                    valid = false;
                    break;
                }
            }
        }
        if valid {
            result[index] = Some(sum / period as f64);
        }
    }
    result
}

/// EMA matching the TypeScript engine: seeded with the SMA of the first `period` valid
/// values, then `(value - ema) * multiplier + ema`. A `None` block resets the seed.
pub fn ema(values: &[Option<f64>], period: usize) -> Series {
    let mut result: Series = vec![None; values.len()];
    if period == 0 {
        return result;
    }
    let multiplier = 2.0 / (period as f64 + 1.0);
    let mut seed_count = 0usize;
    let mut seed_sum = 0.0;
    let mut current: Option<f64> = None;
    for (index, value) in values.iter().enumerate() {
        let Some(value) = *value else {
            seed_count = 0;
            seed_sum = 0.0;
            current = None;
            continue;
        };
        match current {
            None => {
                seed_sum += value;
                seed_count += 1;
                if seed_count == period {
                    current = Some(seed_sum / period as f64);
                    result[index] = current;
                }
            }
            Some(previous) => {
                let next = (value - previous) * multiplier + previous;
                current = Some(next);
                result[index] = Some(next);
            }
        }
    }
    result
}

/// RSI matching the TypeScript engine's seed/averaging rules.
pub fn rsi(values: &[Option<f64>], period: usize) -> Series {
    let mut result: Series = vec![None; values.len()];
    if period == 0 || values.len() <= period {
        return result;
    }
    let mut gains: Vec<f64> = Vec::new();
    let mut losses: Vec<f64> = Vec::new();
    let mut average_gain: Option<f64> = None;
    let mut average_loss: Option<f64> = None;
    for index in 1..values.len() {
        let (Some(current), Some(previous)) = (values[index], values[index - 1]) else {
            gains.clear();
            losses.clear();
            average_gain = None;
            average_loss = None;
            continue;
        };
        let change = current - previous;
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);
        match (average_gain, average_loss) {
            (Some(gain_average), Some(loss_average)) => {
                let next_gain = (gain_average * (period as f64 - 1.0) + gain) / period as f64;
                let next_loss = (loss_average * (period as f64 - 1.0) + loss) / period as f64;
                average_gain = Some(next_gain);
                average_loss = Some(next_loss);
                result[index] = Some(rsi_value(next_gain, next_loss));
            }
            _ => {
                gains.push(gain);
                losses.push(loss);
                if gains.len() == period {
                    let gain_average: f64 = gains.iter().sum::<f64>() / period as f64;
                    let loss_average: f64 = losses.iter().sum::<f64>() / period as f64;
                    average_gain = Some(gain_average);
                    average_loss = Some(loss_average);
                    result[index] = Some(rsi_value(gain_average, loss_average));
                }
            }
        }
    }
    result
}

fn rsi_value(average_gain: f64, average_loss: f64) -> f64 {
    if average_loss == 0.0 {
        return 100.0;
    }
    let relative_strength = average_gain / average_loss;
    100.0 - (100.0 / (1.0 + relative_strength))
}

/// True range with the first bar's range as its seed value, then a plain SMA.
pub fn atr(bars: &[EvalBar], period: usize) -> Series {
    let true_ranges: Series = bars
        .iter()
        .enumerate()
        .map(|(index, bar)| {
            if index == 0 {
                return Some(bar.high - bar.low);
            }
            let previous = &bars[index - 1];
            Some(
                (bar.high - bar.low)
                    .max((bar.high - previous.close).abs())
                    .max((bar.low - previous.close).abs()),
            )
        })
        .collect();
    sma(&true_ranges, period)
}

fn field_series(bars: &[EvalBar], field: OhlcvFieldV1, lookback: usize) -> Series {
    let raw: Vec<Option<f64>> = bars
        .iter()
        .map(|bar| {
            Some(match field {
                OhlcvFieldV1::Open => bar.open,
                OhlcvFieldV1::High => bar.high,
                OhlcvFieldV1::Low => bar.low,
                OhlcvFieldV1::Close => bar.close,
                OhlcvFieldV1::Volume => bar.volume,
            })
        })
        .collect();
    raw.iter()
        .enumerate()
        .map(|(index, _)| {
            if index < lookback {
                None
            } else {
                raw[index - lookback]
            }
        })
        .collect()
}

fn numeric_zip(
    left: &Series,
    right: &Series,
    mut combine: impl FnMut(f64, f64) -> Option<f64>,
) -> Series {
    left.iter()
        .zip(right.iter())
        .map(|(left_value, right_value)| match (left_value, right_value) {
            (Some(left), Some(right)) => combine(*left, *right),
            _ => None,
        })
        .collect()
}

fn boolean_zip(
    left: &[Option<bool>],
    right: &[Option<bool>],
    logical_or: bool,
) -> Vec<Option<bool>> {
    left.iter()
        .zip(right.iter())
        .map(|(left_value, right_value)| match (left_value, right_value) {
            (Some(left), Some(right)) => Some(if logical_or { *left || *right } else { *left && *right }),
            // A definite result on one side short-circuits the undefined side.
            (Some(false), None) if !logical_or => Some(false),
            (None, Some(false)) if !logical_or => Some(false),
            (Some(true), None) if logical_or => Some(true),
            (None, Some(true)) if logical_or => Some(true),
            _ => None,
        })
        .collect()
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
            let mut values: Vec<Option<bool>> = vec![None; length];
            for index in 1..length {
                let (Some(previous_left), Some(previous_right), Some(current_left), Some(current_right)) = (
                    left[index - 1],
                    right[index - 1],
                    left[index],
                    right[index],
                ) else {
                    continue;
                };
                values[index] = Some(match kind {
                    CrossKindV1::Over => previous_left <= previous_right && current_left > current_right,
                    CrossKindV1::Under => previous_left >= previous_right && current_left < current_right,
                });
            }
            Ok(EvalValue::Boolean(values))
        }
        ExprV1::Binary { op, left, right } => {
            let left_value = evaluate_expression(left, bars)?;
            let right_value = evaluate_expression(right, bars)?;
            if op.is_logical() {
                let values = boolean_zip(
                    &left_value.boolean(),
                    &right_value.boolean(),
                    matches!(op, BinaryOpV1::Or),
                );
                return Ok(EvalValue::Boolean(values));
            }
            let left_series = left_value.numeric();
            let right_series = right_value.numeric();
            if op.is_comparison() {
                let comparison = *op;
                let values = numeric_zip(&left_series, &right_series, |left, right| {
                    Some(match comparison {
                        BinaryOpV1::Gt => left > right,
                        BinaryOpV1::Gte => left >= right,
                        BinaryOpV1::Lt => left < right,
                        BinaryOpV1::Lte => left <= right,
                        BinaryOpV1::Eq => left == right,
                        BinaryOpV1::Neq => left != right,
                        _ => unreachable!("non-comparison operator"),
                    })
                });
                return Ok(EvalValue::Boolean(
                    values.into_iter().map(|value| value.map(|flag| flag)).collect(),
                ));
            }
            let arithmetic = *op;
            let values = numeric_zip(&left_series, &right_series, |left, right| {
                Some(match arithmetic {
                    BinaryOpV1::Add => left + right,
                    BinaryOpV1::Sub => left - right,
                    BinaryOpV1::Mul => left * right,
                    BinaryOpV1::Div => {
                        if right == 0.0 {
                            return None;
                        }
                        left / right
                    }
                    _ => unreachable!("non-arithmetic operator"),
                })
            });
            Ok(EvalValue::Numeric(values))
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

    #[test]
    fn ns01_validator_accepts_a_minimal_request_and_dedups_targets() {
        let request = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "field", "field": "close", "lookback": 0 } }
        ])))
        .expect("valid request");
        assert_eq!(request.schema_version, 1);
        assert_eq!(request.requested_run_id, "run-1");
        assert_eq!(request.universe.targets, vec![("NSE".to_string(), "INFY".to_string())]);
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
        let issues = parse_native_scan_request_v1(&request_value(json!([{ "id": "r1", "expression": deep }])))
            .expect_err("too deep");
        assert!(issues.iter().any(|issue| issue.code == "max-depth"));
    }

    #[test]
    fn ns01_validator_rejects_negative_lookback_unsupported_pattern_and_duplicate_rules() {
        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "field", "field": "close", "lookback": -1 } }
        ])))
        .expect_err("negative lookback");
        assert!(issues.iter().any(|issue| issue.code == "not-an-integer"));

        let issues = parse_native_scan_request_v1(&request_value(json!([
            { "id": "r1", "expression": { "kind": "pattern", "id": "chart_head_shoulders" } }
        ])))
        .expect_err("unsupported pattern");
        assert!(issues.iter().any(|issue| issue.code == "unsupported-pattern"));

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
        assert!(issues.iter().any(|issue| issue.code == "basis-flag-conflict"));

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

        assert_eq!(sma(&closes, 3), vec![None, None, Some(11.0), Some(12.0), Some(37.0 / 3.0), Some(12.0)]);
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
        let over = ExprV1::Cross {
            kind: CrossKindV1::Over,
            left: Box::new(close.clone()),
            right: Box::new(previous),
        };
        assert_eq!(
            evaluate_expression(&over, &bars).unwrap().boolean(),
            vec![None, Some(true), Some(true), Some(true)]
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
        let second_range = (3.0f64).max((12.0 - 10.0f64).abs()).max((10.0 - 10.0f64).abs());
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
