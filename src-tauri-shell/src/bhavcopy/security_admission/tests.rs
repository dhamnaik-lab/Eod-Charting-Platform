use super::*;
use crate::bhavcopy::ingestion::{
    insert_parsed_bhavcopy_files, open_prepared_fixture_connection, parse_and_insert,
};
use crate::bhavcopy::parsers::parse_bhavcopy_csv;
use crate::database::binary_eod::{BinaryEodFile, DEFAULT_SCALE};
use crate::database::{set_price_storage_mode, PriceStorageMode};
use std::path::PathBuf;

fn db() -> PathBuf {
    // Retained regression evidence, never tempdir or a nested Cargo target.
    let folder = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tmp/fixtures/ca-series-admission-tests")
        .join(format!(
            "{}-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap(),
            AUDIT_ID.fetch_add(1, Ordering::Relaxed)
        ));
    fs::create_dir_all(&folder).unwrap();
    let path = folder.join("market-data.sqlite3");
    drop(open_prepared_fixture_connection(&path).unwrap());
    path
}
fn csv(rows: &str) -> String {
    format!("SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,PREVCLOSE,TOTTRDQTY,TIMESTAMP,ISIN\n{rows}")
}
fn parse(rows: &str) -> ParsedBhavcopyFile {
    parse_bhavcopy_csv(&csv(rows), "NSE", "2014-11-20", &[]).unwrap()
}
fn count(path: &Path) -> i64 {
    open_prepared_fixture_connection(path)
        .unwrap()
        .query_row("SELECT count(*) FROM instruments", [], |r| r.get(0))
        .unwrap()
}
#[test]
fn security_admission_official_sbin_samples_are_order_independent_in_both_stores() {
    let samples = [
        ("2010-11-12", include_str!("fixtures/20101112.csv")),
        ("2014-11-19", include_str!("fixtures/20141119.csv")),
        ("2014-11-20", include_str!("fixtures/20141120.csv")),
        ("2017-09-20", include_str!("fixtures/20170920.csv")),
    ];
    for (date, csv) in samples {
        for binary in [false, true] {
            for reverse in [false, true] {
                let path = db();
                let connection = open_prepared_fixture_connection(&path).unwrap();
                if binary {
                    set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
                }
                let mut file = parse_bhavcopy_csv(csv, "NSE", date, &[]).unwrap();
                let eq = file.rows.iter().find(|r| r.series == "EQ").unwrap().clone();
                let separated = file.rows.len() - 1;
                if reverse {
                    file.rows.reverse();
                }
                let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
                assert_eq!(results[0].rows_inserted, 1);
                assert_eq!(results[0].admission.separated, separated);
                assert_eq!(results[0].admission.conflicted, 0);
                let metadata:(String,Option<String>)=connection.query_row("SELECT series,isin FROM instruments WHERE symbol='SBIN' AND exchange='NSE'",[],|r|Ok((r.get(0)?,r.get(1)?))).unwrap();
                assert_eq!(metadata.0, "EQ");
                assert_eq!(
                    metadata.1.as_deref(),
                    if eq.isin.is_empty() {
                        None
                    } else {
                        Some(eq.isin.as_str())
                    }
                );
                let stored =
                    BinaryEodFile::open(path.parent().unwrap().join("eod_data/NSE/SBIN.eod"))
                        .unwrap();
                assert_eq!(stored.read_all().unwrap(), vec![eq.binary_record]);
                if !binary {
                    let row: (f64, f64, f64, f64, i64) = connection
                        .query_row(
                            "SELECT open,high,low,close,volume FROM eod_prices WHERE symbol='SBIN'",
                            [],
                            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
                        )
                        .unwrap();
                    assert_eq!(row, (eq.open, eq.high, eq.low, eq.close, eq.volume));
                }
            }
        }
    }
}
#[test]
fn security_admission_preserves_broad_equity_without_isin() {
    let path = db();
    let mut rows = String::new();
    for (i, series) in [
        "EQ", "BE", "BZ", "SM", "ST", "SZ", "SP", "SO", "BT", "IT", "E1", "X1",
    ]
    .iter()
    .enumerate()
    {
        rows.push_str(&format!(
            "E{i},{series},100,110,90,105,99,200,20-NOV-2014,\n"
        ));
    }
    let result = parse_and_insert(
        &path,
        &csv(&rows),
        "NSE",
        "2014-11-20",
        &["BE".into(), "SM".into()],
    )
    .unwrap();
    assert_eq!(result.rows_inserted, 12);
    assert_eq!(result.admission.conflicted, 0);
    assert_eq!(count(&path), 12);
}
#[test]
fn security_admission_pre_isin_eq_plus_auxiliary_keeps_the_equity_bar() {
    // 2005-2009 NSE archives have no ISIN column: EQ and the block-deal bucket
    // (IL/BL) both carry an empty ISIN. The equity row must win, not conflict.
    for series in ["IL", "BL", "IQ"] {
        let path = db();
        let file = parse(&format!(
            "SBIN,EQ,642.85,650.00,640.00,642.85,640.00,2493564,20-NOV-2014,
             SBIN,{series},670.00,670.00,670.00,670.00,642.85,1,20-NOV-2014,
"
        ));
        let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
        assert_eq!(results[0].admission.conflicted, 0, "{series}");
        assert_eq!(results[0].admission.market_rows, 1, "{series}");
        assert_eq!(results[0].rows_inserted, 1, "{series}");
        let stored = BinaryEodFile::open(path.parent().unwrap().join("eod_data/NSE/SBIN.eod"))
            .unwrap()
            .read_all()
            .unwrap();
        assert_eq!(stored.len(), 1, "{series}");
        assert_eq!(stored[0].close, 6_428_500, "{series}");
    }
}

#[test]
fn security_admission_pre_isin_eq_plus_legacy_bucket_keeps_the_equity_bar() {
    // `E1`/`E2` are the pre-2009 second equity bucket; paired with EQ they are a
    // market-segment quote, standalone they remain ordinary equity rows.
    let path = db();
    let file = parse(
        "SBIN,EQ,642.85,650.00,640.00,642.85,640.00,2493564,20-NOV-2014,
         SBIN,E1,650.00,650.00,650.00,650.00,642.85,4000,20-NOV-2014,
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(results[0].admission.conflicted, 0);
    assert_eq!(results[0].admission.market_rows, 1);
    assert_eq!(results[0].rows_inserted, 1);

    // A standalone E1 row is still written as equity (no regression).
    let solo = db();
    let file = parse(
        "ONLY,E1,100,105,95,102,99,5000,20-NOV-2014,
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&solo, &[file]).unwrap();
    assert_eq!(results[0].rows_inserted, 1);
    assert_eq!(results[0].admission.market_rows, 0);
}

#[test]
fn security_admission_buyback_bo_never_replaces_equity_ohlcv() {
    // EQ + BO (buyback window) for the same symbol/date: the equity bar wins and
    // the buyback print is retained as evidence only.
    let path = db();
    let file = parse(
        "SBIN,EQ,294.75,298.75,291.25,297.10,2910.5,18099509,20-NOV-2014,INE062A01012
         SBIN,BO,299.00,299.00,299.00,299.00,297.10,5000,20-NOV-2014,INE062A01012
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(results[0].admission.conflicted, 0);
    assert_eq!(results[0].admission.market_rows, 1);
    assert_eq!(results[0].rows_inserted, 1);
    let stored = BinaryEodFile::open(path.parent().unwrap().join("eod_data/NSE/SBIN.eod"))
        .unwrap()
        .read_all()
        .unwrap();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].close, 2_971_000);

    // BO only: no canonical daily price is fabricated.
    let solo = db();
    let file = parse(
        "ONLY,BO,299.00,299.00,299.00,299.00,297.10,5000,20-NOV-2014,INE062A01012
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&solo, &[file]).unwrap();
    assert_eq!(results[0].rows_inserted, 0);
    assert_eq!(results[0].admission.market_rows, 1);
    assert_eq!(results[0].admission.conflicted, 0);

    // BO with a different ISIN cannot be treated as the same instrument.
    let mismatch = db();
    let file = parse(
        "SBIN,EQ,294.75,298.75,291.25,297.10,2910.5,18099509,20-NOV-2014,INE062A01012
         SBIN,BO,299.00,299.00,299.00,299.00,297.10,5000,20-NOV-2014,INE999Z01010
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&mismatch, &[file]).unwrap();
    assert_eq!(results[0].admission.conflicted, 2);
    assert_eq!(results[0].rows_inserted, 0);
}

#[test]
fn security_admission_legacy_e_family_bucket_keeps_the_equity_bar() {
    // KARURVYSYA-style: EQ paired with E4/E5 legacy buckets plus a block print.
    let path = db();
    let file = parse(
        "KARURVYSYA,EQ,120.00,124.00,118.00,121.50,120.00,64000,20-NOV-2014,
         KARURVYSYA,E4,60.00,60.00,60.00,60.00,60.00,36,20-NOV-2014,
         KARURVYSYA,E5,58.00,58.00,58.00,58.00,58.00,22,20-NOV-2014,
         KARURVYSYA,IL,121.00,121.00,121.00,121.00,120.00,6,20-NOV-2014,
",
    );
    let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(results[0].admission.conflicted, 0);
    assert_eq!(results[0].admission.market_rows, 3);
    assert_eq!(results[0].rows_inserted, 1);
}

#[test]
fn security_admission_conflict_blocks_whole_key_but_preserves_other_symbols() {
    for binary in [false, true] {
        let path = db();
        let connection = open_prepared_fixture_connection(&path).unwrap();
        if binary {
            set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
        }
        let good = "SBIN,EQ,294.75,298.75,291.25,297.1,2910.5,18099509,20-NOV-2014,INE062A01012\n";
        parse_and_insert(&path, &csv(good), "NSE", "2014-11-20", &[]).unwrap();
        let file = path.parent().unwrap().join("eod_data/NSE/SBIN.eod");
        let before = fs::read(&file).unwrap();
        let mut parsed=parse(&(good.to_owned()+"SBIN,BE,999,999,999,999,1,1,20-NOV-2014,INE062A01012\nSAFE,EQ,100,110,90,105,99,200,20-NOV-2014,\n"));
        parsed.rows.reverse();
        let (result, _) = insert_parsed_bhavcopy_files(&path, &[parsed]).unwrap();
        assert_eq!(result[0].admission.conflicted, 2);
        assert_eq!(result[0].rows_inserted, 1);
        assert_eq!(fs::read(file).unwrap(), before);
        let series: String = connection
            .query_row(
                "SELECT series FROM instruments WHERE symbol='SBIN'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(series, "EQ");
    }
}
#[test]
fn security_admission_identical_cross_file_duplicates_are_once_only() {
    let path = db();
    let a = parse("SBIN,EQ,100,110,90,105,99,200,20-NOV-2014,\n");
    let b = parse("SBIN,EQ,100,110,90,105,99,200,20-NOV-2014,\n");
    let (result, _) = insert_parsed_bhavcopy_files(&path, &[a, b]).unwrap();
    assert_eq!(result.iter().map(|r| r.rows_inserted).sum::<usize>(), 1);
    assert_eq!(result[1].admission.duplicates, 1);
}
#[test]
fn security_admission_unqualified_rows_are_held_not_guessed() {
    let path = db();
    let file=parse("UNKNOWN,ZZZ,100,110,90,105,99,200,20-NOV-2014,\nMISSING,,100,110,90,105,99,200,20-NOV-2014,\n");
    let (result, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(result[0].rows_inserted, 0);
    assert_eq!(result[0].admission.conflicted, 2);
    assert_eq!(count(&path), 0);
}
#[test]
fn security_admission_non_equity_only_never_creates_or_overwrites_identity() {
    let path = db();
    let result = parse_and_insert(
        &path,
        include_str!("fixtures/20141120.csv"),
        "NSE",
        "2014-11-20",
        &[],
    )
    .unwrap();
    assert_eq!(result.rows_inserted, 1);
    let connection = open_prepared_fixture_connection(&path).unwrap();
    let before: String = connection
        .query_row(
            "SELECT isin FROM instruments WHERE symbol='SBIN'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let result = parse_and_insert(
        &path,
        &csv("SBIN,N5,11300,11319.99,11295,11300.78,11300.65,239,20-NOV-2014,INE062A08058\n"),
        "NSE",
        "2014-11-20",
        &[],
    )
    .unwrap();
    assert_eq!(result.rows_inserted, 0);
    assert_eq!(result.admission.separated, 1);
    let after: String = connection
        .query_row(
            "SELECT isin FROM instruments WHERE symbol='SBIN'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(before, after);
    let empty = db();
    parse_and_insert(
        &empty,
        &csv("BOND,N1,100,110,90,105,99,200,20-NOV-2014,\n"),
        "NSE",
        "2014-11-20",
        &[],
    )
    .unwrap();
    assert_eq!(count(&empty), 0);
}
#[test]
fn security_admission_audit_failure_prevents_all_price_and_metadata_writes() {
    let path = db();
    fs::write(
        path.parent().unwrap().join("bhavcopy_admission"),
        b"not a directory",
    )
    .unwrap();
    assert!(parse_and_insert(
        &path,
        include_str!("fixtures/20141120.csv"),
        "NSE",
        "2014-11-20",
        &[]
    )
    .is_err());
    assert_eq!(count(&path), 0);
    assert!(!path
        .parent()
        .unwrap()
        .join("eod_data/NSE/SBIN.eod")
        .exists());
}
#[test]
fn security_admission_legacy_replay_requires_requalification_and_preserves_inputs() {
    let path = db();
    let file = parse("SBIN,N2,10400,10502,10380,10490.33,10000,37637,20-NOV-2014,\n");
    assert!(require_replay_safe(&path, &[file])
        .unwrap_err()
        .contains("requalification"));
    assert_eq!(count(&path), 0);
    let file = parse("SBIN,EQ,100,110,90,105,99,200,20-NOV-2014,\n");
    assert!(require_replay_safe(&path, &[file]).is_ok());
}
#[test]
fn security_admission_dated_isin_backfill_does_not_replace_current_metadata() {
    let path = db();
    let newer = csv("SBIN,EQ,100,110,90,105,99,200,21-NOV-2014,INE062A01020\n");
    parse_and_insert(&path, &newer, "NSE", "2014-11-21", &[]).unwrap();
    parse_and_insert(
        &path,
        &csv("SBIN,EQ,2900,3000,2800,2910.5,2900,200,19-NOV-2014,INE062A01012\n"),
        "NSE",
        "2014-11-19",
        &[],
    )
    .unwrap();
    let connection = open_prepared_fixture_connection(&path).unwrap();
    let isin: String = connection
        .query_row(
            "SELECT isin FROM instruments WHERE symbol='SBIN'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(isin, "INE062A01020");
    let file = BinaryEodFile::open(path.parent().unwrap().join("eod_data/NSE/SBIN.eod")).unwrap();
    assert_eq!(file.read_all().unwrap().len(), 2);
}
#[test]
fn security_admission_udiff_has_same_identity_gate() {
    let path = db();
    let csv="TradDt,TckrSymb,SctySrs,OpnPric,HghPric,LwPric,ClsPric,PrvsClsgPric,TtlTradgVol,ISIN\n2014-11-20,SBIN,N5,11300,11319.99,11295,11300.78,11300.65,239,INE062A08058\n2014-11-20,SBIN,EQ,294.75,298.75,291.25,297.1,2910.5,18099509,INE062A01012\n";
    let result = parse_and_insert(&path, csv, "NSE", "2014-11-20", &[]).unwrap();
    assert_eq!(result.rows_inserted, 1);
    assert_eq!(result.admission.separated, 1);
}
#[test]
fn security_admission_does_not_apply_nse_legend_to_other_exchanges() {
    let path = db();
    let mut file = parse("ANY,N1,100,110,90,105,99,200,20-NOV-2014,\n");
    file.exchange = "BSE".into();
    let admission = admit(&path, &[file]).unwrap();
    assert_eq!(admission.masks, vec![vec![true]]);
}
#[test]
fn security_admission_raw_audit_and_safe_journal_selection_are_inspectable() {
    let path = db();
    let files = vec![parse_bhavcopy_csv(
        include_str!("fixtures/20141120.csv"),
        "NSE",
        "2014-11-20",
        &[],
    )
    .unwrap()];
    let admission = admit(&path, &files).unwrap();
    let evidence: serde_json::Value =
        serde_json::from_slice(&fs::read(admission.reports[0].evidence.as_ref().unwrap()).unwrap())
            .unwrap();
    assert_eq!(evidence["rows"].as_array().unwrap().len(), 6);
    let safe = filter_files(&files, &admission);
    assert_eq!(safe[0].rows.len(), 1);
    assert_eq!(safe[0].rows[0].series, "EQ");
    assert_eq!(
        safe[0].rows[0].binary_record.close,
        (297.1 * DEFAULT_SCALE as f64).round() as i64
    );
    assert!(require_replay_safe(&path, &safe).is_ok());
}

#[test]
fn security_admission_different_security_classes_cannot_share_symbol_across_dates() {
    let path = db();
    let first = parse("SHARED,EQ,100,110,90,105,99,200,20-NOV-2014,\n");
    let second = parse_bhavcopy_csv(
        &csv("SHARED,GS,100,110,90,105,99,200,21-NOV-2014,\n"),
        "NSE",
        "2014-11-21",
        &[],
    )
    .unwrap();
    let (result, _) = insert_parsed_bhavcopy_files(&path, &[first, second]).unwrap();
    assert_eq!(
        result.iter().map(|r| r.admission.conflicted).sum::<usize>(),
        2
    );
    assert_eq!(count(&path), 0);
}
#[test]
fn security_admission_existing_equity_identity_cannot_be_replaced_by_another_class() {
    let path = db();
    parse_and_insert(
        &path,
        &csv("SHARED,EQ,100,110,90,105,99,200,20-NOV-2014,\n"),
        "NSE",
        "2014-11-20",
        &[],
    )
    .unwrap();
    let result = parse_and_insert(
        &path,
        &csv("SHARED,GS,100,110,90,105,99,200,21-NOV-2014,\n"),
        "NSE",
        "2014-11-21",
        &[],
    )
    .unwrap();
    assert_eq!(result.admission.conflicted, 1);
    assert_eq!(result.rows_inserted, 0);
    let c = open_prepared_fixture_connection(&path).unwrap();
    let series: String = c
        .query_row(
            "SELECT series FROM instruments WHERE symbol='SHARED'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(series, "EQ");
}

#[test]
fn security_admission_native_eq_auxiliary_and_it_failures_have_complete_daily_quotes() {
    let input = include_str!("fixtures/native-201411-held-rows.csv");
    let mut reader = ::csv::Reader::from_reader(input.as_bytes());
    let header = reader
        .headers()
        .unwrap()
        .iter()
        .collect::<Vec<_>>()
        .join(",");
    let mut dates = BTreeMap::<String, Vec<String>>::new();
    for record in reader.records() {
        let record = record.unwrap();
        dates
            .entry(record[8].to_string())
            .or_default()
            .push(record.iter().collect::<Vec<_>>().join(","));
    }
    assert_eq!(dates.values().map(Vec::len).sum::<usize>(), 86);
    for binary in [false, true] {
        for reverse in [false, true] {
            let path = db();
            let connection = open_prepared_fixture_connection(&path).unwrap();
            if binary {
                set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
            }
            let mut files: Vec<_> = dates
                .iter()
                .map(|(date, rows)| {
                    let mut parsed = parse_bhavcopy_csv(
                        &format!("{header}\n{}", rows.join("\n")),
                        "NSE",
                        date,
                        &[],
                    )
                    .unwrap();
                    if reverse {
                        parsed.rows.reverse();
                    }
                    parsed
                })
                .collect();
            if reverse {
                files.reverse();
            }
            let expected: Vec<_> = files
                .iter()
                .flat_map(|f| {
                    f.rows
                        .iter()
                        .filter(|r| r.series == "EQ" || r.series == "IT")
                        .map(|r| (r.symbol.clone(), r.binary_record))
                })
                .collect();
            let (results, _) = insert_parsed_bhavcopy_files(&path, &files).unwrap();
            assert_eq!(results.iter().map(|r| r.rows_inserted).sum::<usize>(), 45);
            assert_eq!(
                results
                    .iter()
                    .map(|r| r.admission.market_rows)
                    .sum::<usize>(),
                41
            );
            assert_eq!(
                results
                    .iter()
                    .map(|r| r.admission.conflicted)
                    .sum::<usize>(),
                0
            );
            assert!(results.iter().all(|r| r
                .admission
                .describe_result("Imported".into())
                .starts_with("Imported")));
            for (symbol, record) in expected {
                let file = BinaryEodFile::open(
                    path.parent()
                        .unwrap()
                        .join("eod_data/NSE")
                        .join(format!("{symbol}.eod")),
                )
                .unwrap();
                assert!(
                    file.read_all().unwrap().contains(&record),
                    "canonical OHLC/volume must be unchanged for {symbol}"
                );
            }
        }
    }
}

#[test]
fn security_admission_auxiliary_missing_or_wrong_identity_stays_a_conflict() {
    for isin in ["", "INE062A08058"] {
        let path = db();
        let input=format!("SBIN,EQ,100,110,90,105,99,200,20-NOV-2014,INE062A01012\nSBIN,IL,120,130,110,125,119,10,20-NOV-2014,{isin}\n");
        let file = parse(&input);
        let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
        assert_eq!(results[0].admission.conflicted, 2);
        assert_eq!(results[0].rows_inserted, 0);
        assert!(results[0]
            .admission
            .describe_result("Imported 0".into())
            .starts_with("Security subset:"));
    }
}

#[test]
fn security_admission_auxiliary_cannot_hide_disagreeing_regular_rows() {
    let path = db();
    let file=parse("SBIN,EQ,100,110,90,105,99,200,20-NOV-2014,INE062A01012\nSBIN,EQ,101,111,91,106,100,201,20-NOV-2014,INE062A01012\nSBIN,BL,120,130,110,125,119,10,20-NOV-2014,INE062A01012\n");
    let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(results[0].admission.conflicted, 3);
    assert_eq!(results[0].rows_inserted, 0);
}

#[test]
fn security_admission_auxiliary_only_is_retained_without_fabricating_daily_prices() {
    let path = db();
    let file = parse("ONLY,IL,120,130,110,125,119,10,20-NOV-2014,INE062A01012\n");
    let (results, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
    assert_eq!(results[0].rows_inserted, 0);
    assert_eq!(results[0].admission.market_rows, 1);
    assert_eq!(results[0].admission.conflicted, 0);
    assert_eq!(count(&path), 0);
    let replay = parse("ONLY,IL,120,130,110,125,119,10,20-NOV-2014,INE062A01012\n");
    assert!(require_replay_safe(&path, &[replay]).is_err());
}

#[test]
fn security_admission_market_selection_preserves_trade_for_trade_and_sme_primary() {
    for (primary, auxiliary) in [
        ("BE", "BL"),
        ("BZ", "IL"),
        ("SM", "SI"),
        ("ST", "SL"),
        ("SZ", "SQ"),
    ] {
        let path = db();
        let file=parse(&format!("SAMPLE,{primary},100,110,90,105,99,200,20-NOV-2014,INE062A01012\nSAMPLE,{auxiliary},120,130,110,125,119,10,20-NOV-2014,INE062A01012\n"));
        let (result, _) = insert_parsed_bhavcopy_files(&path, &[file]).unwrap();
        assert_eq!(result[0].rows_inserted, 1);
        assert_eq!(result[0].admission.market_rows, 1);
        assert_eq!(result[0].admission.conflicted, 0);
        let connection = open_prepared_fixture_connection(&path).unwrap();
        let series: String = connection
            .query_row(
                "SELECT series FROM instruments WHERE symbol='SAMPLE'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(series, primary);
        let file =
            BinaryEodFile::open(path.parent().unwrap().join("eod_data/NSE/SAMPLE.eod")).unwrap();
        let rows = file.read_all().unwrap();
        assert_eq!(rows[0].close, 105 * DEFAULT_SCALE as i64);
        assert_eq!(rows[0].volume, 200);
    }
}
