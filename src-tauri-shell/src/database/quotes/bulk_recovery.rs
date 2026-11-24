//! Recovery evidence for existing range and date-wide quote delete owners.

use sha2::{Digest, Sha256};

use super::{
    binary_range_deletion_state, delete_quote_date_scope_internal, delete_quote_range_internal,
    eod_directory, eod_file, normalize_exchange, normalize_symbol, normalize_trade_date,
    quote_editor_exchange_targets, AppResult, BinaryAfterDelete, CanonicalAccess, Connection,
    DeleteQuoteDateInput, DeleteQuoteDateScopeResult, DeleteQuoteRangeInput, DeleteQuoteResult,
    Path, QuoteDeleteProgressCallback,
};
use crate::database::binary_eod::date_to_u32;
use crate::database::database_use::BulkQuoteDeletion;

struct Scope {
    exchanges: Vec<String>,
    symbols: Option<Vec<String>>,
    start: String,
    end: String,
}

impl Scope {
    fn new(exchanges: Vec<String>, symbols: Option<Vec<String>>, from: String, to: String) -> Self {
        let (start, end) = if from <= to { (from, to) } else { (to, from) };
        let symbols = symbols.map(|mut symbols| {
            symbols.sort();
            symbols.dedup();
            symbols
        });
        Self {
            exchanges,
            symbols,
            start,
            end,
        }
    }

    fn includes(&self, symbol: &str) -> bool {
        self.symbols.as_ref().is_none_or(|symbols| {
            symbols
                .binary_search_by(|value| value.as_str().cmp(symbol))
                .is_ok()
        })
    }

    fn intent(&self) -> AppResult<BulkQuoteDeletion> {
        let selection = serde_json::to_vec(&self.symbols).map_err(|error| error.to_string())?;
        Ok(BulkQuoteDeletion {
            exchanges: self.exchanges.clone(),
            start_date: self.start.clone(),
            end_date: self.end.clone(),
            selected_symbols: self.symbols.as_ref().map(Vec::len),
            selection_digest: format!("{:x}", Sha256::digest(selection)),
            expected_digest: None,
        })
    }

    fn expected_after(&self, connection: &Connection, folder: &Path) -> AppResult<(String, bool)> {
        let mut digest = Sha256::new();
        let mut binary_contains_target = false;
        let start = date_to_u32(&self.start);
        let end = date_to_u32(&self.end);
        for exchange in &self.exchanges {
            let mut instruments = connection
                .prepare("SELECT symbol FROM instruments WHERE exchange = ?1 ORDER BY symbol")
                .map_err(|error| error.to_string())?;
            let rows = instruments
                .query_map([exchange], |row| row.get::<_, String>(0))
                .map_err(|error| error.to_string())?;
            for symbol in rows {
                let symbol = symbol.map_err(|error| error.to_string())?;
                if self.includes(&symbol) {
                    hash_value(&mut digest, ("instrument", exchange, &symbol))?;
                }
            }

            let path = eod_directory(folder, exchange)?;
            if !path.try_exists().map_err(|error| error.to_string())? {
                continue;
            }
            let mut symbols = match &self.symbols {
                Some(symbols) => symbols.clone(),
                None => {
                    let mut symbols = Vec::new();
                    for entry in std::fs::read_dir(&path).map_err(|error| error.to_string())? {
                        let entry = entry.map_err(|error| error.to_string())?.path();
                        if entry.extension().is_some_and(|value| value == "eod") {
                            let symbol = entry
                                .file_stem()
                                .and_then(|value| value.to_str())
                                .ok_or("Binary quote path has no UTF-8 symbol.")?;
                            symbols.push(symbol.to_owned());
                        }
                    }
                    symbols
                }
            };
            symbols.sort();
            for symbol in symbols {
                let file = eod_file(&path, &symbol)?;
                let (after, contains_target) =
                    binary_range_deletion_state(&file, exchange, &symbol, start, end)?;
                binary_contains_target |= contains_target;
                if after != BinaryAfterDelete::Absent {
                    hash_value(&mut digest, ("binary", exchange, &symbol, after))?;
                }
            }
        }
        Ok((format!("{:x}", digest.finalize()), binary_contains_target))
    }

    fn sqlite_contains_target(&self, connection: &Connection) -> AppResult<bool> {
        let mut statement = connection.prepare(
            "SELECT DISTINCT symbol FROM eod_prices WHERE exchange = ?1 AND date BETWEEN ?2 AND ?3",
        ).map_err(|error| error.to_string())?;
        for exchange in &self.exchanges {
            let rows = statement
                .query_map([exchange, &self.start, &self.end], |row| {
                    row.get::<_, String>(0)
                })
                .map_err(|error| error.to_string())?;
            for symbol in rows {
                if self.includes(&symbol.map_err(|error| error.to_string())?) {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }
}

fn hash_value(digest: &mut Sha256, value: impl serde::Serialize) -> AppResult<()> {
    let bytes = serde_json::to_vec(&value).map_err(|error| error.to_string())?;
    digest.update((bytes.len() as u64).to_le_bytes());
    digest.update(bytes);
    Ok(())
}

fn run<T>(
    folder: &Path,
    access: &CanonicalAccess,
    scope: Scope,
    connect: impl FnOnce() -> AppResult<Connection>,
    delete: impl FnOnce(&Connection) -> AppResult<T>,
) -> AppResult<T> {
    let mut lease = access.begin_bulk_quote_deletion(scope.intent()?)?;
    let connection = connect()?;
    match scope.expected_after(&connection, folder) {
        Ok((digest, _)) => lease.prepare(digest)?,
        Err(error) => {
            eprintln!("Bulk quote deletion could not prepare canonical recovery proof: {error}")
        }
    }
    let result = delete(&connection)?;
    match lease.verify(|intent| {
        let Some(expected) = &intent.expected_digest else {
            return Ok(false);
        };
        if scope.sqlite_contains_target(&connection)? {
            return Ok(false);
        }
        let (digest, binary_contains_target) = scope.expected_after(&connection, folder)?;
        Ok(!binary_contains_target && digest == *expected)
    }) {
        Ok(true) => {}
        Ok(false) => eprintln!("Bulk quote deletion awaits canonical recovery verification."),
        Err(error) => {
            eprintln!("Canonical price store remains blocked after bulk quote deletion: {error}")
        }
    }
    Ok(result)
}

pub(in crate::database) fn delete_quote_range_coordinated(
    folder: &Path,
    input: &DeleteQuoteRangeInput,
    access: &CanonicalAccess,
    connect: impl FnOnce() -> AppResult<Connection>,
) -> AppResult<DeleteQuoteResult> {
    let scope = Scope::new(
        vec![normalize_exchange(&input.exchange)?],
        Some(vec![normalize_symbol(&input.symbol)?]),
        normalize_trade_date(&input.from_date)?,
        normalize_trade_date(&input.to_date)?,
    );
    run(folder, access, scope, connect, |connection| {
        delete_quote_range_internal(connection, input, Some(folder))
    })
}

pub(in crate::database) fn delete_quote_date_scope_coordinated(
    folder: &Path,
    input: &DeleteQuoteDateInput,
    access: &CanonicalAccess,
    connect: impl FnOnce() -> AppResult<Connection>,
    progress: Option<QuoteDeleteProgressCallback<'_>>,
) -> AppResult<DeleteQuoteDateScopeResult> {
    let start = normalize_trade_date(&input.date)?;
    let end = input
        .to_date
        .as_deref()
        .map(normalize_trade_date)
        .transpose()?
        .unwrap_or_else(|| start.clone());
    let symbols = input
        .symbols
        .as_ref()
        .filter(|symbols| !symbols.is_empty())
        .map(|symbols| {
            symbols
                .iter()
                .map(|symbol| normalize_symbol(symbol))
                .collect::<AppResult<Vec<_>>>()
        })
        .transpose()?;
    let scope = Scope::new(
        quote_editor_exchange_targets(&input.exchange)?,
        symbols,
        start,
        end,
    );
    run(folder, access, scope, connect, |connection| {
        delete_quote_date_scope_internal(connection, input, Some(folder), progress)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::quotes::upsert_quote_internal;
    use crate::database::quotes::v16_localized_state_invalidation_tests::{
        coordinated_quote, setup_test_db_on,
    };

    #[test]
    fn range_retry_clears_only_the_matching_completed_intent() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path();
        let sqlite = folder.join("ranges.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        let connect = || Connection::open(&sqlite).map_err(|error| error.to_string());
        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        for date in ["2024-05-15", "2024-05-16", "2024-05-17", "2024-05-18"] {
            upsert_quote_internal(folder, &coordinated_quote(date), &access, connect).unwrap();
        }
        let range = DeleteQuoteRangeInput {
            symbol: "TEST".into(),
            exchange: "NSE".into(),
            from_date: "2024-05-17".into(),
            to_date: "2024-05-16".into(),
        };
        let scope = Scope::new(
            vec![range.exchange.clone()],
            Some(vec![range.symbol.clone()]),
            range.from_date.clone(),
            range.to_date.clone(),
        );
        let interrupted = run::<()>(folder, &access, scope, connect, |connection| {
            connection
                .execute(
                    "DELETE FROM eod_prices WHERE date BETWEEN '2024-05-16' AND '2024-05-17'",
                    [],
                )
                .map_err(|error| error.to_string())?;
            Err("interrupted before binary writes".into())
        });
        assert_eq!(interrupted.unwrap_err(), "interrupted before binary writes");
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );

        let result = delete_quote_range_coordinated(folder, &range, &access, connect).unwrap();
        assert_eq!(result.deleted, 2);
        assert!(access.begin_read().is_ok());
        let keep: i64 = connect()
            .unwrap()
            .query_row(
                "SELECT count(*) FROM eod_prices WHERE date IN ('2024-05-15', '2024-05-18')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(keep, 2);
    }

    #[test]
    fn date_scope_verifies_only_selected_symbols_across_exchanges() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path();
        let sqlite = folder.join("scope.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        let connect = || Connection::open(&sqlite).map_err(|error| error.to_string());
        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        for exchange in ["NSE", "BSE"] {
            for symbol in ["TEST", "OTHER"] {
                let mut quote = coordinated_quote("2024-05-16");
                quote.exchange = exchange.into();
                quote.symbol = symbol.into();
                upsert_quote_internal(folder, &quote, &access, connect).unwrap();
            }
        }
        let input = DeleteQuoteDateInput {
            exchange: "ALL".into(),
            date: "2024-05-16".into(),
            to_date: None,
            symbols: Some(vec!["TEST".into()]),
        };
        let result =
            delete_quote_date_scope_coordinated(folder, &input, &access, connect, None).unwrap();
        assert_eq!(result.result.deleted, 2);
        assert!(access.begin_read().is_ok());
        let remaining: i64 = connect()
            .unwrap()
            .query_row(
                "SELECT count(*) FROM eod_prices WHERE symbol = 'OTHER'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 2);
        let instruments: i64 = connect()
            .unwrap()
            .query_row(
                "SELECT count(*) FROM instruments WHERE symbol = 'TEST'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(instruments, 2);
        for exchange in ["NSE", "BSE"] {
            let path = eod_directory(folder, exchange).unwrap();
            assert!(!eod_file(&path, "TEST").unwrap().exists());
            assert!(eod_file(&path, "OTHER").unwrap().exists());
        }
    }
}
