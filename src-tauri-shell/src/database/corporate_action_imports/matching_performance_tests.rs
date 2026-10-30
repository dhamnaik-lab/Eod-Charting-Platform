//! Explicit, opt-in measurement of connection preparation versus connection reuse.
//! Synthetic temporary databases only; no AppHandle, IPC, network, or approval.
use super::*;
use std::time::Instant;

const QUEUE_SIZE: i64 = 4_699;
const SAMPLE_SIZE: i64 = 50;

fn seed() -> tempfile::TempDir {
    let folder = tempfile::tempdir().unwrap();
    let connection = open_connection_for_folder(folder.path(), true).unwrap();
    run_connection_transaction(&connection, |connection| {
        connection
            .execute_batch(
                "INSERT INTO instruments(symbol,exchange,isin,name,series)
             VALUES('BENCH','NSE','INEAUTO01001','Benchmark Limited','EQ');
             INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
             VALUES('NSE','BENCH','INEAUTO01001','2026-08-14','NSE_API');",
            )
            .map_err(|error| error.to_string())?;
        let mut statement = connection
            .prepare(
                "INSERT INTO corporate_action_imports(
               id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,
               ex_date,action_type,cash_amount,parse_status,review_status
             ) VALUES(?,?,'NSE','NSE_API','BENCH','INEAUTO01001','Benchmark Limited',
               'Dividend Rs 1 per share','2026-08-14','DIVIDEND',1,'PARSED','UNRESOLVED')",
            )
            .map_err(|error| error.to_string())?;
        for id in 1..=QUEUE_SIZE {
            statement
                .execute(params![id, format!("benchmark-{id}")])
                .map_err(|error| error.to_string())?;
        }
        Ok(())
    })
    .unwrap();
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .unwrap();
    folder
}

type Decisions = Vec<(i64, String, String, String, String)>;

fn measure(folder: &Path, reuse: bool) -> (f64, Decisions) {
    let start = Instant::now();
    let cached = reuse.then(|| open_connection_for_folder(folder, false).unwrap());
    for import_id in 1..=SAMPLE_SIZE {
        let reopened;
        let connection = match cached.as_ref() {
            Some(connection) => connection,
            None => {
                reopened = open_connection_for_folder(folder, false).unwrap();
                &reopened
            }
        };
        let result = run_connection_transaction(connection, |connection| {
            quick_resolve_corporate_action_import_internal(
                connection,
                &CorporateActionImportQuickResolveInput { import_id },
            )
        })
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert!(result.import_record.approved_corporate_action_id.is_none());
    }
    let elapsed_ms = start.elapsed().as_secs_f64() * 1_000.0;
    // Verify state outside the timed region; both strategies must do identical work.
    let connection = Connection::open(folder.join(super::super::DATABASE_FILE_NAME)).unwrap();
    for table in ["corporate_actions", "eod_prices"] {
        let count: i64 = connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "No approval or price write allowed: {table}");
    }
    let mut statement = connection
        .prepare(
            "SELECT import_id,decision_type,resolved_symbol,resolved_exchange,resolved_isin
         FROM corporate_action_import_decisions ORDER BY import_id,id",
        )
        .unwrap();
    let decisions = statement
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .unwrap()
        .collect::<rusqlite::Result<Decisions>>()
        .unwrap();
    assert_eq!(decisions.len(), SAMPLE_SIZE as usize);
    (elapsed_ms, decisions)
}

#[test]
#[ignore = "opt-in timing measurement; creates only disposable synthetic fixtures"]
fn ca_matching_connection_benchmark() {
    println!("CA_BENCH queue={QUEUE_SIZE} sample={SAMPLE_SIZE} rounds=3; milliseconds exclude fixture creation and compilation");
    let mut totals = [0.0_f64; 2];
    for round in 1..=3 {
        let old = seed();
        let new = seed();
        // Alternate order to reduce systematic warm-cache bias.
        let (old_result, new_result) = if round % 2 == 1 {
            (measure(old.path(), false), measure(new.path(), true))
        } else {
            let new_result = measure(new.path(), true);
            (measure(old.path(), false), new_result)
        };
        assert_eq!(
            old_result.1, new_result.1,
            "Identity/audit parity, round {round}"
        );
        totals[0] += old_result.0;
        totals[1] += new_result.0;
        println!(
            "CA_BENCH round={round} reopen_ms={:.3} reuse_ms={:.3} ratio={:.3} parity=PASS",
            old_result.0,
            new_result.0,
            old_result.0 / new_result.0
        );
    }
    println!("CA_BENCH totals reopen_ms={:.3} reuse_ms={:.3} ratio={:.3}; {} matches per strategy; no approvals or price writes", totals[0], totals[1], totals[0] / totals[1], 3 * SAMPLE_SIZE);
}
