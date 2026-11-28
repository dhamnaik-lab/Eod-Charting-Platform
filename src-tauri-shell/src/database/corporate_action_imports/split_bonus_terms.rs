//! Negative admission rules shared by parsing, pending preparation and approval.
//! These rules never establish identity, official authority or price readiness.
use super::*;

pub(super) fn blocker(purpose: &str) -> Option<(&'static str, &'static str)> {
    let normalized = normalize_text(purpose);
    let has = |marker| normalized_token_position(&normalized, marker).is_some();
    let action = if has("BONUS") {
        "BONUS"
    } else if [
        "SPLIT",
        "SUB DIVISION",
        "SUBDIVISION",
        "CONSOLIDATION",
        "CONSOLIDATE",
    ]
    .iter()
    .any(|marker| has(marker))
    {
        "SPLIT"
    } else {
        return None;
    };

    let debenture_abbreviation = normalized.split_whitespace().any(|token| {
        matches!(
            token.trim_end_matches(|ch: char| ch.is_ascii_digit()),
            "DEB" | "DEBS"
        )
    });
    let reason = if debenture_abbreviation
        || ["DEBENTURE", "DEBENTURES"].iter().any(|marker| has(marker))
    {
        Some("UNSUPPORTED_SECURITY_TYPE: Debenture terms require a separate policy; an equity Split/Bonus factor cannot be inferred.")
    } else if ["NCRPS", "CRPS", "CCPS", "OCPS", "PREFERENCE", "PREFERRED"]
        .iter()
        .any(|marker| has(marker))
    {
        Some("UNSUPPORTED_SECURITY_TYPE: Preference-share terms require a separate policy; an ordinary equity Split/Bonus factor cannot be inferred.")
    } else if has("DVR") || has("DIFFERENTIAL VOTING") {
        Some("UNSUPPORTED_SECURITY_TYPE: Differential-voting-rights distributions require a separate policy; an ordinary equity Split/Bonus factor cannot be inferred.")
    } else if [
        "CAPITAL REDUCTION",
        "REDUCTION OF CAPITAL",
        "REDUCTION OF SHARE CAPITAL",
        "REDUCTION OF EQUITY CAPITAL",
    ]
    .iter()
    .any(|marker| has(marker))
    {
        Some("UNSUPPORTED_RESTRUCTURING: Capital reduction with Split/Bonus or consolidation requires a separate policy and verified component terms.")
    } else {
        None
    };
    if let Some(reason) = reason {
        return Some((action, reason));
    }

    // Distinct ordinary components may legitimately have different ratios.
    // Each component is checked again after the existing evidenced separation.
    if compound_action_primary_type(&normalized).is_some() {
        return None;
    }
    let chars = purpose.chars().collect::<Vec<_>>();
    let mut without_ratios = chars.clone();
    let mut first_ratio = None;
    for (index, _) in chars.iter().enumerate().filter(|(_, ch)| **ch == ':') {
        let (Some(num), Some(den)) = (
            read_number_left(&chars, index),
            read_number_right(&chars, index + 1),
        ) else {
            continue;
        };
        let factor = if action == "BONUS" {
            (num + den) / den
        } else {
            num / den
        };
        if !num.is_finite()
            || !den.is_finite()
            || num <= 0.0
            || den <= 0.0
            || !factor.is_finite()
            || factor <= 0.0
            || factor == 1.0
        {
            return Some((action, "INVALID_OFFICIAL_TERMS: The entitlement ratio must be positive, finite and change the share count."));
        }
        if first_ratio.is_some_and(|first| first != (num, den)) {
            return Some((action, "AMBIGUOUS_OFFICIAL_TERMS: Multiple different entitlement ratios require authoritative clarification; the first ratio cannot be selected automatically."));
        }
        first_ratio = Some((num, den));
        let mut start = index;
        while start > 0 && chars[start - 1].is_whitespace() {
            start -= 1;
        }
        while start > 0 && (chars[start - 1].is_ascii_digit() || chars[start - 1] == '.') {
            start -= 1;
        }
        let mut end = index + 1;
        while end < chars.len() && chars[end].is_whitespace() {
            end += 1;
        }
        while end < chars.len() && (chars[end].is_ascii_digit() || chars[end] == '.') {
            end += 1;
        }
        without_ratios[start..end].fill(' ');
    }
    if action == "SPLIT" && has_explicit_split_value_context(&normalized) {
        if let Some((num, den)) = first_ratio {
            let values = extract_numbers(&without_ratios.iter().collect::<String>());
            // A ratio alone is supported. If face values are also supplied,
            // require one unambiguous pair consistent with that ratio.
            if !values.is_empty() {
                let consolidation =
                    has("CONSOLIDATION") || has("CONSOLIDATE") || has("REVERSE SPLIT");
                let ratio_factor = if consolidation && num > den {
                    den / num
                } else {
                    num / den
                };
                if values.len() != 2
                    || values.iter().any(|v| !v.is_finite() || *v <= 0.0)
                    || (values[0] / values[1] - ratio_factor).abs() > 1e-9 * ratio_factor.abs()
                {
                    return Some((action, "AMBIGUOUS_OFFICIAL_TERMS: Face values and the entitlement ratio are incomplete or inconsistent; authoritative clarification is required."));
                }
            }
        }
    }
    None
}
