//! Backend-only diagnostic checkpoints. Historical renderer reports are never cache inputs.
use super::super::{
    binary_eod::{date_to_u32, BinaryEodFile, EodHeader, EodRecord},
    AppResult,
};
use super::auto_approval::{
    self, SimpleCashDividendPreparedScopeDisposition as Item,
    SimpleCashDividendPreparedScopeInput as Input, SimpleCashDividendPreparedScopeResult as Result,
};
use chrono::{Duration, NaiveDate};
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeSet, HashMap},
    path::{Path, PathBuf},
};

/// Resolve through the existing manifest-aware reader, without repeating all
/// database migrations/backfills for every 100-ID diagnostic call. Active database
/// opening owns migrations; a missing cache schema fails closed below.
pub(super) fn open_connection(folder: &Path) -> AppResult<Connection> {
    let reader = super::super::open_read_only_connection_for_folder(folder)?;
    let path: String = reader
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name='main'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    drop(reader);
    let c = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE)
        .map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_secs(15))
        .map_err(|e| e.to_string())?;
    c.pragma_update(None, "foreign_keys", true)
        .map_err(|e| e.to_string())?;
    Ok(c)
}

#[derive(Default)]
struct GroupIndex {
    dates: HashMap<(String, String), Vec<i64>>,
    symbols: HashMap<(String, String), Vec<i64>>,
    isins: HashMap<(String, String), Vec<i64>>,
}

impl GroupIndex {
    fn load(c: &Connection, table: &str, date: &str) -> AppResult<Self> {
        let mut index = Self::default();
        let mut s = c
            .prepare(&format!(
                "SELECT id,UPPER(exchange),{date},UPPER(symbol),UPPER(isin) FROM {table}"
            ))
            .map_err(|e| e.to_string())?;
        let mut rows = s.query([]).map_err(|e| e.to_string())?;
        while let Some(r) = rows.next().map_err(|e| e.to_string())? {
            let id: i64 = r.get(0).map_err(|e| e.to_string())?;
            let exchange: String = r.get(1).map_err(|e| e.to_string())?;
            for (column, map) in [
                (2, &mut index.dates),
                (3, &mut index.symbols),
                (4, &mut index.isins),
            ] {
                if let Some(value) = r
                    .get::<_, Option<String>>(column)
                    .map_err(|e| e.to_string())?
                {
                    map.entry((exchange.clone(), value)).or_default().push(id);
                }
            }
        }
        Ok(index)
    }
    fn ids(
        &self,
        exchange: &str,
        date: &str,
        symbols: &BTreeSet<String>,
        isins: &BTreeSet<String>,
    ) -> Vec<i64> {
        let exchange = exchange.to_ascii_uppercase();
        let mut ids = BTreeSet::new();
        if let Some(found) = self.dates.get(&(exchange.clone(), date.into())) {
            ids.extend(found);
        }
        for (values, map) in [(symbols, &self.symbols), (isins, &self.isins)] {
            for value in values {
                if let Some(found) = map.get(&(exchange.clone(), value.to_ascii_uppercase())) {
                    ids.extend(found);
                }
            }
        }
        ids.into_iter().copied().collect()
    }
}

type BinarySnapshot = AppResult<Option<(EodHeader, Vec<EodRecord>)>>;
type IdentityGroup = (BTreeSet<String>, BTreeSet<String>);

fn read_binary(path: &Path) -> BinarySnapshot {
    match std::fs::metadata(path) {
        Ok(_) => {
            let file = BinaryEodFile::open(path)?;
            let records = file.read_all()?;
            if records.windows(2).any(|p| p[0].date >= p[1].date) {
                return Err("Unproven binary price ordering".into());
            }
            Ok(Some((file.header, records)))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn binary_window(snapshot: &BinarySnapshot, date: NaiveDate) -> AppResult<String> {
    let mut h = Sha256::new();
    if let Some((header, records)) = snapshot.as_ref().map_err(Clone::clone)? {
        field(&mut h, &header.version.to_le_bytes());
        field(&mut h, header.symbol.as_bytes());
        field(&mut h, header.exchange.as_bytes());
        field(&mut h, &header.price_scale.to_le_bytes());
        let ex = date_to_u32(&date.to_string());
        let lo = date_to_u32(&(date - Duration::days(7)).to_string());
        let hi = date_to_u32(&(date + Duration::days(7)).to_string());
        let first = records.partition_point(|r| r.date < lo);
        let end = records.partition_point(|r| r.date <= hi);
        let next = records.partition_point(|r| r.date < ex);
        let mut indices: BTreeSet<usize> = (first..end).collect();
        if next > 0 {
            indices.insert(next - 1);
        }
        if next < records.len() {
            indices.insert(next);
        }
        for i in indices {
            field(&mut h, format!("{:?}", records[i]).as_bytes());
        }
    } else {
        field(&mut h, b"absent");
    }
    Ok(format!("{:x}", h.finalize()))
}

/// Lifetime is exactly one IMMEDIATE transaction, never an mtime/session cache.
struct BatchInputs {
    imports: GroupIndex,
    actions: GroupIndex,
    edges: AppResult<Vec<(String, String)>>,
    groups: HashMap<(Vec<i64>, Vec<i64>), String>,
    records: HashMap<String, (Vec<String>, HashMap<i64, Vec<(i64, [u8; 32])>>)>,
    identities: HashMap<(String, Option<String>, Option<String>), AppResult<IdentityGroup>>,
    binary: HashMap<PathBuf, BinarySnapshot>,
    windows: HashMap<(PathBuf, NaiveDate), String>,
    dates: HashMap<NaiveDate, [NaiveDate; 2]>,
    #[cfg(test)]
    file_reads: usize,
    #[cfg(test)]
    group_reads: usize,
    #[cfg(test)]
    identity_reads: usize,
    #[cfg(test)]
    dependency_rows_read: usize,
}

fn current_dates(date: NaiveDate) -> [NaiveDate; 2] {
    let ist = chrono::Utc::now()
        .with_timezone(&chrono::FixedOffset::east_opt(19800).unwrap())
        .date_naive();
    [
        due_bucket(date, ist),
        due_bucket(date, chrono::Local::now().date_naive()),
    ]
}

impl BatchInputs {
    fn load(c: &Connection) -> AppResult<Self> {
        let edges = (|| -> AppResult<Vec<(String, String)>> {
            if !exists(c, "corporate_action_symbol_chain_sources")? {
                return Ok(Vec::new());
            }
            let bytes:Option<Vec<u8>>=c.query_row("SELECT raw_csv FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",[],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
            match bytes {
                Some(bytes) => Ok(
                    super::super::nse_identity_imports::parse_ca_symbol_change_source(&bytes)?
                        .into_iter()
                        .map(|(a, b, _, _)| (a, b))
                        .collect(),
                ),
                None => Ok(Vec::new()),
            }
        })();
        Ok(Self {
            imports: GroupIndex::load(c, "corporate_action_imports", "ex_date")?,
            actions: GroupIndex::load(c, "corporate_actions", "effective_date")?,
            edges,
            groups: HashMap::new(),
            records: HashMap::new(),
            identities: HashMap::new(),
            binary: HashMap::new(),
            windows: HashMap::new(),
            dates: HashMap::new(),
            #[cfg(test)]
            file_reads: 0,
            #[cfg(test)]
            group_reads: 0,
            #[cfg(test)]
            identity_reads: 0,
            #[cfg(test)]
            dependency_rows_read: 0,
        })
    }

    fn identity_group(
        &mut self,
        c: &Connection,
        row: &crate::database::CorporateActionImportRow,
    ) -> AppResult<IdentityGroup> {
        let key = (row.exchange.clone(), row.symbol.clone(), row.isin.clone());
        if let Some(value) = self.identities.get(&key) {
            return value.clone();
        }
        #[cfg(test)]
        {
            self.identity_reads += 1;
        }
        let group = (|| -> AppResult<IdentityGroup> {
            let mut symbols = BTreeSet::new();
            let mut isins = BTreeSet::new();
            if let Some(s) = &row.symbol {
                symbols.insert(s.clone());
            }
            if let Some(i) = &row.isin {
                isins.insert(i.clone());
            }
            if let Some(s) = &row.symbol {
                for candidate in super::load_identity_chain_instrument_candidates(
                    c,
                    s,
                    row.isin.as_deref(),
                    &row.exchange,
                )? {
                    symbols.insert(candidate.symbol);
                    if let Some(i) = candidate.isin {
                        isins.insert(i);
                    }
                }
                if let Some(context) =
                    super::super::eod_data::resolve_instrument_context(c, s, &row.exchange)?
                {
                    symbols.extend(context.related_symbols);
                    if let Some(i) = context.isin {
                        isins.insert(i);
                    }
                }
            }
            let edges = self.edges.as_ref().map_err(Clone::clone)?;
            loop {
                let before = symbols.len();
                for (a, b) in edges {
                    if symbols.contains(a) || symbols.contains(b) {
                        symbols.insert(a.clone());
                        symbols.insert(b.clone());
                    }
                }
                if symbols.len() == before {
                    break;
                }
            }
            Ok((symbols, isins))
        })();
        self.identities.insert(key, group.clone());
        group
    }

    fn group_hash(
        &mut self,
        c: &Connection,
        exchange: &str,
        date: &str,
        symbols: &BTreeSet<String>,
        isins: &BTreeSet<String>,
    ) -> AppResult<String> {
        let imports = self.imports.ids(exchange, date, symbols, isins);
        let actions = self.actions.ids(exchange, date, symbols, isins);
        let key = (imports, actions);
        if let Some(value) = self.groups.get(&key) {
            return Ok(value.clone());
        }
        #[cfg(test)]
        {
            self.group_reads += 1;
        }
        let mut h = Sha256::new();
        for (table, column) in [
            ("corporate_action_imports", "id"),
            ("corporate_action_import_evidence", "import_id"),
            ("corporate_action_import_decisions", "import_id"),
        ] {
            self.hash_records(c, &mut h, table, column, &key.0)?;
        }
        for table in [
            "corporate_action_event_identity_resolutions",
            "corporate_action_symbol_chain_proofs",
        ] {
            field(&mut h, table.as_bytes());
            if exists(c, table)? {
                self.hash_records(c, &mut h, table, "import_id", &key.0)?;
            } else {
                field(&mut h, b"absent");
            }
        }
        self.hash_records(c, &mut h, "corporate_actions", "id", &key.1)?;
        let digest = format!("{:x}", h.finalize());
        self.groups.insert(key, digest.clone());
        Ok(digest)
    }

    // Overlapping groups share complete row digests, including negative reads.
    // This state lives only within evaluate's IMMEDIATE transaction; no SQLite
    // dependency is skipped or trusted across calls. External files are separate.
    fn hash_records(
        &mut self,
        c: &Connection,
        h: &mut Sha256,
        table: &str,
        owner: &str,
        ids: &[i64],
    ) -> AppResult<()> {
        let (columns, records) = self.records.entry(table.to_string()).or_default();
        let missing: Vec<i64> = ids
            .iter()
            .copied()
            .filter(|id| !records.contains_key(id))
            .collect();
        let sql =
            format!("SELECT * FROM {table} WHERE {owner} IN (SELECT value FROM json_each(?))");
        if columns.is_empty() || !missing.is_empty() {
            let mut s = c.prepare(&sql).map_err(|e| e.to_string())?;
            let names: Vec<String> = s
                .column_names()
                .iter()
                .map(|name| name.to_string())
                .collect();
            let owner_index = s.column_index(owner).map_err(|e| e.to_string())?;
            let id_index = s.column_index("id").unwrap_or(owner_index);
            let json = serde_json::to_string(&missing).map_err(|e| e.to_string())?;
            let mut fetched: HashMap<i64, Vec<(i64, [u8; 32])>> =
                missing.iter().map(|id| (*id, Vec::new())).collect();
            let mut rows = s.query([json]).map_err(|e| e.to_string())?;
            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let owner_id: i64 = row.get(owner_index).map_err(|e| e.to_string())?;
                let id: i64 = row.get(id_index).map_err(|e| e.to_string())?;
                let mut digest = Sha256::new();
                hash_row(&mut digest, row, names.len())?;
                fetched
                    .entry(owner_id)
                    .or_default()
                    .push((id, digest.finalize().into()));
                #[cfg(test)]
                {
                    self.dependency_rows_read += 1;
                }
            }
            // Publish only complete reads; query errors never populate partial proof.
            *columns = names;
            records.extend(fetched);
        }
        field(h, sql.as_bytes());
        for name in columns.iter() {
            field(h, name.as_bytes());
        }
        let mut rows: Vec<_> = ids.iter().flat_map(|id| records[id].iter()).collect();
        rows.sort_unstable_by_key(|(id, _)| *id);
        for (id, digest) in rows {
            field(h, &id.to_le_bytes());
            field(h, digest);
        }
        Ok(())
    }

    fn price_hash(&mut self, path: PathBuf, date: NaiveDate) -> AppResult<String> {
        let key = (path.clone(), date);
        if let Some(hash) = self.windows.get(&key) {
            return Ok(hash.clone());
        }
        if !self.binary.contains_key(&path) {
            #[cfg(test)]
            {
                self.file_reads += 1;
            }
            self.binary.insert(path.clone(), read_binary(&path));
        }
        let digest = binary_window(&self.binary[&path], date)?;
        self.windows.insert(key, digest.clone());
        Ok(digest)
    }

    fn verify_external(&mut self) -> AppResult<()> {
        // Re-read each actual file once, then compare every date-valid window.
        // Release the initial file buffers and stream the verification files.
        self.binary.clear();
        let paths: BTreeSet<_> = self.windows.keys().map(|(path, _)| path).collect();
        for path in paths {
            let snapshot = read_binary(path);
            for ((_, date), before) in self.windows.iter().filter(|((p, _), _)| p == path) {
                if binary_window(&snapshot, *date).ok().as_ref() != Some(before) {
                    return Err(
                        "Dividend dependencies changed during validation; retry Load & Validate."
                            .into(),
                    );
                }
            }
        }
        if self
            .dates
            .iter()
            .any(|(date, before)| current_dates(*date) != *before)
        {
            return Err(
                "Dividend eligibility date changed during validation; retry Load & Validate."
                    .into(),
            );
        }
        Ok(())
    }
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn field(h: &mut Sha256, bytes: &[u8]) {
    h.update((bytes.len() as u64).to_le_bytes());
    h.update(bytes);
}

// Explicit source compatibility: rebuilding without a policy/dependency-code change is safe.
// Include transitive policy owners, including embedded identity authority and price routing.
fn algorithm_hash() -> String {
    let mut h = Sha256::new();
    for bytes in [
        include_bytes!("dividend_validation_cache.rs").as_slice(),
        include_bytes!("auto_approval.rs").as_slice(),
        include_bytes!("../corporate_action_imports.rs").as_slice(),
        include_bytes!("split_bonus_terms.rs").as_slice(),
        include_bytes!("simple_cash_dividend_evidence.rs").as_slice(),
        include_bytes!("event_identity_resolution.rs").as_slice(),
        include_bytes!("event_identity_authority.rs").as_slice(),
        include_bytes!("v114e_event_identity_authority.json").as_slice(),
        include_bytes!("historical_isin_transition.rs").as_slice(),
        include_bytes!("dated_symbol_chain.rs").as_slice(),
        include_bytes!("event_price_route.rs").as_slice(),
        include_bytes!("../eod_data.rs").as_slice(),
        include_bytes!("../instrument_mutations.rs").as_slice(),
        include_bytes!("../binary_eod.rs").as_slice(),
        include_bytes!("../storage_mode.rs").as_slice(),
        include_bytes!("../nse_identity_imports.rs").as_slice(),
        include_bytes!("../official_source_urls.rs").as_slice(),
        include_bytes!("../../database.rs").as_slice(),
        include_bytes!("../../../Cargo.lock").as_slice(),
    ] {
        field(&mut h, bytes);
    }
    format!("{:x}", h.finalize())
}

fn exists(c: &Connection, table: &str) -> AppResult<bool> {
    c.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
        [table],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

// Typed, length-delimited SQL values and schema; no lossy concatenation/JSON floats.
fn query_hash(
    c: &Connection,
    h: &mut Sha256,
    sql: &str,
    args: &[&dyn rusqlite::ToSql],
) -> AppResult<()> {
    field(h, sql.as_bytes());
    let mut s = c.prepare(sql).map_err(|e| e.to_string())?;
    let columns = s.column_count();
    for name in s.column_names() {
        field(h, name.as_bytes());
    }
    let mut rows = s.query(args).map_err(|e| e.to_string())?;
    while let Some(r) = rows.next().map_err(|e| e.to_string())? {
        hash_row(h, r, columns)?;
    }
    Ok(())
}

fn hash_row(h: &mut Sha256, r: &rusqlite::Row<'_>, columns: usize) -> AppResult<()> {
    field(h, b"row");
    for i in 0..columns {
        match r.get_ref(i).map_err(|e| e.to_string())? {
            ValueRef::Null => field(h, b"null"),
            ValueRef::Integer(v) => {
                field(h, b"integer");
                field(h, &v.to_le_bytes());
            }
            ValueRef::Real(v) => {
                field(h, b"real");
                field(h, &v.to_bits().to_le_bytes());
            }
            ValueRef::Text(v) => {
                field(h, b"text");
                field(h, v);
            }
            ValueRef::Blob(v) => {
                field(h, b"blob");
                field(h, v);
            }
        }
    }
    Ok(())
}

fn table_hash(c: &Connection, h: &mut Sha256, table: &str) -> AppResult<()> {
    field(h, table.as_bytes());
    if exists(c, table)? {
        query_hash(c, h, &format!("SELECT * FROM {table} ORDER BY rowid"), &[])?;
    } else {
        field(h, b"absent");
    }
    Ok(())
}

fn global_hash(c: &Connection) -> AppResult<String> {
    let lineage: String = c.query_row("SELECT database_instance_id FROM corporate_action_history_metadata WHERE singleton_id=1 AND schema_version=1",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    if lineage.trim().is_empty() {
        return Err("Dividend cache requires database lineage.".into());
    }
    let mut h = Sha256::new();
    field(&mut h, algorithm_hash().as_bytes());
    // Negative/ambiguity checks can inspect the whole identity graph. Conservatively
    // invalidate all Dividend checkpoints when any of these identity inputs changes.
    for table in [
        "corporate_action_history_metadata",
        "instruments",
        "instrument_identity_history",
        "instrument_isin_history",
        "corporate_action_symbol_chain_sources",
    ] {
        table_hash(c, &mut h, table)?;
    }
    // A relocated database must not reuse database-bound dated-chain proofs.
    query_hash(
        c,
        &mut h,
        "SELECT file FROM pragma_database_list WHERE name='main'",
        &[],
    )?;
    field(
        &mut h,
        super::super::get_price_storage_mode(c).as_str().as_bytes(),
    );
    Ok(format!("{:x}", h.finalize()))
}

fn due_bucket(date: NaiveDate, today: NaiveDate) -> NaiveDate {
    today
        .max(date - Duration::days(1))
        .min(date + Duration::days(7))
}

fn dependency_hash(
    c: &Connection,
    folder: &Path,
    id: i64,
    global: &str,
    batch: &mut BatchInputs,
) -> AppResult<String> {
    let row = super::get_import_row(c, id)?;
    if row.exchange.contains(['/', '\\', ':']) || row.exchange == ".." || row.exchange == "." {
        return Err("Unproven exchange price path".into());
    }
    let date = NaiveDate::parse_from_str(row.ex_date.as_deref().unwrap_or(""), "%Y-%m-%d")
        .map_err(|e| e.to_string())?;
    if row.ex_date.as_deref() != Some(date.to_string().as_str()) {
        return Err("Unproven non-canonical Dividend dependency date".into());
    }
    let mut h = Sha256::new();
    field(&mut h, global.as_bytes());
    // Both clocks are used by existing policy seams. Capture only date eligibility
    // transitions, so historical rows do not expire every midnight.
    let dates = current_dates(date);
    batch.dates.insert(date, dates);
    for bucket in dates {
        field(&mut h, bucket.to_string().as_bytes());
    }
    let (symbols, isins) = batch.identity_group(c, &row)?;
    // Symbols with missing instrument rows still matter (negative price evidence).
    field(
        &mut h,
        batch
            .group_hash(c, &row.exchange, &date.to_string(), &symbols, &isins)?
            .as_bytes(),
    );
    let ex = date.to_string();
    let from = (date - Duration::days(7)).to_string();
    let to = (date + Duration::days(7)).to_string();
    for s in symbols {
        if s.is_empty() || s.contains(['/', '\\', ':']) || s == "." || s == ".." {
            return Err("Unproven price dependency path".into());
        }
        field(&mut h, s.as_bytes());
        // Hash actual date-valid contents, including absent files/rows and the
        // nearest bars outside the bounded window used by ordinary writer gates.
        query_hash(c,&mut h,"SELECT * FROM eod_prices WHERE exchange=?1 AND symbol=?2 AND
            (date BETWEEN ?3 AND ?4 OR date=(SELECT MAX(date) FROM eod_prices WHERE exchange=?1 AND symbol=?2 AND date<?5)
             OR date=(SELECT MIN(date) FROM eod_prices WHERE exchange=?1 AND symbol=?2 AND date>=?5)) ORDER BY date",
            &[&row.exchange,&s,&from,&to,&ex])?;
        let path = folder
            .join("eod_data")
            .join(&row.exchange)
            .join(format!("{s}.eod"));
        field(&mut h, batch.price_hash(path, date)?.as_bytes());
    }
    Ok(format!("{:x}", h.finalize()))
}

pub(super) fn evaluate(c: &mut Connection, folder: &Path, input: &Input) -> AppResult<Result> {
    super::validate_exact_import_lookup_ids(&input.import_ids)?;
    super::verify_import_lookup_database(folder, &input.expected_database_path)?;
    let tx = c
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let global = match global_hash(&tx) {
        Ok(value) => value,
        Err(_) => {
            return auto_approval::evaluate_simple_cash_dividend_prepared_scope_in_connection(
                &tx, folder, input,
            )
        }
    };
    let mut dependencies = HashMap::new();
    let mut items = HashMap::new();
    let mut stale = Vec::new();
    let mut batch = BatchInputs::load(&tx)?;
    for &id in &input.import_ids {
        // Missing/uncertain dependency proof always falls back to policy.
        let dep = dependency_hash(&tx, folder, id, &global, &mut batch).ok();
        let cached: Option<(String,String,String)> = tx.query_row(
            "SELECT p.dependency_hash,p.result_json,p.result_hash FROM corporate_action_dividend_validation_current i
             JOIN corporate_action_dividend_validation_checkpoints p ON p.id=i.checkpoint_id AND p.import_id=i.import_id WHERE i.import_id=?",
            [id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(|e|e.to_string())?;
        let reusable = cached.and_then(|(saved, json, digest)| {
            if dep.as_deref() != Some(saved.as_str()) || hash(json.as_bytes()) != digest {
                return None;
            }
            let item: Item = serde_json::from_str(&json).ok()?;
            (item.import_id == id && matches!(item.disposition.as_str(), "ELIGIBLE" | "INELIGIBLE"))
                .then_some(item)
        });
        if let Some(item) = reusable {
            items.insert(id, item);
        } else {
            stale.push(id);
        }
        if let Some(dep) = dep {
            dependencies.insert(id, dep);
        }
    }
    let reused = items.len() as u32;
    if !stale.is_empty() {
        let fresh = auto_approval::evaluate_simple_cash_dividend_prepared_scope_in_connection(
            &tx,
            folder,
            &Input {
                import_ids: stale,
                expected_database_path: input.expected_database_path.clone(),
            },
        )?;
        for item in fresh.dispositions {
            items.insert(item.import_id, item);
        }
    }
    // Recheck external bytes before publishing either fresh or reused results.
    // SQLite inputs remain under one IMMEDIATE transaction throughout.
    batch.verify_external()?;
    for &id in &input.import_ids {
        let item = &items[&id];
        if !matches!(item.disposition.as_str(), "ELIGIBLE" | "INELIGIBLE") {
            continue;
        }
        if let Some(dep) = dependencies.get(&id) {
            // No new checkpoint for an unchanged pointer; history is append-only.
            let current: Option<String> = tx.query_row("SELECT p.dependency_hash FROM corporate_action_dividend_validation_current i JOIN corporate_action_dividend_validation_checkpoints p ON p.id=i.checkpoint_id WHERE i.import_id=?",[id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
            let json = serde_json::to_string(item).map_err(|e| e.to_string())?;
            // Include the payload check too, so a damaged checkpoint can heal.
            let valid: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM corporate_action_dividend_validation_current i JOIN corporate_action_dividend_validation_checkpoints p ON p.id=i.checkpoint_id WHERE i.import_id=? AND p.result_json=? AND p.result_hash=?)",params![id,json,hash(json.as_bytes())],|r|r.get(0)).map_err(|e|e.to_string())?;
            if current.as_ref() == Some(dep) && valid {
                continue;
            }
            tx.execute("INSERT INTO corporate_action_dividend_validation_checkpoints(import_id,dependency_hash,result_json,result_hash) VALUES(?,?,?,?)",params![id,dep,json,hash(json.as_bytes())]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO corporate_action_dividend_validation_current(import_id,checkpoint_id) VALUES(?,?) ON CONFLICT(import_id) DO UPDATE SET checkpoint_id=excluded.checkpoint_id",params![id,tx.last_insert_rowid()]).map_err(|e|e.to_string())?;
        }
    }
    let mut ids = input.import_ids.clone();
    ids.sort_unstable();
    let dispositions: Vec<Item> = ids.iter().map(|id| items.remove(id).unwrap()).collect();
    let count = |code: &str| {
        dispositions
            .iter()
            .filter(|i| i.disposition == code)
            .count() as u32
    };
    let result = Result {
        requested: ids.len() as u32, reused_count: reused,
        eligible: count("ELIGIBLE"), ineligible: count("INELIGIBLE"), already_approved: count("ALREADY_APPROVED"),
        stale_scope: count("STALE_SCOPE"), missing: count("MISSING"), failed: count("FAILED"),
        policy_version: auto_approval::SIMPLE_CASH_DIVIDEND_POLICY_VERSION.into(),
        scope_fingerprint: auto_approval::simple_cash_dividend_prepared_scope_fingerprint(&input.expected_database_path,&ids),
        complete: count("FAILED")==0,
        message: format!("Dividend validation: {reused} compatible saved result(s) reused, {} policy evaluation(s). No financial writes.",ids.len() as u32-reused),
        dispositions,
    };
    tx.commit().map_err(|e| e.to_string())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dividend_incremental_overlapping_groups_read_each_dependency_row_once() {
        let c = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&c).unwrap();
        c.execute_batch("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,purpose_raw,ex_date,action_type) VALUES
          (1,'overlap1','NSE','NSE_API','A','Dividend Rs 1','2026-08-14','DIVIDEND'),
          (2,'overlap2','NSE','NSE_API','B','Dividend Rs 1','2026-08-14','DIVIDEND'),
          (3,'overlap3','NSE','NSE_API','A','Dividend Rs 1','2026-08-01','DIVIDEND'),
          (4,'overlap4','NSE','NSE_API','B','Dividend Rs 1','2026-08-02','DIVIDEND');
          INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference) SELECT id,'NSE_API','original' FROM corporate_action_imports;").unwrap();
        let a = BTreeSet::from(["A".to_string()]);
        let b = BTreeSet::from(["B".to_string()]);
        let mut batch = BatchInputs::load(&c).unwrap();
        let first = batch
            .group_hash(&c, "NSE", "2026-08-14", &a, &BTreeSet::new())
            .unwrap();
        assert_eq!(batch.dependency_rows_read, 6);
        let second = batch
            .group_hash(&c, "NSE", "2026-08-14", &b, &BTreeSet::new())
            .unwrap();
        assert_eq!(batch.dependency_rows_read, 8); // Only B's additional import and evidence.
        assert_ne!(first, second);
        c.execute(
            "UPDATE corporate_action_import_evidence SET raw_reference='revised' WHERE import_id=1",
            [],
        )
        .unwrap();
        let mut fresh = BatchInputs::load(&c).unwrap();
        assert_ne!(
            first,
            fresh
                .group_hash(&c, "NSE", "2026-08-14", &a, &BTreeSet::new())
                .unwrap()
        );
        assert_ne!(
            second,
            fresh
                .group_hash(&c, "NSE", "2026-08-14", &b, &BTreeSet::new())
                .unwrap()
        );
        // A newly arriving witness must invalidate a previously empty result too.
        c.execute(
            "DELETE FROM corporate_action_import_evidence WHERE import_id=4",
            [],
        )
        .unwrap();
        let mut absent = BatchInputs::load(&c).unwrap();
        let before = absent
            .group_hash(&c, "NSE", "2026-08-14", &b, &BTreeSet::new())
            .unwrap();
        c.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference) VALUES(4,'NSE_API','arrived')",[]).unwrap();
        let mut arrived = BatchInputs::load(&c).unwrap();
        assert_ne!(
            before,
            arrived
                .group_hash(&c, "NSE", "2026-08-14", &b, &BTreeSet::new())
                .unwrap()
        );
    }
    #[test]
    fn dividend_incremental_shared_identity_and_group_work_runs_once_per_batch() {
        let c = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&c).unwrap();
        c.execute_batch("INSERT INTO instruments(symbol,exchange,isin) VALUES('TEST','NSE','INEAUTO01001');
            INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,cash_amount,parse_status,review_status) VALUES
            (1,'group-1','NSE','NSE_API','TEST','INEAUTO01001','Dividend Rs 1 per share','2026-08-14','DIVIDEND',1,'PARSED','PENDING'),
            (2,'group-2','NSE','NSE_API','TEST','INEAUTO01001','Dividend Rs 1 per share','2026-08-15','DIVIDEND',1,'PARSED','PENDING');").unwrap();
        let mut batch = BatchInputs::load(&c).unwrap();
        for id in [1, 2, 1, 2] {
            let row = super::super::get_import_row(&c, id).unwrap();
            let (symbols, isins) = batch.identity_group(&c, &row).unwrap();
            batch
                .group_hash(
                    &c,
                    &row.exchange,
                    row.ex_date.as_deref().unwrap(),
                    &symbols,
                    &isins,
                )
                .unwrap();
        }
        assert_eq!(batch.identity_reads, 1);
        assert_eq!(batch.group_reads, 1);
    }
    #[test]
    fn dividend_incremental_group_index_matches_original_case_null_and_peer_predicate() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE groups(id INTEGER PRIMARY KEY,exchange TEXT,ex_date TEXT,symbol TEXT,isin TEXT);
            INSERT INTO groups VALUES(1,'nse','2026-01-01','old','OLDISIN'),(2,'NSE','2026-01-02','NEW','NEWISIN'),
                (3,'NSE','2026-01-01',NULL,NULL),(4,'BSE','2026-01-01','OLD','OLDISIN'),
                (5,'NSE',NULL,'',''),(6,'NSE','2026-03-01','ä','RAW');").unwrap();
        let index = GroupIndex::load(&c, "groups", "ex_date").unwrap();
        for (exchange, date, names, isins) in [
            ("NSE", "2026-01-01", vec!["new"], vec!["OLDISIN"]),
            ("nse", "none", vec![""], vec![""]),
            ("NSE", "none", vec!["Ä"], vec!["raw"]),
        ] {
            let names: BTreeSet<String> = names.into_iter().map(String::from).collect();
            let isins: BTreeSet<String> = isins.into_iter().map(String::from).collect();
            let names_json = serde_json::to_string(&names).unwrap();
            let isins_json = serde_json::to_string(&isins).unwrap();
            let expected:Vec<i64>=c.prepare("SELECT id FROM groups WHERE UPPER(exchange)=UPPER(?1) AND (ex_date=?2 OR UPPER(symbol) IN (SELECT UPPER(value) FROM json_each(?3)) OR UPPER(isin) IN (SELECT UPPER(value) FROM json_each(?4))) ORDER BY id").unwrap().query_map(params![exchange,date,names_json,isins_json],|r|r.get(0)).unwrap().map(|r|r.unwrap()).collect();
            assert_eq!(index.ids(exchange, date, &names, &isins), expected);
        }
    }

    #[test]
    fn dividend_incremental_shared_binary_reads_still_recheck_actual_external_contents() {
        let c = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&c).unwrap();
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("TEST.eod");
        let mut records = vec![EodRecord {
            date: 20260813,
            flags: 0,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            prev_close: 100,
            volume: 100,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", 1, &mut records).unwrap();
        let mut batch = BatchInputs::load(&c).unwrap();
        let date = NaiveDate::from_ymd_opt(2026, 8, 14).unwrap();
        for offset in 0..3 {
            batch
                .price_hash(path.clone(), date + Duration::days(offset))
                .unwrap();
        }
        assert_eq!(batch.file_reads, 1);
        batch.verify_external().unwrap();
        records[0].close = 110;
        BinaryEodFile::write_all(&path, "TEST", "NSE", 1, &mut records).unwrap();
        assert!(batch.verify_external().is_err());
        let missing = folder.path().join("NEW.eod");
        let mut batch = BatchInputs::load(&c).unwrap();
        batch.price_hash(missing.clone(), date).unwrap();
        BinaryEodFile::write_all(&missing, "NEW", "NSE", 1, &mut records).unwrap();
        assert!(batch.verify_external().is_err());
    }

    #[test]
    fn dividend_incremental_diagnostic_open_does_not_rerun_migrations() {
        let folder = tempfile::tempdir().unwrap();
        let c = crate::database::open_connection_for_folder(folder.path(), true).unwrap();
        c.execute(
            "DROP TABLE corporate_action_dividend_validation_checkpoints",
            [],
        )
        .unwrap();
        drop(c);
        let c = open_connection(folder.path()).unwrap();
        assert!(!exists(&c, "corporate_action_dividend_validation_checkpoints").unwrap());
    }

    #[test]
    fn dividend_incremental_due_date_bucket_wakes_scheduled_and_window_events() {
        let ex = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        assert_eq!(
            due_bucket(ex, ex - Duration::days(100)),
            ex - Duration::days(1)
        );
        assert_ne!(due_bucket(ex, ex - Duration::days(1)), due_bucket(ex, ex));
        assert_ne!(due_bucket(ex, ex), due_bucket(ex, ex + Duration::days(1)));
        assert_eq!(
            due_bucket(ex, ex + Duration::days(8)),
            due_bucket(ex, ex + Duration::days(100))
        );
    }
}
