//! Fill missing current BSE security codes from retained official master bytes.
//! Never sync lifecycle flags, infer tickers from names, or create event-date proof.
use super::*;

pub(super) fn collect(
    app: &AppHandle,
    connection: &Connection,
    session: &mut bse_fetch::BseSession,
) -> AppResult<usize> {
    let missing: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM instruments WHERE exchange='BSE'
         AND (bse_security_code IS NULL OR trim(bse_security_code)=''))",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !missing {
        return Ok(0);
    }
    // Same guarded HTTP -> isolated WebView2 route and immutable capture receipt
    // as official CA Fetch. Current master metadata is not historical proof.
    let bytes = session.fetch(app, &super::bse_browser::Scope::identity_master())?;
    run_connection_transaction(connection, |c| fill_missing_codes(c, &bytes))
}

pub(super) fn fill_missing_codes(connection: &Connection, bytes: &[u8]) -> AppResult<usize> {
    // BSE appends empty unnamed fields beyond the declared master header.
    // Accept only empty overflow; never silently shift identity columns.
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let headers = reader.headers().map_err(|e| e.to_string())?.clone();
    let column = |aliases: &[&str]| {
        headers
            .iter()
            .position(|h| {
                let key: String = h
                    .trim_start_matches('\u{feff}')
                    .chars()
                    .filter(|c| c.is_ascii_alphanumeric())
                    .flat_map(char::to_lowercase)
                    .collect();
                aliases.contains(&key.as_str())
            })
            .ok_or_else(|| format!("BSE identity master missing {}.", aliases[0]))
    };
    let code_col = column(&["securitycode", "scripcode"])?;
    let symbol_col = column(&["securityid", "scripid"])?;
    let isin_col = column(&["isin", "isinno", "isinnumber"])?;
    // Inspect all source rows, including repeated lifecycle observations. Never
    // discard a conflicting code/ISIN/ticker by selecting the first occurrence.
    let mut source = HashSet::new();
    for row in reader.records() {
        let row = row.map_err(|e| e.to_string())?;
        if row.len() < headers.len() || row.iter().skip(headers.len()).any(|v| !v.trim().is_empty())
        {
            return Err(
                "BSE identity master has missing columns or non-empty unnamed fields.".into(),
            );
        }
        let code = row.get(code_col).unwrap_or("").trim().to_string();
        let symbol = row.get(symbol_col).unwrap_or("").trim().to_uppercase();
        let isin = row.get(isin_col).unwrap_or("").trim().to_uppercase();
        // Malformed observations still participate in conflict detection.
        source.insert((code, symbol, isin));
    }
    let mut code_counts = HashMap::new();
    let mut isin_counts = HashMap::new();
    let mut symbol_counts = HashMap::new();
    for (code, symbol, isin) in &source {
        *code_counts.entry(code).or_insert(0) += 1;
        *isin_counts.entry(isin).or_insert(0) += 1;
        *symbol_counts.entry(symbol).or_insert(0) += 1;
    }
    let mut changed = 0;
    for (code, symbol, isin) in &source {
        if code.len() != 6
            || !code.bytes().all(|c| c.is_ascii_digit())
            || isin.len() != 12
            || !isin.starts_with("IN")
            || !isin.bytes().all(|c| c.is_ascii_alphanumeric())
            || symbol.is_empty()
        {
            continue;
        }
        if code_counts[code] != 1 || isin_counts[isin] != 1 || symbol_counts[symbol] != 1 {
            continue;
        }
        // T+0 (`#`) has the same ISIN but is a separate settlement instrument.
        // Enforce ISIN uniqueness only across normal-settlement BSE symbols,
        // without allowing a `#` row itself to receive a legacy code.
        changed += connection.execute(
            "UPDATE instruments SET bse_security_code=?1 WHERE exchange='BSE' AND symbol=?2 AND isin=?3
             AND (bse_security_code IS NULL OR trim(bse_security_code)='')
             AND symbol NOT LIKE '%#'
             AND (SELECT count(*) FROM instruments WHERE exchange='BSE' AND isin=?3 AND symbol NOT LIKE '%#')=1
             AND NOT EXISTS(SELECT 1 FROM instruments WHERE exchange='BSE' AND bse_security_code=?1 AND symbol<>?2)",
            params![code, symbol, isin]
        ).map_err(|e| e.to_string())?;
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bse_mapping_is_exact_unique_idempotent_and_metadata_only() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instruments(symbol TEXT, exchange TEXT, isin TEXT, bse_security_code TEXT, is_active INTEGER);
            INSERT INTO instruments VALUES ('GPTHEALTH','BSE','INE486R01017',NULL,0),
            ('GPTHEALTH','NSE','INE486R01017',NULL,1),('OTHER','BSE','INE000A01001','500001',1);
            CREATE TABLE corporate_actions(id INTEGER);
            CREATE TABLE corporate_action_imports(id INTEGER);").unwrap();
        let csv = b"Security Code,Security Id,ISIN\n544131,GPTHEALTH,INE486R01017,,,,,\n544131,GPTHEALTH,INE486R01017\n500002,OTHER,INE000A01001\n";
        assert_eq!(fill_missing_codes(&c, csv).unwrap(), 1);
        assert_eq!(fill_missing_codes(&c, csv).unwrap(), 0);
        let rows: Vec<(String,Option<String>,i64)> = c.prepare("SELECT exchange,bse_security_code,is_active FROM instruments WHERE symbol='GPTHEALTH' ORDER BY exchange").unwrap()
            .query_map([], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap().collect::<Result<_,_>>().unwrap();
        assert_eq!(
            rows,
            vec![
                ("BSE".into(), Some("544131".into()), 0),
                ("NSE".into(), None, 1)
            ]
        );
        assert_eq!(
            c.query_row(
                "SELECT bse_security_code FROM instruments WHERE symbol='OTHER'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "500001"
        );
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_action_imports", [], |r| r
                .get::<_, i64>(
                0
            ))
            .unwrap(),
            0
        );
    }

    #[test]
    fn bse_mapping_blocks_source_and_local_conflicts_and_name_only_matches() {
        for extra_source in [
            "544131,GPTHEALTH,\n",
            "544132,GPTHEALTH,INE486R01017\n",
            "544131,OTHER,INE000A01001\n",
            "544132,GPTHEALTH,INE000A01001\n",
        ] {
            let c = Connection::open_in_memory().unwrap();
            c.execute_batch("CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,bse_security_code TEXT);
                INSERT INTO instruments VALUES('GPTHEALTH','BSE','INE486R01017',NULL);").unwrap();
            let csv = format!(
                "Security Code,Security Id,ISIN\n544131,GPTHEALTH,INE486R01017\n{extra_source}"
            );
            assert_eq!(fill_missing_codes(&c, csv.as_bytes()).unwrap(), 0);
        }
        for extra_local in [
            "('OTHER','BSE','INE486R01017',NULL)",
            "('OTHER','BSE','INE000A01001','544131')",
        ] {
            let c = Connection::open_in_memory().unwrap();
            c.execute_batch(&format!("CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,bse_security_code TEXT);
                INSERT INTO instruments VALUES('GPTHEALTH','BSE','INE486R01017',NULL),{extra_local};")).unwrap();
            assert_eq!(
                fill_missing_codes(
                    &c,
                    b"Security Code,Security Id,ISIN\n544131,GPTHEALTH,INE486R01017\n"
                )
                .unwrap(),
                0
            );
        }
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,bse_security_code TEXT);
            INSERT INTO instruments VALUES('GPTHEALTH','BSE','INE486R01017',NULL);",
        )
        .unwrap();
        assert_eq!(
            fill_missing_codes(
                &c,
                b"Security Code,Security Id,ISIN\n544131,DIFFERENT,INE486R01017\n"
            )
            .unwrap(),
            0
        );
        assert!(fill_missing_codes(
            &c,
            b"Security Code,Company Name\n544131,GPT Healthcare Ltd\n"
        )
        .is_err());
        for malformed in [
            "Security Code,Security Id,ISIN\n544131,GPTHEALTH\n",
            "Security Code,Security Id,ISIN\n544131,GPTHEALTH,INE486R01017,unexpected\n",
        ] {
            assert!(fill_missing_codes(&c, malformed.as_bytes()).is_err());
            assert!(c
                .query_row(
                    "SELECT bse_security_code IS NULL FROM instruments WHERE exchange='BSE'",
                    [],
                    |r| r.get::<_, bool>(0)
                )
                .unwrap());
        }
    }

    #[test]
    fn bse_mapping_allows_only_settlement_variant_duplicate_and_preserves_its_identity() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instruments(symbol TEXT, exchange TEXT, isin TEXT, bse_security_code TEXT, is_active INTEGER);
            INSERT INTO instruments VALUES
                ('TCS','BSE','INE467B01029',NULL,1),
                ('TCS#','BSE','INE467B01029',NULL,1),
                ('532540','BSE',NULL,NULL,1),
                ('TCS','NSE','INE467B01029',NULL,1);").unwrap();
        let csv = b"Security Code,Security Id,ISIN\n532540,TCS,INE467B01029\n";
        assert_eq!(fill_missing_codes(&c, csv).unwrap(), 1);
        assert_eq!(fill_missing_codes(&c, csv).unwrap(), 0);
        let rows: Vec<(String, String, Option<String>)> = c.prepare(
            "SELECT symbol,exchange,bse_security_code FROM instruments ORDER BY exchange,symbol"
        ).unwrap().query_map([], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))
          .unwrap().collect::<Result<_, _>>().unwrap();
        assert_eq!(rows, vec![
            ("532540".into(), "BSE".into(), None),
            ("TCS".into(), "BSE".into(), Some("532540".into())),
            ("TCS#".into(), "BSE".into(), None),
            ("TCS".into(), "NSE".into(), None),
        ]);
        assert_eq!(c.query_row(
            "SELECT count(*) FROM instruments WHERE exchange='BSE' AND isin='INE467B01029'",
            [], |r| r.get::<_, i64>(0)).unwrap(), 2);
    }

    #[test]
    fn bse_mapping_still_blocks_extra_normal_isin_owners_and_claimed_codes() {
        let csv = b"Security Code,Security Id,ISIN\n532540,TCS,INE467B01029\n";
        for other in [
            "('OTHER','BSE','INE467B01029',NULL)",
            "('OTHER','BSE','INE999A01010','532540')",
            "('OTHER#','BSE','INE999A01010','532540')",
        ] {
            let c = Connection::open_in_memory().unwrap();
            c.execute_batch(&format!("CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,bse_security_code TEXT);
                INSERT INTO instruments VALUES ('TCS','BSE','INE467B01029',NULL),
                    ('TCS#','BSE','INE467B01029',NULL), {other};")).unwrap();
            assert_eq!(fill_missing_codes(&c, csv).unwrap(), 0);
            assert!(c.query_row("SELECT bse_security_code IS NULL FROM instruments WHERE symbol='TCS'",
                [], |r| r.get::<_, bool>(0)).unwrap());
        }
    }

    #[test]
    fn bse_mapping_never_backfills_settlement_variant_as_normal_code_owner() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,bse_security_code TEXT);
            INSERT INTO instruments VALUES ('TCS#','BSE','INE467B01029',NULL);").unwrap();
        assert_eq!(fill_missing_codes(
            &c, b"Security Code,Security Id,ISIN\n532540,TCS#,INE467B01029\n"
        ).unwrap(), 0);
        assert_eq!(c.query_row("SELECT bse_security_code FROM instruments WHERE symbol='TCS#'",
            [], |r| r.get::<_, Option<String>>(0)).unwrap(), None);
    }

}
