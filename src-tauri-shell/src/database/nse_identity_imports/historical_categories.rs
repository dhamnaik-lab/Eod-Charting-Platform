//! Display metadata only. Never used by identity matching, routing or Apply authority.
use super::*;
use std::collections::BTreeMap;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryEvidence {
    pub category: String,
    pub evidence: String,
}

fn explicit_name(name: &str) -> Option<&'static str> {
    let name = format!(" {} ", name.to_uppercase().replace(['-', '(', ')'], " "));
    if name.contains(" ETF ") || name.contains(" EXCHANGE TRADED FUND ") {
        Some("etf")
    } else if name.contains(" MUTUAL FUND ") || name.contains(" FIXED TERM FUND ") {
        Some("mutualFund")
    } else if name.contains(" REAL ESTATE INVESTMENT TRUST ")
        || name.contains(" INFRASTRUCTURE INVESTMENT TRUST ")
    {
        Some("reitInvit")
    } else if name.contains(" SOVEREIGN GOLD BOND ") || name.contains(" DEBENTURE ") {
        Some("debt")
    } else {
        None
    }
}

pub(super) fn key(row: &NseHistoricalIdentityPreviewRow) -> String {
    [
        Some(row.source_file.as_str()),
        Some(row.change_type.as_str()),
        row.effective_date.as_deref(),
        row.old_symbol.as_deref(),
        row.new_symbol.as_deref(),
        row.current_symbol.as_deref(),
        row.old_name.as_deref(),
        row.new_name.as_deref(),
    ]
    .map(|s| s.unwrap_or_default())
    .join("\u{1f}")
}

pub(super) fn build(
    snapshot: &NseHistoricalIdentitySourceSnapshot,
    rows: &[NseHistoricalIdentityPreviewRow],
) -> BTreeMap<String, CategoryEvidence> {
    let mut names = HashMap::<String, HashSet<String>>::new();
    for row in &snapshot.name_change_rows {
        for name in [&row.old_name, &row.new_name] {
            if let Some(category) = explicit_name(name) {
                names
                    .entry(row.symbol.clone())
                    .or_default()
                    .insert(category.into());
            }
        }
    }
    let master = snapshot
        .current_universe_rows
        .iter()
        .map(|r| (r.symbol.as_str(), r))
        .collect::<HashMap<_, _>>();
    rows.iter().map(|row| {
        let direct = [row.old_name.as_deref(),row.new_name.as_deref()].into_iter().flatten().filter_map(explicit_name).collect::<HashSet<_>>();
        let target = row.new_symbol.as_deref().or(row.current_symbol.as_deref());
        let named = target.and_then(|s| names.get(s));
        let (category,evidence) = if direct.len() > 1 || named.is_some_and(|v| v.len() > 1) {
            ("unknown".to_string(),"Conflicting source-name categories; classification is unresolved.".to_string())
        } else if let Some(category) = direct.iter().next() {
            (category.to_string(),format!("Explicit category wording in this saved source row: {}",row.source_file))
        } else if let Some(category) = named.and_then(|v| v.iter().next()) {
            (category.clone(),format!("Explicit category wording for the exact symbol in saved company-name history: {}",snapshot.company_name_changes_path))
        } else if let Some(current) = target.and_then(|s| master.get(s)) {
            let category = current.company_name.as_deref().and_then(explicit_name).unwrap_or("equity");
            (category.to_string(),"Current/source category from exact membership in the saved NSE equity/SME master; not event-date identity proof.".to_string())
        } else {
            ("unknown".to_string(),"No supported category evidence in the saved sources. Symbol patterns and series alone are not used.".to_string())
        };
        (key(row),CategoryEvidence{category,evidence})
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_require_explicit_category_words_not_ticker_or_company_suffix() {
        assert_eq!(
            explicit_name("Axis Mutual Fund - Axis Sensex ETF"),
            Some("etf")
        );
        assert_eq!(
            explicit_name("Fortis Mutual Fund-Fixed Term Fund-Series 16"),
            Some("mutualFund")
        );
        assert_eq!(
            explicit_name("XYZ Real Estate Investment Trust"),
            Some("reitInvit")
        );
        assert_eq!(explicit_name("Sovereign Gold Bond 2020"), Some("debt"));
        for name in [
            "ETFCO Limited",
            "GOLDAXIS",
            "715AP37",
            "ABC Limited",
            "Equity Services Limited",
        ] {
            assert_eq!(explicit_name(name), None);
        }
    }
}
