//! Pure evidence classification only; not an autonomous approval decision.
//!
//! This module has no callers in Prepare, the writer, or auto_approval.rs. A later
//! policy must separately establish NSE/source/identity/PENDING/event-date and
//! same-date-peer authority, and previous-close viability before any write.

use super::{
    compound_action_primary_type, contains_inclusive_dividend_total,
    looks_like_unit_distribution, normalize_text, normalized_dividend_marker_count,
    normalized_token_position, parse_corporate_action_purpose, positive_number,
};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum SimpleCashDividendEvidence {
    EligibleSimpleCash(f64),
    Ineligible(SimpleCashDividendReason),
}

/// Typed reasons, independent of the legacy parser's human-readable messages.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SimpleCashDividendReason {
    EmptyPurpose,
    NotDividend,
    CompoundAction,
    UnitOrMixedDistribution,
    InclusiveOrSpecialDividend,
    MultipleDividendComponents,
    NotSimpleExplicitPerShareCash,
    ExistingParserDidNotConfirm,
    MissingStoredCashAmount,
    InvalidStoredCashAmount,
    StoredCashAmountMismatch,
}

/// Accept a deliberately small, whole-purpose grammar, then obtain the amount
/// from the existing parser. Unsupported wording stays manual-only: this does
/// not alter what the existing parser or manual approval path can accept.
///
/// Grammar: [Interim|Final] Dividend|Div [-|:] Rs[.]|Re[.]|INR|₹
///          unsigned-decimal [/-] per share[.]
/// Case and whitespace are ignored; no rounding, percentage conversion, grouped
/// numerals, numeric aggregation, or interpretation of qualifiers is performed.
pub(crate) fn classify_simple_cash_dividend_evidence(
    purpose_raw: &str,
) -> SimpleCashDividendEvidence {
    use SimpleCashDividendEvidence::{EligibleSimpleCash, Ineligible};
    use SimpleCashDividendReason::*;

    let normalized = normalize_text(purpose_raw);
    if normalized.is_empty() {
        return Ineligible(EmptyPurpose);
    }
    // Reuse the parser's unit recognition, and reject mixed cash labels even
    // when they appear alongside a per-share dividend rather than a per-unit one.
    if looks_like_unit_distribution(&normalized)
        || normalized.contains("PER UNIT")
        || ["DISTRIBUTION", "DISTRITBUTION", "INTEREST", "PRINCIPAL", "REPAYMENT"]
            .iter()
            .any(|marker| normalized_token_position(&normalized, marker).is_some())
        || normalized.contains("OTHER INCOME")
        || normalized.contains("RETURN OF CAPITAL")
        || normalized.contains("RETURN ON CAPITAL")
    {
        return Ineligible(UnitOrMixedDistribution);
    }
    if normalized_dividend_marker_count(&normalized) == 0 {
        return Ineligible(NotDividend);
    }
    if compound_action_primary_type(&normalized).is_some()
        || ["DEMERGER", "SPINOFF", "ARRANGEMENT", "MERGER", "BUYBACK"]
            .iter()
            .any(|marker| normalized_token_position(&normalized, marker).is_some())
        || normalized.contains("DE MERGER")
        || normalized.contains("SPIN OFF")
        || normalized.contains("BUY BACK")
    {
        return Ineligible(CompoundAction);
    }
    if contains_inclusive_dividend_total(&normalized)
        || normalized_token_position(&normalized, "SPECIAL").is_some()
    {
        return Ineligible(InclusiveOrSpecialDividend);
    }
    if normalized_dividend_marker_count(&normalized) != 1 {
        return Ineligible(MultipleDividendComponents);
    }
    if !has_simple_per_share_cash_form(purpose_raw) {
        return Ineligible(NotSimpleExplicitPerShareCash);
    }

    let parsed = parse_corporate_action_purpose(purpose_raw);
    if parsed.action_type != "DIVIDEND"
        || parsed.parse_status != "PARSED"
        || parsed.factor.is_some()
        || parsed.price_factor.is_some()
    {
        return Ineligible(ExistingParserDidNotConfirm);
    }
    match parsed.cash_amount.and_then(positive_number) {
        Some(amount) => EligibleSimpleCash(amount),
        None => Ineligible(ExistingParserDidNotConfirm),
    }
}

/// Check a caller-supplied stored value; no database lookup occurs here.
/// Both values use the existing positive finite f64 representation. Exact
/// numeric equality is intentional: do not introduce an epsilon or cash rounding.
pub(crate) fn revalidate_simple_cash_dividend_evidence(
    purpose_raw: &str,
    stored_cash_amount: Option<f64>,
) -> SimpleCashDividendEvidence {
    use SimpleCashDividendEvidence::{EligibleSimpleCash, Ineligible};
    use SimpleCashDividendReason::*;

    let amount = match classify_simple_cash_dividend_evidence(purpose_raw) {
        EligibleSimpleCash(amount) => amount,
        ineligible => return ineligible,
    };
    let Some(stored) = stored_cash_amount else {
        return Ineligible(MissingStoredCashAmount);
    };
    if positive_number(stored).is_none() {
        return Ineligible(InvalidStoredCashAmount);
    }
    if stored != amount {
        return Ineligible(StoredCashAmountMismatch);
    }
    EligibleSimpleCash(amount)
}

/// Lexical restriction, not another amount parser. In particular this blocks
/// negative/cancelled/conditional or partially parsed amounts that a broader
/// manual parser might otherwise accept. Only the existing parser converts f64.
fn has_simple_per_share_cash_form(purpose_raw: &str) -> bool {
    let compact = purpose_raw
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase();
    let Some(without_suffix) = compact
        .strip_suffix(" PER SHARE.")
        .or_else(|| compact.strip_suffix(" PER SHARE"))
    else {
        return false;
    };
    let Some(remainder) = [
        "INTERIM DIVIDEND", "INTERIM DIV", "FINAL DIVIDEND", "FINAL DIV", "DIVIDEND", "DIV",
    ]
    .iter()
    .find_map(|prefix| {
        without_suffix.strip_prefix(*prefix).filter(|remaining| {
            remaining.starts_with(' ') || remaining.starts_with('-') || remaining.starts_with(':')
        })
    }) else {
        return false;
    };
    let remainder = remainder.trim_start();
    let remainder = remainder
        .strip_prefix('-')
        .or_else(|| remainder.strip_prefix(':'))
        .unwrap_or(remainder)
        .trim_start();
    let Some(number) = ["RS.", "RS", "RE.", "RE", "INR", "₹"]
        .iter()
        .find_map(|marker| remainder.strip_prefix(*marker))
    else {
        return false;
    };
    let number = number.trim();
    let number = number.strip_suffix("/-").unwrap_or(number).trim_end();
    let mut parts = number.split('.');
    let integral = parts.next().unwrap_or_default();
    if integral.is_empty() || !integral.bytes().all(|ch| ch.is_ascii_digit()) {
        return false;
    }
    if let Some(fractional) = parts.next() {
        if fractional.is_empty() || !fractional.bytes().all(|ch| ch.is_ascii_digit()) {
            return false;
        }
    }
    parts.next().is_none()
}
