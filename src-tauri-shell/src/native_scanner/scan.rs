//! NS-01: bounded scan execution over resolved targets.
//!
//! The executor owns no database handle and no Tauri state: it consumes a
//! [`ScanDataSource`], a validated request and an atomic cancellation flag, so the same
//! code path is exercised by unit tests (synthetic bars) and by NS-03's background job
//! (read-only database-backed source).
//!
//! Guarantees:
//! - One bounded bar window per target (`MAX_WINDOW_BARS`); All History gap-pattern
//!   scans page backward with overlap rather than materialising the whole history.
//!   Per-target buffers are dropped before the next target.
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
use crate::scanner_contract::ScannerDirectionV1;
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
    pub values:
        Option<std::collections::BTreeMap<String, crate::scanner_contract::ScannerScalarValueV1>>,
    pub source: Option<String>,
    pub pattern: Option<ScanPatternDetails>,
    /// Historical grouping summary, mirroring `history` on the accepted contract result.
    pub history: Option<ScanMatchHistory>,
}

/// One grouped historical run of consecutive pattern matches.
///
/// The accepted TypeScript path (`src/features/chartPatterns/evaluation.ts`) groups
/// consecutive matches per `scannerId:direction`, keeps the *first* result of the run and
/// annotates it with the first/last matched date and the number of matches. Historical
/// native pattern matches use the same rule so opting in cannot change result counts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanMatchHistory {
    pub first_matched_date: String,
    pub last_matched_date: String,
    pub match_count: u64,
}

impl ScanMatchRecord {
    /// Direction component of the historical grouping key. Matches
    /// `historicalMatchKey` in the TypeScript evaluation (`scannerId:direction`), where an
    /// absent direction is the empty string rather than a distinct value.
    pub fn direction_as_key(&self) -> &str {
        self.direction.as_deref().unwrap_or("")
    }

    /// Direction in the transport's own spelling (`bullish` / `bearish` / `neutral`).
    ///
    /// The contract enum is `#[serde(rename_all = "lowercase")]`, so this is the same
    /// text the wire format and the TypeScript contract use. Deriving it from `Debug`
    /// would produce `Bullish`, which does not validate against the renderer contract.
    pub fn direction_wire_text(direction: ScannerDirectionV1) -> String {
        match direction {
            ScannerDirectionV1::Bullish => "bullish".to_string(),
            ScannerDirectionV1::Bearish => "bearish".to_string(),
            ScannerDirectionV1::Neutral => "neutral".to_string(),
        }
    }
}

/// Consecutive historical pattern runs, keyed by `rule:direction`.
///
/// Mirrors `historicalMatchKey` + the active/completed group loop in
/// `src/features/chartPatterns/evaluation.ts`: a run that continues at the next endpoint
/// extends its group, and a run that stops matching at an endpoint is complete and can
/// never be extended by a later, non-consecutive match.
#[derive(Default)]
struct HistoricalGroups {
    active: std::collections::BTreeMap<String, usize>,
    ordered: Vec<ScanMatchRecord>,
}

impl HistoricalGroups {
    /// Folds one endpoint's matches into the open runs.
    fn absorb(
        &mut self,
        endpoint: &mut std::collections::BTreeSet<String>,
        record: ScanMatchRecord,
    ) {
        let key = format!("{}:{}", record.rule_id, record.direction_as_key());
        endpoint.insert(key.clone());
        match self.active.get(&key).copied() {
            Some(position) => {
                let group = &mut self.ordered[position];
                if let Some(history) = group.history.as_mut() {
                    history.last_matched_date = record.date.clone();
                    history.match_count += 1;
                }
            }
            None => {
                let mut grouped = record;
                grouped.history = Some(ScanMatchHistory {
                    first_matched_date: grouped.date.clone(),
                    last_matched_date: grouped.date.clone(),
                    match_count: 1,
                });
                self.active.insert(key, self.ordered.len());
                self.ordered.push(grouped);
            }
        }
    }

    /// Fold an endpoint while traversing history newest-to-oldest. Retain the
    /// earliest match's metadata, exactly as the forward TypeScript grouping does,
    /// while preserving the latest matched date from the first endpoint encountered.
    fn absorb_reverse(
        &mut self,
        endpoint: &mut std::collections::BTreeSet<String>,
        record: ScanMatchRecord,
    ) {
        let key = format!("{}:{}", record.rule_id, record.direction_as_key());
        endpoint.insert(key.clone());
        if let Some(position) = self.active.get(&key).copied() {
            let existing = &self.ordered[position];
            if let Some(history) = existing.history.as_ref() {
                let last_matched_date = history.last_matched_date.clone();
                let match_count = history.match_count + 1;
                let mut earliest = record;
                earliest.history = Some(ScanMatchHistory {
                    first_matched_date: earliest.date.clone(),
                    last_matched_date,
                    match_count,
                });
                self.ordered[position] = earliest;
            }
        } else {
            let mut grouped = record;
            grouped.history = Some(ScanMatchHistory {
                first_matched_date: grouped.date.clone(),
                last_matched_date: grouped.date.clone(),
                match_count: 1,
            });
            self.active.insert(key, self.ordered.len());
            self.ordered.push(grouped);
        }
    }

    /// Closes every run that did not match at the endpoint just evaluated.
    fn end_endpoint(&mut self, endpoint: &std::collections::BTreeSet<String>) {
        self.active.retain(|key, _| endpoint.contains(key));
    }

    fn into_matches(self) -> Vec<ScanMatchRecord> {
        self.ordered
    }
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

/// Bars one rule needs before it can produce a non-`None` result.
///
/// Pattern rules use their detector's own warm-up (never the generic AST estimate), so
/// warm-up accounting stays honest for the native pattern path. This is evaluated **per
/// rule**: a 200-bar SMA must not suppress a `close > 0` rule that can already be
/// evaluated against 20 bars.
pub fn required_bars_for_rule(rule: &RuleV1) -> usize {
    match super::patterns::minimum_bars_for_pattern_rule(rule) {
        Some(required) => required,
        None => {
            let minimum = minimum_bars_for_expression(&rule.expression);
            // The accepted TypeScript batch skips an instrument with fewer than
            // two completed bars, even for a one-bar core close-location rule.
            // Restrict this floor to built-in core IDs; generic AST and pattern
            // warm-ups retain their existing per-rule behavior.
            if super::core_results::is_core_id(&rule.id) {
                minimum.max(2)
            } else {
                minimum
            }
        }
    }
}

/// Bars required before any selected rule can be evaluated (the window floor).
fn required_bars(rules: &[RuleV1]) -> usize {
    rules.iter().map(required_bars_for_rule).max().unwrap_or(0)
}

/// Bars to load for one target.
///
/// `evaluation.lookbackBars` is the caller's authoritative context limit (the TypeScript
/// runner truncates to it), so it caps the window instead of being silently replaced by
/// the execution maximum. The window is still widened to the warm-up the selected rules
/// actually need, otherwise every request below that warm-up would report "no rule has
/// enough warm-up data" instead of the rule's real verdict -- and it is still bounded by
/// `MAX_WINDOW_BARS`. A lookback wider than the executor maximum is clamped, never
/// allowed to bypass the bound.
pub fn evaluation_window(request: &NativeScanRequestV1, options: ScanExecutionOptions) -> usize {
    let cap = options.max_window_bars.max(1).min(MAX_WINDOW_BARS);
    let warmup = required_bars(&request.rules).max(1).min(MAX_WINDOW_BARS);
    let requested = match request.evaluation.lookback_bars {
        Some(lookback) => lookback.min(cap),
        None => cap,
    };
    requested.max(warmup).min(MAX_WINDOW_BARS)
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
    let window = evaluation_window(request, options);

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

/// All-history chart-pattern execution. Each read stays within MAX_WINDOW_BARS;
/// pages are traversed newest-first and evaluated in reverse endpoint order.
/// The oldest PATTERN_MAX_WINDOW_BARS records of a nonterminal page are context
/// only; its preceding page evaluates those endpoints. This yields complete
/// coverage without materializing a symbol's whole price history.
///
/// A shared grouping accumulator is carried across pages, so runs spanning a
/// page boundary are represented by exactly one earliest-endpoint result.
#[allow(clippy::too_many_arguments)]
fn scan_full_pattern_history<D: ScanDataSource>(
    source: &D,
    request: &NativeScanRequestV1,
    target: &ScanTarget,
    window: usize,
    pattern_rules: &[&RuleV1],
    cancel: &AtomicBool,
) -> TargetOutcome {
    use std::collections::BTreeSet;

    let fail = |message: String| TargetOutcome {
        target: target.clone(),
        status: TargetStatus::Error,
        matches: Vec::new(),
        matched_rule_ids: Vec::new(),
        bars: 0,
        evaluated_history_endpoints: 0,
        message: Some(format!("{}: {message}", target.key())),
    };

    let overlap = super::patterns::PATTERN_MAX_WINDOW_BARS;
    if window <= overlap {
        return fail(format!(
            "Complete historical pattern scanning requires a window larger than {overlap} bars."
        ));
    }

    let mut as_of = request.evaluation.as_of_date.clone();
    let mut expected_overlap: Option<Vec<NativeBar>> = None;
    let mut is_first_page = true;
    let mut latest_date = String::new();
    let mut total_unique_bars = 0usize;
    let mut evaluated_history_endpoints = 0usize;
    let mut rules_evaluated = 0usize;
    let mut matched_rule_ids: Vec<String> = Vec::new();
    let mut groups = HistoricalGroups::default();

    loop {
        if cancel.load(Ordering::SeqCst) {
            return cancelled_outcome(target);
        }
        let bars = match source.load_bars(
            target,
            as_of.as_deref(),
            window,
            request.evaluation.price_basis,
            request.evaluation.include_dividend_adjustments,
            request.evaluation.include_rights_adjustments,
        ) {
            Ok(bars) => bars,
            Err(message) => return fail(message),
        };
        if cancel.load(Ordering::SeqCst) {
            return cancelled_outcome(target);
        }
        if bars.len() > window {
            return fail("The scan source exceeded the bounded page size.".to_string());
        }
        if bars.windows(2).any(|pair| pair[0].date >= pair[1].date) {
            return fail("A historical page contains unsorted or duplicate dates.".to_string());
        }
        if let Some(bound) = as_of.as_deref() {
            let upper = match super::reader::parse_scan_date(bound) {
                Ok(value) => value,
                Err(message) => return fail(message),
            };
            if bars.last().is_some_and(|bar| bar.date > upper) {
                return fail("The scan source returned bars after its requested date.".to_string());
            }
        }
        if let Some(expected) = expected_overlap.take() {
            if bars.len() < expected.len() || bars[bars.len() - expected.len()..] != expected[..] {
                return fail(
                    "Historical page overlap changed during scanning; refusing incomplete results."
                        .to_string(),
                );
            }
        }
        if bars.is_empty() {
            if !is_first_page {
                return fail("A historical page disappeared during scanning.".to_string());
            }
            return TargetOutcome {
                target: target.clone(),
                status: TargetStatus::Skipped,
                matches: Vec::new(),
                matched_rule_ids: Vec::new(),
                bars: 0,
                evaluated_history_endpoints: 0,
                message: Some(format!(
                    "{} has no completed bars at or before the requested date.",
                    target.key()
                )),
            };
        }

        if is_first_page {
            latest_date = format_date(bars[bars.len() - 1].date);
            total_unique_bars = bars.len();
        } else {
            total_unique_bars += bars.len() - overlap;
        }

        let is_oldest_page = bars.len() < window;
        let first_endpoint = if is_oldest_page { 0 } else { overlap };

        for index in (first_endpoint..bars.len()).rev() {
            if cancel.load(Ordering::SeqCst) {
                return cancelled_outcome(target);
            }
            let mut endpoint_keys = BTreeSet::new();
            for rule in pattern_rules {
                let required = super::patterns::minimum_bars_for_pattern_rule(rule).unwrap_or(0);
                let first_valid = super::patterns::PATTERN_HISTORY_ENDPOINT_START.max(required);
                if required == 0 {
                    return fail(format!("Unsupported native pattern rule: {}.", rule.id));
                }
                if index + 1 < first_valid {
                    continue;
                }

                rules_evaluated += 1;
                evaluated_history_endpoints += 1;
                let from = (index + 1).saturating_sub(overlap);
                match super::patterns::evaluate_pattern_rule(
                    rule,
                    &target.exchange,
                    &target.symbol,
                    &bars[from..=index],
                    &latest_date,
                ) {
                    super::patterns::PatternEvaluation::Evaluated(Some(result)) => {
                        let record = super::patterns::pattern_match_record(
                            &target.exchange,
                            &target.symbol,
                            &rule.id,
                            result,
                        );
                        groups.absorb_reverse(&mut endpoint_keys, record);
                        if !matched_rule_ids.contains(&rule.id) {
                            matched_rule_ids.push(rule.id.clone());
                        }
                    }
                    super::patterns::PatternEvaluation::Evaluated(None) => {}
                    super::patterns::PatternEvaluation::Unsupported => {
                        return fail(format!("Unsupported native pattern rule: {}.", rule.id));
                    }
                }
            }
            groups.end_endpoint(&endpoint_keys);
        }

        if is_oldest_page {
            break;
        }
        // The next read ends on the final overlapping bar and provides older
        // context; all endpoints in this page's first overlap were deferred.
        expected_overlap = Some(bars[..overlap].to_vec());
        as_of = Some(format_date(bars[overlap - 1].date));
        is_first_page = false;
    }

    if rules_evaluated == 0 {
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: total_unique_bars,
            evaluated_history_endpoints,
            message: Some(format!(
                "{} has {total_unique_bars} completed bar(s); no selected rule has enough warm-up data.",
                target.key()
            )),
        };
    }

    let mut matches = groups.into_matches();
    matches.sort_by(|left, right| {
        right
            .date
            .cmp(&left.date)
            .then_with(|| left.rule_id.cmp(&right.rule_id))
    });
    TargetOutcome {
        target: target.clone(),
        status: if matches.is_empty() {
            TargetStatus::NoMatch
        } else {
            TargetStatus::Match
        },
        matches,
        matched_rule_ids,
        bars: total_unique_bars,
        evaluated_history_endpoints,
        message: None,
    }
}

#[allow(clippy::too_many_arguments)]
fn scan_target<D: ScanDataSource>(
    source: &D,
    request: &NativeScanRequestV1,
    target: &ScanTarget,
    window: usize,
    numeric_rules: &[&RuleV1],
    pattern_rules: &[&RuleV1],
    options: ScanExecutionOptions,
    cancel: &AtomicBool,
) -> TargetOutcome {
    // The four native gap patterns need full history; existing capped numeric AST
    // history and latest-only requests retain their previous bounded semantics.
    if request.evaluation.evaluate_history
        && request.evaluation.lookback_bars.is_none()
        && numeric_rules.is_empty()
        && !pattern_rules.is_empty()
    {
        return scan_full_pattern_history(source, request, target, window, pattern_rules, cancel);
    }
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

    // Warm-up is decided per rule, never per target. A single long-period rule must not
    // discard the matches a shorter rule can legitimately produce from the same bars;
    // each rule below is skipped individually when it lacks warm-up data, so the target
    // is only reported as skipped when *no* rule could be evaluated at all.
    let shortest_rule = request
        .rules
        .iter()
        .map(required_bars_for_rule)
        .min()
        .unwrap_or(0);
    if request.rules.is_empty() || bars.len() < shortest_rule.max(1) {
        let needed = request
            .rules
            .iter()
            .map(required_bars_for_rule)
            .min()
            .unwrap_or(0)
            .max(1);
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: bars.len(),
            evaluated_history_endpoints: 0,
            message: Some(format!(
                "{} has {} completed bar(s); no selected rule can be evaluated yet (shortest needs {needed}).",
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

    let mut rules_evaluated = 0usize;

    // Consecutive historical pattern runs, grouped exactly like the accepted TypeScript
    // historical evaluation.
    let mut groups = HistoricalGroups::default();

    for rule in numeric_rules {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        // Never infer legacy metadata from a colliding rule ID or allow a core
        // scanner to acquire unsupported native historical semantics.
        if super::core_results::validate_core_rule(rule, request.evaluation.evaluate_history)
            .is_err()
        {
            had_error = true;
            break;
        }
        // Per-rule warm-up (audit P2): a rule whose own minimum exceeds the loaded bars is
        // "not evaluated" for that rule only, while other rules on the same target still
        // run and can still match.
        if bars.len() < required_bars_for_rule(rule).max(1) {
            continue;
        }
        rules_evaluated += 1;
        if !request.evaluation.evaluate_history {
            match evaluate_rule_latest(&rule.expression, &eval_bars) {
                Ok(outcome) => {
                    if outcome.matched {
                        let date = format_date(bars[bars.len() - 1].date);
                        let record = super::core_results::core_match_record(
                            rule,
                            &bars,
                            target,
                            &date,
                            outcome.value,
                        );
                        match record {
                            Ok(Some(core)) => matches.push(core),
                            Ok(None) => matches.push(ScanMatchRecord {
                                exchange: target.exchange.clone(),
                                symbol: target.symbol.clone(),
                                rule_id: rule.id.clone(),
                                date,
                                value: outcome.value,
                                ..ScanMatchRecord::default()
                            }),
                            Err(_) => {
                                had_error = true;
                                continue;
                            }
                        }
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
        // P1-06: every endpoint from the rule's warm-up onward is evaluated. The old
        // stride sampler silently skipped interior endpoints, so a match that occurred
        // between two samples was never reported. The bound is now a *contiguous*
        // trailing cap: when the available span exceeds `max_history_endpoints` the most
        // recent N endpoints are evaluated and nothing inside that span is skipped.
        let last_index = bars.len() - 1;
        let warmup_index = start.saturating_sub(1);
        let cap = options.max_history_endpoints.max(1);
        let first_index = warmup_index.max((last_index + 1).saturating_sub(cap));
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
            index += 1;
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
            // Warm-up is "not evaluated" for this rule only, never a false non-match.
            continue;
        }
        rules_evaluated += 1;
        if !request.evaluation.evaluate_history {
            let from = bars
                .len()
                .saturating_sub(super::patterns::PATTERN_MAX_WINDOW_BARS);
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
            // Keys matching at *this* endpoint; anything absent here ends its run.
            let mut endpoint_keys: std::collections::BTreeSet<String> =
                std::collections::BTreeSet::new();
            match super::patterns::evaluate_pattern_rule(
                rule,
                &target.exchange,
                &target.symbol,
                &bars[from..=index],
                &generated_at,
            ) {
                super::patterns::PatternEvaluation::Evaluated(Some(result)) => {
                    let record = super::patterns::pattern_match_record(
                        &target.exchange,
                        &target.symbol,
                        &rule.id,
                        result,
                    );
                    groups.absorb(&mut endpoint_keys, record);
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
            groups.end_endpoint(&endpoint_keys);
            index += 1;
        }
    }

    // Grouped historical rows replace the per-endpoint rows they summarize.
    matches.extend(groups.into_matches());

    if !had_error && rules_evaluated == 0 {
        // Every rule needed more bars than the target has; that is unevaluable, not a
        // non-match, and it must not silently read as a clean negative.
        return TargetOutcome {
            target: target.clone(),
            status: TargetStatus::Skipped,
            matches: Vec::new(),
            matched_rule_ids: Vec::new(),
            bars: bars.len(),
            evaluated_history_endpoints,
            message: Some(format!(
                "{} has {} completed bar(s); no selected rule has enough warm-up data.",
                target.key(),
                bars.len()
            )),
        };
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
        loads: std::sync::Mutex<Vec<(String, usize, Option<String>, PriceBasisV1)>>,
    }

    impl FixtureSource {
        fn new(bars: HashMap<String, Vec<NativeBar>>) -> Self {
            Self {
                identity: "fixture-db@revision-1".to_string(),
                bars,
                errors: HashMap::new(),
                loads: std::sync::Mutex::new(Vec::new()),
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
            self.loads.lock().unwrap().push((
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

    // A production-valid expression, not merely a matching rule ID: Rust's
    // canonical AST validator must accept this fixture after warm-up.
    fn issue131_close_near_high_rule() -> RuleV1 {
        use BinaryOpV1::{And, Gt, Gte, Mul, Sub};
        use OhlcvFieldV1::{Close, High, Low};

        let field = |name: OhlcvFieldV1| ExprV1::Field {
            field: name,
            lookback: 0,
        };
        let binary = |op: BinaryOpV1, left: ExprV1, right: ExprV1| ExprV1::Binary {
            op,
            left: Box::new(left),
            right: Box::new(right),
        };
        let range = || binary(Sub, field(High), field(Low));
        RuleV1 {
            id: "close_near_high".to_string(),
            expression: binary(
                And,
                binary(Gt, range(), ExprV1::Number { value: 0.0 }),
                binary(
                    Gte,
                    field(Close),
                    binary(
                        Sub,
                        field(High),
                        binary(Mul, range(), ExprV1::Number { value: 0.1 }),
                    ),
                ),
            ),
        }
    }

    #[test]
    fn issue131_core_warmup_requires_two_bars_without_changing_other_rules() {
        let core = issue131_close_near_high_rule();
        assert!(super::super::core_results::validate_core_rule(&core, false).is_ok());
        assert_eq!(minimum_bars_for_expression(&core.expression), 1);
        assert_eq!(required_bars_for_rule(&core), 2);

        // The closed list covers all ten accepted core IDs; no broad numeric
        // minimum is imposed on generic one-bar AST evaluations.
        for id in [
            "prev_day_high_break",
            "prev_day_low_break",
            "inside_bar",
            "outside_bar",
            "close_near_high",
            "close_near_low",
            "gap_up",
            "gap_down",
            "nr7",
            "wide_range_candle",
        ] {
            let mut candidate = close_above(0.0);
            candidate.id = id.to_string();
            assert_eq!(
                required_bars_for_rule(&candidate),
                2,
                "built-in {id} must observe the two-bar batch floor"
            );
        }

        assert_eq!(required_bars_for_rule(&close_above(0.0)), 1);
        let gap_pattern = pattern_rule("chart_common_gap");
        assert_eq!(
            required_bars_for_rule(&gap_pattern),
            super::super::patterns::minimum_bars_for_pattern_rule(&gap_pattern).unwrap()
        );
        assert!(
            evaluation_window(&request(vec![core], false), ScanExecutionOptions::default()) >= 2
        );
    }

    #[test]
    fn issue131_core_zero_one_two_bars_preserve_match_and_mixed_gap_outcomes() {
        let mut today = bar(20260102, 109.0);
        today.open = 100.0;
        today.high = 110.0;
        today.low = 90.0;
        let mut bars = HashMap::new();
        bars.insert("NSE:ZERO".to_string(), Vec::new());
        bars.insert("NSE:ONE".to_string(), vec![today.clone()]);
        bars.insert("NSE:TWO".to_string(), vec![bar(20260101, 100.0), today]);
        let source = FixtureSource::new(bars);
        let rule = issue131_close_near_high_rule();

        let report = execute_scan(
            &source,
            &request(vec![rule.clone()], false),
            &[target("ZERO"), target("ONE"), target("TWO")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.matched, 1);
        assert_eq!(report.counts.skipped, 2);
        assert_eq!(report.counts.no_match, 0);
        assert_eq!(report.counts.failed, 0);
        assert_eq!(report.matches.len(), 1);
        assert_eq!(report.matches[0].symbol, "TWO");
        assert_eq!(report.matches[0].rule_id, "close_near_high");
        assert_eq!(
            report.matches[0].scanner_name.as_deref(),
            Some("Close Near High")
        );

        // Mixed core + gap requests remain per-rule: an unevaluable gap
        // detector must not suppress the two-bar core result.
        let mixed = execute_scan(
            &source,
            &request(vec![rule, pattern_rule("chart_common_gap")], false),
            &[target("ONE"), target("TWO")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(mixed.counts.matched, 1);
        assert_eq!(mixed.counts.skipped, 1);
        assert_eq!(mixed.matches.len(), 1);
        assert_eq!(mixed.matches[0].rule_id, "close_near_high");

        // Generic numeric rules are intentionally unaffected by this core
        // batch floor and may still evaluate from one completed bar.
        let generic = execute_scan(
            &source,
            &request(vec![close_above(108.0)], false),
            &[target("ONE")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(generic.counts.matched, 1);
        assert_eq!(generic.matches[0].rule_id, "close_above");
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
        let loads = source.loads.lock().unwrap();
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
                worker_count: 1,
            },
            |_| {},
        );
        assert_eq!(report.counts.matched, 1);
        let outcome = &report.outcomes[0];
        // P1-06: the sampler is gone. 40 bars with a close>10 warm-up from bar 11 gives
        // 30 candidate endpoints (10..=39), and the configured cap is a *contiguous*
        // trailing cap, so exactly 8 recent endpoints are evaluated and none of them is
        // a stride-skipped interior point.
        assert_eq!(outcome.evaluated_history_endpoints, 8);
        assert_eq!(
            report.matches.len(),
            8,
            "no endpoint inside the capped span may be skipped"
        );
        // The newest endpoint is always evaluated and the retained span is contiguous:
        // the fixture's endpoint dates are 20240101 + index, so an unbroken run of 8
        // matches must be exactly 20240133..=20240140.
        let mut endpoint_dates: Vec<&str> =
            report.matches.iter().map(|m| m.date.as_str()).collect();
        endpoint_dates.sort_unstable();
        assert_eq!(endpoint_dates.first().copied(), Some("2024-01-33"));
        assert_eq!(endpoint_dates.last().copied(), Some("2024-01-40"));
        // Sorting is strictly descending by date in the final report.
        let dates: Vec<&str> = report.matches.iter().map(|m| m.date.as_str()).collect();
        let sorted = {
            let mut copy = dates.clone();
            copy.sort_by(|a, b| b.cmp(a));
            copy
        };
        assert_eq!(dates, sorted);
        let mut unique = dates.clone();
        unique.dedup();
        assert_eq!(
            unique.len(),
            report.matches.len(),
            "no duplicate match rows"
        );
    }

    /// The rendered direction must use the contract's own lowercase spelling; deriving it
    /// from `Debug` produced `Bullish`, which the renderer contract does not accept.
    #[test]
    fn p1_direction_uses_the_transport_spelling() {
        assert_eq!(
            ScanMatchRecord::direction_wire_text(ScannerDirectionV1::Bullish),
            "bullish"
        );
        assert_eq!(
            ScanMatchRecord::direction_wire_text(ScannerDirectionV1::Bearish),
            "bearish"
        );
        assert_eq!(
            ScanMatchRecord::direction_wire_text(ScannerDirectionV1::Neutral),
            "neutral"
        );
    }

    fn grouped_record(date: &str, direction: Option<&str>) -> ScanMatchRecord {
        ScanMatchRecord {
            exchange: "NSE".to_string(),
            symbol: "GAP".to_string(),
            rule_id: "chart_breakaway_gap".to_string(),
            date: date.to_string(),
            direction: direction.map(ToOwned::to_owned),
            ..ScanMatchRecord::default()
        }
    }

    /// Audit fix: consecutive historical pattern matches collapse into one grouped result,
    /// exactly like `src/features/chartPatterns/evaluation.ts`, instead of publishing a row
    /// per endpoint.
    #[test]
    fn p1_historical_pattern_matches_are_grouped_not_duplicated() {
        let mut groups = HistoricalGroups::default();
        for date in ["2024-01-01", "2024-01-02", "2024-01-03"] {
            let mut endpoint = std::collections::BTreeSet::new();
            groups.absorb(&mut endpoint, grouped_record(date, Some("bullish")));
            groups.end_endpoint(&endpoint);
        }
        let grouped = groups.into_matches();
        assert_eq!(grouped.len(), 1, "one run must publish one result");
        let history = grouped[0]
            .history
            .as_ref()
            .expect("a grouped run must carry its history summary");
        assert_eq!(history.first_matched_date, "2024-01-01");
        assert_eq!(history.last_matched_date, "2024-01-03");
        assert_eq!(history.match_count, 3);
        assert_eq!(
            grouped[0].date, "2024-01-01",
            "the first result of the run is the one that is retained"
        );
    }

    /// A run that stops matching must not be extended by a later, non-consecutive match,
    /// and a direction change is a different group.
    #[test]
    fn p1_non_consecutive_and_differing_direction_runs_stay_separate() {
        let mut groups = HistoricalGroups::default();
        let mut first = std::collections::BTreeSet::new();
        groups.absorb(&mut first, grouped_record("2024-01-01", Some("bullish")));
        groups.end_endpoint(&first);
        // A quiet endpoint closes the run.
        let quiet = std::collections::BTreeSet::new();
        groups.end_endpoint(&quiet);
        // The same rule matching again later is a new run, and so is the other direction.
        let mut later = std::collections::BTreeSet::new();
        groups.absorb(&mut later, grouped_record("2024-01-10", Some("bullish")));
        groups.absorb(&mut later, grouped_record("2024-01-10", Some("bearish")));
        groups.end_endpoint(&later);

        let grouped = groups.into_matches();
        assert_eq!(
            grouped.len(),
            3,
            "two non-consecutive runs plus a direction change are three groups"
        );
        assert_eq!(grouped[0].history.as_ref().unwrap().match_count, 1);
        assert_eq!(grouped[1].history.as_ref().unwrap().match_count, 1);
        assert_eq!(grouped[2].history.as_ref().unwrap().match_count, 1);
        assert_eq!(grouped[1].direction.as_deref(), Some("bullish"));
        assert_eq!(grouped[2].direction.as_deref(), Some("bearish"));
        assert_eq!(grouped[1].date, "2024-01-10");
    }

    /// Audit fix: `evaluation.lookbackBars` must actually bound the evaluated window
    /// instead of being parsed and ignored in favour of the executor maximum.
    #[test]
    fn p1_scan_honours_the_requested_lookback_window() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:LOOK".to_string(),
            series(&(1..=100).map(|value| value as f64).collect::<Vec<_>>()),
        );
        let source = FixtureSource::new(bars);

        let mut data = request(vec![close_above(50.0)], false);
        data.evaluation.lookback_bars = Some(10);
        let report = execute_scan(
            &source,
            &data,
            &[target("LOOK")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );

        // The window handed to the data source is the requested lookback, not 5000.
        let loads = source.loads.lock().unwrap();
        assert_eq!(loads.len(), 1);
        assert_eq!(loads[0].1, 10, "lookbackBars must cap the evaluated window");
        drop(loads);

        // The last 10 closes are 91..=100, all above 50, so the latest endpoint matches
        // and the evaluated bar count proves only the truncated window was considered.
        assert_eq!(report.outcomes[0].bars, 10);
        assert_eq!(report.counts.matched, 1);
    }

    /// A lookback below a rule's warm-up may not silently turn the rule into a
    /// non-match: the window is widened to the warm-up the rule actually needs.
    #[test]
    fn p1_scan_lookback_is_widened_to_the_rule_warmup() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:WARM".to_string(),
            series(&(1..=60).map(|value| value as f64).collect::<Vec<_>>()),
        );
        let source = FixtureSource::new(bars);
        let rule = RuleV1 {
            id: "sma_50".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Indicator {
                    name: IndicatorNameV1::Sma,
                    period: 50,
                    input: Some(Box::new(ExprV1::Field {
                        field: OhlcvFieldV1::Close,
                        lookback: 0,
                    })),
                }),
                right: Box::new(ExprV1::Number { value: 0.0 }),
            },
        };
        let mut data = request(vec![rule], false);
        data.evaluation.lookback_bars = Some(5);

        let report = execute_scan(
            &source,
            &data,
            &[target("WARM")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        let loads = source.loads.lock().unwrap();
        assert_eq!(
            loads[0].1, 50,
            "the window must cover the rule's warm-up, not the tiny lookback"
        );
        drop(loads);
        assert_eq!(report.counts.matched, 1);
        assert_eq!(report.outcomes[0].status, TargetStatus::Match);
    }

    /// Audit fix: a single long-period rule must not suppress a shorter rule that can
    /// already be evaluated on the same target.
    #[test]
    fn p1_rule_warmup_is_evaluated_per_rule_not_per_target() {
        let mut bars = HashMap::new();
        bars.insert(
            "NSE:MIXED".to_string(),
            series(&(1..=20).map(|value| value as f64).collect::<Vec<_>>()),
        );
        let source = FixtureSource::new(bars);
        let long_rule = RuleV1 {
            id: "sma_200".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Indicator {
                    name: IndicatorNameV1::Sma,
                    period: 200,
                    input: Some(Box::new(ExprV1::Field {
                        field: OhlcvFieldV1::Close,
                        lookback: 0,
                    })),
                }),
                right: Box::new(ExprV1::Number { value: 0.0 }),
            },
        };
        let report = execute_scan(
            &source,
            &request(vec![close_above(0.0), long_rule], false),
            &[target("MIXED")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );

        assert_eq!(
            report.outcomes[0].status,
            TargetStatus::Match,
            "the evaluable rule must still produce its match"
        );
        assert_eq!(report.counts.matched, 1);
        assert_eq!(report.counts.skipped, 0);
        assert_eq!(report.matches.len(), 1);
        assert_eq!(report.matches[0].rule_id, "close_above");
    }

    /// When *no* rule has enough warm-up data the target is skipped, never reported as a
    /// clean non-match.
    #[test]
    fn p1_target_with_no_evaluable_rule_is_skipped_not_no_match() {
        let mut bars = HashMap::new();
        bars.insert("NSE:SHORT".to_string(), series(&[10.0, 11.0, 12.0]));
        let source = FixtureSource::new(bars);
        let rule = RuleV1 {
            id: "sma_50".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Indicator {
                    name: IndicatorNameV1::Sma,
                    period: 50,
                    input: Some(Box::new(ExprV1::Field {
                        field: OhlcvFieldV1::Close,
                        lookback: 0,
                    })),
                }),
                right: Box::new(ExprV1::Number { value: 0.0 }),
            },
        };
        let report = execute_scan(
            &source,
            &request(vec![rule], false),
            &[target("SHORT")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.outcomes[0].status, TargetStatus::Skipped);
        assert_eq!(report.counts.no_match, 0, "unevaluable is not a non-match");
        assert_eq!(report.counts.skipped, 1);
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
        assert_eq!(
            report.counts.skipped, 0,
            "a pattern target must not be skipped"
        );
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
        let details = matched
            .pattern
            .as_ref()
            .expect("geometry must be preserved");
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
        // 25 bars. Breakaway Gap needs 22 bars itself, so the first evaluable endpoint is
        // index 21 -> endpoints 21..=24 inclusive (4 endpoints). Endpoints below the
        // detector's own minimum are never asked for a verdict, and the four consecutive
        // matches are published as one grouped result (TypeScript parity), not four rows.
        assert_eq!(outcome.evaluated_history_endpoints, 4);
        assert_eq!(report.matches.len(), 1, "consecutive endpoints are grouped");
        assert_eq!(report.matches[0].date, "2024-01-25");
        let history = report.matches[0]
            .history
            .as_ref()
            .expect("grouped history must be attached");
        assert_eq!(history.last_matched_date, "2024-01-25");
    }

    /// Builds valid ascending market dates rather than synthetic day-of-month overflow.
    fn dated_quiet_bars(count: usize) -> Vec<NativeBar> {
        let start = chrono::NaiveDate::from_ymd_opt(1990, 1, 1).unwrap();
        (0..count)
            .map(|index| {
                let date = start + chrono::Duration::days(index as i64);
                let packed = date.format("%Y%m%d").to_string().parse::<u32>().unwrap();
                NativeBar {
                    date: packed,
                    open: 100.0,
                    high: 101.0,
                    low: 99.0,
                    close: 100.0,
                    prev_close: Some(100.0),
                    volume: 1_000.0,
                    open_interest: 0.0,
                }
            })
            .collect()
    }

    fn plant_breakaway(bars: &mut [NativeBar], start: usize) {
        for (offset, template) in gap_bars().into_iter().enumerate() {
            let date = bars[start + offset].date;
            bars[start + offset] = NativeBar { date, ..template };
        }
    }

    #[test]
    fn ns04_complete_gap_history_includes_episodes_older_than_five_thousand_bars() {
        let mut history = dated_quiet_bars(10_050);
        plant_breakaway(&mut history, 100);
        plant_breakaway(&mut history, 9_500);
        let early_date = format_date(history[124].date);
        let recent_date = format_date(history[9_524].date);
        let mut data = HashMap::new();
        data.insert("NSE:GAP".to_string(), history);
        let source = FixtureSource::new(data);

        let report = execute_scan(
            &source,
            &request(vec![pattern_rule("chart_breakaway_gap")], true),
            &[target("GAP")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.failed, 0, "{:?}", report.diagnostics);
        assert_eq!(report.outcomes[0].bars, 10_050);
        let dates: Vec<&str> = report.matches.iter().map(|row| row.date.as_str()).collect();
        assert!(
            dates.contains(&early_date.as_str()),
            "missing old episode: {dates:?}"
        );
        assert!(
            dates.contains(&recent_date.as_str()),
            "missing recent episode: {dates:?}"
        );
        let loads = source.loads.lock().unwrap();
        assert!(
            loads.len() >= 3,
            "complete history must use multiple bounded pages"
        );
        assert!(loads.iter().all(|(_, size, _, _)| *size <= MAX_WINDOW_BARS));
    }

    #[test]
    fn ns04_reverse_history_grouping_preserves_earliest_metadata_across_pages() {
        let mut groups = HistoricalGroups::default();
        let mut newest = grouped_record("2024-01-05", Some("bullish"));
        newest.value = Some(50.0);
        let mut oldest = grouped_record("2024-01-03", Some("bullish"));
        oldest.value = Some(30.0);

        // Simulate a page boundary between two consecutive endpoints.
        for record in [newest, grouped_record("2024-01-04", Some("bullish"))] {
            let mut keys = std::collections::BTreeSet::new();
            groups.absorb_reverse(&mut keys, record);
            groups.end_endpoint(&keys);
        }
        let mut keys = std::collections::BTreeSet::new();
        groups.absorb_reverse(&mut keys, oldest);
        groups.end_endpoint(&keys);
        groups.end_endpoint(&std::collections::BTreeSet::new());

        let mut earlier = std::collections::BTreeSet::new();
        groups.absorb_reverse(&mut earlier, grouped_record("2024-01-01", Some("bullish")));
        groups.absorb_reverse(&mut earlier, grouped_record("2024-01-01", Some("bearish")));
        groups.end_endpoint(&earlier);

        let result = groups.into_matches();
        assert_eq!(result.len(), 3);
        let spanning = result.iter().find(|row| row.date == "2024-01-03").unwrap();
        assert_eq!(spanning.value, Some(30.0));
        let history = spanning.history.as_ref().unwrap();
        assert_eq!(history.first_matched_date, "2024-01-03");
        assert_eq!(history.last_matched_date, "2024-01-05");
        assert_eq!(history.match_count, 3);
    }

    #[test]
    fn ns04_specified_bar_history_keeps_the_existing_bounded_semantics() {
        let mut input = HashMap::new();
        input.insert("NSE:GAP".to_string(), gap_bars());
        let source = FixtureSource::new(input);
        let mut req = request(vec![pattern_rule("chart_breakaway_gap")], true);
        req.evaluation.lookback_bars = Some(23);
        let report = execute_scan(
            &source,
            &req,
            &[target("GAP")],
            &AtomicBool::new(false),
            ScanExecutionOptions::default(),
            |_| {},
        );
        assert_eq!(report.counts.failed, 0);
        let loads = source.loads.lock().unwrap();
        assert_eq!(
            loads.len(),
            1,
            "specified history must not page beyond its limit"
        );
        assert_eq!(loads[0].1, 23);
    }

    #[test]
    fn ns04_bounded_history_exact_window_and_as_of_do_not_drop_endpoints() {
        for size in [5_000usize, 5_001, 5_025] {
            let history = dated_quiet_bars(size);
            let mut data = HashMap::new();
            data.insert("NSE:QUIET".to_string(), history.clone());
            let source = FixtureSource::new(data);
            let mut request = request(vec![pattern_rule("chart_common_gap")], true);
            if size == 5_025 {
                request.evaluation.as_of_date = Some(format_date(history[5_000].date));
            }
            let expected = if size == 5_025 { 5_001 } else { size };
            let report = execute_scan(
                &source,
                &request,
                &[target("QUIET")],
                &AtomicBool::new(false),
                ScanExecutionOptions::default(),
                |_| {},
            );
            assert_eq!(report.counts.failed, 0, "{:?}", report.diagnostics);
            assert_eq!(report.outcomes[0].bars, expected);
            assert_eq!(
                report.outcomes[0].evaluated_history_endpoints,
                expected - 19,
                "all endpoints from the shared 20-bar start must be evaluated once"
            );
            assert!(report.matches.is_empty());
        }
    }

    struct InterruptedHistorySource {
        inner: FixtureSource,
        cancel: std::sync::Arc<AtomicBool>,
        fail_second_page: bool,
    }

    impl ScanDataSource for InterruptedHistorySource {
        fn database_identity(&self) -> &str {
            self.inner.database_identity()
        }

        fn load_bars(
            &self,
            target: &ScanTarget,
            as_of_date: Option<&str>,
            window: usize,
            price_basis: PriceBasisV1,
            dividends: bool,
            rights: bool,
        ) -> Result<Vec<NativeBar>, String> {
            if as_of_date.is_some() {
                if self.fail_second_page {
                    return Err("injected second-page I/O failure".to_string());
                }
                self.cancel.store(true, Ordering::SeqCst);
            }
            self.inner
                .load_bars(target, as_of_date, window, price_basis, dividends, rights)
        }
    }

    #[test]
    fn ns04_page_failure_discards_partial_matches_and_cancellation_discards_groups() {
        let mut history = dated_quiet_bars(5_200);
        plant_breakaway(&mut history, 5_000);
        let mut data = HashMap::new();
        data.insert("NSE:GAP".to_string(), history);
        for fail_second_page in [true, false] {
            let cancel = std::sync::Arc::new(AtomicBool::new(false));
            let source = InterruptedHistorySource {
                inner: FixtureSource::new(data.clone()),
                cancel: std::sync::Arc::clone(&cancel),
                fail_second_page,
            };
            let report = execute_scan(
                &source,
                &request(vec![pattern_rule("chart_breakaway_gap")], true),
                &[target("GAP")],
                &cancel,
                ScanExecutionOptions::default(),
                |_| {},
            );
            assert!(report.matches.is_empty(), "never expose partial episodes");
            if fail_second_page {
                assert_eq!(report.counts.failed, 1, "{:?}", report.diagnostics);
                assert!(report.diagnostics[0].message.contains("second-page"));
            } else {
                assert!(report.cancelled);
            }
        }
    }

    /// P1-08: a deterministic series of `count` targets, each with a distinct close so the
    /// outcome per target is predictable.
    fn parallel_fixture(count: usize) -> (FixtureSource, Vec<ScanTarget>) {
        let mut bars = HashMap::new();
        let mut targets = Vec::new();
        for index in 0..count {
            let symbol = format!("S{index:02}");
            let base = 10.0 + index as f64;
            bars.insert(
                format!("NSE:{symbol}"),
                series(&[base, base, base, base, base]),
            );
            targets.push(ScanTarget {
                exchange: "NSE".to_string(),
                symbol,
            });
        }
        (FixtureSource::new(bars), targets)
    }

    #[test]
    fn p1_08_worker_count_is_clamped_and_truthfully_reported() {
        assert_eq!(effective_worker_count(0, 10), 1, "never zero workers");
        assert_eq!(effective_worker_count(1, 10), 1);
        assert_eq!(effective_worker_count(2, 10), 2);
        assert_eq!(effective_worker_count(4, 10), 4);
        assert_eq!(
            effective_worker_count(64, 10),
            MAX_WORKERS,
            "must not exceed the approved ceiling"
        );
        assert_eq!(
            effective_worker_count(4, 2),
            2,
            "must not claim more workers than targets"
        );
        assert_eq!(
            effective_worker_count(4, 0),
            0,
            "no targets means no workers"
        );

        let (source, targets) = parallel_fixture(2);
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &targets,
            &AtomicBool::new(false),
            ScanExecutionOptions::default().with_worker_count(4),
            |_| {},
        );
        assert_eq!(report.workers_used, 2, "report actual, not requested");
    }

    /// P1-08 + approval requirement 3: output must be identical for 1, 2 and 4 workers.
    #[test]
    fn p1_08_output_is_identical_for_1_2_and_4_workers() {
        let (source, targets) = parallel_fixture(12);
        let request_data = request(vec![close_above(14.0)], true);

        let run = |workers: usize| {
            execute_scan(
                &source,
                &request_data,
                &targets,
                &AtomicBool::new(false),
                ScanExecutionOptions::default().with_worker_count(workers),
                |_| {},
            )
        };
        let single = run(1);
        let double = run(2);
        let quad = run(4);

        for report in [&double, &quad] {
            assert_eq!(
                report.matches, single.matches,
                "match ordering must not depend on worker count"
            );
            assert_eq!(report.outcomes.len(), single.outcomes.len());
            assert_eq!(report.counts, single.counts);
            // Diagnostics are emitted per completed slot in target order.
            let single_messages: Vec<_> = single
                .diagnostics
                .iter()
                .map(|d| d.message.clone())
                .collect();
            let other_messages: Vec<_> = report
                .diagnostics
                .iter()
                .map(|d| d.message.clone())
                .collect();
            assert_eq!(other_messages, single_messages);
        }
        assert_eq!(double.workers_used, 2);
        assert_eq!(quad.workers_used, 4);
    }

    /// P1-08 + approval requirement 5: cancellation stops new work.
    #[test]
    fn p1_08_cancellation_stops_new_work_with_multiple_workers() {
        let (source, targets) = parallel_fixture(16);
        let cancel = AtomicBool::new(true);
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &targets,
            &cancel,
            ScanExecutionOptions::default().with_worker_count(4),
            |_| {},
        );

        assert!(report.cancelled, "the run must report cancellation");
        // Every target still has an outcome; none is silently dropped.
        assert_eq!(report.outcomes.len(), 16);
        assert!(report
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "target-skipped"));
    }

    /// Approval requirement 1/2: distinct targets are handled exactly once even when
    /// several workers claim indices concurrently.
    #[test]
    fn p1_08_concurrent_claims_do_not_duplicate_or_drop_targets() {
        let (source, targets) = parallel_fixture(24);
        let report = execute_scan(
            &source,
            &request(vec![close_above(5.0)], false),
            &targets,
            &AtomicBool::new(false),
            ScanExecutionOptions::default().with_worker_count(4),
            |_| {},
        );

        let scanned: Vec<String> = report
            .outcomes
            .iter()
            .map(|outcome| outcome.target.symbol.clone())
            .collect();
        let mut unique = scanned.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            scanned.len(),
            "no target may be scanned twice"
        );
        assert_eq!(scanned.len(), 24, "no target may be dropped");
        assert_eq!(report.counts.targets, 24);
        // Target order is preserved because slots are merged in index order.
        assert_eq!(
            scanned,
            (0..24).map(|i| format!("S{i:02}")).collect::<Vec<_>>()
        );
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
        let loads = source.loads.lock().unwrap();
        assert_eq!(loads[0].2.as_deref(), Some("2024-01-02"));
        assert_eq!(loads[0].3, PriceBasisV1::Raw);
    }
}
