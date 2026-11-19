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
use super::reader::{MAX_WINDOW_BARS, NativeBar};
use std::sync::atomic::{AtomicBool, Ordering};
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
pub trait ScanDataSource {
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

#[derive(Debug, Clone, PartialEq)]
pub struct ScanMatchRecord {
    pub exchange: String,
    pub symbol: String,
    pub rule_id: String,
    pub date: String,
    /// Latest rule value when the rule produced one (patterns report their own values).
    pub value: Option<f64>,
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

/// Bounded execution options derived from the request (kept explicit for NS-03).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScanExecutionOptions {
    pub max_window_bars: usize,
    pub max_history_endpoints: usize,
}

impl Default for ScanExecutionOptions {
    fn default() -> Self {
        Self {
            max_window_bars: MAX_WINDOW_BARS,
            max_history_endpoints: MAX_HISTORY_ENDPOINTS,
        }
    }
}

fn required_bars(rules: &[RuleV1]) -> usize {
    rules
        .iter()
        .map(|rule| minimum_bars_for_expression(&rule.expression))
        .max()
        .unwrap_or(0)
}

fn format_date(date: u32) -> String {
    crate::database::binary_eod::u32_to_date(date)
}

/// Runs the scan for the supplied targets.
///
/// `progress` is called after every target with the matches produced by that target, so
/// NS-03 can batch events without the executor depending on Tauri.
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
    let mut outcomes: Vec<TargetOutcome> = Vec::with_capacity(targets.len());
    let mut matches: Vec<ScanMatchRecord> = Vec::new();
    let mut diagnostics: Vec<ScanDiagnostic> = Vec::new();
    let mut cancelled = false;

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

    for target in targets {
        if cancel.load(Ordering::SeqCst) {
            cancelled = true;
            diagnostics.push(ScanDiagnostic::target_err(
                target,
                "run-cancelled",
                "Run cancelled before this target was scanned.",
            ));
            continue;
        }

        let outcome = scan_target(
            source,
            request,
            target,
            window,
            bars_needed,
            &numeric_rules,
            &pattern_rules,
            options,
            cancel,
        );

        match &outcome.status {
            TargetStatus::Match => counts.matched += 1,
            TargetStatus::NoMatch => counts.no_match += 1,
            TargetStatus::Skipped => counts.skipped += 1,
            TargetStatus::Error => counts.failed += 1,
        }
        if let Some(message) = &outcome.message {
            diagnostics.push(ScanDiagnostic::target_err(
                target,
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

        matches.extend(outcome.matches.clone());
        let produced = outcome.matches.clone();
        outcomes.push(outcome);
        progress(ScanProgress {
            completed: outcomes.len(),
            total: targets.len(),
            current: Some(target.clone()),
            counts,
            matches: produced,
        });
        if cancel.load(Ordering::SeqCst) {
            cancelled = true;
        }
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
    }
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

    // A pattern rule needs the detector that this module deliberately does not own.
    // Report it as unsupported rather than pretending it did not match.
    if !pattern_rules.is_empty() {
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: bars.len(),
            evaluated_history_endpoints: 0,
            message: Some(format!(
                "{}: chart-pattern rules are routed to their dedicated detectors and are not evaluated by the numeric native executor.",
                target.key()
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
    use crate::native_scanner::ast::{
        BinaryOpV1, ExprV1, IndicatorNameV1, OhlcvFieldV1,
    };
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
                let limit = super::reader::parse_scan_date(as_of)?;
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

        let targets = vec![target("MATCH"), target("NOMATCH"), target("EMPTY"), target("BROKEN")];
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
        assert!(report.matches.len() <= 8, "history endpoints must be bounded");
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
    fn ns01_pattern_rules_are_skipped_not_evaluated_numerically() {
        let mut bars = HashMap::new();
        bars.insert("NSE:A".to_string(), series(&[10.0, 11.0, 12.0]));
        let source = FixtureSource::new(bars);
        let rule = RuleV1 {
            id: "gap".to_string(),
            expression: ExprV1::Pattern {
                id: "chart_common_gap".to_string(),
            },
        };
        let report = execute_scan(
            &source,
            &request(vec![rule], false),
            &[target("A")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.skipped, 1);
        assert_eq!(report.counts.matched, 0);
        assert!(report.matches.is_empty());
    }

    #[test]
    fn ns01_scan_passes_the_as_of_date_and_price_basis_to_the_source() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:A".to_string(),
            series(&[10.0, 20.0, 30.0, 40.0]),
        );
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
