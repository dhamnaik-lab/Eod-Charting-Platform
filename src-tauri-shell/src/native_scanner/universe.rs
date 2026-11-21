//! NS-01: canonical, source-backed target enumeration.
//!
//! Targets come from the active database's `instruments` table, never from raw `.eod`
//! filenames, and the projection is deliberately minimal and read-only.
//!
//! Universe semantics are exact:
//! - `activeNseEq` selects NSE instruments whose stored series is exactly `EQ`. It is
//!   *not* the existing UI `nseEquity` universe (EQ/BE/BZ/SM/ST/SZ) and never replaces
//!   it; the narrower universe exists only because it is a distinct, explicit choice.
//! - `activeBse` selects active BSE instruments; BSE security-code identity is preserved
//!   by keeping the stored symbol untouched.
//! - `explicitTargets` preserves caller order and removes case-insensitive duplicates.

use super::ast::{UniverseSourceV1, UniverseV1};
use rusqlite::Connection;

/// One resolved scan target.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReservedTarget {
    pub exchange: String,
    pub symbol: String,
}

impl ReservedTarget {
    pub fn key(&self) -> String {
        format!("{}:{}", self.exchange, self.symbol)
    }
}

/// Enumerates the canonical active targets for a validated universe.
pub fn enumerate_targets(
    connection: &Connection,
    universe: &UniverseV1,
) -> Result<Vec<ReservedTarget>, String> {
    match universe.source {
        UniverseSourceV1::ExplicitTargets => Ok(universe
            .targets
            .iter()
            .map(|(exchange, symbol)| ReservedTarget {
                exchange: exchange.clone(),
                symbol: symbol.clone(),
            })
            .collect()),
        UniverseSourceV1::ActiveNseEq => enumerate_active(connection, "NSE", Some("EQ")),
        UniverseSourceV1::ActiveBse => enumerate_active(connection, "BSE", None),
    }
}

fn enumerate_active(
    connection: &Connection,
    exchange: &str,
    exact_series: Option<&str>,
) -> Result<Vec<ReservedTarget>, String> {
    let mut statement = if exact_series.is_some() {
        connection
            .prepare(
                "SELECT symbol FROM instruments
                 WHERE exchange = ?
                   AND COALESCE(is_active, 1) = 1
                   AND UPPER(COALESCE(series, '')) = ?
                 ORDER BY symbol ASC",
            )
            .map_err(|error| format!("Unable to enumerate {exchange} instruments: {error}"))?
    } else {
        connection
            .prepare(
                "SELECT symbol FROM instruments
                 WHERE exchange = ?
                   AND COALESCE(is_active, 1) = 1
                 ORDER BY symbol ASC",
            )
            .map_err(|error| format!("Unable to enumerate {exchange} instruments: {error}"))?
    };

    let mut seen = std::collections::BTreeSet::new();
    let mut targets = Vec::new();
    // Two `query_map` closures are distinct types, so each branch is fully collected
    // before the shared handling below instead of trying to unify the iterators.
    let rows: Vec<Result<String, rusqlite::Error>> = if let Some(series) = exact_series {
        statement
            .query_map(rusqlite::params![exchange, series], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|error| format!("Unable to enumerate {exchange} instruments: {error}"))?
            .collect()
    } else {
        statement
            .query_map(rusqlite::params![exchange], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Unable to enumerate {exchange} instruments: {error}"))?
            .collect()
    };
    for row in rows {
        let symbol = row.map_err(|error| format!("Unable to read instrument row: {error}"))?;
        let trimmed = symbol.trim();
        if trimmed.is_empty() || !seen.insert(trimmed.to_ascii_uppercase()) {
            continue;
        }
        targets.push(ReservedTarget {
            exchange: exchange.to_string(),
            symbol: trimmed.to_string(),
        });
    }
    Ok(targets)
}

/// Stable, deterministic ordering used for the final result set.
pub fn sort_targets(targets: &mut [ReservedTarget]) {
    targets.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn fixture_database() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(
                "CREATE TABLE instruments (
                   symbol TEXT NOT NULL,
                   exchange TEXT NOT NULL DEFAULT 'NSE',
                   series TEXT,
                   is_active INTEGER NOT NULL DEFAULT 1,
                   PRIMARY KEY (symbol, exchange)
                 );",
            )
            .expect("create fixtures table");
        connection
            .execute_batch(
                "INSERT INTO instruments (symbol, exchange, series, is_active) VALUES
                   ('INFY','NSE','EQ',1),
                   ('TCS','NSE','EQ',1),
                   ('SMALLCAP','NSE','SM',1),
                   ('TRADEFORTRADE','NSE','BE',1),
                   ('DELISTED','NSE','EQ',0),
                   ('500180','BSE','B',1),
                   ('BSEONLY','BSE',NULL,1),
                   ('BSEDELISTED','BSE','B',0);",
            )
            .expect("insert fixtures");
        connection
    }

    fn universe(source: UniverseSourceV1) -> UniverseV1 {
        UniverseV1 {
            source,
            targets: Vec::new(),
        }
    }

    #[test]
    fn ns01_active_nse_eq_universe_is_series_eq_only() {
        let connection = fixture_database();
        let targets = enumerate_targets(&connection, &universe(UniverseSourceV1::ActiveNseEq))
            .expect("enumerate");
        let symbols: Vec<&str> = targets
            .iter()
            .map(|target| target.symbol.as_str())
            .collect();
        assert_eq!(symbols, vec!["INFY", "TCS"]);
        assert!(targets.iter().all(|target| target.exchange == "NSE"));
    }

    #[test]
    fn ns01_narrow_nse_eq_universe_does_not_replace_the_broad_equity_universe() {
        let connection = fixture_database();
        let narrow = enumerate_targets(&connection, &universe(UniverseSourceV1::ActiveNseEq))
            .expect("narrow");
        // The broad UI universe would also include SM/BE; the narrow one must not.
        assert!(!narrow.iter().any(|target| target.symbol == "SMALLCAP"));
        assert!(!narrow.iter().any(|target| target.symbol == "TRADEFORTRADE"));
        // ...and the broad row set still exists untouched in the database.
        let broad: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM instruments
                 WHERE exchange = 'NSE' AND COALESCE(is_active, 1) = 1
                   AND UPPER(COALESCE(series, '')) IN ('EQ','BE','BZ','SM','ST','SZ')",
                [],
                |row| row.get(0),
            )
            .expect("broad count");
        assert_eq!(broad, 4);
    }

    #[test]
    fn ns01_active_bse_universe_preserves_security_codes() {
        let connection = fixture_database();
        let targets =
            enumerate_targets(&connection, &universe(UniverseSourceV1::ActiveBse)).expect("bse");
        let symbols: Vec<&str> = targets
            .iter()
            .map(|target| target.symbol.as_str())
            .collect();
        assert_eq!(symbols, vec!["500180", "BSEONLY"]);
    }

    #[test]
    fn ns01_explicit_targets_preserve_order_and_are_deduplicated_upstream() {
        let connection = fixture_database();
        let explicit = UniverseV1 {
            source: UniverseSourceV1::ExplicitTargets,
            targets: vec![
                ("NSE".to_string(), "TCS".to_string()),
                ("NSE".to_string(), "INFY".to_string()),
            ],
        };
        let targets = enumerate_targets(&connection, &explicit).expect("explicit");
        assert_eq!(targets[0].symbol, "TCS");
        assert_eq!(targets[1].symbol, "INFY");
        assert_eq!(targets[0].key(), "NSE:TCS");
    }

    #[test]
    fn ns01_target_sorting_is_deterministic() {
        let mut targets = vec![
            ReservedTarget {
                exchange: "NSE".to_string(),
                symbol: "TCS".to_string(),
            },
            ReservedTarget {
                exchange: "BSE".to_string(),
                symbol: "500180".to_string(),
            },
            ReservedTarget {
                exchange: "NSE".to_string(),
                symbol: "INFY".to_string(),
            },
        ];
        sort_targets(&mut targets);
        let keys: Vec<String> = targets.iter().map(ReservedTarget::key).collect();
        assert_eq!(keys, vec!["BSE:500180", "NSE:INFY", "NSE:TCS"]);
    }
}
