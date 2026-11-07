//! Phase 3: close informational notices (AGM, book closure, e-voting...) once.
//! A closed row never changes prices, factors, `purpose_raw` or approved rows.
//! Every close and reopen is logged, and the previous status is restored on reopen.
use super::*;
use serde::{Deserialize, Serialize};

pub(super) const REVIEW_STATUS_CLOSED_INFORMATIONAL: &str = "CLOSED_INFORMATIONAL";
const CLOSE_REASON: &str = "Informational notice; no price adjustment.";
const CLOSE_MESSAGE: &str =
    "Closed automatically: informational notice, no price adjustment. Reopen from advanced tools if needed.";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionInformationalClosureInput {
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionInformationalReopenInput {
    pub import_id: i64,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionInformationalClosureResult {
    pub closed: usize,
    pub reopened: usize,
    pub total_closed: usize,
}

#[tauri::command]
pub async fn sync_corporate_action_informational_closures(
    app: AppHandle,
    input: CorporateActionInformationalClosureInput,
) -> AppResult<CorporateActionInformationalClosureResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = resolve_active_database_folder(&app)?
            .ok_or_else(|| "Open a database before closing informational notices.".to_string())?;
        verify_import_lookup_database(&folder, &input.expected_database_path)?;
        super::super::connection_registry::with_connection_for_folder(&app, &folder, false, |connection| {
            run_connection_transaction(connection, sync_informational_closures)
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn reopen_corporate_action_informational_closure(
    app: AppHandle,
    input: CorporateActionInformationalReopenInput,
) -> AppResult<CorporateActionImportRow> {
    if input.import_id <= 0 {
        return Err("Reopen requires a valid import ID.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let folder = resolve_active_database_folder(&app)?
            .ok_or_else(|| "Open a database before reopening a closed notice.".to_string())?;
        verify_import_lookup_database(&folder, &input.expected_database_path)?;
        super::super::connection_registry::with_connection_for_folder(&app, &folder, false, |connection| {
            run_connection_transaction(connection, |connection| {
                reopen_informational_closure(connection, input.import_id)
            })
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

// ---- Wording rules. Mirror of the renderer list; each rule matches the WHOLE purpose,
// so "AGM/Dividend Rs 2" or "AGM + Bonus" stay in the financial flow.

// Exact whole-purpose bodies, including spelling variants seen in official NSE/BSE rows.
const MEETING_BODIES: [&str; 23] = [
    "EXTRA GENERAL MEETING",
    "ENTRA ORDINARY GENERAL MEETING",
    "EXTRA-ORDINARY GENERAL METING",
    "EXTRA-OIRDINARY GENERAL MEETING",
    "EXTRA ORDINARY ANNUAL GENERAL MEETING",
    "ANNUALGENERAL MEETING",
    "MEETING OF EQUITY SHAREHOLDERS",
    "AGM",
    "EGM",
    "ANNUAL GENERAL MEETING",
    "EXTRAORDINARY GENERAL MEETING",
    "EXTRA ORDINARY GENERAL MEETING",
    "EXTRA ORIDINARY GENERAL MEETING",
    "EXTRA-ORDINARY GENERAL MEETING",
    "EXTRA- ORDINARY GENERAL MEETING",
    "EXTRA ANNUAL GENERAL MEETING",
    "ADJOURNED ANNUAL GENERAL MEETING",
    "ANUUAL GENERAL MEETING",
    "ANUAL GENERAL MEETING",
    "ANNUL GENERAL MEETING",
    "AANUAL GENERAL MEETING",
    "ANNUAL GENERAL MEEING",
    "ANNUAL GENERAL METEING",
];
const CLOSURE_BODIES: [&str; 2] = ["ANNUAL CLOSURE", "ANNUAL BOOK CLOSURE"];
// "REDEMPTION" alone is a bond/government-security notice; equity has no redemption.
// "-" is an official row with no purpose text and no terms.
const NOTICE_BODIES: [&str; 18] = [
    "INTEREST PAYMENT",
    "INTEREST PAYEMENT",
    "E VOTING",
    "E-VOTING",
    "EVOTING",
    "NIL",
    "BUY-BACK",
    "BUYBACK",
    "BUY BACK",
    "BUYBACK OF SHARES",
    "BUY BACK OF SHARES",
    "BUY BACK-TENDER OFFER",
    "BUYBACK-TENDER OFFER",
    "REDEMPTION",
    "ELECTION OF DIRECTORS",
    "EGM-ELECTION OF DIRECTORS",
    "UPDATION OF RECORDS",
    "-",
];
const REVISED_TOKENS: [&str; 10] =
    ["PURPOSE", "BC", "BOOK", "CLOSURE", "DATE", "DATES", "DT", "START", "END", "RECORD"];

/// Optional "(Purpose Revised)", "[Start/End Date Revised]" or "RD changed to BC" note.
fn is_revised_note(rest: &str) -> bool {
    let cleaned = rest
        .chars()
        .map(|ch| if matches!(ch, '(' | ')' | '[' | ']' | '/') { ' ' } else { ch })
        .collect::<String>();
    let words = cleaned.split_whitespace().collect::<Vec<_>>();
    if words == ["RD", "CHANGED", "TO", "BC"] {
        return true;
    }
    match words.split_last() {
        Some((last, before)) => {
            *last == "REVISED" && !before.is_empty() && before.iter().all(|word| REVISED_TOKENS.contains(word))
        }
        None => false,
    }
}

fn matches_bodies(text: &str, bodies: &[&str], allow_revised: bool) -> bool {
    bodies.iter().any(|body| {
        text.strip_prefix(body).map_or(false, |rest| {
            let rest = rest.strip_prefix('.').unwrap_or(rest);
            rest.is_empty() || (allow_revised && is_revised_note(rest))
        })
    })
}

/// "25TH AGM" -> "AGM". One to three digits, an ordinal suffix and a space.
fn strip_ordinal(text: &str) -> Option<&str> {
    let digits = text.bytes().take_while(u8::is_ascii_digit).count();
    if !(1..=3).contains(&digits) {
        return None;
    }
    let rest = &text[digits..];
    let rest = ["ST", "ND", "RD", "TH"].iter().find_map(|suffix| rest.strip_prefix(suffix))?;
    rest.strip_prefix(' ')
}

fn is_single_informational_notice(text: &str) -> bool {
    let meeting = |value: &str| matches_bodies(value, &MEETING_BODIES, true);
    meeting(text)
        || strip_ordinal(text).map_or(false, meeting)
        || matches_bodies(text, &CLOSURE_BODIES, true)
        || matches_bodies(text, &NOTICE_BODIES, true)
}

pub(super) fn is_informational_purpose(purpose: &str) -> bool {
    let text = purpose.split_whitespace().collect::<Vec<_>>().join(" ").to_uppercase();
    if is_single_informational_notice(&text) {
        return true;
    }
    // "Annual Book Closure / AGM": every part must be informational on its own,
    // so "AGM/Dividend Rs 0.50" stays in the financial flow.
    let parts = text.split('/').map(str::trim).collect::<Vec<_>>();
    parts.len() > 1 && parts.iter().all(|part| !part.is_empty() && is_single_informational_notice(part))
}

// ---- Database work. Callers own the transaction.

struct ClosureCandidate {
    id: i64,
    action_type: String,
    purpose_raw: String,
    review_status: String,
    message: Option<String>,
    approved_corporate_action_id: Option<i64>,
    has_financial_terms: bool,
}

impl ClosureCandidate {
    fn qualifies(&self) -> bool {
        self.action_type == "OTHER"
            && self.review_status != "APPROVED"
            && self.approved_corporate_action_id.is_none()
            && !self.has_financial_terms
            && is_informational_purpose(&self.purpose_raw)
    }
}

fn ensure_closure_table(connection: &Connection) -> AppResult<()> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS corporate_action_import_closures (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              import_id INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
              action TEXT NOT NULL CHECK (action IN ('CLOSE', 'REOPEN_AUTO', 'REOPEN_MANUAL')),
              previous_review_status TEXT NOT NULL,
              previous_message TEXT,
              new_review_status TEXT NOT NULL,
              reason TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_corporate_action_import_closures_import
              ON corporate_action_import_closures(import_id, id);
            ",
        )
        .map_err(|error| error.to_string())
}

fn read_candidates(connection: &Connection, where_clause: &str) -> AppResult<Vec<ClosureCandidate>> {
    let sql = format!(
        "SELECT id, action_type, purpose_raw, review_status, message, approved_corporate_action_id,
                (cash_amount IS NOT NULL OR factor IS NOT NULL OR price_factor IS NOT NULL
                 OR ratio_num IS NOT NULL OR ratio_den IS NOT NULL
                 OR old_face_value IS NOT NULL OR new_face_value IS NOT NULL)
           FROM corporate_action_imports WHERE {where_clause} ORDER BY id"
    );
    let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([REVIEW_STATUS_CLOSED_INFORMATIONAL], |row| {
            Ok(ClosureCandidate {
                id: row.get(0)?,
                action_type: row.get(1)?,
                purpose_raw: row.get(2)?,
                review_status: row.get(3)?,
                message: row.get(4)?,
                approved_corporate_action_id: row.get(5)?,
                has_financial_terms: row.get::<_, i64>(6)? != 0,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn log_closure(
    connection: &Connection,
    import_id: i64,
    action: &str,
    previous_status: &str,
    previous_message: Option<&str>,
    new_status: &str,
    reason: &str,
) -> AppResult<()> {
    connection
        .execute(
            "INSERT INTO corporate_action_import_closures
               (import_id, action, previous_review_status, previous_message, new_review_status, reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![import_id, action, previous_status, previous_message, new_status, reason, now_iso()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// Status change guarded by the status the caller read, so a concurrent change fails closed.
fn set_status(
    connection: &Connection,
    import_id: i64,
    from_status: &str,
    to_status: &str,
    message: Option<&str>,
) -> AppResult<()> {
    let changed = connection
        .execute(
            "UPDATE corporate_action_imports SET review_status = ?, message = ?
              WHERE id = ? AND review_status = ? AND approved_corporate_action_id IS NULL",
            params![to_status, message, import_id, from_status],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err(format!("STATE_CHANGED: import {import_id} changed while its closure was updated."));
    }
    Ok(())
}

fn restore_closed_row(connection: &Connection, import_id: i64, action: &str, reason: &str) -> AppResult<()> {
    let previous = connection
        .query_row(
            "SELECT previous_review_status, previous_message FROM corporate_action_import_closures
              WHERE import_id = ? AND action = 'CLOSE' ORDER BY id DESC LIMIT 1",
            [import_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let (status, message) = match previous {
        Some((status, message))
            if status != "APPROVED" && status != REVIEW_STATUS_CLOSED_INFORMATIONAL =>
        {
            (status, message)
        }
        _ => ("UNSUPPORTED".to_string(), None),
    };
    set_status(connection, import_id, REVIEW_STATUS_CLOSED_INFORMATIONAL, &status, message.as_deref())?;
    log_closure(
        connection,
        import_id,
        action,
        REVIEW_STATUS_CLOSED_INFORMATIONAL,
        Some(CLOSE_MESSAGE),
        &status,
        reason,
    )
}

pub(super) fn sync_informational_closures(
    connection: &Connection,
) -> AppResult<CorporateActionInformationalClosureResult> {
    ensure_closure_table(connection)?;
    let mut result = CorporateActionInformationalClosureResult::default();

    // 1. A closed row that no longer qualifies (new terms, new wording rule) reopens itself.
    for row in read_candidates(connection, "review_status = ?1")? {
        if !row.qualifies() {
            restore_closed_row(
                connection,
                row.id,
                "REOPEN_AUTO",
                "No longer an informational notice under the current rules.",
            )?;
            result.reopened += 1;
        }
    }

    // 2. Close new informational rows. A row the operator reopened stays open.
    let manually_reopened = {
        let mut statement = connection
            .prepare(
                "SELECT c.import_id FROM corporate_action_import_closures c
                  WHERE c.action = 'REOPEN_MANUAL'
                    AND c.id = (SELECT MAX(id) FROM corporate_action_import_closures WHERE import_id = c.import_id)",
            )
            .map_err(|error| error.to_string())?;
        let ids = statement
            .query_map([], |row| row.get::<_, i64>(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<HashSet<_>, _>>()
            .map_err(|error| error.to_string())?;
        ids
    };
    let open_rows = read_candidates(
        connection,
        "action_type = 'OTHER' AND review_status NOT IN ('APPROVED', ?1) AND approved_corporate_action_id IS NULL",
    )?;
    for row in open_rows {
        if !row.qualifies() || manually_reopened.contains(&row.id) {
            continue;
        }
        set_status(
            connection,
            row.id,
            &row.review_status,
            REVIEW_STATUS_CLOSED_INFORMATIONAL,
            Some(CLOSE_MESSAGE),
        )?;
        log_closure(
            connection,
            row.id,
            "CLOSE",
            &row.review_status,
            row.message.as_deref(),
            REVIEW_STATUS_CLOSED_INFORMATIONAL,
            CLOSE_REASON,
        )?;
        result.closed += 1;
    }

    result.total_closed = connection
        .query_row(
            "SELECT COUNT(*) FROM corporate_action_imports WHERE review_status = ?",
            [REVIEW_STATUS_CLOSED_INFORMATIONAL],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())? as usize;
    Ok(result)
}

pub(super) fn reopen_informational_closure(
    connection: &Connection,
    import_id: i64,
) -> AppResult<CorporateActionImportRow> {
    ensure_closure_table(connection)?;
    let current = get_import_row(connection, import_id)?;
    if current.review_status != REVIEW_STATUS_CLOSED_INFORMATIONAL {
        return Err(format!("Import {import_id} is not a closed informational notice."));
    }
    restore_closed_row(connection, import_id, "REOPEN_MANUAL", "Reopened by the operator.")?;
    get_import_row(connection, import_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;

    fn fixture() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        prepare_database_connection(&c).unwrap();
        c
    }

    fn insert(c: &Connection, id: i64, purpose: &str, action: &str, status: &str, factor: Option<f64>) {
        c.execute(
            "INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,purpose_raw,ex_date,
                action_type,factor,parse_status,review_status,message)
             VALUES (?,?,'NSE','NSE_API','INFOCO',?,'2024-07-01',?,?,'NEEDS_REVIEW',?,'old message')",
            params![id, format!("info-{id}"), purpose, action, factor, status],
        )
        .unwrap();
    }

    fn status(c: &Connection, id: i64) -> (String, Option<String>, String) {
        c.query_row(
            "SELECT review_status, message, purpose_raw FROM corporate_action_imports WHERE id=?",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap()
    }

    #[test]
    fn ca_phase3_informational_wording_matches_whole_notice_only() {
        for purpose in [
            "EXTRA GENERAL MEETING",
    "ENTRA ORDINARY GENERAL MEETING",
    "EXTRA-ORDINARY GENERAL METING",
    "EXTRA-OIRDINARY GENERAL MEETING",
    "EXTRA ORDINARY ANNUAL GENERAL MEETING",
    "ANNUALGENERAL MEETING",
    "MEETING OF EQUITY SHAREHOLDERS",
    "Extra General Meeting", "Entra Ordinary General Meeting", "Extra-Ordinary General Meting", "Extra-Oirdinary General Meeting", "Extra Ordinary Annual General Meeting", "Annualgeneral Meeting", "Meeting Of Equity Shareholders", "Buy-Back",
            "AGM", "agm.", "25th  AGM", "Annual General Meeting (Purpose Revised)", "EGM",
            "Extra Oridinary General Meeting",
            "Extra-Ordinary General Meeting", "Annual Book Closure", "Annual Closure (BC Dates Revised)",
            "E-Voting", "Interest Payment", "Nil", "Buy Back Of Shares", "Buyback",
            // Step 1 wording seen in official rows.
            "Extra- Ordinary General Meeting", "Extra Annual General Meeting", "Anuual General Meeting",
            "Adjourned Annual General Meeting", "AGM BC Start Date/Purpose Revised", "AGM [End Date Revised]",
            "AGM BC Start Dt Revised", "AGM (Start/End Date Revised)", "AGM RD Changed To BC",
            "Nil BC Dates Revised", "Annual Book Closure / Annual General Meeting", "Interest Payment/Buyback",
            "Redemption", "-", "EGM-Election Of Directors", "Buy Back-Tender Offer", "Updation Of Records",
        ] {
            assert!(is_informational_purpose(purpose), "{purpose}");
        }
        for purpose in [
            "Annual General Meeting/ Change In Register", "Buy-Back Rs 2", "Meeting Of Equity Shareholders/Dividend Rs 2",
            "", "AGM/Dividend - Rs 2 Per Share", "AGM And Bonus 1:1", "AGM Revised", "Spl Div",
            "Bonus 1:1", "Fv Splt Frm Rs 10 To Re 1", "1234TH AGM", "Interest Payment And Redemption",
            "Aanual General Meeting/ Diviednd Rs 0.50 Per Share", "Interest Payment - Rs 5.659 Per Unit",
            "Annual General Meetingdividend - Rs 2.5 Per Share", "Income Distribution (InvIT)",
            "Capital Reduction", "Resolution Plan -Suspension", "AGM/", "- Rs 5", "Redemption Of Preference Shares",
        ] {
            assert!(!is_informational_purpose(purpose), "{purpose}");
        }
    }

    #[test]
    fn ca_phase3_sync_closes_only_informational_rows_and_logs_them() {
        let c = fixture();
        insert(&c, 1, "AGM", "OTHER", "UNSUPPORTED", None);
        insert(&c, 2, "AGM/Dividend - Rs 2 Per Share", "OTHER", "UNSUPPORTED", None);
        insert(&c, 3, "Nil", "OTHER", "UNSUPPORTED", Some(2.0));
        insert(&c, 4, "AGM", "OTHER", "APPROVED", None);
        insert(&c, 5, "Bonus 1:1", "BONUS", "PENDING", Some(2.0));
        insert(&c, 6, "E-Voting", "OTHER", "UNRESOLVED", None);

        let first = run_connection_transaction(&c, sync_informational_closures).unwrap();
        assert_eq!(first, CorporateActionInformationalClosureResult { closed: 2, reopened: 0, total_closed: 2 });
        assert_eq!(status(&c, 1).0, REVIEW_STATUS_CLOSED_INFORMATIONAL);
        assert_eq!(status(&c, 1).2, "AGM", "purpose_raw is never changed");
        assert_eq!(status(&c, 6).0, REVIEW_STATUS_CLOSED_INFORMATIONAL);
        for (id, expected) in [(2, "UNSUPPORTED"), (3, "UNSUPPORTED"), (4, "APPROVED"), (5, "PENDING")] {
            assert_eq!(status(&c, id).0, expected, "row {id}");
        }
        let logged: i64 = c
            .query_row("SELECT COUNT(*) FROM corporate_action_import_closures WHERE action='CLOSE'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(logged, 2);
        assert_eq!(c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r.get::<_, i64>(0)).unwrap(), 0);

        let second = run_connection_transaction(&c, sync_informational_closures).unwrap();
        assert_eq!(second, CorporateActionInformationalClosureResult { closed: 0, reopened: 0, total_closed: 2 });
    }

    #[test]
    fn ca_phase3_closed_row_reopens_itself_when_terms_appear() {
        let c = fixture();
        insert(&c, 1, "AGM", "OTHER", "UNRESOLVED", None);
        run_connection_transaction(&c, sync_informational_closures).unwrap();
        c.execute("UPDATE corporate_action_imports SET factor=2.0 WHERE id=1", []).unwrap();
        let result = run_connection_transaction(&c, sync_informational_closures).unwrap();
        assert_eq!(result, CorporateActionInformationalClosureResult { closed: 0, reopened: 1, total_closed: 0 });
        let (review, message, _) = status(&c, 1);
        assert_eq!(review, "UNRESOLVED", "previous status restored");
        assert_eq!(message.as_deref(), Some("old message"));
    }

    #[test]
    fn ca_phase3_manual_reopen_is_kept_and_pending_list_hides_closed_rows() {
        let c = fixture();
        insert(&c, 1, "AGM", "OTHER", "UNSUPPORTED", None);
        insert(&c, 2, "EGM", "OTHER", "UNSUPPORTED", None);
        run_connection_transaction(&c, sync_informational_closures).unwrap();

        let pending = list_import_rows(
            &c,
            Some(&CorporateActionImportListInput {
                review_status: None, action_types: None, search_query: None,
                exclude_approved: Some(true), limit: Some(50), offset: None,
            }),
        )
        .unwrap();
        assert!(pending.is_empty(), "closed rows are not pending");

        let reopened = run_connection_transaction(&c, |c| reopen_informational_closure(c, 1)).unwrap();
        assert_eq!(reopened.review_status, "UNSUPPORTED");
        assert!(run_connection_transaction(&c, |c| reopen_informational_closure(c, 1)).is_err());
        let result = run_connection_transaction(&c, sync_informational_closures).unwrap();
        assert_eq!(result, CorporateActionInformationalClosureResult { closed: 0, reopened: 0, total_closed: 1 });
        assert_eq!(status(&c, 1).0, "UNSUPPORTED", "operator reopen is not undone");
    }
}
