//! Source-backed dated symbol chains. This is metadata proof, never approval.
use super::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub(super) const DECISION: &str = "VERIFIED_DATED_SYMBOL_CHAIN_R1";
const VERSION: &str = "CA_DATED_SYMBOL_CHAIN_R1";
const MAX_BYTES: usize = 2_000_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Edge {
    old: String,
    new: String,
    date: String,
    line: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub(super) struct Proof {
    version: String,
    database: String,
    import_id: i64,
    exchange: String,
    raw_symbol: String,
    raw_isin: String,
    event_date: String,
    action: String,
    purpose: String,
    record_date: Option<String>,
    cash: Option<u64>,
    source_id: i64,
    source_url: String,
    source_hash: String,
    source_captured: String,
    edges: Vec<Edge>,
    event_symbol: String,
    target_isin: String,
    witness_id: i64,
    witness_url: String,
    witness_hash: String,
    witness_captured: String,
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn exists(c: &Connection, table: &str) -> AppResult<bool> {
    c.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
        [table],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}
fn source_url(url: &str) -> AppResult<()> {
    super::super::official_source_urls::validate_nse_official_source_url(url)?;
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" || !parsed.path().ends_with("/symbolchange.csv") {
        return Err(
            "Historical identity source must be the official HTTPS symbol-change CSV.".to_string(),
        );
    }
    Ok(())
}
pub(super) fn retain_source(c: &Connection, url: &str, bytes: &[u8]) -> AppResult<()> {
    source_url(url)?;
    if bytes.len() > MAX_BYTES {
        return Err("Historical identity source exceeds size limit.".to_string());
    }
    super::super::nse_identity_imports::parse_ca_symbol_change_source(bytes)?;
    c.execute_batch("CREATE TABLE IF NOT EXISTS corporate_action_symbol_chain_sources(
        id INTEGER PRIMARY KEY,source_url TEXT NOT NULL,source_hash TEXT NOT NULL,raw_csv BLOB NOT NULL,
        captured_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS corporate_action_symbol_chain_proofs(
        import_id INTEGER PRIMARY KEY,proof_json TEXT NOT NULL,fingerprint TEXT NOT NULL);").map_err(|e|e.to_string())?;
    c.execute("INSERT INTO corporate_action_symbol_chain_sources(source_url,source_hash,raw_csv,captured_at)
        VALUES(?,?,?,datetime('now'))",params![url,hash(bytes),bytes]).map_err(|e|e.to_string())?;
    Ok(())
}
pub(super) fn collect(c: &Connection, force: bool) -> AppResult<()> {
    if !force && exists(c, "corporate_action_symbol_chain_sources")? {
        let cached=c.query_row("SELECT source_url,source_hash,raw_csv,captured_at>=datetime('now','-1 day') FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,Vec<u8>>(2)?,r.get::<_,bool>(3)?))).optional().map_err(|e|e.to_string())?;
        let configured = super::super::official_source_urls::load_official_source_urls(Some(c))?;
        if let Some((url, digest, bytes, true)) = cached {
            if url == configured.nse_symbol_change_url
                && source_url(&url).is_ok()
                && bytes.len() <= MAX_BYTES
                && hash(&bytes) == digest
                && super::super::nse_identity_imports::parse_ca_symbol_change_source(&bytes).is_ok()
            {
                return Ok(());
            }
        }
    }
    let (url, bytes) = super::super::nse_identity_imports::download_ca_symbol_change_source(c)?;
    retain_source(c, &url, &bytes)
}

// Resolve the whole connected component; a branch, merge, reused symbol or
// non-increasing date is ambiguity, not an opportunity to choose a path.
fn path(edges: &[Edge], target: &str, date: &str) -> Option<(Vec<Edge>, String)> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let mut names = BTreeSet::from([target.to_string()]);
    loop {
        let n = names.len();
        for e in edges {
            if names.contains(&e.old) || names.contains(&e.new) {
                names.insert(e.old.clone());
                names.insert(e.new.clone());
            }
        }
        if names.len() == n {
            break;
        }
        if names.len() > 64 {
            return None;
        }
    }
    let component: Vec<_> = edges
        .iter()
        .filter(|e| names.contains(&e.old) || names.contains(&e.new))
        .cloned()
        .collect();
    if component.len() < 2 || component.len() + 1 != names.len() {
        return None;
    }
    let mut current = target.to_string();
    let mut backwards = Vec::new();
    let mut seen = BTreeSet::new();
    if component.iter().any(|e| e.old == target) {
        return None;
    }
    loop {
        if !seen.insert(current.clone()) {
            return None;
        }
        let incoming: Vec<_> = component.iter().filter(|e| e.new == current).collect();
        if incoming.is_empty() {
            break;
        }
        if incoming.len() != 1 {
            return None;
        }
        let e = incoming[0];
        if component.iter().filter(|x| x.old == e.old).count() != 1 {
            return None;
        }
        NaiveDate::parse_from_str(&e.date, "%Y-%m-%d").ok()?;
        backwards.push(e.clone());
        current = e.old.clone();
    }
    backwards.reverse();
    if backwards.len() != component.len() || backwards.windows(2).any(|w| w[0].date >= w[1].date) {
        return None;
    }
    let mut at_event = current;
    for edge in &backwards {
        if date >= edge.date.as_str() {
            at_event = edge.new.clone();
        }
    }
    Some((backwards, at_event))
}

fn witness(
    c: &Connection,
    row: &CorporateActionImportRow,
    event_symbol: &str,
) -> AppResult<Option<(i64, String, String, String)>> {
    witness_for_action(c, row, event_symbol, "DIVIDEND")
}

pub(super) fn price_witness(c: &Connection, row: &CorporateActionImportRow, event_symbol: &str) -> AppResult<Option<(i64,String,String,String)>> {
    let witness = witness_for_action(c,row,event_symbol,&row.action_type)?;
    if let Some((id,_,_,_)) = &witness {
        let raw: String = c.query_row("SELECT raw_reference FROM corporate_action_import_evidence WHERE id=?",[id],|r|r.get(0)).map_err(|e|e.to_string())?;
        let parsed: Value = serde_json::from_str(&raw).map_err(|e|e.to_string())?;
        if parsed.get("recordDate").and_then(Value::as_str) != row.record_date.as_deref() { return Ok(None); }
    }
    Ok(witness)
}

fn witness_for_action(c: &Connection, row: &CorporateActionImportRow, event_symbol: &str, expected_action: &str) -> AppResult<Option<(i64,String,String,String)>> {
    let mut stmt=c.prepare("SELECT id,source_locator,captured_at,raw_reference,note,symbol_seen,isin_seen,event_date_seen,action_type_seen
        FROM corporate_action_import_evidence WHERE import_id=? AND source_code='NSE_API'").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([row.id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, Option<String>>(7)?,
                r.get::<_, Option<String>>(8)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut matching = Vec::new();
    for (id, url, captured, raw, note, symbol, isin, date, action) in rows {
        if note
            .as_deref()
            .unwrap_or("")
            .to_lowercase()
            .contains("backfill")
        {
            continue;
        }
        let (Some(url), Some(raw)) = (url, raw) else {
            continue;
        };
        let Ok(u) = reqwest::Url::parse(&url) else {
            continue;
        };
        if super::super::official_source_urls::validate_nse_official_source_url(&url).is_err()
            || u.scheme() != "https"
            || u.path() != "/api/corporates-corporateActions"
            || captured.trim().is_empty()
        {
            continue;
        }
        let Ok(p) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        let get = |k: &str| p.get(k).and_then(Value::as_str);
        let valid_symbol =
            symbol.as_deref() == row.symbol.as_deref() || symbol.as_deref() == Some(event_symbol);
        if !valid_symbol
            || isin != row.isin
            || date != row.ex_date
            || action.as_deref() != Some(expected_action)
            || get("symbol") != symbol.as_deref()
            || get("isin") != row.isin.as_deref()
            || get("exDate") != row.ex_date.as_deref()
            || get("purposeRaw") != Some(row.purpose_raw.as_str())
        {
            return Ok(None);
        }
        matching.push((id, url, hash(raw.as_bytes()), captured));
    }
    Ok(if matching.len() == 1 {
        matching.pop()
    } else {
        None
    })
}

pub(super) fn evaluate(
    c: &Connection,
    row: &CorporateActionImportRow,
    s: &CorporateActionImportResolutionSuggestion,
) -> AppResult<Option<Proof>> {
    if row.exchange != "NSE"
        || row.source != "NSE_API"
        || row.action_type != "DIVIDEND"
        || row.parse_status != "PARSED"
        || !matches!(
            row.review_status.as_str(),
            "PENDING" | "UNRESOLVED" | "PENDING_ISIN_MISMATCH"
        )
        || row.approved_corporate_action_id.is_some()
        || !s.is_active
        || Some(s.symbol.as_str()) != row.symbol.as_deref()
        || s.exchange != row.exchange
        || !exists(c, "corporate_action_symbol_chain_sources")?
    {
        return Ok(None);
    }
    let (Some(symbol), Some(isin), Some(date), Some(target_isin)) =
        (&row.symbol, &row.isin, &row.ex_date, &s.isin)
    else {
        return Ok(None);
    };
    if isin == target_isin {
        return Ok(None);
    }
    let active:i64=c.query_row("SELECT count(*) FROM instruments WHERE exchange=? AND symbol=? AND COALESCE(is_active,1)=1",params![row.exchange,symbol],|r|r.get(0)).map_err(|e|e.to_string())?;
    if active != 1 {
        return Ok(None);
    }
    let actual_isin:Option<String>=c.query_row("SELECT isin FROM instruments WHERE exchange=? AND symbol=? AND COALESCE(is_active,1)=1",params![row.exchange,symbol],|r|r.get(0)).map_err(|e|e.to_string())?;
    if actual_isin.as_deref() != Some(target_isin.as_str()) {
        return Ok(None);
    }
    let source=c.query_row("SELECT id,source_url,source_hash,raw_csv,captured_at FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Vec<u8>>(3)?,r.get::<_,String>(4)?))).optional().map_err(|e|e.to_string())?;
    let Some((source_id, url, digest, bytes, captured)) = source else {
        return Ok(None);
    };
    if source_url(&url).is_err()
        || bytes.len() > MAX_BYTES
        || hash(&bytes) != digest
        || captured.trim().is_empty()
    {
        return Ok(None);
    }
    let Ok(source_rows) = super::super::nse_identity_imports::parse_ca_symbol_change_source(&bytes)
    else {
        return Ok(None);
    };
    let edges = source_rows
        .into_iter()
        .map(|(old, new, date, line)| Edge {
            old,
            new,
            date,
            line,
        })
        .collect::<Vec<_>>();
    let Some((edges, event_symbol)) = path(&edges, symbol, date) else {
        return Ok(None);
    };
    // A rename chain cannot justify a present-day ISIN mismatch after the
    // final rename. That needs independent ISIN-transition evidence.
    if event_symbol == *symbol {
        return Ok(None);
    }
    let Some((witness_id, witness_url, witness_hash, witness_captured)) =
        witness(c, row, &event_symbol)?
    else {
        return Ok(None);
    };
    // Any other active member is a second possible security, even with one
    // active row for the requested current symbol.
    for name in edges.iter().map(|e| &e.old) {
        let n:i64=c.query_row("SELECT count(*) FROM instruments WHERE exchange=? AND symbol=? AND COALESCE(is_active,1)=1",params![row.exchange,name],|r|r.get(0)).map_err(|e|e.to_string())?;
        if n != 0 {
            return Ok(None);
        }
    }
    let database: String = c
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(Some(Proof {
        version: VERSION.to_string(),
        database: database.replace('/', "\\").to_lowercase(),
        import_id: row.id,
        exchange: row.exchange.clone(),
        raw_symbol: symbol.clone(),
        raw_isin: isin.clone(),
        event_date: date.clone(),
        action: row.action_type.clone(),
        purpose: row.purpose_raw.clone(),
        record_date: row.record_date.clone(),
        cash: row.cash_amount.map(f64::to_bits),
        source_id,
        source_url: url,
        source_hash: digest,
        source_captured: captured,
        edges,
        event_symbol,
        target_isin: target_isin.clone(),
        witness_id,
        witness_url,
        witness_hash,
        witness_captured,
    }))
}
impl Proof {
    pub(super) fn fingerprint(&self) -> AppResult<String> {
        Ok(hash(&serde_json::to_vec(self).map_err(|e| e.to_string())?))
    }
    pub(super) fn related(&self, symbol: &str) -> bool {
        self.edges
            .iter()
            .any(|e| e.old == symbol || e.new == symbol)
    }
    pub(super) fn store(&self, c: &Connection) -> AppResult<()> {
        c.execute("INSERT INTO corporate_action_symbol_chain_proofs(import_id,proof_json,fingerprint) VALUES(?,?,?)
            ON CONFLICT(import_id) DO UPDATE SET proof_json=excluded.proof_json,fingerprint=excluded.fingerprint",
            params![self.import_id,serde_json::to_string(self).map_err(|e|e.to_string())?,self.fingerprint()?]).map_err(|e|e.to_string())?;
        Ok(())
    }
}
pub(super) fn verify_persisted(
    c: &Connection,
    row: &CorporateActionImportRow,
    s: &CorporateActionImportResolutionSuggestion,
) -> AppResult<bool> {
    if !exists(c, "corporate_action_symbol_chain_proofs")? {
        return Ok(false);
    }
    let Some(current) = evaluate(c, row, s)? else {
        return Ok(false);
    };
    let stored=c.query_row("SELECT proof_json,fingerprint FROM corporate_action_symbol_chain_proofs WHERE import_id=?",[row.id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).optional().map_err(|e|e.to_string())?;
    let Some((json, digest)) = stored else {
        return Ok(false);
    };
    let Ok(proof) = serde_json::from_str::<Proof>(&json) else {
        return Ok(false);
    };
    Ok(proof == current && proof.fingerprint()? == digest)
}

#[cfg(test)]
mod tests;
