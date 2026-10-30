//! Additive stable-ISIN event-price proof. No identity/financial writes or IPC.
use super::*;
use sha2::{Digest, Sha256};
use std::{cell::RefCell, collections::BTreeSet, sync::Arc};

type Edge = (String, String, String);
thread_local! {
    // Parsed graph only. Source bytes/hash and all event/identity witnesses are
    // rechecked on every call; a cached graph never grants write authority.
    static GRAPHS: RefCell<Vec<(String, Arc<Vec<Edge>>)>> = const { RefCell::new(Vec::new()) };
}
const PREFIX: &str = "Awaiting verified dated price-route identity: ";
fn blocked(reason: &str) -> String {
    format!("{PREFIX}{reason}")
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[derive(Clone, Debug)]
pub(in crate::database) struct VerifiedRoute {
    previous: ScannedBar,
    ex_bar: ScannedBar,
    fingerprint: String,
}
impl VerifiedRoute {
    pub(super) fn window(&self) -> (ScannedBar, ScannedBar) {
        (self.previous.clone(), self.ex_bar.clone())
    }
    pub(in crate::database) fn fingerprint(&self) -> &str {
        &self.fingerprint
    }
    pub(in crate::database) fn previous(&self) -> (&str, f64) {
        (&self.previous.date, self.previous.close)
    }
    pub(super) fn dividend_basis(
        &self,
        cash: f64,
    ) -> AppResult<super::super::instrument_mutations::DividendAdjustmentBasis> {
        super::super::instrument_mutations::compute_dividend_adjustment_basis_from_values(
            self.previous.date.clone(),
            self.previous.close,
            cash,
        )
    }
}

// Whole-component validation: no branch, merge, reused symbol, cycle or
// non-increasing edge date. Identical official rows are one edge, not a branch.
fn chain(edges: &[Edge], target: &str) -> AppResult<Option<Vec<Edge>>> {
    if !edges.iter().any(|(a, b, _)| a == target || b == target) {
        return Ok(None);
    }
    let mut names = BTreeSet::from([target.to_string()]);
    loop {
        let count = names.len();
        for (a, b, _) in edges {
            if names.contains(a) || names.contains(b) {
                names.insert(a.clone());
                names.insert(b.clone());
            }
        }
        if names.len() > 64 {
            return Err(blocked("rename component exceeds limit"));
        }
        if count == names.len() {
            break;
        }
    }
    let component: Vec<_> = edges
        .iter()
        .filter(|(a, b, _)| names.contains(a) || names.contains(b))
        .cloned()
        .collect();
    if component.len() + 1 != names.len() || component.iter().any(|(a, _, _)| a == target) {
        return Err(blocked("conflicting, reused or non-current rename target"));
    }
    let mut route = Vec::new();
    let mut current = target.to_string();
    let mut seen = BTreeSet::new();
    loop {
        if !seen.insert(current.clone()) {
            return Err(blocked("cyclic rename chain"));
        }
        let incoming: Vec<_> = component.iter().filter(|(_, b, _)| b == &current).collect();
        if incoming.is_empty() {
            break;
        }
        if incoming.len() != 1
            || component
                .iter()
                .filter(|(a, _, _)| a == &incoming[0].0)
                .count()
                != 1
        {
            return Err(blocked("ambiguous rename predecessors"));
        }
        route.push(incoming[0].clone());
        current = incoming[0].0.clone();
    }
    route.reverse();
    if route.len() != component.len() || route.windows(2).any(|w| w[0].2 >= w[1].2) {
        return Err(blocked("non-increasing or disconnected rename chronology"));
    }
    Ok(Some(route))
}
fn symbol_at<'a>(route: &'a [Edge], date: &str) -> &'a str {
    let mut symbol = route[0].0.as_str();
    for (_, new, when) in route {
        if date >= when.as_str() {
            symbol = new;
        }
    }
    symbol
}

pub(in crate::database) fn resolve(
    c: &Connection,
    folder: &Path,
    row: &CorporateActionImportRow,
) -> AppResult<Option<VerifiedRoute>> {
    if row.exchange != "NSE"
        || row.source != "NSE_API"
        || row.parse_status != "PARSED"
        || !matches!(
            row.action_type.as_str(),
            "DIVIDEND" | "SPLIT" | "BONUS" | "RIGHTS"
        )
    {
        return Ok(None);
    }
    let (Some(target), Some(isin), Some(date)) = (&row.symbol, &row.isin, &row.ex_date) else {
        return Ok(None);
    };
    // Preserve the established trusted-history/direct route. This new proof is
    // used only where that route cannot establish the ordinary trading window.
    let today = chrono::Utc::now()
        .with_timezone(&chrono::FixedOffset::east_opt(19800).unwrap())
        .date_naive();
    if let Some(window) = super::load_trade_window(c, folder, target, &row.exchange, date)? {
        if super::ensure_import_trade_window_ready(Some(&window), date, today).is_ok() {
            return Ok(None);
        }
    }
    let has_source: bool = c.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='corporate_action_symbol_chain_sources' AND type='table')",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    if !has_source {
        return Ok(None);
    }
    let source = c.query_row("SELECT id,source_url,source_hash,raw_csv,captured_at FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Vec<u8>>(3)?,r.get::<_,String>(4)?))).optional().map_err(|e|e.to_string())?;
    let Some((source_id, url, digest, bytes, captured)) = source else {
        return Ok(None);
    };
    super::super::official_source_urls::validate_nse_official_source_url(&url)
        .map_err(|_| blocked("untrusted official source URL"))?;
    let parsed = reqwest::Url::parse(&url).map_err(|_| blocked("invalid official source URL"))?;
    if parsed.scheme() != "https"
        || parsed.path() != "/content/equities/symbolchange.csv"
        || bytes.len() > 2_000_000
        || captured.trim().is_empty()
        || hash(&bytes) != digest
    {
        return Err(blocked(
            "retained official source failed provenance/hash validation",
        ));
    }
    let edges = GRAPHS.with(|cache| -> AppResult<Arc<Vec<Edge>>> {
        let mut cache = cache.borrow_mut();
        if let Some((_, edges)) = cache.iter().find(|(h, _)| h == &digest) {
            return Ok(edges.clone());
        }
        let parsed = super::super::nse_identity_imports::parse_ca_symbol_change_source(&bytes)
            .map_err(|error| blocked(&format!("retained source parsing failed: {error}")))?;
        let edges: Arc<Vec<Edge>> = Arc::new(
            parsed
                .into_iter()
                .map(|(a, b, d, _)| (a, b, d))
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        );
        if cache.len() >= 4 {
            cache.remove(0);
        }
        cache.push((digest.clone(), edges.clone()));
        Ok(edges)
    })?;
    let Some(route) = chain(&edges, target)? else {
        return Ok(None);
    };
    if isin.len() != 12
        || !isin
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
    {
        return Err(blocked("a complete canonical full ISIN is required"));
    }
    let ex = NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| blocked("invalid ex-date"))?;
    let from = ex
        .checked_sub_signed(chrono::Duration::days(7))
        .ok_or_else(|| blocked("date overflow"))?
        .format("%Y-%m-%d")
        .to_string();
    let to = ex
        .checked_add_signed(chrono::Duration::days(7))
        .ok_or_else(|| blocked("date overflow"))?
        .min(today)
        .format("%Y-%m-%d")
        .to_string();
    if ex > today {
        return Err("Scheduled / Upcoming: official ex-date has not traded.".into());
    }
    if symbol_at(&route, &from) == target {
        return Ok(None);
    }
    // Every locally represented member must have this exact full ISIN. The
    // authoritative dated rename plus exact event witness disambiguates stale
    // active alias rows; no lifecycle flags are changed or blindly trusted.
    let names: BTreeSet<_> = route
        .iter()
        .flat_map(|(a, b, _)| [a.clone(), b.clone()])
        .collect();
    for name in &names {
        if name.contains(['/', '\\']) || name == "." || name == ".." {
            return Err(blocked("invalid symbol path"));
        }
        let values: Vec<Option<String>> = c
            .prepare("SELECT isin FROM instruments WHERE exchange='NSE' AND symbol=?")
            .map_err(|e| e.to_string())?
            .query_map([name], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;
        if values.len() != 1 || values[0].as_deref() != Some(isin) {
            return Err(blocked(
                "missing or conflicting full-ISIN evidence along rename chain",
            ));
        }
    }
    let peers: Vec<String> = c
        .prepare("SELECT symbol FROM instruments WHERE exchange='NSE' AND isin=?")
        .map_err(|e| e.to_string())?
        .query_map([isin], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;
    if peers.iter().any(|name| !names.contains(name)) {
        return Err(blocked("competing same-ISIN identity outside dated chain"));
    }
    let Some(witness) = super::dated_symbol_chain::price_witness(c, row, symbol_at(&route, date))?
    else {
        return Err(blocked(
            "exact fresh official event/ISIN witness is missing or conflicting",
        ));
    };
    let context = super::super::eod_data::resolve_instrument_context(c, target, "NSE")?
        .ok_or_else(|| blocked("missing current context"))?;
    if context.current_symbol != *target || context.isin.as_deref() != Some(isin) {
        return Err(blocked("current context conflicts with route target"));
    }
    let mut bars = Vec::new();
    for name in &names {
        let mut exact = context.clone();
        exact.current_symbol = name.clone();
        exact.related_symbols = vec![name.clone()];
        exact.symbol_transitions.clear();
        for price in super::super::eod_data::load_unified_price_rows(folder, c, &exact, &from, &to)?
        {
            if price.symbol == symbol_at(&route, &price.date)
                && price.close.is_finite()
                && price.close > 0.0
                && price.open.is_finite()
                && price.open > 0.0
            {
                bars.push((
                    price.symbol.clone(),
                    ScannedBar {
                        date: price.date,
                        open: price.open,
                        close: price.close,
                    },
                ));
            }
        }
    }
    bars.sort_by(|a, b| a.1.date.cmp(&b.1.date));
    let previous = bars.iter().rev().find(|(_, bar)| bar.date < *date);
    let post = bars.iter().find(|(_, bar)| bar.date >= *date);
    let (Some((previous_symbol, previous)), Some((ex_symbol, ex_bar))) = (previous, post) else {
        return Err("Waiting for EOD Data: verified dated route exists, but its cum/ex-date trading bars are missing.".into());
    };
    let database: String = c
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let binding = serde_json::json!({"version":"CA_EVENT_PRICE_ROUTE_R1","database":database.replace('/',"\\").to_lowercase(),
        "importId":row.id,"exchange":row.exchange,"symbol":target,"isin":isin,"exDate":date,"action":row.action_type,
        "purpose":row.purpose_raw,"recordDate":row.record_date,"cash":row.cash_amount.map(f64::to_bits),"ratioNum":row.ratio_num.map(f64::to_bits),"ratioDen":row.ratio_den.map(f64::to_bits),
        "oldFace":row.old_face_value.map(f64::to_bits),"newFace":row.new_face_value.map(f64::to_bits),"sourceId":source_id,"sourceHash":digest,"sourceUrl":url,"sourceCaptured":captured,
        "witness":witness,"edges":route,"previousSymbol":previous_symbol,"previousDate":previous.date,"previousClose":previous.close.to_bits(),
        "exSymbol":ex_symbol,"exTradeDate":ex_bar.date,"exClose":ex_bar.close.to_bits(),"exOpen":ex_bar.open.to_bits()});
    Ok(Some(VerifiedRoute {
        previous: previous.clone(),
        ex_bar: ex_bar.clone(),
        fingerprint: hash(binding.to_string().as_bytes()),
    }))
}
