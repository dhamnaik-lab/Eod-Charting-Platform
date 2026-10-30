//! Reconcile official I4 components before the general identity writer resolves
//! chart state. This never repairs stored chronology or creates identity evidence.
use super::*;

fn equal_present(left: &Option<String>, right: &Option<String>) -> bool {
    matches!((left, right), (Some(a), Some(b)) if !a.trim().is_empty() && a.trim() == b.trim())
}

fn name_scope_reaches(
    connection: &Connection,
    start: &str,
    target: &str,
    event_date: &str,
) -> AppResult<bool> {
    let mut at = start.to_string();
    let mut previous = event_date.to_string();
    let mut visited = HashSet::from([at.clone()]);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    for _ in 0..32 {
        if at == target {
            return Ok(true);
        }
        let mut statement = connection
            .prepare(
                "SELECT DISTINCT new_symbol,effective_date FROM instrument_identity_history
             WHERE exchange='NSE' AND old_symbol=? AND change_type IN ('SYMBOL_CHANGE','BOTH')",
            )
            .map_err(|e| e.to_string())?;
        let edges = statement
            .query_map(params![at], |r| {
                Ok((r.get::<_, Option<String>>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        if edges.len() != 1 {
            return Ok(false);
        }
        let (Some(next), date) = &edges[0] else {
            return Ok(false);
        };
        if NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err()
            || date <= &previous
            || date > &today
            || !visited.insert(next.clone())
        {
            return Ok(false);
        }
        at = next.clone();
        previous = date.clone();
        if at == target {
            return Ok(true);
        }
    }
    Ok(false)
}

pub(super) fn reconcile(
    connection: &Connection,
    payload: &mut CorporateActionInputPayload,
) -> AppResult<Option<HistoricalIdentityPayloadOutcome>> {
    if payload.exchange != NSE_EXCHANGE
        || !matches!(
            payload.action_type.as_str(),
            "SYMBOL_CHANGE" | "NAME_CHANGE" | "BOTH"
        )
    {
        return Ok(None);
    }
    let symbol_noop = equal_present(&payload.old_symbol, &payload.new_symbol);
    let name_noop = equal_present(&payload.old_name, &payload.new_name);
    match payload.action_type.as_str() {
        "SYMBOL_CHANGE" if symbol_noop => return Ok(Some(HistoricalIdentityPayloadOutcome::Skipped(
            "Official source has identical old/new symbols; no identity transition was recorded.".into()))),
        "NAME_CHANGE" if name_noop => return Ok(Some(HistoricalIdentityPayloadOutcome::Skipped(
            "Official source has identical old/new names; no identity transition was recorded.".into()))),
        "BOTH" if symbol_noop && name_noop => return Ok(Some(HistoricalIdentityPayloadOutcome::Skipped(
            "Official source has no changed identity component; no transition was recorded.".into()))),
        "BOTH" if symbol_noop => payload.action_type = "NAME_CHANGE".into(),
        "BOTH" if name_noop => payload.action_type = "SYMBOL_CHANGE".into(),
        _ => {}
    }
    let needs_symbol = matches!(payload.action_type.as_str(), "SYMBOL_CHANGE" | "BOTH");
    let needs_name = matches!(payload.action_type.as_str(), "NAME_CHANGE" | "BOTH");
    if payload.exchange != NSE_EXCHANGE
        || NaiveDate::parse_from_str(&payload.effective_date, "%Y-%m-%d").is_err()
    {
        return Ok(None);
    }
    let mut symbol_covered = !needs_symbol;
    let mut name_covered = !needs_name;
    let mut statement = connection
        .prepare(
            "SELECT change_type,old_symbol,new_symbol,current_symbol,old_name,new_name
         FROM instrument_identity_history WHERE exchange='NSE' AND effective_date=?",
        )
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![payload.effective_date], |r| {
            Ok((
                r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                r.get::<_, Option<String>>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let requested = payload
        .new_symbol
        .as_ref()
        .or(payload.current_symbol.as_ref())
        .or(payload.symbol.as_ref());
    for (kind, old, new, current, old_name, new_name) in rows {
        if needs_symbol
            && matches!(kind.as_str(), "SYMBOL_CHANGE" | "BOTH")
            && equal_present(&old, &payload.old_symbol)
            && equal_present(&new, &payload.new_symbol)
        {
            symbol_covered = true;
        }
        if needs_name
            && matches!(kind.as_str(), "NAME_CHANGE" | "BOTH")
            && equal_present(&old_name, &payload.old_name)
            && equal_present(&new_name, &payload.new_name)
        {
            if let Some(target) = requested {
                let direct = [&old, &new, &current]
                    .iter()
                    .any(|s| s.as_deref() == Some(target.as_str()));
                let through_dated_chain = if !direct {
                    if let Some(start) = new.as_ref().or(current.as_ref()) {
                        name_scope_reaches(connection, start, target, &payload.effective_date)?
                    } else {
                        false
                    }
                } else {
                    false
                };
                if direct || through_dated_chain {
                    name_covered = true;
                }
            }
        }
    }
    if symbol_covered && name_covered {
        return Ok(Some(HistoricalIdentityPayloadOutcome::Duplicate));
    }
    // Preserve a missing component without inserting a second representation of
    // an already-persisted symbol edge or company-name event.
    if payload.action_type == "BOTH" {
        if symbol_covered {
            payload.action_type = "NAME_CHANGE".into();
            payload.old_symbol = payload.new_symbol.clone();
        } else if name_covered {
            payload.action_type = "SYMBOL_CHANGE".into();
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn database() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instrument_identity_history (
          change_type TEXT,old_symbol TEXT,new_symbol TEXT,current_symbol TEXT,old_name TEXT,new_name TEXT,effective_date TEXT,exchange TEXT
        )").unwrap();
        c
    }
    fn payload(kind: &str) -> CorporateActionInputPayload {
        serde_json::from_value(serde_json::json!({"actionType":kind,"exchange":"NSE","effectiveDate":"2020-01-01",
          "oldSymbol":"OLD","newSymbol":"NEW","currentSymbol":"NEW","oldName":"Before","newName":"After"})).unwrap()
    }
    fn insert(c: &Connection, kind: &str, old: &str, new: &str, date: &str) {
        c.execute(
            "INSERT INTO instrument_identity_history VALUES(?,?,?,?,'Before','After',?,'NSE')",
            params![kind, old, new, new, date],
        )
        .unwrap();
    }
    #[test]
    fn source_noops_are_skipped_but_changed_combined_components_are_retained() {
        let c = database();
        let before: i64 = c
            .query_row("SELECT total_changes()", [], |r| r.get(0))
            .unwrap();
        let mut p = payload("SYMBOL_CHANGE");
        p.old_symbol = p.new_symbol.clone();
        assert!(matches!(
            reconcile(&c, &mut p).unwrap(),
            Some(HistoricalIdentityPayloadOutcome::Skipped(_))
        ));
        let mut p = payload("NAME_CHANGE");
        p.old_name = p.new_name.clone();
        assert!(matches!(
            reconcile(&c, &mut p).unwrap(),
            Some(HistoricalIdentityPayloadOutcome::Skipped(_))
        ));
        let mut p = payload("BOTH");
        p.old_symbol = p.new_symbol.clone();
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        assert_eq!(p.action_type, "NAME_CHANGE");
        let mut p = payload("BOTH");
        p.old_name = p.new_name.clone();
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        assert_eq!(p.action_type, "SYMBOL_CHANGE");
        assert_eq!(
            before,
            c.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
                .unwrap()
        );
    }
    #[test]
    fn persisted_combined_event_covers_its_symbol_and_name_components() {
        let c = database();
        insert(&c, "BOTH", "OLD", "NEW", "2020-01-01");
        for kind in ["SYMBOL_CHANGE", "NAME_CHANGE", "BOTH"] {
            let mut p = payload(kind);
            assert!(matches!(
                reconcile(&c, &mut p).unwrap(),
                Some(HistoricalIdentityPayloadOutcome::Duplicate)
            ));
        }
    }
    #[test]
    fn combined_event_preserves_only_missing_name_component() {
        let c = database();
        insert(&c, "SYMBOL_CHANGE", "OLD", "NEW", "2020-01-01");
        let mut p = payload("BOTH");
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        assert_eq!(p.action_type, "NAME_CHANGE");
        assert_eq!(p.old_symbol, p.new_symbol);
        insert(&c, "NAME_CHANGE", "NEW", "NEW", "2020-01-01");
        assert!(matches!(
            reconcile(&c, &mut payload("BOTH")).unwrap(),
            Some(HistoricalIdentityPayloadOutcome::Duplicate)
        ));
    }
    #[test]
    fn name_equivalence_requires_symbol_scope_or_unique_strictly_dated_path() {
        let c = database();
        insert(&c, "BOTH", "OLD", "MID", "2020-01-01");
        let mut p = payload("NAME_CHANGE");
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        insert(&c, "SYMBOL_CHANGE", "MID", "NEW", "2021-01-01");
        assert!(matches!(
            reconcile(&c, &mut p).unwrap(),
            Some(HistoricalIdentityPayloadOutcome::Duplicate)
        ));
        insert(&c, "SYMBOL_CHANGE", "MID", "OTHER", "2022-01-01");
        assert!(reconcile(&c, &mut p).unwrap().is_none());
    }
    #[test]
    fn same_day_path_is_not_used_as_chronological_duplicate_proof() {
        let c = database();
        insert(&c, "BOTH", "OLD", "MID", "2020-01-01");
        insert(&c, "SYMBOL_CHANGE", "MID", "NEW", "2020-01-01");
        assert!(reconcile(&c, &mut payload("NAME_CHANGE"))
            .unwrap()
            .is_none());
        // Exact existing components can be recognized without traversing or
        // altering that invalid chain. General chart chronology stays strict.
        let mut p = payload("BOTH");
        p.old_symbol = Some("MID".into());
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        insert(&c, "BOTH", "MID", "NEW", "2020-01-01");
        let mut exact = payload("BOTH");
        exact.old_symbol = Some("MID".into());
        assert!(matches!(
            reconcile(&c, &mut exact).unwrap(),
            Some(HistoricalIdentityPayloadOutcome::Duplicate)
        ));
    }

    #[test]
    fn different_dates_missing_values_and_unrelated_names_are_not_duplicates() {
        let c = database();
        insert(&c, "BOTH", "OLD", "NEW", "2019-01-01");
        assert!(reconcile(&c, &mut payload("BOTH")).unwrap().is_none());
        insert(&c, "BOTH", "OTHER", "UNRELATED", "2020-01-01");
        assert!(reconcile(&c, &mut payload("NAME_CHANGE"))
            .unwrap()
            .is_none());
        let mut malformed = payload("SYMBOL_CHANGE");
        malformed.old_symbol = None;
        malformed.new_symbol = None;
        assert!(reconcile(&c, &mut malformed).unwrap().is_none());
        let mut changed_names = payload("BOTH");
        changed_names.old_name = Some("Different before".into());
        insert(&c, "BOTH", "OLD", "NEW", "2020-01-01");
        assert!(reconcile(&c, &mut changed_names).unwrap().is_none());
        assert_eq!(changed_names.action_type, "NAME_CHANGE");
    }

    #[test]
    fn source_name_component_does_not_hide_a_new_symbol_edge() {
        let c = database();
        insert(&c, "NAME_CHANGE", "NEW", "NEW", "2020-01-01");
        let mut p = payload("BOTH");
        assert!(reconcile(&c, &mut p).unwrap().is_none());
        assert_eq!(p.action_type, "SYMBOL_CHANGE");
    }

    #[test]
    fn legacy_null_change_type_is_not_accepted_as_component_evidence() {
        let c = database();
        c.execute_batch("INSERT INTO instrument_identity_history VALUES(NULL,'OLD','NEW','NEW','Before','After','2020-01-01','NSE')").unwrap();
        assert!(reconcile(&c, &mut payload("BOTH")).unwrap().is_none());
    }
}
