use super::*;
use rusqlite::{params, Connection};

const EX_DATE: &str = "2011-04-18";
const RECORD_DATE: &str = "2011-04-19";

#[allow(clippy::too_many_arguments)]
fn insert_v114ad_member(
    connection: &Connection,
    import_id: i64,
    symbol: &str,
    isin: &str,
    action_type: &str,
    factor: f64,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
) {
    connection
        .execute(
            "
              INSERT INTO corporate_action_imports (
                id,
                dedupe_key,
                exchange,
                source,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                record_date,
                action_type,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount,
                factor,
                price_factor,
                parse_status,
                review_status
              )
              VALUES (
                ?,
                ?,
                'NSE',
                'NSE_API',
                ?,
                ?,
                'V1.14AD TEST LIMITED',
                'V1.14AD deterministic fixture',
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                NULL,
                ?,
                ?,
                'PARSED',
                'PENDING'
              )
            ",
            params![
                import_id,
                format!("v114ad-{import_id}"),
                symbol,
                isin,
                EX_DATE,
                RECORD_DATE,
                action_type,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                factor,
                1.0 / factor,
            ],
        )
        .unwrap();
}

fn v114ad_candidate(import_id: i64, symbol: &str, factor: f64) -> ScanCandidate {
    ScanCandidate {
        import_id,
        symbol: Some(symbol.to_string()),
        exchange: "NSE".to_string(),
        ex_date: Some(EX_DATE.to_string()),
        factor: Some(factor),
    }
}

fn v114ad_connection() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&connection).unwrap();
    connection
}

#[test]
fn v114ad_duplicate_same_economic_bonus_imports_dedupe_before_compound_factor() {
    let connection = v114ad_connection();

    insert_v114ad_member(
        &connection,
        1,
        "ALIASCO",
        "INE000A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );
    insert_v114ad_member(
        &connection,
        2,
        "ALIASCO",
        "INE000A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );

    let context = load_same_date_split_bonus_compound_context(
        &connection,
        &v114ad_candidate(1, "ALIASCO", 2.0),
    )
    .unwrap();

    assert!(
        context.is_none(),
        "V1.14AD RED: equivalent duplicate bonus imports must collapse to one economic event before compound multiplication"
    );
}

#[test]
fn v114ad_preserves_genuine_same_date_split_plus_bonus_compound() {
    let connection = v114ad_connection();

    insert_v114ad_member(
        &connection,
        10,
        "GENUINE",
        "INE111A01001",
        "SPLIT",
        2.0,
        None,
        None,
        Some(10.0),
        Some(5.0),
    );
    insert_v114ad_member(
        &connection,
        11,
        "GENUINE",
        "INE111A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );

    let context = load_same_date_split_bonus_compound_context(
        &connection,
        &v114ad_candidate(10, "GENUINE", 2.0),
    )
    .unwrap()
    .expect("genuine Split + Bonus must remain compound");

    assert_eq!(context.component_count, 2);
    assert!((context.combined_factor - 4.0).abs() < 1e-12);
}

#[test]
fn v114ad_does_not_dedupe_same_symbol_rows_with_conflicting_isins() {
    let connection = v114ad_connection();

    insert_v114ad_member(
        &connection,
        20,
        "CONFLICTISIN",
        "INE222A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );
    insert_v114ad_member(
        &connection,
        21,
        "CONFLICTISIN",
        "INE999A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );

    let context = load_same_date_split_bonus_compound_context(
        &connection,
        &v114ad_candidate(20, "CONFLICTISIN", 2.0),
    )
    .unwrap()
    .expect("conflicting ISIN identities must not be deduplicated");

    assert_eq!(context.component_count, 2);
    assert!((context.combined_factor - 4.0).abs() < 1e-12);
}

#[test]
fn v114ad_does_not_dedupe_equivalent_identity_rows_with_conflicting_factors() {
    let connection = v114ad_connection();

    insert_v114ad_member(
        &connection,
        30,
        "CONFLICTFACTOR",
        "INE333A01001",
        "BONUS",
        2.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );
    insert_v114ad_member(
        &connection,
        31,
        "CONFLICTFACTOR",
        "INE333A01001",
        "BONUS",
        3.0,
        Some(1.0),
        Some(1.0),
        None,
        None,
    );

    let context = load_same_date_split_bonus_compound_context(
        &connection,
        &v114ad_candidate(30, "CONFLICTFACTOR", 2.0),
    )
    .unwrap()
    .expect("conflicting economic factors must not be deduplicated");

    assert_eq!(context.component_count, 2);
    assert!((context.combined_factor - 6.0).abs() < 1e-12);
}
