//! Recheck pending identity proof and derived metadata. Never apply a financial action or rewrite original evidence.
use super::*;

#[tauri::command]
pub async fn refresh_corporate_action_import_classifications(
    app: AppHandle,
    input: CorporateActionImportLookupInput,
) -> AppResult<Vec<CorporateActionImportRow>> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    tauri::async_runtime::spawn_blocking(move || {
        let folder = resolve_active_database_folder(&app)?.ok_or_else(|| {
            "Open a database before refreshing import classifications.".to_string()
        })?;
        verify_import_lookup_database(&folder, &input.expected_database_path)?;
        // Pin the reviewed folder for the whole transaction, including a concurrent
        // active-database switch. Reuse the owner used by matching and queue reads.
        super::super::connection_registry::with_connection_for_folder(
            &app,
            &folder,
            false,
            |connection| {
                run_connection_transaction(connection, |connection| {
                    if let Ok(Some((url, raw_csv, source_hash))) = connection
                        .query_row(
                            "SELECT source_url, raw_csv, source_hash FROM corporate_action_symbol_chain_sources ORDER BY id DESC LIMIT 1",
                            [],
                            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
                        )
                        .optional()
                    {
                        if url == "https://nsearchives.nseindia.com/content/equities/symbolchange.csv"
                            && !raw_csv.is_empty()
                            && source_hash == format!("{:x}", <sha2::Sha256 as sha2::Digest>::digest(raw_csv.as_bytes()))
                        {
                            let _ = dated_symbol_chain::retain_source(connection, &url, raw_csv.as_bytes());
                        }
                    }
                    refresh_classifications(connection, &input.import_ids)
                })
            },
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

fn refresh_classifications(
    connection: &Connection,
    ids: &[i64],
) -> AppResult<Vec<CorporateActionImportRow>> {
    let before = read_import_rows_by_ids(connection, ids)?;
    refresh_classifications_once(connection, ids)?;
    // An Other row reclassified into a combined Split + Bonus needs one more pass
    // so its components are prepared in this Load & Validate, not the next one.
    let reclassified = read_import_rows_by_ids(connection, ids)?
        .into_iter()
        .filter(|row| {
            matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
                && before
                    .iter()
                    .any(|old| old.id == row.id && old.action_type == "OTHER")
        })
        .map(|row| row.id)
        .collect::<Vec<_>>();
    if !reclassified.is_empty() {
        refresh_classifications_once(connection, &reclassified)?;
    }
    read_import_rows_by_ids(connection, ids)
}

fn refresh_classifications_once(
    connection: &Connection,
    ids: &[i64],
) -> AppResult<Vec<CorporateActionImportRow>> {
    let rows = read_import_rows_by_ids(connection, ids)?;
    for row in &rows {
        if row.review_status == "APPROVED" || row.approved_corporate_action_id.is_some() {
            continue;
        }
        // Remove unsafe terms eligibility even when identity has manual provenance.
        // Preserve that identity/provenance; this never grants readiness or approval.
        if matches!(row.action_type.as_str(), "SPLIT" | "BONUS") {
            if let Some((_, reason)) = split_bonus_terms::blocker(&row.purpose_raw) {
                block_pending_terms(connection, row, reason)?;
                continue;
            }
        }
        // Older databases can carry manual provenance without a decision row.
        // Preserve it, including the R1 legacy-identity guard.
        let legacy_message = row
            .message
            .as_deref()
            .map(normalize_text)
            .unwrap_or_default();
        if [
            "MANUALLY RESOLVED",
            "MANUAL RESOLUTION",
            "OPERATOR ACCEPTED",
            "EXCEPTION",
        ]
        .iter()
        .any(|marker| legacy_message.contains(marker))
        {
            continue;
        }
        // Preserve explicit/manual decisions and unknown maintenance provenance.
        let protected: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM corporate_action_import_decisions WHERE import_id=?
             AND decision_type NOT IN ('CLASSIFICATION_REFRESH','VERIFIED_QUICK_RESOLUTION',
                 'VERIFIED_EVENT_IDENTITY_RESOLUTION','VERIFIED_HISTORICAL_ISIN_TRANSITION',
                 'IDENTITY_PROOF_RECHECK','COMPOUND_COMPONENT_PREPARED','BSE_SECURITY_CODE_RESOLUTION'))",
                [row.id],
                |r| r.get(0),
            )
            .map_err(|error| error.to_string())?;
        if protected {
            continue;
        }
        // Retry source-code mapping for old unmatched BSE imports after explicit
        // Fetch has populated official instrument metadata. Never remap an
        // existing identity or manufacture historical/event-date proof.
        if row.exchange == "BSE"
            && row.source == "BSE_API"
            && ((matches!(
                row.review_status.as_str(),
                "UNRESOLVED" | "NEEDS_REVIEW" | "UNSUPPORTED"
            ) && row.symbol.is_none()
                && row.isin.is_none())
                || (row.symbol.is_some() && row.symbol == row.bse_scrip_code))
            && row.bse_scrip_code.is_some()
            && row.evidence_count > 0
        {
            let resolved = recheck_import_row_resolution(connection, row)?;
            if resolved.symbol.is_some()
                && resolved.symbol != row.symbol
                && resolved.isin.is_some()
                && resolved.review_status == "PENDING"
            {
                apply_import_row_resolution(connection, row, &resolved)?;
                if matches!(row.review_status.as_str(), "NEEDS_REVIEW" | "UNSUPPORTED") {
                    // Identity metadata must not clear a separate terms/type block.
                    connection
                        .execute(
                            "UPDATE corporate_action_imports SET review_status=? WHERE id=?",
                            params![row.review_status, row.id],
                        )
                        .map_err(|e| e.to_string())?;
                }
                let updated = get_import_row(connection, row.id)?;
                record_corporate_action_import_decision(connection, row, &updated,
                    "BSE_SECURITY_CODE_RESOLUTION",
                    "Exact official BSE security code mapped to local instrument metadata; no event-date proof or financial approval granted.")?;
            }
        }
        identity_recheck::recheck_pending_machine_identity(connection, row)?;
        let current = get_import_row(connection, row.id)?;
        let row = &current;
        if split_bonus_preparation::split_with_separate_percentage_dividend(row).is_some() {
            continue;
        }
        let components = split_bonus_preparation::components(&row.purpose_raw);
        let eligible = row.action_type == "OTHER"
            || (matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
                && split_bonus_preparation::component_families(&row.purpose_raw).len() > 1)
            || (row.action_type == "DIVIDEND"
                && (matches!(row.review_status.as_str(), "UNSUPPORTED" | "NEEDS_REVIEW")
                    || row.purpose_raw.contains('%')));
        if !eligible {
            continue;
        }
        let parsed = if let Some(parts) = components.filter(|_| {
            row.evidence_count > 0 && matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
        }) {
            split_bonus_preparation::prepare_companion(connection, row, &parts)?;
            parts
                .into_iter()
                .find(|p| p.action_type == row.action_type)
                .ok_or_else(|| "Combined Split/Bonus primary component is missing.".to_string())?
        } else {
            parse_corporate_action_purpose(&row.purpose_raw)
        };
        if !matches!(
            parsed.action_type.as_str(),
            "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS" | "DEMERGER"
        ) {
            continue;
        }
        let mut updated = row.clone();
        updated.action_type = parsed.action_type;
        updated.parse_status = parsed.parse_status;
        updated.ratio_num = parsed.ratio_num;
        updated.ratio_den = parsed.ratio_den;
        updated.old_face_value = parsed.old_face_value;
        updated.new_face_value = parsed.new_face_value;
        updated.cash_amount = parsed.cash_amount;
        updated.factor = parsed.factor;
        updated.price_factor = parsed.price_factor;
        let cash_conflict = row.cash_amount.is_some()
            && updated.cash_amount.is_some()
            && row.cash_amount != updated.cash_amount;
        if cash_conflict {
            updated.cash_amount = row.cash_amount;
            updated.parse_status = "NEEDS_REVIEW".to_string();
        }
        if updated.action_type == "DEMERGER" {
            // A name/ratio alone does not establish cost allocation or an adjustment.
            updated.factor = None;
            updated.price_factor = None;
            updated.parse_status = "NEEDS_REVIEW".to_string();
            updated.review_status = "UNSUPPORTED".to_string();
        } else {
            let resolved = recheck_import_row_resolution(connection, &updated)?;
            updated.review_status = if matches!(
                row.review_status.as_str(),
                "UNRESOLVED" | "PENDING_ISIN_MISMATCH"
            ) || resolved.symbol != row.symbol
                || resolved.exchange != row.exchange
            {
                "UNRESOLVED".to_string()
            } else {
                derive_import_review_status(&updated, &resolved)
            };
        }
        let before = format!(
            "{}|{}|{}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}",
            row.action_type,
            row.parse_status,
            row.review_status,
            row.cash_amount,
            row.factor,
            row.price_factor,
            row.ratio_num,
            row.ratio_den,
            row.old_face_value,
            row.new_face_value,
            row.ex_date
        );
        let after = format!(
            "{}|{}|{}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}",
            updated.action_type,
            updated.parse_status,
            updated.review_status,
            updated.cash_amount,
            updated.factor,
            updated.price_factor,
            updated.ratio_num,
            updated.ratio_den,
            updated.old_face_value,
            updated.new_face_value,
            updated.ex_date
        );
        if before == after {
            continue;
        }
        let message = if updated.action_type == "DEMERGER" {
            "Reclassified as Demerger; verified cost-allocation evidence is required. No adjustment applied.".to_string()
        } else if cash_conflict {
            "Classification refreshed; stored and parsed cash amounts conflict. No cash correction or adjustment applied.".to_string()
        } else {
            format!(
                "Classification refreshed. {} Identity and approval checks remain required.",
                parsed.message.unwrap_or_default()
            )
        };
        connection.execute("UPDATE corporate_action_imports SET action_type=?,parse_status=?,review_status=?,
            cash_amount=?,factor=?,price_factor=?,ratio_num=?,ratio_den=?,old_face_value=?,new_face_value=?,message=?
            WHERE id=? AND review_status<>'APPROVED' AND approved_corporate_action_id IS NULL",
            params![updated.action_type,updated.parse_status,updated.review_status,updated.cash_amount,updated.factor,
                updated.price_factor,updated.ratio_num,updated.ratio_den,updated.old_face_value,updated.new_face_value,message,row.id]
        ).map_err(|error| error.to_string())?;
        record_corporate_action_import_decision(
            connection,
            row,
            &updated,
            "CLASSIFICATION_REFRESH",
            &format!("Pending metadata reparse only; before={before}; after={after}"),
        )?;
    }
    read_import_rows_by_ids(connection, ids)
}

fn block_pending_terms(
    connection: &Connection,
    row: &CorporateActionImportRow,
    reason: &str,
) -> AppResult<()> {
    let previous_message = row.message.as_deref().unwrap_or_default();
    if row.parse_status == "NEEDS_REVIEW"
        && row.factor.is_none()
        && row.price_factor.is_none()
        && previous_message.contains(reason)
    {
        return Ok(());
    }
    let message = if previous_message.contains(reason) {
        previous_message.to_string()
    } else if previous_message.is_empty() {
        reason.to_string()
    } else {
        format!("{previous_message} {reason}")
    };
    // Retain identity blockers and manual-resolution metadata. Ratio/face-value
    // fields remain historical derived values, explicitly ineligible for use.
    connection.execute(
        "UPDATE corporate_action_imports SET parse_status='NEEDS_REVIEW',factor=NULL,price_factor=NULL,
         review_status=CASE WHEN review_status IN ('UNRESOLVED','PENDING_ISIN_MISMATCH')
           THEN review_status ELSE 'NEEDS_REVIEW' END,message=?
         WHERE id=? AND review_status<>'APPROVED' AND approved_corporate_action_id IS NULL",
        params![message, row.id],
    )
    .map_err(|e| e.to_string())?;
    let updated = get_import_row(connection, row.id)?;
    record_corporate_action_import_decision(
        connection,
        row,
        &updated,
        "CLASSIFICATION_REFRESH",
        &format!("{reason} Pending terms blocked; previous factor={:?}, price_factor={:?}. Identity and source evidence preserved; no financial action.", row.factor, row.price_factor),
    )
}

#[cfg(test)]
#[path = "split_bonus_terms_tests.rs"]
mod split_bonus_terms_tests;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires a fresh marked SQL-only disposable copy under repo/tmp"]
    fn classification_refresh_disposable_data_audit() {
        let folder =
            std::path::PathBuf::from(std::env::var("CA_CLASSIFICATION_AUDIT_ROOT").unwrap());
        let canonical = folder.canonicalize().unwrap();
        let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        assert!(canonical.starts_with(project.join("tmp").canonicalize().unwrap()));
        assert!(folder.join("CLASSIFICATION_AUDIT.json").is_file());
        let marker: Value =
            serde_json::from_slice(&fs::read(folder.join("CLASSIFICATION_AUDIT.json")).unwrap())
                .unwrap();
        let source = Path::new(marker["source"].as_str().unwrap())
            .canonicalize()
            .unwrap();
        let db = folder.join(crate::database::DATABASE_FILE_NAME);
        assert_ne!(db.canonicalize().unwrap(), source);
        let output = folder.join("classification-results.json");
        assert!(!output.exists(), "Preserve existing evidence");
        let c = Connection::open(db).unwrap();
        let before = super::super::real_data_performance_tests::protected_state(&c);
        // temp_store is configured during initialization and clears temporary
        // objects. Install audit snapshots/guards only after that setup.
        crate::database::prepare_database_connection(&c).unwrap();
        c.execute_batch("CREATE TEMP TABLE audit_original_evidence AS SELECT * FROM corporate_action_import_evidence;").unwrap();
        let original_pending: i64 = c.query_row("SELECT count(*) FROM corporate_action_imports WHERE approved_corporate_action_id IS NULL AND review_status<>'APPROVED'",[],|r|r.get(0)).unwrap();
        let original_decisions: i64 = c.query_row("SELECT count(*) FROM corporate_action_import_decisions WHERE decision_type='IDENTITY_PROOF_RECHECK'",[],|r|r.get(0)).unwrap();
        for table in ["corporate_actions", "eod_prices"] {
            for operation in ["INSERT", "UPDATE", "DELETE"] {
                c.execute_batch(&format!(
                    "CREATE TEMP TRIGGER audit_no_{table}_{operation} BEFORE {operation} ON {table}
                    BEGIN SELECT RAISE(ABORT,'financial writes forbidden'); END;"
                ))
                .unwrap();
            }
        }
        c.execute_batch("CREATE TEMP TRIGGER audit_no_approvals BEFORE UPDATE ON corporate_action_imports
            WHEN OLD.review_status='APPROVED' OR OLD.approved_corporate_action_id IS NOT NULL
              OR NEW.review_status='APPROVED' OR NEW.approved_corporate_action_id IS NOT OLD.approved_corporate_action_id
              OR NEW.approved_at IS NOT OLD.approved_at
            BEGIN SELECT RAISE(ABORT,'approval changes forbidden'); END;").unwrap();
        assert_eq!(c.query_row("SELECT count(*) FROM sqlite_temp_master WHERE type='trigger' AND name LIKE 'audit_no_%'",[],|r|r.get::<_,i64>(0)).unwrap(),7);
        let ids = c.prepare("SELECT id FROM corporate_action_imports WHERE review_status<>'APPROVED'
            AND approved_corporate_action_id IS NULL AND (
                (action_type='OTHER' AND upper(trim(purpose_raw)) NOT IN ('AGM','ANNUAL GENERAL MEETING'))
                OR action_type IN ('SPLIT','BONUS')
                OR message LIKE 'Quick-resolved%' OR message LIKE 'Awaiting verified historical identity evidence%'
                OR (action_type='DIVIDEND' AND (review_status IN ('UNSUPPORTED','NEEDS_REVIEW') OR instr(purpose_raw,'%')>0))) ORDER BY id")
            .unwrap().query_map([],|r|r.get::<_,i64>(0)).unwrap().collect::<rusqlite::Result<Vec<_>>>().unwrap();
        let started = std::time::Instant::now();
        for (index, batch) in ids.chunks(100).enumerate() {
            run_connection_transaction(&c, |c| refresh_classifications(c, batch)).unwrap();
            if index % 10 == 0 {
                println!(
                    "CLASSIFICATION_AUDIT checked={} total={} seconds={:.2}",
                    (index + 1) * 100,
                    ids.len(),
                    started.elapsed().as_secs_f64()
                );
            }
        }
        assert_eq!(
            before,
            super::super::real_data_performance_tests::protected_state(&c)
        );
        let changed_source: i64 = c.query_row("SELECT count(*) FROM (SELECT * FROM audit_original_evidence EXCEPT SELECT * FROM corporate_action_import_evidence)",[],|r|r.get(0)).unwrap();
        assert_eq!(
            changed_source, 0,
            "Original official source captures must remain byte-for-byte unchanged"
        );
        let changed: i64 = c.query_row("SELECT count(*) FROM corporate_action_import_decisions WHERE decision_type='CLASSIFICATION_REFRESH'",[],|r|r.get(0)).unwrap();
        let mut statement = c.prepare("SELECT action_type,review_status,count(*) FROM corporate_action_imports WHERE review_status<>'APPROVED' GROUP BY 1,2 ORDER BY 1,2").unwrap();
        let distribution = statement
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        let pending: i64 = c.query_row("SELECT count(*) FROM corporate_action_imports WHERE approved_corporate_action_id IS NULL AND review_status<>'APPROVED'",[],|r|r.get(0)).unwrap();
        let decisions: i64 = c.query_row("SELECT count(*) FROM corporate_action_import_decisions WHERE decision_type='IDENTITY_PROOF_RECHECK'",[],|r|r.get(0)).unwrap();
        let result = serde_json::json!({"checked":ids.len(),"classification_decisions":changed,"seconds":started.elapsed().as_secs_f64(),
            "new_pending_components":pending-original_pending,"unproven_machine_resolutions_revoked":decisions-original_decisions,
            "pending_distribution":distribution,"financial_state_unchanged":true,"official_evidence_unchanged":true,
            "note":"Broader diagnostic reparse scope includes non-AGM Other notices; these counts are not approval readiness."});
        fs::write(output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
        println!("CLASSIFICATION_AUDIT PASS {result}");
    }

    fn fixture() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO instruments(symbol,exchange,isin,name,is_active)
            VALUES ('TEST','NSE','INE000A01001','Test',1)",
                [],
            )
            .unwrap();
        for table in ["corporate_actions", "eod_prices"] {
            for operation in ["INSERT", "UPDATE", "DELETE"] {
                connection.execute_batch(&format!("CREATE TEMP TRIGGER no_{table}_{operation}
                    BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT,'financial write forbidden'); END;")).unwrap();
            }
        }
        connection
    }

    #[test]
    #[ignore = "Explicit guarded database-copy audit using a fresh retained official BSE master capture"]
    fn bse_security_code_disposable_copy_audit() {
        use sha2::{Digest, Sha256};
        let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .canonicalize()
            .unwrap();
        let folder = std::path::PathBuf::from(std::env::var("CA_BSE_MAPPING_AUDIT").unwrap())
            .canonicalize()
            .unwrap();
        assert_eq!(
            folder.parent().unwrap(),
            repo.join("tmp").canonicalize().unwrap()
        );
        assert!(matches!(
            folder.file_name().unwrap().to_str().unwrap(),
            "ca-bse-code-mapping-20261024" | "ca-bse-code-mapping-20261024-r2"
        ));
        assert_eq!(
            fs::read_to_string(folder.join("AUDIT.txt")).unwrap().trim(),
            "CA_BSE_SECURITY_CODE_COPY_ONLY"
        );
        let capture = std::path::PathBuf::from(std::env::var("CA_BSE_MASTER_CAPTURE").unwrap())
            .canonicalize()
            .unwrap();
        assert!(capture.starts_with(repo.join("outputs").canonicalize().unwrap()));
        assert_eq!(capture.extension().unwrap(), "csv");
        let manifest: Value =
            serde_json::from_slice(&fs::read(capture.with_extension("manifest.json")).unwrap())
                .unwrap();
        let bytes = fs::read(&capture).unwrap();
        assert_eq!(manifest["source"], "BSE_IDENTITY_MASTER");
        assert_eq!(manifest["httpStatus"], 200);
        assert_eq!(manifest["sha256"], format!("{:x}", Sha256::digest(&bytes)));
        let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
        let tables: Vec<String> = c
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for (index, table) in tables.iter().enumerate() {
            for operation in ["INSERT", "UPDATE", "DELETE"] {
                if (table == "instruments" || table == "corporate_action_imports")
                    && operation == "UPDATE"
                    || table == "corporate_action_import_decisions" && operation == "INSERT"
                {
                    continue;
                }
                c.execute_batch(&format!(
                    "CREATE TEMP TRIGGER guard_{index}_{operation} BEFORE {operation} ON \"{}\"
                    BEGIN SELECT RAISE(ABORT,'copy audit forbids unrelated writes'); END;",
                    table.replace('"', "\"\"")
                ))
                .unwrap();
            }
        }
        c.execute_batch("CREATE TEMP TRIGGER guard_instrument_fields BEFORE UPDATE ON instruments
            WHEN NEW.symbol IS NOT OLD.symbol OR NEW.exchange IS NOT OLD.exchange OR NEW.isin IS NOT OLD.isin
            OR NEW.name IS NOT OLD.name OR NEW.series IS NOT OLD.series OR NEW.is_active IS NOT OLD.is_active
            OR NEW.lifecycle_status IS NOT OLD.lifecycle_status OR NEW.updated_at IS NOT OLD.updated_at
            OR NOT (OLD.bse_security_code IS NULL OR trim(OLD.bse_security_code)='')
            BEGIN SELECT RAISE(ABORT,'instrument identity/lifecycle mutation forbidden'); END;
            CREATE TEMP TRIGGER guard_import_financial_fields BEFORE UPDATE ON corporate_action_imports
            WHEN NEW.approved_corporate_action_id IS NOT OLD.approved_corporate_action_id OR NEW.approved_at IS NOT OLD.approved_at
            OR NEW.review_status='APPROVED' OR NEW.cash_amount IS NOT OLD.cash_amount
            OR NEW.factor IS NOT OLD.factor OR NEW.price_factor IS NOT OLD.price_factor
            OR NEW.ratio_num IS NOT OLD.ratio_num OR NEW.ratio_den IS NOT OLD.ratio_den
            OR NEW.old_face_value IS NOT OLD.old_face_value OR NEW.new_face_value IS NOT OLD.new_face_value
            OR NEW.ex_date IS NOT OLD.ex_date OR NEW.purpose_raw IS NOT OLD.purpose_raw
            OR NEW.source IS NOT OLD.source OR NEW.bse_scrip_code IS NOT OLD.bse_scrip_code
            BEGIN SELECT RAISE(ABORT,'financial/source mutation forbidden'); END;").unwrap();
        let ids: Vec<i64> = c.prepare("SELECT id FROM corporate_action_imports WHERE exchange='BSE' AND source='BSE_API'
            AND symbol IS NULL AND isin IS NULL AND review_status IN ('UNRESOLVED','NEEDS_REVIEW','UNSUPPORTED') AND approved_corporate_action_id IS NULL ORDER BY id").unwrap()
            .query_map([],|r|r.get(0)).unwrap().collect::<Result<_,_>>().unwrap();
        assert!(!ids.is_empty());
        let filled = run_connection_transaction(&c, |c| {
            super::super::bse_identity_mapping::fill_missing_codes(c, &bytes)
        })
        .unwrap();
        let mut matched = 0;
        for chunk in ids.chunks(100) {
            let rows =
                run_connection_transaction(&c, |c| refresh_classifications(c, chunk)).unwrap();
            matched += rows
                .iter()
                .filter(|r| r.symbol.is_some() && r.isin.is_some())
                .count();
        }
        let report = serde_json::json!({"database":"guarded disposable copy", "officialMaster":capture,
            "instrumentCodesFilled":filled,"unmatchedBefore":ids.len(),"matchedAfter":matched,
            "unmatchedAfter":ids.len()-matched,"financialAndSourceGuards":true});
        let output = folder.join("results.json");
        assert!(!output.exists());
        fs::write(output, serde_json::to_vec_pretty(&report).unwrap()).unwrap();
        println!("BSE_COPY_AUDIT PASS {report}");
    }

    fn insert(
        connection: &Connection,
        id: i64,
        action: &str,
        status: &str,
        purpose: &str,
        cash: Option<f64>,
    ) {
        connection.execute("INSERT INTO corporate_action_imports
            (id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status,cash_amount)
            VALUES (?,?,'NSE','NSE_API','TEST','INE000A01001','Test',?,'2026-08-20',?,'PARSED',?,?)",
            params![id,format!("key-{id}"),purpose,action,status,cash]).unwrap();
    }

    #[test]
    fn bse_code_refresh_retries_unmatched_without_approval_or_source_evidence_changes() {
        let c = fixture();
        c.execute(
            "INSERT INTO instruments(symbol,exchange,isin,bse_security_code,name,is_active)
            VALUES('GPTHEALTH','BSE','INE486R01017','544131','GPT Healthcare Ltd',1)",
            [],
        )
        .unwrap();
        for id in 1..=5 {
            insert(
                &c,
                id,
                "DIVIDEND",
                "UNRESOLVED",
                "Dividend - Rs 1.5 Per Share",
                Some(1.5),
            );
            c.execute("UPDATE corporate_action_imports SET exchange='BSE',source='BSE_API',symbol=NULL,isin=NULL,bse_scrip_code='544131' WHERE id=?",[id]).unwrap();
            if id != 5 {
                c.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference) VALUES(?,'BSE_API','retained original')",[id]).unwrap();
            }
        }
        c.execute(
            "UPDATE corporate_action_imports SET review_status='APPROVED' WHERE id=2",
            [],
        )
        .unwrap();
        c.execute("UPDATE corporate_action_imports SET message='Manually resolved by operator' WHERE id=3",[]).unwrap();
        c.execute(
            "UPDATE corporate_action_imports SET bse_scrip_code='999999' WHERE id=4",
            [],
        )
        .unwrap();
        run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2, 3, 4, 5])).unwrap();
        let matched = get_import_row(&c, 1).unwrap();
        assert_eq!(matched.symbol.as_deref(), Some("GPTHEALTH"));
        assert_eq!(matched.isin.as_deref(), Some("INE486R01017"));
        assert_eq!(matched.review_status, "PENDING");
        assert!(matched.approved_corporate_action_id.is_none());
        assert_eq!(matched.cash_amount, Some(1.5));
        for id in 2..=5 {
            assert!(get_import_row(&c, id).unwrap().symbol.is_none());
        }
        run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2, 3, 4, 5])).unwrap();
        assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_import_decisions WHERE decision_type='BSE_SECURITY_CODE_RESOLUTION'",[],|r|r.get::<_,i64>(0)).unwrap(),1);
        assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_import_evidence WHERE raw_reference='retained original' AND isin_seen IS NULL",[],|r|r.get::<_,i64>(0)).unwrap(),4);
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn bse_identity_retry_preserves_unsupported_type_and_incomplete_terms_blocks() {
        let c = fixture();
        c.execute(
            "INSERT INTO instruments(symbol,exchange,isin,bse_security_code,name,is_active)
            VALUES('GPTHEALTH','BSE','INE486R01017','544131','GPT Healthcare Ltd',1)",
            [],
        )
        .unwrap();
        for (id, action, status, purpose) in [
            (1, "RIGHTS", "NEEDS_REVIEW", "Rights issue of equity shares"),
            (2, "OTHER", "UNSUPPORTED", "Distribution of income"),
        ] {
            insert(&c, id, action, status, purpose, None);
            c.execute("UPDATE corporate_action_imports SET exchange='BSE',source='BSE_API',symbol=NULL,isin=NULL,
                bse_scrip_code='544131',parse_status='NEEDS_REVIEW' WHERE id=?",[id]).unwrap();
            c.execute(
                "INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference)
                VALUES(?,'BSE_API','retained original')",
                [id],
            )
            .unwrap();
        }
        let rows = run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2])).unwrap();
        for row in &rows {
            assert_eq!(row.symbol.as_deref(), Some("GPTHEALTH"));
            assert!(row.approved_corporate_action_id.is_none());
            assert_eq!(row.parse_status, "NEEDS_REVIEW");
        }
        assert_eq!(get_import_row(&c, 1).unwrap().review_status, "NEEDS_REVIEW");
        assert_eq!(get_import_row(&c, 2).unwrap().review_status, "UNSUPPORTED");
    }

    #[test]
    fn classification_refresh_reparses_legacy_cash_and_is_idempotent_without_financial_writes() {
        let c = fixture();
        insert(
            &c,
            1,
            "OTHER",
            "UNSUPPORTED",
            "Agm/Div-Rs.2/- Per Share",
            None,
        );
        insert(
            &c,
            2,
            "DIVIDEND",
            "UNSUPPORTED",
            "Dividend - Rs 5 Per Share",
            Some(5.0),
        );
        let result =
            run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2])).unwrap();
        assert!(result
            .iter()
            .all(|r| r.action_type == "DIVIDEND" && r.review_status == "PENDING"));
        assert_eq!(result[0].cash_amount, Some(2.0));
        assert_eq!(result[0].isin.as_deref(), Some("INE000A01001"));
        assert_eq!(result[0].purpose_raw, "Agm/Div-Rs.2/- Per Share");
        assert!(result
            .iter()
            .all(|r| r.approved_corporate_action_id.is_none() && r.factor.is_none()));
        let decisions: i64 = c
            .query_row(
                "SELECT count(*) FROM corporate_action_import_decisions",
                [],
                |r| r.get(0),
            )
            .unwrap();
        refresh_classifications(&c, &[1, 2]).unwrap();
        assert_eq!(
            decisions,
            c.query_row(
                "SELECT count(*) FROM corporate_action_import_decisions",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap()
        );
        assert_eq!(decisions, 2);
    }

    #[test]
    fn classification_refresh_keeps_agm_and_protected_rows_unchanged() {
        let c = fixture();
        insert(&c, 1, "OTHER", "UNSUPPORTED", "AGM", None);
        insert(
            &c,
            2,
            "DIVIDEND",
            "APPROVED",
            "Dividend Rs 5 Per Share",
            Some(5.0),
        );
        insert(
            &c,
            3,
            "DIVIDEND",
            "UNSUPPORTED",
            "Dividend Rs 5 Per Share",
            Some(5.0),
        );
        c.execute(
            "INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason)
            VALUES (3,'MANUAL_RESOLUTION','user decision')",
            [],
        )
        .unwrap();
        insert(
            &c,
            4,
            "DIVIDEND",
            "UNSUPPORTED",
            "Dividend Rs 5 Per Share",
            Some(5.0),
        );
        c.execute("UPDATE corporate_action_imports SET message='Manually resolved this official row' WHERE id=4",[]).unwrap();
        let before =
            serde_json::to_value(read_import_rows_by_ids(&c, &[1, 2, 3, 4]).unwrap()).unwrap();
        let after =
            serde_json::to_value(refresh_classifications(&c, &[1, 2, 3, 4]).unwrap()).unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn classification_refresh_never_interprets_percent_as_cash_or_overwrites_cash_conflicts() {
        let c = fixture();
        insert(&c, 1, "DIVIDEND", "PENDING", "Dividend - 12%", Some(12.0));
        insert(
            &c,
            2,
            "DIVIDEND",
            "UNSUPPORTED",
            "Dividend Rs 2 Per Share",
            Some(3.0),
        );
        let rows = refresh_classifications(&c, &[1, 2]).unwrap();
        assert_eq!(rows[0].cash_amount, None);
        assert_eq!(rows[0].review_status, "NEEDS_REVIEW");
        assert_eq!(rows[1].cash_amount, Some(3.0));
        assert_eq!(rows[1].review_status, "NEEDS_REVIEW");
        assert!(rows[1].message.as_deref().unwrap().contains("conflict"));
        assert_eq!(
            parse_corporate_action_purpose("Dividend 20%").cash_amount,
            None
        );
        assert_eq!(
            parse_corporate_action_purpose("Intdividend - Rs 160 Per Share").cash_amount,
            Some(160.0)
        );
        assert!(matches!(
            simple_cash_dividend_evidence::revalidate_simple_cash_dividend_evidence(
                "Intdividend - Rs 160 Per Share",
                Some(160.0)
            ),
            simple_cash_dividend_evidence::SimpleCashDividendEvidence::EligibleSimpleCash(160.0)
        ));
        assert!(matches!(
            simple_cash_dividend_evidence::revalidate_simple_cash_dividend_evidence(
                "Int Div Rs 2 Per Share Including Special Dividend Rs 1 Per Share",
                Some(2.0)
            ),
            simple_cash_dividend_evidence::SimpleCashDividendEvidence::Ineligible(_)
        ));
    }

    #[test]
    fn separate_percentage_dividend_keeps_matching_split_during_preparation() {
        let c = fixture();
        let purpose = "Fv Spl 100 To 10/Div150%";
        insert(&c, 1, "SPLIT", "PENDING", purpose, None);
        c.execute(
            "UPDATE corporate_action_imports
             SET parse_status='PARSED', old_face_value=100, new_face_value=10, factor=10, price_factor=0.1
             WHERE id=1",
            [],
        ).unwrap();
        let rows = refresh_classifications(&c, &[1]).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].purpose_raw, purpose);
        assert_eq!(rows[0].parse_status, "PARSED");
        assert_eq!(rows[0].review_status, "PENDING");
        assert_eq!(rows[0].factor, Some(10.0));
        let count: i64 = c
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn classification_refresh_demerger_requires_allocation_and_invalid_scope_is_atomic() {
        let c = fixture();
        insert(&c, 1, "OTHER", "UNSUPPORTED", "Demerger", None);
        assert!(run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 999])).is_err());
        assert_eq!(get_import_row(&c, 1).unwrap().action_type, "OTHER");
        let row = refresh_classifications(&c, &[1]).unwrap().remove(0);
        assert_eq!(row.action_type, "DEMERGER");
        assert_eq!(row.review_status, "UNSUPPORTED");
        assert_eq!(row.factor, None);
        assert_eq!(row.price_factor, None);
    }

    #[test]
    fn classification_refresh_prepares_split_bonus_once_with_original_source_capture() {
        for (purpose, expected) in [
            ("Bonus 1:2 And Face Value Split Rs.10/- To Rs.5/-",3.0),
            ("Bonus 1:2/Face Value Split (Sub-Division) From Rs 2/- Per Share To Re 1/- Per Share",3.0),
            ("Bonus 1:1/Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",10.0),
        ] {
            let c = fixture();
            insert(&c,1,"BONUS","PENDING",purpose,None);
            ensure_import_evidence(&c,1,"NSE_API",Some("official URL"),Some("2026-01-01"),
                Some("TEST"),Some("INE000A01001"),Some("Test"),Some("BONUS"),Some("2026-08-20"),None,Some("original JSON"),None).unwrap();
            assert!(split_bonus_preparation::ensure_components_prepared(&c,&get_import_row(&c,1).unwrap()).is_err());
            run_connection_transaction(&c,|c|refresh_classifications(c,&[1])).unwrap();
            let rows = read_import_rows_by_ids(&c,&[1,2]).unwrap();
            assert_eq!(rows[0].factor.unwrap()*rows[1].factor.unwrap(),expected);
            assert!(rows.iter().all(|r|r.purpose_raw==purpose && r.review_status=="PENDING" && r.approved_corporate_action_id.is_none()));
            split_bonus_preparation::ensure_components_prepared(&c,&rows[0]).unwrap();
            for candidate in load_scan_candidates(&c,Some(&[1,2])).unwrap() {
                assert_eq!(load_same_date_split_bonus_compound_context(&c,&candidate).unwrap().unwrap().combined_factor,expected);
            }
            run_connection_transaction(&c,|c|refresh_classifications(c,&[1,2])).unwrap();
            assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_imports",[],|r|r.get::<_,i64>(0)).unwrap(),2);
            assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_import_evidence WHERE raw_reference='original JSON' AND captured_at='2026-01-01'",[],|r|r.get::<_,i64>(0)).unwrap(),2);
            assert_eq!(c.query_row("SELECT count(*) FROM corporate_actions",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        }
    }

    #[test]
    fn classification_refresh_does_not_expand_missing_source_or_ambiguous_components() {
        let c = fixture();
        insert(
            &c,
            1,
            "BONUS",
            "PENDING",
            "Bonus 1:1/Face Value Split From Rs 10 To Rs 2",
            None,
        );
        let row = refresh_classifications(&c, &[1]).unwrap().remove(0);
        assert_eq!(row.parse_status, "NEEDS_REVIEW");
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_action_imports", [], |r| r
                .get::<_, i64>(
                0
            ))
            .unwrap(),
            1
        );
        assert!(split_bonus_preparation::components(
            "Bonus 1:1/Bonus 1:2/Face Value Split From Rs 10 To Rs 2"
        )
        .is_none());
        assert!(split_bonus_preparation::components(
            "Dividend Rs 2/Bonus 1:1/Face Value Split From Rs 10 To Rs 2"
        )
        .is_none());
    }
}
