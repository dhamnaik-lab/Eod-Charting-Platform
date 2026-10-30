use super::*;
fn fixture(csv: &str) -> (Connection, PathBuf, NameInput) {
    let folder = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tmp")
        .join(format!(
            "bse-name-history-fixture-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
    fs::create_dir_all(&folder).unwrap();
    let path = folder.join("Comp_Name.csv");
    fs::write(&path, csv).unwrap();
    let c = Connection::open_in_memory().unwrap();
    c.execute_batch("CREATE TABLE instruments(symbol TEXT,exchange TEXT,bse_security_code TEXT,name TEXT,is_active INTEGER); INSERT INTO instruments VALUES('EXACT','BSE','500002','Current name',0),('NSEONLY','NSE','500002','NSE name',1); CREATE TABLE instrument_identity_history(id INTEGER PRIMARY KEY,exchange TEXT,isin TEXT,current_symbol TEXT,current_name TEXT,old_symbol TEXT,old_name TEXT,new_symbol TEXT,new_name TEXT,effective_date TEXT,change_type TEXT,source TEXT,source_ref TEXT);").unwrap();
    (
        c,
        folder,
        NameInput {
            source_mode: "manual".into(),
            file_path: Some(path.display().to_string()),
        },
    )
}
const CSV: &str =
    "Security Code,Old Name,New Name,Date\n500002,Old Limited,New Limited,03 Jul 2013,,,\n";
#[test]
fn known_source_parsers_accept_only_verified_schema_and_empty_overflow() {
    assert_eq!(
        parse_csv(CSV.as_bytes()).unwrap()[0].source_date,
        "2013-07-03"
    );
    for bad in [
        "Security Code,Old Name,New Name,Date\n500002,Old,New,03 Jul 2013,bad",
        "Security Code,Old Name,New Name,Date\n500002,Old,New,bad",
        "Security Code,Old Name,New Name,Date\n500002,Old,New",
        "Security Code,Security Id,Security Name\n500002,ABC,ABC",
    ] {
        assert!(parse_csv(bad.as_bytes()).is_err(), "{bad}");
    }
    let json=br#"{"Table":[{"Scrip_code":500002,"co_oldname":"Old","co_newname":"New","effective_date":"03 Jul 2013"}]}"#;
    assert_eq!(parse_json(json).unwrap()[0].security_code, "500002");
    assert!(parse_json(
        br#"{"Table":[{"code":500002,"old":"Old","new":"New","date":"2013-07-03"}]}"#
    )
    .is_err());
    assert!(NameScope.validate(200, json).is_err()); // official all-history population guard
    assert!(NameScope.validate(200, b"<html>blocked</html>").is_err());
}
#[test]
fn exact_origin_endpoint_query_and_resource_scope() {
    assert!(NameScope.matches(API));
    for bad in [
        API.replace("https:", "http:"),
        API.replace("api.bseindia.com", "api.bseindia.com.evil.test"),
        format!("{API}&year=2026"),
        format!("{API}&extra=1"),
        API.replace("year=", "year=2026"),
    ] {
        assert!(!NameScope.matches(&bad), "{bad}");
    }
    assert!(!NameScope.permits_resource("https://api.bseindia.com/BseIndiaAPI/api/Other/w"));
    assert!(
        NameScope.permits_resource("https://www.bseindia.com/assets/includenew/js/main-test.js")
    );
}
#[test]
fn preview_is_read_only_exact_code_and_holds_ambiguous_future_and_unknown() {
    let text=format!("{CSV}500002,New Limited,NEW LIMITED,04 Jul 2013\n999999,Unknown,Other,04 Jul 2013\n500002,New,Future,01 Jan 2999\n500003,One,Two,04 Jul 2013\n");
    let (c, folder, input) = fixture(&text);
    c.execute_batch("INSERT INTO instruments VALUES('ONE','BSE','500003','One',1),('TWO','BSE','500003','Two',1)").unwrap();
    c.pragma_update(None, "query_only", true).unwrap();
    let result = plan(&c, &folder, &input).unwrap();
    assert_eq!(
        (
            result.new_name_changes,
            result.skipped_rows,
            result.held_rows
        ),
        (1, 2, 2)
    );
    assert_eq!(result.rows[0].current_id.as_deref(), Some("EXACT"));
    assert_eq!(
        c.query_row::<i32, _, _>(
            "SELECT COUNT(*) FROM instrument_identity_history",
            [],
            |r| r.get(0)
        )
        .unwrap(),
        0
    );
    assert!(!table_exists(&c, "bse_name_history_keys").unwrap());
}
#[test]
fn confirmed_apply_saves_only_name_history_receipt_and_repeated_preview_is_duplicate() {
    let (c, folder, input) = fixture(CSV);
    let p = plan(&c, &folder, &input).unwrap();
    let stages = std::cell::RefCell::new(Vec::new());
    let result = apply(
        &c,
        &folder,
        &NameApplyInput {
            source: input.clone(),
            expected_plan_sha256: p.plan_sha256.clone(),
            expected_database_path: folder.display().to_string(),
        },
        &|p| stages.borrow_mut().push((p.stage, p.percent)),
    )
    .unwrap();
    assert!(result.applied);
    assert_eq!(list_runs(&c).unwrap().len(), 1);
    let saved:(String,String,Option<String>,Option<String>,Option<String>,String)=c.query_row("SELECT exchange,change_type,old_symbol,new_symbol,isin,source_ref FROM instrument_identity_history",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).unwrap();
    assert_eq!((&saved.0, &saved.1), (&"BSE".into(), &"NAME_CHANGE".into()));
    assert_eq!((saved.2, saved.3, saved.4), (None, None, None));
    assert!(saved.5.contains("500002"));
    let unchanged: (String, i32) = c
        .query_row(
            "SELECT name,is_active FROM instruments WHERE symbol='EXACT'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(unchanged, ("Current name".into(), 0));
    let again = plan(&c, &folder, &input).unwrap();
    assert_eq!(again.new_name_changes, 0);
    assert_eq!(again.duplicate_rows, 1);
    assert!(!again.can_apply);
    let stages = stages.borrow();
    assert_eq!(stages.last(), Some(&("committed", Some(100))));
    assert!(stages[..stages.len() - 1].iter().all(|p| p.1 != Some(100)));
    assert!(apply(
        &c,
        &folder,
        &NameApplyInput {
            source: input,
            expected_plan_sha256: again.plan_sha256,
            expected_database_path: folder.display().to_string()
        },
        &|_| {}
    )
    .is_err());
}
#[test]
fn stale_source_database_and_write_failure_cannot_leave_partial_history_or_receipt() {
    let (c, folder, input) = fixture(CSV);
    let p = plan(&c, &folder, &input).unwrap();
    let apply_input = NameApplyInput {
        source: input.clone(),
        expected_plan_sha256: p.plan_sha256,
        expected_database_path: folder.display().to_string(),
    };
    fs::write(
        input.file_path.as_ref().unwrap(),
        CSV.replace("New Limited", "Changed Limited"),
    )
    .unwrap();
    assert!(apply(&c, &folder, &apply_input, &|_| {})
        .unwrap_err()
        .contains("STALE"));
    fs::write(input.file_path.as_ref().unwrap(), CSV).unwrap();
    c.execute_batch("UPDATE instruments SET name='changed' WHERE symbol='EXACT'")
        .unwrap();
    assert!(apply(&c, &folder, &apply_input, &|_| {})
        .unwrap_err()
        .contains("STALE"));
    c.execute_batch("CREATE TRIGGER reject_names BEFORE INSERT ON instrument_identity_history BEGIN SELECT RAISE(ABORT,'forced failure'); END;").unwrap();
    let p = plan(&c, &folder, &input).unwrap();
    let stages = std::cell::RefCell::new(Vec::new());
    assert!(apply(
        &c,
        &folder,
        &NameApplyInput {
            source: input,
            expected_plan_sha256: p.plan_sha256,
            expected_database_path: folder.display().to_string()
        },
        &|p| stages.borrow_mut().push(p.percent)
    )
    .is_err());
    assert!(c.is_autocommit());
    assert!(!table_exists(&c, "bse_name_history_apply_runs").unwrap());
    assert_eq!(
        c.query_row::<i32, _, _>(
            "SELECT COUNT(*) FROM instrument_identity_history",
            [],
            |r| r.get(0)
        )
        .unwrap(),
        0
    );
    assert!(!stages.borrow().contains(&Some(100)));
}
#[test]
fn retained_official_response_has_verified_schema_and_publishes_only_complete_source() {
    let bytes=include_bytes!("../../../../../docs/changes/2026-10-30-bse-name-history/native-proof-1793303233854903400/official-name-history.json");
    assert_eq!(NameScope.validate(200, bytes).unwrap(), 2843);
    let (c, folder, _) = fixture(CSV);
    let saved = save_source(&folder, bytes).unwrap();
    assert_eq!(saved.rows, 2843);
    let input = NameInput {
        source_mode: "official".into(),
        file_path: None,
    };
    let p = plan(&c, &folder, &input).unwrap();
    assert_eq!(p.rows.len(), 2843);
    assert!(p
        .rows
        .iter()
        .any(|r| r.security_code == "500002" && r.outcome == "NEW"));
    assert!(save_source(&folder, b"<html>forbidden</html>").is_err());
    assert_eq!(
        plan(&c, &folder, &input).unwrap().source_sha256,
        saved.source_sha256
    );
    fs::write(saved.file_path, b"tampered").unwrap();
    assert!(plan(&c, &folder, &input).is_err());
}
