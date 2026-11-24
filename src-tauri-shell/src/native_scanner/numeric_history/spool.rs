use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_PAGES: usize = 16_384;
const MAX_PAGE_ROWS: usize = 1000;
const MAX_RESPONSE_BYTES: usize = 256 * 1024;
const RESPONSE_HEADER_BYTES: usize = 4 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PageKind {
    Matches,
    Coverage,
}

impl PageKind {
    fn key(self) -> i64 {
        match self {
            Self::Matches => 0,
            Self::Coverage => 1,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Position {
    day: i64,
    exchange: String,
    symbol: String,
    rule: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResultPage {
    pub(super) schema_version: u32,
    run_id: String,
    kind: PageKind,
    pub(super) items: Vec<Value>,
    pub(super) next_page_token: Option<String>,
}

pub(super) struct Spool(Connection);

impl Spool {
    pub(super) fn open() -> Result<Self, String> {
        Self::open_with_page_limit(MAX_PAGES)
    }

    pub(super) fn open_with_page_limit(max_pages: usize) -> Result<Self, String> {
        // An empty SQLite filename makes a private temporary database. SQLite
        // owns its filename and lifetime. A failed run never exposes this handle.
        let connection = Connection::open("").map_err(sql_error)?;
        connection
            .execute_batch(&format!(
                "PRAGMA temp_store=FILE;
             PRAGMA page_size=4096;
             PRAGMA max_page_count={max_pages};
             PRAGMA cache_size=-2048;
             PRAGMA journal_mode=OFF;
             CREATE TABLE result (
                kind INTEGER, day INTEGER, exchange TEXT, symbol TEXT, rule TEXT, payload TEXT,
                PRIMARY KEY(kind, day, exchange, symbol, rule)
             ) WITHOUT ROWID;
             BEGIN;"
            ))
            .map_err(sql_error)?;
        Ok(Self(connection))
    }

    pub(super) fn push(
        &self,
        kind: PageKind,
        date: u32,
        identity: (&str, &str, &str),
        payload: &Value,
    ) -> Result<(), String> {
        let (exchange, symbol, rule) = identity;
        self.0
            .prepare_cached("INSERT INTO result VALUES (?1,?2,?3,?4,?5,?6)")
            .and_then(|mut statement| {
                statement.execute(params![
                    kind.key(),
                    -i64::from(date),
                    exchange,
                    symbol,
                    rule,
                    payload.to_string()
                ])
            })
            .map_err(sql_error)?;
        Ok(())
    }

    pub(super) fn finish(&self) -> Result<(), String> {
        self.0
            .execute_batch("COMMIT; PRAGMA query_only=ON;")
            .map_err(sql_error)
    }

    pub(super) fn page(
        &self,
        run_id: &str,
        run_key: &str,
        kind: PageKind,
        token: Option<&str>,
    ) -> Result<ResultPage, String> {
        let invalid = || "Invalid numeric history page token.".to_string();
        let after = match token {
            Some(value) => {
                if value.len() > RESPONSE_HEADER_BYTES {
                    return Err(invalid());
                }
                let (key, token_kind, position): (String, PageKind, Position) =
                    serde_json::from_str(value).map_err(|_| invalid())?;
                if key != run_key || token_kind != kind {
                    return Err(invalid());
                }
                let exists: bool = self.0.query_row(
                    "SELECT EXISTS(SELECT 1 FROM result WHERE kind=?1 AND day=?2 AND exchange=?3 AND symbol=?4 AND rule=?5)",
                    params![kind.key(), position.day, position.exchange, position.symbol, position.rule],
                    |row| row.get(0),
                ).map_err(sql_error)?;
                if !exists {
                    return Err(invalid());
                }
                position
            }
            None => Position {
                day: i64::MIN,
                exchange: String::new(),
                symbol: String::new(),
                rule: String::new(),
            },
        };
        let mut statement = self
            .0
            .prepare_cached(
                "SELECT day,exchange,symbol,rule,payload FROM result WHERE kind=?1
             AND (day,exchange,symbol,rule) > (?2,?3,?4,?5)
             ORDER BY day,exchange,symbol,rule LIMIT ?6",
            )
            .map_err(sql_error)?;
        let mut rows = statement
            .query(params![
                kind.key(),
                after.day,
                after.exchange,
                after.symbol,
                after.rule,
                MAX_PAGE_ROWS + 1
            ])
            .map_err(sql_error)?;
        let mut page = ResultPage {
            schema_version: super::VERSION,
            run_id: run_id.to_owned(),
            kind,
            items: Vec::new(),
            next_page_token: None,
        };
        let mut bytes = RESPONSE_HEADER_BYTES;
        let mut last = None;
        while let Some(row) = rows.next().map_err(sql_error)? {
            let payload: String = row.get(4).map_err(sql_error)?;
            if page.items.len() == MAX_PAGE_ROWS || bytes + payload.len() + 1 > MAX_RESPONSE_BYTES {
                let position =
                    last.ok_or("A numeric history result exceeds its response byte limit.")?;
                page.next_page_token = Some(
                    serde_json::to_string(&(run_key, kind, position))
                        .map_err(|error| error.to_string())?,
                );
                break;
            }
            bytes += payload.len() + 1;
            page.items
                .push(serde_json::from_str(&payload).map_err(|error| error.to_string())?);
            last = Some(Position {
                day: row.get(0).map_err(sql_error)?,
                exchange: row.get(1).map_err(sql_error)?,
                symbol: row.get(2).map_err(sql_error)?,
                rule: row.get(3).map_err(sql_error)?,
            });
        }
        if serde_json::to_vec(&page)
            .map_err(|error| error.to_string())?
            .len()
            > MAX_RESPONSE_BYTES
        {
            return Err("Numeric history response byte limit exceeded.".into());
        }
        Ok(page)
    }
}

fn sql_error(error: rusqlite::Error) -> String {
    if error.sqlite_error_code() == Some(rusqlite::ErrorCode::DiskFull) {
        return "Numeric history private result storage limit exceeded.".into();
    }
    format!("Numeric history private result store failed: {error}")
}
