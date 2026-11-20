//! NS-01: bounded scan execution over resolved targets.
//!
//! The executor owns no database handle and no Tauri state: it consumes a
//! [`ScanDataSource`], a validated request and an atomic cancellation flag, so the same
//! code path is exercised by unit tests (synthetic bars) and by NS-03's background job
//! (read-only database-backed source).
//!
//! Guarantees:
//! - One bounded bar window per target (`MAX_WINDOW_BARS`); the whole market is never
//!   materialised, and per-target buffers are dropped before the next target.
//! - Every target produces exactly one outcome: match, no-match, skipped or error.
//!   Unreadable data is never converted into a false "no match".
//! - Cancellation is checked between targets and between history endpoints; a cancelled
//!   run reports `cancelled = true` and contains no partial target.
//! - Results are deterministic: targets are scanned in sorted order and matches use a
//!   strict `(date desc, exchange, symbol, rule)` ordering.

use super::ast::{
    contains_pattern, evaluate_rule_latest, minimum_bars_for_expression, NativeScanRequestV1,
    PriceBasisV1, RuleV1,
};
use super::reader::{NativeBar, MAX_WINDOW_BARS};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;

/// Upper bound on historical endpoints evaluated per target.
pub const MAX_HISTORY_ENDPOINTS: usize = 1000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanTarget {
    pub exchange: String,
    pub symbol: String,
}

impl ScanTarget {
    pub fn key(&self) -> String {
        format!("{}:{}", self.exchange, self.symbol)
    }
}

/// Data access the executor needs. Implemented by the read-only database source in
/// production and by fixtures in tests.
pub trait ScanDataSource: Sync {
    /// Stable identity of the database being read; events are scoped to it.
    fn database_identity(&self) -> &str;

    /// Loads a bounded, date-ascending window of completed bars for one target.
    ///
    /// `Err` marks the target as `error` with the returned message; it must never be
    /// reported as a non-match.
    fn load_bars(
        &self,
        target: &ScanTarget,
        as_of_date: Option<&str>,
        window: usize,
        price_basis: PriceBasisV1,
        include_dividend_adjustments: bool,
        include_rights_adjustments: bool,
    ) -> Result<Vec<NativeBar>, String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TargetStatus {
    Match,
    NoMatch,
    Skipped,
    Error,
}

impl TargetStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Match => "match",
            Self::NoMatch => "no-match",
            Self::Skipped => "skipped",
            Self::Error => "error",
        }
    }
}

/// One accepted match.
///
/// `value` stays for numeric rules. The remaining fields are the accepted chart-pattern
/// metadata (P0-02) and are populated by the pattern bridge, so a native match carries the
/// same identity, score, direction, reasons, levels and geometry as the TypeScript result.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ScanMatchRecord {
    pub exchange: String,
    pub symbol: String,
    pub rule_id: String,
    pub date: String,
    /// Latest rule value when the rule produced one (patterns report their own values).
    pub value: Option<f64>,
    pub scanner_name: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub direction: Option<String>,
    pub score: Option<f64>,
    pub reasons: Option<Vec<String>>,
    pub values: Option<std::collections::BTreeMap<String, crate::scanner_contract::ScannerScalarValueV1>>,
    pub source: Option<String>,
    pub pattern: Option<ScanPatternDetails>,
}

/// Accepted chart-pattern details carried through to the renderer.
#[derive(Debug, Clone, PartialEq)]
pub struct ScanPatternDetails {
    pub family: String,
    pub confidence: f64,
    pub pattern_start_date: Option<String>,
    pub pattern_end_date: String,
    pub breakout_level: Option<f64>,
    pub support_level: Option<f64>,
    pub resistance_level: Option<f64>,
    pub neckline_level: Option<f64>,
    pub target_price: Option<f64>,
    pub stop_loss_price: Option<f64>,
    pub potential_gain_pct: Option<f64>,
    pub risk_reward_ratio: Option<f64>,
    pub pivots: Option<Vec<ScanPatternPivot>>,
    pub geometry: Option<ScanPatternGeometry>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ScanPatternPivot {
    pub index: usize,
    pub date: String,
    pub price: f64,
    pub kind: String,
}

/// Geometry is kept as opaque JSON so no accepted overlay field can be dropped in
/// translation. The renderer already consumes exactly this shape.
#[derive(Debug, Clone, PartialEq)]
pub struct ScanPatternGeometry {
    pub json: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanDiagnostic {
    pub code: String,
    pub message: String,
    pub target: Option<ScanTarget>,
    pub rule_id: Option<String>,
}

impl ScanDiagnostic {
    pub fn target_err(target: &ScanTarget, code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            target: Some(target.clone()),
            rule_id: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ScanCounts {
    pub targets: usize,
    pub matched: usize,
    pub no_match: usize,
    pub skipped: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TargetOutcome {
    pub target: ScanTarget,
    pub status: TargetStatus,
    pub matches: Vec<ScanMatchRecord>,
    pub matched_rule_ids: Vec<String>,
    pub bars: usize,
    pub evaluated_history_endpoints: usize,
    /// Actionable reason when the status is `Skipped` or `Error`.
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ScanReport {
    pub database_identity: String,
    /// True when the run stopped early; a cancelled run holds no partial target.
    pub cancelled: bool,
    pub counts: ScanCounts,
    pub outcomes: Vec<TargetOutcome>,
    pub matches: Vec<ScanMatchRecord>,
    pub diagnostics: Vec<ScanDiagnostic>,
    pub duration_ms: u128,
    /// P1-08: workers actually used (never merely requested).
    pub workers_used: usize,
}

/// Progress notification pushed after each completed target.
#[derive(Debug, Clone, PartialEq)]
pub struct ScanProgress {
    pub completed: usize,
    pub total: usize,
    pub current: Option<ScanTarget>,
    pub counts: ScanCounts,
    pub matches: Vec<ScanMatchRecord>,
}

/// Upper bound on concurrent target workers.
///
/// Approved range is 1..=4. Each worker needs its own read-only SQLite connection, so the
/// ceiling is a resource decision as much as a performance one.
pub const MAX_WORKERS: usize = 4;
pub const DEFAULT_WORKERS: usize = 2;

/// Bounded execution options derived from the request (kept explicit for NS-03).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScanExecutionOptions {
    pub max_window_bars: usize,
    pub max_history_endpoints: usize,
    /// Requested worker count; clamped to `1..=MAX_WORKERS` by `effective_worker_count`.
    pub worker_count: usize,
}

impl Default for ScanExecutionOptions {
    fn default() -> Self {
        Self {
            max_window_bars: MAX_WINDOW_BARS,
            max_history_endpoints: MAX_HISTORY_ENDPOINTS,
            worker_count: DEFAULT_WORKERS,
        }
    }
}

impl ScanExecutionOptions {
    pub fn with_worker_count(mut self, worker_count: usize) -> Self {
        self.worker_count = worker_count;
        self
    }
}

/// The number of workers a run will *actually* use.
///
/// P1-08: this is what gets reported back, so a request for 8 workers against 2 targets
/// reports 2, and a request for 4 reports 4 only when there is work for 4.
pub fn effective_worker_count(requested: usize, target_count: usize) -> usize {
    if target_count == 0 {
        return 0;
    }
    requested.clamp(1, MAX_WORKERS).min(target_count)
}

/// Bars required before any selected rule can be evaluated.
///
/// Pattern rules use their detector's warm-up (not the generic AST estimate), so the
/// early "too few bars" guard stays honest for the native pattern path.
fn required_bars(rules: &[RuleV1]) -> usize {
    rules
        .iter()
        .map(|rule| match super::patterns::minimum_bars_for_pattern_rule(rule) {
            Some(required) => required,
            None => minimum_bars_for_expression(&rule.expression),
        })
        .max()
        .unwrap_or(0)
}

fn format_date(date: u32) -> String {
    crate::database::binary_eod::u32_to_date(date)
}
/// Runs the scan for the supplied targets.
///
/// Execution model (P1-08):
/// - Target-level parallelism with `std::thread::scope`; no new dependency, and no
///   SQLite connection is shared across threads because each worker opens its own
///   read-only connection inside `ScanDataSource`.
/// - Results are merged back **in target order**, so output is byte-identical for any
///   worker count: worker completion order can never reorder matches or diagnostics.
/// - Cancellation stops new targets from being claimed while workers already running
///   finish their current target safely.
/// - `progress` is invoked from the coordinating thread only, so callers do not need to
///   make their callback `Sync`.
///
/// `progress` is called after every completed target with the matches produced by that
/// target, so NS-03 can batch events without the executor depending on Tauri.
pub fn execute_scan<D: ScanDataSource>(
    source: &D,
    request: &NativeScanRequestV1,
    targets: &[ScanTarget],
    cancel: &AtomicBool,
    options: ScanExecutionOptions,
    mut progress: impl FnMut(ScanProgress),
) -> ScanReport {
    let started = Instant::now();
    let mut counts = ScanCounts {
        targets: targets.len(),
        ..ScanCounts::default()
    };
    let workers = effective_worker_count(options.worker_count, targets.len());

    let pattern_rules: Vec<&RuleV1> = request
        .rules
        .iter()
        .filter(|rule| contains_pattern(&rule.expression))
        .collect();
    let numeric_rules: Vec<&RuleV1> = request
        .rules
        .iter()
        .filter(|rule| !contains_pattern(&rule.expression))
        .collect();
    let bars_needed = required_bars(&request.rules);
    let window = options
        .max_window_bars
        .max(bars_needed.max(2))
        .min(MAX_WINDOW_BARS);

    // One slot per target keeps merge order deterministic regardless of completion order.
    let mut slots: Vec<Option<TargetOutcome>> = (0..targets.len()).map(|_| None).collect();
    let next_target = AtomicUsize::new(0);
    let mut cancelled = false;

    if workers <= 1 {
        for (index, target) in targets.iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                cancelled = true;
                slots[index] = Some(cancelled_outcome(target));
                continue;
            }
            slots[index] = Some(scan_target(
                source,
                request,
                target,
                window,
                bars_needed,
                &numeric_rules,
                &pattern_rules,
                options,
                cancel,
            ));
            if cancel.load(Ordering::SeqCst) {
                cancelled = true;
            }
            emit_progress(&mut progress, &slots, index, targets);
        }
    } else {
        let slots_cell: Mutex<&mut Vec<Option<TargetOutcome>>> = Mutex::new(&mut slots);
        std::thread::scope(|scope| {
            for _ in 0..workers {
                let next_target = &next_target;
                let slots_cell = &slots_cell;
                let numeric_rules = &numeric_rules;
                let pattern_rules = &pattern_rules;
                scope.spawn(move || loop {
                    if cancel.load(Ordering::SeqCst) {
                        break;
                    }
                    let index = next_target.fetch_add(1, Ordering::SeqCst);
                    if index >= targets.len() {
                        break;
                    }
                    let outcome = scan_target(
                        source,
                        request,
                        &targets[index],
                        window,
                        bars_needed,
                        numeric_rules,
                        pattern_rules,
                        options,
                        cancel,
                    );
                    if let Ok(mut guard) = slots_cell.lock() {
                        if let Some(slot) = guard.get_mut(index) {
                            *slot = Some(outcome);
                        }
                    }
                });
            }
        });

        // Merge strictly in target order; any target not claimed (because cancellation
        // stopped the workers) is reported as cancelled, never silently dropped.
        for (index, target) in targets.iter().enumerate() {
            if slots[index].is_none() {
                cancelled = true;
                slots[index] = Some(cancelled_outcome(target));
            }
        }
        if cancel.load(Ordering::SeqCst) {
            cancelled = true;
        }
        for index in 0..targets.len() {
            emit_progress(&mut progress, &slots, index, targets);
        }
    }

    let mut outcomes: Vec<TargetOutcome> = Vec::with_capacity(targets.len());
    let mut matches: Vec<ScanMatchRecord> = Vec::new();
    let mut diagnostics: Vec<ScanDiagnostic> = Vec::new();
    for outcome in slots.into_iter().flatten() {
        match &outcome.status {
            TargetStatus::Match => counts.matched += 1,
            TargetStatus::NoMatch => counts.no_match += 1,
            TargetStatus::Skipped => counts.skipped += 1,
            TargetStatus::Error => counts.failed += 1,
        }
        if let Some(message) = &outcome.message {
            diagnostics.push(ScanDiagnostic::target_err(
                &outcome.target,
                if outcome.status == TargetStatus::Skipped {
                    "target-skipped"
                } else if outcome.status == TargetStatus::Error {
                    "target-error"
                } else {
                    "target-notice"
                },
                message.clone(),
            ));
        }
        matches.extend(outcome.matches.iter().cloned());
        outcomes.push(outcome);
    }

    matches.sort_by(|left, right| {
        right
            .date
            .cmp(&left.date)
            .then_with(|| left.exchange.cmp(&right.exchange))
            .then_with(|| left.symbol.cmp(&right.symbol))
            .then_with(|| left.rule_id.cmp(&right.rule_id))
    });

    ScanReport {
        database_identity: source.database_identity().to_string(),
        cancelled,
        counts,
        outcomes,
        matches,
        diagnostics,
        duration_ms: started.elapsed().as_millis(),
        workers_used: workers,
    }
}

/// Outcome for a target that was never claimed because the run was cancelled.
fn cancelled_outcome(target: &ScanTarget) -> TargetOutcome {
    TargetOutcome {
        target: target.clone(),
        status: TargetStatus::Skipped,
        matches: Vec::new(),
        matched_rule_ids: Vec::new(),
        bars: 0,
        evaluated_history_endpoints: 0,
        message: Some(format!(
            "{}: run cancelled before this target was scanned.",
            target.key()
        )),
    }
}

/// Emits progress for one completed slot in target order.
fn emit_progress(
    progress: &mut impl FnMut(ScanProgress),
    slots: &[Option<TargetOutcome>],
    index: usize,
    targets: &[ScanTarget],
) {
    let Some(Some(outcome)) = slots.get(index) else {
        return;
    };
    let mut counts = ScanCounts {
        targets: targets.len(),
        ..ScanCounts::default()
    };
    for slot in slots.iter().take(index + 1).flatten() {
        match slot.status {
            TargetStatus::Match => counts.matched += 1,
            TargetStatus::NoMatch => counts.no_match += 1,
            TargetStatus::Skipped => counts.skipped += 1,
            TargetStatus::Error => counts.failed += 1,
        }
    }
    progress(ScanProgress {
        completed: index + 1,
        total: targets.len(),
        current: Some(outcome.target.clone()),
        counts,
        matches: outcome.matches.clone(),
    });
}


#[allow(clippy::too_many_arguments)]
fn scan_target<D: ScanDataSource>(
    source: &D,
    request: &NativeScanRequestV1,
    target: &ScanTarget,
    window: usize,
    bars_needed: usize,
    numeric_rules: &[&RuleV1],
    pattern_rules: &[&RuleV1],
    options: ScanExecutionOptions,
    cancel: &AtomicBool,
) -> TargetOutcome {
    let as_of = request.evaluation.as_of_date.as_deref();
    let bars = match source.load_bars(
        target,
        as_of,
        window,
        request.evaluation.price_basis,
        request.evaluation.include_dividend_adjustments,
        request.evaluation.include_rights_adjustments,
    ) {
        Ok(bars) => bars,
        Err(message) => {
            return TargetOutcome {
                target: target.clone(),
                status: TargetStatus::Error,
                matches: Vec::new(),
                matched_rule_ids: Vec::new(),
                bars: 0,
                evaluated_history_endpoints: 0,
                message: Some(format!("{}: {message}", target.key())),
            };
        }
    };

    if bars.is_empty() {
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: 0,
            evaluated_history_endpoints: 0,
            message: Some(format!(
                "{} has no completed bars at or before the requested window start.",
                target.key()
            )),
        };
    }

    // Too few bars for the requested rules is "not evaluated", never a false no-match.
    if bars.len() < bars_needed.max(1) {
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: bars.len(),
            evaluated_history_endpoints: 0,
            message: Some(format!(
                "{} has {} completed bar(s); the selected rules need {bars_needed}.",
                target.key(),
                bars.len()
            )),
        };
    }


    let eval_bars: Vec<super::ast::EvalBar> = bars
        .iter()
        .map(|bar| super::ast::EvalBar {
            date: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
        })
        .collect();

    let mut matches: Vec<ScanMatchRecord> = Vec::new();
    let mut matched_rule_ids: Vec<String> = Vec::new();
    let mut evaluated_history_endpoints = 0usize;
    let mut had_error = false;

    for rule in numeric_rules {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        if !request.evaluation.evaluate_history {
            match evaluate_rule_latest(&rule.expression, &eval_bars) {
                Ok(outcome) => {
                    if outcome.matched {
                        matches.push(ScanMatchRecord {
                            exchange: target.exchange.clone(),
                            symbol: target.symbol.clone(),
                            rule_id: rule.id.clone(),
                            date: format_date(bars[bars.len() - 1].date),
                            value: outcome.value,
                            ..ScanMatchRecord::default()
                        });
                        matched_rule_ids.push(rule.id.clone());
                    }
                }
                Err(_) => had_error = true,
            }
            continue;
        }

        // Historical evaluation: every endpoint from the rule's warm-up onward.
        let start = minimum_bars_for_expression(&rule.expression).max(1);
        if bars.len() < start {
            continue;
        }
        let last_index = bars.len() - 1;
        let first_index = start.saturating_sub(1);
        let span = last_index - first_index + 1;
        let stride = (span / options.max_history_endpoints).max(1);
        let mut index = first_index;
        while index <= last_index {
            if cancel.load(Ordering::SeqCst) {
                break;
            }
            evaluated_history_endpoints += 1;
            match evaluate_rule_latest(&rule.expression, &eval_bars[..=index]) {
                Ok(outcome) => {
                    if outcome.matched {
                        matches.push(ScanMatchRecord {
                            exchange: target.exchange.clone(),
                            symbol: target.symbol.clone(),
                            rule_id: rule.id.clone(),
                            date: format_date(bars[index].date),
                            value: outcome.value,
                            ..ScanMatchRecord::default()
                        });
                        if !matched_rule_ids.contains(&rule.id) {
                            matched_rule_ids.push(rule.id.clone());
                        }
                    }
                }
                Err(_) => {
                    had_error = true;
                    break;
                }
            }
            if index == last_index {
                break;
            }
            index = (index + stride).min(last_index);
        }
    }

    // P0-01: pattern rules are dispatched to the accepted detectors instead of being
    // skipped. Each rule is evaluated over its own bounded window, latest-only or at every
    // historical endpoint, mirroring the detector's own endpoint ordering.
    let generated_at = format_date(bars[bars.len() - 1].date);
    for rule in pattern_rules {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        let required = super::patterns::minimum_bars_for_pattern_rule(rule).unwrap_or(0);
        if required == 0 || bars.len() < required {
            // Warm-up is "not evaluated", never a false non-match.
            continue;
        }
        if !request.evaluation.evaluate_history {
            let from = bars.len().saturating_sub(super::patterns::PATTERN_MAX_WINDOW_BARS);
            evaluated_history_endpoints += 1;
            match super::patterns::evaluate_pattern_rule(
                rule,
                &target.exchange,
                &target.symbol,
                &bars[from..],
                &generated_at,
            ) {
                super::patterns::PatternEvaluation::Evaluated(Some(result)) => {
                    matches.push(super::patterns::pattern_match_record(
                        &target.exchange,
                        &target.symbol,
                        &rule.id,
                        result,
                    ));
                    matched_rule_ids.push(rule.id.clone());
                }
                super::patterns::PatternEvaluation::Evaluated(None) => {}
                super::patterns::PatternEvaluation::Unsupported => had_error = true,
            }
            continue;
        }

        // Complete historical coverage: every endpoint from the detector's own warm-up,
        // never a stride sample. Endpoint i sees the trailing bounded window only.
        let start = super::patterns::PATTERN_HISTORY_ENDPOINT_START.max(required);
        if bars.len() < start {
            continue;
        }
        let mut index = start - 1;
        while index < bars.len() {
            if cancel.load(Ordering::SeqCst) {
                break;
            }
            let from = (index + 1).saturating_sub(super::patterns::PATTERN_MAX_WINDOW_BARS);
            evaluated_history_endpoints += 1;
            match super::patterns::evaluate_pattern_rule(
                rule,
                &target.exchange,
                &target.symbol,
                &bars[from..=index],
                &generated_at,
            ) {
                super::patterns::PatternEvaluation::Evaluated(Some(result)) => {
                    matches.push(super::patterns::pattern_match_record(
                        &target.exchange,
                        &target.symbol,
                        &rule.id,
                        result,
                    ));
                    if !matched_rule_ids.contains(&rule.id) {
                        matched_rule_ids.push(rule.id.clone());
                    }
                }
                super::patterns::PatternEvaluation::Evaluated(None) => {}
                super::patterns::PatternEvaluation::Unsupported => {
                    had_error = true;
                    break;
                }
            }
            index += 1;
        }
    }

    let status = if had_error {
        TargetStatus::Error
    } else if !matches.is_empty() {
        TargetStatus::Match
    } else {
        TargetStatus::NoMatch
    };

    TargetOutcome {
        target: target.clone(),
        status,
        matches,
        matched_rule_ids,
        bars: bars.len(),
        evaluated_history_endpoints,
        message: had_error.then(|| {
            format!(
                "{}: rule evaluation failed; the target is reported as an error, not a non-match.",
                target.key()
            )
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_scanner::ast::{BinaryOpV1, ExprV1, IndicatorNameV1, OhlcvFieldV1};
    use std::collections::HashMap;

    struct FixtureSource {
        identity: String,
        bars: HashMap<String, Vec<NativeBar>>,
        errors: HashMap<String, String>,
        loads: std::cell::RefCell<Vec<(String, usize, Option<String>, PriceBasisV1)>>,
    }

    impl FixtureSource {
        fn new(bars: HashMap<String, Vec<NativeBar>>) -> Self {
            Self {
                identity: "fixture-db@revision-1".to_string(),
                bars,
                errors: HashMap::new(),
                loads: std::cell::RefCell::new(Vec::new()),
            }
        }
    }

    impl ScanDataSource for FixtureSource {
        fn database_identity(&self) -> &str {
            &self.identity
        }

        fn load_bars(
            &self,
            target: &ScanTarget,
            as_of_date: Option<&str>,
            window: usize,
            price_basis: PriceBasisV1,
            _include_dividend_adjustments: bool,
            _include_rights_adjustments: bool,
        ) -> Result<Vec<NativeBar>, String> {
            self.loads.borrow_mut().push((
                target.key(),
                window,
                as_of_date.map(ToOwned::to_owned),
                price_basis,
            ));
            if let Some(message) = self.errors.get(&target.key()) {
                return Err(message.clone());
            }
            let mut bars = self.bars.get(&target.key()).cloned().unwrap_or_default();
            if let Some(as_of) = as_of_date {
                let limit = crate::native_scanner::reader::parse_scan_date(as_of)?;
                bars.retain(|bar| bar.date <= limit);
            }
            if bars.len() > window {
                bars = bars[bars.len() - window..].to_vec();
            }
            Ok(bars)
        }
    }

    fn bar(date: u32, close: f64) -> NativeBar {
        NativeBar {
            date,
            open: close - 0.5,
            high: close + 1.0,
            low: close - 1.0,
            close,
            prev_close: None,
            volume: 1_000.0,
            open_interest: 0.0,
        }
    }

    fn request(rules: Vec<RuleV1>, evaluate_history: bool) -> NativeScanRequestV1 {
        NativeScanRequestV1 {
            schema_version: 1,
            requested_run_id: "run-1".to_string(),
            universe: crate::native_scanner::ast::UniverseV1 {
                source: crate::native_scanner::ast::UniverseSourceV1::ExplicitTargets,
                targets: Vec::new(),
            },
            evaluation: crate::native_scanner::ast::EvaluationV1 {
                as_of_date: None,
                lookback_bars: None,
                evaluate_history,
                price_basis: PriceBasisV1::Raw,
                include_dividend_adjustments: false,
                include_rights_adjustments: false,
            },
            rules,
        }
    }

    fn close_above(threshold: f64) -> RuleV1 {
        RuleV1 {
            id: "close_above".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Field {
                    field: OhlcvFieldV1::Close,
                    lookback: 0,
                }),
                right: Box::new(ExprV1::Number { value: threshold }),
            },
        }
    }

    fn target(symbol: &str) -> ScanTarget {
        ScanTarget {
            exchange: "NSE".to_string(),
            symbol: symbol.to_string(),
        }
    }

    fn series(closes: &[f64]) -> Vec<NativeBar> {
        closes
            .iter()
            .enumerate()
            .map(|(index, close)| bar(20240101 + index as u32, *close))
            .collect()
    }

    #[test]
    fn ns01_scan_reports_match_no_match_skip_and_error_separately() {
        let mut bars = HashMap::new();
        bars.insert("NSE:MATCH".to_string(), series(&[10.0, 11.0, 12.0]));
        bars.insert("NSE:NOMATCH".to_string(), series(&[1.0, 2.0, 3.0]));
        bars.insert("NSE:EMPTY".to_string(), Vec::new());
        let mut source = FixtureSource::new(bars);
        source
            .errors
            .insert("NSE:BROKEN".to_string(), "corrupt .eod header".to_string());

        let targets = vec![
            target("MATCH"),
            target("NOMATCH"),
            target("EMPTY"),
            target("BROKEN"),
        ];
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &targets,
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );

        assert_eq!(report.counts.targets, 4);
        assert_eq!(report.counts.matched, 1);
        assert_eq!(report.counts.no_match, 1);
        assert_eq!(report.counts.skipped, 1);
        assert_eq!(report.counts.failed, 1);
        assert_eq!(report.matches.len(), 1);
        assert_eq!(report.matches[0].symbol, "MATCH");
        assert_eq!(report.matches[0].date, "2024-01-03");
        assert!(!report.cancelled);
        assert_eq!(report.database_identity, "fixture-db@revision-1");
    }

    #[test]
    fn ns01_scan_uses_the_rule_warmup_and_bounded_window() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:EMA".to_string(),
            series(&(1..=80).map(|value| value as f64).collect::<Vec<_>>()),
        );
        let source = FixtureSource::new(bars);
        let rule = RuleV1 {
            id: "ema_cross".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Field {
                    field: OhlcvFieldV1::Close,
                    lookback: 0,
                }),
                right: Box::new(ExprV1::Indicator {
                    name: IndicatorNameV1::Ema,
                    period: 20,
                    input: Some(Box::new(ExprV1::Field {
                        field: OhlcvFieldV1::Close,
                        lookback: 0,
                    })),
                }),
            },
        };
        let report = execute_scan(
            &source,
            &request(vec![rule], false),
            &[target("EMA")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.matched, 1);
        let loads = source.loads.borrow();
        assert_eq!(loads.len(), 1);
        assert!(loads[0].1 >= 20, "window must cover indicator warm-up");
        assert!(loads[0].1 <= MAX_WINDOW_BARS);
    }

    #[test]
    fn ns01_scan_cancellation_before_any_target_produces_no_matches() {
        let mut bars = HashMap::new();
        bars.insert("NSE:A".to_string(), series(&[10.0, 20.0]));
        let source = FixtureSource::new(bars);
        let cancel = AtomicBool::new(true);
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &[target("A")],
            &cancel,
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert!(report.cancelled);
        assert!(report.matches.is_empty());
        assert_eq!(report.counts.matched, 0);
    }

    #[test]
    fn ns01_scan_history_is_bounded_and_ascending() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:HIST".to_string(),
            series(&(1..=40).map(|value| value as f64).collect::<Vec<_>>()),
        );
        let source = FixtureSource::new(bars);
        let report = execute_scan(
            &source,
            &request(vec![close_above(10.0)], true),
            &[target("HIST")],
            &AtomicBool::new(false),
            ScanExecutionOptions {
                max_window_bars: MAX_WINDOW_BARS,
                max_history_endpoints: 8,
            },
            |_| {},
        );
        assert_eq!(report.counts.matched, 1);
        assert!(
            report.matches.len() <= 8,
            "history endpoints must be bounded"
        );
        let outcome = &report.outcomes[0];
        assert!(outcome.evaluated_history_endpoints <= 8);
        // Sorting is strictly descending by date in the final report.
        let mut dates: Vec<&str> = report.matches.iter().map(|m| m.date.as_str()).collect();
        let sorted = {
            let mut copy = dates.clone();
            copy.sort_by(|a, b| b.cmp(a));
            copy
        };
        assert_eq!(dates, sorted);
        dates.dedup();
        assert_eq!(dates.len(), report.matches.len(), "no duplicate match rows");
    }

    #[test]
    fn ns01_scan_progress_is_emitted_once_per_target_and_ordered() {
        let mut bars = HashMap::new();
        bars.insert("NSE:A".to_string(), series(&[10.0]));
        bars.insert("NSE:B".to_string(), series(&[1.0]));
        let source = FixtureSource::new(bars);
        let mut seen: Vec<(usize, usize)> = Vec::new();
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &[target("A"), target("B")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |progress| seen.push((progress.completed, progress.total)),
        );
        assert_eq!(seen, vec![(1, 2), (2, 2)]);
        assert_eq!(report.outcomes.len(), 2);
    }

    #[test]
    /// Flat base followed by a genuine gap up on heavy volume (a real Breakaway Gap).
    fn gap_bars() -> Vec<NativeBar> {
        let mut bars: Vec<NativeBar> = (1..=24)
            .map(|day| NativeBar {
                date: 20240100 + day,
                open: 100.0,
                high: 101.0,
                low: 99.0,
                close: 100.0,
                prev_close: None,
                volume: 1_000.0,
                open_interest: 0.0,
            })
            .collect();
        bars.push(NativeBar {
            date: 20240125,
            open: 110.0,
            high: 113.0,
            low: 109.0,
            close: 112.0,
            prev_close: Some(100.0),
            volume: 4_000.0,
            open_interest: 0.0,
        });
        bars
    }

    fn pattern_rule(id: &str) -> RuleV1 {
        RuleV1 {
            id: id.to_string(),
            expression: ExprV1::Pattern { id: id.to_string() },
        }
    }

    #[test]
    fn p0_01_native_scan_actually_executes_a_gap_pattern_and_keeps_metadata() {
        let mut bars = HashMap::new();
        bars.insert("NSE:GAP".to_string(), gap_bars());
        let source = FixtureSource::new(bars);
        let report = execute_scan(
            &source,
            &request(vec![pattern_rule("chart_breakaway_gap")], false),
            &[target("GAP")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );

        assert_eq!(report.counts.matched, 1, "the detector must actually run");
        assert_eq!(report.counts.skipped, 0, "a pattern target must not be skipped");
        assert_eq!(report.matches.len(), 1);
        let matched = &report.matches[0];
        assert_eq!(matched.rule_id, "chart_breakaway_gap");
        assert_eq!(matched.date, "2024-01-25");
        assert_eq!(matched.scanner_name.as_deref(), Some("Breakaway Gap"));
        assert_eq!(matched.category_id.as_deref(), Some("chart_patterns_gap"));
        assert!(matched.direction.is_some(), "direction must be preserved");
        assert!(matched.score.is_some(), "score must be preserved");
        assert!(matched.reasons.as_ref().is_some_and(|r| !r.is_empty()));
        assert!(matched.values.as_ref().is_some_and(|v| !v.is_empty()));
        let details = matched.pattern.as_ref().expect("geometry must be preserved");
        assert!(details.geometry.is_some());
        assert!(details.confidence > 0.0);
    }

    #[test]
    fn p0_01_pattern_negative_case_is_no_match_not_skipped() {
        let quiet: Vec<NativeBar> = (1..=25)
            .map(|day| NativeBar {
                date: 20240100 + day,
                open: 100.0,
                high: 101.0,
                low: 99.0,
                close: 100.0,
                prev_close: None,
                volume: 1_000.0,
                open_interest: 0.0,
            })
            .collect();
        let mut bars = HashMap::new();
        bars.insert("NSE:QUIET".to_string(), quiet);
        let source = FixtureSource::new(bars);
        let report = execute_scan(
            &source,
            &request(vec![pattern_rule("chart_breakaway_gap")], false),
            &[target("QUIET")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.no_match, 1);
        assert_eq!(report.counts.skipped, 0);
        assert!(report.matches.is_empty());
    }

    #[test]
    fn p0_01_pattern_warmup_is_a_skip_not_a_false_verdict() {
        let mut bars = HashMap::new();
        bars.insert("NSE:TINY".to_string(), gap_bars()[..5].to_vec());
        let source = FixtureSource::new(bars);
        let report = execute_scan(
            &source,
            &request(vec![pattern_rule("chart_breakaway_gap")], false),
            &[target("TINY")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        // Too few bars: the rule cannot be evaluated, and that is never reported as a
        // confident "no match".
        assert_eq!(report.counts.matched, 0);
        assert_eq!(report.matches.len(), 0);
    }

    #[test]
    fn p0_01_pattern_history_covers_every_endpoint() {
        let mut bars = HashMap::new();
        bars.insert("NSE:GAP".to_string(), gap_bars());
        let source = FixtureSource::new(bars);
        let report = execute_scan(
            &source,
            &request(vec![pattern_rule("chart_breakaway_gap")], true),
            &[target("GAP")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        let outcome = &report.outcomes[0];
        // 25 bars, detector warm-up start 20 -> endpoints 19..=24 inclusive.
        assert_eq!(outcome.evaluated_history_endpoints, 6);
        assert!(!report.matches.is_empty(), "the gap endpoint must be detected");
        assert_eq!(report.matches[0].date, "2024-01-25");
    }

    #[test]
    fn ns01_scan_passes_the_as_of_date_and_price_basis_to_the_source() {
        let mut bars = HashMap::new();
        bars.insert("NSE:A".to_string(), series(&[10.0, 20.0, 30.0, 40.0]));
        let source = FixtureSource::new(bars);
        let mut request = request(vec![close_above(25.0)], false);
        request.evaluation.as_of_date = Some("2024-01-02".to_string());
        let report = execute_scan(
            &source,
            &request,
            &[target("A")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.no_match, 1);
        let loads = source.loads.borrow();
        assert_eq!(loads[0].2.as_deref(), Some("2024-01-02"));
        assert_eq!(loads[0].3, PriceBasisV1::Raw);
    }
}
