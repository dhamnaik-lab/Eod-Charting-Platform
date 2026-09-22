use super::settings::{read_setting_value, write_setting_value};
use super::AppResult;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PriceStorageMode {
    Hybrid,
    Binary,
}

impl Default for PriceStorageMode {
    fn default() -> Self {
        Self::Hybrid
    }
}

impl From<&str> for PriceStorageMode {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "binary" => Self::Binary,
            "hybrid" => Self::Hybrid,
            _ => Self::Hybrid,
        }
    }
}

impl PriceStorageMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Hybrid => "hybrid",
            Self::Binary => "binary",
        }
    }
}

pub const PRICE_STORAGE_MODE_KEY: &str = "price_storage_mode";

pub fn get_price_storage_mode(connection: &Connection) -> PriceStorageMode {
    read_setting_value(connection, PRICE_STORAGE_MODE_KEY)
        .ok()
        .flatten()
        .map(|s| PriceStorageMode::from(s.as_str()))
        .unwrap_or_default()
}

pub fn set_price_storage_mode(connection: &Connection, mode: PriceStorageMode) -> AppResult<()> {
    write_setting_value(connection, PRICE_STORAGE_MODE_KEY, mode.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn test_default_mode() {
        let conn = setup_test_db();
        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Hybrid);
    }

    #[test]
    fn test_invalid_mode_returns_hybrid() {
        let conn = setup_test_db();
        write_setting_value(&conn, PRICE_STORAGE_MODE_KEY, "invalid").unwrap();
        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Hybrid);
    }

    #[test]
    fn test_hybrid_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();
        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Hybrid);
        assert_eq!(
            read_setting_value(&conn, PRICE_STORAGE_MODE_KEY)
                .unwrap()
                .unwrap(),
            "hybrid"
        );
    }

    #[test]
    fn test_binary_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Binary);
        assert_eq!(
            read_setting_value(&conn, PRICE_STORAGE_MODE_KEY)
                .unwrap()
                .unwrap(),
            "binary"
        );
    }
}
