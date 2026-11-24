//! Versioned full numeric history. V1 continues to own the default scanner route.

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

use crate::database::{
    database_use, require_native_history_wal_family, with_native_scan_selection, ForwardSource,
    NativeScanSelection,
};

use super::ast::{
    parse_native_numeric_history_request, EvalBar, ExprV1, ForwardRuleSet, NativeScanRequestV1,
};
use super::{core_results, scan::required_bars_for_rule};

mod spool;
use spool::{PageKind, ResultPage, Spool};

const VERSION: u32 = 2;
// Enabling capability discovery requires validated WAL-family admission and Windows transport measurements.
const AVAILABLE: bool = false;
const MAX_TARGETS: usize = 64;
const MAX_REQUEST_BYTES: usize = 128 * 1024;
const MAX_SOURCE_ROWS: usize = 1_000_000;
const MAX_EVALUATIONS: usize = 5_000_000;
const SOURCE_PAGE_ROWS: usize = 256;
const RUN_DEADLINE: Duration = Duration::from_secs(120);
const RESULT_TTL: Duration = Duration::from_secs(300);
const UNAVAILABLE: &str = "FULL_NUMERIC_HISTORY_NOT_AVAILABLE";
const SELECTION_CHANGED: &str = "NUMERIC_HISTORY_DATABASE_CHANGED";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StartRequest {
    schema_version: u32,
    requested_run_id: String,
    targets: Vec<Value>,
    as_of_date: Option<String>,
    rules: Vec<Value>,
}

fn parse_request(raw: Value) -> Result<NativeScanRequestV1, String> {
    if serde_json::to_vec(&raw)
        .map_err(|error| error.to_string())?
        .len()
        > MAX_REQUEST_BYTES
    {
        return Err("Numeric history request exceeds its byte limit.".into());
    }
    let request: StartRequest = serde_json::from_value(raw).map_err(|error| error.to_string())?;
    if request.schema_version != VERSION {
        return Err("Unsupported numeric history schema version.".into());
    }
    if !(1..=MAX_TARGETS).contains(&request.targets.len()) {
        return Err("Numeric history V2 requires between 1 and 64 explicit targets.".into());
    }
    let shared_contract = json!({
        "schemaVersion": 1,
        "requestedRunId": request.requested_run_id,
        "universe": { "source": "explicitTargets", "targets": request.targets },
        "evaluation": { "asOfDate": request.as_of_date, "evaluateHistory": true, "priceBasis": "raw" },
        "rules": request.rules,
    });
    let parsed = parse_native_numeric_history_request(&shared_contract).map_err(|issues| {
        let issue = &issues[0];
        format!("{}: {}", issue.path, issue.message)
    })?;
    for rule in &parsed.rules {
        if matches!(rule.expression, ExprV1::Pattern { .. })
            || core_results::is_core_id(&rule.id)
            || core_results::is_daily_market_id(&rule.id)
            || super::preset_signals::is_preset_id(&rule.id)
        {
            return Err("Numeric history V2 accepts generic numeric rules only.".into());
        }
    }
    Ok(parsed)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Completion {
    schema_version: u32,
    run_id: String,
    database_identity: String,
    targets: usize,
    bars: usize,
    evaluated_endpoints: usize,
    matches: usize,
    coverage_rows: usize,
}

struct Coverage {
    evaluated: usize,
    first: Option<u32>,
    last: Option<u32>,
}

fn evaluate(
    source: &ForwardSource,
    request: &NativeScanRequestV1,
    database_identity: String,
    check: impl Fn() -> Result<(), String>,
    cancelled: impl Fn() -> bool,
) -> Result<(Spool, Completion), String> {
    let mut targets = Vec::with_capacity(request.universe.targets.len());
    let mut seen = BTreeSet::new();
    for (exchange, symbol) in &request.universe.targets {
        check()?;
        let target = source.resolve(symbol, exchange)?;
        let (exchange, symbol) = target.identity();
        if !seen.insert((exchange.to_owned(), symbol.to_owned())) {
            return Err("Numeric history request contains duplicate canonical targets.".into());
        }
        targets.push(target);
    }
    let spool = Spool::open()?;
    let mut completion = Completion {
        schema_version: VERSION,
        run_id: request.requested_run_id.clone(),
        database_identity,
        targets: targets.len(),
        bars: 0,
        evaluated_endpoints: 0,
        matches: 0,
        coverage_rows: 0,
    };
    let mut remaining_source_rows = MAX_SOURCE_ROWS;
    let default_cutoff = chrono::Local::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();
    let cutoff = request
        .evaluation
        .as_of_date
        .as_deref()
        .unwrap_or(&default_cutoff);
    for target in targets {
        check()?;
        let (exchange, symbol) = target.identity();
        let (exchange, symbol) = (exchange.to_owned(), symbol.to_owned());
        let mut cursor = source.cursor(target, Some(cutoff))?;
        let mut evaluators =
            ForwardRuleSet::new(request.rules.iter().map(|rule| &rule.expression))?;
        let mut rules = request
            .rules
            .iter()
            .map(|rule| {
                (
                    rule.id.as_str(),
                    required_bars_for_rule(rule).max(1),
                    Coverage {
                        evaluated: 0,
                        first: None,
                        last: None,
                    },
                )
            })
            .collect::<Vec<_>>();
        let mut bars = 0;
        let mut first = None;
        let mut last = None;
        loop {
            check()?;
            let page =
                cursor.next_page(SOURCE_PAGE_ROWS, &mut remaining_source_rows, &cancelled)?;
            if page.is_empty() {
                break;
            }
            for bar in page {
                if cancelled() {
                    return Err("Numeric history cancelled or expired.".into());
                }
                bars += 1;
                completion.bars += 1;
                first.get_or_insert(bar.date);
                last = Some(bar.date);
                if completion.bars.saturating_mul(rules.len()) > MAX_EVALUATIONS {
                    return Err("Numeric history evaluation work limit exceeded.".into());
                }
                let eval_bar = EvalBar {
                    date: bar.date,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume,
                };
                for ((id, warmup, coverage), verdict) in
                    rules.iter_mut().zip(evaluators.advance(eval_bar))
                {
                    if bars < *warmup {
                        continue;
                    }
                    coverage.evaluated += 1;
                    coverage.first.get_or_insert(bar.date);
                    coverage.last = Some(bar.date);
                    completion.evaluated_endpoints += 1;
                    if verdict.matched {
                        let value = verdict
                            .value
                            .filter(|value| value.is_finite())
                            .ok_or("Numeric history encountered a non-finite match value.")?;
                        spool.push(PageKind::Matches, bar.date, (&exchange, &symbol, id), &json!({
                            "date": bar.date, "exchange": exchange, "symbol": symbol, "ruleId": id, "value": value,
                        }))?;
                        completion.matches += 1;
                    }
                }
            }
        }
        for (id, _, coverage) in rules {
            let record = json!({
                "exchange": exchange, "symbol": symbol, "ruleId": id,
                "sourceBars": bars, "sourceFirstDate": first, "sourceLastDate": last,
                "evaluatedEndpoints": coverage.evaluated,
                "firstEvaluatedDate": coverage.first, "lastEvaluatedDate": coverage.last,
            });
            spool.push(PageKind::Coverage, 0, (&exchange, &symbol, id), &record)?;
            completion.coverage_rows += 1;
        }
    }
    check()?;
    spool.finish()?;
    Ok((spool, completion))
}

#[derive(Clone)]
struct Ticket {
    run_id: String,
    key: String,
    started: Instant,
    cancelled: Arc<AtomicBool>,
}

impl Ticket {
    fn stopped(&self) -> bool {
        self.cancelled.load(Ordering::Acquire) || self.started.elapsed() >= RUN_DEADLINE
    }
}

struct Ready {
    ticket: Ticket,
    selection: NativeScanSelection,
    spool: Spool,
    expires: Instant,
}

enum Slot {
    Running(Ticket),
    Ready(Ready),
}

#[derive(Default)]
struct HistorySlots {
    slot: Mutex<Option<Slot>>,
    changed: Condvar,
}

#[derive(Default)]
pub(crate) struct NumericHistoryState(Arc<HistorySlots>);

impl NumericHistoryState {
    fn slot(&self) -> Result<std::sync::MutexGuard<'_, Option<Slot>>, String> {
        let mut slot = self
            .0
            .slot
            .lock()
            .map_err(|_| "Numeric history state unavailable.")?;
        if matches!(&*slot, Some(Slot::Ready(ready)) if Instant::now() >= ready.expires) {
            *slot = None;
            self.0.changed.notify_all();
        }
        Ok(slot)
    }

    fn begin(&self, run_id: String) -> Result<Ticket, String> {
        static GENERATION: AtomicU64 = AtomicU64::new(0);
        let mut slot = self.slot()?;
        if slot.is_some() {
            return Err("A numeric history run is already active or awaiting result close.".into());
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?;
        let key = format!(
            "{}-{}-{}",
            std::process::id(),
            now.as_nanos(),
            GENERATION.fetch_add(1, Ordering::Relaxed)
        );
        let ticket = Ticket {
            run_id,
            key,
            started: Instant::now(),
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        *slot = Some(Slot::Running(ticket.clone()));
        Ok(ticket)
    }

    fn publish(
        &self,
        ticket: &Ticket,
        selection: NativeScanSelection,
        spool: Spool,
        expires: Instant,
    ) -> Result<(), String> {
        let mut slot = self.slot()?;
        if ticket.stopped()
            || !matches!(&*slot, Some(Slot::Running(active)) if active.key == ticket.key)
        {
            return Err("Numeric history cancelled or expired before publication.".into());
        }
        let slots = Arc::clone(&self.0);
        let run_key = ticket.key.clone();
        std::thread::Builder::new()
            .name("numeric-history-expiry".into())
            .spawn(move || expire_result(slots, &run_key, expires))
            .map_err(|error| format!("Unable to schedule numeric history expiry: {error}"))?;
        *slot = Some(Slot::Ready(Ready {
            ticket: ticket.clone(),
            selection,
            spool,
            expires,
        }));
        Ok(())
    }

    fn abandon(&self, key: &str) {
        if let Ok(mut slot) = self.slot() {
            if matches!(&*slot, Some(Slot::Running(ticket)) if ticket.key == key) {
                *slot = None;
            }
        }
    }

    fn close(&self, run_id: Option<&str>) -> Result<bool, String> {
        let mut slot = self.slot()?;
        match &*slot {
            Some(Slot::Running(ticket)) if run_id.is_none_or(|id| id == ticket.run_id) => {
                ticket.cancelled.store(true, Ordering::Release);
                Ok(true)
            }
            Some(Slot::Ready(ready)) if run_id.is_none_or(|id| id == ready.ticket.run_id) => {
                *slot = None;
                self.0.changed.notify_all();
                Ok(true)
            }
            _ => Ok(false),
        }
    }

    fn page_ready(
        &self,
        selection: Option<&NativeScanSelection>,
        run_id: &str,
        kind: PageKind,
        page_token: Option<&str>,
    ) -> Result<ResultPage, String> {
        let mut slot = self.slot()?;
        let Some(Slot::Ready(ready)) = &*slot else {
            return Err("Numeric history results unavailable.".into());
        };
        if run_id != ready.ticket.run_id {
            return Err("Numeric history run is unavailable.".into());
        }
        if selection != Some(&ready.selection) {
            *slot = None;
            self.0.changed.notify_all();
            return Err(SELECTION_CHANGED.into());
        }
        ready
            .spool
            .page(run_id, &ready.ticket.key, kind, page_token)
    }
}

fn expire_result(slots: Arc<HistorySlots>, run_key: &str, expires: Instant) {
    let Ok(mut slot) = slots.slot.lock() else {
        return;
    };
    while matches!(&*slot, Some(Slot::Ready(ready)) if ready.ticket.key == run_key) {
        let remaining = expires.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            *slot = None;
            slots.changed.notify_all();
            return;
        }
        let Ok((next, _)) = slots.changed.wait_timeout(slot, remaining) else {
            return;
        };
        slot = next;
    }
}

fn run(
    app: &AppHandle,
    ticket: &Ticket,
    request: &NativeScanRequestV1,
) -> Result<Completion, String> {
    if ticket.stopped() {
        return Err("Numeric history cancelled or expired.".into());
    }
    let _use_permit = database_use::acquire_use()?;
    let selection = with_native_scan_selection(app, |selected| {
        selected.ok_or("No active database for numeric history.".into())
    })?;
    let source = open_source(app, &selection.folder)?;
    require_native_history_wal_family(app, &selection)?;
    let check = || {
        if ticket.stopped() {
            return Err("Numeric history cancelled or expired.".into());
        }
        with_native_scan_selection(app, |current| {
            if current.as_ref() == Some(&selection) {
                Ok(())
            } else {
                Err(SELECTION_CHANGED.into())
            }
        })
    };
    let (spool, completion) = evaluate(
        &source,
        request,
        selection.database_identity.clone(),
        check,
        || ticket.stopped(),
    )?;
    with_native_scan_selection(app, |current| {
        if current.as_ref() != Some(&selection) {
            return Err(SELECTION_CHANGED.into());
        }
        app.state::<NumericHistoryState>().publish(
            ticket,
            selection,
            spool,
            Instant::now() + RESULT_TTL,
        )
    })?;
    Ok(completion)
}

fn acceptance_mode(app: &AppHandle) -> bool {
    #[cfg(all(windows, feature = "wp02-acceptance"))]
    {
        app.try_state::<crate::database::AcceptanceRegistry>()
            .is_some()
    }
    #[cfg(not(all(windows, feature = "wp02-acceptance")))]
    {
        let _ = app;
        false
    }
}

fn open_source(app: &AppHandle, folder: &std::path::Path) -> Result<ForwardSource, String> {
    #[cfg(all(windows, feature = "wp02-acceptance"))]
    if acceptance_mode(app) {
        return ForwardSource::open_wp02_acceptance(folder);
    }
    let _ = app;
    ForwardSource::open(folder)
}

#[tauri::command]
pub(crate) fn native_numeric_history_capability_v2(app: AppHandle) -> bool {
    available(&app)
}

fn available(app: &AppHandle) -> bool {
    AVAILABLE || acceptance_mode(app)
}

#[tauri::command]
pub(crate) async fn start_native_numeric_history_v2(
    app: AppHandle,
    request: Value,
) -> Result<Completion, String> {
    if !available(&app) {
        return Err(UNAVAILABLE.into());
    }
    let request = parse_request(request)?;
    let ticket = app
        .state::<NumericHistoryState>()
        .begin(request.requested_run_id.clone())?;
    let worker_ticket = ticket.clone();
    let worker_app = app.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            run(&worker_app, &worker_ticket, &request)
        }))
        .unwrap_or_else(|_| Err("Numeric history worker failed.".into()));
        if result.is_err() {
            worker_app
                .state::<NumericHistoryState>()
                .abandon(&worker_ticket.key);
        }
        result
    })
    .await;
    match joined {
        Ok(result) => result,
        Err(_) => {
            app.state::<NumericHistoryState>().abandon(&ticket.key);
            Err("Numeric history worker did not complete.".into())
        }
    }
}

#[tauri::command]
pub(crate) fn page_native_numeric_history_v2(
    app: AppHandle,
    state: State<'_, NumericHistoryState>,
    run_id: String,
    kind: PageKind,
    page_token: Option<String>,
) -> Result<ResultPage, String> {
    if !available(&app) {
        return Err(UNAVAILABLE.into());
    }
    with_native_scan_selection(&app, |selection| {
        state.page_ready(selection.as_ref(), &run_id, kind, page_token.as_deref())
    })
}

#[tauri::command]
pub(crate) fn close_native_numeric_history_v2(
    state: State<'_, NumericHistoryState>,
    run_id: String,
) -> Result<bool, String> {
    state.close(Some(&run_id))
}

pub(crate) fn shutdown(state: &NumericHistoryState) {
    let _ = state.close(None);
}

#[cfg(test)]
mod tests;

#[cfg(test)]
#[test]
fn wp04_v2_rejects_reserved_signal_preset_ids() {
    let error = parse_request(serde_json::json!({
        "schemaVersion": 2, "requestedRunId": "wp04-reserved-id",
        "targets": [{"exchange": "NSE", "symbol": "TCS"}],
        "rules": [{"id": "signal_golden_cross", "expression": {"kind": "number", "value": 1}}]
    }))
    .unwrap_err();
    assert_eq!(
        error,
        "Numeric history V2 accepts generic numeric rules only."
    );
}
