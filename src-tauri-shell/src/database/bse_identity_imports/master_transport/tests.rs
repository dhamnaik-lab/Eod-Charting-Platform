use super::*;
use std::cell::Cell;

fn csv(status: &str) -> Vec<u8> {
    let mut csv = String::from("Security Code,Security Id,Security Name,Group,ISIN No\n");
    let n = if status == "Active" { 1000 } else { 1 };
    for i in 0..n {
        csv.push_str(&format!(
            "{},ID{status}{i},Company {i},A,INE000000001\n",
            500000 + i
        ));
    }
    csv.into_bytes()
}

#[test]
fn exact_official_lifecycle_scope_rejects_other_statuses_origins_and_query_injection() {
    for (status, _) in BSE_LIFECYCLE_STATUSES {
        let url = format!("{DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX}{status}");
        let scope = MasterScope::new(status, &url).unwrap();
        assert!(scope.matches(&url));
        assert!(scope.permits_resource(PAGE));
        for bad in [
            url.replace("https://", "http://"),
            url.replace("api.bseindia.com", "example.com"),
            url.replace("segment=Equity", "segment=Debt"),
            format!("{url}&status=Active"),
            format!("{url}#fragment"),
            url.replace(&format!("status={status}"), "status=Unknown"),
        ] {
            assert!(!scope.matches(&bad));
            assert!(MasterScope::new(status, &bad).is_err());
        }
        let other = if *status == "Active" {
            "Delisted"
        } else {
            "Active"
        };
        assert!(!scope.matches(&format!("{DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX}{other}")));
        assert!(scope.validate(403, b"Access denied").is_err());
        assert!(scope.validate(200, b"<html>Access denied</html>").is_err());
        assert!(scope.validate_download(&csv(status)).is_ok());
    }
}

#[test]
fn only_direct_403_uses_browser_and_every_response_is_validated() {
    let browser_calls = Cell::new(0);
    let mut browser = |scope: MasterScope| {
        browser_calls.set(browser_calls.get() + 1);
        Ok(csv(scope.status))
    };
    let url = format!("{DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX}Active");
    let result = fetch(
        "Active",
        "CURRENT",
        &url,
        &mut || Ok((200, csv("Active"))),
        &mut browser,
    )
    .unwrap();
    assert!(!result.1);
    assert_eq!(browser_calls.get(), 0);
    let recovered = fetch(
        "Active",
        "CURRENT",
        &url,
        &mut || Ok((403, b"Forbidden".to_vec())),
        &mut browser,
    )
    .unwrap();
    assert!(recovered.1);
    assert_eq!(browser_calls.get(), 1);
    for http in [404, 429, 500] {
        assert!(fetch(
            "Active",
            "CURRENT",
            &url,
            &mut || Ok((http, vec![])),
            &mut browser
        )
        .is_err());
    }
    assert!(fetch(
        "Active",
        "CURRENT",
        &url,
        &mut || Err("Network failure".into()),
        &mut browser
    )
    .is_err());
    assert_eq!(browser_calls.get(), 1);
    assert!(fetch(
        "Active",
        "CURRENT",
        &url,
        &mut || Ok((403, vec![])),
        &mut |_| Ok(b"<html>Denied</html>".to_vec())
    )
    .is_err());
    assert!(fetch(
        "Active",
        "CURRENT",
        &url,
        &mut || Ok((403, vec![])),
        &mut |_| Err("Timed out".into())
    )
    .unwrap_err()
    .contains("Saved sources were not replaced"));
}

#[test]
fn invalid_or_oversized_csv_cannot_be_admitted() {
    for body in [b"[]".to_vec(), csv("Delisted"), vec![b'a'; MAX_BYTES + 1]] {
        assert!(validate_csv("Active", "CURRENT", &body).is_err());
    }
}

#[test]
fn empty_csv_overflow_cannot_shift_lifecycle_tags() {
    let header = "Security Code,Security Id,Security Name,Group,ISIN No\n";
    let mut combined = String::new();
    for (status, lifecycle) in BSE_LIFECYCLE_STATUSES {
        let body = format!("{header}500001,ID{status},Company,A,INE000000001,,\n");
        append_bse_lifecycle_csv(&mut combined, &body, lifecycle).unwrap();
    }
    let rows = load_bse_master_rows_from_bytes(combined.as_bytes(), "overflow test").unwrap();
    for (status, lifecycle) in BSE_LIFECYCLE_STATUSES {
        assert_eq!(
            rows.iter()
                .find(|row| row.symbol == format!("ID{}", status.to_ascii_uppercase()))
                .unwrap()
                .lifecycle_status,
            *lifecycle
        );
    }
    for bad in [
        format!("{header}500001,ID,Company,A,INE000000001,unexpected\n"),
        format!("{header}500001,ID,Company\n"),
    ] {
        assert!(append_bse_lifecycle_csv(&mut String::new(), &bad, "CURRENT").is_err());
    }
}

#[test]
fn complete_bundle_is_saved_with_lifecycle_fidelity_and_failed_bundle_preserves_old_source() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tmp")
        .join(format!(
            "bse-master-transport-proof-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
    let old = root.join("reference-data/bse/old.csv");
    fs::create_dir_all(old.parent().unwrap()).unwrap();
    fs::write(&old, b"original").unwrap();
    let urls = OfficialSourceUrls::defaults();
    assert!(
        save_bundle(&root, &urls, &mut |status, _, _| if status == "Suspended" {
            Err("Browser 403".into())
        } else {
            Ok((csv(status), true))
        })
        .is_err()
    );
    assert_eq!(fs::read(&old).unwrap(), b"original");
    assert_eq!(fs::read_dir(old.parent().unwrap()).unwrap().count(), 1);
    let result = save_bundle(&root, &urls, &mut |status, _, _| Ok((csv(status), true))).unwrap();
    assert!(result
        .message
        .contains("Browser recovery used for 3 sources"));
    let rows = load_bse_master_rows(Path::new(&result.file_path)).unwrap();
    assert_eq!(
        rows.iter()
            .filter(|r| r.lifecycle_status == "CURRENT")
            .count(),
        1000
    );
    assert_eq!(
        rows.iter()
            .filter(|r| r.lifecycle_status == "DELISTED")
            .count(),
        1
    );
    assert_eq!(
        rows.iter()
            .filter(|r| r.lifecycle_status == "SUSPENDED")
            .count(),
        1
    );
    assert_eq!(fs::read(&old).unwrap(), b"original");
}

#[cfg(windows)]
#[test]
#[ignore = "Explicit native BSE lifecycle transport proof; isolated source/profile output, no database access"]
fn native_bse_identity_lifecycle_transport_proof() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("docs/changes/2026-10-30-bse-identity-403")
        .join(format!(
            "native-proof-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
    let profile = root.join("browser-profile");
    fs::create_dir_all(&profile).unwrap();
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    let app = tauri::Builder::default()
        .any_thread()
        .build(context)
        .unwrap();
    let handle = app.handle().clone();
    let evidence = root.clone();
    let worker = std::thread::spawn(move || {
        let result = (|| -> AppResult<serde_json::Value> {
            let client = client()?;
            let mut transports = Vec::new();
            let urls = OfficialSourceUrls::defaults();
            let saved = save_bundle(&evidence, &urls, &mut |status, lifecycle, url| {
                let fetched = fetch(
                    status,
                    lifecycle,
                    url,
                    &mut || direct(&client, url, &urls.bse_list_scrips_referer),
                    &mut |scope| {
                        crate::bhavcopy::bse_price_history::collect_proof(
                            handle.clone(),
                            scope,
                            profile.clone(),
                            Arc::new(AtomicBool::new(false)),
                        )
                    },
                )?;
                fs::write(evidence.join(format!("{status}.source.csv")), &fetched.0)
                    .map_err(|e| e.to_string())?;
                transports.push(serde_json::json!({"status":status,"browserRecovery":fetched.1,"bytes":fetched.0.len(),"sha256":format!("{:x}",Sha256::digest(&fetched.0))}));
                Ok(fetched)
            })?;
            Ok(
                serde_json::json!({"sources":transports,"result":saved,"databaseOpened":false,"databaseApplied":false}),
            )
        })();
        handle.exit(0);
        result
    });
    app.run_return(|_, event| {
        if let tauri::RunEvent::ExitRequested {
            code: None, api, ..
        } = event
        {
            api.prevent_exit();
        }
    });
    let result = worker.join().unwrap();
    fs::write(
        root.join("proof.json"),
        serde_json::to_vec_pretty(
            &serde_json::json!({"result":result,"databaseOpened":false,"databaseApplied":false}),
        )
        .unwrap(),
    )
    .unwrap();
    println!("BSE identity native proof: {}\n{result:?}", root.display());
    result.unwrap();
}
