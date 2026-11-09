//! Explicit offline acceptance against retained SQLite copies; never opens live SQLite.
use super::binary_eod::{u32_to_date, BinaryEodFile};
use super::eod_data::{load_unified_price_rows_with_mode, resolve_instrument_context};
use super::{PriceRow, PriceStorageMode};
use rusqlite::{Connection, OpenFlags};
use std::collections::BTreeMap;
use std::path::Path;

fn raw(c: &Connection, folder: &Path, symbol: &str, exchange: &str) -> Vec<PriceRow> {
    let context = resolve_instrument_context(c, symbol, exchange)
        .unwrap_or_else(|e| panic!("{exchange}:{symbol} resolution: {e}"))
        .unwrap();
    load_unified_price_rows_with_mode(
        folder,
        c,
        &context,
        "1900-01-01",
        "2100-12-31",
        PriceStorageMode::Binary,
    )
    .unwrap_or_else(|e| panic!("{exchange}:{symbol} raw reader: {e}"))
}

fn prices(rows: &[PriceRow]) -> BTreeMap<String, (f64, f64, f64, f64, i64, i64)> {
    rows.iter()
        .map(|r| {
            (
                r.date.clone(),
                (r.open, r.high, r.low, r.close, r.volume, r.open_interest),
            )
        })
        .collect()
}

#[test]
#[ignore = "Explicit read-only BSE repair acceptance; requires retained before/after database copies"]
fn bse_history_repair_native_reader_copy_acceptance() {
    let manifest = std::path::PathBuf::from(std::env::var("BSE_HISTORY_REPAIR_PROOF").unwrap());
    assert!(manifest.is_absolute());
    assert!(manifest
        .parent()
        .unwrap()
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("EOD_BSE_Repair_"));
    let input: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&manifest).unwrap()).unwrap();
    let folder = Path::new(input["data_folder"].as_str().unwrap());
    assert_eq!(
        folder,
        Path::new(r"E:\TA Projects\EOD Charting Platform\EOD DATABASE")
    );
    let before_path = Path::new(input["before"].as_str().unwrap());
    let after_path = Path::new(input["after"].as_str().unwrap());
    for p in [before_path, after_path] {
        assert_eq!(p.parent(), manifest.parent());
        assert_ne!(p.file_name().unwrap(), "market-data.sqlite3");
    }
    let before =
        Connection::open_with_flags(before_path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
    let after = Connection::open_with_flags(after_path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
    before.execute_batch("PRAGMA query_only=ON").unwrap();
    after.execute_batch("PRAGMA query_only=ON").unwrap();
    let cases = input["cases"].as_array().unwrap();
    assert!(!cases.is_empty());
    for item in cases {
        let symbol = item["symbol"].as_str().unwrap();
        let code = item["code"].as_str().unwrap();
        let pre_context = resolve_instrument_context(&before, symbol, "BSE")
            .unwrap()
            .unwrap();
        let post_context = resolve_instrument_context(&after, symbol, "BSE")
            .unwrap()
            .unwrap();
        assert!(
            !pre_context.related_symbols.iter().any(|s| s == code),
            "{symbol}: already joined before"
        );
        assert!(
            post_context.related_symbols.iter().any(|s| s == code),
            "{symbol}: missing code join"
        );
        let pre_rows = raw(&before, folder, symbol, "BSE");
        let post_rows = raw(&after, folder, symbol, "BSE");
        let pre = prices(&pre_rows);
        let post = prices(&post_rows);
        for (d, values) in &pre {
            assert_eq!(
                post.get(d),
                Some(values),
                "{symbol}: existing raw price changed at {d}"
            );
        }
        let binary = BinaryEodFile::open(folder.join(format!("eod_data/BSE/{code}.eod"))).unwrap();
        let scale = binary.header.price_scale as f64;
        for r in binary.read_all().unwrap() {
            assert_eq!(
                post.get(&u32_to_date(r.date)),
                Some(&(
                    r.open as f64 / scale,
                    r.high as f64 / scale,
                    r.low as f64 / scale,
                    r.close as f64 / scale,
                    r.volume as i64,
                    r.oi as i64,
                )),
                "{symbol}: numeric history differs at {}",
                r.date
            );
        }
        assert!(post.len() >= item["expected_pair_bars"].as_u64().unwrap() as usize);
        let old = post_rows
            .iter()
            .filter(|r| r.date.as_str() < "2024-01-01")
            .count();
        assert!(
            old >= item["expected_pair_pre2024"].as_u64().unwrap() as usize,
            "{symbol}: available pre-2024 raw history missing"
        );
        println!(
            "PASS {symbol} code={code} before={} after={} pre2024={old} first={} last={}",
            pre_rows.len(),
            post_rows.len(),
            post_rows.first().unwrap().date,
            post_rows.last().unwrap().date
        );
    }
    for (symbol, exchange) in [("TCS", "BSE"), ("TCS#", "BSE"), ("SENSEX", "BSE_INDEX")] {
        let pre = raw(&before, folder, symbol, exchange);
        let post = raw(&after, folder, symbol, exchange);
        assert!(!pre.is_empty(), "{exchange}:{symbol} baseline is empty");
        assert_eq!(prices(&pre), prices(&post), "{exchange}:{symbol} changed");
        if symbol.ends_with('#') {
            let context = resolve_instrument_context(&after, symbol, exchange)
                .unwrap()
                .unwrap();
            assert!(!context
                .related_symbols
                .iter()
                .any(|s| s.len() == 6 && s.bytes().all(|b| b.is_ascii_digit())));
        }
        println!("PASS PRESERVED {exchange}:{symbol} bars={}", post.len());
    }
    println!(
        "PASS actual Rust raw reader: {} newly mapped stocks; TCS, TCS# and SENSEX preserved",
        cases.len()
    );
}
